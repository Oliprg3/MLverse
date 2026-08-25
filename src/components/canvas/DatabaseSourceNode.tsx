"use client";

/**
 * DatabaseSourceNode — canvas node for pulling tabular data straight from a
 * cloud SQL database (PostgreSQL, Supabase, Neon, MySQL) instead of a CSV.
 *
 * Shows a live connection badge, a "Configure & Query" action, and exposes a
 * right-side source handle carrying the fetched dataset downstream. The config
 * modal renders in a portal because React Flow node wrappers apply CSS
 * transforms, which would otherwise trap `position: fixed`.
 */

import { memo, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { Handle, Position, useReactFlow, type Node, type NodeProps } from "@xyflow/react";
import Papa from "papaparse";
import {
  CheckCircle,
  CircleNotch,
  Eye,
  EyeSlash,
  Lightning,
  PlugsConnected,
  Table,
  Warning,
  XCircle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import type { CsvDataset, DbDialect, DbSourceConfig, MLNodeData } from "@/lib/types";
import type { DbFetchResponse, DbFetchSuccess } from "@/app/api/nodes/db-fetch/route";
import { cn } from "@/lib/utils";

export type DbSourceFlowNode = Node<MLNodeData, "dbSource">;

const DEFAULT_QUERY = "SELECT * FROM table_name LIMIT 1000";
const TARGET_PATTERN = /^(target|label|class|category|outcome|y|dependent|diagnosis)$/i;

const PROVIDERS: Array<{ id: string; label: string; example: string; hint: string }> = [
  { id: "postgres", label: "PostgreSQL", example: "postgresql://user:password@host:5432/mydb", hint: "Any Postgres 12+ server. Append ?sslmode=require if the server enforces TLS." },
  { id: "supabase", label: "Supabase", example: "postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres?sslmode=require", hint: "Project Settings → Database → Connection string (URI). Keep ?sslmode=require." },
  { id: "neon", label: "Neon DB", example: "postgresql://user:password@ep-cool-name.eu-central-1.aws.neon.tech/neondb?sslmode=require", hint: "Neon dashboard → Connection Details. The endpoint hostname is region-specific." },
  { id: "mysql", label: "MySQL", example: "mysql://user:password@host:3306/mydb", hint: "MySQL 5.7+/8.x and MariaDB. TLS is enabled automatically for cloud hosts." },
];

function guessTableName(query: string): string | null {
  const m = query.match(/\bfrom\s+["`[]?([\w.$]+)["`\]]?/i);
  return m ? m[1].replace(/^["`[]|["`\]]$/g, "") : null;
}

function shortLabel(dialect: DbDialect, table: string): string {
  return `${dialect === "mysql" ? "MySQL" : "Postgres"} · ${table}`;
}

function DatabaseSourceNodeBase({ id, data }: NodeProps<DbSourceFlowNode>) {
  const { updateNodeData } = useReactFlow();
  const [open, setOpen] = useState(false);

  const db = data.dbConfig as DbSourceConfig | undefined;
  const dataset = data.dataset as CsvDataset | undefined;
  const status: DbSourceConfig["status"] = db?.status ?? "idle";

  return (
    <div
      className={cn(
        "nf-node-shell nf-node-corners group relative w-[252px] rounded-xl p-3.5",
        status === "connected" && "border-emerald-500/40 dark:border-emerald-400/30",
        status === "error" && "border-rose-500/40 dark:border-rose-400/30",
      )}
    >
      <Handle type="target" position={Position.Left} />
      {/* Output handle: passes columns, types and rows to downstream nodes */}
      <Handle type="source" position={Position.Right} />

      {/* Connection status badge */}
      <span
        title={status === "error" ? db?.error ?? "Last fetch failed" : undefined}
        className={cn(
          "absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em]",
          status === "connected" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
          status === "error" && "border-rose-500/30 bg-rose-500/10 text-rose-500",
          status === "idle" && "border-neutral-200/80 bg-neutral-100/60 text-neutral-400 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-zinc-500",
        )}
      >
        {status === "connected" ? <CheckCircle size={10} weight="fill" /> : status === "error" ? <XCircle size={10} weight="fill" /> : <PlugsConnected size={10} />}
        {status === "connected" ? "Connected" : status === "error" ? "Error" : "Not Configured"}
      </span>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200/90 dark:border-white/[0.1]">
          <PlugsConnected size={17} weight="regular" className="text-neutral-500 dark:text-zinc-400" />
        </div>
        <div className="min-w-0 pr-6">
          <h3 className="truncate text-[13px] font-semibold leading-tight tracking-tight text-neutral-900 dark:text-white">{data.label}</h3>
          <p className="nf-hud-label mt-1 !text-[8.5px]">Data Sources</p>
        </div>
      </div>

      {/* Body */}
      <div className="mt-3">
        {dataset ? (
          <div className="flex items-center gap-2 rounded-lg border border-neutral-200/70 bg-neutral-50/70 px-2.5 py-2 dark:border-white/[0.06] dark:bg-white/[0.03]">
            <Table size={14} weight="regular" className="shrink-0 text-neutral-400 dark:text-zinc-500" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11px] font-medium text-neutral-700 dark:text-zinc-300">{dataset.filename}</div>
              <div className="font-mono text-[9.5px] text-neutral-400 dark:text-zinc-500">
                {dataset.nrows.toLocaleString()} rows, {dataset.columns.length} cols
              </div>
            </div>
            <span className="shrink-0 rounded-md border border-neutral-200/80 bg-white/60 px-1.5 py-0.5 font-mono text-[9px] font-medium text-neutral-500 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-zinc-400">
              {dataset.targetColumn}
            </span>
          </div>
        ) : (
          <p className="line-clamp-1 text-[11px] leading-snug text-neutral-400 dark:text-zinc-500">{data.description}</p>
        )}

        {db?.query ? (
          <p className="mt-1.5 truncate rounded-md bg-neutral-100/60 px-1.5 py-1 font-mono text-[9px] text-neutral-400 dark:bg-white/[0.04] dark:text-zinc-500" title={db.query}>
            {db.query}
          </p>
        ) : null}

        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-neutral-300 px-2 py-1.5 text-[11px] font-semibold text-neutral-600 transition-colors hover:border-emerald-500/50 hover:text-emerald-500 dark:border-white/[0.12] dark:text-zinc-300 dark:hover:border-emerald-400/40 dark:hover:text-emerald-400"
        >
          <Lightning size={11} weight="fill" />
          {status === "idle" ? "Configure & Query" : "Edit Query"}
        </button>
      </div>

      <DatabaseConfigModal
        nodeId={id}
        open={open}
        onClose={() => setOpen(false)}
        config={db}
        onUpdate={updateNodeData}
      />
    </div>
  );
}

interface ModalProps {
  nodeId: string;
  open: boolean;
  onClose: () => void;
  config?: DbSourceConfig;
  onUpdate: (id: string, patch: Partial<MLNodeData>) => void;
}

function DatabaseConfigModal({ nodeId, open, onClose, config, onUpdate }: ModalProps) {
  // Unmount when closed so each open session starts from fresh state.
  if (!open) return null;
  return createPortal(
    <DatabaseConfigForm nodeId={nodeId} onClose={onClose} config={config} onUpdate={onUpdate} />,
    document.body,
  );
}

function DatabaseConfigForm({ nodeId, onClose, config, onUpdate }: Omit<ModalProps, "open">) {
  const [uri, setUri] = useState(config?.connectionString ?? "");
  const [query, setQuery] = useState(config?.query ?? DEFAULT_QUERY);
  const [reveal, setReveal] = useState(false);
  const [provider, setProvider] = useState(PROVIDERS[0]);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(config?.status === "error" ? config.error ?? null : null);
  const [hint, setHint] = useState<string | null>(null);
  const [result, setResult] = useState<DbFetchSuccess | null>(null);

  const testAndFetch = useCallback(async () => {
    setTesting(true);
    setError(null);
    setHint(null);
    setResult(null);
    try {
      const res = await fetch("/api/nodes/db-fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionString: uri, sql: query, dialect: provider.id === "mysql" ? "mysql" : provider.id === "postgres" ? "postgres" : undefined }),
      });
      const data = (await res.json()) as DbFetchResponse;
      const dialect: DbDialect = uri.trim().toLowerCase().startsWith("mysql") ? "mysql" : "postgres";
      if (!data.success) {
        setError(data.error);
        setHint(data.hint ?? null);
        onUpdate(nodeId, {
          dbConfig: {
            connectionString: uri, query, dialect, status: "error",
            error: data.error,
          },
        });
        return;
      }
      setResult(data);
      const table = guessTableName(query) ?? "query";
      const csvText = Papa.unparse(data.rows);
      const targetColumn = data.columns.find((c) => TARGET_PATTERN.test(c.trim())) ?? data.columns[data.columns.length - 1];
      const dataset: CsvDataset = {
        filename: `${data.dialect}:${table}.csv`,
        targetColumn,
        columns: data.columns,
        nrows: data.rowCount,
        csvText,
      };
      onUpdate(nodeId, {
        dataset,
        label: shortLabel(data.dialect, table),
        description: `${data.rowCount.toLocaleString()} rows, ${data.columns.length} cols, target: ${targetColumn}`,
        dbConfig: {
          connectionString: uri, query, dialect: data.dialect, status: "connected",
          fetchedAt: new Date().toISOString(), rowCount: data.rowCount, queryMs: data.queryMs,
        },
      });
    } catch {
      setError("Could not reach the server. Check your network and try again.");
    } finally {
      setTesting(false);
    }
  }, [nodeId, onUpdate, provider.id, query, uri]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="animate-modal-in relative flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground">Configure Cloud Database</h2>
            <p className="mt-0.5 truncate text-xs text-muted">Connect a SQL source and pull rows straight into the canvas.</p>
          </div>
          <button onClick={onClose} className="-mr-1 shrink-0 rounded-xl p-1.5 text-muted transition-colors hover:bg-foreground/[0.05] hover:text-foreground" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="scroll-thin flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {/* Provider presets */}
          <div className="grid grid-cols-4 gap-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProvider(p)}
                className={cn(
                  "rounded-lg border px-2 py-2 text-[11px] font-semibold transition-colors",
                  provider.id === p.id
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-500"
                    : "border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:text-neutral-700 dark:border-white/[0.09] dark:text-zinc-400 dark:hover:text-white",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] leading-relaxed text-neutral-400 dark:text-zinc-500">{provider.hint}</p>

          {/* Connection string (masked) */}
          <label className="block">
            <span className="mb-1 block text-xs font-medium tracking-tight text-neutral-700 dark:text-zinc-300">Connection string / Database URI</span>
            <span className="relative block">
              <input
                type={reveal ? "text" : "password"}
                value={uri}
                onChange={(e) => setUri(e.target.value)}
                placeholder={provider.example}
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-lg border border-neutral-200 bg-white/70 px-2.5 py-2 pr-9 font-mono text-[12px] text-neutral-900 transition-colors focus:border-neutral-400 dark:border-white/[0.09] dark:bg-white/[0.03] dark:text-white"
              />
              <button
                type="button"
                onClick={() => setReveal((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 transition-colors hover:text-neutral-700 dark:hover:text-white"
                aria-label={reveal ? "Hide connection string" : "Show connection string"}
              >
                {reveal ? <EyeSlash size={13} /> : <Eye size={13} />}
              </button>
            </span>
            <span className="mt-1 block text-[11px] text-neutral-400 dark:text-zinc-500">
              Credentials are used server-side for this query only and are never included in workflow exports.
            </span>
          </label>

          {/* SQL query */}
          <label className="block">
            <span className="mb-1 block text-xs font-medium tracking-tight text-neutral-700 dark:text-zinc-300">SQL query</span>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={5}
              spellCheck={false}
              className="w-full resize-y rounded-lg border border-neutral-200 bg-white/70 px-2.5 py-2 font-mono text-[12px] leading-relaxed text-neutral-900 transition-colors focus:border-neutral-400 dark:border-white/[0.09] dark:bg-white/[0.03] dark:text-white"
            />
            <span className="mt-1 block text-[11px] text-neutral-400 dark:text-zinc-500">
              Read-only — a single SELECT/WITH statement. A <code>LIMIT 1000</code> is added if your query has none.
            </span>
          </label>

          {/* Error */}
          {error ? (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/[0.07] p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold text-rose-500"><XCircle size={13} weight="fill" /> {error}</p>
              {hint ? <p className="mt-1 text-[11px] leading-relaxed text-rose-400/80">{hint}</p> : null}
            </div>
          ) : null}

          {/* Success */}
          {result ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.07] p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-500">
                <CheckCircle size={13} weight="fill" /> Connected — {result.rowCount.toLocaleString()} rows in {result.queryMs} ms
              </p>
              <p className="mt-1 font-mono text-[10.5px] text-emerald-400/80">
                {result.columns.map((c, i) => `${c}:${result.columnTypes[c] ?? "?"}${i < result.columns.length - 1 ? " · " : ""}`).join("")}
              </p>
              <div className="scroll-thin mt-2 max-h-36 overflow-auto rounded-md border border-emerald-500/20">
                <table className="w-full text-left font-mono text-[10px]">
                  <thead className="sticky top-0 bg-emerald-500/10 text-emerald-500">
                    <tr>
                      {result.columns.slice(0, 6).map((c) => <th key={c} className="truncate px-2 py-1 font-semibold">{c}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200/60 dark:divide-white/[0.05]">
                    {result.previewRows.slice(0, 6).map((row, i) => (
                      <tr key={i}>
                        {result.columns.slice(0, 6).map((c) => (
                          <td key={c} className="max-w-24 truncate px-2 py-1 text-neutral-600 dark:text-zinc-400">{row[c] === null ? "∅" : String(row[c])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-1.5 flex items-center gap-1 text-[10.5px] text-emerald-400/80">
                <Warning size={10} /> Showing the first 6 of {result.previewRows.length} preview rows — the full result is attached to the node.
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
          <p className="text-[11px] text-neutral-400 dark:text-zinc-500">Supabase &amp; Neon are PostgreSQL — use the same URI format.</p>
          <div className="flex shrink-0 gap-2">
            <Button variant="ghost" onClick={onClose}>Done</Button>
            <Button variant="primary" disabled={testing || !uri.trim() || !query.trim()} onClick={() => void testAndFetch()}>
              {testing ? <CircleNotch size={15} className="animate-spin" /> : <Lightning size={15} weight="fill" />}
              {testing ? "Testing…" : "Test & Fetch Data"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const DatabaseSourceNode = memo(DatabaseSourceNodeBase);
export default DatabaseSourceNode;
