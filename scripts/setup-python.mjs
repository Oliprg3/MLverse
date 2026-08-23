import { spawn } from "node:child_process";

/**
 * Best-effort install of the Python execution-engine dependencies.
 * Runs as part of `npm run build` so hosts like Render get the native
 * scikit-learn engine without extra dashboard configuration.
 *
 * Handles:
 *  - missing python/pip            → skipped gracefully
 *  - PEP 668 externally-managed env → retried with --break-system-packages
 *
 * Never fails the build; without Python the app uses its TypeScript engine.
 */

const PACKAGES = ["scikit-learn", "plotly", "nbformat", "networkx"];
const CANDIDATES = process.platform === "win32" ? ["python", "python3"] : ["python3", "python"];
const INSTALL_TIMEOUT_MS = 420_000;

function run(bin, args, timeoutMs) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    } catch {
      resolve({ ok: false, output: "" });
      return;
    }
    const timer = setTimeout(() => {
      child.kill();
      resolve({ ok: false, output: "timeout" });
    }, timeoutMs);
    let output = "";
    child.stdout?.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr?.on("data", (chunk) => { output += chunk.toString(); });
    child.on("error", () => {
      clearTimeout(timer);
      resolve({ ok: false, output: "" });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, output });
    });
  });
}

for (const bin of CANDIDATES) {
  const version = await run(bin, ["--version"], 20_000);
  if (!version.ok) continue;
  console.log(`[setup-python] Found ${version.output.trim().split("\n")[0]} (${bin})`);

  const pip = await run(bin, ["-m", "pip", "--version"], 30_000);
  if (!pip.ok) {
    console.log(`[setup-python] ${bin} has no pip module; skipping.`);
    continue;
  }

  let ok = await run(bin, ["-m", "pip", "install", "--disable-pip-version-check", "--no-input", ...PACKAGES], INSTALL_TIMEOUT_MS);
  if (!ok.ok && /externally-managed|break-system-packages/i.test(ok.output)) {
    console.log("[setup-python] Externally managed environment detected; retrying with --break-system-packages.");
    ok = await run(bin, ["-m", "pip", "install", "--disable-pip-version-check", "--no-input", "--break-system-packages", ...PACKAGES], INSTALL_TIMEOUT_MS);
  }
  if (!ok.ok && /Permission denied|access is denied/i.test(ok.output)) {
    console.log("[setup-python] Permission denied; retrying with --user.");
    ok = await run(bin, ["-m", "pip", "install", "--disable-pip-version-check", "--no-input", "--user", ...PACKAGES], INSTALL_TIMEOUT_MS);
  }

  const verify = await run(bin, ["-c", "import sklearn; print(sklearn.__version__)"], 60_000);
  if (ok.ok && verify.ok) {
    console.log(`[setup-python] Native ML engine ready — scikit-learn ${verify.output.trim()} via ${bin}`);
    process.exit(0);
  }
  console.log(`[setup-python] Install failed via ${bin}. Detail:\n${ok.output.split("\n").slice(-6).join("\n")}`);
}

console.log("[setup-python] Continuing with the built-in TypeScript fallback engine.");
process.exit(0);
