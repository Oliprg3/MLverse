/**
 * codeGen.ts — turns the visual canvas into real, runnable Python code.
 *
 * The generated script reflects the actual nodes on the canvas — the chosen
 * dataset, the preprocessing chain, and the model with its full hyperparameter
 * set (i.e. the "model complexity"). Classic-ML graphs produce a scikit-learn
 * Pipeline script; deep-learning graphs produce a PyTorch training script.
 *
 * This is pure client-side logic so the "Code" panel works without executing.
 */
import type { GraphPayload, GraphNodePayload } from "./types";

export interface GeneratedCode {
  code: string;
  filename: string;
  language: "python" | "javascript";
}

const hasDeepLearning = (g: GraphPayload) => g.nodes.some((n) => n.category === "deep_learning");

const first = (g: GraphPayload, cat: string) => g.nodes.find((n) => n.category === cat);

/** Format a single param value as Python literal. */
function pyVal(v: string | number): string {
  if (v === "none" || v === "None") return "None";
  if (v === "true") return "True";
  if (v === "false") return "False";
  if (typeof v === "number") return String(v);
  const n = Number(v);
  if (!Number.isNaN(n) && v !== "") return String(n);
  return `"${v}"`;
}

function fmtParams(params?: Record<string, string | number>): string {
  if (!params) return "";
  return Object.entries(params)
    .map(([k, v]) => `${k}=${pyVal(v)}`)
    .join(", ");
}

interface ModelSpec {
  module: string;
  cls: string;
  extra?: string; // appended params, e.g. probability=True
}

const MODEL_SPECS: Record<string, ModelSpec> = {
  "ml:logistic": { module: "sklearn.linear_model", cls: "LogisticRegression" },
  "ml:ridge": { module: "sklearn.linear_model", cls: "RidgeClassifier" },
  "ml:sgd": { module: "sklearn.linear_model", cls: "SGDClassifier" },
  "ml:knn": { module: "sklearn.neighbors", cls: "KNeighborsClassifier" },
  "ml:naive_bayes": { module: "sklearn.naive_bayes", cls: "GaussianNB" },
  "ml:svm": { module: "sklearn.svm", cls: "SVC", extra: "probability=True" },
  "ml:decision_tree": { module: "sklearn.tree", cls: "DecisionTreeClassifier" },
  "ml:random_forest": { module: "sklearn.ensemble", cls: "RandomForestClassifier" },
  "ml:extra_trees": { module: "sklearn.ensemble", cls: "ExtraTreesClassifier" },
  "ml:gradient_boosting": { module: "sklearn.ensemble", cls: "GradientBoostingClassifier" },
  "ml:hist_gradient_boosting": { module: "sklearn.ensemble", cls: "HistGradientBoostingClassifier" },
  "ml:adaboost": { module: "sklearn.ensemble", cls: "AdaBoostClassifier" },
  "ml:xgboost": { module: "xgboost", cls: "XGBClassifier" },
  "ml:lightgbm": { module: "lightgbm", cls: "LGBMClassifier" },
  "ml:mlp_sklearn": { module: "sklearn.neural_network", cls: "MLPClassifier" },
  "ml:qda": { module: "sklearn.discriminant_analysis", cls: "QuadraticDiscriminantAnalysis" },
};

function dataCode(g: GraphPayload): string {
  const data = first(g, "data");
  const t = data?.type ?? "data:breast_cancer";
  if (t === "data:csv") {
    const target = data?.dataset?.targetColumn ?? "target";
    const csvText = data?.dataset?.csvText;
    return csvText
      ? [
        "# 1. Load the CSV uploaded in the canvas (materialized, no placeholder path)",
        "import io",
        "import pandas as pd",
        `df = pd.read_csv(io.StringIO(${JSON.stringify(csvText)}))`,
        `TARGET = ${JSON.stringify(target)}`,
        "if TARGET not in df.columns:",
        "    raise ValueError(f'Target column {TARGET!r} was not found. Available columns: {list(df.columns)}')",
        "X = df.drop(columns=[TARGET])",
        "y = df[TARGET]",
        "# Encode categorical features automatically and keep a numeric matrix",
        "X = pd.get_dummies(X).replace([float('inf'), float('-inf')], float('nan')).fillna(0)",
      ].join("\n")
      : [
        "# 1. Load a CSV in the canvas first",
        'raise ValueError("No CSV dataset is attached to this pipeline. Upload one in the canvas data node.")',
      ].join("\n");
  }
  if (t === "data:images") {
    const imageDataset = data?.imageDataset;
    return imageDataset
      ? [
        "# 1. Use the image vectors and labels imported into the canvas",
        "import numpy as np",
        `X = np.array(${JSON.stringify(imageDataset.vectors)}, dtype="float32") / 255.0`,
        `y = np.array(${JSON.stringify(imageDataset.labels)}, dtype="int64")`,
        `CLASS_NAMES = ${JSON.stringify(imageDataset.classNames)}`,
      ].join("\n")
      : [
        "# 1. Load an image dataset in the canvas first",
        'raise ValueError("No image dataset is attached to this pipeline. Upload images in the canvas data node.")',
      ].join("\n");
  }
  if (t === "data:synthetic") {
    const p = data?.params ?? {};
    const inf = Math.min(Number(p.n_features ?? 20), Math.max(2, Number(p.n_classes ?? 2) * 2));
    return [
      "from sklearn.datasets import make_classification",
      `X, y = make_classification(`,
      `    n_samples=${p.n_samples ?? 1200}, n_features=${p.n_features ?? 20},`,
      `    n_informative=${inf}, n_classes=${p.n_classes ?? 2},`,
      `    flip_y=0.02, random_state=42,`,
      `)`,
    ].join("\n");
  }
  const map: Record<string, string> = {
    "data:breast_cancer": "load_breast_cancer",
    "data:wine": "load_wine",
    "data:iris": "load_iris",
  };
  const fn = map[t] ?? "load_breast_cancer";
  return [`from sklearn.datasets import ${fn}`, "_data = " + fn + "()", "X, y = _data.data, _data.target"].join("\n");
}

function preprocessingCode(g: GraphPayload): { steps: string[]; imports: Set<string> } {
  const imports = new Set<string>();
  const steps: string[] = [];
  const node = (t: string) => g.nodes.find((n) => n.type === t);
  if (node("pre:impute")) {
    imports.add("from sklearn.impute import SimpleImputer");
    steps.push('steps.append(("impute", SimpleImputer(strategy="median")))');
  }
  if (node("pre:polynomial")) {
    imports.add("from sklearn.preprocessing import PolynomialFeatures");
    const d = node("pre:polynomial")?.params?.degree ?? 2;
    steps.push(`steps.append(("poly", PolynomialFeatures(degree=${d}, include_bias=False)))`);
  }
  if (node("pre:scaler")) {
    imports.add("from sklearn.preprocessing import StandardScaler");
    steps.push('steps.append(("scale", StandardScaler()))');
  }
  if (node("pre:minmax")) {
    imports.add("from sklearn.preprocessing import MinMaxScaler");
    steps.push('steps.append(("minmax", MinMaxScaler()))');
  }
  if (node("pre:pca")) {
    imports.add("from sklearn.decomposition import PCA");
    const c = node("pre:pca")?.params?.n_components ?? 0.95;
    steps.push(`steps.append(("pca", PCA(n_components=${pyVal(c)}, random_state=42)))`);
  }
  return { steps, imports };
}

function generateSklearn(g: GraphPayload): string {
  const modelNode = first(g, "classic_ml");
  const modelType = modelNode?.type ?? "ml:random_forest";
  const spec = MODEL_SPECS[modelType] ?? MODEL_SPECS["ml:random_forest"];
  const params = fmtParams(modelNode?.params);
  const paramStr = [params, spec.extra].filter(Boolean).join(", ");
  const testData = first(g, "data");
  const splitNode = g.nodes.find((n) => n.type === "pre:split");
  const testSize = Number(testData?.params?.test_size ?? splitNode?.params?.test_size ?? 0.2);

  const pre = preprocessingCode(g);
  const imports = new Set<string>([
    "import numpy as np",
    "from sklearn.model_selection import train_test_split",
    "from sklearn.pipeline import Pipeline",
    "from sklearn.metrics import accuracy_score, classification_report, confusion_matrix",
    `from ${spec.module} import ${spec.cls}`,
  ]);
  pre.imports.forEach((i) => imports.add(i));

  const header = [
    '"""',
    "Auto-generated by NeuralForge AI Canvas.",
    "Pipeline: " + g.nodes.map((n) => n.label).join(" -> "),
    "Install deps:  pip install scikit-learn pandas plotly",
    '"""',
    "RANDOM_STATE = 42",
    "",
  ].join("\n");

  const body = [
    dataCode(g),
    "",
    "# 2. Build the preprocessing + model pipeline",
    "steps = []",
    ...pre.steps,
    `steps.append(("model", ${spec.cls}(${paramStr})))`,
    "pipeline = Pipeline(steps)",
    "",
    "# 3. Train / test split",
    `X_train, X_test, y_train, y_test = train_test_split(`,
    `    X, y, test_size=${testSize}, stratify=y, random_state=RANDOM_STATE`,
    `)`,
    "",
    "# 4. Train",
    "pipeline.fit(X_train, y_train)",
    "y_pred = pipeline.predict(X_test)",
    'print("Accuracy:", accuracy_score(y_test, y_pred))',
    "print(classification_report(y_test, y_pred))",
    "",
    "# 5. Interactive charts (Plotly)",
    "import plotly.figure_factory as ff",
    "import plotly.graph_objects as go",
    'cm = confusion_matrix(y_test, y_pred)',
    'fig = ff.create_annotated_heatmap(cm, x=["pred 0","pred 1"], y=["true 0","true 1"], colorscale="Blues")',
    'fig.update_layout(title="Confusion Matrix")',
    'fig.show()',
  ].join("\n");

  return `${header}${[...imports].join("\n")}\n\n${body}\n`;
}

function generatePyTorch(g: GraphPayload): string {
  const dl = first(g, "deep_learning");
  const t = dl?.type ?? "dl:pytorch_mlp";
  const p = (k: string, d: number) => Number(dl?.params?.[k] ?? d);
  const epochs = p("epochs", 30);
  const batch = p("batch_size", 64);
  const lr = p("lr", 0.001);
  const opt = String(dl?.params?.optimizer ?? "adamw");

  const optLine =
    opt === "sgd"
      ? `opt = torch.optim.SGD(model.parameters(), lr=${lr}, momentum=0.9)`
      : opt === "adam"
        ? `opt = torch.optim.Adam(model.parameters(), lr=${lr})`
        : `opt = torch.optim.AdamW(model.parameters(), lr=${lr})`;

  const arch: Record<string, string> = {
    "dl:pytorch_mlp": `class Model(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(IN_DIM, 128), nn.BatchNorm1d(128), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(128, 64), nn.BatchNorm1d(64), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(64, N_CLASSES),
        )
    def forward(self, x):
        return self.net(x)
model = Model().to(DEVICE)`,
    "dl:tabular_transformer": `class Model(nn.Module):
    def __init__(self):
        super().__init__()
        d, h, L = ${p("embed_dim", 64)}, ${p("heads", 4)}, ${p("layers", 3)}
        self.embed = nn.Linear(1, d)
        self.cls = nn.Parameter(torch.randn(1, 1, d))
        layer = nn.TransformerEncoderLayer(d_model=d, nhead=h, batch_first=True, dim_feedforward=4*d)
        self.enc = nn.TransformerEncoder(layer, num_layers=L)
        self.head = nn.Linear(d, N_CLASSES)
    def forward(self, x):
        tok = self.embed(x.unsqueeze(-1))
        h = torch.cat([self.cls.expand(x.size(0), -1, -1), tok], dim=1)
        return self.head(self.enc(h)[:, 0])
model = Model().to(DEVICE)`,
    "dl:lstm": `class Model(nn.Module):
    def __init__(self):
        super().__init__()
        self.rnn = nn.LSTM(IN_DIM, ${p("hidden_size", 128)}, batch_first=True,
                           num_layers=${p("num_layers", 2)}, dropout=0.2)
        self.fc = nn.Linear(${p("hidden_size", 128)}, N_CLASSES)
    def forward(self, x):
        out, _ = self.rnn(x); return self.fc(out[:, -1])
model = Model().to(DEVICE)`,
    "dl:gru": `class Model(nn.Module):
    def __init__(self):
        super().__init__()
        self.rnn = nn.GRU(IN_DIM, ${p("hidden_size", 128)}, batch_first=True,
                          num_layers=${p("num_layers", 2)}, dropout=0.2)
        self.fc = nn.Linear(${p("hidden_size", 128)}, N_CLASSES)
    def forward(self, x):
        out, _ = self.rnn(x); return self.fc(out[:, -1])
model = Model().to(DEVICE)`,
  };

  const header = [
    '"""',
    "Auto-generated by NeuralForge AI Canvas (PyTorch training script).",
    `Architecture: ${dl?.label ?? "PyTorch model"}`,
    "Run on a GPU:  pip install torch scikit-learn matplotlib",
    '"""',
  ].join("\n");

  const core = arch[t] ?? arch["dl:pytorch_mlp"];

  const transformerNote =
    t === "dl:transformer"
      ? [
        "",
        "# NOTE: A Hugging Face Transformers fine-tune is generated in the Colab notebook.",
        "# This script trains a compact PyTorch classifier on tabular features instead.",
      ].join("\n")
      : "";

  const datasetCode = dataCode(g);
  return `${header}
import torch, torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
from sklearn.preprocessing import LabelEncoder
import matplotlib.pyplot as plt

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print("Using device:", DEVICE)
${transformerNote}

${datasetCode}
X = X.astype("float32")
y = LabelEncoder().fit_transform(y).astype("int64")
if len(X) != len(y) or len(X) < 4:
    raise ValueError("The dataset must contain at least four aligned feature and target rows.")
X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
m, s = X_tr.mean(0), X_tr.std(0) + 1e-6
X_tr, X_te = (X_tr - m) / s, (X_te - m) / s
IN_DIM = X.shape[1]; N_CLASSES = len(set(y.tolist()))
train_loader = DataLoader(TensorDataset(torch.from_numpy(X_tr), torch.from_numpy(y_tr)), batch_size=${batch}, shuffle=True)
test_loader  = DataLoader(TensorDataset(torch.from_numpy(X_te), torch.from_numpy(y_te)), batch_size=${batch})

# 2. Model
${core}
${optLine}
criterion = nn.CrossEntropyLoss()

# 3. Training loop
history = {"loss": [], "acc": []}
for epoch in range(1, ${epochs} + 1):
    model.train(); running = 0.0
    for xb, yb in train_loader:
        xb, yb = xb.to(DEVICE), yb.to(DEVICE)
        opt.zero_grad(); loss = criterion(model(xb), yb); loss.backward(); opt.step()
        running += loss.item() * xb.size(0)
    model.eval(); correct = 0
    with torch.no_grad():
        for xb, yb in test_loader:
            correct += (model(xb.to(DEVICE)).argmax(1) == yb.to(DEVICE)).sum().item()
    acc = correct / len(test_loader.dataset)
    history["loss"].append(running / len(train_loader.dataset)); history["acc"].append(acc)
    print("epoch {:03d}/{:03d}  loss={:.4f}  val_acc={:.4f}".format(epoch, epochs, history["loss"][-1], acc), flush=True)

# 4. Plot training curves
fig, ax = plt.subplots(1, 2, figsize=(11, 4))
ax[0].plot(history["loss"]); ax[0].set_title("Loss"); ax[1].plot(history["acc"]); ax[1].set_title("Val Accuracy")
plt.tight_layout(); plt.show()
`;
}

export function generateCode(g: GraphPayload): GeneratedCode {
  const colab = hasDeepLearning(g);
  return {
    code: colab ? generatePyTorch(g) : generateSklearn(g),
    filename: colab ? "neuralforge_pytorch_train.py" : "neuralforge_pipeline.py",
    language: "python",
  };
}

/** Escape a block of Python so it can live inside a JS template literal. */
function jsTemplateEscape(source: string): string {
  return source.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

/**
 * Generates a production-shaped Node.js (Express) inference microservice.
 * On first boot it trains the exact canvas pipeline through the local Python
 * runtime, persists `model.joblib` + `schema.json`, then serves POST /predict.
 */
export function generateNodeServer(g: GraphPayload): GeneratedCode {
  const filename = "neuralforge_service.mjs";
  const header = [
    "/**",
    " * Auto-generated by NeuralForge AI Canvas — inference microservice.",
    ` * Pipeline: ${g.nodes.map((n) => n.label).join(" -> ") || "(empty)"}`,
    " * Setup:    npm install express   ·   python -m pip install scikit-learn pandas joblib",
    " * Run:      node neuralforge_service.mjs",
    " */",
  ].join("\n");

  const modelNode = g.nodes.find((n) => n.category === "classic_ml");
  if (!modelNode) {
    return {
      language: "javascript",
      filename,
      code: `${header}\n\n// NOTE: A Node inference service needs a classic-ML model node on the canvas.\n// Deep-learning graphs should be served from their Colab/GPU training job instead.\n`,
    };
  }

  const spec = MODEL_SPECS[modelNode.type] ?? MODEL_SPECS["ml:random_forest"];
  const paramStr = [fmtParams(modelNode.params), spec.extra].filter(Boolean).join(", ");
  const target = g.nodes.find((n) => n.category === "data")?.dataset?.targetColumn ?? "target";
  const pre = preprocessingCode(g);
  const preStepsPy = ["steps = []", ...pre.steps].join("\n");

  // The training payload reuses the canvas dataset loader verbatim.
  const trainScript = [
    "import json, sys",
    "import joblib, pandas as pd",
    "from sklearn.model_selection import train_test_split",
    "from sklearn.pipeline import Pipeline",
    `from ${spec.module} import ${spec.cls}`,
    "",
    jsTemplateEscape(dataCode(g)),
    "",
    jsTemplateEscape(preStepsPy),
    `steps.append(("model", ${spec.cls}(${paramStr})))`,
    "pipeline = Pipeline(steps)",
    "pipeline.fit(X, y)",
    "",
    'feature_columns = [c for c in X.columns] if hasattr(X, "columns") else [f"feature_{i}" for i in range(X.shape[1])]',
    'joblib.dump(pipeline, "model.joblib")',
    'json.dump({"feature_columns": list(feature_columns), "target": ' + JSON.stringify(target) + ', "classes": sorted(set(map(str, y)))}, open("schema.json", "w"))',
    'print("model trained:", pipeline.__class__.__name__)',
  ].join("\n");

  const escapedTrain = jsTemplateEscape(trainScript);

  const predictBridge = [
    "import json, sys",
    "import joblib, pandas as pd",
    "",
    "row = json.load(sys.stdin)",
    "pipeline = joblib.load('model.joblib')",
    "frame = pd.DataFrame([row])",
    "frame = frame.reindex(columns=pipeline.feature_names_in_, fill_value=0)",
    "prediction = pipeline.predict(frame)[0]",
    "result = {'prediction': str(prediction)}",
    "try:",
    "    probabilities = pipeline.predict_proba(frame)[0]",
    "    result['probabilities'] = {str(c): round(float(p), 6) for c, p in zip(pipeline.classes_, probabilities)}",
    "except Exception:",
    "    pass",
    "print(json.dumps(result))",
  ].join("\n");
  const escapedPredict = jsTemplateEscape(predictBridge);

  const body = [
    header,
    "",
    "import { spawnSync } from \"node:child_process\";",
    "import { existsSync, readFileSync } from \"node:fs\";",
    "import express from \"express\";",
    "",
    "const PYTHON = process.platform === \"win32\" ? \"python\" : \"python3\";",
    "const PORT = process.env.PORT ?? 8080;",
    "",
    "// ── Train once at boot (skipped when model.joblib already exists) ─────────",
    "if (!existsSync(\"model.joblib\") || !existsSync(\"schema.json\")) {",
    "  console.log(\"[boot] training pipeline via\", PYTHON, \"…\");",
    "  const train = spawnSync(PYTHON, [\"-c\", `" + escapedTrain + "`], { stdio: \"inherit\", encoding: \"utf8\" });",
    "  if (train.status !== 0) {",
    "    console.error(\"[boot] training failed — fix the error above and restart.\");",
    "    process.exit(1);",
    "  }",
    "}",
    "",
    "const SCHEMA = JSON.parse(readFileSync(\"schema.json\", \"utf8\"));",
    "const app = express();",
    "app.use(express.json());",
    "",
    "/** Run one row through the trained sklearn pipeline. */",
    "function predict(row) {",
    "  const bridge = spawnSync(PYTHON, [\"-c\", `" + escapedPredict + "`], { input: JSON.stringify(row), encoding: \"utf8\" });",
    "  if (bridge.status !== 0) throw new Error(bridge.stderr.trim() || \"inference failed\");",
    "  return JSON.parse(bridge.stdout);",
    "}",
    "",
    "app.get(\"/health\", (_req, res) => res.json({ ok: true, features: SCHEMA.feature_columns.length, classes: SCHEMA.classes }));",
    "",
    "app.post(\"/predict\", (req, res) => {",
    "  try {",
    "    const row = {};",
    "    for (const column of SCHEMA.feature_columns) {",
    "      if (!(column in req.body)) return res.status(400).json({ error: `missing feature '${column}'` });",
    "      row[column] = req.body[column];",
    "    }",
    "    res.json({ ...predict(row), target: SCHEMA.target });",
    "  } catch (error) {",
    "    res.status(500).json({ error: error instanceof Error ? error.message : \"inference failed\" });",
    "  }",
    "});",
    "",
    "app.listen(PORT, () => console.log(`[ready] http://localhost:${PORT}  ·  POST /predict with ${SCHEMA.feature_columns.length} features`));",
    "",
  ].join("\n");

  return { language: "javascript", filename, code: body };
}

export type { GraphNodePayload };
