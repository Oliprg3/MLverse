/**
 * Shared domain types for the Hybrid ML Canvas platform.
 */

export type NodeCategory =
  | "data"
  | "preprocessing"
  | "classic_ml"
  | "deep_learning"
  | "visualization";

export type ExecutionRoute = "instant" | "colab";

/** Chart families the visualization nodes draw their checkbox lists from. */
export type ChartGroup = "core" | "scatter" | "knn" | "diagnostics";

/**
 * Every figure the instant engine can produce. Nothing is rendered unless the
 * user ticks it on a Visualization node — the engine only computes what was
 * asked for.
 */
export type ChartKey =
  // clustering
  | "cluster_scatter"
  | "cluster_sizes"
  | "k_selection"
  // regression diagnostics
  | "regression_predictions"
  | "regression_residuals"
  // core evaluation
  | "confusion_matrix"
  | "roc_curve"
  | "pr_curve"
  | "feature_importance"
  | "per_class_metrics"
  | "threshold_curve"
  // scatter / geometry
  | "scatter_2d"
  | "scatter_3d"
  | "splom"
  | "decision_boundary"
  | "embedding"
  | "confidence_scatter"
  // k-nearest-neighbour analysis
  | "knn_k_sweep"
  | "knn_boundary"
  | "knn_neighbor_graph"
  | "knn_distance_hist"
  | "knn_vote_scatter"
  // diagnostics
  | "learning_curve"
  | "cv_scores"
  | "calibration"
  | "class_balance"
  | "correlation"
  // deep-learning
  | "training_history";

/** A draggable node palette definition. */
export interface PaletteItem {
  type: string;
  label: string;
  description: string;
  category: NodeCategory;
  /** Icon registry name, resolved at runtime by lib/icons. */
  icon: string;
  accent: string;
  params?: NodeParam[];
}

/** How the Inspector renders a parameter control. */
export type ParamKind = "number" | "text" | "select" | "slider" | "toggle" | "charts";

export interface NodeParam {
  key: string;
  label: string;
  value: string | number;
  options?: string[];
  hint?: string;
  /** Defaults to "select" when `options` is present, else number/text by value type. */
  kind?: ParamKind;
  /** Slider bounds (kind === "slider"). */
  min?: number;
  max?: number;
  step?: number;
  /** For kind === "charts": which catalog group the checkbox list is drawn from. */
  chartGroup?: ChartGroup;
}

/** A user-imported CSV dataset attached to a custom data node. */
export interface CsvDataset {
  filename: string;
  targetColumn: string;
  columns: string[];
  nrows: number;
  csvText: string;
  /** Feature columns the user has switched off. Applied on the backend before
   *  training — the excluded columns never reach the estimator. */
  excludeColumns?: string[];
}

/** SQL dialect behind a Cloud Database source node. */
export type DbDialect = "postgres" | "mysql";

/** Connection + query state persisted on a Cloud Database (data:db) node. */
export interface DbSourceConfig {
  connectionString: string;
  query: string;
  dialect: DbDialect;
  /** idle = not configured yet, connected = last fetch succeeded, error = last fetch failed. */
  status: "idle" | "connected" | "error";
  /** Friendly message from the last failed fetch. */
  error?: string;
  fetchedAt?: string;
  rowCount?: number;
  queryMs?: number;
}

/** Per-column decision for repairing text columns that feed a numeric pipeline. */
export type TextColumnResolution = "drop" | "label" | "onehot";

/** A user-imported image dataset (grayscale-encoded samples) for classification. */
export interface ImageDataset {
  name: string;
  classNames: string[];
  /** class index per sample */
  labels: number[];
  /** flattened grayscale pixel vector per sample (length = width * height) */
  vectors: number[][];
  width: number;
  height: number;
  nsamples: number;
  /** small data-URL previews (capped) */
  thumbnails: string[];
}

/** Data carried by a React Flow node. */
export interface MLNodeData {
  type: string;
  label: string;
  description: string;
  category: NodeCategory;
  icon: string;
  accent: string;
  params?: NodeParam[];
  /** Present on custom CSV data nodes — the user's imported dataset. */
  dataset?: CsvDataset;
  /** Present on custom image data nodes — grayscale-encoded samples. */
  imageDataset?: ImageDataset;
  /** Present on Cloud Database (data:db) nodes — connection + query state. */
  dbConfig?: DbSourceConfig;
  /** Lifecycle marker stamped by the canvas during a training run. */
  executionStatus?: "running" | "success" | "error";
  /** selection ring / active state */
  selected?: boolean;
  [key: string]: unknown;
}

/** A generic Plotly figure payload (the `fig.to_dict()` shape). */
export interface PlotlyFigure {
  data: unknown[];
  layout: Record<string, unknown>;
}

export interface PipelineStep {
  name: string;
  detail: string;
  kind: string;
}

export interface DatasetInfo {
  name: string;
  n_samples: number;
  n_features: number;
  n_classes: number;
  target_type: string;
}

export interface ModelArtifact {
  format: "pickle" | "joblib" | "onnx" | "torchscript" | "pytorch";
  filename: string;
  mime: string;
  /** Base64 payload for artifacts generated by the local training engine. */
  base64?: string;
  /** Human-readable note when the artifact must be created in Colab. */
  instructions?: string;
}

export interface ModelInfo {
  name: string;
  framework: string;
  library_version?: string;
  /** "regression" when the target was continuous — selects the metric set. */
  task?: "classification" | "regression" | "clustering";
  params?: Record<string, unknown>;
  export_formats?: Array<ModelArtifact["format"]>;
}

/** Clustering metrics — present only on an unsupervised run. */
export interface MetricSet {
  n_clusters?: number;
  silhouette?: number;
  inertia?: number;
  /** Classification metrics — absent on a regression run. */
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  roc_auc: number;
  average_precision: number;
  /** Regression metrics — absent on a classification run. */
  r2?: number;
  rmse?: number;
  mae?: number;
  mape?: number;
  explained_variance?: number;
  log_loss?: number;
  balanced_accuracy?: number;
  mcc?: number;
}

export interface TimingInfo {
  total_seconds: number;
  training_seconds: number;
  charts_seconds?: number;
}

/** Raw test-set predictions for the results table + CSV export. */
export interface PredictionSet {
  y_true: number[];
  y_pred: number[];
  classes: string[];
  n_test: number;
  /** Model confidence (max predicted probability) per row, when available. */
  confidence?: number[];
}

/** Per-class precision / recall / F1 breakdown. */
export interface PerClassMetric {
  label: string;
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

/** Only the figures the user requested are present. */
export type ChartBundle = Partial<Record<ChartKey, PlotlyFigure>>;

/** A chart that was requested but could not be produced, and why. */
export interface SkippedChart {
  key: string;
  reason: string;
}

/** Where a model actually ran. `route` only records whether the *graph* was a
 *  deep-learning one, so a PyTorch model trained in-app and a scikit-learn run
 *  are both route="instant". This is what tells them apart in the UI. */
export type ExecutionRuntime = "sklearn_cpu" | "pytorch_local" | "colab_notebook";

/** One column of the data profile. Numeric columns carry the quartile block;
 *  categorical columns carry the modal value instead. */
export interface ProfileColumn {
  index: number;
  name: string;
  dtype: string;
  missing: number;
  missing_pct: number | null;
  unique: number;
  mean?: number | null;
  std?: number | null;
  min?: number | null;
  q1?: number | null;
  median?: number | null;
  q3?: number | null;
  max?: number | null;
  /** 0 = symmetric; |skew| > 1 is strongly skewed. */
  skew?: number | null;
  top_value?: string;
  top_pct?: number | null;
  /** Per-column distribution — binned counts for numeric, top values for
   *  categorical. What an analyst actually looks at first. */
  histogram?: {
    kind: "numeric" | "categorical";
    /** Numeric: bin populations; edges has counts.length + 1 entries. */
    counts?: number[];
    edges?: Array<number | null>;
    /** Categorical: most frequent values with their counts. */
    top?: Array<{ value: string; count: number }>;
  };
}

/** One row of the explorer grid: feature columns, then the target. */
export type ProfileRow = Array<number | string | null>;

export interface ProfileFinding {
  level: "ok" | "info" | "warn";
  title: string;
  detail: string;
}

/** Exploratory data analysis for a dataset — no model is fitted. */
export interface DataProfile {
  rows: number;
  columns: number;
  n_missing: number;
  missing_pct: number | null;
  constant_columns: string[];
  columns_profile: ProfileColumn[];
  correlation_labels: string[];
  correlation_matrix: Array<Array<number | null>>;
  high_correlation: Array<{ a: string; b: string; r: number; direction: string }>;
  target: {
    name: string;
    n_unique: number;
    kind: string;
    classes: Array<{ label: string; count: number; pct: number | null }>;
    imbalance_ratio?: number | null;
  };
  findings: ProfileFinding[];
  /** Column names in X order; the target is appended to each sample row. */
  column_names?: string[];
  target_name?: string;
  /** A bounded slice of the real rows, so the explorer can show data. */
  sample_rows?: ProfileRow[];
  /** True when the dataset was larger than the slice returned. */
  sample_truncated?: boolean;
  error?: string;
}

/** Response shape when the graph contains only basic ML nodes, or when a
 *  deep-learning graph trained in-app on the local PyTorch engine. */
export interface InstantExecutionResponse {
  route: Extract<ExecutionRoute, "instant">;
  runtime?: ExecutionRuntime;
  status: "success" | "error";
  engine: string;
  pipeline: { steps: PipelineStep[] };
  /** Present when a Data Profile node is on the graph, or when the run was
   *  profile-only (no model node). */
  profile?: DataProfile;
  dataset: DatasetInfo;
  model: ModelInfo;
  metrics: MetricSet;
  charts: ChartBundle;
  /** Keys the user asked for (in catalog order). */
  charts_requested?: string[];
  /** Requested-but-unavailable charts with a human-readable reason. */
  charts_skipped?: SkippedChart[];
  per_class?: PerClassMetric[];
  predictions: PredictionSet;
  timing: TimingInfo;
  message?: string;
  error?: string;
}

/** Response shape when PyTorch was unavailable and a notebook was handed off. */
export interface ColabExecutionResponse {
  route: Extract<ExecutionRoute, "colab">;
  runtime?: ExecutionRuntime;
  status: "success" | "error";
  engine: string;
  notebook: {
    filename: string;
    nbformat: number;
    cells: number;
    size_bytes: number;
    title: string;
  };
  /** Full .ipynb content serialized as JSON string. */
  notebook_json: string;
  colab_url: string;
  download_url: string;
  requirements: string[];
  recommended_runtime: string;
  nodes_detected: string[];
  message?: string;
  error?: string;
}

export type ExecutionResponse = InstantExecutionResponse | ColabExecutionResponse;

/** The compact graph payload sent to the backend. */
export interface GraphNodePayload {
  id: string;
  type: string;
  category: NodeCategory;
  label: string;
  params?: Record<string, string | number>;
  dataset?: CsvDataset;
  imageDataset?: ImageDataset;
  position: { x: number; y: number };
}

export interface GraphEdgePayload {
  id: string;
  source: string;
  target: string;
}

export interface GraphPayload {
  nodes: GraphNodePayload[];
  edges: GraphEdgePayload[];
  meta?: {
    title?: string;
    created_at?: string;
  };
}
