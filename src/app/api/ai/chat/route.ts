import { NODE_PALETTE } from "@/lib/canvasConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ZEN_URL = process.env.OPENCODE_ZEN_BASE_URL ?? "https://opencode.ai/zen/v1/chat/completions";
const ZEN_MODEL = process.env.OPENCODE_ZEN_MODEL ?? "opencode/big-pickle";
const FREE_ZEN_MODELS = ["opencode/big-pickle", "mimo-v2.5-free", "deepseek-v4-flash-free", "nemotron-3.5-lightning-free", "nemotron-3-ultra-free"];

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

function isCasualMessage(prompt: string): boolean {
  return /^(hi|hello|hey|hiya|yo|good morning|good afternoon|good evening|thanks|thank you|help|what can you do)\s*[!.?]*$/i.test(prompt.trim());
}

function casualReply(prompt: string): string {
  const normalized = prompt.trim().toLowerCase();
  if (normalized.startsWith("thank")) return "You’re welcome. When you’re ready, describe the data or prediction problem you want to solve.";
  if (normalized === "help" || normalized.startsWith("what can you do")) return "I can turn an ML goal into a canvas-ready pipeline. Try something like “predict customer churn” or “forecast weekly demand.”";
  return "Hi — I’m the Datlify Model Architect. Tell me what you want to predict, classify, group, or forecast, and I’ll map it into a pipeline.";
}

/* ── Streaming NDJSON plumbing ──────────────────────────────────────────── */

const encoder = new TextEncoder();

type TraceStep = { label: string; detail?: string };
type StreamEvent =
  | { type: "trace"; steps: TraceStep[] }
  | { type: "delta"; text: string }
  | { type: "blueprint"; blueprint: Blueprint; suggestions: AlgorithmSuggestion[] }
  | { type: "casual"; text: string }
  | { type: "error"; message: string }
  | { type: "done"; provider: string; model: string };

/** Locate where the JSON plan begins. A bare `{` is not a safe anchor because
 *  prose legitimately contains braces ("set {depth} to 6"), so we require the
 *  brace to actually open an object — `{ "key":`. Returns -1 when there is no
 *  plan in the text. */
function planAnchor(raw: string): number {
  for (let i = raw.indexOf("{"); i !== -1; i = raw.indexOf("{", i + 1)) {
    if (/^\{\s*"[^"]+"\s*:/.test(raw.slice(i, i + 80))) return i;
  }
  return -1;
}

/** Return the balanced JSON object starting at `start`, ignoring any trailing
 *  fences or prose the model appends. String-aware so braces inside string
 *  values do not throw off the depth count. */
function balancedObject(text: string, start: number): string {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return text.slice(start);
}

/** Split the model's reply from its JSON plan without buffering the whole body.
 *  Prose before the plan anchor streams as deltas; the JSON tail is held back so
 *  it can be validated before it ever reaches the client. */
function splitReplyAndJson(raw: string): { prose: string; json: string } {
  const trimmed = raw.replace(/^```(?:json)?\s*/i, "").trim();
  const start = planAnchor(trimmed);
  if (start === -1) return { prose: trimmed.replace(/\s*```$/i, "").trim(), json: "" };
  return {
    prose: trimmed.slice(0, start).trim(),
    json: balancedObject(trimmed, start),
  };
}

function extractDelta(payload: unknown): string {
  const chunk = payload as {
    choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
  };
  return chunk?.choices?.[0]?.delta?.content ?? chunk?.choices?.[0]?.message?.content ?? "";
}

/** OpenCode Zen speaks OpenAI-compatible SSE; parse it line by line. */
async function* readSse(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const text = extractDelta(JSON.parse(data));
        if (text) yield text;
      } catch {
        /* keep-alive or malformed frame — ignore */
      }
    }
  }
}

function buildInstruction(prompt: string, graph: GraphSummary | undefined, history: ChatMessage[]): string {
  const nodeCount = graph?.nodes.length ?? 0;
  const graphContext = !graph || nodeCount === 0
    ? "The canvas is currently EMPTY. Design a complete pipeline from a data source."
    : [
        `The canvas currently has ${nodeCount} node(s) and ${graph?.edges.length ?? 0} edge(s):`,
        ...graph!.nodes.map((n) => `  - ${n.type} (${n.label}) [${n.category}]`),
        ...(graph!.edges.length
          ? [`  connected as: ${graph!.edges.map((e) => `${e.source} -> ${e.target}`).join(", ")}`]
          : []),
        "Design AROUND this: extend it, replace the model, or redesign it — and say which you chose and why.",
      ].join("\n");

  return `You are the Datlify Model Architect, an expert ML engineer that designs node pipelines for a visual ML canvas.

Available node types (type — label [category]):
${CATALOG}

Rules:
- Propose a connected pipeline of 3-8 nodes using ONLY the listed types, ordered data -> preprocessing -> model -> visualization.
- Include exactly one data node first and at least one model node (classic_ml or deep_learning).
- Suggest 3-5 algorithms ranked by fit. Each suggestion's "type" MUST be a classic_ml or deep_learning node type from the list.
- "score" is a 0-1 match confidence for the user's task. "reason" explains the fit in one sentence.
- If the canvas already has nodes, explain in your prose how your proposal relates to them (extend / replace / redesign).
- Never invent node types outside the list.

OUTPUT FORMAT — follow exactly, this is parsed by a machine:
Write 2-4 sentences of reasoning as plain prose FIRST (no headings, no bullet lists, no markdown).
Then output a single JSON object and nothing after it:
{"reply":"string","blueprint":{"nodes":[{"type":"string","reason":"string"}],"suggestions":[{"algorithm":"string","type":"string","score":0.0,"reason":"string"}]}}
The "reply" field must restate your prose in 2-4 sentences.

${graphContext}

User request: ${prompt}
Conversation: ${JSON.stringify(history.slice(-8))}`;
}

export async function POST(request: Request) {
  let body: { message?: string; history?: ChatMessage[]; graph?: GraphSummary };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid chat request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const prompt = body.message?.trim();
  if (!prompt) {
    return new Response(JSON.stringify({ error: "A message is required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const history = body.history ?? [];
  const local = localPlan(prompt);
  const apiKey = process.env.OPENCODE_ZEN_API_KEY;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          /* client disconnected */
        }
      };

      try {
        if (isCasualMessage(prompt)) {
          send({ type: "casual", text: casualReply(prompt) });
          send({ type: "done", provider: "local", model: "casual" });
          controller.close();
          return;
        }

        if (!apiKey) {
          send({ type: "trace", steps: [{ label: "No OPENCODE_ZEN_API_KEY set", detail: "using built-in heuristic planner" }] });
          send({ type: "delta", text: local.reply });
          send({ type: "blueprint", blueprint: local.blueprint, suggestions: local.blueprint.suggestions });
          send({ type: "done", provider: "local", model: "heuristic" });
          controller.close();
          return;
        }

        // Real trace: these reflect work actually about to happen, in order.
        send({
          type: "trace",
          steps: [
            { label: "Read canvas context", detail: `${body.graph?.nodes.length ?? 0} nodes, ${body.graph?.edges.length ?? 0} edges` },
            { label: "Selecting node types", detail: `${NODE_PALETTE.length} palette types available` },
            { label: "Streaming model response", detail: `${apiKey ? "opencode-zen" : "local"}` },
            { label: "Validating blueprint", detail: "checking every type against the palette" },
          ],
        });

        const instruction = buildInstruction(prompt, body.graph, history);
        const configuredModel = process.env.OPENCODE_ZEN_MODEL?.trim() || ZEN_MODEL;
        const models = [configuredModel, ...FREE_ZEN_MODELS].filter((c, i, list) => list.indexOf(c) === i);

        let raw = "";
        let usedModel: string | null = null;
        let lastError = "";

        for (const selectedModel of models) {
          raw = "";
          usedModel = selectedModel;
          try {
            const upstream = await fetch(ZEN_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
                Accept: "text/event-stream",
              },
              body: JSON.stringify({
                model: selectedModel,
                temperature: 0.2,
                max_tokens: 1600,
                stream: true,
                messages: [
                  { role: "system", content: instruction },
                  { role: "user", content: prompt },
                ],
              }),
            });

            if (!upstream.ok || !upstream.body) {
              const diagnostic = upstream.ok ? "no response body" : (await upstream.text()).replace(/\s+/g, " ").slice(0, 180);
              lastError = `${selectedModel} failed (${upstream.status})${diagnostic ? `: ${diagnostic}` : ""}`;
              continue;
            }

            // Forward prose the instant it is unambiguous, holding back only from the
            // most recent `{` onwards — that brace might turn out to open the
            // plan, and we must never flash raw JSON at the user. Every
            // character is forwarded exactly once: no replay, no duplication.
            let planFound = false;
            let flushed = 0;
            const flushProse = (upTo: number) => {
              if (upTo > flushed) {
                send({ type: "delta", text: raw.slice(flushed, upTo) });
                flushed = upTo;
              }
            };
            for await (const token of readSse(upstream.body)) {
              raw += token;
              // Keep draining the stream after the plan starts — the JSON tail is
              // still arriving and we need all of it to parse. Only the *sending*
              // of prose stops.
              if (planFound) continue;
              const start = planAnchor(raw);
              if (start !== -1) {
                // Everything before the plan is prose — flush the tail we were
                // holding back, otherwise text after a brace in the prose is lost.
                flushProse(start);
                planFound = true;
                continue;
              }
              const lastBrace = raw.lastIndexOf("{");
              flushProse(lastBrace === -1 ? raw.length : lastBrace);
            }
            if (!planFound) flushProse(raw.length);

            const { prose, json } = splitReplyAndJson(raw);
            if (!json) {
              lastError = `${selectedModel} returned no plan block`;
              continue;
            }

            let parsed: { reply?: string; blueprint?: unknown };
            try {
              parsed = JSON.parse(json) as typeof parsed;
            } catch {
              lastError = `${selectedModel} returned unparseable JSON`;
              continue;
            }

            const blueprint = cleanBlueprint(parsed.blueprint, prompt);
            const reply =
              typeof parsed.reply === "string" && parsed.reply.trim()
                ? parsed.reply.trim().slice(0, 1200)
                : prose || local.reply;
            // The streamed prose already carried the message; only the plan is new.
            send({ type: "blueprint", blueprint, suggestions: blueprint.suggestions });
            send({ type: "done", provider: "opencode-zen", model: selectedModel });
            controller.close();
            return;
          } catch (error) {
            lastError = error instanceof Error ? `${selectedModel}: ${error.message}` : `${selectedModel} failed`;
          }
        }

        // Every model failed — fall back rather than leaving the client hanging.
        send({ type: "trace", steps: [{ label: "All models unreachable", detail: lastError.slice(0, 120) || "unknown error" }] });
        send({ type: "delta", text: local.reply });
        send({ type: "blueprint", blueprint: local.blueprint, suggestions: local.blueprint.suggestions });
        send({ type: "done", provider: "local-fallback", model: usedModel ?? configuredModelSafe() });
        controller.close();
      } catch (error) {
        send({ type: "error", message: error instanceof Error ? error.message : "The AI architect failed." });
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
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

function configuredModelSafe(): string {
  return process.env.OPENCODE_ZEN_MODEL?.trim() || ZEN_MODEL;
}