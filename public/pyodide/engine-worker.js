/**
 * NeuralForge local training worker.
 *
 * Loads Pyodide (CPython on WebAssembly) plus NumPy / scikit-learn / pandas
 * from the jsDelivr CDN, then trains classic-ML canvas pipelines entirely on
 * the user's machine. Data never leaves the browser.
 *
 * Protocol (postMessage):
 *   in : { type: "run", id, payload }         payload = GraphPayload JSON
 *   out: { type: "boot", stage }
 *        { type: "ready" }
 *        { type: "step", id, message }
 *        { type: "result", id, data }         data = InstantExecutionResponse
 *        { type: "error", id, message }
 */

const PYODIDE_VERSION = "0.26.4";
const PYODIDE_INDEX = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

let pyodidePromise = null;
let bootStage = 0;

async function ensurePyodide() {
  if (pyodidePromise) return pyodidePromise;
  pyodidePromise = (async () => {
    bootStage += 1;
    self.postMessage({ type: "boot", stage: bootStage, message: "Fetching Python runtime (WebAssembly)…" });
    importScripts(`${PYODIDE_INDEX}pyodide.js`);
    const pyodide = await loadPyodide({ indexURL: PYODIDE_INDEX });

    self.postMessage({ type: "boot", stage: 2, message: "Loading scikit-learn stack (~15 MB, first time only)…" });
    await pyodide.loadPackage(["numpy", "scikit-learn", "pandas"]);

    self.postMessage({ type: "boot", stage: 3, message: "Preparing sandbox…" });
    await pyodide.runPythonAsync(RUNNER_PY);

    self.postMessage({ type: "ready" });
    return pyodide;
  })().catch((err) => {
    pyodidePromise = null;
    throw err;
  });
  return pyodidePromise;
}

const RUNNER_PY = `
import io as _io
import json, time
import numpy as np
import pandas as pd
from sklearn import datasets as skd
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, MinMaxScaler, PolynomialFeatures
from sklearn.decomposition import PCA
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, average_precision_score, confusion_matrix,
)
from sklearn.linear_model import LogisticRegression, RidgeClassifier, SGDClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import (
    RandomForestClassifier, ExtraTreesClassifier, GradientBoostingClassifier,
    HistGradientBoostingClassifier, AdaBoostClassifier,
)
from sklearn.neural_network import MLPClassifier
from sklearn.discriminant_analysis import QuadraticDiscriminantAnalysis

MODELS = {
    "ml:logistic": (LogisticRegression, None),
    "ml:ridge": (RidgeClassifier, None),
    "ml:sgd": (SGDClassifier, None),
    "ml:knn": (KNeighborsClassifier, None),
    "ml:naive_bayes": (GaussianNB, None),
    "ml:svm": (SVC, {"probability": True}),
    "ml:decision_tree": (DecisionTreeClassifier, None),
    "ml:random_forest": (RandomForestClassifier, {"n_jobs": -1}),
    "ml:extra_trees": (ExtraTreesClassifier, {"n_jobs": -1}),
    "ml:gradient_boosting": (GradientBoostingClassifier, None),
    "ml:hist_gradient_boosting": (HistGradientBoostingClassifier, None),
    "ml:adaboost": (AdaBoostClassifier, None),
    "ml:mlp_sklearn": (MLPClassifier, None),
    "ml:qda": (QuadraticDiscriminantAnalysis, None),
}

BUILTIN = {
    "data:breast_cancer": skd.load_breast_cancer,
    "data:wine": skd.load_wine,
    "data:iris": skd.load_iris,
}

def _py(v):
    if isinstance(v, str) and v.lower() in ("none",):
        return None
    if isinstance(v, str) and v.lower() in ("true", "false"):
        return v.lower() == "true"
    if isinstance(v, (int, float)):
        return v
    try:
        return float(v) if "." in str(v) or "e" in str(v).lower() else int(v)
    except Exception:
        return v

def load_xy(g):
    data = next((n for n in g["nodes"] if n["category"] == "data"), None)
    if data is None:
        raise ValueError("No dataset node is connected.")
    t = data.get("type", "")
    params = data.get("params") or {}
    if t in BUILTIN:
        ds = BUILTIN[t]()
        feature_names = [f"f{i}" for i in range(ds.data.shape[1])]
        return ds.data, ds.target, [str(c) for c in ds.target_names], feature_names, data
    if t == "data:synthetic":
        n_feat = int(params.get("n_features", 20))
        n_cls = int(params.get("n_classes", 2))
        inf = min(n_feat, max(2, n_cls * 2))
        X, y = skd.make_classification(
            n_samples=int(params.get("n_samples", 1200)), n_features=n_feat,
            n_informative=inf, n_classes=n_cls, flip_y=0.02, random_state=42,
        )
        return X, y, [f"class_{i}" for i in range(n_cls)], [f"f{i}" for i in range(n_feat)], data
    if t == "data:csv":
        ds = data.get("dataset") or {}
        csv_text = ds.get("csvText")
        if not csv_text:
            raise ValueError("The CSV dataset content is empty — re-upload the file on the canvas.")
        df = pd.read_csv(_io.StringIO(csv_text))
        target = ds.get("targetColumn") or df.columns[-1]
        if target not in df.columns:
            raise ValueError(f"Target column '{target}' was not found in the CSV.")
        y_raw = df[target]
        X_df = pd.get_dummies(df.drop(columns=[target])).replace([float("inf"), float("-inf")], float("nan")).fillna(0)
        classes = sorted(set(map(str, y_raw.unique())))
        index_map = {c: i for i, c in enumerate(classes)}
        y = y_raw.map(lambda v: index_map[str(v)]).to_numpy()
        return X_df.to_numpy(dtype="float64"), y.astype(int), classes, list(map(str, X_df.columns)), data
    raise ValueError(f"Dataset type '{t}' cannot be trained locally.")

def split_params(g):
    for n in g["nodes"]:
        if n.get("type") == "pre:split":
            p = n.get("params") or {}
            return float(p.get("test_size", 0.2))
    d = next((n for n in g["nodes"] if n["category"] == "data"), None)
    p = (d or {}).get("params") or {}
    return float(p.get("test_size", 0.2))

def handle_run(payload_json):
    started = time.time()
    g = json.loads(payload_json)
    nodes = g.get("nodes", [])
    model_node = next((n for n in nodes if n.get("category") == "classic_ml"), None)
    if model_node is None:
        raise ValueError("Local WASM training supports classic-ML models; deep learning uses the Colab route.")

    X, y, class_names, feature_names, data_node = load_xy(g)

    steps = []
    has = lambda t: any(n.get("type") == t for n in nodes)
    if has("pre:impute"):
        steps.append(("impute", SimpleImputer(strategy="median")))
    if has("pre:polynomial"):
        deg = int(next((n for n in nodes if n.get("type") == "pre:polynomial").get("params", {}).get("degree", 2)))
        steps.append(("poly", PolynomialFeatures(degree=deg, include_bias=False)))
    if has("pre:scaler"):
        steps.append(("scale", StandardScaler()))
    if has("pre:minmax"):
        steps.append(("minmax", MinMaxScaler()))
    if has("pre:pca"):
        raw = next((n for n in nodes if n.get("type") == "pre:pca")).get("params", {}).get("n_components", 0.95)
        steps.append(("pca", PCA(n_components=_py(raw), random_state=42)))

    cls, extra = MODELS.get(model_node.get("type", ""), MODELS["ml:random_forest"])
    kwargs = dict(extra) if extra else {}
    for k, v in (model_node.get("params") or {}).items():
        kwargs[k] = _py(v)
    steps.append(("model", cls(**kwargs)))

    test_size = split_params(g)
    strat = y if len(np.unique(y)) > 1 and min(np.bincount(y)) >= 2 else None
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=test_size, random_state=42, stratify=strat)

    pipeline = Pipeline(steps)
    pipeline.fit(X_tr, y_tr)
    y_pred = pipeline.predict(X_te)

    labels = sorted(np.unique(y).tolist())
    proba = pipeline.predict_proba(X_te) if hasattr(pipeline, "predict_proba") else None

    def safe(fn):
        try:
            return round(float(fn()), 6)
        except Exception:
            return 0.0

    metrics = {
        "accuracy": safe(lambda: accuracy_score(y_te, y_pred)),
        "precision": safe(lambda: precision_score(y_te, y_pred, average="macro", zero_division=0)),
        "recall": safe(lambda: recall_score(y_te, y_pred, average="macro", zero_division=0)),
        "f1": safe(lambda: f1_score(y_te, y_pred, average="macro", zero_division=0)),
        "roc_auc": 0.0,
        "average_precision": 0.0,
    }
    if proba is not None and len(labels) == 2:
        metrics["roc_auc"] = safe(lambda: roc_auc_score(y_te, proba[:, 1]))
        metrics["average_precision"] = safe(lambda: average_precision_score(y_te, proba[:, 1]))
    elif proba is not None:
        try:
            metrics["roc_auc"] = round(float(roc_auc_score(y_te, proba, multi_class="ovr", average="macro")), 6)
        except Exception:
            pass

    cm = confusion_matrix(y_te, y_pred, labels=labels)
    confidence = [round(float(r.max()), 4) for r in proba] if proba is not None else []

    total = round(time.time() - started, 3)
    result = {
        "route": "instant",
        "status": "success",
        "engine": "pyodide-wasm",
        "pipeline": {"steps": [
            {"name": name.title(), "detail": type(step).__name__, "kind": "local"}
            for name, step in steps
        ]},
        "dataset": {
            "name": (data_node.get("dataset") or {}).get("filename") or data_node.get("label", "dataset"),
            "n_samples": int(X.shape[0]), "n_features": int(X.shape[1]),
            "n_classes": int(len(labels)), "target_type": "classification",
        },
        "model": {"name": model_node.get("label", cls.__name__), "framework": f"scikit-learn (WASM)"},
        "metrics": metrics,
        "charts": {},
        "charts_requested": [],
        "per_class": [],
        "predictions": {
            "y_true": [int(v) for v in y_te],
            "y_pred": [int(v) for v in y_pred],
            "classes": [class_names[i] if i < len(class_names) else str(i) for i in labels],
            "n_test": int(len(y_te)),
            "confidence": confidence,
        },
        "timing": {"total_seconds": total, "training_seconds": total},
        "message": "Trained locally in your browser via WebAssembly — no data left this device.",
    }
    return json.dumps(result)
`;

self.onmessage = async (event) => {
  const msg = event.data;
  if (!msg || msg.type !== "run") return;
  const { id, payload } = msg;
  try {
    const pyodide = await ensurePyodide();
    self.postMessage({ type: "step", id, message: "Local WebAssembly runtime ready — training on this device…" });
    let resultJson;
    try {
      resultJson = pyodide.globals.get("handle_run")(JSON.stringify(payload));
    } catch (pyErr) {
      // Surface Python exceptions as structured errors.
      const text = String(pyErr);
      const marker = text.lastIndexOf("ValueError:");
      throw new Error(marker >= 0 ? text.slice(marker + "ValueError:".length).trim() : text.split("\n").slice(-3).join(" ").trim());
    }
    self.postMessage({ type: "result", id, data: JSON.parse(resultJson) });
  } catch (err) {
    self.postMessage({ type: "error", id, message: err instanceof Error ? err.message : String(err) });
  }
};

