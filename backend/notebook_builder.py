"""
notebook_builder.py
===================

The "Google Colab Path" exporter.

When the canvas graph contains advanced AI / deep-learning nodes this module
generates a complete, runnable ``.ipynb`` Jupyter notebook containing:

  * GPU / runtime checks (`torch.cuda.is_available()`).
  * Dependency installs (torch, transformers, datasets, accelerate, scikit-learn).
  * PyTorch `nn.Module` definitions and explicit training loops.
  * Hugging Face 🤗 Transformers `Trainer` fine-tuning (when a transformer node
    is present).
  * Standard matplotlib / seaborn evaluation snippets (training curves,
    confusion matrix) the user runs *inside* Colab.

It returns the notebook object plus metadata (filename, colab launch url,
requirements, recommended runtime) that the FastAPI layer forwards to the
frontend.

NOTE: code templates use plain strings + ``__TOKEN__`` placeholders (never
f-strings) so the literal braces/dicts/format-specs inside the generated Python
code are preserved verbatim.
"""

from __future__ import annotations

import json
import time
from typing import Any, Dict, List, Tuple

import nbformat as nbf

COLAB_URL = "https://colab.research.google.com/"


def _md(source: str) -> Dict[str, Any]:
    # Use nbformat constructors so each cell gets a stable `id` and is valid.
    return nbf.v4.new_markdown_cell(source)


def _code(source: str) -> Dict[str, Any]:
    return nbf.v4.new_code_cell(source)


def _fill(template: str, mapping: Dict[str, Any]) -> str:
    out = template
    for key, val in mapping.items():
        out = out.replace(f"__{key}__", str(val))
    return out


# ── Code template fragments ──────────────────────────────────────────────────
HEADER_MD = """# 🚀 AI Canvas — Generated Notebook
*Exported by the Hybrid Execution Engine. Run on a **GPU runtime** in Google Colab.*

This notebook was generated from your visual pipeline. It contains PyTorch /
Hugging Face training code, GPU checks, and matplotlib / seaborn evaluation
plots you can run step-by-step.

> **Runtime → Change runtime type → T4 GPU (free tier).**
"""

INSTALL_CODE = '''# ✅ 1. Environment setup — install dependencies and verify the GPU
import importlib, subprocess, sys

def _pip(pkg):
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", pkg])

for pkg in ["torch", "transformers", "datasets", "accelerate", "scikit-learn", "seaborn", "matplotlib", "pandas"]:
    try:
        importlib.import_module(pkg.replace("-", "_").split(".")[0])
    except Exception:
        _pip(pkg)

import torch
print("🔥 PyTorch version:", torch.__version__)
print("⚡ CUDA available:", torch.cuda.is_available())
if torch.cuda.is_available():
    print("🖥️  GPU:", torch.cuda.get_device_name(0))
else:
    print("⚠️  No GPU detected. Switch to a GPU runtime: Runtime ▸ Change runtime type ▸ T4 GPU")
'''

COMMON_IMPORTS_CODE = '''# ✅ 2. Shared imports
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split
from sklearn.metrics import (accuracy_score, confusion_matrix,
                             classification_report, roc_auc_score)

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

sns.set_theme(style="whitegrid")
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print("Using device:", DEVICE)
'''

MODEL_EXPORT_CODE = '''# ✅ 6. Export trained model artifacts
# Save native PyTorch weights, TorchScript, and a portable ONNX graph.
model.eval()
example_input = next(iter(test_loader))[0][:1].to(DEVICE)
torch.save({"state_dict": model.state_dict(), "classes": globals().get("N_CLASS", None)}, "neuralforge_model.pth")
traced = torch.jit.trace(model, example_input)
traced.save("neuralforge_model.ts")
torch.onnx.export(
    model,
    example_input,
    "neuralforge_model.onnx",
    input_names=["features"],
    output_names=["logits"],
    dynamic_axes={"features": {0: "batch"}, "logits": {0: "batch"}},
    opset_version=17,
)
print("Saved neuralforge_model.pth, neuralforge_model.ts, and neuralforge_model.onnx")
'''

_MLP_MD = "## 🧠 PyTorch MLP — Multi-Layer Perceptron\nTrain a fully-connected classifier with an explicit training loop."
_MLP_DATA = '''# ✅ 3. Data
data = load_breast_cancer()
X, y = data.data.astype("float32"), data.target.astype("int64")
X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
mean, std = X_tr.mean(0), X_tr.std(0) + 1e-6
X_tr, X_te = (X_tr - mean) / std, (X_te - mean) / std

train_ds = TensorDataset(torch.from_numpy(X_tr), torch.from_numpy(y_tr))
test_ds  = TensorDataset(torch.from_numpy(X_te), torch.from_numpy(y_te))
train_loader = DataLoader(train_ds, batch_size=__BATCH__, shuffle=True)
test_loader  = DataLoader(test_ds, batch_size=__BATCH__)

# ✅ 4. Model
class MLP(nn.Module):
    def __init__(self, in_dim, n_classes):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_dim, 128), nn.BatchNorm1d(128), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(128, 64), nn.BatchNorm1d(64), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(64, n_classes),
        )
    def forward(self, x):
        return self.net(x)

model = MLP(X.shape[1], len(set(y))).to(DEVICE)
opt = torch.optim.AdamW(model.parameters(), lr=__LR__)
crit = nn.CrossEntropyLoss()
print(model)
'''
_MLP_LOOP = '''# ✅ 5. Training loop
EPOCHS = __EPOCHS__
history = {"train_loss": [], "val_acc": []}
for epoch in range(1, EPOCHS + 1):
    model.train(); running = 0.0
    for xb, yb in train_loader:
        xb, yb = xb.to(DEVICE), yb.to(DEVICE)
        opt.zero_grad()
        loss = crit(model(xb), yb)
        loss.backward(); opt.step()
        running += loss.item() * xb.size(0)
    train_loss = running / len(train_loader.dataset)

    model.eval(); correct = 0
    with torch.no_grad():
        for xb, yb in test_loader:
            xb, yb = xb.to(DEVICE), yb.to(DEVICE)
            correct += (model(xb).argmax(1) == yb).sum().item()
    val_acc = correct / len(test_loader.dataset)
    history["train_loss"].append(train_loss)
    history["val_acc"].append(val_acc)
    if epoch % 5 == 0 or epoch == 1:
        print("epoch {:03d}  loss={:.4f}  val_acc={:.4f}".format(epoch, train_loss, val_acc))
'''


def _pytorch_mlp_section(params: Dict[str, Any]) -> List[Dict[str, Any]]:
    mapping = {
        "BATCH": int(params.get("batch_size", 64)),
        "LR": float(params.get("lr", 0.001)),
        "EPOCHS": int(params.get("epochs", 30)),
    }
    return [_md(_MLP_MD), _code(_fill(_MLP_DATA, mapping)), _code(_fill(_MLP_LOOP, mapping))]


_TXF_MD = "## 🤗 Hugging Face Transformer — Sequence Classification\nFine-tune a pre-trained Transformer with the 🤗 `Trainer` API."
_TXF_DATA = '''# ✅ 3. Load a 🤗 dataset (swap for your own data)
from datasets import load_dataset
from transformers import (AutoTokenizer, AutoModelForSequenceClassification,
                          TrainingArguments, Trainer, DataCollatorWithPadding)

raw = load_dataset("imdb", split={"train": "train[:2000]", "test": "test[:500]"})
MODEL_NAME = "__MODEL_NAME__"
NUM_LABELS = 2
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

def tok(batch):
    return tokenizer(batch["text"], truncation=True, max_length=256)

raw = raw.map(tok, batched=True)
data_collator = DataCollatorWithPadding(tokenizer=tokenizer)
'''
_TXF_TRAIN = '''# ✅ 4. Model + Trainer
model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME, num_labels=NUM_LABELS)

args = TrainingArguments(
    output_dir="./bert-out",
    num_train_epochs=__EPOCHS__,
    per_device_train_batch_size=__BATCH__,
    per_device_eval_batch_size=__BATCH__,
    learning_rate=2e-5,
    weight_decay=0.01,
    evaluation_strategy="epoch",
    save_strategy="epoch",
    load_best_model_at_end=True,
    fp16=torch.cuda.is_available(),
    report_to=[],
)

trainer = Trainer(
    model=model, args=args,
    train_dataset=raw["train"], eval_dataset=raw["test"],
    tokenizer=tokenizer, data_collator=data_collator,
)
trainer.train()
'''


def _transformer_section(params: Dict[str, Any]) -> List[Dict[str, Any]]:
    mapping = {
        "MODEL_NAME": str(params.get("model_name", "bert-base-uncased")),
        "EPOCHS": int(params.get("epochs", 3)),
        "BATCH": int(params.get("batch_size", 16)),
    }
    return [_md(_TXF_MD), _code(_fill(_TXF_DATA, mapping)), _code(_fill(_TXF_TRAIN, mapping))]


_CNN_MD = "## 🖼️ CNN — Convolutional Image Classifier (ResNet-style)\nA compact residual CNN trained on image tensors."
_CNN_DATA = '''# ✅ 3. Synthetic image data (replace with torchvision.datasets)
def make_images(n=2048, size=32, n_classes=5):
    X = torch.rand(n, 3, size, size)
    y = torch.randint(0, n_classes, (n,))
    return X, y

X, y = make_images()
flat = X.numpy().transpose(0, 2, 3, 1).reshape(len(X), -1)
X_tr, X_te, y_tr, y_te = train_test_split(flat, y.numpy(), test_size=0.2, random_state=42)
X_tr = torch.from_numpy(X_tr).float().reshape(-1, 3, 32, 32)
X_te = torch.from_numpy(X_te).float().reshape(-1, 3, 32, 32)
train_loader = DataLoader(TensorDataset(X_tr, torch.from_numpy(y_tr).long()), batch_size=__BATCH__, shuffle=True)
test_loader  = DataLoader(TensorDataset(X_te, torch.from_numpy(y_te).long()), batch_size=__BATCH__)

class ResBlock(nn.Module):
    def __init__(self, c):
        super().__init__()
        self.net = nn.Sequential(nn.Conv2d(c, c, 3, padding=1), nn.BatchNorm2d(c),
                                 nn.ReLU(), nn.Conv2d(c, c, 3, padding=1), nn.BatchNorm2d(c))
    def forward(self, x):
        return torch.relu(self.net(x) + x)

class SimpleResNet(nn.Module):
    def __init__(self, n_classes=5):
        super().__init__()
        self.stem = nn.Sequential(nn.Conv2d(3, 32, 3, padding=1), nn.BatchNorm2d(32), nn.ReLU())
        self.body = nn.Sequential(ResBlock(32), nn.MaxPool2d(2), ResBlock(32), nn.AdaptiveAvgPool2d(1))
        self.head = nn.Linear(32, n_classes)
    def forward(self, x):
        return self.head(self.body(self.stem(x)).flatten(1))

model = SimpleResNet().to(DEVICE)
opt = torch.optim.AdamW(model.parameters(), lr=1e-3)
crit = nn.CrossEntropyLoss()
'''
_CNN_LOOP = '''# ✅ 4. Training loop
for epoch in range(1, __EPOCHS__ + 1):
    model.train()
    for xb, yb in train_loader:
        xb, yb = xb.to(DEVICE), yb.to(DEVICE)
        opt.zero_grad(); crit(model(xb), yb).backward(); opt.step()
    model.eval(); correct = 0
    with torch.no_grad():
        for xb, yb in test_loader:
            correct += (model(xb.to(DEVICE)).argmax(1) == yb.to(DEVICE)).sum().item()
    if epoch % 2 == 0:
        print("epoch {:03d}  val_acc={:.4f}".format(epoch, correct / len(test_loader.dataset)))
'''


def _cnn_section(params: Dict[str, Any]) -> List[Dict[str, Any]]:
    mapping = {"EPOCHS": int(params.get("epochs", 20)), "BATCH": int(params.get("batch_size", 32))}
    return [_md(_CNN_MD), _code(_fill(_CNN_DATA, mapping)), _code(_fill(_CNN_LOOP, mapping))]


_LSTM_MD = "## 🔁 LSTM — Recurrent Sequence Classifier\nAn LSTM over sequence features with a custom training loop."
_LSTM_DATA = '''# ✅ 3. Synthetic sequences (replace with your time-series / token data)
n, seq_len, n_feat, n_classes = 2048, 16, 8, 3
X = torch.rand(n, seq_len, n_feat)
y = torch.randint(0, n_classes, (n,))
X_tr, X_te, y_tr, y_te = train_test_split(X.numpy(), y.numpy(), test_size=0.2, random_state=42)
train_loader = DataLoader(TensorDataset(torch.from_numpy(X_tr).float(), torch.from_numpy(y_tr).long()), batch_size=64, shuffle=True)
test_loader  = DataLoader(TensorDataset(torch.from_numpy(X_te).float(), torch.from_numpy(y_te).long()), batch_size=64)

class LSTMClf(nn.Module):
    def __init__(self, in_dim, hidden, n_classes):
        super().__init__()
        self.lstm = nn.LSTM(in_dim, hidden, batch_first=True, num_layers=2, dropout=0.2)
        self.fc = nn.Linear(hidden, n_classes)
    def forward(self, x):
        out, _ = self.lstm(x)
        return self.fc(out[:, -1])

model = LSTMClf(n_feat, __HIDDEN__, n_classes).to(DEVICE)
opt = torch.optim.AdamW(model.parameters(), lr=1e-3)
crit = nn.CrossEntropyLoss()
'''
_LSTM_LOOP = '''# ✅ 4. Training loop
for epoch in range(1, __EPOCHS__ + 1):
    model.train()
    for xb, yb in train_loader:
        xb, yb = xb.to(DEVICE), yb.to(DEVICE)
        opt.zero_grad(); crit(model(xb), yb).backward(); opt.step()
    model.eval(); correct = 0
    with torch.no_grad():
        for xb, yb in test_loader:
            correct += (model(xb.to(DEVICE)).argmax(1) == yb.to(DEVICE)).sum().item()
    if epoch % 5 == 0:
        print("epoch {:03d}  val_acc={:.4f}".format(epoch, correct / len(test_loader.dataset)))
'''


def _lstm_section(params: Dict[str, Any]) -> List[Dict[str, Any]]:
    mapping = {"EPOCHS": int(params.get("epochs", 25)), "HIDDEN": int(params.get("hidden_size", 128))}
    return [_md(_LSTM_MD), _code(_fill(_LSTM_DATA, mapping)), _code(_fill(_LSTM_LOOP, mapping))]


_GRU_MD = "## 🔁 GRU — Gated Recurrent Classifier\nA GRU over sequence features with a custom training loop."
_GRU_DATA = '''# ✅ 3. Synthetic sequences (replace with your own data)
n, seq_len, n_feat, n_classes = 2048, 16, 8, 3
X = torch.rand(n, seq_len, n_feat)
y = torch.randint(0, n_classes, (n,))
X_tr, X_te, y_tr, y_te = train_test_split(X.numpy(), y.numpy(), test_size=0.2, random_state=42)
train_loader = DataLoader(TensorDataset(torch.from_numpy(X_tr).float(), torch.from_numpy(y_tr).long()), batch_size=64, shuffle=True)
test_loader  = DataLoader(TensorDataset(torch.from_numpy(X_te).float(), torch.from_numpy(y_te).long()), batch_size=64)

class GRUClf(nn.Module):
    def __init__(self, in_dim, hidden, n_classes, layers=__NUM_LAYERS__):
        super().__init__()
        self.gru = nn.GRU(in_dim, hidden, batch_first=True, num_layers=layers, dropout=0.2)
        self.fc = nn.Linear(hidden, n_classes)
    def forward(self, x):
        out, _ = self.gru(x); return self.fc(out[:, -1])

model = GRUClf(n_feat, __HIDDEN__, n_classes).to(DEVICE)
opt = torch.optim.AdamW(model.parameters(), lr=1e-3); crit = nn.CrossEntropyLoss()
'''
_GRU_LOOP = '''# ✅ 4. Training loop
for epoch in range(1, __EPOCHS__ + 1):
    model.train()
    for xb, yb in train_loader:
        xb, yb = xb.to(DEVICE), yb.to(DEVICE)
        opt.zero_grad(); crit(model(xb), yb).backward(); opt.step()
    model.eval(); correct = 0
    with torch.no_grad():
        for xb, yb in test_loader:
            correct += (model(xb.to(DEVICE)).argmax(1) == yb.to(DEVICE)).sum().item()
    if epoch % 5 == 0:
        print("epoch {:03d}  val_acc={:.4f}".format(epoch, correct / len(test_loader.dataset)))
'''


def _gru_section(params: Dict[str, Any]) -> List[Dict[str, Any]]:
    return [
        _md(_GRU_MD),
        _code(_fill(_GRU_DATA, {"HIDDEN": int(params.get("hidden_size", 128)), "NUM_LAYERS": int(params.get("num_layers", 2))})),
        _code(_fill(_GRU_LOOP, {"EPOCHS": int(params.get("epochs", 25))})),
    ]


_AE_MD = "## 🔩 Autoencoder — Unsupervised Representation Learning\nTrain an encoder/decoder; the latent code can feed a downstream classifier."
_AE_DATA = '''# ✅ 3. Data (tabular features)
data = load_breast_cancer()
X = torch.from_numpy(data.data.astype("float32"))
mean, std = X.mean(0), X.std(0) + 1e-6
X = (X - mean) / std
ds = TensorDataset(X)
loader = DataLoader(ds, batch_size=64, shuffle=True)

class Autoencoder(nn.Module):
    def __init__(self, dim, latent):
        super().__init__()
        self.enc = nn.Sequential(nn.Linear(dim, 64), nn.ReLU(), nn.Linear(64, latent))
        self.dec = nn.Sequential(nn.Linear(latent, 64), nn.ReLU(), nn.Linear(64, dim))
    def forward(self, x):
        return self.dec(self.enc(x)), self.enc(x)

model = Autoencoder(X.shape[1], __LATENT__).to(DEVICE)
opt = torch.optim.AdamW(model.parameters(), lr=__LR__); crit = nn.MSELoss()
'''
_AE_LOOP = '''# ✅ 4. Training loop
for epoch in range(1, __EPOCHS__ + 1):
    model.train(); run = 0.0
    for (xb,) in loader:
        xb = xb.to(DEVICE); opt.zero_grad()
        recon = model(xb)[0]; loss = crit(recon, xb)
        loss.backward(); opt.step(); run += loss.item() * xb.size(0)
    if epoch % 5 == 0:
        print("epoch {:03d}  recon_loss={:.4f}".format(epoch, run / len(ds)))
'''


def _autoencoder_section(params: Dict[str, Any]) -> List[Dict[str, Any]]:
    return [
        _md(_AE_MD),
        _code(_fill(_AE_DATA, {"LATENT": int(params.get("latent_dim", 32)), "LR": float(params.get("lr", 0.001))})),
        _code(_fill(_AE_LOOP, {"EPOCHS": int(params.get("epochs", 30))})),
    ]


_GAN_MD = "## ✨ GAN — Generative Adversarial Network\nTrain a generator/discriminator to synthesize tabular samples."
_GAN_DATA = '''# ✅ 3. Data + networks
data = load_breast_cancer()
real = ((data.data - data.data.mean(0)) / (data.data.std(0) + 1e-6)).astype("float32")
real = torch.from_numpy(real).to(DEVICE)
DIM = real.shape[1]; LATENT = __LATENT__; BATCH = 64
G = nn.Sequential(nn.Linear(LATENT, 64), nn.ReLU(), nn.Linear(64, DIM)).to(DEVICE)
D = nn.Sequential(nn.Linear(DIM, 64), nn.ReLU(), nn.Linear(64, 1), nn.Sigmoid()).to(DEVICE)
optG = torch.optim.AdamW(G.parameters(), lr=__LR__, betas=(0.5, 0.999))
optD = torch.optim.AdamW(D.parameters(), lr=__LR__, betas=(0.5, 0.999))
crit = nn.BCELoss()
'''
_GAN_LOOP = '''# ✅ 4. Training loop
for epoch in range(1, __EPOCHS__ + 1):
    idx = torch.randint(0, len(real), (BATCH,)); xr = real[idx]
    z = torch.randn(BATCH, LATENT, device=DEVICE); xf = G(z)
    optD.zero_grad()
    d_loss = crit(D(xr), torch.ones(BATCH, 1)) + crit(D(xf.detach()), torch.zeros(BATCH, 1))
    d_loss.backward(); optD.step()
    optG.zero_grad(); g_loss = crit(D(xf), torch.ones(BATCH, 1))
    g_loss.backward(); optG.step()
    if epoch % 200 == 0:
        print("epoch {:04d}  D={:.3f}  G={:.3f}".format(epoch, d_loss.item(), g_loss.item()))
'''


def _gan_section(params: Dict[str, Any]) -> List[Dict[str, Any]]:
    return [
        _md(_GAN_MD),
        _code(_fill(_GAN_DATA, {"LATENT": int(params.get("latent_dim", 100)), "LR": float(params.get("lr", 0.0002))})),
        _code(_fill(_GAN_LOOP, {"EPOCHS": int(params.get("epochs", 50))})),
    ]


_TT_MD = "## 🧮 Tabular Transformer — Feature-tokenizing attention\nEach feature is embedded as a token; a transformer encoder classifies via a [CLS] token."
_TT_DATA = '''# ✅ 3. Data
data = load_breast_cancer()
X, y = data.data.astype("float32"), data.target.astype("int64")
X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
mean, std = X_tr.mean(0), X_tr.std(0) + 1e-6
X_tr, X_te = (X_tr - mean) / std, (X_te - mean) / std
train_loader = DataLoader(TensorDataset(torch.from_numpy(X_tr), torch.from_numpy(y_tr)), batch_size=64, shuffle=True)
test_loader  = DataLoader(TensorDataset(torch.from_numpy(X_te), torch.from_numpy(y_te)), batch_size=64)
N_FEAT = X.shape[1]; N_CLASS = len(set(y.tolist()))

class FTTransformer(nn.Module):
    def __init__(self, n_feat, d, heads, layers, n_class):
        super().__init__()
        self.embed = nn.Linear(1, d)
        self.cls = nn.Parameter(torch.randn(1, 1, d))
        layer = nn.TransformerEncoderLayer(d_model=d, nhead=heads, batch_first=True, dim_feedforward=4*d, dropout=0.1)
        self.tr = nn.TransformerEncoder(layer, num_layers=layers)
        self.head = nn.Linear(d, n_class)
    def forward(self, x):
        tokens = self.embed(x.unsqueeze(-1))
        h = torch.cat([self.cls.expand(x.size(0), -1, -1), tokens], dim=1)
        return self.head(self.tr(h)[:, 0])

model = FTTransformer(N_FEAT, __EMBED__, __HEADS__, __LAYERS__, N_CLASS).to(DEVICE)
opt = torch.optim.AdamW(model.parameters(), lr=1e-3); crit = nn.CrossEntropyLoss()
'''
_TT_LOOP = '''# ✅ 4. Training loop
for epoch in range(1, __EPOCHS__ + 1):
    model.train()
    for xb, yb in train_loader:
        xb, yb = xb.to(DEVICE), yb.to(DEVICE)
        opt.zero_grad(); crit(model(xb), yb).backward(); opt.step()
    model.eval(); correct = 0
    with torch.no_grad():
        for xb, yb in test_loader:
            correct += (model(xb.to(DEVICE)).argmax(1) == yb.to(DEVICE)).sum().item()
    if epoch % 5 == 0:
        print("epoch {:03d}  val_acc={:.4f}".format(epoch, correct / len(test_loader.dataset)))
'''


def _tabular_transformer_section(params: Dict[str, Any]) -> List[Dict[str, Any]]:
    return [
        _md(_TT_MD),
        _code(_fill(_TT_DATA, {"EMBED": int(params.get("embed_dim", 64)), "HEADS": int(params.get("heads", 4)), "LAYERS": int(params.get("layers", 3))})),
        _code(_fill(_TT_LOOP, {"EPOCHS": int(params.get("epochs", 30))})),
    ]


SECTION_BUILDERS = {
    "dl:pytorch_mlp": _pytorch_mlp_section,
    "dl:transformer": _transformer_section,
    "dl:cnn": _cnn_section,
    "dl:lstm": _lstm_section,
    "dl:gru": _gru_section,
    "dl:autoencoder": _autoencoder_section,
    "dl:gan": _gan_section,
    "dl:tabular_transformer": _tabular_transformer_section,
}


_EVAL_MD = "## 📊 Evaluation & Plots (matplotlib / seaborn)\nGenerate standard charts from the trained model."
_EVAL_PRED = '''# ✅ Collect predictions
model.eval()
all_pred, all_true = [], []
with torch.no_grad():
    for xb, yb in test_loader:
        pred = model(xb.to(DEVICE)).argmax(1).cpu().numpy()
        all_pred.extend(pred); all_true.extend(yb.numpy())
acc = accuracy_score(all_true, all_pred)
print("Test accuracy: {:.4f}".format(acc))
print(classification_report(all_true, all_pred))
'''
_EVAL_CM = '''# ✅ Confusion matrix (seaborn heatmap)
cm = confusion_matrix(all_true, all_pred)
fig, ax = plt.subplots(figsize=(6, 5))
sns.heatmap(cm, annot=True, fmt="d", cmap="Blues", ax=ax, cbar=False)
ax.set_xlabel("Predicted"); ax.set_ylabel("True"); ax.set_title("Confusion Matrix")
plt.tight_layout(); plt.show()
'''
_EVAL_CURVES = '''# ✅ Training curves (matplotlib) — available when 'history' was recorded
if "history" in globals():
    fig, axes = plt.subplots(1, 2, figsize=(11, 4))
    axes[0].plot(history["train_loss"], color="#2563eb"); axes[0].set_title("Training Loss"); axes[0].set_xlabel("epoch")
    axes[1].plot(history["val_acc"], color="#16a34a"); axes[1].set_title("Validation Accuracy"); axes[1].set_xlabel("epoch")
    plt.tight_layout(); plt.show()
'''


def _evaluation_cells() -> List[Dict[str, Any]]:
    return [
        _md(_EVAL_MD),
        _code(_EVAL_PRED),
        _code(_EVAL_CM),
        _code(_EVAL_CURVES),
    ]


def build_notebook(nodes: List[Dict[str, Any]]) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Build a notebook + metadata from the deep-learning nodes in the graph."""
    dl_nodes = [n for n in nodes if n.get("category") == "deep_learning"]
    primary_type = dl_nodes[0]["type"] if dl_nodes else "dl:pytorch_mlp"

    cells: List[Dict[str, Any]] = [_md(HEADER_MD), _code(INSTALL_CODE), _code(COMMON_IMPORTS_CODE)]

    # Build one rich section per distinct deep-learning node type.
    seen = set()
    for node in dl_nodes:
        t = node.get("type", "dl:pytorch_mlp")
        if t in seen:
            continue
        seen.add(t)
        builder = SECTION_BUILDERS.get(t, _pytorch_mlp_section)
        cells.extend(builder(node.get("params", {})))

    if not dl_nodes:  # defensive default
        cells.extend(_pytorch_mlp_section({}))

    cells.extend(_evaluation_cells())
    cells.append(_md("## 📦 Save model artifacts\nRun the next cell after training to create PyTorch, TorchScript, and ONNX files."))
    cells.append(_code(MODEL_EXPORT_CODE))
    cells.append(_md("---\n✨ **Done.** Download the generated files from the Colab file browser or connect Google Drive for persistence."))

    notebook = nbf.v4.new_notebook()
    notebook["cells"] = cells
    notebook["metadata"] = {
        "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
        "language_info": {"name": "python", "version": "3.11"},
        "colab": {"provenance": [], "toc_visible": True},
        "accelerator": "GPU",
    }

    notebook_dict = nbf.from_dict(notebook)
    payload = json.dumps(notebook_dict)
    filename = f"ai_canvas_colab_{int(time.time())}.ipynb"

    meta = {
        "notebook": {
            "filename": filename,
            "nbformat": notebook_dict.get("nbformat", 4),
            "cells": len(cells),
            "size_bytes": len(payload.encode("utf-8")),
            "title": "AI Canvas — Colab Training Notebook",
        },
        "notebook_json": payload,
        "colab_url": COLAB_URL,
        "download_url": "/api/notebook?file=" + filename,
        "recommended_runtime": "Google Colab · T4 GPU (free tier)",
        "requirements": ["torch", "transformers", "datasets", "accelerate", "scikit-learn", "seaborn", "matplotlib", "pandas"],
        "nodes_detected": [n.get("type", "") for n in dl_nodes] or [primary_type],
        "message": "Notebook generated. Open Colab, switch to a GPU runtime, then run all cells.",
    }
    return notebook_dict, meta
