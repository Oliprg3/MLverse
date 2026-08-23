#!/usr/bin/env python3
"""
cli.py
======

Subprocess entry point for the Hybrid Execution Engine.

Next.js calls this directly (no long-running server required)::

    echo '<graph-json>' | python3 backend/cli.py execute
    python3 backend/cli.py execute --graph-file graph.json

It prints a single JSON object to stdout (the execution response) and
diagnostics to stderr. The ``health`` subcommand reports dependency
availability — handy for the Next.js side to decide whether to use the real
Python engine or a fallback.
"""

from __future__ import annotations

import argparse
import json
import sys

import router


def _read_stdin() -> str:
    return sys.stdin.read()


def cmd_execute(args: argparse.Namespace) -> int:
    if args.graph_file:
        with open(args.graph_file, "r", encoding="utf-8") as handle:
            graph_json = handle.read()
    else:
        graph_json = _read_stdin()

    payload = json.loads(graph_json) if graph_json.strip() else {"nodes": [], "edges": []}

    def emit(evt: dict) -> None:
        # Each event is one newline-delimited JSON object on stdout.
        sys.stdout.write(json.dumps(evt, default=str))
        sys.stdout.write("\n")
        sys.stdout.flush()

    try:
        router.dispatch(payload, emit=emit)
    except Exception as exc:  # pragma: no cover
        emit({"type": "result", "data": {
            "route": "instant", "status": "error", "engine": router.ENGINE_VERSION,
            "error": f"{type(exc).__name__}: {exc}",
        }})
        return 1
    return 0


def cmd_health(_args: argparse.Namespace) -> int:
    deps = {}
    for mod in ("sklearn", "xgboost", "lightgbm", "plotly", "nbformat", "networkx"):
        try:
            m = __import__(mod)
            deps[mod] = getattr(m, "__version__", "ok")
        except Exception:
            deps[mod] = "not installed"
    print(json.dumps({"status": "healthy", "engine": router.ENGINE_VERSION, "dependencies": deps}))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Hybrid ML Canvas execution engine (CLI).")
    sub = parser.add_subparsers(dest="command", required=True)

    p_exec = sub.add_parser("execute", help="Execute a canvas graph JSON.")
    p_exec.add_argument("--graph-file", help="Path to a graph JSON file. If omitted, reads stdin.")
    p_exec.set_defaults(func=cmd_execute)

    p_health = sub.add_parser("health", help="Report dependency availability.")
    p_health.set_defaults(func=cmd_health)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
