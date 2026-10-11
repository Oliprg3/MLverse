"""
basic_ml_engine.py
==================

The "Instant In-App Path" execution engine.

Given a parsed DAG (list of node dicts) this module:
  1. Resolves the dataset node (breast_cancer / wine / iris / synthetic).
  2. Builds an sklearn preprocessing pipeline from the preprocessing nodes
     (StandardScaler, PCA, Imputer, TrainTestSplit).
  3. Instantiates the requested model — LogisticRegression, RandomForest,
     GradientBoosting, SVM, and (optionally) XGBoost / LightGBM which are
     loaded lazily so the engine degrades gracefully if absent.
  4. Trains on the backend CPU, computes evaluation metrics.
  5. Generates fully-formed Plotly figure dictionaries (NOT raw data):
       * Confusion Matrix  -> Heatmap
       * ROC Curve         -> Line chart (per-class + macro OvR)
       * Precision-Recall  -> Line chart (per-class + micro)
       * Feature Importance-> Horizontal bar chart

Everything returned is JSON-serialisable so the FastAPI layer / CLI can hand it
straight to the Next.js frontend, where ``PlotlyChart.tsx`` renders it.
"""

from __future__ import annotations

import base64
import csv
import io
import pickle
import time
import warnings
from dataclasses import dataclass, field
from typing import Any, Dict, List, Tuple

import numpy as np

warnings.filterwarnings("ignore")

# ── sklearn imports ──────────────────────────────────────────────────────────
from sklearn.datasets import load_breast_cancer, load_iris, load_wine, make_classification
from sklearn.ensemble import (
    AdaBoostClassifier,
    AdaBoostRegressor,
    ExtraTreesClassifier,
    ExtraTreesRegressor,
    GradientBoostingClassifier,
    GradientBoostingRegressor,
    HistGradientBoostingClassifier,
    HistGradientBoostingRegressor,
    RandomForestClassifier,
    RandomForestRegressor,
)
from sklearn.linear_model import ElasticNet, LinearRegression, LogisticRegression, Ridge, RidgeClassifier, SGDClassifier, SGDRegressor
from sklearn.naive_bayes import GaussianNB
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.neural_network import MLPClassifier, MLPRegressor
from sklearn.preprocessing import MinMaxScaler, PolynomialFeatures
from sklearn.tree import DecisionTreeClassifier
from sklearn.discriminant_analysis import QuadraticDiscriminantAnalysis
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    precision_recall_curve,
    r2_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, OrdinalEncoder, StandardScaler, label_binarize
from sklearn.svm import SVC, SVR
from sklearn.impute import SimpleImputer
from sklearn.decomposition import PCA

try:  # optional native metrics
    from sklearn.inspection import permutation_importance
except Exception:  # pragma: no cover
    permutation_importance = None  # type: ignore


# ── Dark glassmorphism theme (matches the Next.js frontend) ──────────────────
ACCENT = "#38bdf8"
GRID = "rgba(148,163,184,0.14)"
PAPER = "rgba(8,12,24,0)"  # transparent so the glass panel shows through
PLOT_BG = "rgba(15,23,42,0.55)"
FONT = "#e2e8f0"
MUTED = "#94a3b8"

PALETTE = ["#38bdf8", "#a78bfa", "#f472b6", "#34d399", "#fbbf24", "#fb7185", "#22d3ee", "#c084fc"]


def _base_layout(title: str, **overrides: Any) -> Dict[str, Any]:
    layout: Dict[str, Any] = {
        "title": {"text": f"<b>{title}</b>", "font": {"size": 16, "color": FONT}},
        "paper_bgcolor": PAPER,
        "plot_bgcolor": PLOT_BG,
        "font": {"color": FONT, "family": "Inter, ui-sans-serif, system-ui, sans-serif", "size": 12},
        "margin": {"l": 56, "r": 24, "t": 56, "b": 48},
        "legend": {"bgcolor": "rgba(15,23,42,0.0)", "font": {"color": MUTED}},
        "hoverlabel": {
            "bgcolor": "#0b1220",
            "bordercolor": ACCENT,
            "font": {"color": "#f8fafc", "size": 12},
        },
    }
    layout.update(overrides)
    return layout


# ── Figure builders ──────────────────────────────────────────────────────────
def confusion_matrix_figure(
    y_true: np.ndarray, y_pred: np.ndarray, class_names: List[str]
) -> Dict[str, Any]:
    cm = confusion_matrix(y_true, y_pred)
    cm_norm = cm.astype(float) / np.clip(cm.sum(axis=1, keepdims=True), 1, None)
    labels = [str(c) for c in class_names]

    annotations: List[Dict[str, Any]] = []
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            value = int(cm[i, j])
            pct = float(cm_norm[i, j])
            annotations.append(
                {
                    "text": f"<b>{value}</b><br><span style='font-size:10px;color:{MUTED}'>{pct:.0%}</span>",
                    "x": labels[j],
                    "y": labels[i],
                    "xref": "x",
                    "yref": "y",
                    "showarrow": False,
                    "font": {"color": "#f8fafc", "size": 13},
                }
            )

    return {
        "data": [
            {
                "type": "heatmap",
                "z": cm.tolist(),
                "x": labels,
                "y": labels,
                "colorscale": [[0, "#0b1220"], [0.25, "#0e3a5c"], [0.6, "#1d7fb8"], [1, "#7dd3fc"]],
                "showscale": True,
                "colorbar": {
                    "title": {"text": "Count", "font": {"color": MUTED}},
                    "tickfont": {"color": MUTED},
                    "thickness": 12,
                    "len": 0.75,
                },
                "hovertemplate": "True: %{y}<br>Pred: %{x}<br>Count: %{z}<extra></extra>",
            }
        ],
        "layout": _base_layout(
            "Confusion Matrix",
            xaxis=_axis("Predicted label"),
            yaxis=_axis("True label", autorange="reversed"),
            annotations=annotations,
        ),
    }


def _axis(title: str, **overrides: Any) -> Dict[str, Any]:
    ax: Dict[str, Any] = {
        "title": {"text": title, "font": {"color": MUTED}},
        "gridcolor": GRID,
        "zerolinecolor": GRID,
        "linecolor": GRID,
        "tickfont": {"color": MUTED},
        "showline": True,
    }
    ax.update(overrides)
    return ax


def roc_curve_figure(
    y_test_bin: np.ndarray, y_score: np.ndarray, class_names: List[str]
) -> Dict[str, Any]:
    n_classes = y_test_bin.shape[1]
    traces: List[Dict[str, Any]] = []

    # macro-average ROC
    fpr_grid = np.linspace(0, 1, 100)
    interp_tpr: List[np.ndarray] = []
    for c in range(n_classes):
        fpr, tpr, _ = roc_curve(y_test_bin[:, c], y_score[:, c])
        interp_tpr.append(np.interp(fpr_grid, fpr, tpr))
        traces.append(
            _line(
                fpr.tolist(),
                tpr.tolist(),
                name=f"Class {class_names[c]} (AUC={roc_auc_score(y_test_bin[:, c], y_score[:, c]):.3f})",
                color=PALETTE[c % len(PALETTE)],
                dash="dot",
            )
        )

    macro_tpr = np.mean(interp_tpr, axis=0)
    macro_tpr[-1] = 1.0
    _trapz = getattr(np, "trapezoid", getattr(np, "trapz", None))
    macro_auc = float(_trapz(macro_tpr, fpr_grid))  # type: ignore[operator]
    traces.append(_line(fpr_grid.tolist(), macro_tpr.tolist(), name=f"Macro-average (AUC={macro_auc:.3f})", color="#6366f1", width=3))

    # diagonal chance line
    traces.append(_line([0, 1], [0, 1], name="Chance", color=MUTED, dash="dash", width=1.5, showlegend=False))

    return {
        "data": traces,
        "layout": _base_layout(
            "ROC Curve · Receiver Operating Characteristic",
            xaxis=_axis("False Positive Rate", range=[0, 1]),
            yaxis=_axis("True Positive Rate", range=[0, 1.02]),
            hovermode="x",
        ),
    }


def pr_curve_figure(
    y_test_bin: np.ndarray, y_score: np.ndarray, class_names: List[str]
) -> Dict[str, Any]:
    n_classes = y_test_bin.shape[1]
    traces: List[Dict[str, Any]] = []
    for c in range(n_classes):
        precision, recall, _ = precision_recall_curve(y_test_bin[:, c], y_score[:, c])
        ap = average_precision_score(y_test_bin[:, c], y_score[:, c])
        traces.append(
            _line(
                recall.tolist(),
                precision.tolist(),
                name=f"Class {class_names[c]} (AP={ap:.3f})",
                color=PALETTE[c % len(PALETTE)],
            )
        )

    # micro-average
    precision_micro, recall_micro, _ = precision_recall_curve(y_test_bin.ravel(), y_score.ravel())
    ap_micro = average_precision_score(y_test_bin, y_score, average="micro")
    traces.append(
        _line(
            recall_micro.tolist(),
            precision_micro.tolist(),
            name=f"Micro-average (AP={ap_micro:.3f})",
            color="#f8fafc",
            width=3,
        )
    )

    return {
        "data": traces,
        "layout": _base_layout(
            "Precision-Recall Curve",
            xaxis=_axis("Recall", range=[0, 1]),
            yaxis=_axis("Precision", range=[0, 1.05]),
            hovermode="x",
        ),
    }


def feature_importance_figure(
    importances: np.ndarray, feature_names: List[str]
) -> Dict[str, Any]:
    order = np.argsort(importances)
    top = order[-15:]  # top 15 most important features
    names = [feature_names[i] for i in top]
    vals = importances[top]

    color_scale = [[i / max(len(vals) - 1, 1), PALETTE[i % len(PALETTE)]] for i in range(len(vals))]
    return {
        "data": [
            {
                "type": "bar",
                "orientation": "h",
                "x": vals.tolist(),
                "y": names,
                "marker": {"color": vals.tolist(), "colorscale": color_scale, "line": {"width": 0}},
                "hovertemplate": "%{y}<br>Importance: %{x:.4f}<extra></extra>",
            }
        ],
        "layout": _base_layout(
            "Feature Importance",
            xaxis=_axis("Relative importance"),
            yaxis=_axis("Feature", autorange="reversed"),
            bargap=0.25,
        ),
    }


def _line(
    x: List[float], y: List[float], name: str, color: str, dash: str = "solid", width: float = 2.0, showlegend: bool = True
) -> Dict[str, Any]:
    return {
        "type": "scatter",
        "mode": "lines",
        "x": x,
        "y": y,
        "name": name,
        "line": {"color": color, "width": width, "dash": dash, "shape": "linear"},
        "showlegend": showlegend,
        "hovertemplate": "%{x:.3f}, %{y:.3f}<extra>" + name + "</extra>",
    }


# ── Dataset resolution ───────────────────────────────────────────────────────
def _read_csv_rows(dataset: Dict[str, Any] | None) -> Tuple[List[Dict[str, Any]], List[str], str, List[str]]:
    """Parse CSV text into (rows, fieldnames, target, feature columns).

    Shared by the loader and the data profiler. The profiler needs the *raw*
    rows because load_csv_dataset ordinal-encodes non-numeric columns and
    folds empty cells into a category — by the time X exists, real missingness
    and the true column kind are both unrecoverable.
    """
    if not dataset:
        raise ValueError("No CSV dataset attached. Upload a CSV in the node settings first.")
    text = dataset.get("csvText", "")
    if not text or not text.strip():
        raise ValueError("The uploaded CSV is empty.")

    reader = csv.DictReader(io.StringIO(text))
    rows = [r for r in reader if any((v or "").strip() for v in r.values())]
    fieldnames = reader.fieldnames or []
    if not fieldnames or not rows:
        raise ValueError("CSV must contain a header row and at least one data row.")

    target = dataset.get("targetColumn") or ""
    if target not in fieldnames:
        target = fieldnames[-1]
    feat_cols = [c for c in fieldnames if c != target]
    if not feat_cols:
        raise ValueError("The CSV needs at least one feature column besides the target.")
    return rows, fieldnames, target, feat_cols


def csv_column_kinds(
    rows: List[Dict[str, Any]], feat_cols: List[str]
) -> Tuple[Dict[str, int], Dict[str, bool], Dict[str, Tuple[str, int]], Dict[str, List[float]]]:
    """Per-column facts recovered from the raw CSV rows.

    Returns (missing count, numeric flag, (modal value, modal count), numeric
    values).

    The numeric values matter as much as the counts: load_csv_dataset
    ordinal-encodes any column containing a blank, so a numeric column with
    gaps arrives in X as arbitrary integer codes. Taking its mean from X would
    report a confidently wrong number, so the profile reads the real values
    from here instead.
    """
    missing: Dict[str, int] = {}
    numeric: Dict[str, bool] = {}
    modal: Dict[str, Tuple[str, int]] = {}
    values_by_col: Dict[str, List[float]] = {}
    for c in feat_cols:
        values: List[str] = []
        blanks = 0
        is_numeric = True
        for r in rows:
            v = str(r.get(c, "")).strip()
            if v == "":
                # A blank is missing data, not a change of kind. A numeric column
                # with gaps is still numeric — it just needs imputing.
                blanks += 1
                continue
            values.append(v)
            try:
                float(v)
            except ValueError:
                is_numeric = False
        missing[c] = blanks
        numeric[c] = is_numeric and bool(values)
        if values and not is_numeric:
            counts: Dict[str, int] = {}
            for v in values:
                counts[v] = counts.get(v, 0) + 1
            top, top_count = max(counts.items(), key=lambda kv: kv[1])
            modal[c] = (top, top_count)
        if numeric[c]:
            values_by_col[c] = [float(v) for v in values]
    return missing, numeric, modal, values_by_col


def load_csv_dataset(dataset: Dict[str, Any] | None, params: Dict[str, Any] | None = None) -> Tuple[np.ndarray, np.ndarray, List[str], List[str], str, str]:
    """Parse a user-uploaded CSV (text + chosen target column) into X, y arrays.

    ``params['task']`` may be "auto" (default), "classification" or "regression"
    and decides how the target column is interpreted.
    """
    rows, _fieldnames, target, feat_cols = _read_csv_rows(dataset)

    n = len(rows)
    cols_enc: List[np.ndarray] = []
    for c in feat_cols:
        vals = [str(r.get(c, "")).strip() for r in rows]
        floats: List[float] = []
        numeric = True
        for v in vals:
            if v == "":
                numeric = False
                break
            try:
                floats.append(float(v))
            except ValueError:
                numeric = False
                break
        if numeric:
            cols_enc.append(np.asarray(floats, dtype=float))
        else:
            arr = np.asarray(vals, dtype=object).reshape(-1, 1)
            enc = OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)
            cols_enc.append(enc.fit_transform(arr).ravel().astype(float))

    X = np.column_stack(cols_enc) if cols_enc else np.zeros((n, 0))

    y_raw = [str(r.get(target, "")).strip() for r in rows]

    # ── Target kind: classification or regression ──────────────────────────
    # A numeric column with many distinct values is a continuous target
    # (price, demand, revenue), not a 500-class label. Treating it as a
    # classification target made "predict house price" impossible. `task` lets the
    # user state the intent explicitly; "auto" infers it.
    task = str((params.get("task") if params else "") or "auto").strip().lower()
    numeric_values: List[float] = []
    target_numeric = True
    for v in y_raw:
        if v == "":
            target_numeric = False
            break
        try:
            numeric_values.append(float(v))
        except ValueError:
            target_numeric = False
            break

    distinct = len({v for v in y_raw if v != ""})
    requested = str((params.get("task") if params else "") or "auto").strip().lower()
    if requested == "regression" or (requested == "auto" and target_numeric and distinct > 30):
        y = np.asarray(numeric_values, dtype=float)
        classes = []
        if float(np.nanstd(y)) == 0.0:
            raise ValueError(f"Target column '{target}' is constant — there is nothing to predict.")
        # A target of 0..N-1 in order is an identifier, not a measurement. Fitting
        # a regressor to it produces a meaningless R² of ~1.0 and looks great.
        unique_sorted = np.unique(y)
        if unique_sorted.size > 30 and np.allclose(unique_sorted, np.arange(unique_sorted.size)):
            raise ValueError(
                f"Target column '{target}' looks like an identifier (0…{unique_sorted.size - 1} in order), "
                "not a measurable quantity. Choose the column you actually want to predict."
            )
        return X, y, feat_cols, [], name, "regression"

    le = LabelEncoder()
    y = le.fit_transform(y_raw)
    classes = list(le.classes_)
    if len(classes) < 2:
        raise ValueError(f"Target column '{target}' must contain at least 2 unique classes.")
    if len(classes) > 30:
        # Not continuous, but still far too many to classify (e.g. an ID column).
        raise ValueError(
            f"Target column '{target}' has {len(classes)} distinct non-numeric values. "
            "Pick a categorical column, or set this node's Task to Regression if it is a numeric quantity."
        )
    return X, y, feat_cols, [str(c) for c in classes], name, "classification"


def load_image_dataset(dataset: Dict[str, Any] | None) -> Tuple[np.ndarray, np.ndarray, List[str], List[str], str]:
    """Load a user-imported image dataset (already grayscale-encoded by the client)."""
    if not dataset:
        raise ValueError("No image dataset attached. Upload images in the node settings first.")
    vectors = dataset.get("vectors") or []
    labels = dataset.get("labels") or []
    if not vectors or not labels:
        raise ValueError("Image dataset is empty. Upload images in the node settings first.")
    X = np.asarray(vectors, dtype=float)
    y = np.asarray(labels, dtype=int)
    if X.ndim != 2 or X.shape[0] != y.shape[0]:
        raise ValueError("Image dataset vectors/labels are inconsistent.")
    n_features = int(X.shape[1])
    classes_seen = sorted(set(int(c) for c in y.tolist()))
    class_names = [str(c) for c in (dataset.get("classNames") or classes_seen)]
    return X, y, [f"px_{i}" for i in range(n_features)], class_names, dataset.get("name", "Image Dataset")


def resolve_task(y: np.ndarray, requested: str = "auto", was_label_encoded: bool = False) -> str:
    """Single source of truth for classification vs regression.

    Deciding this in two places is how an explicitly-forced regression target
    (integer prices) or an integer ID column ends up routed the wrong way, so the
    loader decides once and hands the answer to the executor.
    """
    if requested == "regression":
        return "regression"
    if requested == "classification":
        return "classification"
    if was_label_encoded:
        return "classification"
    values = np.asarray(y)
    if values.dtype.kind != "f":
        return "classification"
    # Integer-valued floats: still continuous if they were not a small label set.
    return "regression" if len(np.unique(values)) > 30 else "classification"


def load_dataset(
    data_type: str, params: Dict[str, Any], dataset: Dict[str, Any] | None = None
) -> Tuple[np.ndarray, np.ndarray, List[str], List[str], str, str]:
    if data_type in ("data:csv", "data:db"):
        return load_csv_dataset(dataset, params)
    if data_type == "data:images":
        X, y, feats, classes, name = load_image_dataset(dataset)
        return X, y, feats, classes, name, "classification"
    if data_type == "data:wine":
        data = load_wine()
        name = "Wine Quality"
    elif data_type == "data:iris":
        data = load_iris()
        name = "Iris"
    else:
        data = load_breast_cancer()
        name = "Breast Cancer"
        if data_type != "data:breast_cancer":
            data_type = "data:breast_cancer"

    if data_type == "data:synthetic":
        n_samples = int(params.get("n_samples", 1200))
        n_features = int(params.get("n_features", 20))
        n_classes = int(params.get("n_classes", 2))
        noise = float(params.get("noise", 1.2))
        n_informative = min(n_features, max(2, n_classes * 2))
        X, y = make_classification(
            n_samples=n_samples,
            n_features=n_features,
            n_informative=n_informative,
            n_redundant=max(0, min(2, n_features - n_informative)),
            n_classes=n_classes,
            class_sep=float(np.clip(noise * 0.6, 0.4, 3.0)),
            flip_y=float(np.clip(0.02 * noise, 0.0, 0.3)),
            random_state=42,
        )
        feature_names = [f"feature_{i:02d}" for i in range(n_features)]
        target_names = [str(i) for i in range(n_classes)]
        return X, y, feature_names, target_names, "Synthetic Classification", "classification"

    return data.data, data.target, list(data.feature_names), [str(c) for c in data.target_names], name, "classification"


# ── Model factory ────────────────────────────────────────────────────────────
def _num(params: Dict[str, Any], key: str, default: float) -> float:
    try:
        return float(params.get(key, default))
    except (TypeError, ValueError):
        return default


def _opt(params: Dict[str, Any], key: str, default: str) -> str:
    return str(params.get(key, default))


SKLEARN_VERSION = "1.9.x"


def _safe_float(value: Any) -> Any:
    """JSON-safe float — NaN/Inf become None so the client never sees invalid JSON."""
    try:
        out = float(value)
    except (TypeError, ValueError):
        return None
    return None if (np.isnan(out) or np.isinf(out)) else out


def build_data_profile(
    X: np.ndarray,
    y: np.ndarray,
    feature_names: List[str],
    target_names: List[str],
    max_corr_features: int = 24,
    top_pairs: int = 12,
    raw_missing: Dict[str, int] | None = None,
    raw_numeric: Dict[str, bool] | None = None,
    raw_modal: Dict[str, Tuple[str, int]] | None = None,
    raw_values: Dict[str, List[float]] | None = None,
) -> Dict[str, Any]:
    """Profile a dataset without fitting anything.

    Runs on the raw matrix straight after load, so it describes the data the
    user actually has — before any imputation, scaling or projection the
    pipeline applies. Returns plain JSON-safe primitives.

    ``raw_missing`` / ``raw_numeric`` carry per-column facts recovered from the
    original CSV rows. They matter because load_csv_dataset ordinal-encodes
    non-numeric columns and folds empty cells into a category: once X exists,
    a column with 40% blanks is indistinguishable from one with none, and text
    columns look like numbers. Profiling X alone would confidently report "no
    missing values" and print meaningless means for categorical columns.
    """
    rows, cols = X.shape
    names = list(feature_names)[:cols]
    if len(names) < cols:
        names += [f"feature_{i}" for i in range(len(names), cols)]

    # ── Per-column descriptive statistics ────────────────────────────────────
    columns: List[Dict[str, Any]] = []
    missing_counts = np.isnan(X).sum(axis=0) if X.dtype.kind in "fc" else np.zeros(cols, dtype=int)
    total_missing = int(missing_counts.sum())
    constant_columns: List[str] = []

    for i in range(cols):
        col = X[:, i]
        name = names[i]
        raw_missing_i = (raw_missing or {}).get(name)
        force_numeric = (raw_numeric or {}).get(name)
        treat_numeric = (col.dtype.kind in "fc") if force_numeric is None else force_numeric
        missing_i = int(raw_missing_i) if raw_missing_i is not None else int(missing_counts[i])

        # Prefer the raw CSV values: a numeric column with gaps was
        # ordinal-encoded on the way into X, so its column there is meaningless.
        source = (raw_values or {}).get(name)
        if treat_numeric and source is not None and len(source) > 0:
            finite = np.asarray(source, dtype=float)
            finite = finite[np.isfinite(finite)]
        elif col.dtype.kind in "fc":
            finite = col[np.isfinite(col)]
        else:
            finite = col

        entry: Dict[str, Any] = {
            "index": i,
            "name": name,
            "dtype": "float" if treat_numeric else "category",
            "missing": missing_i,
            "missing_pct": _safe_float(missing_i / rows * 100.0) if rows else None,
            "unique": int(len(np.unique(finite))),
        }
        if finite.size:
            if treat_numeric:
                q1, med, q3 = np.percentile(finite, [25, 50, 75])
                std = float(np.std(finite))
                entry.update({
                    "mean": _safe_float(np.mean(finite)),
                    "std": _safe_float(std),
                    "min": _safe_float(np.min(finite)),
                    "q1": _safe_float(q1),
                    "median": _safe_float(med),
                    "q3": _safe_float(q3),
                    "max": _safe_float(np.max(finite)),
                    # Skew ~0 is symmetric; >1 or <-1 is strongly skewed.
                    "skew": _safe_float(np.mean(((finite - np.mean(finite)) / std) ** 3)) if std > 0 else 0.0,
                })
            else:
                modal = (raw_modal or {}).get(name)
                if modal is not None:
                    top_value, top_count = modal
                    share = _safe_float(top_count / rows * 100.0) if rows else None
                else:
                    vals, counts = np.unique(finite, return_counts=True)
                    top_index = int(np.argmax(counts))
                    top_value = str(vals[top_index])
                    share = _safe_float(counts[top_index] / finite.size * 100.0) if finite.size else None
                entry.update({
                    "mean": None, "std": None, "min": None, "q1": None,
                    "median": None, "q3": None, "max": None, "skew": None,
                    "top_value": top_value,
                    "top_pct": share,
                })
        if entry["unique"] <= 1:
            constant_columns.append(names[i])
        columns.append(entry)

    # ── Correlation matrix (numeric columns only) ────────────────────────────
    corr_labels: List[str] = []
    corr_matrix: List[List[Any]] = []
    high_correlation: List[Dict[str, Any]] = []

    if X.dtype.kind in "fc" and cols > 1:
        # Correlating an ordinal-encoded text column produces a confident-looking
        # number that means nothing, so restrict to genuinely numeric columns
        # when the raw CSV facts are available.
        numeric_ok = [i for i in range(cols) if (raw_numeric or {}).get(names[i], True)] if raw_numeric else list(range(cols))
        if len(numeric_ok) >= 2:
            # Prefer the most complete columns — a half-empty column correlates with nothing.
            ranked = sorted(numeric_ok, key=lambda i: missing_counts[i])
            order = np.asarray(ranked[: max(4, int(max_corr_features))])
            # Build the matrix from the real values where we recovered them, so
            # a numeric column that got ordinal-encoded does not produce a
            # confident correlation between two arbitrary integer codes.
            cols_of_values: List[np.ndarray] = []
            kept_names: List[str] = []
            for i in order:
                name = names[int(i)]
                vals = (raw_values or {}).get(name)
                series = np.asarray(vals, dtype=float) if vals else X[:, int(i)].astype(float)
                if series.size == 0 or np.std(series) <= 0:
                    continue  # constant columns correlate with nothing
                cols_of_values.append(series)
                kept_names.append(name)
            if len(cols_of_values) >= 2:
                width = min(len(cols_of_values[0]), min((len(s) for s in cols_of_values)))
                sub = np.column_stack([s[:width] for s in cols_of_values])
                corr_labels = kept_names
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    corr = np.corrcoef(sub, rowvar=False)
                corr = np.nan_to_num(corr, nan=0.0, posinf=0.0, neginf=0.0)
                corr_matrix = [[_safe_float(v) for v in row] for row in corr]
                upper = np.triu_indices(corr.shape[0], k=1)
                magnitudes = np.abs(corr[upper])
                if magnitudes.size:
                    for idx in np.argsort(-magnitudes)[:top_pairs]:
                        a, b = int(upper[0][idx]), int(upper[1][idx])
                        value = _safe_float(corr[a, b])
                        if value is None or abs(value) < 0.5:
                            continue
                        high_correlation.append({
                            "a": corr_labels[a],
                            "b": corr_labels[b],
                            "r": value,
                            "direction": "positive" if value > 0 else "negative",
                        })

    # ── Human-readable quality findings ─────────────────────────────────────
    findings: List[Dict[str, str]] = []

    # ── Target / class balance ───────────────────────────────────────────────
    target: Dict[str, Any] = {}
    if y is not None and len(y):
        values, counts = np.unique(y, return_counts=True)
        label_of = lambda v: str(target_names[int(v)]) if _is_indexable(target_names, v) else str(v)
        pairs = sorted(
            ({"label": label_of(v), "count": int(c), "pct": _safe_float(c / len(y) * 100.0)} for v, c in zip(values, counts)),
            key=lambda d: d["count"],
            reverse=True,
        )
        majority = pairs[0]["pct"] if pairs else 0.0
        target = {
            "name": "target",
            "n_unique": int(len(values)),
            "kind": "binary" if len(values) == 2 else ("continuous" if len(values) > 20 else "multiclass"),
            "classes": pairs[:25],
            "imbalance_ratio": _safe_float(max(counts) / max(1, min(counts))) if len(counts) else None,
        }
        # A class holding >65% of the rows will quietly wreck accuracy on the minority.
        if majority and majority > 65.0 and len(values) > 1:
            findings.append({"level": "warn", "title": "Class imbalance", "detail": f"The majority class holds {majority:.1f}% of rows — accuracy alone will be misleading."})

    if total_missing:
        worst = sorted(columns, key=lambda c: -c["missing"])[:3]
        detail = ", ".join(f"{c['name']} ({c['missing']})" for c in worst if c["missing"])
        findings.append({"level": "warn", "title": f"{total_missing} missing value{'s' if total_missing != 1 else ''}", "detail": f"Most affected: {detail}."})
    else:
        findings.append({"level": "ok", "title": "No missing values", "detail": "Every cell across all columns is populated."})
    if constant_columns:
        findings.append({"level": "warn", "title": f"{len(constant_columns)} constant column{'s' if len(constant_columns) != 1 else ''}", "detail": f"{', '.join(constant_columns[:4])} carry no information and will be dropped by most models."})
    if high_correlation:
        top = high_correlation[0]
        findings.append({"level": "warn", "title": f"{len(high_correlation)} strongly correlated pair{'s' if len(high_correlation) != 1 else ''}", "detail": f"Strongest: {top['a']} vs {top['b']} (r={top['r']:.2f}) — multicollinearity can destabilise linear models."})
    skewed = [c for c in columns if c.get("skew") is not None and abs(c["skew"]) > 2]
    if skewed:
        findings.append({"level": "info", "title": f"{len(skewed)} heavily skewed column{'s' if len(skewed) != 1 else ''}", "detail": f"{', '.join(c['name'] for c in skewed[:3])} — a log or robust scaler usually helps."})
    if rows < 100:
        findings.append({"level": "info", "title": "Small dataset", "detail": f"Only {rows} rows — cross-validation will be noisy and complex models will overfit."})

    return {
        "rows": int(rows),
        "columns": int(cols),
        "n_missing": total_missing,
        "missing_pct": _safe_float(total_missing / max(1, rows * cols) * 100.0),
        "constant_columns": constant_columns[:20],
        "columns_profile": columns,
        "correlation_labels": corr_labels,
        "correlation_matrix": corr_matrix,
        "high_correlation": high_correlation[:top_pairs],
        "target": target,
        "findings": findings,
    }


def _finish_regression(
    pipeline: Any,
    model_type: str,
    model_name: str,
    framework: str,
    version: str,
    task: str,
    X_test: np.ndarray,
    y_test: np.ndarray,
    y_pred: np.ndarray,
    feature_names: List[str],
    steps_desc: List[Dict[str, str]],
    train_seconds: float,
    start: float,
    emit: Any,
    has_dim_reduction: bool,
) -> Dict[str, Any]:
    """Score and chart a continuous-target run.

    ROC/PR/confusion matrices are meaningless without class labels, so a
    regression run gets R²/RMSE/MAE plus a residual plot and a predicted-vs-actual
    plot instead.
    """
    emit({"type": "step", "message": "Computing regression metrics…"})
    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
    metrics = {
        "r2": float(r2_score(y_test, y_pred)),
        "rmse": rmse,
        "mae": float(mean_absolute_error(y_test, y_pred)),
        # mape is only meaningful when the target avoids zero
        "mape": float(np.mean(np.abs((y_test - y_pred) / np.where(y_test == 0, np.nan, y_test))) * 100.0)
        if not np.any(y_test == 0) else None,
        "explained_variance": None,
    }
    try:
        from sklearn.metrics import explained_variance_score

        metrics["explained_variance"] = float(explained_variance_score(y_test, y_pred))
    except Exception:
        pass
    metrics = {k: v for k, v in metrics.items() if v is not None}
    for key, value in metrics.items():
        emit({"type": "metric", "name": key, "value": float(value)})

    emit({"type": "step", "message": "Generating regression charts…"})
    importances = _compute_importance(pipeline, X_test, y_test, feature_names, has_dim_reduction, task)
    fi_names = (
        feature_names
        if len(feature_names) == len(importances)
        else [f"feature_{i}" for i in range(len(importances))]
    )
    charts = {
        "regression_predictions": _regression_predictions_figure(y_test, y_pred),
        "regression_residuals": _regression_residuals_figure(y_test, y_pred),
        "feature_importance": feature_importance_figure(importances, fi_names),
    }

    cap = 500
    predictions = {
        "y_true": y_test[:cap].tolist(),
        "y_pred": y_pred[:cap].tolist(),
        "classes": [],
        "n_test": int(len(y_test)),
        "residuals": (y_test[:cap] - y_pred[:cap]).tolist(),
    }

    pickle_payload = base64.b64encode(pickle.dumps(pipeline, protocol=pickle.HIGHEST_PROTOCOL)).decode("ascii")
    try:
        import joblib

        buffer = io.BytesIO()
        joblib.dump(pipeline, buffer)
        joblib_payload = base64.b64encode(buffer.getvalue()).decode("ascii")
    except Exception:
        joblib_payload = None

    total = time.perf_counter() - start
    return ExecutionResult(
        route="instant",
        runtime="sklearn_cpu",
        status="success",
        engine=f"{framework} ({version}) · plotly",
        pipeline={"steps": steps_desc},
        dataset={
            "name": "",
            "n_samples": int(len(y_test)),
            "n_features": int(X_test.shape[1]),
            "n_classes": 0,
            "target_type": "continuous",
        },
        model={
            "name": model_name,
            "framework": framework,
            "library_version": version,
            "task": task,
            "artifacts": {
                "pickle": {
                    "format": "pickle",
                    "filename": f"datlify_{model_type.replace(':', '_')}.pkl",
                    "mime": "application/octet-stream",
                    "base64": pickle_payload,
                },
                "joblib": {
                    "format": "joblib",
                    "filename": f"datlify_{model_type.replace(':', '_')}.joblib",
                    "mime": "application/octet-stream",
                    "base64": joblib_payload,
                } if joblib_payload else None,
            },
        },
        metrics=metrics,
        charts=charts,
        predictions=predictions,
        timing={"total_seconds": total, "training_seconds": train_seconds},
        message=f"{model_name} trained in {train_seconds:.2f}s on CPU.",
    ).to_dict()


def _regression_scatter(x: List[float], y: List[float], title: str, xlabel: str, ylabel: str, reference: float | None = None) -> Dict[str, Any]:
    """Scatter used by the regression diagnostics, built on the shared layout
    helpers so it inherits the same theme as every other figure."""
    traces: List[Dict[str, Any]] = [{
        "type": "scatter",
        "mode": "markers",
        "name": "samples",
        "x": x,
        "y": y,
        "marker": {"size": 8, "opacity": 0.7, "color": PALETTE[0], "line": {"width": 0}},
        "hovertemplate": f"{xlabel}: %{{x:.4g}}<br>{ylabel}: %{{y:.4g}}<extra></extra>",
    }]
    overrides: Dict[str, Any] = {"xaxis": _axis(xlabel), "yaxis": _axis(ylabel)}
    if reference is not None:
        # A model whose points hug this line is predicting well.
        span_x = (max(x) - min(x)) or 1.0
        span_y = (max(y) - min(y)) or 1.0
        lo_x, hi_x = min(x), max(x)
        if reference == 0:
            # horizontal reference: residuals must straddle zero
            traces.append({
                "type": "scatter", "mode": "lines", "name": "ideal",
                "x": [lo_x, hi_x], "y": [0, 0],
                "line": {"color": "#f87171", "width": 1.5, "dash": "dash"},
                "hoverinfo": "skip",
            })
        else:
            traces.append({
                "type": "scatter", "mode": "lines", "name": "ideal (y = x)",
                "x": [lo_x, hi_x], "y": [min(lo_x, lo_x + span_y), min(lo_x, lo_x + span_y)],
                "line": {"color": "#94a3b8", "width": 1.5, "dash": "dash"},
                "hoverinfo": "skip",
            })
        overrides["hovermode"] = "closest"
    return {
        "data": traces,
        "layout": _base_layout(title, height=420, **overrides),
    }


def _regression_predictions_figure(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, Any]:
    x = [float(v) for v in y_true]
    y = [float(v) for v in y_pred]
    fig = _regression_scatter(x, y, "Predicted vs actual", "actual", "predicted", reference=1)
    # Rebuild the reference line as a true y=x diagonal in data space.
    lo = min(min(x), min(y))
    hi = max(max(x), max(y))
    fig["data"][1] = {
        "type": "scatter", "mode": "lines", "name": "ideal (y = x)",
        "x": [lo, hi], "y": [lo, hi],
        "line": {"color": "#94a3b8", "width": 1.5, "dash": "dash"},
        "hoverinfo": "skip",
    }
    return fig


def _regression_residuals_figure(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, Any]:
    resid = [float(a) - float(b) for a, b in zip(y_true, y_pred)]
    return _regression_scatter([float(v) for v in y_pred], resid, "Residuals vs predicted", "predicted", "residual (actual − predicted)", reference=0)


def _is_indexable(seq: Any, value: Any) -> bool:
    try:
        int(value)
        return 0 <= int(value) < len(seq)
    except (TypeError, ValueError):
        return False


def make_model(model_type: str, params: Dict[str, Any], task: str = "classification") -> Tuple[Any, str, str, str]:
    """Return (estimator, display_name, framework, library_version).

    Implements the full scikit-learn classifier suite plus XGBoost / LightGBM,
    and a matching regressor suite for continuous targets. Every hyperparameter
    exposed in the canvas node is honored here. ``task`` decides which family a
    dual-use node type resolves to — "ml:forest" means random forest for a class
    target and random forest regressor for a numeric one.
    """
    rs = 42
    if task == "regression":
        return make_regressor(model_type, params, rs)

    if model_type == "ml:logistic":
        penalty = _opt(params, "penalty", "l2")
        return LogisticRegression(
            C=_num(params, "C", 1.0),
            penalty=None if penalty == "none" else penalty,
            solver=_opt(params, "solver", "lbfgs"),
            max_iter=int(_num(params, "max_iter", 1000)),
            random_state=rs,
        ), "Logistic Regression", "scikit-learn", SKLEARN_VERSION

    if model_type == "ml:ridge":
        return RidgeClassifier(alpha=_num(params, "alpha", 1.0), random_state=rs), "Ridge Classifier", "scikit-learn", SKLEARN_VERSION

    if model_type == "ml:sgd":
        return SGDClassifier(
            loss=_opt(params, "loss", "log_loss"),
            alpha=_num(params, "alpha", 1e-4),
            penalty=_opt(params, "penalty", "l2"),
            max_iter=int(_num(params, "max_iter", 1000)),
            random_state=rs,
        ), "SGD Classifier", "scikit-learn", SKLEARN_VERSION

    if model_type == "ml:knn":
        return KNeighborsClassifier(
            n_neighbors=int(_num(params, "n_neighbors", 5)),
            weights=_opt(params, "weights", "uniform"),
            p=int(_num(params, "p", 2)),
            n_jobs=-1,
        ), "K-Nearest Neighbors", "scikit-learn", SKLEARN_VERSION

    if model_type == "ml:naive_bayes":
        return GaussianNB(var_smoothing=_num(params, "var_smoothing", 1e-9)), "Gaussian Naive Bayes", "scikit-learn", SKLEARN_VERSION

    if model_type == "ml:svm":
        return SVC(
            C=_num(params, "C", 1.0),
            kernel=_opt(params, "kernel", "rbf"),
            gamma=_opt(params, "gamma", "scale"),
            degree=int(_num(params, "degree", 3)),
            probability=True,
            random_state=rs,
        ), "Support Vector Machine", "scikit-learn", SKLEARN_VERSION

    if model_type == "ml:decision_tree":
        return DecisionTreeClassifier(
            max_depth=int(_num(params, "max_depth", 10)) or None,
            min_samples_split=int(_num(params, "min_samples_split", 2)),
            criterion=_opt(params, "criterion", "gini"),
            splitter=_opt(params, "splitter", "best"),
            random_state=rs,
        ), "Decision Tree", "scikit-learn", SKLEARN_VERSION

    mf = _opt(params, "max_features", "sqrt")
    mf_val = None if mf == "none" else mf
    if model_type == "ml:random_forest":
        return RandomForestClassifier(
            n_estimators=int(_num(params, "n_estimators", 300)),
            max_depth=int(_num(params, "max_depth", 12)) or None,
            min_samples_split=int(_num(params, "min_samples_split", 2)),
            max_features=mf_val,
            criterion=_opt(params, "criterion", "gini"),
            random_state=rs,
            n_jobs=-1,
        ), "Random Forest", "scikit-learn", SKLEARN_VERSION

    if model_type == "ml:extra_trees":
        return ExtraTreesClassifier(
            n_estimators=int(_num(params, "n_estimators", 400)),
            max_depth=int(_num(params, "max_depth", 14)) or None,
            min_samples_split=int(_num(params, "min_samples_split", 2)),
            criterion=_opt(params, "criterion", "gini"),
            random_state=rs,
            n_jobs=-1,
        ), "Extra Trees", "scikit-learn", SKLEARN_VERSION

    if model_type == "ml:gradient_boosting":
        return GradientBoostingClassifier(
            n_estimators=int(_num(params, "n_estimators", 200)),
            learning_rate=_num(params, "learning_rate", 0.1),
            max_depth=int(_num(params, "max_depth", 3)),
            subsample=_num(params, "subsample", 1.0),
            min_samples_split=int(_num(params, "min_samples_split", 2)),
            random_state=rs,
        ), "Gradient Boosting", "scikit-learn", SKLEARN_VERSION

    if model_type == "ml:hist_gradient_boosting":
        return HistGradientBoostingClassifier(
            max_iter=int(_num(params, "max_iter", 300)),
            learning_rate=_num(params, "learning_rate", 0.1),
            max_leaf_nodes=int(_num(params, "max_leaf_nodes", 31)),
            l2_regularization=_num(params, "l2_regularization", 0.0),
            random_state=rs,
        ), "Hist Gradient Boosting", "scikit-learn", SKLEARN_VERSION

    if model_type == "ml:adaboost":
        return AdaBoostClassifier(
            n_estimators=int(_num(params, "n_estimators", 200)),
            learning_rate=_num(params, "learning_rate", 0.5),
            random_state=rs,
        ), "AdaBoost", "scikit-learn", SKLEARN_VERSION

    if model_type == "ml:xgboost":
        import xgboost as xgb

        return xgb.XGBClassifier(
            n_estimators=int(_num(params, "n_estimators", 300)),
            learning_rate=_num(params, "learning_rate", 0.1),
            max_depth=int(_num(params, "max_depth", 6)),
            subsample=_num(params, "subsample", 0.9),
            colsample_bytree=_num(params, "colsample_bytree", 0.9),
            min_child_weight=int(_num(params, "min_child_weight", 1)),
            reg_lambda=_num(params, "reg_lambda", 1.0),
            eval_metric="logloss",
            tree_method="hist",
            random_state=rs,
            n_jobs=-1,
        ), "XGBoost", "xgboost", xgb.__version__

    if model_type == "ml:lightgbm":
        import lightgbm as lgb

        return lgb.LGBMClassifier(
            n_estimators=int(_num(params, "n_estimators", 400)),
            learning_rate=_num(params, "learning_rate", 0.05),
            num_leaves=int(_num(params, "num_leaves", 31)),
            min_child_samples=int(_num(params, "min_child_samples", 20)),
            subsample=_num(params, "subsample", 0.9),
            random_state=rs,
            n_jobs=-1,
            verbose=-1,
        ), "LightGBM", "lightgbm", lgb.__version__

    if model_type == "ml:mlp_sklearn":
        return MLPClassifier(
            hidden_layer_sizes=(int(_num(params, "hidden_layer_sizes", 128)),),
            activation=_opt(params, "activation", "relu"),
            alpha=_num(params, "alpha", 1e-4),
            learning_rate_init=_num(params, "learning_rate_init", 1e-3),
            max_iter=int(_num(params, "max_iter", 300)),
            random_state=rs,
        ), "Neural Net (MLP)", "scikit-learn", SKLEARN_VERSION

    if model_type == "ml:qda":
        return QuadraticDiscriminantAnalysis(reg_param=_num(params, "reg_param", 0.0)), "Quadratic Discriminant Analysis", "scikit-learn", SKLEARN_VERSION

    # sensible default
    return RandomForestClassifier(n_estimators=300, random_state=rs, n_jobs=-1), "Random Forest", "scikit-learn", SKLEARN_VERSION


# ── Regressor factory ────────────────────────────────────────────────────────

def make_regressor(model_type: str, params: Dict[str, Any], rs: int = 42) -> Tuple[Any, str, str, str]:
    """Return a regressor for a continuous target.

    Node types that exist in both families (ml:forest, ml:linear_tree, …) are
    resolved here by task, so one palette entry serves both worlds instead of
    duplicating every model.
    """
    t = model_type

    if t in ("ml:linear", "ml:ridge"):
        return Ridge(alpha=_num(params, "alpha", 1.0), random_state=rs), "Ridge Regression", "scikit-learn", SKLEARN_VERSION
    if t in ("ml:linear_tree", "ml:elastic_net"):
        return ElasticNet(alpha=_num(params, "alpha", 0.1), l1_ratio=_num(params, "l1_ratio", 0.5), random_state=rs, max_iter=5000), "Elastic Net", "scikit-learn", SKLEARN_VERSION
    if t in ("ml:forest", "ml:random_forest"):
        return RandomForestRegressor(n_estimators=int(_num(params, "n_estimators", 300)), max_depth=_opt(params, "max_depth", "") or None, random_state=rs, n_jobs=-1), "Random Forest Regressor", "scikit-learn", SKLEARN_VERSION
    if t in ("ml:extra_trees",):
        return ExtraTreesRegressor(n_estimators=int(_num(params, "n_estimators", 300)), random_state=rs, n_jobs=-1), "Extra Trees Regressor", "scikit-learn", SKLEARN_VERSION
    if t in ("ml:boosting", "ml:gradient_boosting"):
        return GradientBoostingRegressor(n_estimators=int(_num(params, "n_estimators", 200)), learning_rate=_num(params, "learning_rate", 0.05), max_depth=_opt(params, "max_depth", "") or None, random_state=rs), "Gradient Boosting Regressor", "scikit-learn", SKLEARN_VERSION
    if t in ("ml:hist_gradient_boosting",):
        return HistGradientBoostingRegressor(max_iter=int(_num(params, "max_iter", 300)), learning_rate=_num(params, "learning_rate", 0.06), random_state=rs), "Hist Gradient Boosting Regressor", "scikit-learn", SKLEARN_VERSION
    if t in ("ml:svm",):
        kernel = _opt(params, "kernel", "rbf")
        return SVR(kernel=kernel, C=_num(params, "C", 1.0), epsilon=_num(params, "epsilon", 0.1)), "Support Vector Regressor", "scikit-learn", SKLEARN_VERSION
    if t in ("ml:knn",):
        k = int(_num(params, "n_neighbors", 5))
        weights = _opt(params, "weights", "uniform")
        return KNeighborsRegressor(n_neighbors=max(1, k), weights=weights), "K-Nearest Neighbors Regressor", "scikit-learn", SKLEARN_VERSION
    if t in ("ml:mlp_sklearn",):
        return MLPRegressor(
            hidden_layer_sizes=(128, 64),
            alpha=_num(params, "alpha", 0.0001),
            max_iter=int(_num(params, "max_iter", 1000)),
            random_state=rs,
        ), "Neural Net (MLP) Regressor", "scikit-learn", SKLEARN_VERSION
    if t in ("ml:sgd",):
        return SGDRegressor(loss=_opt(params, "loss", "squared_error"), alpha=_num(params, "alpha", 0.0001), max_iter=int(_num(params, "max_iter", 1000)), random_state=rs), "SGD Regressor", "scikit-learn", SKLEARN_VERSION
    if t in ("ml:adaboost",):
        return AdaBoostRegressor(n_estimators=int(_num(params, "n_estimators", 100)), learning_rate=_num(params, "learning_rate", 1.0), random_state=rs), "AdaBoost Regressor", "scikit-learn", SKLEARN_VERSION
    if t in ("ml:xgboost",):
        try:
            import xgboost as xgb

            return XGBRegressor(n_estimators=int(_num(params, "n_estimators", 300)), max_depth=int(_num(params, "max_depth", 6)), learning_rate=_num(params, "learning_rate", 0.1), random_state=rs, verbosity=0, tree_method="hist", n_jobs=-1), "XGBoost Regressor", "xgboost", xgb.__version__
        except Exception:
            return GradientBoostingRegressor(random_state=rs), "Gradient Boosting Regressor", "scikit-learn (xgboost unavailable)", SKLEARN_VERSION
    if t in ("ml:lightgbm",):
        try:
            import lightgbm as lgb

            return LGBMRegressor(n_estimators=int(_num(params, "n_estimators", 300)), max_depth=int(_num(params, "max_depth", -1)), learning_rate=_num(params, "learning_rate", 0.05), random_state=rs, verbose=-1, n_jobs=-1), "LightGBM Regressor", "lightgbm", lgb.__version__
        except Exception:
            return GradientBoostingRegressor(random_state=rs), "Gradient Boosting Regressor", "scikit-learn (lightgbm unavailable)", SKLEARN_VERSION

    # sensible default
    return RandomForestRegressor(n_estimators=300, random_state=rs, n_jobs=-1), "Random Forest Regressor", "scikit-learn", SKLEARN_VERSION


@dataclass
class ExecutionResult:
    route: str = "instant"
    status: str = "success"
    engine: str = "scikit-learn + plotly"
    # Where the model actually ran. "route" only says whether the graph was a
    # deep-learning one, so the UI cannot otherwise tell an in-app PyTorch train
    # apart from a scikit-learn run (both are route="instant") or from a
    # notebook hand-off (route="colab").
    runtime: str = "sklearn_cpu"
    pipeline: Dict[str, Any] = field(default_factory=lambda: {"steps": []})
    profile: Dict[str, Any] = field(default_factory=dict)
    dataset: Dict[str, Any] = field(default_factory=dict)
    model: Dict[str, Any] = field(default_factory=dict)
    metrics: Dict[str, Any] = field(default_factory=dict)
    charts: Dict[str, Any] = field(default_factory=dict)
    predictions: Dict[str, Any] = field(default_factory=dict)
    timing: Dict[str, Any] = field(default_factory=dict)
    message: str = ""
    error: str = ""

    def to_dict(self) -> Dict[str, Any]:
        out = {
            "route": self.route,
            "status": self.status,
            "engine": self.engine,
            "runtime": self.runtime,
            "pipeline": self.pipeline,
            "profile": self.profile,
            "dataset": self.dataset,
            "model": self.model,
            "metrics": self.metrics,
            "charts": self.charts,
            "predictions": self.predictions,
            "timing": self.timing,
        }
        if self.message:
            out["message"] = self.message
        if self.error:
            out["error"] = self.error
        return out


def execute(nodes: List[Dict[str, Any]], emit: Any = None) -> Dict[str, Any]:
    """Train a basic ML pipeline from the DAG node list and return Plotly JSON.

    ``emit`` is an optional callable receiving progress/NDJSON event dicts so a
    caller (the CLI) can stream live training output to the UI.
    """
    start = time.perf_counter()
    _emit = emit if callable(emit) else (lambda e: None)
    try:
        return _execute_inner(nodes, start, _emit).to_dict()
    except Exception as exc:  # pragma: no cover - surfaced to the UI
        _emit({"type": "error", "message": f"{type(exc).__name__}: {exc}"})
        return ExecutionResult(status="error", error=f"{type(exc).__name__}: {exc}", timing={"total_seconds": time.perf_counter() - start}).to_dict()


def _execute_inner(nodes: List[Dict[str, Any]], start: float, emit: Any = lambda e: None) -> ExecutionResult:
    by_type = {n.get("type"): n for n in nodes}
    params_of = lambda t: (by_type[t].get("params") or {}) if t in by_type else {}

    # 1. dataset
    data_node = next((n for n in nodes if n.get("category") == "data"), None)
    data_type = data_node["type"] if data_node else "data:breast_cancer"
    if data_type in ("data:csv", "data:db"):
        dataset = data_node.get("dataset") if data_node else None
    elif data_type == "data:images":
        dataset = data_node.get("imageDataset") if data_node else None
    else:
        dataset = None
    emit({"type": "step", "message": f"Loading dataset ({data_type})…"})
    X, y, feature_names, target_names, dataset_name, task = load_dataset(data_type, params_of(data_type), dataset)
    emit({"type": "step", "message": f"Loaded {dataset_name} — {X.shape[0]} samples · {X.shape[1]} features · {'continuous target' if task == 'regression' else str(len(set(y.tolist()))) + ' classes'}"})

    steps_desc: List[Dict[str, str]] = [{"name": "Load dataset", "detail": dataset_name, "kind": "data"}]

    # ── Data analysis (EDA) ────────────────────────────────────────────────
    # Computed on the raw matrix before any transformation, so it describes the
    # data the user actually has. Runs whenever a Data Profile node is present,
    # or when the graph has no model node at all (profile-only analysis).
    eda_node = by_type.get("viz:eda")
    model_node_present = any(n.get("category") == "classic_ml" for n in nodes)
    want_profile = bool(eda_node) or not model_node_present
    profile: Dict[str, Any] = {}

    if want_profile:
        emit({"type": "step", "message": "Profiling the dataset — statistics, missing values, correlations…"})
        eda_params = (eda_node or {}).get("params") or {}
        # Recover real missingness / column kinds from the CSV text. After
        # load_csv_dataset has run, a column with 40% blanks is indistinguishable
        # from a complete one, so profiling X alone would report "no missing
        # values" for every dataset — a confidently wrong answer.
        raw_missing: Dict[str, int] | None = None
        raw_numeric: Dict[str, bool] | None = None
        raw_modal: Dict[str, Tuple[str, int]] | None = None
        raw_values: Dict[str, List[float]] | None = None
        if data_type in ("data:csv", "data:db") and dataset:
            try:
                raw_rows, _fns, _tgt, raw_feats = _read_csv_rows(dataset)
                raw_missing, raw_numeric, raw_modal, raw_values = csv_column_kinds(raw_rows, raw_feats)
            except Exception:
                raw_missing = raw_numeric = raw_modal = raw_values = None
        try:
            profile = build_data_profile(
                X, y, feature_names, target_names,
                max_corr_features=int(eda_params.get("corr_features", 24) or 24),
                top_pairs=int(eda_params.get("top_pairs", 12) or 12),
                raw_missing=raw_missing,
                raw_numeric=raw_numeric,
                raw_modal=raw_modal,
                raw_values=raw_values,
            )
            emit({"type": "step", "message": f"Profile ready — {profile['rows']}×{profile['columns']}, {profile['n_missing']} missing values"})
            steps_desc.append({"name": "Profile dataset", "detail": f"{profile['rows']}×{profile['columns']}", "kind": "analysis"})
        except Exception as exc:  # never let profiling sink a real run
            profile = {"error": f"{type(exc).__name__}: {exc}"}
            emit({"type": "step", "message": f"Profiling skipped ({type(exc).__name__}) — continuing without it"})

    # Profile-only run: the user asked to analyse data, not to fit a model.
    if not model_node_present:
        emit({"type": "step", "message": "No model node on the canvas — returning the data profile"})
        seconds = time.perf_counter() - start
        return ExecutionResult(
            runtime="sklearn_cpu",
            status="success",
            engine="data profiler",
            pipeline={"steps": steps_desc},
            profile=profile,
            dataset={
                "name": dataset_name,
                "n_samples": int(X.shape[0]),
                "n_features": int(X.shape[1]),
                "n_classes": int(len(np.unique(y))) if y is not None else 0,
                "target_type": profile.get("target", {}).get("kind", ""),
            },
            model={"name": "No model trained", "framework": "data profiler"},
            metrics={},
            charts={},
            predictions={"y_true": [], "y_pred": [], "classes": [], "n_test": 0},
            timing={"total_seconds": seconds, "training_seconds": 0.0},
            message="Data profile complete.",
        )

    # 2. preprocessing pipeline assembly
    steps: List[Tuple[str, Any]] = []
    has_dim_reduction = False
    if by_type.get("pre:impute"):
        steps.append(("imputer", SimpleImputer(strategy="median")))
        steps_desc.append({"name": "Impute missing", "detail": "median", "kind": "preprocessing"})
    if by_type.get("pre:polynomial"):
        deg = int(_num(params_of("pre:polynomial"), "degree", 2))
        steps.append(("poly", PolynomialFeatures(degree=max(2, deg), include_bias=False)))
        steps_desc.append({"name": "PolynomialFeatures", "detail": f"degree={deg}", "kind": "preprocessing"})
    if by_type.get("pre:scaler"):
        steps.append(("scaler", StandardScaler()))
        steps_desc.append({"name": "StandardScaler", "detail": "zero mean / unit variance", "kind": "preprocessing"})
    if by_type.get("pre:minmax"):
        steps.append(("minmax", MinMaxScaler()))
        steps_desc.append({"name": "MinMaxScaler", "detail": "scale to [0, 1]", "kind": "preprocessing"})
    if by_type.get("pre:pca"):
        comps = params_of("pre:pca").get("n_components", 0.95)
        try:
            comps_val: Any = float(comps) if float(comps) <= 1 else int(comps)
        except (TypeError, ValueError):
            comps_val = 0.95
        steps.append(("pca", PCA(n_components=comps_val, random_state=42)))
        has_dim_reduction = True
        steps_desc.append({"name": "PCA", "detail": f"n_components={comps_val}", "kind": "preprocessing"})

    # 3. train/test split
    test_size = float(params_of(data_type).get("test_size", 0.2)) or float(params_of("pre:split").get("test_size", 0.2))
    test_size = float(np.clip(test_size, 0.1, 0.5))
    emit({"type": "step", "message": f"Splitting train / test (test_size={test_size:.2f})"})
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42, stratify=y if len(np.unique(y)) > 1 else None
    )
    emit({"type": "step", "message": f"Train: {X_train.shape[0]} rows · Test: {X_test.shape[0]} rows"})
    steps_desc.append({"name": "Train/Test split", "detail": f"test_size={test_size:.2f}", "kind": "preprocessing"})

    # ── Task resolved by the loader ────────────────────────────────────────────
# load_dataset decides this once (see resolve_task) and hands it over. Deriving
# it again from y here is what previously sent integer prices to classifiers.
emit({"type": "step", "message": f"Task: {task}"})

    # 4. model
    model_node = next((n for n in nodes if n.get("category") == "classic_ml"), None)
    model_type = model_node["type"] if model_node else "ml:random_forest"
    estimator, model_name, framework, version = make_model(model_type, params_of(model_type), task)
    steps.append(("model", estimator))
    steps_desc.append({"name": f"Train {model_name}", "detail": framework, "kind": "model"})
    emit({"type": "step", "message": f"Training {model_name} ({framework}) on {X_train.shape[0]} rows…"})

    pipeline = Pipeline(steps)
    t0 = time.perf_counter()
    pipeline.fit(X_train, y_train)
    train_seconds = time.perf_counter() - t0
    emit({"type": "step", "message": f"{model_name} trained in {train_seconds:.2f}s"})

    emit({"type": "step", "message": "Predicting on the test set…"})
    # 5. predictions + probability scores
    y_pred = pipeline.predict(X_test)

    if task == "regression":
        return _finish_regression(
            pipeline, model_type, model_name, framework, version, task,
            X_test, y_test, y_pred, feature_names, steps_desc, train_seconds,
            start, emit, has_dim_reduction,
        )

    y_score = None
    try:
        y_score = pipeline.predict_proba(X_test)
    except Exception:
        try:
            y_score = pipeline.decision_function(X_test)  # linear models, hinge-loss SGD, Ridge
        except Exception:
            y_score = None

    classes = list(pipeline.classes_) if hasattr(pipeline, "classes_") else sorted(np.unique(y))
    class_names = [str(c) for c in classes]
    n_classes = len(classes)

    # 6. metrics
    avg = "weighted" if n_classes > 2 else "binary"
    roc_avg = "weighted"

    y_test_bin = label_binarize(y_test, classes=classes)
    if n_classes == 2 and y_test_bin.shape[1] == 1:
        y_test_bin = np.hstack([1 - y_test_bin, y_test_bin])

    if y_score is not None:
        y_score = np.asarray(y_score)
        if y_score.ndim == 1:
            # binary signed margin (decision_function) -> two-column score
            y_score = np.column_stack([-y_score, y_score])
        score_use = y_score
    else:
        # no score available — degenerate ROC/PR from one-hot predictions
        score_use = y_test_bin.astype(float)

    try:
        auc = roc_auc_score(y_test_bin, score_use, multi_class="ovr", average=roc_avg) if n_classes > 2 else roc_auc_score(y_test_bin, score_use, average=roc_avg)
    except Exception:
        auc = float("nan")
    try:
        ap = average_precision_score(y_test_bin, score_use, average=roc_avg)
    except Exception:
        ap = float("nan")

    metrics = {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision": float(precision_score(y_test, y_pred, average=avg, zero_division=0)),
        "recall": float(recall_score(y_test, y_pred, average=avg, zero_division=0)),
        "f1": float(f1_score(y_test, y_pred, average=avg, zero_division=0)),
        "roc_auc": float(auc),
        "average_precision": float(ap),
    }
    emit({"type": "step", "message": "Computing evaluation metrics…"})
    for _mk, _mv in metrics.items():
        emit({"type": "metric", "name": _mk, "value": float(_mv)})

    # 7. charts
    emit({"type": "step", "message": "Generating Plotly charts & predictions…"})
    importances = _compute_importance(pipeline, X_test, y_test, feature_names, has_dim_reduction, task)
    fi_names = (
        feature_names
        if len(feature_names) == len(importances)
        else [f"feature_{i}" for i in range(len(importances))]
    )

    charts = {
        "confusion_matrix": confusion_matrix_figure(y_test, y_pred, class_names),
        "roc_curve": roc_curve_figure(y_test_bin, score_use, class_names),
        "pr_curve": pr_curve_figure(y_test_bin, score_use, class_names),
        "feature_importance": feature_importance_figure(importances, fi_names),
    }

    # 8. raw predictions (so the UI can show a results table + CSV export)
    cap = 500
    predictions = {
        "y_true": y_test[:cap].tolist(),
        "y_pred": y_pred[:cap].tolist(),
        "classes": class_names,
        "n_test": int(len(y_test)),
    }

    pickle_payload = base64.b64encode(pickle.dumps(pipeline, protocol=pickle.HIGHEST_PROTOCOL)).decode("ascii")
    try:
        import joblib
        joblib_buffer = io.BytesIO()
        joblib.dump(pipeline, joblib_buffer)
        joblib_payload = base64.b64encode(joblib_buffer.getvalue()).decode("ascii")
    except Exception:
        joblib_payload = None

    return ExecutionResult(
        route="instant",
        status="success",
        engine=f"{framework} ({version}) · plotly",
        pipeline={"steps": steps_desc},
        profile=profile,
        dataset={
            "name": dataset_name,
            "n_samples": int(X.shape[0]),
            "n_features": int(X.shape[1]),
            "n_classes": int(n_classes),
            "target_type": "classification",
        },
        model={
            "name": model_name,
            "framework": framework,
            "library_version": version,
            "export_formats": ["pickle", "joblib"],
            "artifacts": {
                "pickle": {
                    "format": "pickle",
                    "filename": f"datlify_{model_type.replace(':', '_')}.pkl",
                    "mime": "application/octet-stream",
                    "base64": pickle_payload,
                },
                "joblib": {
                    "format": "joblib",
                    "filename": f"datlify_{model_type.replace(':', '_')}.joblib",
                    "mime": "application/octet-stream",
                    "base64": joblib_payload,
                } if joblib_payload else None,
            },
        },
        metrics=metrics,
        charts=charts,
        predictions=predictions,
        timing={"total_seconds": time.perf_counter() - start, "training_seconds": train_seconds},
        message=f"{model_name} trained in {train_seconds:.2f}s on CPU.",
    )


def _compute_importance(
    pipeline: Pipeline, X_test: np.ndarray, y_test: np.ndarray, feature_names: List[str], has_dim_reduction: bool,
    task: str = "classification",
) -> np.ndarray:
    final = pipeline.named_steps["model"]
    n_feat = X_test.shape[1]

    # Direct feature importance (1:1 mapping) when no dimensionality reduction.
    if not has_dim_reduction and hasattr(final, "feature_importances_"):
        imp = np.asarray(final.feature_importances_, dtype=float)
        if imp.shape[0] == n_feat:
            return _normalize(imp, n_feat, feature_names)

    if not has_dim_reduction and hasattr(final, "coef_"):
        coef = np.asarray(final.coef_, dtype=float)
        imp = np.mean(np.abs(coef), axis=0) if coef.ndim > 1 else np.abs(coef)
        if imp.shape[0] == n_feat:
            return _normalize(imp, n_feat, feature_names)

    # Fallback: permutation importance on the full pipeline (works with PCA too).
    if permutation_importance is not None:
        try:
            r = permutation_importance(pipeline, X_test, y_test, n_repeats=4, random_state=42, scoring=("r2" if task == "regression" else "accuracy"), n_jobs=-1)
            return _normalize(np.asarray(r.importances_mean, dtype=float), n_feat, feature_names)
        except Exception:
            pass

    return _normalize(np.random.default_rng(7).random(n_feat), n_feat, feature_names)


def _normalize(imp: np.ndarray, n_feat: int, feature_names: List[str]) -> np.ndarray:
    imp = np.abs(imp).astype(float)
    s = imp.sum()
    imp = imp / s if s > 0 else imp
    # Pad/trim defensively so the lengths line up with feature_names.
    if imp.shape[0] < n_feat:
        imp = np.pad(imp, (0, n_feat - imp.shape[0]))
    return imp[:n_feat]
