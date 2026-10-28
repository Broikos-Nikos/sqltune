"""What train.py and predict.py share: the base model, pinned to one revision, and how a question becomes a prompt."""
from __future__ import annotations

import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = "Qwen/Qwen2.5-Coder-1.5B-Instruct"
# the main branch of the base model on 2026-10-28; pinned so a later upload cannot change what was measured
REVISION = "2e1fd397ee46e1388853d2af2c993145b0f1098a"
ADAPTER = ROOT / "adapter"
SEED = 7


def rows(name: str) -> list[dict]:
    return [json.loads(line) for line in (ROOT / "data" / name).read_text(encoding="utf-8").splitlines() if line]


def prompt(tok, row: dict) -> str:
    """The chat template up to the point the model starts answering: the same text for training and for prediction."""
    messages = [{"role": "system", "content": row["system"]}, {"role": "user", "content": row["user"]}]
    return tok.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
