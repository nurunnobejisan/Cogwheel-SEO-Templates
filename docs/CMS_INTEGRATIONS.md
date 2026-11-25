# CMS Integrations & Secure Authentication — Implementation Notes (Phase 3)

Implements **Phase 3** of [`ROADMAP_UNIVERSAL_AUDIT_AND_CMS_AUTOFIX.md`](./ROADMAP_UNIVERSAL_AUDIT_AND_CMS_AUTOFIX.md):
the encrypted credential vault, OAuth 2.0 state handling, the WordPress /
Shopify / Webflow connectors, the universal `seo-autofix.js` fallback runtime,
and the guarded deployment orchestrator that publishes a Phase 2 `FixPatch`.

The layer consumes the Phase 1 audit + Phase 2 patch pipeline and is additive:
nothing in the existing hotel workflows or exporters changes.

## Layout

```
cms/
├── index.ts                 # public barrel
├── types.ts                 # credential / connector / deployment contracts
├── vault.ts                 # AES-256-GCM credential vault (KMS-ready)
├── credentials.ts           # CmsCredential create / open / redact
├── factory.ts               # credential → bound connector
├── deploy.ts                # guarded snapshot→apply→verify→rollback orchestrator
├── oauth/
│   ├── state.ts             # HMAC-signed, expiring, replay-safe state + PKCE
│   └── shopify.ts           # scopes, authorize URL, HMAC check, token exchange
├── wordpress/connector.ts   # REST API + Yoast/Rank Math/AIOSEO meta keys
├── shopify/connector.ts     # Admin GraphQL mutations + schema metafield
├── webflow/connector.ts     # REST v2 CMS item PATCH
├── custom/connector.ts      # runtime patch registry (no-write platforms)
└── runtime/seo-autofix.ts   # <4KB universal client-side runtime generator
```

## Deployment flow

```
FixPatch ─▶ approval gate ─▶ readSnapshot ─▶ applyMutations ─▶ settle ─▶ verify ─▶ (rollback on fail)
```

```ts
import { createCredentialVault, createCmsCredential, createConnectorForCredential, deployPatch } from "./cms/index.ts";

const vault = createCredentialVault(process.env.CMS_VAULT_KEY!);
const credential = createCmsCredential({
  vault, platform: "wordpress", label: "example.com",
  meta: { siteUrl: "https://example.com", username: "seo-autofix-bot", seoPlugin: "yoast" },
  secret: { applicationPassword: "…" },
});
const connector = createConnectorForCredential({ credential, vault, target: { url, resourceId: "42", resourceType: "posts" } });

const result = await deployPatch(patch, { connector, autoPilot: true }); // status: deployed | queued | rolled_back | …
```

- **Approval gate** — only mutations flagged `autoApply` (low-risk) deploy under
  auto-pilot; `approveAll: true` deploys every non-`manual_review` mutation;
  `manual_review` mutations are never sent. `dryRun: true` returns the diff only.
- **Atomic safety** — a snapshot is captured before any write, and the connector
  restores it on apply failure, thrown errors, or live-verification failure.
- `previewPatchDiff(patch)` yields the before/after diff for the review UI.
- **Verification mode** — a connector may set `verificationMode: "connector"`
  when its fix lands client-side (the universal runtime connector): the healing
  pipeline then trusts the connector's own `verify()` instead of comparing
  server HTML that is intentionally unchanged.
- **Capability probe** — a connector may implement `supportsField(field)`; the
  pipeline defers unsupported fields (the run reports `queued`) rather than
  deploying a partial patch and rolling back.

## Encrypted credential vault (`vault.ts`)

- **AES-256-GCM** authenticated encryption (`v1:iv:tag:ciphertext`, base64).
- Key via a `KeyProvider` (plug in AWS KMS / GCP Secret Manager) or a raw
  base64/hex 32-byte key / passphrase (`CMS_VAULT_KEY`).
- `seal`/`open` for JSON secrets, `fingerprint` for audit logs, `redactSecret`
  and `redactCmsCredential` for safe logging.

## OAuth 2.0 (`oauth/`)

- **State handler** — HMAC-SHA256 signed, expiring state tokens carrying the PKCE
  `code_verifier`; consumed states are tracked to block replay.
- **Shopify** — granular scopes (`read/write_products`, `read/write_content`,
  `read/write_themes`), authorize URL builder, callback HMAC verification, and the
  code→token exchange.

## Platform connectors

| Platform | Auth | Writes |
| --- | --- | --- |
| **WordPress** | Application password (`seo-autofix-bot`) | REST `/wp-json/wp/v2/{posts\|pages}/{id}`; meta keys for Yoast (`_yoast_wpseo_*`), Rank Math (`rank_math_*`), AIOSEO (`_aioseo_*`), with a generic `_cogwheel_*` fallback |
| **Shopify** | OAuth access token | Admin GraphQL `productUpdate`/`collectionUpdate`/`pageUpdate` `seo` input + `metafieldsSet` for JSON-LD (App Embed, no Liquid edits) |
| **Webflow** | API token | REST v2 `PATCH /collections/{id}/items/{id}` with a configurable field map |
| **Custom** | public client id | Registers a runtime patch config served by the edge; applied client-side by `seo-autofix.js` |

Fields a platform cannot map are returned as per-field errors and can be queued
for review rather than silently dropped.

## Universal fallback runtime (`runtime/seo-autofix.ts`)

`buildSeoAutofixScript({ apiBase })` generates the dependency-free runtime
(**asserted < 4KB**), and `buildSeoAutofixSnippet({ clientId })` produces the
single async embed tag from the roadmap. The runtime discovers its own script
tag, fetches the patch config for the active URL, and overrides title, meta
description, canonical, Open Graph/Twitter tags and JSON-LD before crawlers
render the page.

## Contracts

- `schemas/cms-deployment.schema.json` — the `DeploymentResult` payload.

## Tests

`tests/cms-integration.test.ts` (Vitest, **29 tests**) covers vault round-trips /
tamper detection / key derivation / redaction, OAuth state issue-consume-replay-
expiry and PKCE, Shopify HMAC + token exchange, WordPress meta mapping and REST
auth, Shopify GraphQL userErrors, Webflow field mapping, the runtime size budget
and snippet, and the deployment orchestrator (dry-run, auto-pilot gating, queue,
approve-all, apply rollback, verify rollback) plus the credential→connector
factory.

```bash
npx vitest run tests/cms-integration.test.ts tests/ai-seo-brain.test.ts tests/universal-mode.test.ts
```

## Remaining Phase 3 items

- Host the API gateway (Express/FastAPI) endpoints for OAuth callbacks, vault
  CRUD, and deployment, with rate limiting.
- Back the vault key with AWS KMS / GCP Secret Manager in production.
- Serve the generated `seo-autofix.js` from the CDN edge and implement the
  `/v1/seo-patches` lookup against Redis/edge KV.
- Add the WordPress companion plugin (`wp_head` JSON-LD injection, 301 hooks,
  pre-write DB snapshots) and the Shopify App Embed Block theme extension.
- Build the pre-deployment diff-preview UI in the side panel.
