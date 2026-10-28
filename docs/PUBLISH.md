# Publishing sqltune

Everything the repository needs on GitHub, written before it exists.

## The About box

**Description**, 350 characters or fewer, carrying the number:

> What a LoRA adapter adds to a small model that already writes SQL. Trained in 7 minutes on 384
> examples, it took Qwen2.5-Coder-1.5B from 55.9% to 82.0% right on one shop's questions, and from 55.6%
> to 33.3% on kinds of question it never trained on. Every answer is run on the database.

**Homepage**: `https://broikos-nikos.github.io/sqltune/`

**Topics**, ten:

```
llm  lora  fine-tuning  peft  text-to-sql  sqlite  qwen  llm-evaluation  transformers  typescript
```

`fine-tuning` and `text-to-sql` are the two that matter: somebody deciding whether a small tuned model
can write their queries is searching one of them, and what nobody publishes is the question it got
worse at.

## Settings

- **Public.** Issues on, wiki, projects and discussions off.
- **Pages from GitHub Actions**, not from a branch: the workflow deploys only when the build gates,
  which re-score every committed answer, and the browser gates both pass.
- **No default community files.** The MIT LICENSE is committed, and `check:licence` holds the README to
  it.
- **The adapter is a 74 MB file in the repository**, under GitHub's 100 MB limit, so a clone carries the
  exact weights the answers came from.

## The order

1. Create the repository with the description, homepage and topics above.
2. Push `main` with its whole history, every commit authored `Nikos Broikos
   <broikos.nikolaos@gmail.com>`, none co-authored.
3. Turn Pages on with GitHub Actions as the source, and watch the first deploy to green.
4. Open the live page in a browser at 1280 and 390 and look at it.
5. Only then, a second push puts the live link at the top of the README.
