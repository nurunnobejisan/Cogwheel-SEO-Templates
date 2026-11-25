# Audit report exports

The full-website audit can be downloaded in four formats from the report toolbar
(`Full Website Audit → Export`).

| Format | Content type | Notes |
|---|---|---|
| HTML | `text/html` | Self-contained, print-ready. Use the browser's **Save as PDF** for pixel-perfect layout. |
| PDF | `application/pdf` | Text-only PDF 1.4 generated in-process (Helvetica, automatic pagination). No external binary. |
| CSV | `text/csv` | Flat `section,metric,value` rows, RFC 4180 quoting. Usable in Excel/Sheets. |
| PPTX | `application/vnd.openxmlformats-officedocument.presentationml.presentation` | Client-ready deck: cover, scorecard, technical, on-page, GSC/keywords, GEO, action plan, provenance. |

## Endpoint

`POST /api/audit-report`

```json
{
  "format": "pdf",
  "report": { "...": "FullWebsiteAuditReport from /api/full-audit" }
}
```

The browser posts back the report it already rendered, so the file matches the
on-screen audit exactly — there is no second crawl and no chance of the export
disagreeing with the dashboard. The payload is validated with
`src/core/reporting/schema.ts` before it reaches a writer; malformed reports get
`400`, generation failures get `500`.

The route is rate-limited with the crawl tier (10 requests/minute per IP) because
PPTX/PDF generation is CPU-heavy.

## Integrity rules

- Every value is copied from the report. Dimensions without a data source are
  exported as `Not available` / `not measured`; they are never replaced with
  placeholders.
- When `dataProvenance.simulated` is true (only possible with
  `ALLOW_SIMULATED_DATA=1`), all four formats print an explicit warning.
- The PDF deliberately uses a text layout rather than embedding charts so it
  stays dependency-free and reproducible; the HTML file is the design-complete
  alternative.

## Implementation

| File | Responsibility |
|---|---|
| `src/core/reporting/html-report.ts` | Escaped, print-ready HTML |
| `src/core/reporting/pdf-report.ts` | PDF object/xref writer |
| `src/core/reporting/csv-report.ts` | Flat data export |
| `src/core/reporting/pptx-report.ts` | PPTX deck via `pptxgenjs` |
| `src/core/reporting/schema.ts` | Zod validation of submitted reports |
| `src/app/api/audit-report/route.ts` | HTTP endpoint, content types, filenames |

Tests: `tests/reporting.test.ts` (schema, escaping, PDF structure, OOXML package,
file naming, dependency declaration).
