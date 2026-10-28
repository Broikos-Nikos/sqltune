---
base_model: Qwen/Qwen2.5-Coder-1.5B-Instruct
library_name: peft
license: mit
pipeline_tag: text-generation
tags:
- lora
- text-to-sql
- sqlite
---

# sqltune adapter

A LoRA adapter for Qwen/Qwen2.5-Coder-1.5B-Instruct at revision 2e1fd39, trained on 384 examples of
one synthetic shop's questions to write SQLite for that shop's five tables. It is the adapter measured
in the sqltune repository: read its README before using it, the part on the kinds of question it never
trained on first.

- rank 16, alpha 32, dropout 0.05, on q_proj, k_proj, v_proj, o_proj, gate_proj, up_proj, down_proj
- 2 epochs, 96 steps, batch 8 in micro batches of 2, learning rate 0.0002, seed 7
- the base in bfloat16, the adapter in float32, trained on an NVIDIA GeForce RTX 4060 in 7 minutes
- sha256 of adapter_model.safetensors: f191b1a27e9f69c0d1245786092394bb1d372f75d70fcd1974d702b129f4bbb4

Load it with peft, `PeftModel.from_pretrained(base, "adapter")`, and prompt it the way `train/common.py`
does: the schema and the column values, then the question.

MIT licence for the adapter. The base model is Apache 2.0.
