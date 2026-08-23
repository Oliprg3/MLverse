"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Lego,
  Robot,
  Brain,
  Check,
  CheckCircle,
  UploadSimple,
  CircleNotch,
  ChatCentered,
  Play,
  PaperPlaneRight,
  Sparkle,
  User,
  MagicWand,
  ArrowsClockwise,
  X,
} from "@phosphor-icons/react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import type { GraphPayload } from "@/lib/types";

type ModelContext = { name: string; format: "pickle" | "onnx"; size: number };
type UiField = { key: string; label: string; type: "number" | "text" | "select"; placeholder?: string; options?: string[] };
type UiSpec = { brand: string; nav: string[]; eyebrow: string; title: string; description: string; submitLabel: string; fields: UiField[]; stats: Array<{ label: string; value: string; detail: string }>; features: Array<{ title: string; description: string; icon: "shield" | "activity" | "spark" }>; insight: { title: string; description: string }; accent: "sky" | "violet" | "emerald" };
type Message = { role: "user" | "assistant"; content: string; time: string };
type AgentPhase = "idle" | "analyzing" | "planning" | "generating" | "validating" | "completing";
type AgentPhaseConfig = { id: Exclude<AgentPhase, "idle">; label: string; status: string; icon: typeof Brain };

const agentPhases: AgentPhaseConfig[] = [
  { id: "analyzing", label: "Analyzing", status: "Reading your request and model context", icon: Brain },
  { id: "planning", label: "Planning", status: "Mapping the experience and field structure", icon: MagicWand },
  { id: "generating", label: "Generating", status: "Building a responsive prediction surface", icon: Lego },
  { id: "validating", label: "Validating", status: "Checking fields, copy, and interactions", icon: CheckCircle },
  { id: "completing", label: "Completing", status: "Applying the final preview changes", icon: CheckCircle },
];

type AgentActivity = {
  kind: "thought" | "tool" | "result";
  title: string;
  detail: string;
  status: "running" | "complete";
};

const starterUi: UiSpec = {
  brand: "NeuralForge", nav: ["Overview", "Predict", "Activity"], eyebrow: "MODEL WORKSPACE", title: "Your model prediction", description: "Upload a saved model, then ask the builder to shape the prediction experience.", submitLabel: "Run prediction", accent: "sky",
  fields: [{ key: "feature_1", label: "Feature 1", type: "number", placeholder: "0" }, { key: "feature_2", label: "Feature 2", type: "number", placeholder: "0" }],
  stats: [{ label: "Model status", value: "Ready", detail: "Artifact loaded" }, { label: "Runtime", value: "Local", detail: "Serving target" }, { label: "Inputs", value: "02", detail: "Configurable fields" }],
  features: [{ title: "Private by design", description: "Your model artifact stays in this browser session.", icon: "shield" }, { title: "Fast feedback", description: "Validate the prediction experience before connecting inference.", icon: "activity" }, { title: "Built for iteration", description: "Keep refining layout, copy, and behavior through chat.", icon: "spark" }],
  insight: { title: "Ready for your first prediction", description: "Complete the fields to preview the result state and connect a serving endpoint when you are ready." },
};

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function IntegrationModal({
  open,
  onClose,
  graph: _graph,
  onNotify,
}: {
  open: boolean;
  onClose: () => void;
  graph: GraphPayload;
  onNotify?: (message: string, tone?: "success" | "warn") => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const thinkingRef = useRef<HTMLDivElement>(null);
  const phaseTimerRef = useRef<number | null>(null);
  const lastRequestRef = useRef<string | null>(null);
  const [model, setModel] = useState<ModelContext | null>(null);
  const [ui, setUi] = useState<UiSpec>(starterUi);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [agentPhase, setAgentPhase] = useState<AgentPhase>("idle");
  const [predictionState, setPredictionState] = useState<"idle" | "running" | "complete">("idle");
  const [values, setValues] = useState<Record<string, string>>({});
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [requestError, setRequestError] = useState(false);

  const accentClass = useMemo(
    () => ui.accent === "violet" ? "border-violet-400/40 bg-violet-400/[0.06]" : ui.accent === "emerald" ? "border-emerald-400/40 bg-emerald-400/[0.06]" : "border-sky-400/40 bg-sky-400/[0.06]",
    [ui.accent],
  );
  const currentPhaseIndex = agentPhases.findIndex((phase) => phase.id === agentPhase);
  const activePhase = currentPhaseIndex >= 0 ? agentPhases[currentPhaseIndex] : null;
  const progress = loading ? Math.min(96, Math.round(((currentPhaseIndex + 0.65) / agentPhases.length) * 100)) : agentPhase === "completing" ? 100 : 0;

  useEffect(() => () => {
    if (phaseTimerRef.current) window.clearInterval(phaseTimerRef.current);
  }, []);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (!transcript) return;
    const distanceFromBottom = transcript.scrollHeight - transcript.scrollTop - transcript.clientHeight;
    if (distanceFromBottom < 140 || loading) transcript.scrollTo({ top: transcript.scrollHeight, behavior: "smooth" });
  }, [messages, activities, loading]);

  useEffect(() => {
    const thinking = thinkingRef.current;
    if (thinking && loading) thinking.scrollTo({ top: thinking.scrollHeight, behavior: "smooth" });
  }, [activities, agentPhase, loading]);

  const uploadModel = (file?: File) => {
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    const format = lowerName.endsWith(".onnx") ? "onnx" : lowerName.endsWith(".pkl") || lowerName.endsWith(".pickle") ? "pickle" : null;
    if (!format) {
      onNotify?.("Choose a .pkl, .pickle, or .onnx model", "warn");
      return;
    }
    setModel({ name: file.name, format, size: file.size });
    setMessages([{ role: "assistant", content: `${file.name} is ready. Tell me what prediction UI you want to build.`, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
    setActivities([]);
    setUi({ ...starterUi, title: file.name.replace(/\.(pkl|pickle|onnx)$/i, "") + " prediction", eyebrow: `${format.toUpperCase()} MODEL WORKSPACE`, accent: format === "onnx" ? "violet" : "sky" });
    setAgentPhase("idle");
    onNotify?.("Saved model loaded into the UI builder");
  };

  const send = async (requestedMessage?: string) => {
    const message = (requestedMessage ?? draft).trim();
    if (!message || !model) return;
    lastRequestRef.current = message;
    setRequestError(false);
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const nextMessages = [...messages, { role: "user" as const, content: message, time }];
    setMessages(nextMessages);
    setDraft("");
    setLoading(true);
    setAgentPhase("analyzing");
    setActivities([
      { kind: "thought", title: "Thought for a moment", detail: `I’ll shape the ${model.format.toUpperCase()} model into a clear prediction workflow, then validate the generated fields.`, status: "complete" },
      { kind: "tool", title: "Inspecting model context", detail: `${model.name} · ${formatBytes(model.size)} · ${model.format.toUpperCase()} artifact`, status: "running" },
    ]);
    let phaseIndex = 0;
    phaseTimerRef.current = window.setInterval(() => {
      phaseIndex += 1;
      if (phaseIndex < agentPhases.length) {
        const nextPhase = agentPhases[phaseIndex].id;
        setAgentPhase(nextPhase);
        setActivities((current) => current.map((activity) => activity.kind === "tool" && activity.status === "running" ? { ...activity, detail: nextPhase === "planning" ? "Mapping requested layout, fields, and interaction states." : nextPhase === "generating" ? "Composing the responsive prediction surface and its validation copy." : nextPhase === "validating" ? "Checking field types, empty states, and preview interactions." : activity.detail } : activity));
      }
    }, 720);
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, model, history: nextMessages, currentUi: ui }),
      });
      const result = (await response.json()) as { reply?: string; ui?: UiSpec; error?: string };
      if (!response.ok || !result.ui) throw new Error(result.error ?? "The UI builder could not respond");
      setAgentPhase("validating");
      setActivities((current) => [...current.map((activity) => ({ ...activity, status: "complete" as const })), { kind: "result", title: "Model context ready", detail: "Generated interface structure is ready for validation.", status: "complete" }]);
      setUi(result.ui);
      setMessages((current) => [...current, { role: "assistant", content: result.reply ?? "I updated the interface.", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
      window.setTimeout(() => setAgentPhase("completing"), 280);
      onNotify?.("Prediction UI updated");
    } catch (error) {
      setActivities((current) => current.map((activity) => ({ ...activity, status: "complete" as const })));
      setAgentPhase("completing");
      setRequestError(true);
      setMessages((current) => [...current, { role: "assistant", content: error instanceof Error ? error.message : "The UI builder failed.", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
      onNotify?.("UI builder request failed", "warn");
    } finally {
      if (phaseTimerRef.current) window.clearInterval(phaseTimerRef.current);
      setLoading(false);
    }
  };

  const runPrediction = () => {
    setPredictionState("running");
    window.setTimeout(() => setPredictionState("complete"), 700);
  };
  const suggestions = ["Build a clean two-column form", "Add confidence and validation", "Use a compact dark dashboard"];
  const applySuggestion = (suggestion: string) => {
    setDraft(suggestion);
    void send(suggestion);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Build a model UI"
      subtitle="Chat with the builder to turn a saved model into a usable prediction surface"
      footer={<div className="flex min-w-0 flex-wrap items-center justify-between gap-2"><span className="min-w-0 break-words text-[11px] text-muted">OpenCode Zen runs on the server. Model bytes stay in this browser session.</span><Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /> Close</Button></div>}
    >
      <div className="grid h-[76vh] min-h-[560px] max-h-[820px] min-w-0 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] overflow-hidden lg:grid-cols-[minmax(380px,1.22fr)_minmax(285px,0.78fr)] lg:grid-rows-1">
        <section className="order-2 flex min-h-0 min-w-0 flex-col border-t border-border lg:order-2 lg:border-l lg:border-t-0 lg:border-r-0">
          <div className="border-b border-border p-4">
            <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2 text-xs font-semibold text-foreground"><ChatCentered className="h-4 w-4 text-sky-400" /> UI builder chat</div><span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] transition-colors duration-300 ${loading ? "animate-pulse-ring border-sky-400/35 bg-sky-400/[0.07] text-sky-300" : "border-emerald-400/25 bg-emerald-400/[0.06] text-emerald-300"}`}><span className={`h-1.5 w-1.5 rounded-full ${loading ? "animate-pulse bg-sky-400" : "bg-emerald-400"}`} /> {loading ? "Agent active" : "Ready"}</span></div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">Describe the fields, copy, layout, and behavior you want.</p>
            {loading && activePhase ? <div className="animate-message-in mt-3 rounded-lg border border-sky-400/15 bg-sky-400/[0.04] p-2.5"><div className="flex items-center justify-between gap-2"><span className="flex min-w-0 items-center gap-1.5 text-[10px] font-medium text-sky-300"><activePhase.icon className="h-3.5 w-3.5 shrink-0 animate-pulse" /><span className="truncate">{activePhase.status}</span></span><span className="shrink-0 font-mono text-[10px] text-muted">{progress}%</span></div><div className="mt-2 h-1 overflow-hidden rounded-full bg-sky-400/10"><span className="block h-full rounded-full bg-sky-400 transition-[width] duration-700 ease-out" style={{ width: `${progress}%` }} /></div></div> : null}
          </div>
          <div ref={transcriptRef} aria-live="polite" className="scroll-thin min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 ? <div className="rounded-xl border border-dashed border-border bg-foreground/[0.02] p-5 text-center"><MagicWand className="mx-auto h-6 w-6 text-sky-400" /><p className="mt-3 text-xs font-medium text-foreground-2">Start with a design direction</p><p className="mt-1 text-[11px] leading-relaxed text-muted">Load a model, then ask the builder to shape the experience around your users.</p></div> : null}
            {messages.length > 0 ? <div className="space-y-3">{messages.map((message, index) => <div key={`${message.role}-${index}`} style={{ animationDelay: `${Math.min(index, 6) * 45}ms` }} className={`animate-message-in flex gap-2 ${message.role === "user" ? "flex-row-reverse" : ""}`}><span className="mt-0.5 shrink-0 text-muted-2">{message.role === "user" ? <User aria-hidden className="h-4 w-4" /> : <Robot aria-hidden className="h-4 w-4 text-sky-400" />}</span><div className={`min-w-0 max-w-[88%] rounded-lg px-3 py-2 transition-colors ${message.role === "user" ? "bg-sky-400/10 text-foreground" : "bg-foreground/[0.04] text-foreground-2"}`}><p className="break-words text-xs leading-relaxed">{message.content}</p><time className="mt-1 block text-[9px] text-muted" dateTime={message.time}>{message.time}</time>{requestError && index === messages.length - 1 ? <button type="button" onClick={() => lastRequestRef.current && void send(lastRequestRef.current)} className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-sky-300 transition-colors hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ArrowsClockwise className="h-3 w-3" /> Retry request</button> : null}</div></div>)}</div> : null}
            {activities.length > 0 ? <div className="animate-message-in rounded-lg border border-border bg-muted/20 p-2.5"><div className="flex items-center justify-between gap-2 px-1"><span className="flex items-center gap-1.5 text-[10px] font-semibold text-foreground-2"><Brain className="h-3.5 w-3.5 text-muted" /> Thinking</span><span className="text-[9px] text-muted">{loading ? "Live workflow" : "Finished"}</span></div><div ref={thinkingRef} className="scroll-thin mt-1 max-h-40 space-y-1 overflow-y-auto pr-1">{activities.map((activity, index) => <details key={`${activity.kind}-${index}`} open={activity.status === "running"} className="group rounded-md border border-transparent transition-colors open:border-border/70 open:bg-background/30"><summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 text-[10px] text-foreground-2 transition-colors hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${activity.status === "running" ? "bg-sky-400/10 text-sky-300" : "bg-emerald-400/10 text-emerald-300"}`}>{activity.kind === "thought" ? <Brain className="h-3 w-3" /> : activity.kind === "tool" ? <Lego className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}</span><span className="min-w-0 flex-1 truncate">{activity.title}</span>{activity.status === "running" ? <CircleNotch className="h-3 w-3 shrink-0 animate-spin text-sky-400" /> : <Check className="h-3 w-3 shrink-0 text-emerald-400" />}</summary><p className="animate-fade-in break-words px-8 pb-2 text-[10px] leading-relaxed text-muted">{activity.detail}</p></details>)}</div></div> : null}
            {loading ? <div className="animate-message-in flex gap-2"><Robot className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" /><div className="rounded-lg bg-foreground/[0.04] px-3 py-2.5"><div className="flex items-center gap-1"><span className="h-1.5 w-1.5 animate-dot-bounce rounded-full bg-sky-400" /><span className="h-1.5 w-1.5 animate-dot-bounce rounded-full bg-sky-400 [animation-delay:120ms]" /><span className="h-1.5 w-1.5 animate-dot-bounce rounded-full bg-sky-400 [animation-delay:240ms]" /><span className="ml-1 text-[10px] text-muted">{activePhase?.status ?? "Agent is working"}</span></div></div></div> : null}
          </div>
          {model ? <div className="flex flex-wrap gap-1.5 border-t border-border px-4 py-2.5">{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => applySuggestion(suggestion)} disabled={loading} className="max-w-full truncate rounded-full border border-border px-2.5 py-1 text-[10px] text-muted transition-all hover:-translate-y-0.5 hover:border-sky-400/50 hover:text-foreground active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50">{suggestion}</button>)}</div> : null}
          <div className="border-t border-border p-3"><div className="flex gap-2"><input value={draft} disabled={!model || loading} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder={model ? "Ask for a UI change…" : "Load a model first"} className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring" /><Button size="icon" variant="default" onClick={() => void send()} disabled={!model || !draft.trim() || loading} aria-label="PaperPlaneRight UI request">{loading ? <CircleNotch className="h-4 w-4 animate-spin" /> : <PaperPlaneRight className="h-4 w-4" />}</Button></div><p className="mt-1.5 px-1 text-[10px] text-muted">Enter to send · The builder updates the preview, not source files.</p></div>
        </section>
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-foreground/[0.015]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4"><div className="min-w-0"><p className="truncate text-xs font-semibold text-foreground">Live preview</p><p className="mt-1 break-words text-[10px] text-muted">{model ? `${model.name} · ${model.format.toUpperCase()} · ${formatBytes(model.size)}` : "No saved model loaded"}</p></div><Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()}><UploadSimple className="h-4 w-4" /> {model ? "Replace model" : "Load .pkl / .onnx"}</Button><input ref={inputRef} type="file" accept=".pkl,.pickle,.onnx" className="hidden" onChange={(event) => uploadModel(event.target.files?.[0])} /></div>
          {model ? <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-5"><div className="mx-auto max-w-2xl space-y-5"><div className="mb-4 rounded-lg border border-border bg-background/50 p-3"><div className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">Agent workflow</span><span className="text-[10px] text-muted">{loading && activePhase ? activePhase.label : agentPhase === "completing" ? "Complete" : "Standby"}</span></div><div className="grid grid-cols-5 gap-1.5">{agentPhases.map((phase, index) => { const PhaseIcon = phase.icon; const active = loading && phase.id === agentPhase; const done = loading ? currentPhaseIndex > index : agentPhase === "completing"; return <div key={phase.id} className={`relative min-w-0 rounded-md border px-1.5 py-2 text-center transition-all duration-500 ${active ? "animate-pulse-ring border-sky-400/50 bg-sky-400/[0.08] text-sky-300" : done ? "border-emerald-400/30 bg-emerald-400/[0.05] text-emerald-300" : "border-border text-muted"}`}><PhaseIcon className={`mx-auto h-3.5 w-3.5 transition-transform duration-500 ${active ? "animate-pulse scale-110" : done ? "scale-100" : "scale-90 opacity-60"}`} /><span className="mt-1 block truncate text-[9px]">{phase.label}</span>{active ? <span className="absolute inset-x-1 bottom-0 h-0.5 overflow-hidden rounded-full bg-sky-400/20"><span className="block h-full w-1/3 animate-scan-line bg-sky-400" /></span> : null}</div>; })}</div></div><div key={`${ui.title}-${ui.fields.length}`} className={`animate-slide-up overflow-hidden rounded-2xl border shadow-sm ${accentClass}`}><div className="border-b border-border/70 bg-background/45 px-5 py-3"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm font-semibold text-foreground"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-400/10 text-sky-300"><Sparkle className="h-4 w-4" /></span>{ui.brand}</div><nav className="flex max-w-full gap-3 overflow-x-auto text-[10px] text-muted">{ui.nav.map((item) => <span key={item} className="whitespace-nowrap transition-colors hover:text-foreground">{item}</span>)}</nav></div></div><div className="space-y-5 p-5"><section><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-300">{ui.eyebrow}</p><h3 className="mt-2 max-w-xl break-words text-2xl font-semibold leading-tight text-foreground">{ui.title}</h3><p className="mt-2 max-w-xl break-words text-xs leading-relaxed text-muted">{ui.description}</p></section><div className="grid grid-cols-1 gap-2 sm:grid-cols-3">{ui.stats.map((stat) => <div key={`${stat.label}-${stat.value}`} className="rounded-lg border border-border bg-background/50 p-3 transition-colors hover:border-sky-400/30"><p className="text-[10px] text-muted">{stat.label}</p><p className="mt-1 text-lg font-semibold text-foreground">{stat.value}</p><p className="mt-0.5 break-words text-[10px] text-muted">{stat.detail}</p></div>)}</div><div className="grid gap-2 md:grid-cols-3">{ui.features.map((feature) => <div key={feature.title} className="rounded-lg border border-border/80 bg-background/35 p-3 transition-transform hover:-translate-y-0.5"><div className="flex items-center gap-2 text-xs font-medium text-foreground-2"><CheckCircle className="h-3.5 w-3.5 text-emerald-400" />{feature.title}</div><p className="mt-1.5 break-words text-[10px] leading-relaxed text-muted">{feature.description}</p></div>)}</div><div className="rounded-lg border border-sky-400/20 bg-sky-400/[0.05] p-3"><p className="text-xs font-semibold text-foreground">{ui.insight.title}</p><p className="mt-1 break-words text-[10px] leading-relaxed text-muted">{ui.insight.description}</p></div><div className="rounded-xl border border-border bg-background/45 p-4"><div className="mb-4"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Prediction console</p><h4 className="mt-1 text-sm font-semibold text-foreground">Configure an input run</h4></div><div className="space-y-3">{ui.fields.map((field) => <label key={field.key} className="block min-w-0"><span className="mb-1 block break-words text-xs font-medium text-foreground-2">{field.label}</span>{field.type === "select" ? <select value={values[field.key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground transition-colors hover:border-border-strong"><option value="">Choose an option</option>{(field.options ?? []).map((option) => <option key={option}>{option}</option>)}</select> : <input type={field.type} value={values[field.key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={field.placeholder} className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring" />}</label>)}</div><Button variant="default" className="mt-5 w-full transition-transform active:scale-[0.98]" onClick={runPrediction} disabled={predictionState === "running"}><Play className="h-4 w-4" />{predictionState === "running" ? "Running model…" : predictionState === "complete" ? "Prediction complete" : ui.submitLabel}</Button>{predictionState === "complete" ? <div className="animate-message-in mt-3 flex items-center gap-2 rounded-md border border-emerald-400/30 bg-emerald-400/[0.08] px-3 py-2 text-xs text-emerald-300"><Check className="h-4 w-4" /> Preview run completed. Connect your serving endpoint for live inference.</div> : null}</div></div></div></div></div> : <div className="flex flex-1 items-center justify-center p-8 text-center"><div><UploadSimple className="mx-auto h-8 w-8 text-muted-2" /><p className="mt-3 text-sm font-medium text-foreground-2">Load a trained model to begin</p><p className="mt-1 max-w-xs text-xs leading-relaxed text-muted">Pick a serialized Python pickle or ONNX file. Then use chat to build the interface around it.</p><Button className="mt-4" onClick={() => inputRef.current?.click()}><UploadSimple className="h-4 w-4" /> Choose model</Button></div></div>}
        </section>
      </div>
    </Modal>
  );
}

