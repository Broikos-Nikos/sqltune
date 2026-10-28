# sqltune, the spec

Written 2026-10-28 23:48, while the base model was answering its first questions and before any answer
had been scored. What follows is fixed before the tuned model exists.

## The question

What does a LoRA adapter add to a small open model that already writes SQL, on one shop's schema, in
English and in Greek? And does what it adds survive a question it was never trained on?

## The model and the run

Qwen/Qwen2.5-Coder-1.5B-Instruct, Apache 2.0, pinned to revision
2e1fd397ee46e1388853d2af2c993145b0f1098a. LoRA rank 16, alpha 32, dropout 0.05, on every attention and
MLP projection; 2 epochs, batch 8, learning rate 2e-4 with 10 warmup steps and a cosine decay; bf16 on
an RTX 4060 8 GB; seed 7. The loss is taken on the answer tokens only.

## The data

The shop is sqlguard's seeded shop without its admin table and card numbers (`data/shop.sqlite`). 32
question families, each a gold query with 3 English and 2 Greek wordings. The first 24 are trained on
in 2 English wordings and 1 Greek one; 729 training examples. The test, 318 questions, has three parts:

- **seen**: trained family and wording, slot values never trained with that wording;
- **reworded**: trained family, the wordings training never saw;
- **unseen**: the 8 families never trained on.

Both models get the same prompt: the schema, the values the columns hold, and the question.

## The number

Execution accuracy: the answer's rows equal the gold query's rows on `data/shop.sqlite`, values rounded
to 2 places, columns in any order, rows in order only where the gold query orders them. Reported per
part and per language, with Wilson 95% intervals, base against tuned. The answers are committed and
re-scored in CI, so the numbers do not depend on the GPU.

## The failure to publish

Whatever the unseen part shows. A tuned model that learns 24 families can lose what the base knew about
the other 8, and that is reported as measured, not explained away.

## Revision, 2026-10-29 00:55, on the owner's word

The owner does not use Greek, and asked to skip it. Greek was taken out of the families, the training
set and the test, and to keep the test near its size each test wording now takes up to 3 values in the
seen part and 5 in the other two. Training settings are unchanged except that a batch of 8 is now taken
as 4 micro batches of 2: the first attempt at 8 at once spilled out of the GPU's 8 GB and stalled.

A first run, with Greek, had already been trained and scored, and its numbers were seen before this
revision: the base model 45.9% and the tuned one 78.9% on 318 questions, and on the kinds never trained
on 45.0% and 40.0%. Its answers and its adapter were not kept, so those numbers are a record here, not a
claim this repository can reproduce. It is not the published run. The published run is the English one that follows,
trained and scored after this revision was written.
