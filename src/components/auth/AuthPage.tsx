"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  At,
  CaretRight,
  Check,
  CheckCircle,
  Eye,
  EyeSlash,
  Lock,
  SpinnerGap,
  TrendDown,
  User,
} from "@phosphor-icons/react";

type Mode = "signin" | "signup";
type Flow = "idle" | "processing" | "success";

/* ── Brand icons ───────────────────────────────────────────────────── */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.15c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.39-5.25 5.68.41.35.77 1.05.77 2.12v3.14c0 .3.21.66.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.86-3.08.38-1.09-.5-2.08-.53-3.2 0-1.44.69-2.2.5-3.05-.38C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.56-.84 1.51.12 2.65.72 3.4 1.8-3.1 1.87-2.6 6 1.96 7.75-.55 1.45-1.3 2.86-3 3.46zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.28.36 2.18-1.83 4.4-3.74 4.28z" />
    </svg>
  );
}

/* ── Animated neural field for the brand panel ─────────────────────── */
const LAYERS = [
  { x: 84, ys: [84, 150, 216, 282] },
  { x: 214, ys: [58, 122, 186, 250, 314] },
  { x: 344, ys: [58, 122, 186, 250, 314] },
  { x: 474, ys: [122, 186, 250] },
];

function NeuralField() {
  const edges: Array<[number, number, number, number]> = [];
  for (let i = 0; i < LAYERS.length - 1; i++) {
    for (const y1 of LAYERS[i].ys) {
      for (const y2 of LAYERS[i + 1].ys) {
        edges.push([LAYERS[i].x, y1, LAYERS[i + 1].x, y2]);
      }
    }
  }
  return (
    <svg viewBox="0 0 560 380" className="h-full w-full" aria-hidden="true" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="nf-auth-edge" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.07" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.85" />
        </linearGradient>
      </defs>
      {edges.map(([x1, y1, x2, y2], k) => (
        <line
          key={k}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          className="nf-edge-flow"
          stroke="url(#nf-auth-edge)"
          strokeWidth="1.2"
          strokeDasharray="3 7"
          opacity="0.7"
        />
      ))}
      {LAYERS.map((layer, li) =>
        layer.ys.map((y, ni) => (
          <g key={`${li}-${ni}`}>
            <circle
              cx={layer.x}
              cy={y}
              r="13"
              fill="none"
              stroke="#38bdf8"
              strokeOpacity="0.18"
              style={{ animationDelay: `${(li * 3 + ni) * 0.12}s` }}
              className="animate-pulse-ring"
            />
            <circle
              cx={layer.x}
              cy={y}
              r="4.5"
              fill={li === LAYERS.length - 1 ? "#7dd3fc" : "#38bdf8"}
              className="nf-glow-dot"
              style={{ animationDelay: `${(li * 3 + ni) * 0.12}s` }}
            />
          </g>
        )),
      )}
    </svg>
  );
}

/* ── Shared bits ───────────────────────────────────────────────────── */
function Field({
  label,
  icon,
  children,
  hint,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="group/field block">
      <span className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-neutral-400 dark:text-zinc-500">
        {icon}
        {label}
      </span>
      <span className="relative block">
        {children}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px origin-left bg-neutral-900 scale-x-0 transition-transform duration-500 ease-out group-focus-within/field:scale-x-100 dark:bg-sky-400"
        />
      </span>
      {hint ? <span className="mt-1.5 block text-xs text-neutral-400 dark:text-zinc-500">{hint}</span> : null}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors duration-200 focus:border-neutral-900 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-zinc-600 dark:focus:border-sky-400/60 dark:focus:bg-white/[0.05]";

export function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  const [flow, setFlow] = useState<Flow>("idle");
  const [showPw, setShowPw] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const strength = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  }, [password]);

  const strengthLabel = ["Too weak", "Weak", "Okay", "Good", "Strong"][strength];
  const strengthColor = ["bg-red-400", "bg-orange-400", "bg-amber-400", "bg-emerald-400", "bg-sky-400"][strength];

  const launchApp = () => {
    window.setTimeout(() => router.push("/canvas"), 500);
  };

  const handleProvider = (name: string) => {
    if (pendingProvider) return;
    setPendingProvider(name);
    window.setTimeout(() => {
      setPendingProvider(null);
      launchApp();
    }, 1200);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (flow !== "idle") return;
    setFlow("processing");
    window.setTimeout(() => {
      setFlow("success");
      launchApp();
    }, 1500);
  };

  const resetFlow = () => {
    if (flow === "processing") return;
    setFlow("idle");
  };

  const switchMode = (m: Mode) => {
    if (m === mode) return;
    setMode(m);
    resetFlow();
  };

  const busy = flow === "processing" || flow === "success" || pendingProvider !== null;

  return (
    <div className="dark relative flex min-h-[100svh] w-full flex-col overflow-hidden bg-[#050506] lg:flex-row">
      {/* Left — animated brand panel */}
      <aside className="relative hidden w-1/2 overflow-hidden border-r border-white/[0.06] bg-[#030304] lg:block">
        <div className="nf-aurora pointer-events-none absolute -right-40 -top-40 h-[36rem] w-[36rem] rounded-full bg-sky-500/10 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-56 -left-40 h-[34rem] w-[34rem] rounded-full bg-indigo-500/10 blur-[130px]" />
        <div className="nf-grid-bg pointer-events-none absolute inset-0 opacity-[0.18]" />

        <div className="relative flex h-full flex-col justify-between px-10 py-9 xl:px-14">
          {/* Brand */}
          <div className="nf-auth-line flex items-center gap-2.5">
            <span className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
              <Image src="/datlify-mark.png" alt="" width={40} height={40} className="h-8 w-8 object-contain dark:brightness-0 dark:invert" />
            </span>
            <div>
              <p className="text-[15px] font-semibold tracking-tight text-white">Datlify</p>
              <p className="text-xs text-white/45">Identity console</p>
            </div>
          </div>

          {/* Neural field */}
          <div className="relative mx-auto w-full max-w-[560px]">
            <div className="nf-scan pointer-events-none absolute -inset-x-8 h-16 bg-gradient-to-b from-transparent via-sky-400/10 to-transparent" />
            <NeuralField />
          </div>

          {/* Live training readout */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <div className="nf-metric-pop flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2">
              <TrendDown size={13} className="text-emerald-400" weight="bold" />
              <div>
                <p className="font-mono text-sm leading-none text-white">0.00312</p>
                <p className="mt-1 text-xs text-white/45">val_loss</p>
              </div>
            </div>
            <div className="nf-metric-pop flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 [animation-delay:120ms]">
              <CheckCircle size={13} className="text-sky-400" weight="fill" />
              <div>
                <p className="font-mono text-sm leading-none text-white">98.4%</p>
                <p className="mt-1 text-xs text-white/45">val_acc</p>
              </div>
            </div>
            <div className="nf-metric-pop flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 [animation-delay:240ms]">
              <CaretRight size={13} className="text-white/60" weight="bold" />
              <div>
                <p className="font-mono text-sm leading-none text-white">12 / 50</p>
                <p className="mt-1 text-xs text-white/45">epoch</p>
              </div>
            </div>
            <div className="text-xs text-white/45">
              GPU mesh <span className="text-emerald-400">●</span> online
            </div>
          </div>

          {/* Trust strip */}
          <div className="nf-auth-line flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-white/45 [animation-delay:300ms]">
            <span>SOC 2</span>
            <span>GDPR</span>
            <span>TLS 1.3</span>
            <span className="ml-auto flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-glow-pulse" />
              All systems operational
            </span>
          </div>
        </div>
      </aside>

      {/* Right — auth card */}
      <main className="relative flex flex-1 items-center justify-center px-5 py-12 sm:px-8">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="nf-aurora pointer-events-none absolute -left-32 top-10 h-[28rem] w-[28rem] rounded-full bg-sky-500/[0.07] blur-[110px]" />
          <div className="nf-grid-bg pointer-events-none absolute inset-0 opacity-[0.14]" />
        </div>

        <div className="relative w-full max-w-md">
          {/* Mobile brand */}
          <div className="nf-auth-line mb-8 flex items-center justify-center gap-2 lg:hidden">
            <Image src="/datlify-mark.png" alt="Datlify" width={34} height={34} className="h-8 w-8 object-contain dark:brightness-0 dark:invert" />
            <span className="text-[15px] font-semibold tracking-tight text-white">Datlify</span>
          </div>

          <div className="glass-card overflow-hidden rounded-3xl shadow-[0_60px_160px_-60px_rgba(0,0,0,0.9)]">
            {/* Header */}
            <div className="border-b border-white/[0.06] px-7 pb-6 pt-8">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/40">Datlify // identity</p>
              <h1 key={mode} className="nf-auth-flip mt-2 text-2xl font-semibold tracking-tight text-white">
                {mode === "signin" ? "Welcome back" : "Create your account"}
              </h1>
              <p key={`${mode}-sub`} className="nf-auth-flip mt-1.5 text-[13px] text-white/45 [animation-delay:90ms]">
                {mode === "signin" ? "Sign in to continue to your pipelines." : "One account for the whole AI workspace."}
              </p>
            </div>

            <div className="px-7 py-7">
              {/* Mode switcher */}
              <div className="relative mb-6 grid grid-cols-2 rounded-xl border border-white/[0.06] bg-white/[0.03] p-1">
                <span
                  aria-hidden="true"
                  className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-white/[0.08] ring-1 ring-white/10 transition-transform duration-300 ease-out"
                  style={{ transform: mode === "signup" ? "translateX(100%)" : "translateX(0)" }}
                />
                {(["signin", "signup"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchMode(m)}
                    aria-pressed={mode === m}
                    className={`relative z-10 rounded-lg px-4 py-2 text-[13px] font-medium transition-colors duration-300 ${
                      mode === m ? "text-white" : "text-white/40 hover:text-white/70"
                    }`}
                  >
                    {m === "signin" ? "Sign in" : "Create account"}
                  </button>
                ))}
              </div>

              {/* Social */}
              <button
                type="button"
                onClick={() => handleProvider("Google")}
                disabled={busy}
                className={`group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white transition-all duration-300 hover:border-white/25 hover:bg-white/[0.08] active:scale-[0.99] disabled:opacity-70 ${
                  pendingProvider === "Google" ? "border-sky-400/50" : ""
                }`}
              >
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.06] to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                {pendingProvider === "Google" ? (
                  <SpinnerGap size={17} className="nf-conn-spin text-sky-400" weight="bold" />
                ) : (
                  <GoogleIcon />
                )}
                <span className="relative">{pendingProvider === "Google" ? "Connecting to Google…" : "Continue with Google"}</span>
              </button>

              <div className="mt-3 grid grid-cols-2 gap-3">
                {[
                  { id: "GitHub", icon: <GitHubIcon />, label: "GitHub" },
                  { id: "Apple", icon: <AppleIcon />, label: "Apple" },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleProvider(p.id)}
                    disabled={busy}
                    className={`group relative flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:border-white/25 hover:bg-white/[0.08] active:scale-[0.99] disabled:opacity-70 ${
                      pendingProvider === p.id ? "border-sky-400/50" : ""
                    }`}
                  >
                    {pendingProvider === p.id ? (
                      <SpinnerGap size={16} className="nf-conn-spin text-sky-400" weight="bold" />
                    ) : (
                      p.icon
                    )}
                    <span>{pendingProvider === p.id ? "Connecting…" : p.label}</span>
                  </button>
                ))}
              </div>

              {/* Divider */}
              <div className="my-6 flex items-center gap-3">
                <span className="h-px flex-1 bg-white/[0.07]" />
                <span className="text-xs font-medium text-white/45">or continue with email</span>
                <span className="h-px flex-1 bg-white/[0.07]" />
              </div>

              {/* Form */}
              <form key={mode} onSubmit={handleSubmit} className="nf-auth-flip flex flex-col gap-4">
                {mode === "signup" ? (
                  <Field label="Full name" icon={<User size={11} weight="bold" />}>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ada Lovelace"
                      required
                      className={inputCls}
                    />
                  </Field>
                ) : null}

                <Field label="Email" icon={<At size={11} weight="bold" />}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@team.ai"
                    required
                    className={inputCls}
                  />
                </Field>

                <Field
                  label={mode === "signup" ? "Password" : "Password"}
                  icon={<Lock size={11} weight="bold" />}
                  hint={
                    mode === "signup"
                      ? "Use 8+ characters with a mix of cases, numbers and symbols."
                      : undefined
                  }
                >
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "signup" ? "Create a strong password" : "Enter your password"}
                    required
                    minLength={mode === "signup" ? 8 : undefined}
                    className={`${inputCls} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 transition-colors hover:text-neutral-900 dark:text-zinc-500 dark:hover:text-white"
                  >
                    {showPw ? <EyeSlash size={16} /> : <Eye size={16} />}
                  </button>
                </Field>

                {mode === "signup" && password.length > 0 ? (
                  <div>
                    <div className="flex gap-1.5">
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className={`nf-strength-in h-1 flex-1 rounded-full ${i < strength ? strengthColor : "bg-white/[0.08]"}`}
                          style={{ animationDelay: `${i * 60}ms` }}
                        />
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs font-medium text-white/50">{strengthLabel}</p>
                  </div>
                ) : null}

                {mode === "signin" ? (
                  <div className="flex items-center justify-between">
                    <Link href="/forgot-password" className="text-[13px] font-medium text-sky-400/80 transition-colors hover:text-sky-300">
                      Forgot password?
                    </Link>
                    <span className="text-xs text-white/30">NF:// secure</span>
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={busy}
                  className="group relative mt-1 flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-white text-sm font-semibold text-neutral-900 transition-all duration-300 hover:bg-neutral-200 active:scale-[0.99] disabled:opacity-80"
                >
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-black/5 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                  {flow === "success" ? (
                    <span className="nf-check-pop flex items-center gap-2 text-emerald-600">
                      <Check size={16} weight="bold" /> Signed in — opening workspace
                    </span>
                  ) : flow === "processing" ? (
                    <span className="flex items-center gap-2">
                      <SpinnerGap size={16} className="nf-conn-spin" weight="bold" />
                      {mode === "signup" ? "Creating account…" : "Signing in…"}
                    </span>
                  ) : (
                    <>
                      <span className="relative">{mode === "signup" ? "Create account" : "Sign in"}</span>
                      <ArrowRight size={15} weight="bold" className="relative transition-transform duration-300 group-hover:translate-x-1" />
                    </>
                  )}
                </button>

                <input type="hidden" name="mode" value={mode} />
              </form>

              {/* Mode swap prompt */}
              <p key={`${mode}-prompt`} className="nf-auth-flip mt-6 text-center text-[13px] text-white/45 [animation-delay:120ms]">
                {mode === "signin" ? (
                  <>
                    New to Datlify?{" "}
                    <button type="button" onClick={() => switchMode("signup")} className="font-medium text-sky-400 transition-colors hover:text-sky-300">
                      Create an account
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <button type="button" onClick={() => switchMode("signin")} className="font-medium text-sky-400 transition-colors hover:text-sky-300">
                      Sign in
                    </button>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Legal + back */}
          <div className="nf-auth-line mt-6 flex flex-col items-center gap-3 [animation-delay:200ms]">
            <p className="text-center text-[11px] leading-relaxed text-white/30">
              By continuing you agree to our{" "}
              <a href="#" className="text-white/50 transition-colors hover:text-white">Terms</a> and{" "}
              <a href="#" className="text-white/50 transition-colors hover:text-white">Privacy Policy</a>.
            </p>
            <Link href="/" className="text-[13px] text-white/40 transition-colors hover:text-white">
              ← Back to home
            </Link>
          </div>
        </div>
      </main>

      {/* Connecting overlay pulse for provider handshake */}
      {pendingProvider ? (
        <div key={pendingProvider} className="nf-auth-flip pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3.5 backdrop-blur-2xl">
            <SpinnerGap size={18} className="nf-conn-spin text-sky-400" weight="bold" />
            <p className="text-sm text-white">Authenticating with {pendingProvider}…</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default AuthPage;