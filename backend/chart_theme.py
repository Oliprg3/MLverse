"""
chart_theme.py
==============

Shared Plotly styling primitives.

``basic_ml_engine`` (core evaluation figures) and ``chart_library`` (scatter /
KNN / diagnostic figures) both build raw ``fig.to_dict()``-shaped payloads, and
both must look identical inside the frontend's glass panels — so the palette and
the layout/axis/line helpers live here rather than being duplicated.
"""

from __future__ import annotations

from typing import Any, Dict, List

# ── Dark glassmorphism theme (matches the Next.js frontend) ──────────────────
ACCENT = "#38bdf8"
GRID = "rgba(148,163,184,0.14)"
PAPER = "rgba(8,12,24,0)"  # transparent so the glass panel shows through
PLOT_BG = "rgba(15,23,42,0.55)"
FONT = "#e2e8f0"
MUTED = "#94a3b8"

PALETTE = ["#38bdf8", "#a78bfa", "#f472b6", "#34d399", "#fbbf24", "#fb7185", "#22d3ee", "#c084fc"]

#: Sequential scale reused by heatmaps and density-style traces.
BLUE_SCALE = [[0, "#0b1220"], [0.25, "#0e3a5c"], [0.6, "#1d7fb8"], [1, "#7dd3fc"]]
#: Diverging scale for correlation (-1 → 0 → +1).
DIVERGING_SCALE = [[0, "#fb7185"], [0.5, "#0b1220"], [1, "#38bdf8"]]

GOOD = "#34d399"
BAD = "#fb7185"


def color_for(index: int) -> str:
    return PALETTE[index % len(PALETTE)]


def base_layout(title: str, **overrides: Any) -> Dict[str, Any]:
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


def axis(title: str, **overrides: Any) -> Dict[str, Any]:
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


def scene_axis(title: str) -> Dict[str, Any]:
    """Axis dict for 3D (``scene``) subplots — takes a different key set to 2D."""
    return {
        "title": {"text": title, "font": {"color": MUTED}},
        "gridcolor": GRID,
        "zerolinecolor": GRID,
        "backgroundcolor": PLOT_BG,
        "showbackground": True,
        "tickfont": {"color": MUTED, "size": 10},
    }


def line(
    x: List[float],
    y: List[float],
    name: str,
    color: str,
    dash: str = "solid",
    width: float = 2.0,
    showlegend: bool = True,
    mode: str = "lines",
    **extra: Any,
) -> Dict[str, Any]:
    trace: Dict[str, Any] = {
        "type": "scatter",
        "mode": mode,
        "x": x,
        "y": y,
        "name": name,
        "line": {"color": color, "width": width, "dash": dash, "shape": "linear"},
        "showlegend": showlegend,
        "hovertemplate": "%{x:.3f}, %{y:.3f}<extra>" + name + "</extra>",
    }
    trace.update(extra)
    return trace


def empty_figure(title: str, note: str) -> Dict[str, Any]:
    """A titled placeholder — used when a figure has nothing meaningful to draw."""
    return {
        "data": [],
        "layout": base_layout(
            title,
            xaxis=axis("", visible=False),
            yaxis=axis("", visible=False),
            annotations=[
                {
                    "text": note,
                    "x": 0.5,
                    "y": 0.5,
                    "xref": "paper",
                    "yref": "paper",
                    "showarrow": False,
                    "font": {"color": MUTED, "size": 13},
                }
            ],
        ),
    }
