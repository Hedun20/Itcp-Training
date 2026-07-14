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

The archive projection and `server/src/data/legacyTrainings.ts` have the same semantic SHA-256 manifest:

```text
6887d68e2c8dbfe95c2c9ac2376f56156a96787ef7d159ea7f7c639c1a496ad1
```

The raw `itcp-training/src/data/trainings.js` ZIP entry has SHA-256 `b70f2a843e0c788af9d46a84ba9f57959b08f43344102f51993eb1ba37d69a4b`.

## Schema conversion

Each prototype module stored its body as an array of paragraph strings. The backend seed converts every paragraph to a structured course block:

```text
source module.body[n]
  -> module.blocks[n]
  -> { type: "paragraph", text: "..." }
```

Block order is represented by array order. Stable Mongoose subdocument identifiers preserve progress and editor references across safe seed reruns.

Quiz items are converted to assessment questions with ordered options, one server-only correct-answer index, one point by default, and a stable order. Correct answers are removed from learner-facing course payloads and are used only by backend scoring.

The first module in every canonical course also contains an explicitly labelled local placeholder image block. These SVG assets are authored for this repository, carry alt text/caption/credit metadata, and do not depend on third-party copyrighted images. The learner renderer supports `heading`, `paragraph`, `image`, `callout`, and `checklist` blocks.

## Idempotency

The seed keys by stable course code, so rerunning it never creates duplicates. By default it inserts missing canonical courses and preserves existing CMS edits and publication decisions. Set `SEED_UPDATE_EXISTING=true` only for an intentional canonical refresh; forced updates preserve stable embedded identifiers where content positions still correspond. Newly inserted seeded courses are published and immediately visible through learner course endpoints.

## Safe repair and verification

Use the repair command when one of the four codes already exists but canonical modules, blocks, placeholder images, questions, or answer options are missing:

```powershell
npm.cmd run seed:repair-content
```

Repair matches deterministic embedded identifiers first. Existing matching items—including administrator-edited text and replacement image URLs—are preserved; missing canonical items are inserted at their original relative positions, partially deleted option sets are repaired, and the command reports inserted, updated, and skipped work. Repeating it produces no further changes.

Two development-only verification commands cover both provenance and stored MongoDB state:

```powershell
npm.cmd run content:verify-source  # compare the structured seed with the authoritative manifest
npm.cmd run content:verify         # count/query the four MongoDB course documents
```

For an independent archive audit, extract only `src/data/trainings.js` to a temporary `.mjs` file outside the repository and pass that path after `--`; the verifier compares every source field and correct-answer index.

The database report includes courses, modules, source paragraphs, total structured blocks, questions, answer options, missing images, missing publication status, and exact source parity. It exits non-zero when canonical content is missing or changed.
