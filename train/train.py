"""Trains the LoRA adapter on data/train.jsonl and writes it to adapter/.

Only the answer is trained on: every prompt token is masked out of the loss, so
the model learns what to write for this shop and nothing about the schema text
it is shown every time. The run's settings, its loss at every step, the time it
took and the memory it used go to runs/train.json, which is committed.

    uv run python train.py
"""
from __future__ import annotations

import hashlib
import json
import math
import platform
import random
import time

import peft
import torch
import transformers
from peft import LoraConfig, get_peft_model
from transformers import AutoModelForCausalLM, AutoTokenizer

from common import ADAPTER, BASE, REVISION, ROOT, SEED, prompt, rows

SETTINGS = {
    "epochs": 2,
    "batch": 8,
    # the batch is taken in micro batches: logits over a 151,936 token vocabulary for 8 sequences at once
    # outgrew 8 GB and spilled into shared memory, which stalled the first run for 45 minutes
    "micro_batch": 2,
    "lr": 2e-4,
    "warmup_steps": 10,
    "lora_r": 16,
    "lora_alpha": 32,
    "lora_dropout": 0.05,
    "target_modules": ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
}


def main() -> None:
    random.seed(SEED)
    torch.manual_seed(SEED)
    tok = AutoTokenizer.from_pretrained(BASE, revision=REVISION)
    end = tok.convert_tokens_to_ids("<|im_end|>")

    # prompt and answer tokenized apart, so the boundary is where prediction will start from
    examples = []
    for row in rows("train.jsonl"):
        p = tok(prompt(tok, row), add_special_tokens=False).input_ids
        a = tok(row["sql"], add_special_tokens=False).input_ids + [end]
        examples.append((p + a, [-100] * len(p) + a))

    model = AutoModelForCausalLM.from_pretrained(BASE, revision=REVISION, dtype=torch.bfloat16).to("cuda")
    model.gradient_checkpointing_enable()
    model.enable_input_require_grads()
    model = get_peft_model(model, LoraConfig(r=SETTINGS["lora_r"], lora_alpha=SETTINGS["lora_alpha"], lora_dropout=SETTINGS["lora_dropout"], target_modules=SETTINGS["target_modules"], task_type="CAUSAL_LM"))
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total = sum(p.numel() for p in model.parameters())

    opt = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=SETTINGS["lr"], weight_decay=0.0)
    steps = SETTINGS["epochs"] * math.ceil(len(examples) / SETTINGS["batch"])
    def lr_at(step: int) -> float:
        if step < SETTINGS["warmup_steps"]:
            return SETTINGS["lr"] * (step + 1) / SETTINGS["warmup_steps"]
        done = (step - SETTINGS["warmup_steps"]) / max(1, steps - SETTINGS["warmup_steps"])
        return SETTINGS["lr"] * 0.5 * (1 + math.cos(math.pi * done))

    pad = tok.pad_token_id if tok.pad_token_id is not None else end
    log = []
    model.train()
    torch.cuda.reset_peak_memory_stats()
    t0 = time.time()
    step = 0
    for epoch in range(SETTINGS["epochs"]):
        order = list(range(len(examples)))
        random.Random(SEED + epoch).shuffle(order)
        for b in range(0, len(order), SETTINGS["batch"]):
            batch = [examples[i] for i in order[b:b + SETTINGS["batch"]]]
            for g in opt.param_groups:
                g["lr"] = lr_at(step)
            # every answer token weighs the same however the batch is cut into micro batches
            tokens = sum(sum(1 for t in y if t != -100) for _, y in batch)
            total_loss = 0.0
            for mb in range(0, len(batch), SETTINGS["micro_batch"]):
                part = batch[mb:mb + SETTINGS["micro_batch"]]
                width = max(len(ids) for ids, _ in part)
                ids = torch.tensor([x + [pad] * (width - len(x)) for x, _ in part], device="cuda")
                labels = torch.tensor([y + [-100] * (width - len(y)) for _, y in part], device="cuda")
                mask = torch.tensor([[1] * len(x) + [0] * (width - len(x)) for x, _ in part], device="cuda")
                n = sum(sum(1 for t in y if t != -100) for _, y in part)
                loss = model(input_ids=ids, attention_mask=mask, labels=labels).loss * (n / tokens)
                loss.backward()
                total_loss += loss.item()
            torch.nn.utils.clip_grad_norm_([p for p in model.parameters() if p.requires_grad], 1.0)
            opt.step()
            opt.zero_grad(set_to_none=True)
            log.append({"step": step, "epoch": epoch, "loss": round(total_loss, 5), "lr": round(lr_at(step), 8)})
            if step % 10 == 0:
                print(f"step {step}/{steps} epoch {epoch} loss {total_loss:.4f} at {time.time() - t0:.0f} s", flush=True)
            step += 1
    seconds = round(time.time() - t0, 1)

    model.save_pretrained(ADAPTER)
    weights = ADAPTER / "adapter_model.safetensors"
    run = {
        "base": BASE, "revision": REVISION, "seed": SEED, "settings": SETTINGS,
        "examples": len(examples), "steps": steps, "seconds": seconds,
        "trainable_parameters": trainable, "total_parameters": total,
        "peak_memory_mb": round(torch.cuda.max_memory_allocated() / 2**20),
        "gpu": torch.cuda.get_device_name(0),
        "versions": {"python": platform.python_version(), "torch": torch.__version__, "transformers": transformers.__version__, "peft": peft.__version__},
        "adapter_sha256": hashlib.sha256(weights.read_bytes()).hexdigest(),
        "adapter_bytes": weights.stat().st_size,
        "loss": log,
    }
    (ROOT / "runs").mkdir(exist_ok=True)
    (ROOT / "runs" / "train.json").write_text(json.dumps(run, indent=1) + "\n", encoding="utf-8")
    write_card(run)
    print(f"trained {trainable:,} of {total:,} parameters in {seconds} s, final loss {log[-1]['loss']}, adapter {run['adapter_bytes']:,} bytes")


def write_card(run: dict) -> None:
    """The adapter's own README, in place of the template peft writes, which is placeholders."""
    st = run["settings"]
    lines = [
        "---",
        f"base_model: {run['base']}",
        "library_name: peft",
        "license: mit",
        "pipeline_tag: text-generation",
        "tags:",
        "- lora",
        "- text-to-sql",
        "- sqlite",
        "---",
        "",
        "# sqltune adapter",
        "",
        f"A LoRA adapter for {run['base']} at revision {run['revision'][:7]}, trained on {run['examples']} examples of",
        "one synthetic shop's questions to write SQLite for that shop's five tables. It is the adapter measured",
        "in the sqltune repository: read its README before using it, the part on the kinds of question it never",
        "trained on first.",
        "",
        f"- rank {st['lora_r']}, alpha {st['lora_alpha']}, dropout {st['lora_dropout']}, on {', '.join(st['target_modules'])}",
        f"- {st['epochs']} epochs, {run['steps']} steps, batch {st['batch']} in micro batches of {st['micro_batch']}, learning rate {st['lr']}, seed {run['seed']}",
        f"- the base in bfloat16, the adapter in float32, trained on an {run['gpu']} in {round(run['seconds'] / 60)} minutes",
        f"- sha256 of adapter_model.safetensors: {run['adapter_sha256']}",
        "",
        "Load it with peft, `PeftModel.from_pretrained(base, \"adapter\")`, and prompt it the way `train/common.py`",
        "does: the schema and the column values, then the question.",
        "",
        "MIT licence for the adapter. The base model is Apache 2.0.",
    ]
    (ADAPTER / "README.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
