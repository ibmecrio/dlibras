"""Treina um LSTM bidirecional pra reconhecer as letras dinâmicas do alfabeto Libras.

================================================================================
COMO RODAR
================================================================================

    python -m server.training.train_motion_lstm --data-dir /opt/dlibras/dataset/

Ou direto, do root do repo:

    python server/training/train_motion_lstm.py --data-dir ./dataset/motion/

Flags úteis:
    --data-dir   Pasta com o dataset (vídeos rotulados ou CSV de landmarks).
    --csv        Caminho explícito pro CSV (overridea o autodetect em --data-dir).
    --epochs     Default 50.
    --batch-size Default 32.
    --hidden     Default 128 (hidden_size por direção do BiLSTM).
    --val-split  Default 0.2.
    --seed       Default 42.
    --output-dir Pasta de saída pro .pt e .meta.json. Default: ./models/.

================================================================================
PRÉ-REQUISITOS
================================================================================

1. Pasta `dataset/` contendo UMA das opções abaixo:

   a) CSV `landmarks_training.csv` no mesmo formato do que já existe no
      repo `Digital-Inclusion-...Libras-Recognition/landmarks_training.csv`,
      mas com sequências de frames (não só pose estática). O CSV precisa de
      uma coluna `sample_id` agrupando frames por amostra e ordenado por
      `frame_idx`. Schema esperado:

          sample_id, frame_idx, x0, y0, z0, ..., x20, y20, z20, label

      Cada (sample_id, label) gera uma sequência. Frames com NaN ou ausentes
      são forward-filled. Sequências com menos de 4 frames válidos são
      descartadas.

   b) Pasta `dataset/motion/<letra>/sample_*.npy`, igual ao formato que
      `collect_landmarks.py` (do repo de visão) produz: cada `.npy` é um
      array (N_frames, 21, 2|3). É o pipeline recomendado quando você tá
      coletando vídeos novos.

   c) Vídeos brutos em `dataset/videos/<letra>/*.mp4`. Nesse caso o script
      roda MediaPipe HandLandmarker frame-a-frame na hora — mais lento mas
      conveniente em dev. Requer MediaPipe + `hand_landmarker.task` no PATH.

2. Dependências Python:

       pip install torch numpy pandas mediapipe

   Python 3.10–3.13 (MediaPipe ainda não tem wheel pra 3.14).

================================================================================
STATUS DO PROJETO
================================================================================

Scaffold pronto. Modelo ainda NÃO foi treinado — pra isso a gente precisa
de um dataset rotulado das 5 letras dinâmicas (J, Z, H, K, X) e ainda não
coletamos. Próximos passos:

  1. Filmar 50–100 vídeos curtos (1–2s) de cada letra usando
     `collect_landmarks.py` (opção 'b' acima).
  2. Rodar este script → gera `models/motion_lstm.pt` + `.meta.json`.
  3. Copiar pra
     `Digital-Inclusion-...Libras-Recognition/models/motion_lstm.pt`.
  4. Reiniciar `api_server.py` — `_try_load_motion_model()` detecta os
     arquivos e ativa o endpoint `/predict-motion-v2` com o LSTM (em vez
     do fallback heurístico atual).

================================================================================
ARQUITETURA
================================================================================

Input:  (B, 24, 63) — batch, 24 frames (1.5s @ 16fps), 21 landmarks × 3 coords.
        Coords vêm normalizadas (centradas no pulso, escaladas pelo span).
LSTM:   bidirecional, 2 camadas, hidden=128 → output (B, 24, 256).
Pool:   última hidden de ambas direções → (B, 256).
Head:   Linear(256 → 64) → ReLU → Dropout(0.3) → Linear(64 → num_classes).

Loss:   CrossEntropy.
Optim:  AdamW lr=1e-3, weight_decay=1e-4.
Train:  50 epochs max, early stopping com patience=5 (paciência em val_acc).
Aug:    espelhamento horizontal (x → -x) + time-warp ±10% (resample randômico).

================================================================================
SAÍDA
================================================================================

  models/motion_lstm.pt
      state_dict, val_acc, train_loss, hidden, input_size, labels,
      target_frames, created_at.

  models/motion_lstm.meta.json
      {
        "labels": ["J", "Z", "H", "K", "X"],
        "target_frames": 24,
        "hidden": 128,
        "input_size": 63,
        "val_acc": 0.91,
        "train_loss": 0.18,
        "created_at": "2026-06-11T14:23:00Z"
      }

`api_server.py` lê o `.meta.json` e reconstrói o modelo via
`_try_load_motion_model()`. Não exige importar este módulo de treino.
"""

from __future__ import annotations

import argparse
import json
import math
import random
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import numpy as np

try:
    import torch
    from torch import nn
    from torch.utils.data import DataLoader, Dataset
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "PyTorch não está instalado. Rode `pip install torch` antes de treinar."
    ) from exc

# Pandas é opcional — só precisa pro CSV loader. NPY e vídeos não dependem.
try:
    import pandas as pd  # noqa: F401
    _HAS_PANDAS = True
except ImportError:
    _HAS_PANDAS = False

# MediaPipe é opcional — só precisa se a entrada for vídeo bruto (.mp4).
try:
    import mediapipe as mp  # noqa: F401
    _HAS_MEDIAPIPE = True
except ImportError:
    _HAS_MEDIAPIPE = False


# ─────────────────────────────────────────────────────────────────────
# Constantes
# ─────────────────────────────────────────────────────────────────────

# Letras com componente de movimento que o modelo aprende a classificar.
# H e K em Libras-BR têm um pequeno traço lateral. J e Z são os clássicos.
# X envolve a articulação do polegar — geralmente classificado como dinâmico.
MOTION_LETTERS: tuple[str, ...] = ("J", "Z", "H", "K", "X")

# 21 landmarks × (x, y, z) = 63 features por frame.
LANDMARKS_PER_FRAME = 21
COORDS_PER_LANDMARK = 3
INPUT_SIZE = LANDMARKS_PER_FRAME * COORDS_PER_LANDMARK  # 63

# 24 frames = 1.5s @ 16fps. Igual ao TARGET_FRAMES do preprocess.py do repo
# de visão pra ficar consistente entre treino e inferência.
TARGET_FRAMES = 24


# ─────────────────────────────────────────────────────────────────────
# Dataset
# ─────────────────────────────────────────────────────────────────────


@dataclass
class MotionDataset(Dataset):
    """Carrega sequências de landmarks rotulados a partir de CSV ou vídeos.

    Suporta 3 modos de entrada:

      1. CSV (`csv_path`): pandas DataFrame com colunas
         `sample_id, frame_idx, x0..z20, label`. Cada `sample_id` vira uma
         sequência. Path mais simples se você já tem landmarks pre-extraídos.

      2. NPY (`npy_dir`): pasta `<dir>/<letra>/sample_*.npy`. Cada `.npy`
         é (N_frames, 21, 2 ou 3). Compatível com o `collect_landmarks.py`
         do repo de visão.

      3. Vídeos (`video_dir`): `<dir>/<letra>/*.mp4`. Exige MediaPipe —
         landmarks são extraídos on-the-fly (lento). Só use em prototipagem.

    Após carregar, cada amostra é:
      - Forward-filled (frames sem mão → último frame válido).
      - Resampled pra `target_frames` (interpolação linear no tempo).
      - Normalizada (centro = landmark 0 = pulso; escala = span máximo).
      - Aumentada (mirror + time-warp) só no treino — controlado por `augment`.

    Devolve `(seq_tensor, label_idx)`. `seq_tensor` é (T, 63), float32.
    """

    csv_path: Optional[Path] = None
    npy_dir: Optional[Path] = None
    video_dir: Optional[Path] = None
    labels: tuple[str, ...] = MOTION_LETTERS
    target_frames: int = TARGET_FRAMES
    coords_per_landmark: int = COORDS_PER_LANDMARK
    augment: bool = False

    # Populado em __post_init__
    samples: list[np.ndarray] = field(default_factory=list)
    targets: list[int] = field(default_factory=list)
    label_to_idx: dict[str, int] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.label_to_idx = {lab: i for i, lab in enumerate(self.labels)}
        if self.csv_path is not None:
            self._load_csv(self.csv_path)
        elif self.npy_dir is not None:
            self._load_npy(self.npy_dir)
        elif self.video_dir is not None:
            self._load_videos(self.video_dir)
        else:
            raise ValueError(
                "MotionDataset precisa de uma fonte: csv_path, npy_dir ou video_dir."
            )
        if not self.samples:
            raise RuntimeError(
                "Nenhuma amostra carregada. Confira o dataset e os rótulos."
            )

    # ── CSV ──────────────────────────────────────────────────────────
    def _load_csv(self, path: Path) -> None:
        """CSV com sample_id, frame_idx, x0..z20, label."""
        if not _HAS_PANDAS:
            raise SystemExit(
                "Pandas não instalado. Rode `pip install pandas` ou use "
                "--npy-dir / --video-dir."
            )
        df = pd.read_csv(path)
        required = {"sample_id", "frame_idx", "label"}
        missing = required - set(df.columns)
        if missing:
            raise ValueError(
                f"CSV {path} faltando colunas: {missing}. Schema esperado: "
                "sample_id, frame_idx, x0..z20, label."
            )

        # Mantém só amostras das letras que a gente quer classificar.
        df = df[df["label"].isin(self.labels)].copy()
        if df.empty:
            print(
                f"[dataset] CSV não tem nenhuma das letras {self.labels}. "
                "Você provavelmente tá usando o landmarks_training.csv do "
                "pipeline KNN — esse é pose estática, não tem sequências. "
                "Use --npy-dir ou --video-dir com sequências."
            )
            return

        # Detecta colunas de coordenadas (x0,y0,z0,...).
        coord_cols = []
        for i in range(LANDMARKS_PER_FRAME):
            for axis in ("x", "y", "z")[: self.coords_per_landmark]:
                col = f"{axis}{i}"
                if col not in df.columns:
                    raise ValueError(f"CSV faltando coluna {col}.")
                coord_cols.append(col)

        for (sample_id, label), group in df.groupby(["sample_id", "label"], sort=False):
            group = group.sort_values("frame_idx")
            arr = group[coord_cols].to_numpy(dtype=np.float32)
            n = arr.shape[0]
            if n < 4:
                continue
            seq = arr.reshape(n, LANDMARKS_PER_FRAME, self.coords_per_landmark)
            seq = _preprocess_sequence(seq, self.target_frames)
            if seq is None:
                continue
            self.samples.append(seq.reshape(self.target_frames, -1))
            self.targets.append(self.label_to_idx[str(label)])

    # ── NPY ──────────────────────────────────────────────────────────
    def _load_npy(self, root: Path) -> None:
        """Pasta `<root>/<letra>/sample_*.npy`. NPY = (N_frames, 21, 2|3)."""
        for letter in self.labels:
            letter_dir = root / letter
            if not letter_dir.exists():
                print(f"[dataset] sem pasta pra letra {letter} em {root}")
                continue
            for path in sorted(letter_dir.glob("sample_*.npy")):
                raw = np.load(path).astype(np.float32)
                if raw.ndim != 3 or raw.shape[1] != LANDMARKS_PER_FRAME:
                    print(f"[dataset] skip {path.name}: shape {raw.shape}")
                    continue
                # Aceita .npy com 2 ou 3 coords. Se 2D, projeta z=0.
                if raw.shape[2] == 2 and self.coords_per_landmark == 3:
                    z = np.zeros((raw.shape[0], LANDMARKS_PER_FRAME, 1), dtype=np.float32)
                    raw = np.concatenate([raw, z], axis=2)
                elif raw.shape[2] != self.coords_per_landmark:
                    print(f"[dataset] skip {path.name}: coords {raw.shape[2]}")
                    continue
                seq = _preprocess_sequence(raw, self.target_frames)
                if seq is None:
                    continue
                self.samples.append(seq.reshape(self.target_frames, -1))
                self.targets.append(self.label_to_idx[letter])

    # ── Vídeos ───────────────────────────────────────────────────────
    def _load_videos(self, root: Path) -> None:
        """Roda MediaPipe HandLandmarker frame-a-frame em cada vídeo.
        Lento — use só em prototipagem ou se você não tem como pre-extrair
        os landmarks. Pra produção, pre-extraia tudo e use o CSV/NPY.
        """
        if not _HAS_MEDIAPIPE:
            raise SystemExit(
                "MediaPipe não instalado. Rode `pip install mediapipe` ou "
                "use --csv/--npy-dir com landmarks pre-extraídos."
            )
        try:
            import cv2  # noqa: F401
        except ImportError as exc:  # pragma: no cover
            raise SystemExit(
                "OpenCV não instalado. Rode `pip install opencv-python`."
            ) from exc

        from mediapipe.tasks import python as _mppython
        from mediapipe.tasks.python import vision as _mpvision

        # Procura por hand_landmarker.task em alguns caminhos conhecidos.
        candidates = [
            root.parent / "models" / "hand_landmarker.task",
            Path.cwd()
            / "Digital-Inclusion-and-Accessibility-A-Computer-Vision-Model-for-Automated-Libras-Recognition"
            / "models"
            / "hand_landmarker.task",
        ]
        model_path = next((p for p in candidates if p.exists()), None)
        if model_path is None:
            raise SystemExit(
                f"hand_landmarker.task não encontrado. Tentativas: {candidates}"
            )

        options = _mpvision.HandLandmarkerOptions(
            base_options=_mppython.BaseOptions(model_asset_path=str(model_path)),
            running_mode=_mpvision.RunningMode.IMAGE,
            num_hands=1,
        )
        detector = _mpvision.HandLandmarker.create_from_options(options)

        import cv2  # type: ignore[import-not-found]

        for letter in self.labels:
            letter_dir = root / letter
            if not letter_dir.exists():
                continue
            for path in sorted(letter_dir.glob("*.mp4")):
                cap = cv2.VideoCapture(str(path))
                frames: list[Optional[list[tuple[float, float, float]]]] = []
                while True:
                    ok, frame = cap.read()
                    if not ok:
                        break
                    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                    det = detector.detect(mp_img)
                    if not det.hand_landmarks:
                        frames.append(None)
                    else:
                        frames.append(
                            [(lm.x, lm.y, lm.z) for lm in det.hand_landmarks[0]]
                        )
                cap.release()
                if len(frames) < 4:
                    continue
                raw = _frames_to_array(frames, self.coords_per_landmark)
                seq = _preprocess_sequence(raw, self.target_frames)
                if seq is None:
                    continue
                self.samples.append(seq.reshape(self.target_frames, -1))
                self.targets.append(self.label_to_idx[letter])

    # ── Dataset protocol ─────────────────────────────────────────────
    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, torch.Tensor]:
        seq = self.samples[idx]
        if self.augment:
            seq = _augment(seq, self.target_frames, self.coords_per_landmark)
        return (
            torch.from_numpy(seq.astype(np.float32)),
            torch.tensor(self.targets[idx], dtype=torch.long),
        )


# ─────────────────────────────────────────────────────────────────────
# Pré-processamento (compartilhado entre CSV/NPY/Vídeo)
# ─────────────────────────────────────────────────────────────────────


def _frames_to_array(
    frames: list[Optional[list[tuple[float, float, float]]]],
    coords: int,
) -> np.ndarray:
    """Converte lista de frames (alguns None) → array (N, 21, coords) com NaN."""
    n = len(frames)
    out = np.full((n, LANDMARKS_PER_FRAME, coords), np.nan, dtype=np.float32)
    for i, lm in enumerate(frames):
        if lm is None:
            continue
        arr = np.array(lm, dtype=np.float32)
        out[i] = arr[:, :coords]
    return out


def _forward_fill(seq: np.ndarray) -> np.ndarray:
    """Substitui frames totalmente NaN pelo último frame válido."""
    seq = seq.copy()
    last: Optional[np.ndarray] = None
    n = seq.shape[0]
    for i in range(n):
        if np.isnan(seq[i]).all():
            if last is None:
                # pega o próximo válido pra preencher o início
                for j in range(i + 1, n):
                    if not np.isnan(seq[j]).all():
                        last = seq[j]
                        seq[i] = seq[j]
                        break
            else:
                seq[i] = last
        else:
            last = seq[i]
    return seq


def _resample(seq: np.ndarray, target: int) -> np.ndarray:
    """Resample temporal linear: (N, 21, C) → (target, 21, C)."""
    n, joints, coords = seq.shape
    if n == target:
        return seq
    src_t = np.linspace(0.0, 1.0, n)
    dst_t = np.linspace(0.0, 1.0, target)
    out = np.empty((target, joints, coords), dtype=np.float32)
    for j in range(joints):
        for k in range(coords):
            out[:, j, k] = np.interp(dst_t, src_t, seq[:, j, k])
    return out


def _normalize(seq: np.ndarray) -> np.ndarray:
    """Centro no pulso (landmark 0) + escala pelo span. Invariância a
    posição/distância da mão na câmera."""
    wrist = seq[:, 0:1, :]
    seq = seq - wrist
    span = float(np.max(np.abs(seq)))
    if span > 1e-6:
        seq = seq / span
    return seq.astype(np.float32)


def _preprocess_sequence(seq: np.ndarray, target_frames: int) -> Optional[np.ndarray]:
    """Pipeline completo: forward-fill → resample → normaliza. None se inutilizável."""
    if np.isnan(seq).all():
        return None
    seq = _forward_fill(seq)
    if np.isnan(seq).any():
        return None  # forward fill não conseguiu preencher tudo
    seq = _resample(seq, target_frames)
    seq = _normalize(seq)
    return seq


# ─────────────────────────────────────────────────────────────────────
# Augmentations
# ─────────────────────────────────────────────────────────────────────


def _augment(seq_flat: np.ndarray, target_frames: int, coords: int) -> np.ndarray:
    """Aplica augmentations probabilísticas. Mantém shape (target_frames, 21*coords).

    Mirror horizontal (50% chance): x → -x (espelha a mão). Equivale a alguém
    canhoto fazendo o mesmo sinal — modelo precisa ser robusto a isso.

    Time-warp ±10% (50% chance): resample da sequência num grid temporal
    levemente esticado/comprimido. Simula execução do sinal em ritmos
    levemente diferentes.
    """
    seq = seq_flat.reshape(target_frames, LANDMARKS_PER_FRAME, coords).copy()

    # Mirror em X
    if random.random() < 0.5:
        seq[:, :, 0] = -seq[:, :, 0]

    # Time-warp
    if random.random() < 0.5:
        warp = 1.0 + (random.random() * 0.2 - 0.1)  # 0.9 a 1.1
        n_new = max(4, int(round(target_frames * warp)))
        src_t = np.linspace(0.0, 1.0, target_frames)
        warped_t = np.linspace(0.0, 1.0, n_new)
        # Reamostra pra n_new, depois volta pra target_frames.
        intermediate = np.empty((n_new, LANDMARKS_PER_FRAME, coords), dtype=np.float32)
        for j in range(LANDMARKS_PER_FRAME):
            for k in range(coords):
                intermediate[:, j, k] = np.interp(warped_t, src_t, seq[:, j, k])
        seq = _resample(intermediate, target_frames)

    return seq.reshape(target_frames, -1)


# ─────────────────────────────────────────────────────────────────────
# Modelo
# ─────────────────────────────────────────────────────────────────────


class MotionLSTM(nn.Module):
    """BiLSTM 2 camadas → head com dropout. Compatível com a forma esperada
    por `api_server.py` (que monta a arquitetura a partir do .meta.json)."""

    def __init__(
        self,
        num_classes: int,
        hidden: int = 128,
        input_size: int = INPUT_SIZE,
        num_layers: int = 2,
        dropout: float = 0.3,
    ) -> None:
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden,
            num_layers=num_layers,
            batch_first=True,
            bidirectional=True,
            dropout=dropout if num_layers > 1 else 0.0,
        )
        self.dropout = nn.Dropout(dropout)
        self.head = nn.Sequential(
            nn.Linear(hidden * 2, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out, _ = self.lstm(x)
        pooled = self.dropout(out[:, -1, :])
        return self.head(pooled)


# ─────────────────────────────────────────────────────────────────────
# Training loop
# ─────────────────────────────────────────────────────────────────────


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def _split_dataset(
    ds: MotionDataset, val_split: float, seed: int
) -> tuple[list[int], list[int]]:
    rng = np.random.default_rng(seed)
    idx = rng.permutation(len(ds)).tolist()
    cut = max(1, int(len(idx) * (1 - val_split)))
    return idx[:cut], idx[cut:]


def train(
    ds: MotionDataset,
    *,
    epochs: int,
    batch_size: int,
    lr: float,
    weight_decay: float,
    val_split: float,
    seed: int,
    patience: int,
    hidden: int,
    output_dir: Path,
) -> dict:
    """Loop de treino com early stopping. Retorna dict com métricas finais."""
    set_seed(seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[train] device={device} samples={len(ds)} classes={len(ds.labels)}")

    train_idx, val_idx = _split_dataset(ds, val_split, seed)
    print(f"[train] train={len(train_idx)} val={len(val_idx)}")

    # Wrappers leves pro DataLoader honrar o flag de augmentation.
    train_ds = _SubsetWithAugment(ds, train_idx, augment=True)
    val_ds = _SubsetWithAugment(ds, val_idx, augment=False)

    train_dl = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_dl = DataLoader(val_ds, batch_size=batch_size, shuffle=False)

    model = MotionLSTM(
        num_classes=len(ds.labels),
        hidden=hidden,
        input_size=ds.samples[0].shape[1],
    ).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=weight_decay)
    loss_fn = nn.CrossEntropyLoss()

    best_val_acc = 0.0
    best_train_loss = math.inf
    bad_epochs = 0
    output_dir.mkdir(parents=True, exist_ok=True)
    model_path = output_dir / "motion_lstm.pt"
    meta_path = output_dir / "motion_lstm.meta.json"

    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0.0
        for xb, yb in train_dl:
            xb, yb = xb.to(device), yb.to(device)
            logits = model(xb)
            loss = loss_fn(logits, yb)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * xb.size(0)

        avg_loss = total_loss / max(len(train_ds), 1)

        model.eval()
        correct = 0
        total = 0
        with torch.no_grad():
            for xb, yb in val_dl:
                xb, yb = xb.to(device), yb.to(device)
                pred = model(xb).argmax(dim=1)
                correct += (pred == yb).sum().item()
                total += yb.size(0)
        val_acc = correct / max(total, 1)

        print(
            f"epoch {epoch:3d}/{epochs} | train_loss={avg_loss:.4f} | "
            f"val_acc={val_acc:.3f} | best={best_val_acc:.3f}"
        )

        improved = val_acc > best_val_acc
        if improved:
            best_val_acc = val_acc
            best_train_loss = avg_loss
            bad_epochs = 0
            torch.save(
                {
                    "state_dict": model.state_dict(),
                    "labels": list(ds.labels),
                    "hidden": hidden,
                    "input_size": ds.samples[0].shape[1],
                    "target_frames": ds.target_frames,
                    "val_acc": best_val_acc,
                    "train_loss": best_train_loss,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                },
                model_path,
            )
            meta = {
                "labels": list(ds.labels),
                "target_frames": ds.target_frames,
                "hidden": hidden,
                "input_size": ds.samples[0].shape[1],
                "val_acc": best_val_acc,
                "train_loss": best_train_loss,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            meta_path.write_text(json.dumps(meta, indent=2))
        else:
            bad_epochs += 1
            if bad_epochs >= patience:
                print(
                    f"[train] early stopping após {patience} epochs sem melhora. "
                    f"melhor val_acc={best_val_acc:.3f}"
                )
                break

    return {
        "val_acc": best_val_acc,
        "train_loss": best_train_loss,
        "model_path": str(model_path),
        "meta_path": str(meta_path),
    }


class _SubsetWithAugment(Dataset):
    """Subset que respeita o flag `augment` independente do dataset-pai."""

    def __init__(self, base: MotionDataset, indices: list[int], *, augment: bool) -> None:
        self.base = base
        self.indices = indices
        self.augment = augment

    def __len__(self) -> int:
        return len(self.indices)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, torch.Tensor]:
        real_idx = self.indices[idx]
        seq = self.base.samples[real_idx]
        if self.augment:
            seq = _augment(seq, self.base.target_frames, self.base.coords_per_landmark)
        return (
            torch.from_numpy(seq.astype(np.float32)),
            torch.tensor(self.base.targets[real_idx], dtype=torch.long),
        )


# ─────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--data-dir", type=Path, default=None, help="Pasta raiz do dataset (autodetect).")
    p.add_argument("--csv", type=Path, default=None, help="CSV com landmarks pré-extraídos.")
    p.add_argument("--npy-dir", type=Path, default=None, help="Pasta com `<letra>/sample_*.npy`.")
    p.add_argument("--video-dir", type=Path, default=None, help="Pasta com `<letra>/*.mp4`.")
    p.add_argument("--output-dir", type=Path, default=Path("models"))
    p.add_argument("--epochs", type=int, default=50)
    p.add_argument("--batch-size", type=int, default=32)
    p.add_argument("--lr", type=float, default=1e-3)
    p.add_argument("--weight-decay", type=float, default=1e-4)
    p.add_argument("--val-split", type=float, default=0.2)
    p.add_argument("--hidden", type=int, default=128)
    p.add_argument("--patience", type=int, default=5)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--target-frames", type=int, default=TARGET_FRAMES)
    p.add_argument(
        "--labels",
        nargs="+",
        default=list(MOTION_LETTERS),
        help="Override das letras-alvo (default: J Z H K X).",
    )
    return p.parse_args()


def _resolve_source(args: argparse.Namespace) -> dict:
    """Decide qual modo de carga usar com base nas flags ou no autodetect."""
    if args.csv:
        return {"csv_path": args.csv}
    if args.npy_dir:
        return {"npy_dir": args.npy_dir}
    if args.video_dir:
        return {"video_dir": args.video_dir}
    if args.data_dir:
        # Autodetect dentro de --data-dir
        if (args.data_dir / "landmarks_training.csv").exists():
            return {"csv_path": args.data_dir / "landmarks_training.csv"}
        if (args.data_dir / "motion").exists():
            return {"npy_dir": args.data_dir / "motion"}
        if (args.data_dir / "videos").exists():
            return {"video_dir": args.data_dir / "videos"}
        raise SystemExit(
            f"--data-dir {args.data_dir} não tem nem landmarks_training.csv, "
            "nem motion/, nem videos/. Use --csv/--npy-dir/--video-dir explícitos."
        )
    raise SystemExit(
        "Especifique --data-dir, --csv, --npy-dir ou --video-dir."
    )


def main() -> int:
    args = parse_args()
    source = _resolve_source(args)
    print(f"[main] fonte de dados: {source}")
    t0 = time.time()
    ds = MotionDataset(
        labels=tuple(args.labels),
        target_frames=args.target_frames,
        augment=False,  # augment é controlado no _SubsetWithAugment
        **source,
    )
    print(f"[main] carregado em {time.time() - t0:.1f}s — {len(ds)} amostras")

    metrics = train(
        ds,
        epochs=args.epochs,
        batch_size=args.batch_size,
        lr=args.lr,
        weight_decay=args.weight_decay,
        val_split=args.val_split,
        seed=args.seed,
        patience=args.patience,
        hidden=args.hidden,
        output_dir=args.output_dir,
    )
    print(f"[main] OK — métricas finais: {metrics}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
