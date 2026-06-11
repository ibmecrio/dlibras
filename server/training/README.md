# Motion LSTM training pipeline (DLibras)

Treina um classificador de letras dinâmicas do alfabeto Libras (J, Z, H, K, X)
a partir de sequências de landmarks da mão.

## Status

- Scaffold pronto e validado (importa limpo, CLI funciona).
- Dataset rotulado das 5 letras dinâmicas ainda **não foi coletado**.
- Quando o `models/motion_lstm.pt` existir, o `api_server.py` carrega o modelo
  automaticamente no boot via `_try_load_motion_model()` e usa em
  `/predict-motion-v2`. Sem o arquivo, ele cai no fallback heurístico atual
  (que só reconhece J e Z aproximadamente).

## Pipeline

```
vídeo bruto (.mp4)         landmarks pre-extraídos (.npy)        CSV de landmarks
  │  (frame-a-frame)         │                                       │
  └─ MediaPipe HandLandmarker┘                                       │
       │                                                              │
       └─→ MotionDataset (forward-fill, resample, normaliza) ←────────┘
                │
                ├─ augment (mirror + time-warp)  ──→  Train (80%)
                └─                                    Val   (20%)
                                                       │
                                          BiLSTM(2 cam, h=128, bi)
                                                       │
                                          Linear → ReLU → Dropout → Linear
                                                       │
                                          softmax sobre {J, Z, H, K, X}

                                                       │
                                            AdamW + CrossEntropyLoss
                                                       │
                                  best val_acc → motion_lstm.pt + .meta.json
```

## Como rodar

### Opção 1: CSV de landmarks pre-extraídos

CSV no formato:

```
sample_id, frame_idx, x0, y0, z0, ..., x20, y20, z20, label
```

Cada `sample_id` é uma sequência. Cada linha é um frame.

```bash
python -m server.training.train_motion_lstm --csv /opt/dlibras/dataset/landmarks_motion.csv
```

> Atenção: o `landmarks_training.csv` que já existe em
> `Digital-Inclusion-…-Libras-Recognition/` é de **pose estática** (1 linha por
> amostra, sem sequência). Não dá pra treinar LSTM com ele — o script vai
> avisar e não vai carregar nada. Pra esse pipeline você precisa de um CSV
> novo que tenha `sample_id` + `frame_idx`.

### Opção 2: NPYs por letra (recomendado)

Estrutura:

```
dataset/motion/
├── J/sample_001.npy   (N_frames, 21, 2 ou 3)
├── J/sample_002.npy
├── Z/sample_001.npy
├── H/sample_001.npy
├── K/sample_001.npy
└── X/sample_001.npy
```

Coleta com o `collect_landmarks.py` do repo de visão
(`Digital-Inclusion-…-Libras-Recognition/training/collect_landmarks.py`).

```bash
python -m server.training.train_motion_lstm --npy-dir ./dataset/motion/
```

### Opção 3: Vídeos brutos

Estrutura:

```
dataset/videos/
├── J/letra_j_001.mp4
├── Z/letra_z_001.mp4
└── ...
```

Requer MediaPipe (lento — pre-extraia se for treinar muitas vezes).

```bash
python -m server.training.train_motion_lstm --video-dir ./dataset/videos/
```

### Opção 4: Autodetect

Aponta pro `--data-dir` e o script escolhe sozinho entre CSV, NPY ou vídeo.

```bash
python -m server.training.train_motion_lstm --data-dir /opt/dlibras/dataset/
```

## Saída

Em `--output-dir` (default `./models/`):

- `motion_lstm.pt` — state_dict + metadados embutidos (labels, hidden,
  input_size, val_acc, train_loss, created_at).
- `motion_lstm.meta.json` — só os metadados, formato JSON. O `api_server.py`
  lê esse arquivo no boot pra reconstruir a arquitetura sem precisar do
  module de treino.

Para ativar no API:

```bash
cp models/motion_lstm.pt        ../Digital-Inclusion-...-Libras-Recognition/models/
cp models/motion_lstm.meta.json ../Digital-Inclusion-...-Libras-Recognition/models/
# Reinicia o api_server — _try_load_motion_model() vai logar "loaded".
```

## Hyperparâmetros default

| Flag             | Default | Notas                                          |
| ---------------- | ------- | ---------------------------------------------- |
| `--epochs`       | 50      | Early stopping geralmente para antes.          |
| `--batch-size`   | 32      |                                                |
| `--lr`           | 1e-3    |                                                |
| `--weight-decay` | 1e-4    | AdamW.                                         |
| `--val-split`    | 0.2     | 80/20.                                         |
| `--hidden`       | 128     | Por direção do BiLSTM → output 256.            |
| `--patience`     | 5       | Early stopping em val_acc.                     |
| `--target-frames`| 24      | 1.5s @ 16fps. Igual ao preprocess.py de visão. |
| `--seed`         | 42      |                                                |

## Pré-requisitos

```bash
pip install torch numpy pandas
# Pra processamento de vídeo bruto (opcional):
pip install mediapipe opencv-python
```

Python 3.10–3.13 (MediaPipe ainda não tem wheel pra 3.14).

## Próximos passos

1. Coletar 50–100 amostras por letra usando o `collect_landmarks.py` de visão.
2. Rodar este script → gera `.pt` + `.meta.json`.
3. Copiar pros models do `api_server` → endpoint LSTM ativo automaticamente.
4. Validar com `curl POST /predict-motion-v2` mandando uma sequência de
   frames pra confirmar que `motion_status` no `/health` virou `loaded`.
