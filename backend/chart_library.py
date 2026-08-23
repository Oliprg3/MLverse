"""
chart_library.py
================

Every figure the instant engine can produce, plus the machinery that decides
*which* of them to produce.

Design rules
------------
* **Nothing is computed unless the user ticked it.** The Visualization nodes on
  the canvas carry a comma-separated ``charts`` param; :func:`resolve_requested`
  unions those selections and that list is all this module builds. A graph with
  no chart-selecting node falls back to :data:`DEFAULT_CHARTS`.
* **One bad chart never kills a run.** Each builder is invoked through
  :func:`build_charts`, which converts a failure (or an unmet requirement such as
  "needs a KNN model") into a ``charts_skipped`` entry the UI explains.
* **Selectable scatters carry sample indices.** Any trace whose points map to
  test rows sets ``customdata = [[test_index, true, pred, confidence], …]`` so
  the frontend can cross-filter the predictions table from a click or lasso.

Figures are raw ``fig.to_dict()``-shaped dicts (no plotly dependency needed).
"""

from __future__ import annotations

import warnings
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

import numpy as np

from chart_theme import (
    ACCENT,
    BAD,
    BLUE_SCALE,
    DIVERGING_SCALE,
    FONT,
    GOOD,
    GRID,
    MUTED,
    PALETTE,
    PLOT_BG,
    axis,
    base_layout,
    color_for,
    empty_figure,
    line,
    scene_axis,
)

warnings.filterwarnings("ignore")

from sklearn.base import clone
from sklearn.decomposition import PCA
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    confusion_matrix,
    precision_recall_curve,
    precision_recall_fscore_support,
    roc_auc_score,
    roc_curve,
)
from sklearn.neighbors import KNeighborsClassifier, NearestNeighbors


# ── Catalog (mirrors src/lib/chartCatalog.ts — keep the two in sync) ─────────
CHART_ORDER: List[str] = [
    "confusion_matrix",
    "roc_curve",
    "pr_curve",
    "feature_importance",
    "per_class_metrics",
    "threshold_curve",
    "scatter_2d",
    "scatter_3d",
    "splom",
    "decision_boundary",
    "embedding",
    "confidence_scatter",
    "knn_k_sweep",
    "knn_boundary",
    "knn_neighbor_graph",
    "knn_distance_hist",
    "knn_vote_scatter",
    "learning_curve",
    "cv_scores",
    "calibration",
    "class_balance",
    "correlation",
]

CHART_LABELS: Dict[str, str] = {
    "confusion_matrix": "confusion matrix",
    "roc_curve": "ROC curve",
    "pr_curve": "precision-recall curve",
    "feature_importance": "feature importance",
    "per_class_metrics": "per-class metrics",
    "threshold_curve": "threshold sweep",
    "scatter_2d": "2D scatter",
    "scatter_3d": "3D scatter",
    "splom": "scatter matrix",
    "decision_boundary": "decision boundary",
    "embedding": "t-SNE embedding",
    "confidence_scatter": "confidence / margin scatter",
    "knn_k_sweep": "k sweep",
    "knn_boundary": "KNN decision regions",
    "knn_neighbor_graph": "neighbour link graph",
    "knn_distance_hist": "neighbour distance histogram",
    "knn_vote_scatter": "vote share scatter",
    "learning_curve": "learning curve",
    "cv_scores": "cross-validation spread",
    "calibration": "calibration curve",
    "class_balance": "class balance",
    "correlation": "feature correlation",
}

#: What the app produced before charts became selectable.
DEFAULT_CHARTS: List[str] = ["confusion_matrix", "roc_curve", "pr_curve", "feature_importance"]

_ORDER_INDEX = {key: i for i, key in enumerate(CHART_ORDER)}


class ChartUnavailable(Exception):
    """Raised by a builder when the run cannot support that figure."""


def resolve_requested(nodes: Sequence[Dict[str, Any]]) -> List[str]:
    """Union every visualization node's ``charts`` selection, in catalog order."""
    keys: set[str] = set()
    saw_selector = False
    for node in nodes:
        params = node.get("params") or {}
        if "charts" not in params:
            continue
        saw_selector = True
        raw = params.get("charts")
        if not isinstance(raw, str):
            continue
        for token in raw.split(","):
            token = token.strip()
            if token in _ORDER_INDEX:
                keys.add(token)
    if not saw_selector:
        return list(DEFAULT_CHARTS)
    return sorted(keys, key=lambda k: _ORDER_INDEX.get(k, 999))


def viz_params(nodes: Sequence[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """Collect the parameter bag of each Visualization node, keyed by node type."""
    out: Dict[str, Dict[str, Any]] = {}
    for node in nodes:
        if str(node.get("type", "")).startswith("viz:"):
            out[str(node["type"])] = dict(node.get("params") or {})
    return out


# ── Execution context handed to every builder ───────────────────────────────
@dataclass
class ChartContext:
    """Everything a figure builder might need, computed once and shared."""

    pipeline: Any
    estimator: Any
    model_type: str
    model_name: str
    X: np.ndarray
    y: np.ndarray
    X_train: np.ndarray
    X_test: np.ndarray
    y_train: np.ndarray
    y_test: np.ndarray
    y_pred: np.ndarray
    scores: np.ndarray
    y_test_bin: np.ndarray
    classes: List[Any]
    class_names: List[str]
    feature_names: List[str]
    importances: np.ndarray
    params: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    /  # noqa: E999  (placeholder removed below)
