"""Asks a model every question in data/test.jsonl and writes what it answered.

    uv run python predict.py            # the base model, to eval/predictions-base.jsonl
    uv run python predict.py --tuned    # the base model with adapter/, to eval/predictions-tuned.jsonl

Greedy decoding, in batches of 16 with left padding, at most 160 new tokens.
Nothing is scored here: `npm run score` runs every answer on data/shop.sqlite,
so the scores can be checked again on any machine from the committed answers.
The run's settings and timing go to eval/run-<name>.json.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import platform
import time

import peft
import torch
import transformers
from transformers import AutoModelForCausalLM, AutoTokenizer

from common import ADAPTER, BASE, REVISION, ROOT, SEED, prompt, rows

BATCH = 16
MAX_NEW = 160


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tuned", action="store_true")
    name = "tuned" if ap.parse_args().tuned else "base"
    torch.manual_seed(SEED)

    tok = AutoTokenizer.from_pretrained(BASE, revision=REVISION, padding_side="left")
    model = AutoModelForCausalLM.from_pretrained(BASE, revision=REVISION, dtype=torch.bfloat16).to("cuda")
    adapter_sha = None
    if name == "tuned":
        model = peft.PeftModel.from_pretrained(model, ADAPTER)
        adapter_sha = hashlib.sha256((ADAPTER / "adapter_model.safetensors").read_bytes()).hexdigest()
    model.eval()
    end = tok.convert_tokens_to_ids("<|im_end|>")
    pad = tok.pad_token_id if tok.pad_token_id is not None else end

    test = rows("test.jsonl")
    out = []
    t0 = time.time()
    for b in range(0, len(test), BATCH):
        batch = test[b:b + BATCH]
        enc = tok([prompt(tok, r) for r in batch], return_tensors="pt", padding=True, add_special_tokens=False).to("cuda")
        with torch.no_grad():
            gen = model.generate(**enc, max_new_tokens=MAX_NEW, do_sample=False, temperature=None, top_p=None, top_k=None, pad_token_id=pad, eos_token_id=end)
        for r, g in zip(batch, gen):
            out.append({"id": r["id"], "output": tok.decode(g[enc.input_ids.shape[1]:], skip_special_tokens=True)})
        print(f"{name}: {len(out)}/{len(test)}", flush=True)
    seconds = round(time.time() - t0, 1)

    (ROOT / "eval").mkdir(exist_ok=True)
    (ROOT / "eval" / f"predictions-{name}.jsonl").write_text("".join(json.dumps(o, ensure_ascii=False) + "\n" for o in out), encoding="utf-8", newline="\n")
    run = {
        "model": name, "base": BASE, "revision": REVISION, "adapter_sha256": adapter_sha,
        "questions": len(test), "batch": BATCH, "max_new_tokens": MAX_NEW, "decoding": "greedy", "seconds": seconds,
        "gpu": torch.cuda.get_device_name(0),
        "versions": {"python": platform.python_version(), "torch": torch.__version__, "transformers": transformers.__version__, "peft": peft.__version__},
    }
    (ROOT / "eval" / f"run-{name}.json").write_text(json.dumps(run, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"{name}: {len(out)} answers in {seconds} s")


if __name__ == "__main__":
    main()
