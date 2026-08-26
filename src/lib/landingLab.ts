/**
 * landingLab.ts — the maths behind the interactive landing modules.
 *
 * Every number the landing page shows is computed here from a deterministically
 * generated sample: the profiler really profiles, the correlation grid is a
 * real Pearson matrix, and the playground's contribution bars are the exact
 * additive decomposition of a logistic model's logit. Seeded throughout, so
 * server and client render identical output on every pass.
 */

/* ── Deterministic randomness ──────────────────────────────────────── */

/** mulberry32 — small, fast, and stable across engines. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal draw (Box–Muller). */
export function randn(next: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = next();
  while (v === 0) v = next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

/** Normal CDF — Abramowitz & Stegun 26.2.17. Used to bucket latents into categories. */
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly =
    t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const p = 1 - (poly * Math.exp(-0.5 * z * z)) / Math.sqrt(2 * Math.PI);
  return z >= 0 ? p : 1 - p;
}

/* ── Descriptive statistics ────────────────────────────────────────── */

export interface Stats {
  n: number;
  mean: number;
  median: number;
  std: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
  /** Count outside 1.5 × IQR — the standard Tukey fence. */
  outliers: number;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function describe(values: Array<number | null>): Stats {
  const xs = values.filter((v): v is number => v !== null);
  if (xs.length === 0) {
    return { n: 0, mean: 0, median: 0, std: 0, min: 0, max: 0, q1: 0, q3: 0, outliers: 0 };
  }
  const sorted = [...xs].sort((a, b) => a - b);
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  // Sample variance (n − 1): this is a sample, not the population.
  const variance = xs.length > 1 ? xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1) : 0;
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const lowFence = q1 - 1.5 * iqr;
  const highFence = q3 + 1.5 * iqr;
  return {
    n: xs.length,
    mean,
    median: quantile(sorted, 0.5),
    std: Math.sqrt(variance),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    q1,
    q3,
    outliers: xs.reduce((acc, x) => acc + (x < lowFence || x > highFence ? 1 : 0), 0),
  };
}

export interface Histogram {
  counts: number[];
  edges: number[];
  max: number;
}

export function histogram(values: Array<number | null>, bins = 16): Histogram {
  const xs = values.filter((v): v is number => v !== null);
  if (xs.length === 0) return { counts: Array(bins).fill(0), edges: [0, 1], max: 0 };
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  const span = max - min || 1;
  const counts = Array<number>(bins).fill(0);
  for (const x of xs) {
    const idx = Math.min(bins - 1, Math.floor(((x - min) / span) * bins));
    counts[idx] += 1;
  }
  const edges = Array.from({ length: bins + 1 }, (_, i) => min + (span * i) / bins);
  return { counts, edges, max: Math.max(...counts) };
}

/** Pearson correlation over pairwise-complete observations. */
export function pearson(a: Array<number | null>, b: Array<number | null>): number {
  let n = 0;
  let sa = 0;
  let sb = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    if (x === null || y === null) continue;
    n += 1;
    sa += x;
    sb += y;
  }
  if (n < 2) return 0;
  const ma = sa / n;
  const mb = sb / n;
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    if (x === null || y === null) continue;
    const da = x - ma;
    const db = y - mb;
    cov += da * db;
    va += da * da;
    vb += db * db;
  }
  if (va === 0 || vb === 0) return 0;
  return cov / Math.sqrt(va * vb);
}

/* ── Dataset profiles ──────────────────────────────────────────────── */

export type ColumnType = "num" | "cat";

interface ColumnSpec {
  name: string;
  type: ColumnType;
  /** Two-factor loadings — corr(zᵢ,zⱼ) = aᵢaⱼ + bᵢbⱼ, so a₁²+a₂² ≤ 1. */
  loads: [number, number];
  role?: "target";
  unit?: string;
  mean?: number;
  sd?: number;
  /** > 0 right-skews the column through an exponential transform. */
  skew?: number;
  integer?: boolean;
  floor?: number;
  categories?: string[];
  nullRate?: number;
}

interface ProfileSpec {
  id: string;
  file: string;
  rows: number;
  seed: number;
  task: string;
  columns: ColumnSpec[];
}

export interface ProfiledColumn {
  name: string;
  type: ColumnType;
  role: "feature" | "target";
  unit?: string;
  /** Numeric encoding — categoricals carry their level index. */
  values: Array<number | null>;
  categories?: string[];
  stats: Stats;
  histogram: Histogram;
  /** Per-level counts, categoricals only. */
  levelCounts?: number[];
  nullPct: number;
}

export interface Profile {
  id: string;
  file: string;
  rows: number;
  task: string;
  target: string;
  columns: ProfiledColumn[];
  /** Symmetric Pearson matrix over the numeric encodings. */
  corr: number[][];
  missingCells: number;
  memoryKb: number;
}

export const PROFILE_SPECS: ProfileSpec[] = [
  {
    id: "churn",
    file: "customers_churn.csv",
    rows: 1204,
    seed: 20260826,
    task: "binary classification",
    columns: [
      { name: "tenure_months", type: "num", loads: [0.86, 0.12], mean: 28, sd: 17, integer: true, floor: 1 },
      { name: "monthly_spend", type: "num", loads: [0.24, 0.78], mean: 78, sd: 31, unit: "$", floor: 12, nullRate: 0.037 },
      { name: "support_tickets", type: "num", loads: [-0.44, 0.36], mean: 2.4, sd: 2.2, integer: true, floor: 0, skew: 0.55 },
      { name: "contract_type", type: "cat", loads: [0.71, -0.08], categories: ["monthly", "one_year", "two_year"] },
      { name: "region", type: "cat", loads: [0.04, 0.09], categories: ["eu_west", "eu_north", "us_east", "us_west", "apac"] },
      { name: "autopay", type: "cat", loads: [0.52, 0.21], categories: ["no", "yes"], nullRate: 0.011 },
      { name: "churn", type: "cat", loads: [-0.79, 0.21], categories: ["retain", "churn"], role: "target" },
    ],
  },
  {
    id: "housing",
    file: "house_prices.csv",
    rows: 1460,
    seed: 71182,
    task: "regression",
    columns: [
      { name: "living_area", type: "num", loads: [0.83, 0.18], mean: 1520, sd: 520, unit: "ft²", integer: true, floor: 380 },
      { name: "lot_size", type: "num", loads: [0.41, 0.29], mean: 9800, sd: 4200, unit: "ft²", integer: true, floor: 1200, skew: 0.6 },
      { name: "year_built", type: "num", loads: [0.36, -0.62], mean: 1972, sd: 28, integer: true },
      { name: "bedrooms", type: "num", loads: [0.68, 0.11], mean: 3.1, sd: 0.9, integer: true, floor: 1 },
      { name: "quality_score", type: "num", loads: [0.74, -0.31], mean: 6.2, sd: 1.4, integer: true, floor: 1, nullRate: 0.021 },
      { name: "neighborhood", type: "cat", loads: [0.47, -0.35], categories: ["riverside", "midtown", "oakhill", "northgate"] },
      { name: "sale_price", type: "num", loads: [0.9, 0.05], mean: 181000, sd: 74000, unit: "$", integer: true, floor: 42000, skew: 0.45, role: "target" },
    ],
  },
  {
    id: "reviews",
    file: "reviews_sentiment.csv",
    rows: 2318,
    seed: 44029,
    task: "text classification",
    columns: [
      { name: "char_length", type: "num", loads: [0.79, 0.14], mean: 412, sd: 210, integer: true, floor: 24, skew: 0.7 },
      { name: "word_count", type: "num", loads: [0.81, 0.11], mean: 74, sd: 38, integer: true, floor: 4, skew: 0.65 },
      { name: "exclamations", type: "num", loads: [0.18, 0.66], mean: 1.3, sd: 1.6, integer: true, floor: 0, skew: 0.8 },
      { name: "caps_ratio", type: "num", loads: [-0.11, 0.71], mean: 0.06, sd: 0.05, floor: 0, nullRate: 0.008 },
      { name: "star_rating", type: "num", loads: [0.22, -0.83], mean: 3.6, sd: 1.3, integer: true, floor: 1 },
      { name: "verified", type: "cat", loads: [0.29, -0.14], categories: ["no", "yes"] },
      { name: "sentiment", type: "cat", loads: [0.16, -0.87], categories: ["negative", "neutral", "positive"], role: "target" },
    ],
  },
];

/**
 * Generates the sample for a spec, then profiles it. The two-factor latent
 * model gives believable cross-column structure; the correlation matrix is
 * measured from the encodings afterwards rather than assumed, so discretisation
 * attenuates it exactly as it would on real data.
 */
export function buildProfile(spec: ProfileSpec): Profile {
  const next = makeRng(spec.seed);
  const n = spec.rows;

  // Shared latent factors — the source of all cross-column correlation.
  const f1: number[] = [];
  const f2: number[] = [];
  for (let i = 0; i < n; i += 1) {
    f1.push(randn(next));
    f2.push(randn(next));
  }

  const columns: ProfiledColumn[] = spec.columns.map((col) => {
    const [a, b] = col.loads;
    const idio = Math.sqrt(Math.max(0, 1 - a * a - b * b));
    const values: Array<number | null> = [];
    let nulls = 0;

    for (let i = 0; i < n; i += 1) {
      const z = a * f1[i] + b * f2[i] + idio * randn(next);

      if (col.nullRate && next() < col.nullRate) {
        values.push(null);
        nulls += 1;
        continue;
      }

      if (col.type === "cat") {
        const levels = col.categories ?? ["a", "b"];
        const u = normalCdf(z);
        const idx = Math.min(levels.length - 1, Math.floor(u * levels.length));
        values.push(idx);
        continue;
      }

      const mean = col.mean ?? 0;
      const sd = col.sd ?? 1;
      // Right-skew by pushing the latent through exp before rescaling, keeping
      // the mean roughly where the spec asked for it.
      const shaped = col.skew ? (Math.exp(col.skew * z) - 1) / col.skew : z;
      let v = mean + sd * shaped;
      if (col.floor !== undefined) v = Math.max(col.floor, v);
      if (col.integer) v = Math.round(v);
      else v = Math.round(v * 1000) / 1000;
      values.push(v);
    }

    const isCat = col.type === "cat";
    const levelCounts: number[] | undefined = isCat
      ? (col.categories ?? []).map((_, level) => values.reduce((acc, v) => acc + (v === level ? 1 : 0), 0))
      : undefined;

    return {
      name: col.name,
      type: col.type,
      role: col.role === "target" ? "target" : "feature",
      unit: col.unit,
      values,
      categories: col.categories,
      stats: describe(values),
      histogram: isCat
        ? { counts: levelCounts ?? [], edges: [], max: Math.max(1, ...(levelCounts ?? [0])) }
        : histogram(values, 18),
      levelCounts,
      nullPct: (nulls / n) * 100,
    };
  });

  const corr = columns.map((rowCol) => columns.map((colCol) => pearson(rowCol.values, colCol.values)));
  const missingCells = columns.reduce((acc, c) => acc + c.values.filter((v) => v === null).length, 0);
  const target = columns.find((c) => c.role === "target")?.name ?? columns[columns.length - 1].name;

  return {
    id: spec.id,
    file: spec.file,
    rows: n,
    task: spec.task,
    target,
    columns,
    corr,
    missingCells,
    // Rough in-memory footprint: 8 bytes per cell, which is what a float64
    // column store would actually cost.
    memoryKb: Math.round((n * columns.length * 8) / 102.4) / 10,
  };
}

/** Strongest absolute correlations against the target column. */
export function topTargetCorrelations(profile: Profile, limit = 3): Array<{ name: string; r: number }> {
  const targetIdx = profile.columns.findIndex((c) => c.role === "target");
  if (targetIdx < 0) return [];
  return profile.columns
    .map((c, i) => ({ name: c.name, r: profile.corr[targetIdx][i] }))
    .filter((_, i) => i !== targetIdx)
    .sort((x, y) => Math.abs(y.r) - Math.abs(x.r))
    .slice(0, limit);
}

/* ── Churn model — logistic regression ─────────────────────────────── */

export interface ModelFeature {
  key: string;
  label: string;
  /** Logit weight on the standardised feature. */
  w: number;
  mean: number;
  sd: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  suffix?: string;
  control: "slider" | "segment" | "toggle";
  options?: string[];
  hint: string;
}

export const CHURN_INTERCEPT = -0.42;

export const CHURN_FEATURES: ModelFeature[] = [
  {
    key: "tenure",
    label: "Tenure",
    w: -1.18,
    mean: 28,
    sd: 17,
    min: 1,
    max: 72,
    step: 1,
    suffix: " mo",
    control: "slider",
    hint: "months since signup",
  },
  {
    key: "spend",
    label: "Monthly spend",
    w: 0.64,
    mean: 78,
    sd: 31,
    min: 12,
    max: 190,
    step: 1,
    unit: "$",
    control: "slider",
    hint: "current plan value",
  },
  {
    key: "tickets",
    label: "Support tickets",
    w: 0.97,
    mean: 2.4,
    sd: 2.2,
    min: 0,
    max: 14,
    step: 1,
    control: "slider",
    hint: "opened in last 90 days",
  },
  {
    key: "contract",
    label: "Contract",
    w: -0.88,
    mean: 0.72,
    sd: 0.79,
    min: 0,
    max: 2,
    step: 1,
    control: "segment",
    options: ["Monthly", "1 year", "2 year"],
    hint: "commitment length",
  },
  {
    key: "autopay",
    label: "Autopay",
    w: -0.51,
    mean: 0.61,
    sd: 0.49,
    min: 0,
    max: 1,
    step: 1,
    control: "toggle",
    options: ["Off", "On"],
    hint: "card on file",
  },
];

export type ChurnInput = Record<string, number>;

export interface Contribution {
  key: string;
  label: string;
  value: number;
  z: number;
  /** wᵢ·zᵢ — this term's exact share of the logit. */
  contribution: number;
}

export interface ChurnScore {
  logit: number;
  p: number;
  contributions: Contribution[];
}

/**
 * Scores one customer. For a linear model the logit decomposes exactly into
 * intercept + Σ wᵢzᵢ, so each bar in the UI is the term's true effect — no
 * approximation involved.
 */
export function scoreChurn(input: ChurnInput): ChurnScore {
  let logit = CHURN_INTERCEPT;
  const contributions: Contribution[] = CHURN_FEATURES.map((f) => {
    const value = input[f.key] ?? f.mean;
    const z = (value - f.mean) / f.sd;
    const contribution = f.w * z;
    logit += contribution;
    return { key: f.key, label: f.label, value, z, contribution };
  });
  return { logit, p: sigmoid(logit), contributions };
}

export const CHURN_PRESETS: Array<{ id: string; label: string; note: string; input: ChurnInput }> = [
  {
    id: "loyal",
    label: "Loyal enterprise",
    note: "long tenure, locked in",
    input: { tenure: 58, spend: 142, tickets: 1, contract: 2, autopay: 1 },
  },
  {
    id: "new",
    label: "New month-to-month",
    note: "no commitment yet",
    input: { tenure: 3, spend: 64, tickets: 2, contract: 0, autopay: 1 },
  },
  {
    id: "frustrated",
    label: "Frustrated churner",
    note: "ticket storm, no lock-in",
    input: { tenure: 7, spend: 118, tickets: 11, contract: 0, autopay: 0 },
  },
];

export const CHURN_DEFAULT: ChurnInput = { tenure: 14, spend: 96, tickets: 5, contract: 0, autopay: 0 };

/**
 * The monthly-spend value at which the model's probability equals `p`, holding
 * the other features fixed. Inverts the logit for the spend term, which makes
 * the decision boundary an exact line in tenure × spend space.
 */
export function boundarySpend(tenure: number, p: number, input: ChurnInput): number | null {
  const spendF = CHURN_FEATURES.find((f) => f.key === "spend");
  if (!spendF) return null;
  const targetLogit = Math.log(p / (1 - p));
  let rest = CHURN_INTERCEPT;
  for (const f of CHURN_FEATURES) {
    if (f.key === "spend") continue;
    const value = f.key === "tenure" ? tenure : input[f.key] ?? f.mean;
    rest += f.w * ((value - f.mean) / f.sd);
  }
  const z = (targetLogit - rest) / spendF.w;
  return spendF.mean + spendF.sd * z;
}

/* ── Holdout cohort & threshold sweep ──────────────────────────────── */

export interface HoldoutPoint extends ChurnInput {
  p: number;
  label: 0 | 1;
}

/**
 * A fixed evaluation cohort. Features are drawn from plausible marginals, then
 * labels are drawn as Bernoulli(model p) — so the model is calibrated on this
 * set by construction and the precision/recall trade-off behaves the way it
 * would on a real holdout.
 */
export function buildHoldout(n = 420, seed = 991733): HoldoutPoint[] {
  const next = makeRng(seed);
  const points: HoldoutPoint[] = [];
  for (let i = 0; i < n; i += 1) {
    const shared = randn(next);
    const tenure = Math.max(1, Math.min(72, Math.round(28 + 17 * shared)));
    const spend = Math.max(12, Math.min(190, Math.round(78 + 31 * (0.35 * shared + 0.94 * randn(next)))));
    const tickets = Math.max(0, Math.min(14, Math.round(2.4 + 2.2 * (-0.3 * shared + 0.95 * randn(next)))));
    const contract = next() < 0.52 ? 0 : next() < 0.55 ? 1 : 2;
    const autopay = next() < 0.61 ? 1 : 0;
    const input: ChurnInput = { tenure, spend, tickets, contract, autopay };
    const { p } = scoreChurn(input);
    points.push({ ...input, p, label: next() < p ? 1 : 0 });
  }
  return points;
}

export interface ThresholdMetrics {
  thr: number;
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
  accuracy: number;
  tpr: number;
  fpr: number;
}

export function metricsAt(cohort: HoldoutPoint[], thr: number): ThresholdMetrics {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  for (const pt of cohort) {
    const predicted = pt.p >= thr;
    if (pt.label === 1) {
      if (predicted) tp += 1;
      else fn += 1;
    } else if (predicted) fp += 1;
    else tn += 1;
  }
  const precision = tp + fp > 0 ? tp / (tp + fp) : 1;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  return {
    thr,
    tp,
    fp,
    tn,
    fn,
    precision,
    recall,
    f1: precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0,
    accuracy: (tp + tn) / Math.max(1, cohort.length),
    tpr: recall,
    fpr: fp + tn > 0 ? fp / (fp + tn) : 0,
  };
}

/** Full ROC sweep, ordered from permissive to strict. */
export function sweepThresholds(cohort: HoldoutPoint[], steps = 101): ThresholdMetrics[] {
  return Array.from({ length: steps }, (_, i) => metricsAt(cohort, i / (steps - 1)));
}

/** Trapezoidal AUC over a sweep. */
export function rocAuc(sweep: ThresholdMetrics[]): number {
  const pts = [...sweep].sort((a, b) => a.fpr - b.fpr);
  let area = 0;
  for (let i = 1; i < pts.length; i += 1) {
    area += ((pts[i].fpr - pts[i - 1].fpr) * (pts[i].tpr + pts[i - 1].tpr)) / 2;
  }
  return area;
}
