# /// script
# requires-python = ">=3.11,<3.13"
# dependencies = [
#   "torch>=2.4,<2.14",
#   "transformers",
#   "litert-torch==0.9.4",
#   "numpy",
# ]
#
# [tool.uv]
# index = [{ name = "pytorch-cpu", url = "https://download.pytorch.org/whl/cpu", explicit = true }]
#
# [tool.uv.sources]
# torch = { index = "pytorch-cpu" }
# ///
"""
Exports DINOv2 ViT-S/14 to TFLite for the scanner's on-device embeddings.

  Input:  [1, 224, 224, 3] float32, RGB, ImageNet-normalized (NHWC).
          src/features/scanner/preprocess.ts builds this tensor.
  Output: [1, 384] float32, the CLS token after the final layer norm.
          Not L2-normalized; the app normalizes it.

Weights are stored as fp16 (about half the size) and computed in fp32.

The checkpoint's position embeddings are for 518 px. DINOv2 resizes them with
bicubic interpolation on every call, which TFLite cannot lower, so the 224 px
version is computed once here and baked in as a constant.

Usage (from the repo root):  uv run scripts/export_dinov2.py
"""

import tempfile
from pathlib import Path

import numpy as np
import torch
from ai_edge_litert.interpreter import Interpreter
from ai_edge_quantizer import quantizer
from transformers import Dinov2Model

import litert_torch

MODEL_ID = "facebook/dinov2-small"
SIZE = 224
OUT = Path(__file__).resolve().parent.parent / "assets" / "models" / "dinov2_vits14.tflite"

FP16_WEIGHTS = [
    {
        "regex": ".*",
        "operation": "*",
        "algorithm_key": "float_casting",
        "op_config": {
            "weight_tensor_config": {"num_bits": 16, "dtype": "FLOAT"},
            "compute_precision": "FLOAT",
            "explicit_dequantize": True,
        },
    }
]


class Embedder(torch.nn.Module):
    def __init__(self, model: Dinov2Model):
        super().__init__()
        self.model = model

    def forward(self, nhwc: torch.Tensor) -> torch.Tensor:
        # TFLite (and its GPU delegate) is NHWC; the model is NCHW.
        out = self.model(pixel_values=nhwc.permute(0, 3, 1, 2))
        return out.pooler_output


def main():
    model = Dinov2Model.from_pretrained(MODEL_ID).eval()

    with torch.no_grad():
        emb = model.embeddings
        tokens = (SIZE // emb.config.patch_size) ** 2 + 1
        dummy = torch.zeros(1, tokens, emb.config.hidden_size)
        fixed_pos = emb.interpolate_pos_encoding(dummy, SIZE, SIZE).detach().clone()
    emb.interpolate_pos_encoding = lambda embeddings, height, width: fixed_pos

    module = Embedder(model).eval()
    edge = litert_torch.convert(module, (torch.randn(1, SIZE, SIZE, 3),))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        fp32 = Path(tmp) / "fp32.tflite"
        edge.export(str(fp32))
        qt = quantizer.Quantizer(str(fp32), FP16_WEIGHTS)
        OUT.write_bytes(qt.quantize().quantized_model)

    # Parity check: the shipped file against PyTorch on fresh inputs.
    interp = Interpreter(model_path=str(OUT))
    interp.allocate_tensors()
    inp = interp.get_input_details()[0]
    out = interp.get_output_details()[0]
    worst = 1.0
    for seed in range(5):
        x = torch.randn(1, SIZE, SIZE, 3, generator=torch.Generator().manual_seed(seed))
        with torch.no_grad():
            ref = module(x).numpy().ravel()
        interp.set_tensor(inp["index"], x.numpy())
        interp.invoke()
        got = interp.get_tensor(out["index"]).ravel()
        cos = float(np.dot(ref, got) / (np.linalg.norm(ref) * np.linalg.norm(got)))
        worst = min(worst, cos)
    print(f"Input {inp['shape'].tolist()} {inp['dtype'].__name__}, output {out['shape'].tolist()} {out['dtype'].__name__}")
    print(f"Wrote {OUT} ({OUT.stat().st_size / 1e6:.1f} MB); worst cosine vs PyTorch: {worst:.6f}")
    if worst < 0.999:
        raise SystemExit("TFLite output does not match PyTorch")


if __name__ == "__main__":
    main()
