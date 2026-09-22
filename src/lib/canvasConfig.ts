import type { NodeCategory, NodeParam, PaletteItem, ExecutionRoute } from "./types";

export interface CategoryConfig {
  id: NodeCategory;
  label: string;
  accent: string;
  description: string;
}

export const CATEGORIES: Record<NodeCategory, CategoryConfig> = {
  data: { id: "data", label: "Data Sources", accent: "#10b981", description: "Datasets that flow into the pipeline." },
  preprocessing: { id: "preprocessing", label: "Preprocessing", accent: "#f59e0b", description: "Transform & clean features." },
  classic_ml: { id: "classic_ml", label: "Classic ML", accent: "#0ea5e9", description: "The full scikit-learn suite on instant CPU." },
  deep_learning: { id: "deep_learning", label: "Deep Learning", accent: "#8b5cf6", description: "PyTorch neural nets trained in-app on your machine." },
  visualization: { id: "visualization", label: "Visualization", accent: "#ec4899", description: "Plotly analytics dashboards." },
};

export const COLAB_CATEGORIES: NodeCategory[] = ["deep_learning"];

/** Holdout fraction — a slider reads better than a free-text box for a ratio. */
const TEST_SIZE = (value: number): NodeParam => ({
  key: "test_size",
  label: "Test size",
  value,
  kind: "slider",
  min: 0.1,
  max: 0.5,
  step: 0.05,
  hint: "Fraction of samples held back for evaluation.",
});

export const NODE_PALETTE: PaletteItem[] = [
  // ── Data ─────────────────────────────────────────────────────────────────
  { type: "data:csv", label: "Custom CSV", description: "Upload your own dataset with auto target detection", category: "data", icon: "FileSpreadsheet", accent: CATEGORIES.data.accent },
  { type: "data:db", label: "Cloud Database", description: "Query PostgreSQL, Supabase, Neon or MySQL with SQL", category: "data", icon: "CloudDatabase", accent: CATEGORIES.data.accent },
  { type: "data:images", label: "Image Dataset", description: "Upload images grouped by class folders", category: "data", icon: "Images", accent: CATEGORIES.data.accent },
  { type: "data:breast_cancer", label: "Breast Cancer", description: "569 samples, 30 numeric features, binary", category: "data", icon: "Database", accent: CATEGORIES.data.accent, params: [TEST_SIZE(0.2)] },
  { type: "data:wine", label: "Wine Quality", description: "178 samples, 13 features, 3 classes", category: "data", icon: "Database", accent: CATEGORIES.data.accent, params: [TEST_SIZE(0.2)] },
  { type: "data:iris", label: "Iris", description: "150 samples, 4 features, 3 classes", category: "data", icon: "Database", accent: CATEGORIES.data.accent, params: [TEST_SIZE(0.25)] },
  { type: "data:synthetic", label: "Synthetic Classification", description: "Generated blobs with configurable shape and noise", category: "data", icon: "Boxes", accent: CATEGORIES.data.accent, params: [
    { key: "n_samples", label: "Samples", value: 1200, kind: "slider", min: 100, max: 8000, step: 100 },
    { key: "n_features", label: "Features", value: 20, kind: "slider", min: 2, max: 100, step: 1 },
    { key: "n_classes", label: "Classes", value: 2, kind: "slider", min: 2, max: 10, step: 1 },
    { key: "noise", label: "Noise", value: 1.2, kind: "slider", min: 0.1, max: 5, step: 0.1 },
  ] },

  // ── Preprocessing ───────────────────────────────────────────────────────
  { type: "pre:scaler", label: "Standard Scaler", description: "Zero mean and unit variance", category: "preprocessing", icon: "Scale", accent: CATEGORIES.preprocessing.accent },
  { type: "pre:minmax", label: "Min-Max Scaler", description: "Scale features to [0, 1]", category: "preprocessing", icon: "MoveHorizontal", accent: CATEGORIES.preprocessing.accent },
  { type: "pre:pca", label: "PCA", description: "Principal component reduction", category: "preprocessing", icon: "Minimize2", accent: CATEGORIES.preprocessing.accent, params: [{ key: "n_components", label: "Components", value: 0.95 }] },
  { type: "pre:polynomial", label: "Polynomial Features", description: "Generate interaction terms", category: "preprocessing", icon: "Sigma", accent: CATEGORIES.preprocessing.accent, params: [{ key: "degree", label: "Degree", value: 2 }] },
  { type: "pre:impute", label: "Impute Missing", description: "Median imputation", category: "preprocessing", icon: "Wand2", accent: CATEGORIES.preprocessing.accent },
  { type: "pre:split", label: "Train / Test Split", description: "Stratified holdout", category: "preprocessing", icon: "Split", accent: CATEGORIES.preprocessing.accent, params: [TEST_SIZE(0.2)] },

  // ── Classic ML — full scikit-learn suite ────────────────────────────────
  { type: "ml:logistic", label: "Logistic Regression", description: "Linear model with L1/L2 regularization", category: "classic_ml", icon: "Sigma", accent: CATEGORIES.classic_ml.accent, params: [
    { key: "C", label: "C (regularization)", value: 1.0 },
    { key: "solver", label: "Solver", value: "lbfgs", options: ["lbfgs", "liblinear", "saga", "newton-cg"] },
    { key: "penalty", label: "Penalty", value: "l2", options: ["l2", "l1", "none"] },
    { key: "max_iter", label: "Max iterations", value: 1000 },
  ] },
  { type: "ml:ridge", label: "Ridge Classifier", description: "Linear model with L2 least squares", category: "classic_ml", icon: "Minus", accent: CATEGORIES.classic_ml.accent, params: [{ key: "alpha", label: "Alpha", value: 1.0 }] },
  { type: "ml:sgd", label: "SGD Classifier", description: "Linear model for scalable online learning", category: "classic_ml", icon: "TrendingUp", accent: CATEGORIES.classic_ml.accent, params: [
    { key: "loss", label: "Loss", value: "log_loss", options: ["log_loss", "hinge", "modified_huber", "squared_hinge"] },
    { key: "alpha", label: "Alpha", value: 0.0001 },
    { key: "penalty", label: "Penalty", value: "l2", options: ["l2", "l1", "elasticnet"] },
    { key: "max_iter", label: "Max iterations", value: 1000 },
  ] },
  { type: "ml:knn", label: "K-Nearest Neighbors", description: "Instance-based lazy learning", category: "classic_ml", icon: "CircleDot", accent: CATEGORIES.classic_ml.accent, params: [
    { key: "n_neighbors", label: "Neighbors (k)", value: 5, kind: "slider", min: 1, max: 50, step: 1 },
    { key: "weights", label: "Weights", value: "uniform", options: ["uniform", "distance"] },
    { key: "p", label: "Distance (p)", value: 2, kind: "slider", min: 1, max: 5, step: 1, hint: "1 = Manhattan, 2 = Euclidean" },
  ] },
  { type: "ml:naive_bayes", label: "Gaussian Naive Bayes", description: "Probabilistic model assuming feature independence", category: "classic_ml", icon: "Percent", accent: CATEGORIES.classic_ml.accent, params: [{ key: "var_smoothing", label: "Var smoothing", value: 1e-9 }] },
  { type: "ml:svm", label: "Support Vector Machine", description: "Margin maximizer with kernel methods", category: "classic_ml", icon: "Crosshair", accent: CATEGORIES.classic_ml.accent, params: [
    { key: "C", label: "C (regularization)", value: 1.0 },
    { key: "kernel", label: "Kernel", value: "rbf", options: ["rbf", "linear", "poly", "sigmoid"] },
    { key: "gamma", label: "Gamma", value: "scale", options: ["scale", "auto"] },
    { key: "degree", label: "Degree (poly)", value: 3 },
  ] },
  { type: "ml:decision_tree", label: "Decision Tree", description: "Rule-based with interpretable splits", category: "classic_ml", icon: "GitBranch", accent: CATEGORIES.classic_ml.accent, params: [
    { key: "max_depth", label: "Max depth", value: 10 },
    { key: "min_samples_split", label: "Min samples split", value: 2 },
    { key: "criterion", label: "Criterion", value: "gini", options: ["gini", "entropy", "log_loss"] },
    { key: "splitter", label: "Splitter", value: "best", options: ["best", "random"] },
  ] },
  { type: "ml:random_forest", label: "Random Forest", description: "Bagged trees forming a robust ensemble", category: "classic_ml", icon: "Network", accent: CATEGORIES.classic_ml.accent, params: [
    { key: "n_estimators", label: "Estimators", value: 300 },
    { key: "max_depth", label: "Max depth", value: 12 },
    { key: "min_samples_split", label: "Min samples split", value: 2 },
    { key: "max_features", label: "Max features", value: "sqrt", options: ["sqrt", "log2", "none"] },
    { key: "criterion", label: "Criterion", value: "gini", options: ["gini", "entropy", "log_loss"] },
  ] },
  { type: "ml:extra_trees", label: "Extra Trees", description: "Extremely randomized trees", category: "classic_ml", icon: "Network", accent: CATEGORIES.classic_ml.accent, params: [
    { key: "n_estimators", label: "Estimators", value: 400 },
    { key: "max_depth", label: "Max depth", value: 14 },
    { key: "min_samples_split", label: "Min samples split", value: 2 },
    { key: "criterion", label: "Criterion", value: "gini", options: ["gini", "entropy", "log_loss"] },
  ] },
  { type: "ml:gradient_boosting", label: "Gradient Boosting", description: "Sequential boosted trees", category: "classic_ml", icon: "TrendingUp", accent: CATEGORIES.classic_ml.accent, params: [
    { key: "n_estimators", label: "Estimators", value: 200 },
    { key: "learning_rate", label: "Learning rate", value: 0.1 },
    { key: "max_depth", label: "Max depth", value: 3 },
    { key: "subsample", label: "Subsample", value: 1.0 },
    { key: "min_samples_split", label: "Min samples split", value: 2 },
  ] },
  { type: "ml:hist_gradient_boosting", label: "Hist Gradient Boosting", description: "Native histogram boosting, very fast", category: "classic_ml", icon: "BarChart3", accent: CATEGORIES.classic_ml.accent, params: [
    { key: "max_iter", label: "Iterations", value: 300 },
    { key: "learning_rate", label: "Learning rate", value: 0.1 },
    { key: "max_leaf_nodes", label: "Max leaf nodes", value: 31 },
    { key: "l2_regularization", label: "L2 regularization", value: 0.0 },
  ] },
  { type: "ml:adaboost", label: "AdaBoost", description: "Adaptive boosting", category: "classic_ml", icon: "Combine", accent: CATEGORIES.classic_ml.accent, params: [
    { key: "n_estimators", label: "Estimators", value: 200 },
    { key: "learning_rate", label: "Learning rate", value: 0.5 },
  ] },
  { type: "ml:xgboost", label: "XGBoost", description: "Extreme gradient boosting", category: "classic_ml", icon: "GitCommitVertical", accent: CATEGORIES.classic_ml.accent, params: [
    { key: "n_estimators", label: "Estimators", value: 300 },
    { key: "learning_rate", label: "Learning rate", value: 0.1 },
    { key: "max_depth", label: "Max depth", value: 6 },
    { key: "subsample", label: "Subsample", value: 0.9 },
    { key: "colsample_bytree", label: "Colsample bytree", value: 0.9 },
    { key: "min_child_weight", label: "Min child weight", value: 1 },
    { key: "reg_lambda", label: "Lambda (L2)", value: 1.0 },
  ] },
  { type: "ml:lightgbm", label: "LightGBM", description: "Light histogram gradient boosting", category: "classic_ml", icon: "Gauge", accent: CATEGORIES.classic_ml.accent, params: [
    { key: "n_estimators", label: "Estimators", value: 400 },
    { key: "learning_rate", label: "Learning rate", value: 0.05 },
    { key: "num_leaves", label: "Num leaves", value: 31 },
    { key: "min_child_samples", label: "Min child samples", value: 20 },
    { key: "subsample", label: "Subsample", value: 0.9 },
  ] },
  { type: "ml:mlp_sklearn", label: "Neural Net (MLP)", description: "scikit-learn multi-layer perceptron", category: "classic_ml", icon: "BrainCircuit", accent: CATEGORIES.classic_ml.accent, params: [
    { key: "hidden_layer_sizes", label: "Hidden units", value: 128 },
    { key: "activation", label: "Activation", value: "relu", options: ["relu", "tanh", "logistic"] },
    { key: "alpha", label: "Alpha (L2)", value: 0.0001 },
    { key: "learning_rate_init", label: "Learning rate", value: 0.001 },
    { key: "max_iter", label: "Max iterations", value: 300 },
  ] },
  { type: "ml:qda", label: "Quadratic Discriminant", description: "Gaussian per-class quadratic boundary", category: "classic_ml", icon: "Spline", accent: CATEGORIES.classic_ml.accent, params: [{ key: "reg_param", label: "Reg param", value: 0.0 }] },

  // ── Deep Learning — full PyTorch / Transformers ─────────────────────────
  { type: "dl:pytorch_mlp", label: "PyTorch MLP", description: "Multi-layer perceptron with a custom training loop", category: "deep_learning", icon: "BrainCircuit", accent: CATEGORIES.deep_learning.accent, params: [
    { key: "epochs", label: "Epochs", value: 30 },
    { key: "batch_size", label: "Batch size", value: 64 },
    { key: "lr", label: "Learning rate", value: 0.001 },
    { key: "optimizer", label: "Optimizer", value: "adamw", options: ["adamw", "adam", "sgd"] },
    { key: "dropout", label: "Dropout", value: 0.3 },
  ] },
  { type: "dl:transformer", label: "Transformer Encoder", description: "Attention over feature tokens — trains in-app", category: "deep_learning", icon: "Blocks", accent: CATEGORIES.deep_learning.accent, params: [
    { key: "epochs", label: "Epochs", value: 20 },
    { key: "batch_size", label: "Batch size", value: 32 },
    { key: "lr", label: "Learning rate", value: 0.001 },
    { key: "embed_dim", label: "Embed dim", value: 64 },
    { key: "heads", label: "Attention heads", value: 4 },
    { key: "layers", label: "Layers", value: 2 },
  ] },
  { type: "dl:cnn", label: "CNN", description: "Convolutional classifier (images or features) — trains in-app", category: "deep_learning", icon: "Image", accent: CATEGORIES.deep_learning.accent, params: [
    { key: "epochs", label: "Epochs", value: 20 },
    { key: "batch_size", label: "Batch size", value: 32 },
    { key: "optimizer", label: "Optimizer", value: "adamw", options: ["adamw", "adam", "sgd"] },
  ] },
  { type: "dl:lstm", label: "LSTM Sequence", description: "Recurrent sequence classifier", category: "deep_learning", icon: "Repeat", accent: CATEGORIES.deep_learning.accent, params: [
    { key: "epochs", label: "Epochs", value: 25 },
    { key: "hidden_size", label: "Hidden size", value: 128 },
    { key: "num_layers", label: "Layers", value: 2 },
    { key: "dropout", label: "Dropout", value: 0.2 },
  ] },
  { type: "dl:gru", label: "GRU Sequence", description: "Gated recurrent classifier", category: "deep_learning", icon: "Workflow", accent: CATEGORIES.deep_learning.accent, params: [
    { key: "epochs", label: "Epochs", value: 25 },
    { key: "hidden_size", label: "Hidden size", value: 128 },
    { key: "num_layers", label: "Layers", value: 2 },
  ] },
  { type: "dl:autoencoder", label: "Autoencoder", description: "Reconstruction pretraining + classifier head — trains in-app", category: "deep_learning", icon: "Layers", accent: CATEGORIES.deep_learning.accent, params: [
    { key: "epochs", label: "Epochs", value: 30 },
    { key: "latent_dim", label: "Latent dim", value: 32 },
    { key: "lr", label: "Learning rate", value: 0.001 },
  ] },
  { type: "dl:gan", label: "GAN", description: "Generates synthetic samples to boost a classifier — trains in-app", category: "deep_learning", icon: "Orbit", accent: CATEGORIES.deep_learning.accent, params: [
    { key: "epochs", label: "Epochs", value: 50 },
    { key: "latent_dim", label: "Latent dim", value: 100 },
    { key: "lr", label: "Learning rate", value: 0.0002 },
  ] },
  { type: "dl:tabular_transformer", label: "Tabular Transformer", description: "Feature-tokenizing transformer", category: "deep_learning", icon: "Table2", accent: CATEGORIES.deep_learning.accent, params: [
    { key: "epochs", label: "Epochs", value: 30 },
    { key: "embed_dim", label: "Embed dim", value: 64 },
    { key: "heads", label: "Attention heads", value: 4 },
    { key: "layers", label: "Layers", value: 3 },
  ] },

  // ── Visualization — pick exactly the charts you want ────────────────────
  { type: "viz:metrics", label: "Evaluation Metrics", description: "Accuracy, precision, recall, F1 and ROC-AUC", category: "visualization", icon: "Activity", accent: CATEGORIES.visualization.accent },
  { type: "viz:charts", label: "Evaluation Charts", description: "Choose the evaluation figures to render", category: "visualization", icon: "BarChart3", accent: CATEGORIES.visualization.accent, params: [
    { key: "charts", label: "Charts to render", kind: "charts", chartGroup: "core", value: "confusion_matrix,roc_curve,pr_curve,feature_importance", hint: "Only ticked charts are computed." },
  ] },
  { type: "viz:scatter", label: "Scatter Explorer", description: "2D and 3D scatter, pair plot, decision boundary", category: "visualization", icon: "ScatterChart", accent: CATEGORIES.visualization.accent, params: [
    { key: "charts", label: "Scatter charts", kind: "charts", chartGroup: "scatter", value: "scatter_2d,decision_boundary" },
    { key: "projection", label: "Projection", value: "pca", options: ["pca", "features", "importance"], hint: "pca uses principal components, features uses the indices below, importance picks the two strongest features" },
    { key: "x_index", label: "X feature index", value: 0, kind: "slider", min: 0, max: 60, step: 1, hint: "Used when projection = features" },
    { key: "y_index", label: "Y feature index", value: 1, kind: "slider", min: 0, max: 60, step: 1 },
    { key: "max_points", label: "Max points plotted", value: 1200, kind: "slider", min: 100, max: 4000, step: 100 },
    { key: "point_size", label: "Point size", value: 8, kind: "slider", min: 3, max: 18, step: 1 },
    { key: "opacity", label: "Opacity", value: 0.85, kind: "slider", min: 0.2, max: 1, step: 0.05 },
    { key: "show_train", label: "Show training points", value: "on", kind: "toggle" },
  ] },
  { type: "viz:knn", label: "KNN Analyzer", description: "k sweep, neighbour links, vote share and distances", category: "visualization", icon: "CircleDot", accent: CATEGORIES.visualization.accent, params: [
    { key: "charts", label: "KNN charts", kind: "charts", chartGroup: "knn", value: "knn_k_sweep,knn_neighbor_graph,knn_vote_scatter" },
    { key: "k_max", label: "Sweep k up to", value: 25, kind: "slider", min: 3, max: 60, step: 1 },
    { key: "probe_points", label: "Probe samples", value: 12, kind: "slider", min: 1, max: 60, step: 1, hint: "How many test points get neighbour links drawn" },
    { key: "show_radius", label: "Draw k-th neighbour radius", value: "on", kind: "toggle" },
  ] },
  { type: "viz:diagnostics", label: "Model Diagnostics", description: "Learning curve, CV spread, calibration and correlation", category: "visualization", icon: "Stethoscope", accent: CATEGORIES.visualization.accent, params: [
    { key: "charts", label: "Diagnostic charts", kind: "charts", chartGroup: "diagnostics", value: "learning_curve,calibration" },
    { key: "cv_folds", label: "CV folds", value: 5, kind: "slider", min: 2, max: 10, step: 1 },
    { key: "lc_points", label: "Learning-curve steps", value: 5, kind: "slider", min: 3, max: 8, step: 1 },
    { key: "corr_features", label: "Features in correlation map", value: 12, kind: "slider", min: 4, max: 30, step: 1 },
  ] },
];

export function getPaletteItem(type: string): PaletteItem | undefined {
  return NODE_PALETTE.find((item) => item.type === type);
}

export function getCategory(id: NodeCategory): CategoryConfig {
  return CATEGORIES[id];
}

export function resolveRoute(categories: NodeCategory[]): ExecutionRoute {
  return categories.some((c) => COLAB_CATEGORIES.includes(c)) ? "colab" : "instant";
}

export function hasModelNode(categories: NodeCategory[]): boolean {
  return categories.some((c) => c === "classic_ml" || c === "deep_learning");
}
