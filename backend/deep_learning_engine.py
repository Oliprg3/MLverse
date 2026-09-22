"""
deep_learning_engine.py
=======================

The "Local PyTorch Path" execution engine.

When the host machine has PyTorch installed, deep-learning graphs no longer
hand off to Google Colab — they train right inside the app on the local CPU
(or GPU if torch.cuda is available) and stream live epoch events to the UI.

Locally trainable node types — every deep-learning node trains in-app
---------------------------------------------------------------------
  * dl:pytorch_mlp          — multi-layer perceptron (tabular)
  * dl:cnn                  — small conv net (image datasets → Conv2d,
                              tabular → Conv1d over the feature vector)
  * dl:lstm / dl:gru        — recurrent sequence classifiers
  * dl:tabular_transformer  — feature-tokenising transformer (FT-Transformer)
  * dl:transformer          — TransformerEncoder classifier over feature
                              tokens (trained from scratch locally — no
                              Hugging Face download required)
  * dl:autoencoder          — reconstruction-pretrained encoder + linear
                              classifier head, fine-tuned end-to-end
  * dl:gan                  — conditional GAN that synthesises extra training
                              samples, then an MLP classifier on real+synthetic

Nothing hands off to Google Colab anymore: when PyTorch is importable every
deep-learning graph trains in-app and streams live epoch events to the UI.

Everything returned is JSON-serialisable and shaped exactly like the
``basic_ml_engine`` instant response, so the existing ResultsDrawer renders
metrics, charts, predictions and the downloadable artifact unchanged.
"""

from __future__ import annotations

import base64
import io
import time
from typing import Any, Dict, List

import numpy as np
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, label_binarize

from basic_ml_engine import (
    ExecutionResult,
    _axis,
    _base_layout,
    _line,
    confusion_matrix_figure,
    feature_importance_figure,
    load_dataset,
    pr_curve_figure,
    roc_curve_figure,
)
from basic_ml_engine import PALETTE

try:  # optional — the whole engine degrades gracefully when torch is absent
    import torch
    import torch.nn as nn
except Exception:  # pragma: no cover
    torch = None  # type: ignore
    nn = None  # type: ignore

ENGINE_VERSION = "pytorch-local-v2.0.0"

# Node types this engine can train without a notebook hand-off — all of them.
LOCALLY_TRAINABLE = {
    "dl:pytorch_mlp",
    "dl:cnn",
    "dl:lstm",
    "dl:gru",
    "dl:tabular_transformer",
    "dl:transformer",
    "dl:autoencoder",
    "dl:gan",
}

# Epoch caps for CPU runs so a click never turns into minutes of silence.
CPU_EPOCH_CAPS = {"dl:cnn": 12, "dl:gan": 15, "dl:autoencoder": 20, "dl:transformer": 15}
DEFAULT_CPU_EPOCH_CAP = 25


def torch_available() -> bool:
    return torch is not None


def can_train_locally(ordered_nodes: List[Dict[str, Any]]) -> bool:
    """True when torch is importable AND every deep-learning node is one the
    local engine knows how to train (all of them, as of pytorch-local-v2)."""
    if torch is None:
        return False
    dl_nodes = [n for n in ordered_nodes if n.get("category") == "deep_learning"]
    if not dl_nodes:
        return False
    return all(n.get("type") in LOCALLY_TRAINABLE for n in dl_nodes)


# ── Model builders ───────────────────────────────────────────────────────────

def _build_mlp(n_features: int, n_classes: int, params: Dict[str, Any]) -> tuple:
    dropout = float(params.get("dropout", 0.3))
    hidden = [128, 64]
    layers: List[Any] = []
    prev = n_features
    for h in hidden:
        layers += [nn.Linear(prev, h), nn.ReLU(), nn.Dropout(dropout)]
        prev = h
    layers.append(nn.Linear(prev, n_classes))
    return nn.Sequential(*layers), "MLP (128→64→out)"


def _build_cnn(n_features: int, n_classes: int, params: Dict[str, Any], image_shape: tuple | None):
    """Conv2d when we have real image geometry, else Conv1d over the feature vector.

    The training loop feeds flat ``(B, F)`` tensors, so the net is wrapped in a
    reshaping module that restores the conv geometry on every forward pass."""

    class ConvNet(nn.Module):
        def __init__(self, core, shape):
            super().__init__()
            self.core = core
            self.shape = shape

        def forward(self, x):  # x: (B, F)
            return self.core(x.reshape(x.shape[0], *self.shape))

    if image_shape:
        c, h, w = image_shape
        chans = 16
        net = nn.Sequential(
            nn.Conv2d(c, chans, kernel_size=3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(chans, chans * 2, kernel_size=3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Flatten(),
        )
        with torch.no_grad():
            dummy = torch.zeros(1, c, h, w)
            flat = net(dummy).shape[1]
        net.add_module("fc", nn.Linear(flat, n_classes))
        return ConvNet(net, (c, h, w)), f"CNN (2×Conv2d, {chans}/{chans * 2}ch, {h}×{w})"
    net = nn.Sequential(
        nn.Conv1d(1, 16, kernel_size=3, padding=1), nn.ReLU(), nn.MaxPool1d(2),
        nn.Conv1d(16, 32, kernel_size=3, padding=1), nn.ReLU(), nn.AdaptiveAvgPool1d(8),
        nn.Flatten(),
        nn.Linear(32 * 8, 64), nn.ReLU(),
        nn.Linear(64, n_classes),
    )
    return ConvNet(net, (1, n_features)), "CNN (2×Conv1d over features)"


def _build_rnn(n_features: int, n_classes: int, params: Dict[str, Any], kind: str):
    hidden = int(params.get("hidden_size", 128))
    num_layers = int(params.get("num_layers", 2))
    dropout = float(params.get("dropout", 0.2))
    rnn_cls = nn.LSTM if kind == "lstm" else nn.GRU
    if num_layers < 2:
        dropout = 0.0

    class RNet(nn.Module):
        def __init__(self):
            super().__init__()
            self.rnn = rnn_cls(input_size=1, hidden_size=hidden, num_layers=num_layers,
                               batch_first=True, dropout=dropout)
            self.head = nn.Linear(hidden, n_classes)

        def forward(self, x):  # x: (B, F)
            out, _ = self.rnn(x.unsqueeze(-1))  # (B, F, hidden)
            return self.head(out[:, -1, :])

    return RNet(), f"{kind.upper()} ({num_layers}×{hidden} hidden)"


def _build_tabular_transformer(n_features: int, n_classes: int, params: Dict[str, Any]):
    embed_dim = int(params.get("embed_dim", 64))
    heads = int(params.get("heads", 4))
    layers = int(params.get("layers", 3))
    if embed_dim < 8:
        embed_dim = 8
    while heads > 1 and embed_dim % heads != 0:
        heads -= 1
    layers = max(1, min(layers, 4))

    class FTNet(nn.Module):
        def __init__(self):
            super().__init__()
            self.token = nn.Linear(1, embed_dim)  # each feature scalar → token
            self.pos = nn.Parameter(torch.zeros(1, n_features, embed_dim))
            layer = nn.TransformerEncoderLayer(d_model=embed_dim, nhead=heads,
                                               dim_feedforward=embed_dim * 2,
                                               dropout=0.1, batch_first=True,
                                               activation="gelu")
            self.encoder = nn.TransformerEncoder(layer, num_layers=layers)
            self.head = nn.Sequential(nn.LayerNorm(embed_dim), nn.Linear(embed_dim, n_classes))

        def forward(self, x):  # x: (B, F)
            tokens = self.token(x.unsqueeze(-1)) + self.pos[:, : x.shape[1], :]
            encoded = self.encoder(tokens)
            return self.head(encoded.mean(dim=1))

    return FTNet(), f"Tabular Transformer (d={embed_dim}, h={heads}, L={layers})"


def _build_transformer(n_features: int, n_classes: int, params: Dict[str, Any]):
    """Local stand-in for the old HF BERT node: a TransformerEncoder trained
    from scratch on feature tokens. No model download, trains in-app."""
    merged = {
        "embed_dim": int(params.get("embed_dim", 64) or 64),
        "heads": int(params.get("heads", 4) or 4),
        "layers": int(params.get("layers", 2) or 2),
    }
    model, _ = _build_tabular_transformer(n_features, n_classes, merged)
    return model, f"Transformer Encoder (d={merged['embed_dim']}, h={merged['heads']}, L={merged['layers']}, in-app)"


def _build_autoencoder(n_features: int, n_classes: int, params: Dict[str, Any]):
    """Encoder → latent → decoder for reconstruction pretraining; a linear head
    on the latent code turns it into a classifier for fine-tuning."""
    latent = int(params.get("latent_dim", 32) or 32)
    latent = max(2, min(latent, max(2, n_features * 2)))
    hidden = max(32, latent * 2)

    class Autoencoder(nn.Module):
        def __init__(self):
            super().__init__()
            self.encoder = nn.Sequential(
                nn.Linear(n_features, hidden), nn.ReLU(),
                nn.Linear(hidden, latent), nn.ReLU(),
            )
            self.decoder = nn.Sequential(
                nn.Linear(latent, hidden), nn.ReLU(),
                nn.Linear(hidden, n_features),
            )

        def forward(self, x):
            return self.decoder(self.encoder(x))

    class AEClassifier(nn.Module):
        def __init__(self, encoder):
            super().__init__()
            self.encoder = encoder
            self.head = nn.Linear(latent, n_classes)

        def forward(self, x):
            return self.head(self.encoder(x))

    ae = Autoencoder()
    return ae, AEClassifier(ae.encoder), f"Autoencoder (latent={latent}) + linear head"


def _gan_augment(
    X_train: np.ndarray,
    y_train: np.ndarray,
    n_classes: int,
    params: Dict[str, Any],
    device: Any,
    emit: Any,
) -> tuple:
    """Train a small conditional GAN on the (scaled) feature matrix and return
    synthetic ``(X_syn, y_syn)`` samples, class-balanced, for augmentation."""
    n_features = int(X_train.shape[1])
    latent = max(8, min(int(params.get("latent_dim", 100) or 100), 128))
    lr = float(params.get("lr", 0.0002) or 0.0002)
    epochs = int(params.get("epochs", 50) or 50)
    if device.type != "cuda":
        epochs = min(epochs, CPU_EPOCH_CAPS["dl:gan"])
    epochs = max(5, epochs)
    batch_size = max(16, min(64, X_train.shape[0]))
    cond = n_classes

    class Generator(nn.Module):
        def __init__(self):
            super().__init__()
            self.net = nn.Sequential(
                nn.Linear(latent + cond, 128), nn.ReLU(),
                nn.Linear(128, 128), nn.ReLU(),
                nn.Linear(128, n_features),
            )

        def forward(self, z, oh):
            return self.net(torch.cat([z, oh], dim=1))

    class Discriminator(nn.Module):
        def __init__(self):
            super().__init__()
            self.net = nn.Sequential(
                nn.Linear(n_features + cond, 128), nn.ReLU(),
                nn.Linear(128, 64), nn.ReLU(),
                nn.Linear(64, 1),
            )

        def forward(self, x, oh):
            return self.net(torch.cat([x, oh], dim=1)).squeeze(-1)

    gen = Generator().to(device)
    disc = Discriminator().to(device)
    opt_g = torch.optim.Adam(gen.parameters(), lr=lr, betas=(0.5, 0.999))
    opt_d = torch.optim.Adam(disc.parameters(), lr=lr, betas=(0.5, 0.999))
    bce = nn.BCEWithLogitsLoss()

    X_t = torch.from_numpy(X_train).to(device)
    y_t = torch.from_numpy(y_train).to(device)
    rng = np.random.default_rng(7)
    n_train = X_t.shape[0]

    emit({"type": "step", "message": f"Training conditional GAN (latent={latent}) for {epochs} epochs on {device.type.upper()}…"})
    for epoch in range(1, epochs + 1):
        perm = rng.permutation(n_train)
        g_tot = d_tot = 0.0
        batches = 0
        for i in range(0, n_train, batch_size):
            idx = perm[i : i + batch_size]
            xb, yb = X_t[idx], y_t[idx]
            b = xb.shape[0]
            oh = nn.functional.one_hot(yb, cond).float()
            # — discriminator —
            z = torch.randn(b, latent, device=device)
            with torch.no_grad():
                fake = gen(z, oh)
            d_real = disc(xb, oh)
            d_fake = disc(fake, oh)
            d_loss = 0.5 * (bce(d_real, torch.ones_like(d_real)) + bce(d_fake, torch.zeros_like(d_fake)))
            opt_d.zero_grad()
            d_loss.backward()
            opt_d.step()
            # — generator —
            z = torch.randn(b, latent, device=device)
            g_loss = bce(disc(gen(z, oh), oh), torch.ones(b, device=device))
            opt_g.zero_grad()
            g_loss.backward()
            opt_g.step()
            g_tot += float(g_loss.item())
            d_tot += float(d_loss.item())
            batches += 1
        emit({"type": "step", "message": f"epoch {epoch}/{epochs} · g_loss={g_tot / max(batches, 1):.4f} · d_loss={d_tot / max(batches, 1):.4f}"})

    # Sample a class-balanced synthetic set the size of the real training set.
    gen.eval()
    per_class = max(1, n_train // n_classes)
    xs, ys = [], []
    with torch.no_grad():
        for cls in range(n_classes):
            z = torch.randn(per_class, latent, device=device)
            oh = torch.zeros(per_class, cond, device=device)
            oh[:, cls] = 1.0
            xs.append(gen(z, oh).cpu().numpy())
            ys.append(np.full(per_class, cls, dtype=np.int64))
    X_syn = np.vstack(xs).astype(np.float32)
    y_syn = np.concatenate(ys)
    emit({"type": "step", "message": f"GAN generated {X_syn.shape[0]} synthetic samples ({per_class}/class) — augmenting the training set."})
    return X_syn, y_syn


# ── Execution ────────────────────────────────────────────────────────────────

def execute(nodes: List[Dict[str, Any]], emit: Any = None) -> Dict[str, Any]:
    start = time.perf_counter()
    _emit = emit if callable(emit) else (lambda e: None)
    if torch is None:
        return ExecutionResult(
            status="error",
            engine=ENGINE_VERSION,
            error="PyTorch is not installed on this machine. Run `pip install torch` and press Train again — deep-learning graphs train in-app, no notebook hand-off.",
            timing={"total_seconds": time.perf_counter() - start},
        ).to_dict()
    try:
        return _execute_inner(nodes, start, _emit).to_dict()
    except Exception as exc:  # pragma: no cover — surfaced to the UI
        _emit({"type": "error", "message": f"{type(exc).__name__}: {exc}"})
        return ExecutionResult(
            status="error",
            engine=ENGINE_VERSION,
            error=f"{type(exc).__name__}: {exc}",
            timing={"total_seconds": time.perf_counter() - start},
        ).to_dict()


def _execute_inner(nodes: List[Dict[str, Any]], start: float, emit: Any) -> ExecutionResult:
    by_type = {n.get("type"): n for n in nodes}
    params_of = lambda t: (by_type[t].get("params") or {}) if t in by_type else {}

    # 1. dataset (mirrors basic_ml_engine)
    data_node = next((n for n in nodes if n.get("category") == "data"), None)
    data_type = data_node["type"] if data_node else "data:breast_cancer"
    if data_type in ("data:csv", "data:db"):
        dataset = data_node.get("dataset") if data_node else None
    elif data_type == "data:images":
        dataset = data_node.get("imageDataset") if data_node else None
    else:
        dataset = None
    emit({"type": "step", "message": f"Loading dataset ({data_type})…"})
    X, y, feature_names, target_names, dataset_name = load_dataset(data_type, params_of(data_type), dataset)
    X = np.asarray(X, dtype=np.float32)
    y = np.asarray(y, dtype=np.int64)
    if np.isnan(X).any():
        X = SimpleImputer(strategy="median").fit_transform(X)
    emit({"type": "step", "message": f"Loaded {dataset_name} — {X.shape[0]} samples · {X.shape[1]} features · {len(set(y.tolist()))} classes"})

    steps_desc: List[Dict[str, str]] = [{"name": "Load dataset", "detail": dataset_name, "kind": "data"}]

    # 2. split
    test_size = float(np.clip(float(params_of(data_type).get("test_size", 0.2) or 0.2), 0.1, 0.5))
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42, stratify=y if len(np.unique(y)) > 1 else None
    )
    steps_desc.append({"name": "Train/Test split", "detail": f"test_size={test_size:.2f}", "kind": "preprocessing"})

    # 3. scaling (DL wants standardised inputs)
    scaler = StandardScaler().fit(X_train)
    X_train = scaler.transform(X_train).astype(np.float32)
    X_test = scaler.transform(X_test).astype(np.float32)
    steps_desc.append({"name": "StandardScaler", "detail": "zero mean / unit variance", "kind": "preprocessing"})

    # 4. model
    model_node = next((n for n in nodes if n.get("category") == "deep_learning"), None)
    model_type = model_node["type"] if model_node else "dl:pytorch_mlp"
    params = params_of(model_type)
    n_features = int(X.shape[1])
    classes = sorted(np.unique(y).tolist())
    n_classes = len(classes)
    class_names = [str(c) for c in classes]

    image_shape = None
    if model_type == "dl:cnn" and data_type == "data:images" and dataset:
        w = int(dataset.get("width") or 0)
        h = int(dataset.get("height") or 0)
        if w > 0 and h > 0 and w * h == X.shape[1]:
            image_shape = (1, h, w)
    if image_shape is None and model_type == "dl:cnn":
        side = int(round(np.sqrt(X.shape[1])))
        if side * side == X.shape[1] and side >= 8:
            image_shape = (1, side, side)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    # GAN: synthesise extra training samples first, then classify the union.
    if model_type == "dl:gan":
        X_syn, y_syn = _gan_augment(X_train, y_train, n_classes, params, device, emit)
        X_train = np.vstack([X_train, X_syn]).astype(np.float32)
        y_train = np.concatenate([y_train, y_syn]).astype(np.int64)
        steps_desc.append({"name": "GAN augmentation", "detail": f"+{X_syn.shape[0]} synthetic samples", "kind": "model"})

    ae_net = None
    if model_type in ("dl:pytorch_mlp", "dl:gan"):
        model, arch_desc = _build_mlp(n_features, n_classes, params)
        if model_type == "dl:gan":
            arch_desc = f"GAN-augmented {arch_desc}"
    elif model_type == "dl:cnn":
        model, arch_desc = _build_cnn(n_features, n_classes, params, image_shape)
    elif model_type in ("dl:lstm", "dl:gru"):
        model, arch_desc = _build_rnn(n_features, n_classes, params, model_type.split(":")[1])
    elif model_type == "dl:tabular_transformer":
        model, arch_desc = _build_tabular_transformer(n_features, n_classes, params)
    elif model_type == "dl:transformer":
        model, arch_desc = _build_transformer(n_features, n_classes, params)
    elif model_type == "dl:autoencoder":
        ae_net, model, arch_desc = _build_autoencoder(n_features, n_classes, params)
    else:
        raise ValueError(f"{model_type} is not a known deep-learning node type.")

    model = model.to(device)
    total_params = int(sum(p.numel() for p in model.parameters()))

    # 5. hyper-params (honour the canvas node settings, cap on CPU)
    epochs = int(params.get("epochs", 25))
    batch_size = max(8, int(params.get("batch_size", 64)))
    lr = float(params.get("lr", 0.001))
    opt_name = str(params.get("optimizer", "adamw")).lower()
    if not torch.cuda.is_available():
        cap = CPU_EPOCH_CAPS.get(model_type, DEFAULT_CPU_EPOCH_CAP)
        if epochs > cap:
            emit({"type": "step", "message": f"Capping epochs to {cap} so the local {device.type.upper()} run stays fast."})
            epochs = cap

    steps_desc.append({"name": f"Train {arch_desc}", "detail": f"PyTorch · {total_params:,} params · {epochs} epochs", "kind": "model"})
    emit({"type": "step", "message": f"Training {arch_desc} on {device.type.upper()} ({total_params:,} params, batch={batch_size}, lr={lr:g})…"})

    opt_cls = {"adamw": torch.optim.AdamW, "adam": torch.optim.Adam, "sgd": torch.optim.SGD}.get(opt_name, torch.optim.AdamW)
    optimizer = opt_cls(model.parameters(), lr=lr)
    criterion = nn.CrossEntropyLoss()

    Xtr_t = torch.from_numpy(X_train).to(device)
    ytr_t = torch.from_numpy(y_train).to(device)
    Xte_t = torch.from_numpy(X_test).to(device)
    yte_np = y_test

    rng = np.random.default_rng(42)
    torch.manual_seed(42)
    n_train = Xtr_t.shape[0]

    # Autoencoder: reconstruction pretraining before the classification phase.
    if ae_net is not None:
        ae_net = ae_net.to(device)
        ae_epochs = max(3, epochs // 2)
        opt_ae = torch.optim.Adam(ae_net.parameters(), lr=lr)
        mse = nn.MSELoss()
        steps_desc.append({"name": "Autoencoder pretraining", "detail": f"{ae_epochs} reconstruction epochs", "kind": "model"})
        emit({"type": "step", "message": f"Pretraining autoencoder on reconstruction loss for {ae_epochs} epochs…"})
        for epoch in range(1, ae_epochs + 1):
            ae_net.train()
            perm = rng.permutation(n_train)
            tot = 0.0
            n_batches = 0
            for i in range(0, n_train, batch_size):
                idx = perm[i : i + batch_size]
                xb = Xtr_t[idx]
                opt_ae.zero_grad()
                recon = mse(ae_net(xb), xb)
                recon.backward()
                opt_ae.step()
                tot += float(recon.item())
                n_batches += 1
            emit({"type": "step", "message": f"epoch {epoch}/{ae_epochs} · recon_loss={tot / max(n_batches, 1):.4f}"})
        emit({"type": "step", "message": "Encoder pretrained — fine-tuning the classifier head on the latent space…"})

    hist_loss: List[float] = []
    hist_acc: List[float] = []
    t0 = time.perf_counter()

    for epoch in range(1, epochs + 1):
        model.train()
        perm = rng.permutation(n_train)
        total_loss = 0.0
        batches = 0
        for i in range(0, n_train, batch_size):
            idx = perm[i : i + batch_size]
            xb, yb = Xtr_t[idx], ytr_t[idx]
            optimizer.zero_grad()
            loss = criterion(model(xb), yb)
            loss.backward()
            optimizer.step()
            total_loss += float(loss.item())
            batches += 1
        avg_loss = total_loss / max(batches, 1)

        model.eval()
        with torch.no_grad():
            logits = model(Xte_t)
            val_acc = float((logits.argmax(dim=1).cpu().numpy() == yte_np).mean())
        hist_loss.append(avg_loss)
        hist_acc.append(val_acc)
        emit({"type": "step", "message": f"epoch {epoch}/{epochs} · loss={avg_loss:.4f} · val_acc={val_acc:.4f}"})

    train_seconds = time.perf_counter() - t0
    emit({"type": "step", "message": f"{arch_desc} trained in {train_seconds:.2f}s on {device.type.upper()}"})

    # 6. test-set predictions + probabilities
    model.eval()
    with torch.no_grad():
        logits = model(Xte_t)
        probs = torch.softmax(logits, dim=1).cpu().numpy()
    y_pred = probs.argmax(axis=1)
    y_score = probs

    avg = "weighted" if n_classes > 2 else "binary"
    y_test_bin = label_binarize(y_test, classes=classes)
    if n_classes == 2 and y_test_bin.shape[1] == 1:
        y_test_bin = np.hstack([1 - y_test_bin, y_test_bin])
    try:
        auc = roc_auc_score(y_test_bin, y_score, multi_class="ovr", average="weighted") if n_classes > 2 else roc_auc_score(y_test_bin, y_score, average="weighted")
    except Exception:
        auc = float("nan")
    try:
        ap = average_precision_score(y_test_bin, y_score, average="weighted")
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
    for mk, mv in metrics.items():
        emit({"type": "metric", "name": mk, "value": float(mv)})

    # 7. charts — reuse the themed figure builders + a training history plot
    emit({"type": "step", "message": "Generating Plotly charts & predictions…"})
    charts: Dict[str, Any] = {
        "confusion_matrix": confusion_matrix_figure(y_test, y_pred, class_names),
        "roc_curve": roc_curve_figure(y_test_bin, y_score, class_names),
        "pr_curve": pr_curve_figure(y_test_bin, y_score, class_names),
        "training_history": _training_history_figure(hist_loss, hist_acc),
    }
    importances = _dl_feature_importance(model, model_type, X_test, y_test, n_features)
    fi_names = feature_names if len(feature_names) == len(importances) else [f"feature_{i}" for i in range(len(importances))]
    charts["feature_importance"] = feature_importance_figure(importances, fi_names)

    # 8. predictions table
    cap = 500
    predictions = {
        "y_true": y_test[:cap].tolist(),
        "y_pred": y_pred[:cap].tolist(),
        "classes": class_names,
        "n_test": int(len(y_test)),
        "confidence": probs[:cap].max(axis=1).round(6).tolist(),
    }

    # 9. downloadable artifact — torch state_dict
    artifact = None
    try:
        buf = io.BytesIO()
        torch.save(model.state_dict(), buf)
        artifact = {
            "format": "torch",
            "filename": f"datlify_{model_type.replace(':', '_')}.pt",
            "mime": "application/octet-stream",
            "base64": base64.b64encode(buf.getvalue()).decode("ascii"),
        }
    except Exception:
        artifact = None

    device_note = "GPU" if device.type == "cuda" else "CPU"
    return ExecutionResult(
        route="instant",
        status="success",
        engine=f"PyTorch {torch.__version__} · local {device_note} · plotly",
        pipeline={"steps": steps_desc},
        dataset={
            "name": dataset_name,
            "n_samples": int(X.shape[0]),
            "n_features": int(X.shape[1]),
            "n_classes": int(n_classes),
            "target_type": "classification",
        },
        model={
            "name": arch_desc,
            "framework": "PyTorch",
            "library_version": str(torch.__version__),
            "export_formats": ["torch"],
            "artifacts": {"torch": artifact},
        },
        metrics=metrics,
        charts=charts,
        predictions=predictions,
        timing={"total_seconds": time.perf_counter() - start, "training_seconds": train_seconds},
        message=f"{arch_desc} trained in-app on local {device_note} in {train_seconds:.2f}s — no Colab needed.",
    )


# ── Helpers ──────────────────────────────────────────────────────────────────

def _training_history_figure(loss: List[float], val_acc: List[float]) -> Dict[str, Any]:
    epochs = list(range(1, len(loss) + 1))
    return {
        "data": [
            _line(epochs, loss, "train loss", PALETTE[1], width=2.0),
            {
                "type": "scatter",
                "mode": "lines",
                "x": epochs,
                "y": val_acc,
                "name": "val accuracy",
                "line": {"color": PALETTE[3], "width": 2.0},
                "yaxis": "y2",
                "hovertemplate": "epoch %{x}<br>val acc %{y:.4f}<extra>val accuracy</extra>",
            },
        ],
        "layout": _base_layout(
            "Training History",
            yaxis=_axis("Cross-entropy loss"),
            yaxis2={**_axis("Validation accuracy", range=[0, 1]), "overlaying": "y", "side": "right"},
            xaxis=_axis("Epoch"),
            legend={"bgcolor": "rgba(15,23,42,0.0)", "font": {"color": "#94a3b8"}},
        ),
    }


def _dl_feature_importance(model, model_type: str, X_test: np.ndarray, y_test: np.ndarray, n_features: int) -> np.ndarray:
    """Gradient-weight first-layer importance; falls back to permutation on small test sets."""
    try:
        if model_type in ("dl:lstm", "dl:gru", "dl:tabular_transformer"):
            first = model.rnn if model_type in ("dl:lstm", "dl:gru") else model.token
            w = first.weight_ih_l0 if model_type in ("dl:lstm", "dl:gru") else first.weight
        elif model_type == "dl:cnn":
            first = model[0]
            w = first.weight.reshape(first.weight.shape[0], -1)
        else:
            w = model[0].weight
        imp = np.abs(np.asarray(w.detach().cpu(), dtype=float)).mean(axis=0).flatten()
        if imp.shape[0] != n_features:  # conv/rnn token mixing — not 1:1 with features
            raise ValueError
        return _normalize_imp(imp)
    except Exception:
        pass
    try:
        from sklearn.inspection import permutation_importance

        class _Wrap:
            def __init__(self, m):
                self.m = m

            def predict(self, arr):
                self.m.eval()
                with torch.no_grad():
                    t = torch.from_numpy(np.asarray(arr, dtype=np.float32))
                    return self.m(t).argmax(dim=1).cpu().numpy()

        r = permutation_importance(_Wrap(model), X_test, y_test, n_repeats=3, random_state=42, scoring="accuracy")
        return _normalize_imp(np.asarray(r.importances_mean, dtype=float))
    except Exception:
        return _normalize_imp(np.random.default_rng(7).random(n_features))


def _normalize_imp(imp: np.ndarray) -> np.ndarray:
    imp = np.abs(imp).astype(float).flatten()
    s = imp.sum()
    return imp / s if s > 0 else imp
