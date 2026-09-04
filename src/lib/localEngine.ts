/**
 * localEngine.ts — in-browser training via the Pyodide WebAssembly worker.
 *
 * Runs real scikit-learn on the user's machine: no upload, no server compute.
 * The worker boots lazily on first use (~15 MB from CDN, cached afterwards).
 */

import type { ExecutionResponse, GraphPayload } from "./types";

const WORKER_URL = "/pyodide/engine-worker.js";

type Pending = {
  resolve: (value: InstantLike) => void;
  reject: (reason: Error) => void;
  onStep?: (message: string) => void;
};

type InstantLike = Extract<ExecutionResponse, { route: "instant" }>;

let worker: Worker | null = null;
let ready = false;
let runCounter = 0;
const pending = new Map<number, Pending>();

export function pyodideSupported(): boolean {
  return typeof Worker !== "undefined" && typeof window !== "undefined";
}

function ensureWorker(): Worker {
  if (worker) return worker;
  if (!pyodideSupported()) throw new Error("Web Workers are unavailable in this browser.");
  worker = new Worker(WORKER_URL);
  worker.onmessage = (event: MessageEvent) => {
    const msg = event.data as {
      type: string; id?: number; message?: string; data?: InstantLike;
    };
    switch (msg.type) {
      case "boot":
      case "step":
        for (const entry of pending.values()) entry.onStep?.(msg.message ?? "Working…");
        break;
      case "ready":
        ready = true;
        break;
      case "result": {
        const entry = msg.id !== undefined ? pending.get(msg.id) : undefined;
        if (entry) {
          pending.delete(msg.id!);
          entry.resolve(msg.data!);
        }
        break;
      }
      case "error": {
        const entry = msg.id !== undefined ? pending.get(msg.id) : undefined;
        if (entry) {
          pending.delete(msg.id!);
          entry.reject(new Error(msg.message ?? "Local engine failed"));
        }
        break;
      }
    }
  };
  worker.onerror = () => {
    for (const [, entry] of pending) entry.reject(new Error("The local Python runtime crashed while loading."));
    pending.clear();
    worker?.terminate();
    worker = null;
    ready = false;
  };
  return worker;
}

/** Train the graph fully client-side. Resolves with the standard instant response shape. */
export function trainInBrowser(
  payload: GraphPayload,
  onStep?: (message: string) => void,
): Promise<InstantLike> {
  const w = ensureWorker();
  const id = ++runCounter;
  return new Promise<InstantLike>((resolve, reject) => {
    pending.set(id, { resolve, reject, onStep });
    w.postMessage({ type: "run", id, payload });
  });
}

/** Cached server-engine probe so the canvas can pick the best tier per run. */
let serverEngineCache: { at: number; native: boolean; torch: boolean } | null = null;

export interface ServerEngineInfo {
  /** True when the server has the sklearn Python stack. */
  native: boolean;
  /** True when the server's Python also imports PyTorch → DL trains in-app. */
  torch: boolean;
}

export async function serverHasNativePython(): Promise<boolean> {
  return (await probeServerEngine()).native;
}

/** Full probe: sklearn availability + PyTorch availability (in-app DL training). */
export async function probeServerEngine(): Promise<ServerEngineInfo> {
  if (serverEngineCache && Date.now() - serverEngineCache.at < 60_000) {
    return { native: serverEngineCache.native, torch: serverEngineCache.torch };
  }
  let info: ServerEngineInfo = { native: false, torch: false };
  try {
    const res = await fetch("/api/execute", { cache: "no-store" });
    const data = (await res.json()) as { engine?: string; torch?: boolean };
    info = { native: data.engine === "native-python", torch: data.torch === true };
  } catch {
    info = { native: false, torch: false };
  }
  serverEngineCache = { at: Date.now(), ...info };
  return info;
}
