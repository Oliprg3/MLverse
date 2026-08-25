/**
 * POST /api/nodes/db-fetch — executes a read-only SQL query against a user
 * supplied PostgreSQL (incl. Supabase / Neon) or MySQL database and returns a
 * typed, canvas-ready snapshot of the result set.
 *
 * Request  : { connectionString: string, sql: string, dialect?: "postgres" | "mysql" }
 * Response : { success: true,  rowCount, columns, columnTypes, rows, previewRows, truncated, dialect, queryMs }
 *            { success: false, error, hint? }
 *
 * Security posture:
 *   - SELECT/WITH/SHOW/DESCRIBE/EXPLAIN only — writes and DDL are rejected.
 *   - Single statement per request (no stacked queries).
 *   - A LIMIT is appended when the query has none, so a missing LIMIT can never
 *     drag a whole table into memory.
 *   - Hard connect + statement timeouts on both drivers.
 *   - Credentials are used server-side for this one query and never persisted.
 */

import type { NextRequest } from "next/server";
import type { DbDialect } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONNECT_TIMEOUT_MS = 10_000;
const STATEMENT_TIMEOUT_MS = 20_000;
const MAX_ROWS = 2000;
const PREVIEW_ROWS = 100;
const DEFAULT_LIMIT = 1000;

export interface DbFetchSuccess {
  success: true;
  rowCount: number;
  columns: string[];
  columnTypes: Record<string, string>;
  rows: Array<Record<string, string | number | boolean | null>>;
  previewRows: Array<Record<string, string | number | boolean | null>>;
  truncated: boolean;
  dialect: DbDialect;
  queryMs: number;
}

export interface DbFetchFailure {
  success: false;
  error: string;
  hint?: string;
}

export type DbFetchResponse = DbFetchSuccess | DbFetchFailure;

type CellValue = string | number | boolean | null;

interface ParsedUri {
  dialect: DbDialect;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: boolean;
}

/** Hosts that are known to require TLS (Supabase, Neon, RDS, …). */
const TLS_HOSTS = /(?:neon\.tech|supabase\.(?:co|com|net)|amazonaws\.com|azure\.com|render\.com|timescale\.com|aivencloud\.com|elephantsql\.com)$/i;

export class DbError extends Error {
  hint?: string;
  constructor(message: string, hint?: string) {
    super(message);
    this.name = "DbError";
    this.hint = hint;
  }
}

function parseConnectionString(raw: string, forced?: DbDialect): ParsedUri {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new DbError(
      "That connection string is not a valid URI.",
      "Expected a format like postgresql://user:password@host:5432/dbname or mysql://user:password@host:3306/dbname",
    );
  }

  const scheme = url.protocol.replace(":", "").toLowerCase();
  const dialect: DbDialect | null =
    forced ??
    (scheme === "postgres" || scheme === "postgresql" ? "postgres" : scheme === "mysql" || scheme === "mariadb" ? "mysql" : null);

  if (!dialect) {
    throw new DbError(
      `Unsupported database scheme “${scheme}:”.`,
      "Use postgres:// or postgresql:// for PostgreSQL, Supabase and Neon — or mysql:// for MySQL.",
    );
  }

  if (!url.username) {
    throw new DbError("The connection string has no user.", "Add the username before the host, e.g. postgresql://user:password@host/db");
  }
  if (!url.hostname) {
    throw new DbError("The connection string has no host.", "Add the host after the credentials, e.g. postgresql://user:password@host:5432/db");
  }

  const sslmode = (url.searchParams.get("sslmode") ?? "").toLowerCase();
  const ssl = sslmode === "disable" ? false : sslmode !== "" ? true : TLS_HOSTS.test(url.hostname);

  return {
    dialect,
    host: url.hostname,
    port: url.port ? Number(url.port) : dialect === "mysql" ? 3306 : 5432,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    ssl,
  };
}

/** Strip comments, then enforce a single read-only statement. */
function assertReadOnly(sql: string): string {
  const stripped = sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .replace(/#[^\n]*/g, " ")
    .trim();

  if (!stripped) {
    throw new DbError("The SQL query is empty.", "Write a SELECT statement, e.g. SELECT * FROM my_table LIMIT 1000");
  }

  const withoutTrailing = stripped.replace(/;+\s*$/, "");
  if (withoutTrailing.includes(";")) {
    throw new DbError("Only one statement can be run per fetch.", "Remove the extra semicolons so exactly one SELECT remains.");
  }

  const head = withoutTrailing.replace(/^[\s(/]+/, "").slice(0, 10).toUpperCase();
  const allowed = ["SELECT", "WITH", "SHOW", "DESCRIBE", "DESC", "EXPLAIN"];
  if (!allowed.some((kw) => head.startsWith(kw))) {
    throw new DbError(
      "This node only runs read-only queries.",
      "Start the statement with SELECT or WITH — INSERT, UPDATE, DELETE and DDL are not allowed.",
    );
  }
  return withoutTrailing;
}

/** Append a LIMIT when the query has none, so unbounded tables can't stall the node. */
function enforceRowCap(sql: string): string {
  return /\blimit\s+\d+/i.test(sql) ? sql : `${sql}\nLIMIT ${DEFAULT_LIMIT}`;
}

/** Postgres OID → semantic kind (pg returns numeric/int8 as strings by default). */
const PG_OID_KIND: Record<number, string> = {
  16: "boolean",
  20: "number", 21: "number", 23: "number", 700: "number", 701: "number", 1700: "number",
  1082: "date", 1083: "time", 1114: "datetime", 1184: "datetime",
};

const MYSQL_TYPE_KIND: Record<string, string> = {
  TINY: "number", SHORT: "number", INT24: "number", LONG: "number", LONGLONG: "number",
  FLOAT: "number", DOUBLE: "number", DECIMAL: "number", NEWDECIMAL: "number", YEAR: "number",
  DATE: "date", DATETIME: "datetime", TIMESTAMP: "datetime", TIME: "time",
};

/** Coerce a driver cell into a JSON-safe value. */
function sanitizeCell(value: unknown): CellValue {
  if (value === null || value === undefined) return null;
  const t = typeof value;
  if (t === "number") return value as number;
  if (t === "boolean") return value as boolean;
  if (t === "bigint") return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) return `<binary ${value.length}B>`;
  if (Array.isArray(value)) return `{${value.map((v) => sanitizeCell(v)).join(",")}}`;
  if (t === "object") return JSON.stringify(value);
  const s = String(value);
  return s.length > 10_000 ? `${s.slice(0, 10_000)}…` : s;
}

/**
 * Resolve a column's semantic type: driver metadata first, then the values
 * themselves (first non-null wins, "number"-looking strings stay strings so
 * numeric-typed text columns are still visible to the user).
 */
function inferColumnType(cells: unknown[], meta?: { oid?: number; mysqlType?: string }): string {
  const fromMeta = meta?.oid !== undefined
    ? PG_OID_KIND[meta.oid]
    : meta?.mysqlType
      ? MYSQL_TYPE_KIND[meta.mysqlType.toUpperCase()]
      : undefined;
  const probe = cells.find((c) => c !== null && c !== undefined);
  if (!fromMeta && probe !== undefined) {
    const t = typeof probe;
    if (t === "boolean") return "boolean";
    if (t === "number" || t === "bigint") return "number";
    if (probe instanceof Date) return "datetime";
  }
  return fromMeta ?? "string";
}

function friendlyDriverError(err: unknown, dialect: DbDialect): DbError {
  if (err instanceof DbError) return err;
  const e = err as { code?: string; message?: string; errno?: number; sqlMessage?: string };
  const raw = e.sqlMessage ?? e.message ?? "The database query failed.";
  const code = e.code ?? "";
  const map: Record<string, DbError> = {
    ECONNREFUSED: new DbError("Connection refused — nothing is listening on that host and port.", "Double-check the host and port in your connection string, and that the database accepts external connections."),
    ENOTFOUND: new DbError("The database host could not be found.", "Check the hostname spelling in your connection string."),
    ETIMEDOUT: new DbError("The connection timed out.", "The host may be behind a firewall or VPN. Allow-list this server's IP if the provider requires it."),
    "28P01": new DbError("Authentication failed — the user or password was rejected.", "Re-check the username and password portion of the connection string."),
    ER_ACCESS_DENIED_ERROR: new DbError("Authentication failed — the user or password was rejected.", "Re-check the username and password portion of the connection string."),
    "3D000": new DbError("That database does not exist on the server.", "Check the database name at the end of the connection string."),
    "42P01": new DbError("That table or view does not exist.", "Check the table name in your query and any schema prefix (schema.table)."),
    "42601": new DbError(`The query has a syntax error. ${raw}`, "Fix the SQL and try again."),
    "42703": new DbError(`A column in the query does not exist. ${raw}`, "Check the column names against the table's schema."),
    "42501": new DbError("Permission denied for this query.", "The database user needs SELECT rights on the table."),
    ER_NO_SUCH_TABLE: new DbError("That table or view does not exist.", "Check the table name in your query and any schema prefix."),
    ER_NOT_SUPPORTED_AUTH_MODE: new DbError("The server's auth plugin is not supported by this driver.", "For MySQL 8 use caching_sha2_password over TLS, or create a user with mysql_native_password."),
    HANDSHAKE_NO_SSL_SUPPORT: new DbError("The server rejected the TLS handshake.", "Append ?sslmode=disable to the connection string if the server does not support TLS."),
  };
  if (map[code]) return map[code];
  const sslish = /ssl|tls|certificate/i.test(raw);
  return new DbError(
    sslish ? "The secure connection to the database failed." : raw,
    sslish ? "Cloud providers (Supabase, Neon) need TLS — make sure ?sslmode=require is present." : undefined,
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  let body: { connectionString?: unknown; sql?: unknown; dialect?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ success: false, error: "The request body must be JSON." } satisfies DbFetchFailure, { status: 400 });
  }

  const connectionString = typeof body.connectionString === "string" ? body.connectionString.trim() : "";
  const rawSql = typeof body.sql === "string" ? body.sql : "";
  const forced = body.dialect === "postgres" || body.dialect === "mysql" ? body.dialect : undefined;

  if (!connectionString) {
    return Response.json({ success: false, error: "No connection string provided.", hint: "Paste your database URI in the field above." } satisfies DbFetchFailure, { status: 400 });
  }
  if (connectionString.length > 2048 || rawSql.length > 20_000) {
    return Response.json({ success: false, error: "The connection string or query is too large." } satisfies DbFetchFailure, { status: 400 });
  }

  let uri: ParsedUri;
  let sql: string;
  try {
    uri = parseConnectionString(connectionString, forced);
    sql = enforceRowCap(assertReadOnly(rawSql));
    if (uri.dialect === "postgres" && !uri.database) {
      throw new DbError("The connection string has no database name.", "Add it after the host, e.g. postgresql://user:pass@host:5432/postgres");
    }
  } catch (err) {
    const dbErr = friendlyDriverError(err, forced ?? "postgres");
    return Response.json({ success: false, error: dbErr.message, hint: dbErr.hint } satisfies DbFetchFailure);
  }

  const started = Date.now();
  try {
    const result = uri.dialect === "postgres" ? await runPostgres(uri, sql) : await runMysql(uri, sql);
    return Response.json({
      success: true,
      rowCount: result.rows.length,
      columns: result.columns,
      columnTypes: result.columnTypes,
      rows: result.rows,
      previewRows: result.rows.slice(0, PREVIEW_ROWS),
      truncated: result.rows.length > PREVIEW_ROWS,
      dialect: uri.dialect,
      queryMs: Date.now() - started,
    } satisfies DbFetchSuccess);
  } catch (err) {
    const dbErr = friendlyDriverError(err, uri.dialect);
    return Response.json({ success: false, error: dbErr.message, hint: dbErr.hint } satisfies DbFetchFailure);
  }
}

async function runPostgres(uri: ParsedUri, sql: string): Promise<{ columns: string[]; columnTypes: Record<string, string>; rows: Array<Record<string, CellValue>> }> {
  const { Client } = await import("pg");
  const client = new Client({
    host: uri.host,
    port: uri.port,
    user: uri.user,
    password: uri.password,
    database: uri.database,
    ssl: uri.ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    statement_timeout: STATEMENT_TIMEOUT_MS,
    query_timeout: STATEMENT_TIMEOUT_MS,
  });
  try {
    await client.connect();
    const result = await client.query({ text: sql, rowMode: "array" });
    const fields = result.fields ?? [];
    const columns = fields.map((f) => f.name);
    const rows = (result.rows as unknown[][]).slice(0, MAX_ROWS).map((cells) => {
      const row: Record<string, CellValue> = {};
      columns.forEach((name, i) => { row[name] = sanitizeCell(cells[i]); });
      return row;
    });
    const columnTypes: Record<string, string> = {};
    columns.forEach((name, i) => {
      columnTypes[name] = inferColumnType((result.rows as unknown[][]).slice(0, 200).map((r) => r[i]), { oid: fields[i]?.dataTypeID });
    });
    return { columns, columnTypes, rows };
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function runMysql(uri: ParsedUri, sql: string): Promise<{ columns: string[]; columnTypes: Record<string, string>; rows: Array<Record<string, CellValue>> }> {
  const mysql = await import("mysql2/promise");
  const conn = await mysql.createConnection({
    host: uri.host,
    port: uri.port,
    user: uri.user,
    password: uri.password,
    database: uri.database || undefined,
    ssl: uri.ssl ? { rejectUnauthorized: false } : undefined,
    connectTimeout: CONNECT_TIMEOUT_MS,
    dateStrings: false,
    supportBigNumbers: true,
  });
  try {
    const [result, fields] = await conn.query({ sql });
    const rowsIn = Array.isArray(result) ? (result as unknown[]) : [result];
    const columns = (fields ?? []).map((f) => f.name);
    const rows = rowsIn.slice(0, MAX_ROWS).map((raw) => {
      const record = raw as Record<string, unknown>;
      const row: Record<string, CellValue> = {};
      columns.forEach((name) => { row[name] = sanitizeCell(record[name]); });
      return row;
    });
    const columnTypes: Record<string, string> = {};
    columns.forEach((name, i) => {
      const rawType = (fields?.[i] as unknown as { type?: unknown } | undefined)?.type;
      columnTypes[name] = inferColumnType(rowsIn.slice(0, 200).map((r) => (r as Record<string, unknown>)[name]), { mysqlType: rawType === undefined ? undefined : String(rawType) });
    });
    return { columns, columnTypes, rows };
  } finally {
    await conn.end().catch(() => undefined);
  }
}
