import { spawn } from "node:child_process";

/**
 * Best-effort install of the Python execution-engine dependencies.
 * Runs as part of `npm run build` so hosts like Render get the native
 * scikit-learn engine without extra dashboard configuration.
 * Never fails the build: if Python or pip is missing we simply skip and
 * the app falls back to its built-in TypeScript engine at runtime.
 */

const PACKAGES = ["scikit-learn", "plotly", "nbformat", "networkx"];
const CANDIDATES = process.platform === "win32" ? ["python", "python3"] : ["python3", "python"];

function run(bin, args, timeoutMs = 420_000) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    } catch {
      resolve(false);
      return;
    }
    const timer = setTimeout(() => {
      child.kill();
      resolve(false);
    }, timeoutMs);
    let stderr = "";
    child.stdout?.on("data", () => {});
    child.stderr?.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve(code === 0 ? true : (stderr.match(/No module named ['"]pip['"]/) ? false : code === 0));
    });
  });
}

for (const bin of CANDIDATES) {
  const hasPip = await run(bin, ["-m", "pip", "--version"], 30_000);
  if (!hasPip) continue;
  const ok = await run(bin, ["-m", "pip", "install", "--disable-pip-version-check", "--no-input", ...PACKAGES]);
  console.log(ok ? `[setup-python] Native ML engine ready via ${bin} (${PACKAGES.join(", ")})` : `[setup-python] pip install failed via ${bin}; continuing with TypeScript fallback engine.`);
  process.exit(0);
}

console.log("[setup-python] No Python runtime found; continuing with TypeScript fallback engine.");
process.exit(0);
