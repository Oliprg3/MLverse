# MLverse — No-Code AI/ML Canvas Platform

Build, train, and deploy machine-learning workflows visually. MLverse is a
node-based canvas where you connect data sources, cleaning steps, feature
transforms, models, and charts — no code required — then export the result as
a runnable Python notebook or a standalone app.

## Features

- **Visual workflow canvas** — drag-and-drop nodes (data upload, CSV parsing,
  cleaning, ML training, evaluation, charting) wired together with
  [React Flow](https://xyflow.com).
- **Hybrid execution engine** — three interchangeable runtimes with graceful
  fallback:
  - Native Python engine (FastAPI + scikit-learn) for full-fidelity training,
  - in-browser Pyodide worker for zero-setup runs,
  - built-in TypeScript engine when neither is available.
- **Data cleaning studio** — missing-value handling, type coercion, dedupe,
  outlier clipping, and more, applied non-destructively per node.
- **Interactive Plotly charts** — theme-aware, zoomable, PNG/SVG export.
- **Code generation** — export any pipeline to idiomatic Python /
  scikit-learn code or a Jupyter notebook (`nbformat`).
- **Project storage** — save/load canvases locally with versioned snapshots.

## Tech Stack

| Layer     | Tools                                                            |
| --------- | ---------------------------------------------------------------- |
| Frontend  | Next.js (App Router), React, Tailwind CSS v4, React Flow, Plotly |
| Backend   | FastAPI, scikit-learn (optional: XGBoost, LightGBM)              |
| In-browser| Pyodide worker                                                   |
| Storage   | LocalStorage + Drizzle ORM / PostgreSQL (optional)               |

## Getting Started

### Prerequisites

- Node.js ≥ 20
- Python ≥ 3.10 (optional — enables the native ML engine)

### Install & run

```bash
npm install
npm run dev        # http://localhost:3000
```

> The dev server works without Python; heavy training automatically falls
> back to the Pyodide/TypeScript engines.

### Optional: native Python engine

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

`npm run build` also best-effort installs the Python dependencies via
`scripts/setup-python.mjs`, so hosts like Render get the native engine for
free. If Python is unavailable the build still succeeds and the app uses its
fallback engines.

## Scripts

| Command            | Description                                    |
| ------------------ | ---------------------------------------------- |
| `npm run dev`      | Start the Next.js dev server                   |
| `npm run build`    | Production build + Python engine setup         |
| `npm start`        | Serve the production build                     |
| `npm run lint`     | ESLint                                         |
| `npm run typecheck`| TypeScript, no emit                            |

## Environment Variables

Copy `.env.example` or create `.env`:

```
OPENCODE_ZEN_API_KEY=<your-key>   # AI assistant features
DATABASE_URL=<postgres-url>       # optional, project sync
```

`.env` is gitignored — never commit real keys.

## Project Layout

```
src/
  app/            Next.js routes (landing, /canvas, /build, API routes)
  components/     canvas, dashboard, landing, sidebar, ui …
  lib/            engines, codegen, validation, serialization
  db/             Drizzle schema + client
backend/          FastAPI service: basic_ml_engine, router, notebook_builder
public/pyodide/   Browser-side execution worker
scripts/          setup-python.mjs (postbuild engine bootstrap)
```

## License

Private — all rights reserved.
