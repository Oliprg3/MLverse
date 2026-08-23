import { NextResponse, type NextRequest } from "next/server";
import { generateCode } from "@/lib/codeGen";
import type { GraphPayload } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const ZEN_MODEL = process.env.OPENCODE_ZEN_MODEL ?? "mimo-v2.5-free";
const ZEN_URL = process.env.OPENCODE_ZEN_BASE_URL ?? "https://opencode.ai/zen/v1/chat/completions";
const FREE_ZEN_MODELS = ["mimo-v2.5-free", "deepseek-v4-flash-free", "nemotron-3.5-lightning-free", "nemotron-3-ultra-free", "laguna-s-2.1-free"];

function stripMarkdownFence(value: string): string {
  return `${value.trim().replace(/^```(?:python)?\s*/i, "").replace(/\s*```$/i, "").trim()}\n`;
}

export async function POST(req: NextRequest) {
  let body: { graph?: GraphPayload; prompt?: string; currentCode?: string; provider?: "gemini" | "opencode"; model?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.graph?.nodes?.length) {
    return NextResponse.json({ error: "Build a pipeline before asking AI to generate code." }, { status: 400 });
  }

  const fallback = generateCode(body.graph);
  const prompt = body.prompt?.trim() || "Improve this training script for the attached dataset while keeping it runnable.";
  const dataNode = body.graph.nodes.find((node) => node.dataset || node.imageDataset);
  const context = JSON.stringify({
    prompt,
    pipeline: body.graph.nodes.map((node) => ({ type: node.type, category: node.category, label: node.label, params: node.params })),
    edges: body.graph.edges,
    dataset: dataNode?.dataset ?? dataNode?.imageDataset,
    currentCode: body.currentCode ?? fallback.code,
  });
  const provider = body.provider ?? (process.env.OPENCODE_ZEN_API_KEY ? "opencode" : "gemini");

  if (provider === "opencode") {
    const apiKey = process.env.OPENCODE_ZEN_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ code: body.currentCode?.trim() ? body.currentCode : fallback.code, filename: fallback.filename, provider: "canvas-generator", message: "OPENCODE_ZEN_API_KEY is not configured, so the deterministic canvas generator was used." });
    }
    const configuredModel = body.model?.trim() || process.env.OPENCODE_ZEN_MODEL?.trim() || ZEN_MODEL;
    const models = [configuredModel, ...FREE_ZEN_MODELS].filter((candidate, index, list) => list.indexOf(candidate) === index);
    let lastError = "OpenCode Zen returned no code.";
    for (const selectedModel of models) {
      try {
        const response = await fetch(ZEN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model: selectedModel, temperature: 0.2, max_tokens: 12000, messages: [{ role: "system", content: "You are a senior ML engineer inside NeuralForge. Return only complete runnable Python code, never markdown fences. Use the supplied real dataset context. Do not invent file paths, API keys, placeholder arrays, or replacement instructions." }, { role: "user", content: context }] }),
        });
        if (!response.ok) {
          lastError = `${selectedModel} failed (${response.status})`;
          continue;
        }
        const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const text = json.choices?.[0]?.message?.content?.trim();
        if (!text) {
          lastError = `${selectedModel} returned no code.`;
          continue;
        }
        return NextResponse.json({ code: stripMarkdownFence(text), filename: fallback.filename, provider: "opencode-zen", model: selectedModel, message: `Code generated with ${selectedModel}.` });
      } catch (error) {
        lastError = error instanceof Error ? `${selectedModel}: ${error.message}` : `${selectedModel} failed`;
      }
    }
    return NextResponse.json({ code: body.currentCode?.trim() ? body.currentCode : fallback.code, filename: fallback.filename, provider: "canvas-generator", message: `${lastError}. Used the canvas generator instead.` });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ code: body.currentCode?.trim() ? body.currentCode : fallback.code, filename: fallback.filename, provider: "canvas-generator", message: "No configured AI provider, so the deterministic canvas generator was used." });
  }

  try {
    const response = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "You are a senior ML engineer inside NeuralForge. Return only complete runnable Python code, never markdown fences. Use the supplied real dataset context. Do not invent file paths, API keys, placeholder arrays, or comments telling the user to replace data. Validate target columns, shapes, labels, and missing values. Keep training progress visible with epoch prints. Do not claim to connect to Google Colab APIs; the app handles Colab export separately." }] },
        contents: [{ role: "user", parts: [{ text: context }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 12000 },
      }),
    });
    if (!response.ok) throw new Error(`Gemini request failed (${response.status})`);
    const json = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
    if (!text) throw new Error("Gemini returned no code.");
    return NextResponse.json({ code: stripMarkdownFence(text), filename: fallback.filename, provider: "gemini", model: GEMINI_MODEL, message: "Code generated from the canvas pipeline and dataset context." });
  } catch (error) {
    return NextResponse.json({ code: body.currentCode?.trim() ? body.currentCode : fallback.code, filename: fallback.filename, provider: "canvas-generator", message: error instanceof Error ? `${error.message}. Used the canvas generator instead.` : "AI generation failed. Used the canvas generator instead." });
  }
}
