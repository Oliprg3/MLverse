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
     * any deep-learning node  → ``deep_learning_engine`` (in-app PyTorch
       training on the local CPU/GPU); the Colab notebook exporter is only
       used when the caller explicitly opts in via ``meta.export_notebook``
     * only basic ML nodes     → ``basic_ml_engine`` (instant path)
5. Return a JSON-serialisable response.
"""

from __future__ import annotations

import importlib
import json
import math
import subprocess
import sys
from typing import Any, Dict, List

import networkx as nx

import basic_ml_engine
import notebook_builder

try:
    import deep_learning_engine
except Exception:  # torch missing / import error → auto-install + Colab fallback
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


def _torch_ready() -> bool:
    """True when the in-app PyTorch engine is importable and can train locally."""
    return deep_learning_engine is not None and deep_learning_engine.torch_available()


def _ensure_torch(emit: Any = None) -> bool:
    """Best-effort on-demand PyTorch install.

    Called once per process the first time a deep-learning graph is run without
    torch. Sends a couple of self-explanatory events (so the live console shows
    what is happening) and returns True the moment torch imports. Never raises.
    """
    global deep_learning_engine
    if _torch_ready():
        return True

    _say = emit if callable(emit) else (lambda e: None)
    _say({"type": "step", "message": "PyTorch is not installed — attempting an automatic install (pip install torch). This can take a few minutes…"})
    try:
        # Capture pip output so it can't corrupt the NDJSON stream on stdout.
        completed = subprocess.run(
            [sys.executable, "-m", "pip", "install", "--quiet", "torch"],
            timeout=420,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except Exception as exc:
        _say({"type": "step", "message": f"Automatic PyTorch install could not start: {exc}."})
        return False
    if completed.returncode != 0:
        _say({"type": "step", "message": "Automatic PyTorch install failed — handing off to a Colab notebook instead."})
        return False

    # Torch is now importable; (re)load the deep-learning engine in this process.
    try:
        if deep_learning_engine is None:
            import deep_learning_engine as dle  # fresh import (torch present now)
        else:
            dle = importlib.reload(deep_learning_engine)
        deep_learning_engine = dle
    except Exception as exc:
        _say({"type": "step", "message": f"PyTorch installed but the training engine did not reload ({exc})."})
        return False

    ok = _torch_ready()
    _say({"type": "step", "message": "PyTorch installed and ready — training in-app." if ok else "PyTorch installed but the training engine is still unavailable."})
    return ok


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
            # Local PyTorch path: every deep-learning node type trains in-app
            # on the local CPU/GPU and streams live epoch events to the UI.
            if _torch_ready() and deep_learning_engine.can_train_locally(ordered_nodes):
                _emit({"type": "step", "message": "PyTorch found on this machine — training the neural network in-app (no Colab needed)…"})
                result = _jsonable(deep_learning_engine.execute(ordered_nodes, emit=_emit))
                _emit({"type": "result", "data": result})
                return result
            # PyTorch missing → try to install it automatically, then train in-app.
            if _ensure_torch(_emit) and deep_learning_engine is not None and deep_learning_engine.can_train_locally(ordered_nodes):
                _emit({"type": "step", "message": "Training the neural network in-app on the freshly installed PyTorch…"})
                result = _jsonable(deep_learning_engine.execute(ordered_nodes, emit=_emit))
                _emit({"type": "result", "data": result})
                return result
            # Explicit opt-in only: the caller asked for a notebook export.
            if (payload.get("meta") or {}).get("export_notebook"):
                _emit({"type": "step", "message": "Generating Jupyter notebook export…"})
                _, meta = notebook_builder.build_notebook(ordered_nodes)
                response: Dict[str, Any] = {"route": "colab", "status": "success", "engine": ENGINE_VERSION}
                response.update(meta)
                result = _jsonable(response)
                _emit({ "type": "result", "data": result})
                return result
            # Graceful fallback: PyTorch could not be obtained, so hand the user
            # a ready-made Colab notebook instead of a dead-end error.
            _emit({
                "type": "step",
                "message": "PyTorch could not be installed automatically — generating a ready-to-run Colab notebook instead.",
            })
            _, meta = notebook_builder.build_notebook(ordered_nodes)
            response = {"route": "colab", "status": "success", "engine": ENGINE_VERSION}
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
