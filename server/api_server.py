"""HTTP bridge for the React Native DLibras app.

Wraps `libras_vision`'s KNN + MediaPipe pipeline in a FastAPI server so the
mobile client can POST a frame (base64 JPEG/PNG) and receive the predicted
Libras letter. Static alphabet only: A B C D E F G I L M N O P Q R S T U V W Y.
"""
from __future__ import annotations

import base64
import io
import json
import time
from pathlib import Path
from typing import Any, Optional

import joblib
import mediapipe as mp
import numpy as np
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from PIL import Image
from pydantic import BaseModel, Field

import extract

ROOT = Path(__file__).resolve().parent
MODEL_PATH = ROOT / "models" / "hand_landmarker.task"
KNN_PATH = ROOT / "models" / "knn_model.joblib"
ENCODER_PATH = ROOT / "models" / "label_encoder.joblib"
MOTION_LSTM_PATH = ROOT / "models" / "motion_lstm.pt"
MOTION_META_PATH = ROOT / "models" / "motion_lstm.meta.json"

if not MODEL_PATH.exists():
    raise FileNotFoundError(f"MediaPipe model not found at {MODEL_PATH}")
if not KNN_PATH.exists() or not ENCODER_PATH.exists():
    raise FileNotFoundError(
        "Trained model files missing. Run knn_model.py first to generate "
        "models/knn_model.joblib and models/label_encoder.joblib."
    )

base_options = python.BaseOptions(model_asset_path=str(MODEL_PATH))
image_options = vision.HandLandmarkerOptions(
    base_options=base_options,
    running_mode=vision.RunningMode.IMAGE,
    num_hands=1,
    min_hand_detection_confidence=0.5,
    min_hand_presence_confidence=0.5,
    min_tracking_confidence=0.5,
)
detector = vision.HandLandmarker.create_from_options(image_options)

knn_clf = joblib.load(KNN_PATH)
label_encoder = joblib.load(ENCODER_PATH)

# ─────────────────────────────────────────────────────────────────────
# Modelos extras (SVM, MLP, RandomForest, LogReg) — opcional.
# Carrega o que estiver presente, ensemble usa todos disponíveis.
# ─────────────────────────────────────────────────────────────────────
EXTRA_MODEL_PATHS = {
    "svm": ROOT / "models" / "svm_model.joblib",
    "mlp": ROOT / "models" / "mlp_model.joblib",
    "rf": ROOT / "models" / "random_forest_model.joblib",
    "lr": ROOT / "models" / "logistic_regression_model.joblib",
}
extra_models: dict[str, Any] = {}
for name, path in EXTRA_MODEL_PATHS.items():
    if path.exists():
        try:
            extra_models[name] = joblib.load(path)
            print(f"[api] loaded extra model: {name}")
        except Exception as e:
            print(f"[api] failed to load {name}: {e}")

ALL_MODELS = {"knn": knn_clf, **extra_models}


def _classify_with(model_name: str, features: np.ndarray) -> tuple[str, float]:
    """Roda um modelo específico e retorna (letra, confiança).
    Para KNN, confiança é a fração de vizinhos concordando.
    Para os outros (com predict_proba), é a probabilidade da classe top.
    Fallback: se modelo não tem predict_proba, retorna 1.0.
    """
    feats = features.reshape(1, -1)
    if model_name == "knn":
        return _classify(features)
    clf = extra_models.get(model_name)
    if clf is None:
        return _classify(features)  # fallback
    pred = clf.predict(feats)[0]
    letter = label_encoder.inverse_transform([pred])[0]
    try:
        probas = clf.predict_proba(feats)[0]
        confidence = float(np.max(probas))
    except Exception:
        confidence = 1.0
    return str(letter), confidence


def _classify_ensemble(features: np.ndarray) -> tuple[str, float]:
    """Majority vote entre todos os modelos disponíveis.
    Confiança = fração de modelos concordando com a predição vencedora,
    ponderada pela média da confiança individual deles."""
    if len(ALL_MODELS) <= 1:
        return _classify(features)
    votes: dict[str, list[float]] = {}
    for name in ALL_MODELS:
        letter, conf = _classify_with(name, features)
        votes.setdefault(letter, []).append(conf)
    # Letra vencedora = a que recebeu mais votos. Em empate, a com maior conf média.
    winner = max(
        votes.items(),
        key=lambda kv: (len(kv[1]), float(np.mean(kv[1]))),
    )
    letter, confidences = winner
    # Confiança final = média de confianças ponderada pelo nº de votos
    ratio = len(confidences) / len(ALL_MODELS)
    avg_conf = float(np.mean(confidences))
    final = (ratio * 0.6) + (avg_conf * 0.4)
    return letter, float(min(1.0, final))


# ─────────────────────────────────────────────────────────────────────
# Motion model (LSTM) — opcional. Carrega lazy se .pt + .meta existem.
# Sem PyTorch instalado / sem arquivos de modelo, /predict-motion-v2
# cai no fallback heurístico.
# ─────────────────────────────────────────────────────────────────────
motion_model: Optional[Any] = None
motion_labels: list[str] = []
motion_target_frames: int = 24
motion_status: str = "unavailable"


def _try_load_motion_model() -> None:
    global motion_model, motion_labels, motion_target_frames, motion_status
    if not MOTION_LSTM_PATH.exists() or not MOTION_META_PATH.exists():
        motion_status = "files_missing"
        return
    try:
        import torch  # type: ignore[import-not-found]
        from torch import nn  # type: ignore[import-not-found]
    except ImportError:
        motion_status = "torch_not_installed"
        return

    meta = json.loads(MOTION_META_PATH.read_text())
    motion_labels = list(meta["labels"])
    hidden = int(meta.get("hidden", 64))
    input_size = int(meta.get("input_size", 42))
    motion_target_frames = int(meta.get("target_frames", 24))

    class _MotionLSTM(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.lstm = nn.LSTM(
                input_size=input_size,
                hidden_size=hidden,
                num_layers=1,
                batch_first=True,
                bidirectional=True,
            )
            self.head = nn.Sequential(
                nn.Linear(hidden * 2, 64),
                nn.ReLU(),
                nn.Dropout(0.2),
                nn.Linear(64, len(motion_labels)),
            )

        def forward(self, x):  # type: ignore[no-untyped-def]
            out, _ = self.lstm(x)
            return self.head(out[:, -1, :])

    state = torch.load(MOTION_LSTM_PATH, map_location="cpu")
    model = _MotionLSTM()
    model.load_state_dict(state["state_dict"])
    model.eval()
    motion_model = model
    motion_status = "loaded"
    print(
        f"[motion] LSTM carregado: labels={motion_labels}, "
        f"target_frames={motion_target_frames}, val_acc={state.get('val_acc', '?')}"
    )


_try_load_motion_model()


class PredictRequest(BaseModel):
    image: str = Field(..., description="Base64-encoded JPEG/PNG frame (no data URI prefix needed)")
    target: Optional[str] = Field(None, description="Expected letter for the lesson — used to compute `match`")
    model: Optional[str] = Field(None, description="Modelo: knn|svm|mlp|rf|lr|ensemble. Default: knn")


class LandmarkPoint(BaseModel):
    x: float
    y: float
    z: float = 0.0


class LandmarksRequest(BaseModel):
    landmarks: list[LandmarkPoint] = Field(..., min_length=21, max_length=21)
    handedness: str = Field("Right", description="'Left' or 'Right' — used to mirror left hands during normalization")
    target: Optional[str] = None


class PredictResponse(BaseModel):
    letter: Optional[str]
    confidence: Optional[float]
    match: Optional[bool]
    has_hand: bool
    latency_ms: float


class MotionRequest(BaseModel):
    frames: list[str] = Field(..., min_length=4, max_length=30,
        description="Sequência de frames base64 (4–30) capturados ~5–15 fps.")
    target: Optional[str] = Field(None, description="J ou Z — letra esperada.")


class MotionResponse(BaseModel):
    letter: Optional[str]
    confidence: float
    match: Optional[bool]
    has_hand_in_frames: int
    total_frames: int
    detected_motion: str
    latency_ms: float


app = FastAPI(title="DLibras Vision API", version="0.3.0")

# CORS — em dev aceita tudo, em prod usa DLIBRAS_ALLOWED_ORIGINS
# (comma-separated). Ex.: "https://dlibras.app,https://dlibras.vercel.app"
import os as _os
_allowed = _os.environ.get("DLIBRAS_ALLOWED_ORIGINS", "*").strip()
_origins = ["*"] if _allowed == "*" else [o.strip() for o in _allowed.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    allow_credentials=False,
)

# Rate limiting — opcional (slowapi). Configurado via env DLIBRAS_RATE_LIMIT_*.
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler  # type: ignore
    from slowapi.errors import RateLimitExceeded  # type: ignore
    from slowapi.util import get_remote_address  # type: ignore
    _limiter = Limiter(key_func=get_remote_address)
    app.state.limiter = _limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    _RL_PREDICT = _os.environ.get("DLIBRAS_RATE_LIMIT_PREDICT", "100/minute")
    _RL_PROXY = _os.environ.get("DLIBRAS_RATE_LIMIT_PROXY", "10/minute")
    print(f"[api] rate limit: predict={_RL_PREDICT}, proxy={_RL_PROXY}")
except ImportError:
    _limiter = None
    _RL_PREDICT = ""
    _RL_PROXY = ""
    print("[api] slowapi not installed — rate limit off (ok for dev)")


def _decode_image(b64: str) -> np.ndarray:
    if "," in b64:  # strip optional data:image/...;base64, prefix
        b64 = b64.split(",", 1)[1]
    try:
        raw = base64.b64decode(b64, validate=True)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Invalid base64 payload: {exc}") from exc
    try:
        img = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Could not decode image: {exc}") from exc
    return np.array(img)


class _LM:
    __slots__ = ("x", "y", "z")

    def __init__(self, x: float, y: float, z: float) -> None:
        self.x = x
        self.y = y
        self.z = z


class _Cat:
    __slots__ = ("category_name",)

    def __init__(self, name: str) -> None:
        self.category_name = name


class _Detection:
    """Duck-typed replacement for MediaPipe's HandLandmarkerResult so we can
    reuse extract.extract_relative_coords with manually supplied landmarks."""

    __slots__ = ("hand_landmarks", "handedness")

    def __init__(self, points: list[LandmarkPoint], handedness: str) -> None:
        self.hand_landmarks = [[_LM(p.x, p.y, p.z) for p in points]]
        self.handedness = [[_Cat(handedness)]]


def _classify(features: np.ndarray) -> tuple[str, float]:
    distances, indices = knn_clf.kneighbors(features.reshape(1, -1), n_neighbors=knn_clf.n_neighbors)
    classes = knn_clf._y[indices[0]]
    pred = knn_clf.predict(features.reshape(1, -1))[0]
    letter = label_encoder.inverse_transform([pred])[0]
    confidence = float(np.sum(classes == pred) / len(classes))
    return letter, confidence


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "labels": [str(c) for c in label_encoder.classes_.tolist()],
        "k": knn_clf.n_neighbors,
        "models_available": list(ALL_MODELS.keys()) + (["ensemble"] if len(ALL_MODELS) > 1 else []),
        "motion_model": {
            "status": motion_status,
            "labels": motion_labels,
            "target_frames": motion_target_frames if motion_status == "loaded" else None,
        },
    }


@app.get("/health/v2")
def health_v2() -> dict:
    """Health check estendido: subsistemas, latencia DB, status de proxies."""
    import time as _time
    db_status: dict = {"configured": False}
    db_url = _os.environ.get("DATABASE_URL", "")
    if db_url:
        db_status["configured"] = True
        try:
            import psycopg  # type: ignore
            _t0 = _time.perf_counter()
            with psycopg.connect(db_url, connect_timeout=3) as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
                    cur.fetchone()
            db_status["ok"] = True
            db_status["latency_ms"] = round((_time.perf_counter() - _t0) * 1000, 2)
        except ImportError:
            db_status["ok"] = None
            db_status["note"] = "psycopg not installed"
        except Exception as e:
            db_status["ok"] = False
            db_status["error"] = str(e)[:120]

    return {
        "status": "ok",
        "version": "0.3.0",
        "timestamp": _time.time(),
        "subsystems": {
            "static_models": {
                "count": len(ALL_MODELS),
                "available": list(ALL_MODELS.keys()),
            },
            "motion_model": {
                "status": motion_status,
                "loaded": motion_status == "loaded",
            },
            "proxies": {
                "anthropic": bool(_os.environ.get("ANTHROPIC_API_KEY")),
                "elevenlabs": bool(_os.environ.get("ELEVENLABS_API_KEY")),
                "assemblyai": bool(_os.environ.get("ASSEMBLYAI_API_KEY")),
            },
            "rate_limit": {
                "enabled": _limiter is not None,
                "predict": _RL_PREDICT or "off",
                "proxy": _RL_PROXY or "off",
            },
            "database": db_status,
            "cors_origins": _origins if _origins != ["*"] else ["any (dev)"],
        },
    }


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest) -> PredictResponse:
    start = time.perf_counter()
    rgb = _decode_image(req.image)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    detection = detector.detect(mp_image)

    if not detection.hand_landmarks:
        return PredictResponse(
            letter=None,
            confidence=None,
            match=False if req.target else None,
            has_hand=False,
            latency_ms=(time.perf_counter() - start) * 1000.0,
        )

    # extract_relative_coords agora retorna (features_66, wrist_position) e exige
    # time_since_last_frame_ms + last_wrist_position pra calcular velocity da
    # mão (necessário pras letras J/Z em movimento). Pra reqs HTTP isoladas
    # passamos 0/None — velocity sai [0,0,0]. Modelos atuais foram treinados
    # com 63 features (só landmarks, sem velocity) então cortamos as 3 extras.
    features_full, _wrist = extract.extract_relative_coords(detection, 0, None)
    features = features_full[:63]
    model_name = (req.model or "knn").lower()
    if model_name == "ensemble":
        letter, confidence = _classify_ensemble(features)
    else:
        letter, confidence = _classify_with(model_name, features)
    match = letter.upper() == req.target.upper() if req.target else None
    return PredictResponse(
        letter=letter,
        confidence=confidence,
        match=match,
        has_hand=True,
        latency_ms=(time.perf_counter() - start) * 1000.0,
    )


@app.post("/predict-landmarks", response_model=PredictResponse)
def predict_landmarks(req: LandmarksRequest) -> PredictResponse:
    """Fast path — the client extracts landmarks on-device (MediaPipe Tasks
    is available for JS via @mediapipe/tasks-vision) and sends only the 21
    points, skipping the image round-trip entirely."""
    start = time.perf_counter()
    detection = _Detection(req.landmarks, req.handedness)
    features_full, _wrist = extract.extract_relative_coords(detection, 0, None)
    features = features_full[:63]  # modelos treinados sem velocity
    letter, confidence = _classify(features)
    match = letter.upper() == req.target.upper() if req.target else None
    return PredictResponse(
        letter=letter,
        confidence=confidence,
        match=match,
        has_hand=True,
        latency_ms=(time.perf_counter() - start) * 1000.0,
    )


def _hand_landmarks_per_frame(frames_b64: list[str]) -> list[Optional[list[tuple[float, float]]]]:
    """Roda MediaPipe em cada frame, retorna lista de 21 landmarks (x,y) ou None."""
    out: list[Optional[list[tuple[float, float]]]] = []
    for b64 in frames_b64:
        try:
            rgb = _decode_image(b64)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            detection = detector.detect(mp_image)
            if not detection.hand_landmarks:
                out.append(None)
            else:
                points = [(p.x, p.y) for p in detection.hand_landmarks[0]]
                out.append(points)
        except Exception:
            out.append(None)
    return out


def _classify_motion(frames_landmarks: list[Optional[list[tuple[float, float]]]]) -> tuple[Optional[str], float, str]:
    """Heurísticas leves pras letras dinâmicas J e Z.

    Não substituem um modelo de sequência treinado — são aproximação que olha
    a trajetória de UM landmark-chave ao longo dos frames. Funciona melhor com
    captura ~10–15 fps e mão centralizada.

    J: ponta do mindinho (landmark 20) desce e curva pra direita no fim.
    Z: ponta do indicador (landmark 8) faz zigue-zague — direita → diagonal
       baixo-esquerda → direita.
    """
    valid_frames = [(i, lm) for i, lm in enumerate(frames_landmarks) if lm is not None]
    if len(valid_frames) < 4:
        return None, 0.0, "insufficient_frames_with_hand"

    # Trajetória do mindinho (pinky tip = 20) e indicador (index tip = 8)
    pinky = [(lm[20][0], lm[20][1]) for _, lm in valid_frames]
    index = [(lm[8][0], lm[8][1]) for _, lm in valid_frames]

    # --- Heurística J ---
    # J em Libras: mindinho estendido faz um traço pra baixo e curva pra direita.
    # Exige BOTH (queda significativa + curva no fim) — antes uma só já contava
    # e gerava muito falso positivo (qualquer mão se mexendo virava J).
    px = [p[0] for p in pinky]
    py = [p[1] for p in pinky]
    py_drop = py[-1] - py[0]  # diferença direcional (positivo = desceu)
    mid = len(pinky) // 2
    px_curve = px[-1] - px[mid]  # quanto curvou pra direita na 2ª metade
    j_score = 0.0
    has_drop = py_drop > 0.12 and (max(py) - min(py)) > 0.12
    has_curve = px_curve > 0.06
    if has_drop and has_curve:
        j_score = 0.5 + min(py_drop / 0.30, 1.0) * 0.25 + min(px_curve / 0.15, 1.0) * 0.25

    # --- Heurística Z ---
    # Z: indicador faz 3 traços — direita, diagonal pra baixo-esquerda, direita.
    # Exige os 3 segmentos com magnitude suficiente.
    ix = [p[0] for p in index]
    iy = [p[1] for p in index]
    n = len(index)
    seg1_x = ix[: n // 3]
    seg2_x = ix[n // 3 : 2 * n // 3]
    seg3_x = ix[2 * n // 3 :]
    z_score = 0.0
    if seg1_x and seg2_x and seg3_x:
        rises_1 = seg1_x[-1] - seg1_x[0]
        falls_2 = seg2_x[0] - seg2_x[-1]
        rises_3 = seg3_x[-1] - seg3_x[0]
        all_three = rises_1 > 0.05 and falls_2 > 0.05 and rises_3 > 0.05
        if all_three:
            z_score = 0.55 + min((rises_1 + falls_2 + rises_3) / 0.60, 1.0) * 0.4

    if j_score >= z_score and j_score >= 0.65:
        return "J", min(j_score, 0.95), f"pinky_dy={py_drop:.2f} curve={px_curve:.2f}"
    if z_score >= 0.70:
        return "Z", min(z_score, 0.95), f"index_zigzag score={z_score:.2f}"
    return None, max(j_score, z_score), "below_threshold"


def _preprocess_sequence_for_lstm(
    frames: list[Optional[list[tuple[float, float]]]],
) -> Optional[np.ndarray]:
    """Roda forward-fill + resample + normaliza, mesma lógica do preprocess.py.
    Retorna tensor (target_frames, 42) ou None se a sequência for inutilizável."""
    valid = [(i, lm) for i, lm in enumerate(frames) if lm is not None]
    if len(valid) < 4:
        return None

    # Converte pra (N, 21, 2) com NaN onde não havia mão
    n = len(frames)
    seq = np.full((n, 21, 2), np.nan, dtype=np.float32)
    for i, lm in valid:
        seq[i] = np.array(lm, dtype=np.float32)

    # Forward fill (mesma lógica do preprocess.py)
    last_valid: Optional[np.ndarray] = None
    for i in range(n):
        if np.isnan(seq[i]).all():
            if last_valid is None:
                for j in range(i + 1, n):
                    if not np.isnan(seq[j]).all():
                        last_valid = seq[j]
                        seq[i] = seq[j]
                        break
            else:
                seq[i] = last_valid
        else:
            last_valid = seq[i]

    if np.isnan(seq).any():
        return None

    # Resample linear pra target_frames
    target = motion_target_frames
    if n != target:
        src_t = np.linspace(0.0, 1.0, n)
        dst_t = np.linspace(0.0, 1.0, target)
        out = np.empty((target, 21, 2), dtype=np.float32)
        for j in range(21):
            for k in range(2):
                out[:, j, k] = np.interp(dst_t, src_t, seq[:, j, k])
        seq = out

    # Normaliza: centraliza no pulso + escala pelo span
    wrist = seq[:, 0:1, :]
    seq = seq - wrist
    span = float(np.max(np.abs(seq)))
    if span > 1e-6:
        seq = seq / span

    return seq.reshape(target, 42).astype(np.float32)


@app.post("/predict-motion-v2", response_model=MotionResponse)
def predict_motion_v2(req: MotionRequest) -> MotionResponse:
    """Versão preferida — usa o modelo LSTM treinado quando disponível.
    Fallback transparente pra heurística se o modelo não pôde ser carregado."""
    start = time.perf_counter()
    frames = _hand_landmarks_per_frame(req.frames)
    has_hand = sum(1 for f in frames if f is not None)

    if motion_model is None:
        letter, confidence, info = _classify_motion(frames)
        info = f"fallback_heuristic({motion_status}) {info}"
    else:
        import torch  # local import — só pesa se LSTM carregou no boot

        x = _preprocess_sequence_for_lstm(frames)
        if x is None:
            letter, confidence, info = None, 0.0, "insufficient_frames"
        else:
            with torch.no_grad():
                logits = motion_model(torch.from_numpy(x).unsqueeze(0))
                probs = torch.softmax(logits, dim=1)[0]
                pred_idx = int(probs.argmax().item())
                confidence = float(probs[pred_idx].item())
                letter = motion_labels[pred_idx]
                # Filtra classe negativa "OTHER" e confiança baixa
                if letter == "OTHER" or confidence < 0.5:
                    letter, info = None, f"low_confidence_or_other({confidence:.2f})"
                else:
                    info = f"lstm_pred={letter} confidence={confidence:.2f}"

    match = (
        letter.upper() == req.target.upper()
        if letter and req.target
        else (False if req.target else None)
    )
    return MotionResponse(
        letter=letter,
        confidence=confidence,
        match=match,
        has_hand_in_frames=has_hand,
        total_frames=len(req.frames),
        detected_motion=info,
        latency_ms=(time.perf_counter() - start) * 1000.0,
    )


@app.post("/predict-motion", response_model=MotionResponse)
def predict_motion(req: MotionRequest) -> MotionResponse:
    start = time.perf_counter()
    frames = _hand_landmarks_per_frame(req.frames)
    has_hand = sum(1 for f in frames if f is not None)
    letter, confidence, info = _classify_motion(frames)
    match = (
        letter.upper() == req.target.upper()
        if letter and req.target
        else (False if req.target else None)
    )
    return MotionResponse(
        letter=letter,
        confidence=confidence,
        match=match,
        has_hand_in_frames=has_hand,
        total_frames=len(req.frames),
        detected_motion=info,
        latency_ms=(time.perf_counter() - start) * 1000.0,
    )


# ─────────────────────────────────────────────────────────────────────
# WebSocket /predict-ws — real-time low-latency.
#
# Cliente envia mensagens JSON: {"image": "<b64>", "target": "A", "model": "knn"}
# Server retorna por frame: {"letter": "A", "confidence": 0.93, "match": true,
#   "has_hand": true, "latency_ms": 42}
#
# Vantagens vs HTTP POST /predict:
#   - Reaproveita conexão TCP/TLS — sem overhead por frame
#   - Sem header HTTP por frame — ~150 bytes a menos
#   - Server pode descartar frames se backpressure (cliente envia muito rápido)
# ─────────────────────────────────────────────────────────────────────
from fastapi import WebSocket, WebSocketDisconnect


@app.websocket("/predict-ws")
async def predict_ws(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            payload = await websocket.receive_json()
            start = time.perf_counter()
            image_b64 = payload.get("image", "")
            target = payload.get("target")
            model_name = (payload.get("model") or "knn").lower()
            if not image_b64:
                await websocket.send_json({"error": "missing image"})
                continue
            try:
                rgb = _decode_image(image_b64)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                detection = detector.detect(mp_image)
                if not detection.hand_landmarks:
                    await websocket.send_json({
                        "letter": None,
                        "confidence": None,
                        "match": False if target else None,
                        "has_hand": False,
                        "latency_ms": (time.perf_counter() - start) * 1000.0,
                    })
                    continue
                features_full, _wrist = extract.extract_relative_coords(detection, 0, None)
                features = features_full[:63]  # modelos treinados sem velocity
                if model_name == "ensemble":
                    letter, confidence = _classify_ensemble(features)
                else:
                    letter, confidence = _classify_with(model_name, features)
                match = (
                    letter.upper() == str(target).upper()
                    if target
                    else None
                )
                await websocket.send_json({
                    "letter": letter,
                    "confidence": confidence,
                    "match": match,
                    "has_hand": True,
                    "latency_ms": (time.perf_counter() - start) * 1000.0,
                })
            except Exception as e:
                await websocket.send_json({"error": str(e)})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[ws] error: {e}")


# ─────────────────────────────────────────────────────────────────────
# Proxy endpoints — pra esconder as keys de IA do bundle do client.
#
# Hoje o client tem EXPO_PUBLIC_ANTHROPIC_API_KEY (e ElevenLabs, AssemblyAI)
# inlined no JS, o que é OK em dev/TCC mas não pode ir pra produção pública.
#
# Solução: client com EXPO_PUBLIC_USE_PROXY=true chama esses endpoints aqui
# em vez dos providers direto. As keys ficam em variáveis de ambiente do
# server (nunca expostas ao client).
#
# Variáveis de ambiente esperadas em PROD (não em dev):
#   ANTHROPIC_API_KEY
#   ELEVENLABS_API_KEY
#   ASSEMBLYAI_API_KEY
#
# Auth: pra evitar abuso, exigimos um Bearer token simples. Em prod, trocar
# por validação do JWT do Clerk (já tem session.id no client).
# ─────────────────────────────────────────────────────────────────────
import urllib.request
import urllib.error
from fastapi import Request, Response
from fastapi.responses import StreamingResponse, JSONResponse

_PROXY_SECRET = _os.environ.get("DLIBRAS_PROXY_SECRET", "")
_ANTHROPIC_KEY = _os.environ.get("ANTHROPIC_API_KEY", "")
_ELEVENLABS_KEY = _os.environ.get("ELEVENLABS_API_KEY", "")
_ASSEMBLYAI_KEY = _os.environ.get("ASSEMBLYAI_API_KEY", "")


def _check_proxy_auth(req: Request) -> Optional[JSONResponse]:
    """Bearer token check — só se PROXY_SECRET estiver setado. Em dev (sem
    secret) deixa passar. Retorna JSONResponse de erro ou None."""
    if not _PROXY_SECRET:
        return None
    auth = req.headers.get("authorization", "")
    expected = f"Bearer {_PROXY_SECRET}"
    if auth != expected:
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    return None


@app.post("/api/anthropic/messages")
async def proxy_anthropic(req: Request):
    err = _check_proxy_auth(req)
    if err is not None:
        return err
    if not _ANTHROPIC_KEY:
        return JSONResponse({"error": "ANTHROPIC_API_KEY not configured on server"}, status_code=503)
    body_bytes = await req.body()
    try:
        upstream = urllib.request.Request(
            "https://api.anthropic.com/v1/messages",
            data=body_bytes,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "x-api-key": _ANTHROPIC_KEY,
                "anthropic-version": "2023-06-01",
            },
        )
        with urllib.request.urlopen(upstream, timeout=60) as resp:
            data = resp.read()
            return Response(content=data, media_type="application/json", status_code=resp.status)
    except urllib.error.HTTPError as e:
        return Response(content=e.read(), media_type="application/json", status_code=e.code)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


@app.post("/api/elevenlabs/tts")
async def proxy_elevenlabs(req: Request):
    """Proxy pra ElevenLabs TTS. Body: {voiceId, text, model_id, voice_settings}.
    Retorna audio/mpeg em bytes (igual à resposta original)."""
    err = _check_proxy_auth(req)
    if err is not None:
        return err
    if not _ELEVENLABS_KEY:
        return JSONResponse({"error": "ELEVENLABS_API_KEY not configured on server"}, status_code=503)
    payload = await req.json()
    voice_id = payload.pop("voiceId", "pFZP5JQG7iQjIQuC4Bku")
    output_format = payload.pop("output_format", "mp3_44100_128")
    try:
        upstream = urllib.request.Request(
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format={output_format}",
            data=json.dumps(payload).encode("utf-8"),
            method="POST",
            headers={
                "Content-Type": "application/json",
                "xi-api-key": _ELEVENLABS_KEY,
                "Accept": "audio/mpeg",
            },
        )
        with urllib.request.urlopen(upstream, timeout=60) as resp:
            return Response(content=resp.read(), media_type="audio/mpeg", status_code=resp.status)
    except urllib.error.HTTPError as e:
        return Response(content=e.read(), media_type="application/json", status_code=e.code)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


@app.api_route("/api/assemblyai/{rest:path}", methods=["GET", "POST"])
async def proxy_assemblyai(rest: str, req: Request):
    """Proxy genérico pra AssemblyAI — passa o path direto. Suporta upload,
    transcript creation e polling."""
    err = _check_proxy_auth(req)
    if err is not None:
        return err
    if not _ASSEMBLYAI_KEY:
        return JSONResponse({"error": "ASSEMBLYAI_API_KEY not configured on server"}, status_code=503)
    url = f"https://api.assemblyai.com/v2/{rest}"
    body = await req.body()
    headers = {"Authorization": _ASSEMBLYAI_KEY}
    if req.method == "POST" and body:
        # Content-Type: passa o que veio do cliente (json ou binário)
        ct = req.headers.get("content-type")
        if ct:
            headers["Content-Type"] = ct
    try:
        upstream = urllib.request.Request(
            url,
            data=body if req.method == "POST" else None,
            method=req.method,
            headers=headers,
        )
        with urllib.request.urlopen(upstream, timeout=60) as resp:
            return Response(
                content=resp.read(),
                media_type=resp.headers.get("Content-Type", "application/json"),
                status_code=resp.status,
            )
    except urllib.error.HTTPError as e:
        return Response(content=e.read(), media_type="application/json", status_code=e.code)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


# ─────────────────────────────────────────────────────────────────────
# Leaderboard endpoints — Postgres-backed.
#
# Frontend usa Clerk pra auth; manda user_id (ex: "user_abc123") + display_name
# no body. Schema é criado lazy no startup. Endpoints exigem o mesmo Bearer
# token do proxy (DLIBRAS_PROXY_SECRET), pra evitar spam de score fake.
#
# Sem DATABASE_URL configurado → todos os endpoints retornam 503 e o app
# segue rodando normalmente (degrade gracioso, igual aos proxies de IA).
# ─────────────────────────────────────────────────────────────────────
from datetime import datetime

# Schema criado no primeiro endpoint chamado; flag em memória evita re-CREATE.
_leaderboard_schema_ready: bool = False


def _get_db_conn():
    """Abre conexão psycopg lazy usando DATABASE_URL.
    Levanta HTTPException 503 se a env não tá setada ou psycopg não instalado.
    Caller é responsável por fechar (use `with`).
    """
    db_url = _os.environ.get("DATABASE_URL", "")
    if not db_url:
        raise HTTPException(
            status_code=503,
            detail={"error": "leaderboard requires DATABASE_URL"},
        )
    try:
        import psycopg  # type: ignore
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail={"error": "psycopg not installed on server"},
        ) from exc
    try:
        return psycopg.connect(db_url, connect_timeout=5)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=503,
            detail={"error": f"database connection failed: {str(exc)[:120]}"},
        ) from exc


def _ensure_leaderboard_schema() -> None:
    """Cria tabelas + índices se não existirem. Idempotente, roda só uma vez
    por processo (flag em memória). Se DATABASE_URL não tá setado, no-op."""
    global _leaderboard_schema_ready
    if _leaderboard_schema_ready:
        return
    db_url = _os.environ.get("DATABASE_URL", "")
    if not db_url:
        return  # sem DB, schema fica pendente; endpoints retornam 503
    try:
        with _get_db_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS users (
                      id TEXT PRIMARY KEY,
                      display_name TEXT NOT NULL,
                      avatar_emoji TEXT DEFAULT '🦊',
                      created_at TIMESTAMPTZ DEFAULT NOW(),
                      updated_at TIMESTAMPTZ DEFAULT NOW()
                    );
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS scores (
                      id BIGSERIAL PRIMARY KEY,
                      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                      xp INTEGER NOT NULL,
                      lessons_completed INTEGER NOT NULL DEFAULT 0,
                      streak INTEGER NOT NULL DEFAULT 0,
                      hearts INTEGER NOT NULL DEFAULT 5,
                      recorded_at TIMESTAMPTZ DEFAULT NOW(),
                      week_of TIMESTAMPTZ NOT NULL
                    );
                    """
                )
                cur.execute("CREATE INDEX IF NOT EXISTS idx_scores_user ON scores(user_id);")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_scores_week ON scores(week_of DESC);")
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_scores_xp_week ON scores(week_of DESC, xp DESC);"
                )
            conn.commit()
        _leaderboard_schema_ready = True
        print("[leaderboard] schema ready (tables + indexes)")
    except HTTPException:
        # repassa; provavelmente DATABASE_URL inválido — endpoints individuais
        # também vão falhar com 503 e o usuário vê a msg.
        raise
    except Exception as e:
        print(f"[leaderboard] schema init failed: {e}")


@app.on_event("startup")
def _startup_leaderboard() -> None:
    """Tenta criar schema no boot. Falha silenciosa — endpoints repropagam o erro."""
    try:
        _ensure_leaderboard_schema()
    except HTTPException as e:
        print(f"[leaderboard] startup deferred: {e.detail}")
    except Exception as e:  # noqa: BLE001
        print(f"[leaderboard] startup error: {e}")


# ─────────────────────────────────────────────────────────────────────
# Pydantic models
# ─────────────────────────────────────────────────────────────────────
class UpsertUserRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=128)
    display_name: str = Field(..., min_length=1, max_length=80)
    avatar_emoji: Optional[str] = Field("🦊", max_length=8)


class SubmitScoreRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=128)
    xp: int = Field(..., ge=0, le=1_000_000)
    lessons_completed: int = Field(0, ge=0, le=10_000)
    streak: int = Field(0, ge=0, le=10_000)
    hearts: int = Field(5, ge=0, le=100)


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: str
    display_name: str
    avatar_emoji: str
    xp: int
    lessons_completed: int
    streak: int


# ─────────────────────────────────────────────────────────────────────
# Helpers SQL — semana atual = date_trunc('week', NOW()) (segunda-feira UTC)
# ─────────────────────────────────────────────────────────────────────
def _weekly_top_query(limit: int) -> tuple[str, tuple]:
    sql = """
        SELECT
          u.id AS user_id,
          u.display_name,
          u.avatar_emoji,
          COALESCE(SUM(s.xp), 0)::INT AS total_xp,
          COALESCE(SUM(s.lessons_completed), 0)::INT AS total_lessons,
          COALESCE(MAX(s.streak), 0)::INT AS best_streak
        FROM users u
        JOIN scores s ON s.user_id = u.id
        WHERE s.week_of = date_trunc('week', NOW())
        GROUP BY u.id, u.display_name, u.avatar_emoji
        ORDER BY total_xp DESC, u.id ASC
        LIMIT %s
    """
    return sql, (limit,)


def _all_time_top_query(limit: int) -> tuple[str, tuple]:
    sql = """
        SELECT
          u.id AS user_id,
          u.display_name,
          u.avatar_emoji,
          COALESCE(SUM(s.xp), 0)::INT AS total_xp,
          COALESCE(SUM(s.lessons_completed), 0)::INT AS total_lessons,
          COALESCE(MAX(s.streak), 0)::INT AS best_streak
        FROM users u
        JOIN scores s ON s.user_id = u.id
        GROUP BY u.id, u.display_name, u.avatar_emoji
        ORDER BY total_xp DESC, u.id ASC
        LIMIT %s
    """
    return sql, (limit,)


def _user_weekly_rank(cur, user_id: str) -> Optional[int]:
    """Retorna o rank do user no leaderboard semanal, ou None se ele não tá lá."""
    cur.execute(
        """
        WITH weekly AS (
          SELECT user_id, SUM(xp)::INT AS xp_sum
          FROM scores
          WHERE week_of = date_trunc('week', NOW())
          GROUP BY user_id
        ), ranked AS (
          SELECT user_id, xp_sum,
            RANK() OVER (ORDER BY xp_sum DESC, user_id ASC) AS r
          FROM weekly
        )
        SELECT r FROM ranked WHERE user_id = %s
        """,
        (user_id,),
    )
    row = cur.fetchone()
    return int(row[0]) if row else None


def _user_all_time_rank(cur, user_id: str) -> Optional[int]:
    cur.execute(
        """
        WITH alltime AS (
          SELECT user_id, SUM(xp)::INT AS xp_sum
          FROM scores
          GROUP BY user_id
        ), ranked AS (
          SELECT user_id, xp_sum,
            RANK() OVER (ORDER BY xp_sum DESC, user_id ASC) AS r
          FROM alltime
        )
        SELECT r FROM ranked WHERE user_id = %s
        """,
        (user_id,),
    )
    row = cur.fetchone()
    return int(row[0]) if row else None


# ─────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────
def _maybe_rate_limit(spec: str):
    """Wrapper que aplica _limiter.limit() só se slowapi tá instalado.
    Permite decoradores condicionais sem if/else duplicado no source."""
    if _limiter is None:
        def _noop(fn):
            return fn
        return _noop
    return _limiter.limit(spec)


@app.post("/api/leaderboard/upsert-user")
async def leaderboard_upsert_user(request: Request, body: UpsertUserRequest):
    err = _check_proxy_auth(request)
    if err is not None:
        return err
    _ensure_leaderboard_schema()
    avatar = body.avatar_emoji or "🦊"
    try:
        with _get_db_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO users (id, display_name, avatar_emoji, updated_at)
                    VALUES (%s, %s, %s, NOW())
                    ON CONFLICT (id) DO UPDATE SET
                      display_name = EXCLUDED.display_name,
                      avatar_emoji = EXCLUDED.avatar_emoji,
                      updated_at = NOW()
                    """,
                    (body.user_id, body.display_name, avatar),
                )
            conn.commit()
        return {"ok": True, "user_id": body.user_id}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        return JSONResponse({"error": str(e)[:200]}, status_code=500)


@app.post("/api/leaderboard/submit-score")
async def leaderboard_submit_score(request: Request, body: SubmitScoreRequest):
    err = _check_proxy_auth(request)
    if err is not None:
        return err
    _ensure_leaderboard_schema()
    try:
        with _get_db_conn() as conn:
            with conn.cursor() as cur:
                # Garante que o user existe — sem cadastro prévio cria placeholder.
                # Isso evita FK error caso o client envie score antes de upsert-user.
                cur.execute(
                    """
                    INSERT INTO users (id, display_name, avatar_emoji)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (id) DO NOTHING
                    """,
                    (body.user_id, body.user_id[:30], "🦊"),
                )
                cur.execute(
                    """
                    INSERT INTO scores (user_id, xp, lessons_completed, streak, hearts, week_of)
                    VALUES (%s, %s, %s, %s, %s, date_trunc('week', NOW()))
                    """,
                    (
                        body.user_id,
                        body.xp,
                        body.lessons_completed,
                        body.streak,
                        body.hearts,
                    ),
                )
                conn.commit()
                rank_weekly = _user_weekly_rank(cur, body.user_id)
                rank_all_time = _user_all_time_rank(cur, body.user_id)
        return {
            "ok": True,
            "rank_weekly": rank_weekly,
            "rank_all_time": rank_all_time,
        }
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        return JSONResponse({"error": str(e)[:200]}, status_code=500)


@app.get("/api/leaderboard/weekly")
@_maybe_rate_limit("30/minute")
async def leaderboard_weekly(request: Request, limit: int = 50):
    err = _check_proxy_auth(request)
    if err is not None:
        return err
    _ensure_leaderboard_schema()
    limit = max(1, min(limit, 200))
    try:
        with _get_db_conn() as conn:
            with conn.cursor() as cur:
                sql, params = _weekly_top_query(limit)
                cur.execute(sql, params)
                rows = cur.fetchall()
        entries: list[dict] = []
        for idx, row in enumerate(rows, start=1):
            entries.append(
                {
                    "rank": idx,
                    "user_id": row[0],
                    "display_name": row[1],
                    "avatar_emoji": row[2] or "🦊",
                    "xp": int(row[3]),
                    "lessons_completed": int(row[4]),
                    "streak": int(row[5]),
                }
            )
        return entries
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        return JSONResponse({"error": str(e)[:200]}, status_code=500)


@app.get("/api/leaderboard/all-time")
@_maybe_rate_limit("30/minute")
async def leaderboard_all_time(request: Request, limit: int = 50):
    err = _check_proxy_auth(request)
    if err is not None:
        return err
    _ensure_leaderboard_schema()
    limit = max(1, min(limit, 200))
    try:
        with _get_db_conn() as conn:
            with conn.cursor() as cur:
                sql, params = _all_time_top_query(limit)
                cur.execute(sql, params)
                rows = cur.fetchall()
        entries: list[dict] = []
        for idx, row in enumerate(rows, start=1):
            entries.append(
                {
                    "rank": idx,
                    "user_id": row[0],
                    "display_name": row[1],
                    "avatar_emoji": row[2] or "🦊",
                    "xp": int(row[3]),
                    "lessons_completed": int(row[4]),
                    "streak": int(row[5]),
                }
            )
        return entries
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        return JSONResponse({"error": str(e)[:200]}, status_code=500)


@app.get("/api/leaderboard/around-me")
@_maybe_rate_limit("30/minute")
async def leaderboard_around_me(request: Request, user_id: str, window: int = 5):
    """Retorna o usuário no centro + `window` acima e abaixo no ranking semanal.
    Útil pra "você está em 47º" quando ele não cai no top 50."""
    err = _check_proxy_auth(request)
    if err is not None:
        return err
    _ensure_leaderboard_schema()
    window = max(0, min(window, 50))
    try:
        with _get_db_conn() as conn:
            with conn.cursor() as cur:
                user_rank = _user_weekly_rank(cur, user_id)
                if user_rank is None:
                    # Usuário não tem score essa semana — retorna estrutura vazia
                    # com flag pra UI mostrar "envie um score pra entrar no ranking".
                    return {
                        "user_rank": None,
                        "entries": [],
                        "note": "user has no score this week",
                    }
                lo = max(1, user_rank - window)
                hi = user_rank + window
                cur.execute(
                    """
                    WITH weekly AS (
                      SELECT
                        u.id AS user_id,
                        u.display_name,
                        u.avatar_emoji,
                        SUM(s.xp)::INT AS xp_sum,
                        SUM(s.lessons_completed)::INT AS lessons_sum,
                        MAX(s.streak)::INT AS streak_max
                      FROM users u
                      JOIN scores s ON s.user_id = u.id
                      WHERE s.week_of = date_trunc('week', NOW())
                      GROUP BY u.id, u.display_name, u.avatar_emoji
                    ), ranked AS (
                      SELECT *,
                        RANK() OVER (ORDER BY xp_sum DESC, user_id ASC) AS r
                      FROM weekly
                    )
                    SELECT r, user_id, display_name, avatar_emoji, xp_sum, lessons_sum, streak_max
                    FROM ranked
                    WHERE r BETWEEN %s AND %s
                    ORDER BY r ASC
                    """,
                    (lo, hi),
                )
                rows = cur.fetchall()
        entries: list[dict] = []
        for row in rows:
            entries.append(
                {
                    "rank": int(row[0]),
                    "user_id": row[1],
                    "display_name": row[2],
                    "avatar_emoji": row[3] or "🦊",
                    "xp": int(row[4]),
                    "lessons_completed": int(row[5]),
                    "streak": int(row[6]),
                }
            )
        return {"user_rank": user_rank, "entries": entries}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        return JSONResponse({"error": str(e)[:200]}, status_code=500)


@app.get("/api/leaderboard/me")
@_maybe_rate_limit("30/minute")
async def leaderboard_me(request: Request, user_id: str):
    """Stats consolidadas pro user: XP total, XP da semana, ranks, streak max."""
    err = _check_proxy_auth(request)
    if err is not None:
        return err
    _ensure_leaderboard_schema()
    try:
        with _get_db_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT
                      COALESCE(SUM(xp), 0)::INT AS total_xp,
                      COALESCE(SUM(xp) FILTER (WHERE week_of = date_trunc('week', NOW())), 0)::INT AS weekly_xp,
                      COALESCE(MAX(streak), 0)::INT AS best_streak,
                      COALESCE(SUM(lessons_completed), 0)::INT AS total_lessons,
                      COUNT(*)::INT AS sessions
                    FROM scores
                    WHERE user_id = %s
                    """,
                    (user_id,),
                )
                stats_row = cur.fetchone()
                weekly_rank = _user_weekly_rank(cur, user_id)
                all_time_rank = _user_all_time_rank(cur, user_id)
                # Display name + avatar (se já cadastrado)
                cur.execute(
                    "SELECT display_name, avatar_emoji FROM users WHERE id = %s",
                    (user_id,),
                )
                user_row = cur.fetchone()
        if stats_row is None:
            stats_row = (0, 0, 0, 0, 0)
        display_name = user_row[0] if user_row else None
        avatar_emoji = (user_row[1] if user_row else None) or "🦊"
        return {
            "user_id": user_id,
            "display_name": display_name,
            "avatar_emoji": avatar_emoji,
            "total_xp": int(stats_row[0]),
            "weekly_xp": int(stats_row[1]),
            "streak": int(stats_row[2]),
            "total_lessons": int(stats_row[3]),
            "sessions": int(stats_row[4]),
            "weekly_rank": weekly_rank,
            "all_time_rank": all_time_rank,
        }
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        return JSONResponse({"error": str(e)[:200]}, status_code=500)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")
