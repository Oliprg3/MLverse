import { NextResponse, type NextRequest } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";
import type { GraphPayload } from "@/lib/types";
import { collectRequestedCharts } from "@/lib/chartCatalog";
import { executeGraph } from "@/lib/tsEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXEC_TIMEOUT_MS = 90_000;

type EngineProbe = { available: boolean; version: string | null; reason: string | null };

let probeCache: { at: number; probe: EngineProbe } | null = null;
const PROBE_TTL_MS = 60_000;

/** Probe the host machine for a usable Python engine (sklearn + helpers).
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
      child = spawn(
        bin,
        ["-c", "import sys, sklearn, plotly, nbformat, networkx; print(sys.version.split()[0])"],
        { cwd: process.cwd(), env: process.env, stdio: ["ignore", "pipe", "pipe"], timeout: 20_000 },
      );
    } catch {
      finish({ available: false, version: null, reason: `${bin} runtime not found on this machine` });
      return;
    }
    child.stdout?.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on("error", () => finish({ available: false, version: null, reason: `${bin} runtime not found on this machine` }));
    child.on("close", (code) => {
      if (code === 0) {
        finish({ available: true, version: stdout.trim() || null, reason: null });
        return;
      }
      const missing = stderr.match(/No module named ['"]([\w.]+)['"]/);
      finish({
        available: false,
        version: null,
        reason: missing ? `missing Python package "${missing[1]}"` : "required Python packages are not installed",
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
          message: `Machine check: Python ${probe.version ?? ""} + scikit-learn detected — routing to the native engine…`.replace(/\s+/g, " "),
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
          message: `Machine check: native Python engine unavailable (${probe.reason}) — switching to the built-in TypeScript engine…`,
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
    let child;
    try {
      child = spawn(process.platform === "win32" ? "python" : "python3", [cliPath, "execute"], {
        cwd: process.cwd(),
        env: { ...process.env, PYTHONUNBUFFERED: "1" },
        stdio: ["pipe", "pipe", "pipe"],
        timeout: EXEC_TIMEOUT_MS,
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

/** Never manufacture metrics when the real Python engine is unavailable. */
async function streamTs(graph: GraphPayload, send: (obj: unknown) => void, probe?: EngineProbe) {
  const model = graph.nodes.find((node) => node.category === "classic_ml");
  const supportedFallback = model?.type === "ml:knn" || model?.type === "ml:naive_bayes";
  if (graph.nodes.some((node) => node.category === "deep_learning") || !supportedFallback) {
    const isDeepLearning = graph.nodes.some((node) => node.category === "deep_learning");
    const probeNote = probe && !probe.available && probe.reason ? ` Machine check failed: ${probe.reason}.` : "";
    const message = isDeepLearning
      ? "Deep-learning training requires the Python runtime with PyTorch. Open the editable notebook in Colab to train on GPU."
      : `The selected model (${model?.label ?? "classical ML"}) requires the Python scikit-learn engine.${probeNote} Install backend requirements on this machine and restart the app.`;
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
    machine_check: probe.available ? "ok" : probe.reason,
  });
}
