"use client";

import { useMemo, useState } from "react";
import { Check, ClipboardText, DownloadSimple, ArrowSquareOut, CircleNotch, ArrowsClockwise, FloppyDisk, Sparkle } from "@phosphor-icons/react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import type { GeneratedCode } from "@/lib/codeGen";
import type { GraphPayload } from "@/lib/types";

interface CodeModalProps {
  open: boolean;
  onClose: () => void;
  code: GeneratedCode | null;
  graph: GraphPayload;
  onChange: (code: GeneratedCode) => void;
  onRegenerate: () => void;
  onOpenColab: (code: string) => void;
  onNotify?: (message: string, tone?: "success" | "warn") => void;
}

function notebookFromCode(code: string, filename: string) {
  const source = code.endsWith("\n") ? code : `${code}\n`;
  return JSON.stringify({
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      kernelspec: { display_name: "Python 3", language: "python", name: "python3" },
      accelerator: "GPU",
      colab: { name: filename.replace(/\.py$/, ".ipynb"), provenance: [] },
    },
    cells: [
      { cell_type: "markdown", metadata: {}, source: ["# NeuralForge training notebook\n", "Generated from the editable canvas code workspace."] },
      { cell_type: "code", execution_count: null, metadata: {}, outputs: [], source: source.split("\n").map((line) => `${line}\n`) },
    ],
  }, null, 2);
}

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function CodeModal({ open, onClose, code, graph, onChange, onRegenerate, onOpenColab, onNotify }: CodeModalProps) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("Make the training loop clearer and keep live epoch metrics for this real dataset.");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiProvider, setAiProvider] = useState<"opencode" | "gemini">("opencode");
  const [aiModel, setAiModel] = useState("mimo-v2.5-free");
  const [provider, setProvider] = useState<string | null>(null);
  const lines = useMemo(() => (code?.code ?? "").split("\n").length, [code?.code]);

  if (!code) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const generateWithAi = async () => {
    setAiLoading(true);
    try {
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ graph, prompt: aiPrompt, currentCode: code.code, provider: aiProvider, model: aiModel }),
      });
      const result = (await response.json()) as { code?: string; filename?: string; provider?: string; message?: string; error?: string };
      if (!response.ok || !result.code) throw new Error(result.error ?? "AI generation failed");
      onChange({ ...code, code: result.code, filename: result.filename ?? code.filename });
      setProvider(result.provider ?? "canvas-generator");
      onNotify?.(result.message ?? "Code generated", result.provider === "gemini" ? "success" : "warn");
    } catch (error) {
      onNotify?.(error instanceof Error ? error.message : "AI generation failed", "warn");
    } finally {
      setAiLoading(false);
    }
  };

  const save = () => {
    onChange(code);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };
  const downloadPython = () => downloadBlob(code.filename, code.code, "text/x-python");
  const downloadNotebook = () => downloadBlob(code.filename.replace(/\.py$/, ".ipynb"), notebookFromCode(code.code, code.filename), "application/x-ipynb+json");

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Python workspace"
      subtitle={`${code.filename} · editable canvas code · ${lines} lines`}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="min-w-0 break-words font-mono text-[11px] text-muted">{provider ? `Source: ${provider}` : "Changes stay in this workspace until you regenerate."}</span>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onRegenerate}><ArrowsClockwise size={16} /> Regenerate</Button>
            <Button variant="ghost" size="sm" onClick={copy}>{copied ? <Check size={16} weight="bold" className="text-emerald-400" /> : <ClipboardText size={16} />}{copied ? "Copied" : "Copy"}</Button>
            <Button variant="ghost" size="sm" onClick={save}>{saved ? <Check size={16} weight="bold" className="text-emerald-400" /> : <FloppyDisk size={16} />}{saved ? "Saved" : "Keep edits"}</Button>
            <Button variant="ghost" size="sm" onClick={downloadPython}><DownloadSimple size={16} /> .py</Button>
            <Button variant="ghost" size="sm" onClick={downloadNotebook}><DownloadSimple size={16} /> .ipynb</Button>
            <Button variant="colab" size="sm" onClick={() => onOpenColab(code.code)}><ArrowSquareOut size={16} /> Open in Colab</Button>
          </div>
        </div>
      }
    >
      <div className="border-b border-border bg-amber-500/[0.06] px-5 py-2.5 text-xs text-foreground-2">Edit the script here. The attached canvas dataset is embedded and validated; Colab opens in a separate Google-controlled tab because its notebook UI cannot be iframe-embedded in third-party apps.</div>
      <div className="border-b border-border bg-surface px-5 py-3">
        <div className="flex flex-col gap-2 lg:flex-row">
          <input aria-label="AI code request" value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-sky-400" />
          <div className="flex min-w-0 flex-wrap gap-2">
            <select aria-label="AI provider" value={aiProvider} onChange={(event) => setAiProvider(event.target.value as "opencode" | "gemini")} className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-2 text-xs text-foreground sm:flex-none">
              <option value="opencode">OpenCode Zen</option>
              <option value="gemini">Gemini</option>
            </select>
            {aiProvider === "opencode" && (
              <select aria-label="OpenCode Zen model" value={aiModel} onChange={(event) => setAiModel(event.target.value)} className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-2 text-xs text-foreground sm:flex-none">
                <option value="mimo-v2.5-free">MiMo V2.5 Free</option>
                <option value="deepseek-v4-flash-free">DeepSeek V4 Flash Free</option>
                <option value="nemotron-3.5-lightning-free">Nemotron 3.5 Lightning Free</option>
                <option value="nemotron-3-ultra-free">Nemotron 3 Ultra Free</option>
                <option value="laguna-s-2.1-free">Laguna S 2.1 Free</option>
              </select>
            )}
            <input aria-label="AI model" value={aiModel} onChange={(event) => setAiModel(event.target.value)} className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-2 text-xs text-foreground sm:w-52 sm:flex-none" />
            <Button variant="default" size="sm" onClick={generateWithAi} disabled={aiLoading}>{aiLoading ? <CircleNotch size={16} className="animate-spin" /> : <Sparkle size={16} />}{aiLoading ? "Generating" : "Generate with AI"}</Button>
          </div>
        </div>
        <p className="mt-1.5 break-words text-[10px] text-muted">The selected provider runs server-side. Configure its key in environment variables; credentials never enter the browser.</p>
      </div>
      <div className="flex min-h-[58vh] overflow-auto bg-foreground/[0.02]">
        <pre aria-hidden className="select-none border-r border-border px-3 py-4 text-right font-mono text-[12px] leading-[1.65] text-muted/50">{Array.from({ length: lines }, (_, i) => <div key={i}>{i + 1}</div>)}</pre>
        <textarea aria-label="Editable Python training code" spellCheck={false} value={code.code} onChange={(event) => onChange({ ...code, code: event.target.value })} className="min-h-[58vh] min-w-0 flex-1 resize-none bg-transparent px-4 py-4 font-mono text-[12.5px] leading-[1.65] text-foreground-2 outline-none" />
      </div>
    </Modal>
  );
}

export default CodeModal;

