import { NextResponse, type NextRequest } from "next/server";
import { NODE_PALETTE } from "@/lib/canvasConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ZEN_URL = process.env.OPENCODE_ZEN_BASE_URL ?? "https://opencode.ai/zen/v1/chat/completions";
const ZEN_MODEL = process.env.OPENCODE_ZEN_MODEL ?? "mimo-v2.5-free";
const FREE_ZEN_MODELS = ["mimo-v2.5-free", "deepseek-v4-flash-free", "nemotron-3.5-lightning-free", "nemotron-3-ultra-free", "laguna-s-2.1-free"];

type BlueprintNode = { type: string; reason: string };
type AlgorithmSuggestion = { algorithm: string; type: string; score: number; reason: string };
type Blueprint = { nodes: BlueprintNode[]; suggestions: AlgorithmSuggestion[] };

type ChatMessage = { role: "user" | "assistant"; content: string };
type GraphSummary = {
  nodes: Array<{ type: string; label: string; category: string }>;
  edges: Array<{ source: string; target: string }>;
};

const VALID_TYPES = new Set(NODE_PALETTE.map((item) => item.type));
const MODEL_TYPES = new Set(
  NODE_PALETTE.filter((item) => item.category === "classic_ml" || item.category === "deep_learning").map((item) => item.type),
);

/** Compact palette catalog embedded in the system prompt. */
const CATALOG = NODE_PALETTE.map((item) => `${item.type} — ${item.label} [${item.category}]`).join("\n");

/* ── Local heuristic fallback (no API key / all models failed) ──────────── */

interface TaskPlan {
  reply: string;
  blueprint: Blueprint;
}

const TASK_KEYWORDS: Array<{ kind: keyof typeof PLANS; words: string[] }> = [
  { kind: "vision", words: ["image", "photo", "picture", "cnn", "resnet", "visual", "camera", "mnist"] },
  { kind: "nlp", words: ["text", "nlp", "language", "bert", "sentiment", "transformer", "tweet", "review", "document"] },
  { kind: "timeseries", words: ["time series", "timeseries", "forecast", "sequence", "lstm", "temporal", "stock", "demand", "signal"] },
  { kind: "clustering", words: ["cluster", "segment", "unsupervised", "group", "persona", "cohort", "without labels"] },
  { kind: "regression", words: ["price", "regression", "revenue", "salary", "continuous", "how much", "house", "rent", "ltv"] },
  { kind: "classification", words: ["classify", "classification", "churn", "fraud", "spam", "label", "binary", "disease", "cancer", "predict"] },
];

const PLANS: Record<string, TaskPlan> = {
  classification: {
    reply: "I designed a classification pipeline: a benchmark dataset flows through standard scaling into a random forest, with evaluation charts at the end. Random forests are robust on tabular data with almost no tuning — see the ranked alternatives below.",
    blueprint: {
      nodes: [
        { type: "data:breast_cancer", reason: "A clean binary-classification benchmark to prototype on before attaching your own CSV." },
        { type: "pre:scaler", reason: "Zero-mean, unit-variance scaling keeps distance-based and linear models well conditioned." },
        { type: "ml:random_forest", reason: "Bagged trees are robust on tabular data, need little tuning, and expose feature importances." },
        { type: "viz:charts", reason: "Confusion matrix, ROC and PR curves to evaluate the trained model." },
      ],
      suggestions: [
        { algorithm: "Random Forest", type: "ml:random_forest", score: 0.92, reason: "Strong default for tabular classification: handles mixed scales, resists overfitting, gives feature importances." },
        { algorithm: "Gradient Boosting", type: "ml:gradient_boosting", score: 0.88, reason: "Often the top scorer on structured data when you can afford slower sequential training." },
        { algorithm: "Logistic Regression", type: "ml:logistic", score: 0.8, reason: "Fast, interpretable baseline with well-calibrated probabilities." },
        { algorithm: "Support Vector Machine", type: "ml:svm", score: 0.72, reason: "Excels on small, well-scaled datasets with clear class margins." },
      ],
    },
  },
  regression: {
    reply: "Here is a regression-oriented blueprint. The palette is classification-first, so I kept a regularized linear core and added polynomial features to capture non-linear relationships.",
    blueprint: {
      nodes: [
        { type: "data:synthetic", reason: "Configurable generated data — swap in your CSV once the structure looks right." },
        { type: "pre:scaler", reason: "Standardization keeps the regularized linear model stable." },
        { type: "pre:polynomial", reason: "Interaction terms let a linear model express non-linear effects." },
        { type: "ml:ridge", reason: "L2-regularized linear model — the classic choice for continuous targets with collinearity." },
        { type: "viz:metrics", reason: "Accuracy-style metrics plus per-class breakdown for quick sanity checks." },
      ],
      suggestions: [
        { algorithm: "Ridge Classifier", type: "ml:ridge", score: 0.85, reason: "Regularized linear fit that stays stable with many correlated features." },
        { algorithm: "Random Forest", type: "ml:random_forest", score: 0.82, reason: "Captures non-linearities without feature engineering; low tuning burden." },
        { algorithm: "Gradient Boosting", type: "ml:gradient_boosting", score: 0.8, reason: "Best accuracy on structured data when training time is acceptable." },
        { algorithm: "Neural Net (MLP)", type: "ml:mlp_sklearn", score: 0.7, reason: "Flexible non-linear fit once features are scaled and data is plentiful." },
      ],
    },
  },
  clustering: {
    reply: "For unsupervised structure discovery I standardized the features, reduced them with PCA, and attached a scatter explorer so you can inspect the groups directly on the canvas.",
    blueprint: {
      nodes: [
        { type: "data:synthetic", reason: "Generated blobs with configurable noise — a good sandbox for structure discovery." },
        { type: "pre:scaler", reason: "Clustering is distance-based, so features must share a scale." },
        { type: "pre:pca", reason: "Principal components denoise and compress before neighbourhood analysis." },
        { type: "ml:knn", reason: "Nearest-neighbour structure is the closest palette fit for exploring local groupings." },
        { type: "viz:scatter", reason: "2D/3D scatter with decision boundaries to visually verify the clusters." },
      ],
      suggestions: [
        { algorithm: "K-Nearest Neighbors", type: "ml:knn", score: 0.75, reason: "Neighbour graphs reveal local cluster structure and density." },
        { algorithm: "Gaussian Naive Bayes", type: "ml:naive_bayes", score: 0.6, reason: "Fast generative baseline that surfaces per-feature distributions." },
        { algorithm: "Neural Net (MLP)", type: "ml:mlp_sklearn", score: 0.55, reason: "Learns a compact embedding you can project and inspect." },
      ],
    },
  },
  vision: {
    reply: "For image data I wired an image dataset straight into a CNN — convolutional models are the right inductive bias for pixels. It trains right here in the app on the local PyTorch engine.",
    blueprint: {
      nodes: [
        { type: "data:images", reason: "Upload images grouped by class folders; they are vectorized automatically." },
        { type: "dl:cnn", reason: "Convolutional ResNet — transfer learning quality on image classification." },
        { type: "viz:metrics", reason: "Accuracy, precision, recall and F1 to validate the trained network." },
      ],
      suggestions: [
        { algorithm: "CNN (ResNet)", type: "dl:cnn", score: 0.93, reason: "Convolutions capture spatial structure; ResNet skip connections train deep stacks reliably." },
        { algorithm: "PyTorch MLP", type: "dl:pytorch_mlp", score: 0.6, reason: "Lighter alternative for tiny images or flattened pixel inputs." },
        { algorithm: "Transformer Encoder", type: "dl:transformer", score: 0.55, reason: "Attention baseline that also trains in-app on local PyTorch." },
      ],
    },
  },
  nlp: {
    reply: "For text I attached a transformer encoder node — attention over feature tokens is a strong text baseline. It trains in-app on the local PyTorch engine, no notebook needed.",
    blueprint: {
      nodes: [
        { type: "data:csv", reason: "Text corpus with a label column, loaded from your own CSV." },
        { type: "dl:transformer", reason: "Transformer encoder over feature tokens — trains in-app." },
        { type: "viz:metrics", reason: "Evaluation metrics to validate the fine-tune." },
      ],
      suggestions: [
        { algorithm: "Transformer Encoder", type: "dl:transformer", score: 0.9, reason: "Self-attention over feature tokens trains in-app in seconds." },
        { algorithm: "PyTorch MLP", type: "dl:pytorch_mlp", score: 0.55, reason: "Baseline over bag-of-words or embedding-average features." },
        { algorithm: "Logistic Regression", type: "ml:logistic", score: 0.5, reason: "Surprisingly strong TF-IDF baseline that trains in seconds." },
      ],
    },
  },
  timeseries: {
    reply: "For sequence data I scaled the inputs and used an LSTM — recurrent models keep temporal order, which feed-forward models discard. It trains in-app on the local PyTorch engine.",
    blueprint: {
      nodes: [
        { type: "data:csv", reason: "Your sequential observations with a target column." },
        { type: "pre:scaler", reason: "Scaling stabilizes recurrent training." },
        { type: "dl:lstm", reason: "Long short-term memory captures temporal dependencies." },
        { type: "viz:metrics", reason: "Metrics to check the sequence model fit." },
      ],
      suggestions: [
        { algorithm: "LSTM Sequence", type: "dl:lstm", score: 0.88, reason: "Gated memory handles long-range dependencies in ordered data." },
        { algorithm: "GRU Sequence", type: "dl:gru", score: 0.84, reason: "Lighter gated unit — often matches LSTM with faster training." },
        { algorithm: "Tabular Transformer", type: "dl:tabular_transformer", score: 0.7, reason: "Attention over feature tokens when order matters less than interactions." },
      ],
    },
  },
};

function localPlan(prompt: string): TaskPlan {
  const lower = prompt.toLowerCase();
  for (const task of TASK_KEYWORDS) {
    if (task.words.some((word) => lower.includes(word))) return PLANS[task.kind];
  }
  return PLANS.classification;
}

/* ── Response sanitization ──────────────────────────────────────────────── */

function cleanBlueprint(value: unknown, prompt: string): Blueprint {
  const base = localPlan(prompt).blueprint;
  if (!value || typeof value !== "object") return base;
  const candidate = value as Partial<Blueprint>;

  const nodes = Array.isArray(candidate.nodes)
    ? candidate.nodes
        .filter((node): node is BlueprintNode => Boolean(node && typeof node === "object" && typeof node.type === "string" && VALID_TYPES.has(node.type)))
        .slice(0, 10)
        .map((node) => ({
          type: node.type,
          reason: typeof node.reason === "string" && node.reason.trim() ? node.reason.trim().slice(0, 180) : "",
        }))
    : base.nodes;

  const suggestions = Array.isArray(candidate.suggestions)
    ? candidate.suggestions
        .filter((item): item is AlgorithmSuggestion => Boolean(item && typeof item === "object" && typeof item.algorithm === "string" && item.algorithm.trim()))
        .slice(0, 6)
        .map((item) => ({
          algorithm: item.algorithm.trim().slice(0, 60),
          type: typeof item.type === "string" && MODEL_TYPES.has(item.type) ? item.type : "",
          score: typeof item.score === "number" && Number.isFinite(item.score) ? Math.min(1, Math.max(0, item.score)) : 0.7,
          reason: typeof item.reason === "string" && item.reason.trim() ? item.reason.trim().slice(0, 220) : "",
        }))
        .sort((a, b) => b.score - a.score)
    : base.suggestions;

  return {
    nodes: nodes.length ? nodes : base.nodes,
    suggestions: suggestions.length ? suggestions : base.suggestions,
  };
}

/* ── Route handler ──────────────────────────────────────────────────────── */

function isCasualMessage(prompt: string): boolean {
  return /^(hi|hello|hey|hiya|yo|good morning|good afternoon|good evening|thanks|thank you|help|what can you do)\s*[!.?]*$/i.test(prompt.trim());
}

function casualReply(prompt: string): string {
  const normalized = prompt.trim().toLowerCase();
  if (normalized.startsWith("thank")) return "You’re welcome. When you’re ready, describe the data or prediction problem you want to solve.";
  if (normalized === "help" || normalized.startsWith("what can you do")) return "I can turn an ML goal into a canvas-ready pipeline. Try something like “predict customer churn” or “forecast weekly demand.”";
  return "Hi — I’m the Datlify Model Architect. Tell me what you want to predict, classify, group, or forecast, and I’ll map it into a pipeline.";
}

export async function POST(request: NextRequest) {
  let body: { message?: string; history?: ChatMessage[]; graph?: GraphSummary };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid chat request" }, { status: 400 });
  }
  const prompt = body.message?.trim();
  if (!prompt) return NextResponse.json({ error: "A message is required." }, { status: 400 });
  if (isCasualMessage(prompt)) {
    return NextResponse.json({ reply: casualReply(prompt), provider: "local", casual: true });
  }

  const local = localPlan(prompt);
  const apiKey = process.env.OPENCODE_ZEN_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      reply: `${local.reply} (Local heuristic mode — set OPENCODE_ZEN_API_KEY for full AI design.)`,
      blueprint: local.blueprint,
      provider: "local",
    });
  }

  const graphContext =
    body.graph && body.graph.nodes.length > 0
      ? `The user's current canvas pipeline is: ${body.graph.nodes.map((node) => node.type).join(" -> ") || "(empty)"}. Design around or extend it.`
      : "The canvas is currently empty — design a complete pipeline from a data source.";

  const instruction = `You are the Datlify Model Architect, an expert ML engineer that designs node pipelines for a visual ML canvas and recommends algorithms.

Available node types (type — label [category]):
${CATALOG}

Rules:
- Propose a connected pipeline of 3-8 nodes using ONLY the listed types, ordered data -> preprocessing -> model -> visualization.
- Include exactly one data node first and at least one model node (classic_ml or deep_learning).
- Suggest 3-5 algorithms ranked by fit. Each suggestion's "type" MUST be a classic_ml or deep_learning node type from the list.
- "score" is a 0-1 match confidence for the user's task. "reason" explains the fit in one sentence.
- "reply" is a short conversational response (2-4 sentences) explaining the design decisions.
- Never invent node types outside the list.

Return ONLY valid JSON, no markdown, exactly matching:
{"reply":"string","blueprint":{"nodes":[{"type":"string","reason":"string"}],"suggestions":[{"algorithm":"string","type":"string","score":0.0,"reason":"string"}]}}

User request: ${prompt}
${graphContext}
Conversation: ${JSON.stringify((body.history ?? []).slice(-8))}`;

  const configuredModel = process.env.OPENCODE_ZEN_MODEL?.trim() || ZEN_MODEL;
  const models = [configuredModel, ...FREE_ZEN_MODELS].filter((candidate, index, list) => list.indexOf(candidate) === index);
  let lastError = "OpenCode Zen did not return a response.";

  for (const selectedModel of models) {
    try {
      const response = await fetch(ZEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: selectedModel,
          temperature: 0.2,
          max_tokens: 1600,
          messages: [
            { role: "system", content: instruction },
            { role: "user", content: prompt },
          ],
        }),
      });
      const diagnostic = response.ok ? "" : (await response.text()).replace(/\s+/g, " ").slice(0, 180);
      if (!response.ok) {
        lastError = `${selectedModel} failed (${response.status})${diagnostic ? `: ${diagnostic}` : ""}`;
        continue;
      }
      const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = json.choices?.[0]?.message?.content?.trim() ?? "";
      const parsed = JSON.parse(text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "")) as {
        reply?: string;
        blueprint?: unknown;
      };
      return NextResponse.json({
        reply: typeof parsed.reply === "string" && parsed.reply.trim() ? parsed.reply.trim().slice(0, 1200) : local.reply,
        blueprint: cleanBlueprint(parsed.blueprint, prompt),
        provider: "opencode-zen",
        model: selectedModel,
      });
    } catch (error) {
      lastError = error instanceof Error ? `${selectedModel}: ${error.message}` : `${selectedModel} failed`;
    }
  }

  return NextResponse.json({
    reply: `${local.reply} (Applied a local heuristic after the AI models were unreachable. ${lastError})`,
    blueprint: local.blueprint,
    provider: "local-fallback",
    model: configuredModel,
  });
}
