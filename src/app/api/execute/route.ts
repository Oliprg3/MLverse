import { NextResponse, type NextRequest } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";
import type { GraphPayload } from "@/lib/types";
import { collectRequestedCharts } from "@/lib/chartCatalog";
import { executeGraph } from "@/lib/tsEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXEC_TIMEOUT_MS = 90_000;
/** Auto-installing PyTorch on first DL run takes minutes — let it breathe. */
const DL_INSTALL_TIMEOUT_MS = 480_000;

type EngineProbe = { available: boolean; version: string | null; reason: string | null; torch: boolean };

let probeCache: { at: number; probe: EngineProbe } | null = null;
const PROBE_TTL_MS = 60_000;

/** Probe the host machine for a usable Python engine (sklearn + helpers) and
 *  whether PyTorch is importable (enables in-app deep-learning training).
 *  Result is cached briefly so repeated Train clicks don't re-pay the cost. */
function probePythonEngine(): Promise<EngineProbe> {
  if (probeCache && Date.now() - probeCache.at < PROBE_TTL_MS) {
    return Promise.resolve(probeCache.probe);
  }
  const bin = process.platform === "win32" ? "python" : "python3";
  return new Promise<EngineProbe>((resolve) => {
    let settled = false;
    let stdout = "";
    let stderr = "";
    const finish = (probe: EngineProbe) => {
      if (settled) return;
      settled = true;
      probeCache = { at: Date.now(), probe };
      resolve(probe);
    };
    let child;
    try {
      // Each dependency is probed independently so one missing package (e.g.
      // nbformat) cannot mask a working PyTorch install — DL training needs
      // numpy+sklearn+torch, not the notebook/plot extras.
      const script = [
        "import sys",
        "mods=['sklearn','plotly','nbformat','networkx','numpy']",
        "ok=[]",
        "for m in mods:",
        "    try:",
        "        __import__(m); ok.append(m)",
        "    except Exception:",
        "        pass",
        "try:",
        "    import torch; ok.append('torch')",
        "except Exception:",
        "    pass",
        "print(sys.version.split()[0]); print(' '.join(ok))",
      ].join("\n");
      child = spawn(bin, ["-c", script], {
        cwd: process.cwd(),
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 20_000,
      });
    } catch {
      finish({ available: false, version: null, reason: `${bin} runtime not found on this machine`, torch: false });
      return;
    }
    child.stdout?.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on("error", () => finish({ available: false, version: null, reason: `${bin} runtime not found on this machine`, torch: false }));
    child.on("close", (code) => {
      const lines = stdout.trim().split(/\r?\n/);
      const version = lines[0]?.trim() || null;
      const found = new Set((lines[1] ?? "").split(/\s+/).filter(Boolean));
      const hasTorch = found.has("torch");
      // "Available" means the modules the *execution* path needs. The notebook
      // extras (plotly/nbformat) are not needed to train, so they must not gate
      // the run — otherwise a missing nbformat silently downgrades DL graphs to
      // a Colab hand-off even on a machine with a perfectly good PyTorch.
      const core = ["sklearn", "networkx", "numpy"].filter((m) => found.has(m));
      const missingCore = ["sklearn", "networkx", "numpy"].filter((m) => !found.has(m));
      if (code === 0 && missingCore.length === 0) {
        finish({ available: true, version, reason: null, torch: hasTorch });
        return;
      }
      if (code === 0 && missingCore.length > 0) {
        finish({
          available: false,
          version,
          reason: `missing Python package${missingCore.length > 1 ? "s" : ""} "${missingCore.join('", "')}"`,
          torch: hasTorch,
        });
        return;
      }
      const missing = stderr.match(/No module named ['"]([\w.]+)['"]/);
      finish({
        available: false,
        version: null,
        reason: missing ? `missing Python package "${missing[1]}"` : "required Python packages are not installed",
        torch: hasTorch,
      });
    });
  });
}

/**
 * Streams newline-delimited JSON events so the UI can show the training
 * happening live (step logs + metrics) before the final result:
 *   {"type":"step","message":"..."}
 *   {"type":"metric","name":"accuracy","value":0.95}
 *   {"type":"result","data":{<full response>}}
 */
export async function POST(req: NextRequest) {
  let graph: GraphPayload;
  try {
    graph = (await req.json()) as GraphPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!graph?.nodes?.length) {
    return NextResponse.json({ error: "The canvas is empty." }, { status: 400 });
  }

  const forceTs = req.nextUrl.searchParams.get("engine") === "ts";
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));

      // 1) Machine check — detect whether this server can run the native
      //    Python engine, say so in the live console, then use it if present.
      const probe = forceTs ? null : await probePythonEngine();
      if (probe?.available) {
        await send({
          type: "step",
          message: `Server check: Python ${probe.version ?? ""} + scikit-learn found on this deployment — routing to the native engine…`.replace(/\s+/g, " "),
        });
        const ok = await pipePython(graph, (line: string) =>
          controller.enqueue(encoder.encode(`${line}\n`)),
        );
        if (ok) {
          controller.close();
          return;
        }
      } else if (probe?.torch && hasDeepLearning(graph)) {
        // Torch is importable but a core module is missing: the Python engine
        // will still be spawned so its own diagnostics (and auto-install) can
        // report the real cause instead of us guessing from the probe.
        await send({
          type: "step",
          message: `Server check: PyTorch detected on this deployment, but the ML stack is incomplete (${probe.reason}) — attempting the native engine anyway…`.replace(/\s+/g, " "),
        });
        const ok = await pipePython(graph, (line: string) =>
          controller.enqueue(encoder.encode(`${line}\n`)),
        );
        if (ok) {
          controller.close();
          return;
        }
      } else if (probe) {
        await send({
          type: "step",
          message: `Server check: no Python ML stack on this deployment (${probe.reason}) — using the built-in TypeScript engine. Note: training always runs on the server, never on your computer.`,
        });
      }
      // 2) Resilience fallback — synthesize a streamed experience in TS.
      await streamTs(graph, send, probe ?? undefined);
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

/** Spawn Python and forward its NDJSON stdout lines. Resolves false if Python
 *  is unavailable so the caller can use the TS fallback. */
function pipePython(graph: GraphPayload, pushLine: (line: string) => void): Promise<boolean> {
  return new Promise((resolve) => {
    const cliPath = path.join(process.cwd(), "backend", "cli.py");
    const hasDl = graph.nodes.some((node) => node?.category === "deep_learning");
    let child;
    try {
      child = spawn(process.platform === "win32" ? "python" : "python3", [cliPath, "execute"], {
        cwd: process.cwd(),
        env: { ...process.env, PYTHONUNBUFFERED: "1" },
        stdio: ["pipe", "pipe", "pipe"],
        timeout: hasDl ? DL_INSTALL_TIMEOUT_MS : EXEC_TIMEOUT_MS,
      });
    } catch {
      resolve(false);
      return;
    }

    let settled = false;
    let buffer = "";
    let produced = false;

    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };

    if (!child.stdout || !child.pid) {
      // Spawn failed (e.g. python3 missing) — an 'error' event will follow.
      child.on?.("error", () => done(false));
      child.on?.("close", () => done(false));
      return;
    }

    // Feed the graph JSON to the engine via stdin (cli.py reads stdin).
    if (child.stdin) {
      child.stdin.on("error", () => undefined);
      child.stdin.write(JSON.stringify(graph));
      child.stdin.end();
    }

    child.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (line) {
          pushLine(line);
          produced = true;
        }
      }
    });

    child.on("error", () => done(false));
    child.on("close", (code) => {
      const rest = buffer.trim();
      if (rest) {
        pushLine(rest);
        produced = true;
      }
      done(produced && code === 0);
    });
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const hasDeepLearning = (graph: GraphPayload) =>
  graph.nodes.some((node) => node?.category === "deep_learning");

/** Never manufacture metrics when the real Python engine is unavailable. */
async function streamTs(graph: GraphPayload, send: (obj: unknown) => void, probe?: EngineProbe) {
  // Deep-learning graphs without a native torch engine hand off to a ready-made
  // Colab notebook instead of dying — the frontend already renders that view.
  if (hasDeepLearning(graph)) {
    // Be precise about *why* in-app training is unavailable — "no PyTorch" is
    // wrong and unhelpful when the real blocker is a missing sklearn/networkx
    // or an interpreter that isn't there at all.
    const cause = !probe
      ? "the Python engine was skipped"
      : !probe.available && !probe.torch
        ? `this deployment cannot run the Python engine (${probe.reason})`
        : "PyTorch could not be installed on this deployment";
    await send({
      type: "step",
      message: `In-app deep-learning training is unavailable because ${cause} — generating a ready-to-run Colab notebook instead. Install backend/requirements.txt (including torch) on the server to train in-app.`,
    });
    const result = executeGraph(graph);
    await sleep(120);
    await send({ type: "result", data: result });
    return;
  }
  const model = graph.nodes.find((node) => node.category === "classic_ml");
  const supportedFallback = model?.type === "ml:knn" || model?.type === "ml:naive_bayes";
  if (!supportedFallback) {
    const probeNote = probe && !probe.available && probe.reason ? ` Machine check failed: ${probe.reason}.` : "";
    const message = `The selected model (${model?.label ?? "classical ML"}) requires the Python scikit-learn engine.${probeNote} Install backend requirements on this machine and restart the app.`;
    const error = {
      route: "instant",
      status: "error",
      engine: "no-fake-fallback",
      pipeline: { steps: [] },
      dataset: { name: "", n_samples: 0, n_features: 0, n_classes: 0, target_type: "" },
      model: { name: model?.label ?? "", framework: "" },
      metrics: { accuracy: 0, precision: 0, recall: 0, f1: 0, roc_auc: 0, average_precision: 0 },
      charts: {},
      charts_requested: collectRequestedCharts(graph.nodes),
      predictions: { y_true: [], y_pred: [], classes: [], n_test: 0 },
      timing: { total_seconds: 0, training_seconds: 0 },
      error: message,
    };
    await send({ type: "step", message });
    await send({ type: "result", data: error });
    return;
  }
  const result = executeGraph(graph);
  await send({ type: "step", message: "Python runtime unavailable; using the deterministic KNN/Naive Bayes engine…" });
  await sleep(140);
  if (result.status === "error") {
    await send({ type: "step", message: result.error ?? "Execution failed" });
    await send({ type: "result", data: result });
    return;
  }
  const steps = (result as { pipeline?: { steps?: { name: string; detail?: string }[] } }).pipeline?.steps ?? [];
  for (const step of steps) {
    await send({ type: "step", message: `${step.name}${step.detail ? ` · ${step.detail}` : ""}` });
    await sleep(110);
  }
  const metrics = (result as { metrics?: Record<string, number> }).metrics ?? {};
  await send({ type: "step", message: "Computing evaluation metrics…" });
  for (const [k, v] of Object.entries(metrics)) {
    await send({ type: "metric", name: k, value: v });
    await sleep(40);
  }
  await send({ type: "result", data: result });
}

export async function GET() {
  const probe = await probePythonEngine();
  return NextResponse.json({
    service: "Hybrid Execution Router (streaming NDJSON)",
    engine: probe.available ? "native-python" : "typescript-fallback",
    python_version: probe.version,
    torch: probe.torch,
    machine_check: probe.available ? "ok" : probe.reason,
  });
}
