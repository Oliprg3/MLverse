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
  { kind: "analysis", words: ["analyse", "analyze", "analysis", "explore", "profile", "inspect", "audit", "what's in", "whats in", "describe the data", "summary", "missing values", "correlat", "data quality", "statistics", "eda"] },
  { kind: "vision", words: ["image", "photo", "picture", "cnn", "resnet", "visual", "camera", "mnist"] },
  { kind: "nlp", words: ["text", "nlp", "language", "bert", "sentiment", "transformer", "tweet", "review", "document"] },
  { kind: "timeseries", words: ["time series", "timeseries", "forecast", "sequence", "lstm", "temporal", "stock", "demand", "signal"] },
  { kind: "clustering", words: ["cluster", "segment", "unsupervised", "group", "persona", "cohort", "without labels"] },
  { kind: "regression", words: ["price", "regression", "revenue", "salary", "continuous", "how much", "house", "rent", "ltv"] },
  { kind: "classification", words: ["classify", "classification", "churn", "fraud", "spam", "label", "binary", "disease", "cancer", "predict"] },
];

const PLANS: Record<string, TaskPlan> = {
  analysis: {
    reply: "This is an exploration task rather than a prediction one, so I have not fitted a model — there is no target to predict yet. I attached a Data Profile node instead: it reports per-column descriptive statistics, missing-value counts, the correlation structure between numeric features, class balance, and flags data-quality problems like constant columns and collinear pairs. Run it and the full report lands in the results panel.",
    blueprint: {
      nodes: [
        { type: "data:csv", reason: "Point this at your own CSV once you have uploaded it, or swap in any bundled dataset to see the report shape." },
        { type: "viz:eda", reason: "Profiles the dataset without fitting anything: statistics, missing values, correlations, class balance and quality findings." },
      ],
      suggestions: [],
    },
  },
  classification: {
    reply: "I designed a classification pipeline rather than reaching for the simplest model. Blanks are imputed first because real data almost always has some, then features are standardized so the linear member is well conditioned. The model is a soft-voting ensemble — a random forest, a gradient booster and a logistic regression — rather than three variants of one algorithm, because diverse learners cancel each other's errors instead of repeating them. Expect it to beat any single member. If you need to explain a decision to a human, swap the ensemble for a depth-limited decision tree; you will lose a little accuracy and gain full interpretability.",
    blueprint: {
      nodes: [
        { type: "data:breast_cancer", reason: "A clean binary-classification benchmark to prototype on before attaching your own CSV." },
        { type: "pre:impute", reason: "Median imputation — a gap in one feature should not cost you the whole row." },
        { type: "pre:scaler", reason: "Standardization keeps the logistic member of the ensemble well conditioned." },
        { type: "ml:ensemble", reason: "Soft vote across forest + booster + linear. Diversity is what makes this beat its members." },
        { type: "viz:charts", reason: "Confusion matrix, ROC and PR curves to evaluate the trained model." },
      ],
      suggestions: [
        { algorithm: "Soft Voting Ensemble", type: "ml:ensemble", score: 0.93, reason: "Forest, booster and linear disagree in different places, so averaging their probabilities beats each one alone." },
        { algorithm: "Gradient Boosting", type: "ml:boosting", score: 0.9, reason: "Often the single strongest tabular model when sequential correction of errors is worth the training time." },
        { algorithm: "Random Forest", type: "ml:forest", score: 0.87, reason: "Strong, low-tuning default that resists overfitting on mixed-scale features and gives feature importances." },
        { algorithm: "Stacking Ensemble", type: "ml:stacking", score: 0.78, reason: "Stronger on large tabular sets, but trains a model per fold — wasteful below ~1000 rows." },
        { algorithm: "Decision Tree", type: "ml:decision_tree", score: 0.6, reason: "The choice when a human has to read the decision, not the score." },
      ],
    },
  },
  regression: {
    reply: "This is a continuous target, so I picked models that predict numbers rather than classes and dropped the classification charts — ROC curves and confusion matrices need class labels, which a forecast target does not have. You will get R², RMSE, MAE, a predicted-vs-actual plot and a residual plot instead; if the residuals curve or fan out, the model is underfitting and the relationship is probably non-linear.",
    blueprint: {
      nodes: [
        { type: "data:csv", reason: "Your observations with a continuous target column (price, demand, revenue, temperature). Pick the CSV that holds it." },
        { type: "pre:scaler", reason: "Standardization keeps the linear and distance-based regressors well conditioned." },
        { type: "ml:boosting", reason: "Gradient boosting on a continuous target — strong default on tabular data and handles non-linearity without feature engineering." },
        { type: "viz:charts", reason: "Adds predicted-vs-actual and residual diagnostics, which is where regression problems actually show up." },
      ],
      suggestions: [
        { algorithm: "Gradient Boosting Regressor", type: "ml:boosting", score: 0.9, reason: "Best accuracy on structured tabular data when training time is acceptable." },
        { algorithm: "Random Forest Regressor", type: "ml:forest", score: 0.84, reason: "Robust, needs little tuning, resists overfitting on mixed-scale features." },
        { algorithm: "Ridge Regression", type: "ml:ridge", score: 0.76, reason: "Regularized linear baseline — interpretable coefficients and stable with collinear features." },
        { algorithm: "Neural Net (MLP) Regressor", type: "ml:mlp_sklearn", score: 0.65, reason: "Flexible non-linear fit once features are scaled and data is plentiful." },
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
    reply: "For sequence data the order of observations carries the signal, and a feed-forward model throws it away. I scaled the inputs — recurrent training is unstable otherwise — and used an LSTM rather than a GRU: gated memory handles the long-range dependencies in series that tend to drift. On short sequences or a fast baseline, GRU reaches nearly the same accuracy for a fraction of the training time, so it is ranked second. This trains in-app on the local PyTorch engine.",
    blueprint: {
      nodes: [
        { type: "data:csv", reason: "Your sequential observations with a target column, in time order." },
        { type: "pre:impute", reason: "Real time series almost always have gaps; forward-fill before scaling." },
        { type: "pre:scaler", reason: "Scaling stabilizes recurrent training — unscaled inputs diverge." },
        { type: "dl:lstm", reason: "Gated memory holds long-range dependencies that drift over time." },
        { type: "viz:metrics", reason: "Metrics plus the training curve, to see whether it converged or plateaued." },
      ],
      suggestions: [
        { algorithm: "LSTM Sequence", type: "dl:lstm", score: 0.9, reason: "Gated memory captures long-range structure in ordered data." },
        { algorithm: "GRU Sequence", type: "dl:gru", score: 0.86, reason: "One fewer gate — often matches LSTM at a fraction of the training time." },
        { algorithm: "Tabular Transformer", type: "dl:tabular_transformer", score: 0.7, reason: "Attention over feature tokens when order matters less than feature interactions." },
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
- Propose a connected pipeline of 3-9 nodes using ONLY the listed types, ordered data -> preprocessing -> model -> visualization.
- Include exactly one data node first and at least one model node (classic_ml or deep_learning).
- REGRESSION IS SUPPORTED. When the user wants to predict a continuous quantity (price, revenue, demand, temperature, a count that is really a quantity), the SAME model node types resolve to their regressor equivalents — ml:boosting becomes Gradient Boosting Regressor, ml:forest becomes Random Forest Regressor, ml:ridge becomes Ridge Regression. Do NOT propose confusion matrices, ROC curves or PR curves for these; they require class labels. Use viz:charts for the regression diagnostics instead.
- EXCEPTION: if the user only wants to understand/explore/audit their data (e.g. "analyse my data", "what's in this CSV", "check for missing values", "profile it", "which columns correlate"), propose a data node plus a "viz:eda" Data Profile node and NO model node. Profiling fits nothing.

Escalate to the more advanced model when the data justifies it — do not always propose the simplest thing:
  - "ml:ensemble" (soft voting) when the task is well-studied tabular data and a single model will plateau. Its members are deliberately different (forest + booster + linear) so their errors cancel.
  - "ml:stacking" when there are enough rows to afford cross-validated meta-learning (say 1000+). Be honest in your prose that it costs a model per fold and is slower on small data.
  - "ml:boosting" over "ml:forest" when accuracy matters more than interpretability.
  - "ml:linear_tree" (a single depth-limited tree) as a transparent baseline when the user needs to explain a decision to a human.
  - "dl:*" only when the task is genuinely perceptual (images) or sequential (text, time series) AND there is enough data. Justify it; do not reach for a neural net on 500 tabular rows.

Preprocessing is not decoration — justify each step from the data's likely properties:
  - "pre:impute" when blanks are plausible (real-world data almost always has some).
  - "pre:scaler" before any distance-based or linear model (KNN, logistic, ridge, SVM).
  - "pre:polynomial" or "pre:pca" when the relationship is plausibly non-linear or the feature count is high.
  - Skip preprocessing steps you cannot justify; a needless scaler just adds noise to the plan.

Be explicit about uncertainty. If the user's request implies data characteristics you have not seen, say what you assumed and what would change the design.
- You may also add a "viz:eda" Data Profile node alongside a model when the user wants both insights and a trained model.
- Suggest 3-5 algorithms ranked by fit. Each suggestion's "type" MUST be a classic_ml or deep_learning node type from the list. Omit "suggestions" entirely for a profile-only plan.
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