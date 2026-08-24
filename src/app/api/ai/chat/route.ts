import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ZEN_URL = process.env.OPENCODE_ZEN_BASE_URL ?? "https://opencode.ai/zen/v1/chat/completions";
const ZEN_MODEL = process.env.OPENCODE_ZEN_MODEL ?? "mimo-v2.5-free";
const FREE_ZEN_MODELS = ["mimo-v2.5-free", "deepseek-v4-flash-free", "nemotron-3.5-lightning-free", "nemotron-3-ultra-free", "laguna-s-2.1-free"];

type ModelContext = { name: string; format: "pickle" | "onnx"; size: number };
type UiField = { key: string; label: string; type: "number" | "text" | "select"; placeholder?: string; options?: string[] };
type UiSpec = { brand: string; nav: string[]; eyebrow: string; title: string; description: string; submitLabel: string; fields: UiField[]; stats: Array<{ label: string; value: string; detail: string }>; features: Array<{ title: string; description: string; icon: "shield" | "activity" | "spark" }>; insight: { title: string; description: string }; accent: "sky" | "violet" | "emerald" };

const fallback = (model: ModelContext, prompt: string): UiSpec => ({
  brand: "Datlify", nav: ["Overview", "Predict", "Activity"], eyebrow: `${model.format.toUpperCase()} MODEL WORKSPACE`,
  title: `${model.name.replace(/\.(pkl|pickle|onnx)$/i, "")} prediction`,
  description: prompt.toLowerCase().includes("form") ? "Enter the features required by this saved model." : "A complete prediction workspace generated around your saved model.",
  submitLabel: "Run prediction", accent: model.format === "onnx" ? "violet" : "sky",
  fields: [{ key: "feature_1", label: "Feature 1", type: "number", placeholder: "0" }, { key: "feature_2", label: "Feature 2", type: "number", placeholder: "0" }, { key: "category", label: "Category", type: "select", options: ["Option A", "Option B"] }],
  stats: [{ label: "Model status", value: "Ready", detail: "Artifact loaded" }, { label: "Runtime", value: model.format.toUpperCase(), detail: "Serving target" }, { label: "Inputs", value: "03", detail: "Configurable fields" }],
  features: [{ title: "Private by design", description: "Your model artifact stays in this browser session.", icon: "shield" }, { title: "Fast feedback", description: "Validate the prediction experience before connecting inference.", icon: "activity" }, { title: "Built for iteration", description: "Keep refining layout, copy, and behavior through chat.", icon: "spark" }],
  insight: { title: "Ready for your first prediction", description: "Complete the fields to preview the result state and connect a serving endpoint when you are ready." },
});

function cleanSpec(value: unknown, model: ModelContext, prompt: string): UiSpec {
  const base = fallback(model, prompt);
  if (!value || typeof value !== "object") return base;
  const candidate = value as Partial<UiSpec>;
  const text = (value: unknown, fallbackText: string, limit: number) => typeof value === "string" && value.trim() ? value.trim().slice(0, limit) : fallbackText;
  const fields = Array.isArray(candidate.fields) ? candidate.fields.filter((field): field is UiField => Boolean(field && typeof field === "object" && typeof field.key === "string" && typeof field.label === "string" && ["number", "text", "select"].includes(field.type))) : base.fields;
  const stats = Array.isArray(candidate.stats) ? candidate.stats.filter((item) => item && typeof item === "object").slice(0, 4).map((item, index) => { const stat = item as Partial<UiSpec["stats"][number]>; return { label: text(stat.label, base.stats[index]?.label ?? "Metric", 28), value: text(stat.value, base.stats[index]?.value ?? "Ready", 18), detail: text(stat.detail, base.stats[index]?.detail ?? "Model context", 42) }; }) : base.stats;
  const features: UiSpec["features"] = Array.isArray(candidate.features) ? candidate.features.filter((item) => item && typeof item === "object").slice(0, 4).map((item, index) => { const feature = item as Partial<UiSpec["features"][number]>; return { title: text(feature.title, base.features[index]?.title ?? "Model ready", 44), description: text(feature.description, base.features[index]?.description ?? "A focused prediction workspace.", 120), icon: (feature.icon === "shield" || feature.icon === "activity" || feature.icon === "spark" ? feature.icon : "spark") as "shield" | "activity" | "spark" }; }) : base.features;
  const insight = candidate.insight && typeof candidate.insight === "object" ? { title: text(candidate.insight.title, base.insight.title, 60), description: text(candidate.insight.description, base.insight.description, 160) } : base.insight;
  return { brand: text(candidate.brand, base.brand, 32), nav: Array.isArray(candidate.nav) ? candidate.nav.filter((item): item is string => typeof item === "string").slice(0, 5).map((item) => item.slice(0, 24)) : base.nav, eyebrow: text(candidate.eyebrow, base.eyebrow, 48), title: text(candidate.title, base.title, 80), description: text(candidate.description, base.description, 220), submitLabel: text(candidate.submitLabel, base.submitLabel, 40), accent: candidate.accent === "violet" || candidate.accent === "emerald" ? candidate.accent : base.accent, fields: fields.slice(0, 12).map((field) => ({ key: field.key.slice(0, 40), label: field.label.slice(0, 60), type: field.type, placeholder: field.placeholder?.slice(0, 80), options: field.options?.slice(0, 8) })), stats: stats.length ? stats : base.stats, features: features.length ? features : base.features, insight };
}

export async function POST(request: NextRequest) {
  let body: { message?: string; model?: ModelContext; history?: Array<{ role: "user" | "assistant"; content: string }>; currentUi?: UiSpec };
  try { body = (await request.json()) as typeof body; } catch { return NextResponse.json({ error: "Invalid chat request" }, { status: 400 }); }
  if (!body.model?.name || !body.model.format || !body.message?.trim()) return NextResponse.json({ error: "A model file and message are required." }, { status: 400 });

  const model = body.model;
  const prompt = body.message.trim();
  const base = fallback(model, prompt);
  const apiKey = process.env.OPENCODE_ZEN_API_KEY;
  if (!apiKey) return NextResponse.json({ reply: "I created a starter prediction form from the model file. Add OPENCODE_ZEN_API_KEY to enable conversational UI refinement.", ui: base, provider: "local" });

  const instruction = `You are Datlify UI Builder. Design a complete, polished responsive website for a saved ${model.format.toUpperCase()} machine-learning model, not just a form. Return ONLY valid JSON, no markdown, matching this exact shape: {"reply":"short conversational response","ui":{"brand":"string","nav":["string"],"eyebrow":"string","title":"string","description":"string","submitLabel":"string","accent":"sky|violet|emerald","fields":[{"key":"string","label":"string","type":"number|text|select","placeholder":"optional string","options":["optional strings"]}],"stats":[{"label":"string","value":"string","detail":"string"}],"features":[{"title":"string","description":"string","icon":"shield|activity|spark"}],"insight":{"title":"string","description":"string"}}}. Include 3-4 stats and feature sections plus a meaningful insight panel. Keep 1-12 fields. Never claim to know hidden model feature names; use sensible generic feature names when the file metadata does not provide them. User request: ${prompt}. Current UI: ${JSON.stringify(body.currentUi ?? base)}. Conversation: ${JSON.stringify(body.history ?? [])}`;
  const configuredModel = process.env.OPENCODE_ZEN_MODEL?.trim() || ZEN_MODEL;
  const models = [configuredModel, ...FREE_ZEN_MODELS].filter((candidate, index, list) => list.indexOf(candidate) === index);
  let lastError = "OpenCode Zen did not return a response.";
  for (const selectedModel of models) {
    try {
      const response = await fetch(ZEN_URL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: selectedModel, temperature: 0.2, max_tokens: 1800, messages: [{ role: "system", content: instruction }, { role: "user", content: prompt }] }) });
      const diagnostic = response.ok ? "" : (await response.text()).replace(/\s+/g, " ").slice(0, 180);
      if (!response.ok) {
        lastError = `${selectedModel} failed (${response.status})${diagnostic ? `: ${diagnostic}` : ""}`;
        continue;
      }
      const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = json.choices?.[0]?.message?.content?.trim() ?? "";
      const parsed = JSON.parse(text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "")) as { reply?: string; ui?: unknown };
      return NextResponse.json({ reply: parsed.reply ?? "I updated the prediction interface.", ui: cleanSpec(parsed.ui, model, prompt), provider: "opencode-zen", model: selectedModel });
    } catch (error) {
      lastError = error instanceof Error ? `${selectedModel}: ${error.message}` : `${selectedModel} failed`;
    }
  }
  return NextResponse.json({ reply: `I applied a local starter layout after trying the available free AI models. ${lastError}`, ui: base, provider: "local-fallback", model: configuredModel });
}
