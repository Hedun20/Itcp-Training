# Course content migration

## Source and safety

The original prototype is preserved as the read-only archive `C:\Dev\itcp-training.zip`. On Windows, `itcp-training` and `ITCP-Training` resolve to the same case-insensitive path, so the archive must never be extracted directly into `C:\Dev`. Migration reads the archive entries without changing or overlaying the new repository.

The audited source archive has SHA-256:

```text
FC7E897AF0ED2505E17CCADB4234EA7E04A46F979897347C4499DB81D1094936
```

## Preserved content

The migration preserves all original identifiers, titles, summaries, duration labels, pass marks, module text, assessment questions, answer options, and correct-answer indices.

| Code | Course | Pass mark | Modules | Paragraphs | Questions |
| --- | --- | ---: | ---: | ---: | ---: |
| DCT-01 | Data Centre Telecommunications — Foundations | 70% | 6 | 12 | 10 |
| DCT-02 | Testing & Certification | 75% | 6 | 12 | 10 |
| HSE-01 | Health & Safety on Site | 80% | 6 | 12 | 10 |
| ACS-01 | Access Control Infrastructure | 75% | 6 | 12 | 10 |

Totals: four courses, 24 modules, 48 source paragraphs, 40 questions, and 160 answer options.

## Schema conversion

Each prototype module stored its body as an array of paragraph strings. The backend seed converts every paragraph to a structured course block:

```text
source module.body[n]
  -> module.blocks[n]
  -> { type: "paragraph", text: "..." }
```

Block order is represented by array order. Stable Mongoose subdocument identifiers preserve progress and editor references across safe seed reruns.

Quiz items are converted to assessment questions with ordered options, one server-only correct-answer index, one point by default, and a stable order. Correct answers are removed from learner-facing course payloads and are used only by backend scoring.

## Idempotency

The seed keys by stable course code, so rerunning it never creates duplicates. By default it inserts missing canonical courses and preserves existing CMS edits and publication decisions. Set `SEED_UPDATE_EXISTING=true` only for an intentional canonical refresh; forced updates preserve stable embedded identifiers where content positions still correspond. Newly inserted seeded courses are published and immediately visible through learner course endpoints.
