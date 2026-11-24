---
name: Feature Request
about: Propose a new SEO audit engine, schema, tool, or template
title: "[FEAT] "
labels: ["enhancement"]
assignees: ""
---

## Feature Proposal
A concise summary of the new feature or enhancement.

## Motivation & SEO Value
Why is this feature needed? What specific SEO, GEO, or automation problem does it solve?

## Proposed Architecture & Schemas
- **Target Schema**: (e.g., updates to `schemas/*.schema.json`)
- **Matching Zod Model**: `src/types/...`
- **Matching Pydantic v2 Model**: `python/models/...`
- **UI / Extension Impact**: (e.g., Side Panel card, Dashboard tab)

## Suggested Implementation Steps
1. Define Draft-07 JSON Schema
2. Generate strict Zod and Pydantic models
3. Implement engine / extractor
4. Add unit tests and validation gates
5. Integrate into UI and CI Suite

## Alternatives Considered
Describe any alternative solutions or workarounds you considered.
