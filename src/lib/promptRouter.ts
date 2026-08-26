/**
 * promptRouter.ts — deterministic natural-language → pipeline routing.
 *
 * This is an honest keyword router, not a language model: it scores the prompt
 * against per-task lexicons, softmaxes the scores into a confidence, and reports
 * exactly which terms drove the decision. The trace it emits is the real
 * derivation, which is why the UI can show its work.
 */

export type TaskKind = "classification" | "regression" | "clustering" | "vision" | "nlp" | "timeseries";

export type StepIcon = "data" | "clean" | "encode" | "vector" | "split" | "model" | "tune" | "eval" | "deploy";

export interface RoutedStep {
  id: string;
  label: string;
  detail: string;
  icon: StepIcon;
}

export interface RoutedPlan {
  task: TaskKind;
  taskLabel: string;
  target: string;
  model: string;
  metric: string;
  /** Softmax share of the winning task's score. */
  confidence: number;
  /** Prompt terms that actually fired a rule. */
  matched: string[];
  rows: number;
  features: number;
  estTrainSec: number;
  steps: RoutedStep[];
  trace: string[];
}

interface TaskProfile {
  kind: TaskKind;
  label: string;
  /** Term → weight. Multi-word phrases are matched as substrings. */
  lexicon: Record<string, number>;
  defaultTarget: string;
  model: string;
  metric: string;
  rows: number;
  features: number;
  /** Relative cost multiplier used by the train-time estimate. */
  cost: number;
  steps: RoutedStep[];
}

const PROFILES: TaskProfile[] = [
  {
    kind: "classification",
    label: "Binary classification",
    lexicon: {
      churn: 3, classify: 3, "will they": 2, fraud: 3, default: 2, spam: 2, convert: 2,
      "yes or no": 3, likelihood: 2, risk: 2, "drop off": 2, cancel: 2, subscriber: 1,
      customer: 1, retention: 2, probability: 2, approve: 2, "credit": 2,
    },
    defaultTarget: "churn",
    model: "Gradient boosting",
    metric: "ROC AUC",
    rows: 12480,
    features: 18,
    cost: 1.4,
    steps: [
      { id: "src", label: "CSV Source", detail: "load + schema inference", icon: "data" },
      { id: "clean", label: "Clean", detail: "impute, drop leaks", icon: "clean" },
      { id: "encode", label: "Encode", detail: "one-hot + scale", icon: "encode" },
      { id: "split", label: "Stratified Split", detail: "70 / 15 / 15", icon: "split" },
      { id: "model", label: "Gradient Boosting", detail: "400 trees, lr 0.05", icon: "model" },
      { id: "eval", label: "Evaluate", detail: "AUC, PR, calibration", icon: "eval" },
    ],
  },
  {
    kind: "regression",
    label: "Regression",
    lexicon: {
      price: 3, "how much": 3, revenue: 3, estimate: 2, cost: 2, value: 2, salary: 3,
      amount: 2, demand: 2, house: 2, rent: 2, sales: 2, lifetime: 2, ltv: 3, spend: 2,
      predict: 1, regression: 3, continuous: 2,
    },
    defaultTarget: "sale_price",
    model: "Random forest regressor",
    metric: "RMSE",
    rows: 8340,
    features: 24,
    cost: 1.1,
    steps: [
      { id: "src", label: "CSV Source", detail: "load + schema inference", icon: "data" },
      { id: "clean", label: "Clean", detail: "winsorise outliers", icon: "clean" },
      { id: "encode", label: "Feature Engineer", detail: "ratios, log target", icon: "encode" },
      { id: "split", label: "K-Fold Split", detail: "5 folds, shuffled", icon: "split" },
      { id: "model", label: "Random Forest", detail: "300 trees, depth 18", icon: "model" },
      { id: "eval", label: "Evaluate", detail: "RMSE, MAE, residuals", icon: "eval" },
    ],
  },
  {
    kind: "clustering",
    label: "Unsupervised clustering",
    lexicon: {
      segment: 3, cluster: 3, group: 2, "similar": 2, persona: 3, cohort: 2,
      unsupervised: 3, "without labels": 3, unlabeled: 3, discover: 2, "types of": 2,
    },
    defaultTarget: "— none (unsupervised)",
    model: "K-Means + UMAP",
    metric: "Silhouette",
    rows: 26100,
    features: 14,
    cost: 0.7,
    steps: [
      { id: "src", label: "CSV Source", detail: "load + schema inference", icon: "data" },
      { id: "clean", label: "Clean", detail: "drop constant columns", icon: "clean" },
      { id: "encode", label: "Standardise", detail: "z-score all numerics", icon: "encode" },
      { id: "model", label: "K-Means", detail: "k swept 2 → 12", icon: "model" },
      { id: "tune", label: "UMAP Project", detail: "2D, n_neighbors 15", icon: "tune" },
      { id: "eval", label: "Evaluate", detail: "silhouette, inertia", icon: "eval" },
    ],
  },
  {
    kind: "vision",
    label: "Image classification",
    lexicon: {
      image: 3, photo: 3, picture: 3, vision: 3, defect: 2, "x-ray": 3, scan: 2,
      camera: 2, detect: 1, cnn: 3, visual: 2, product: 1, label: 1,
    },
    defaultTarget: "class_label",
    model: "ResNet-34 (fine-tuned)",
    metric: "Top-1 accuracy",
    rows: 18000,
    features: 3,
    cost: 6.5,
    steps: [
      { id: "src", label: "Image Folder", detail: "224×224, 6 classes", icon: "data" },
      { id: "clean", label: "Augment", detail: "flip, crop, colour jitter", icon: "clean" },
      { id: "split", label: "Split", detail: "80 / 10 / 10", icon: "split" },
      { id: "model", label: "ResNet-34", detail: "transfer, 12 epochs", icon: "model" },
      { id: "tune", label: "LR Schedule", detail: "one-cycle, 3e-4 peak", icon: "tune" },
      { id: "eval", label: "Evaluate", detail: "top-1, per-class recall", icon: "eval" },
    ],
  },
  {
    kind: "nlp",
    label: "Text classification",
    lexicon: {
      text: 3, review: 3, sentiment: 3, comment: 2, ticket: 2, email: 2, nlp: 3,
      language: 2, feedback: 2, tweet: 3, support: 1, message: 2, topic: 2, intent: 2,
    },
    defaultTarget: "sentiment",
    model: "DistilBERT (fine-tuned)",
    metric: "Macro F1",
    rows: 42800,
    features: 1,
    cost: 4.2,
    steps: [
      { id: "src", label: "Text Source", detail: "load + language detect", icon: "data" },
      { id: "clean", label: "Normalise", detail: "strip markup, casefold", icon: "clean" },
      { id: "vector", label: "Tokenise", detail: "WordPiece, max 256", icon: "vector" },
      { id: "split", label: "Split", detail: "stratified 80 / 20", icon: "split" },
      { id: "model", label: "DistilBERT", detail: "4 epochs, 2e-5", icon: "model" },
      { id: "eval", label: "Evaluate", detail: "macro F1, confusion", icon: "eval" },
    ],
  },
  {
    kind: "timeseries",
    label: "Time-series forecasting",
    lexicon: {
      forecast: 3, "next month": 3, trend: 2, seasonal: 3, "over time": 3, daily: 2,
      weekly: 2, "time series": 3, timeseries: 3, horizon: 3, future: 2, history: 1,
      inventory: 2, traffic: 2,
    },
    defaultTarget: "units_sold",
    model: "Gradient boosting on lags",
    metric: "MAPE",
    rows: 5220,
    features: 32,
    cost: 1.0,
    steps: [
      { id: "src", label: "CSV Source", detail: "parse timestamps", icon: "data" },
      { id: "clean", label: "Resample", detail: "daily, forward-fill", icon: "clean" },
      { id: "encode", label: "Lag Features", detail: "1, 7, 28 + rolling", icon: "encode" },
      { id: "split", label: "Time Split", detail: "expanding window", icon: "split" },
      { id: "model", label: "Boosted Trees", detail: "600 rounds, lr 0.03", icon: "model" },
      { id: "eval", label: "Backtest", detail: "MAPE, 4 origins", icon: "eval" },
    ],
  },
];

const DEPLOY_STEP: RoutedStep = {
  id: "deploy",
  label: "Deploy Endpoint",
  detail: "REST + autoscale",
  icon: "deploy",
};

/** Prompts offered as chips — each routes to a different task. */
export const PROMPT_SUGGESTIONS = [
  "Predict which customers will churn next quarter",
  "Estimate house prices from square footage and location",
  "Segment our users into behavioural personas",
  "Classify support tickets by sentiment",
  "Forecast weekly inventory demand",
  "Detect defects in product photos",
];

const STOP_WORDS = new Set([
  "the", "a", "an", "of", "for", "from", "with", "and", "or", "to", "in", "on",
  "my", "our", "their", "this", "that", "based", "using", "by", "is", "are",
  "will", "would", "each", "some", "all", "data", "dataset", "model", "build",
  "want", "need", "help", "me", "i", "we", "please", "can", "you",
]);

function toSnake(phrase: string): string {
  return phrase
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
}

/** Pulls an explicit target out of phrasings like "predict <thing> from ...". */
function extractTarget(text: string): string | null {
  const verb = /\b(?:predict|predicting|forecast|forecasting|estimate|estimating|classify|classifying|detect|detecting|score|scoring|identify|flag)\s+(?:the\s+|a\s+|an\s+|our\s+|my\s+|which\s+|whether\s+)?([a-z][a-z0-9_' -]{2,34}?)(?=\s+(?:from|using|with|based|for|of|in|by|per|over|next|will|that|and)\b|[.,;!?]|$)/i;
  const match = text.match(verb);
  if (!match) return null;

  const words = match[1]
    .split(/[\s-]+/)
    .filter((w) => w.length > 0 && !STOP_WORDS.has(w.toLowerCase()));
  if (words.length === 0) return null;

  // Keep the tail of long phrases: "customers will churn" → "churn".
  return toSnake(words.slice(-2).join(" ")) || null;
}

/**
 * Routes a prompt to a pipeline. Scores every task profile, softmaxes for a
 * confidence, then assembles the plan. Falls back to classification with a
 * low confidence when nothing matches, and says so in the trace.
 */
export function routePrompt(raw: string): RoutedPlan {
  const text = raw.toLowerCase().trim();

  const scored = PROFILES.map((profile) => {
    const matched: Array<{ term: string; weight: number }> = [];
    let score = 0;
    for (const [term, weight] of Object.entries(profile.lexicon)) {
      // Word-boundary match for single tokens, substring for phrases.
      const hit = term.includes(" ")
        ? text.includes(term)
        : new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(text);
      if (hit) {
        score += weight;
        matched.push({ term, weight });
      }
    }
    return { profile, score, matched };
  });

  const best = scored.reduce((a, b) => (b.score > a.score ? b : a));
  const ambiguous = best.score === 0;
  const winner = ambiguous ? scored[0] : best;

  // Softmax over the scores — a temperature of 2 keeps close calls honest
  // instead of snapping every prompt to 99%.
  const exps = scored.map((s) => Math.exp(s.score / 2));
  const total = exps.reduce((a, b) => a + b, 0);
  const winnerIdx = scored.indexOf(winner);
  const confidence = ambiguous ? 0.25 : exps[winnerIdx] / total;

  const { profile } = winner;
  const explicitTarget = extractTarget(raw);
  const target = explicitTarget ?? profile.defaultTarget;
  const matchedTerms = [...winner.matched].sort((a, b) => b.weight - a.weight).map((m) => m.term);

  const steps = [...profile.steps, DEPLOY_STEP];

  // Train-time estimate: cells × per-cell cost, floored so trivial jobs still
  // read as a real number. Stated as an estimate in the UI.
  const estTrainSec = Math.max(
    8,
    Math.round((profile.rows * profile.features * profile.cost) / 9000),
  );

  const runnerUp = scored
    .filter((s) => s !== winner)
    .reduce((a, b) => (b.score > a.score ? b : a));

  const trace: string[] = [];
  trace.push(`Parsed ${raw.trim().split(/\s+/).filter(Boolean).length} tokens from the request.`);
  if (ambiguous) {
    trace.push("No task keywords matched — defaulting to classification at low confidence.");
  } else {
    trace.push(
      `Matched ${matchedTerms.length} signal term${matchedTerms.length === 1 ? "" : "s"}: ${matchedTerms
        .slice(0, 4)
        .join(", ")}.`,
    );
    trace.push(
      `Task → ${profile.label} (score ${winner.score}, runner-up ${runnerUp.profile.kind} at ${runnerUp.score}).`,
    );
  }
  trace.push(
    explicitTarget
      ? `Target column read from the phrasing: ${target}.`
      : `No explicit target named — using the profile default: ${target}.`,
  );
  trace.push(`Selected ${profile.model}; optimising ${profile.metric}.`);
  trace.push(`Composed ${steps.length} nodes and wired them in sequence.`);

  return {
    task: profile.kind,
    taskLabel: profile.label,
    target,
    model: profile.model,
    metric: profile.metric,
    confidence,
    matched: matchedTerms,
    rows: profile.rows,
    features: profile.features,
    estTrainSec,
    steps,
    trace,
  };
}
