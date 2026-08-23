"""
main.py
=======

FastAPI service for the Hybrid Execution Engine.

Endpoints
---------
* ``GET  /``         — service banner.
* ``GET  /health``   — liveness probe + dependency report.
* ``POST /execute``  — accepts the canvas graph (DAG) and routes execution to
                       either the instant Scikit-Learn/XGBoost engine or the
                       Google Colab notebook generator, returning Plotly JSON
                       or a notebook payload respectively.

Run locally::

    uvicorn main:app --reload --port 8000

The Next.js app talks to this service, or — when the Python service is not
reachable — falls back to invoking ``cli.py`` via a subprocess.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import router

app = FastAPI(
    title="Hybrid ML Canvas Engine",
    description="DAG-aware hybrid router: instant CPU ML or Google Colab GPU notebooks.",
    version=router.ENGINE_VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request schemas ──────────────────────────────────────────────────────────
class GraphNode(BaseModel):
    id: str
    type: str
    category: str
    label: str
    params: Optional[Dict[str, Any]] = None
    position: Optional[Dict[str, float]] = None


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str


class GraphPayload(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge] = []
    meta: Optional[Dict[str, Any]] = None


@app.get("/")
def root() -> Dict[str, str]:
    return {"service": "Hybrid ML Canvas Engine", "status": "online", "version": router.ENGINE_VERSION}


@app.get("/health")
def health() -> Dict[str, Any]:
    deps = {}
    for mod in ("sklearn", "xgboost", "lightgbm", "plotly", "nbformat", "networkx", "torch"):
        try:
            m = __import__(mod)
            deps[mod] = getattr(m, "__version__", "ok")
        except Exception:
            deps[mod] = "not installed"
    return {"status": "healthy", "engine": router.ENGINE_VERSION, "dependencies": deps}


@app.post("/execute")
def execute(payload: GraphPayload) -> Dict[str, Any]:
    """Parse the canvas DAG and execute via the hybrid router."""
    graph = {"nodes": [n.model_dump() for n in payload.nodes], "edges": [e.model_dump() for e in payload.edges], "meta": payload.meta}
    return router.dispatch(graph)
