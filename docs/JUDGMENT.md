# L2 judgment — effect estimates from outcomes

The brain is layered:

| Layer | Question | Where |
|---|---|---|
| **L1 measurement** | *What is true of this page now?* | `rules/`, `src/core/full-audit`, `src/core/gsc` |
| **L2 judgment** | *What did our past changes actually do?* | **`src/core/judgment`** (this doc) |
| **L3 generation** | *Produce the fix.* | `ai/` (patch synthesizer), `healing/` |

L2 is deliberately narrow. It does **not** re-prioritize (the audited `actionPlan`
already ranks P0–P3 by severity) and it does **not** predict a number for a page.
It takes the outcomes that were *measured* for past changes and answers: **when we
changed a page this way before, did it move Search Console clicks relative to
unchanged control pages?**

## Method — difference in differences

For each change with a measured, complete outcome and a control set:

```
counterfactual = changed.before × (control.after / control.before)   // multiplicative
               = changed.before + (control.after − control.before)    // when control.before = 0
netClicks      = changed.after − counterfactual
positionGain   = changed.before.position − changed.after.position      // positive = moved up
```

Subtracting the control trend removes site-wide movement (seasonality, a core
update), so the estimate speaks to the page, not the website.

Per `kind` (e.g. `meta_description`, `keyword-matrix`, `deployment`) it reports:

- `sampleSize`, `considered`, `excluded` — how much evidence, and how much was
  dropped (still-filling window, no control set) so the gap is visible;
- `medianNetClicks`, `meanNetClicks`, `positiveClickShare`, `medianNetImpressions`,
  `medianPositionGain`;
- `confidence` from sample size (`low` < 4, `medium` ≥ 4, `high` ≥ 10);
- `provenance: "estimated"` and explicit `caveats`.

## Honesty rules

- **Only measured, complete outcomes.** Unavailable outcomes and still-filling
  after-windows are excluded, never imputed.
- **No per-page predictions.** Effects are aggregates per kind; a single page is
  never told "expect +N clicks".
- **Correlational, not causal.** Changes were not randomly assigned; controls are
  the naive highest-impression set. This is stated in every `KindEffect.caveats`
  and in the report `notes`.
- **Small samples are labelled.** Below the medium threshold the estimate carries
  a "small sample" caveat.

## API

`POST /api/outcomes` `{ action: "judge" }` → `{ success, report: JudgmentReport }`.

```ts
import { judgeOutcomes } from "@/core/judgment";
const report = judgeOutcomes(changes, outcomes); // pure, no I/O
```

## Not yet done

- **A trained L2 model.** This deterministic estimator is the baseline; a model
  trained on reviewed triples + outcomes must beat it on held-out data before it
  replaces the heuristic.
- **Better controls.** Match controls by page template and traffic band.
- **Surfacing** the report in the operator console next to each `actionPlan`.
