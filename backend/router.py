"""
router.py
=========

Framework-agnostic execution router shared by:

  * ``main.py`` — the FastAPI service.
  * ``cli.py``   — the subprocess entry point called from Next.js.

Responsibilities
----------------
1. Parse the canvas graph into a NetworkX ``DiGraph``.
2. Validate it is a DAG (raise on cycles).
3. Topologically order the nodes so preprocessing steps are sequenced.
4. Apply the Hybrid Execution Router rule:
     * any deep-learning node  → ``notebook_builder`` (Colab path)
     * only basic ML nodes      → ``basic_ml_engine`` (instant path)
5. Return a JSON-serialisable response.
"""

from __future__ import annotations

import json
import math
from typing import Any, Dict, List

import networkx as nx

import basic_ml_engine
import notebook_builder

try:
    import deep_learning_engine
except Exception:  # torch missing / import error → Colab path stays the default
    deep_learning_engine = None  # type: ignore

ENGINE_VERSION = "hybrid-v1.2.0"
COLAB_CATEGORY = "deep_learning"


def parse_dag(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Convert a graph payload into a topologically-ordered node list."""
    raw_nodes = payload.get("nodes", [])
    raw_edges = payload.get("edges", [])

    graph = nx.DiGraph()
    for node in raw_nodes:
        node_id = node.get("id")
        if node_id is None:
            continue
        graph.add_node(
            node_id,
            id=node_id,
            type=node.get("type", ""),
            category=node.get("category", ""),
            label=node.get("label", node.get("type", "")),
            # Coerce ``None`` (e.g. pydantic Optional defaults) to an empty dict.
            params=(node.get("params") or {}),
            # Custom CSV datasets are attached verbatim (may be large).
            dataset=node.get("dataset"),
            # Custom image datasets (grayscale vectors) are attached verbatim.
            imageDataset=node.get("imageDataset"),
        )

    for edge in raw_edges:
        src, tgt = edge.get("source"), edge.get("target")
        if src in graph and tgt in graph:
            graph.add_edge(src, tgt)

    if not nx.is_directed_acyclic_graph(graph):
        raise ValueError("Canvas graph contains a cycle — a pipeline must be acyclic.")

    ordered_ids = list(nx.topological_sort(graph))
    return [dict(graph.nodes[uid]) for uid in ordered_ids]


def resolve_route(ordered_nodes: List[Dict[str, Any]]) -> str:
    """'colab' if any advanced AI node is present, else 'instant'."""
    for node in ordered_nodes:
        if node.get("category") == COLAB_CATEGORY:
            return "colab"
    return "instant"


def _jsonable(value: Any) -> Any:
    """Recursively coerce numpy scalars / NaNs into JSON-safe primitives."""
    if isinstance(value, dict):
        return {k: _jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(v) for v in value]
    if isinstance(value, float) and math.isnan(value):
        return None
    try:
        # numpy scalar → python scalar
        return value.item()
    except AttributeError:
        return value


def dispatch(payload: Dict[str, Any], emit: Any = None) -> Dict[str, Any]:
    """Main entry: parse → route → execute → JSON-safe response.

    ``emit`` (optional) receives NDJSON event dicts for live streaming.
    """
    _emit = emit if callable(emit) else (lambda e: None)

    def _err(msg: str) -> Dict[str, Any]:
        return {
            "route": "instant",
            "status": "error",
            "engine": ENGINE_VERSION,
            "pipeline": {"steps": []},
            "dataset": {"name": "", "n_samples": 0, "n_features": 0, "n_classes": 0, "target_type": ""},
            "model": {"name": "", "framework": ""},
            "metrics": {},
            "charts": {},
            "predictions": {},
            "timing": {"total_seconds": 0, "training_seconds": 0},
            "error": msg,
        }

    try:
        ordered_nodes = parse_dag(payload)
        if not ordered_nodes:
            r = _err("The canvas is empty. Add data + model nodes first.")
            _emit({"type": "result", "data": r})
            return r

        route = resolve_route(ordered_nodes)
        if route == "colab":
            # Local PyTorch path: when torch is installed AND every DL node is one
            # the engine can train (MLP / CNN / LSTM / GRU / tabular transformer),
            # train in-app on the local CPU/GPU instead of handing off to Colab.
            if deep_learning_engine is not None and deep_learning_engine.can_train_locally(ordered_nodes):
                _emit({"type": "step", "message": "PyTorch found on this machine — training the neural network in-app (no Colab needed)…"})
                result = _jsonable(deep_learning_engine.execute(ordered_nodes, emit=_emit))
                _emit({"type": "result", "data": result})
                return result
            dl_types = sorted({n.get("type") for n in ordered_nodes if n.get("category") == COLAB_CATEGORY})
            _emit({
                "type": "step",
                "message": (
                    "Deep-learning graphs without a local PyTorch engine hand off to Colab. "
                    "Install it (pip install torch) to train these nodes in-app: " + ", ".join(dl_types)
                ),
            })
            _emit({"type": "step", "message": "Generating Google Colab notebook…"})
            _, meta = notebook_builder.build_notebook(ordered_nodes)
            response: Dict[str, Any] = {"route": "colab", "status": "success", "engine": ENGINE_VERSION}
            response.update(meta)
            result = _jsonable(response)
            _emit({"type": "result", "data": result})
            return result

        result = _jsonable(basic_ml_engine.execute(ordered_nodes, emit=_emit))
        _emit({"type": "result", "data": result})
        return result

    except ValueError as exc:
        r = _err(str(exc))
        _emit({"type": "result", "data": r})
        return r
    except Exception as exc:  # pragma: no cover
        r = _err(f"{type(exc).__name__}: {exc}")
        _emit({"type": "result", "data": r})
        return r


def dispatch_json(graph_json: str) -> str:
    """Convenience wrapper: graph JSON string → response JSON string."""
    payload = json.loads(graph_json) if graph_json.strip() else {"nodes": [], "edges": []}
    result = dispatch(payload)
    return json.dumps(result, allow_nan=False, default=str)
