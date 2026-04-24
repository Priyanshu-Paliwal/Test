# PostGrid SFMC Custom Activity — Architecture Analysis & Gap Report

> Scope: Full code-base review of `salesforce-marketing-cloud-release-3.0`.
> Purpose: Explain how the app works today, why CSP / `style-src` errors are firing inside Marketing Cloud journeys, and what to change.
> Audience: You (maintainer).
> Date: 2026-04-24

---

## 1. Executive Summary

This project is a **Salesforce Marketing Cloud (SFMC) Journey Builder Custom Activity** that lets a marketer drop a "PostGrid" tile into a journey and send physical mail (postcards / letters / self-mailers) to contacts through the PostGrid print-mail API.

It is packaged as a small **Node.js + Express** web-app. SFMC loads the UI inside an iframe (in the Journey Builder canvas) and calls the app's lifecycle endpoints (`/save`, `/publish`, `/validate`, `/execute`, `/stop`) over HTTP.

Architecture at a glance:

```
+--------------------------- Salesforce Marketing Cloud --------------------------+
|                                                                                  |
|   Journey Builder canvas                                                         |
|   +---------------------------------------------+                                |
|   |  <iframe src="https://<app>/index.html"> |  <-- config UI (5-step wizard)  |
|   +---------------------------------------------+                                |
|                 |                       ^                                        |
|                 | Postmonger events     |   AJAX -> /client-credentials etc.     |
|                 v                       |                                        |
|   +---------------------------------------------+                                |
|   |  Journey engine (runtime)                   |                                |
|   |  per-contact POST -> /execute               |                                |
|   +---------------------------------------------+                                |
+-----------------|--------------------------------|------------------------------+
                  |                                |
                  v                                v
        +-------------------------+      +-------------------------+
        | app.js  (Express)       |----->| api.postgrid.com         |
        | routes/activity.js      |      | (print-mail/v1/*)        |
        +-------------------------+      +-------------------------+
                  |                                ^
                  |  SOAP (fetch credentials)      |
                  v                                |
        +----------------------------+             |
        | SFMC SOAP API              |             |
        | *.soap.marketingcloudapis  |             |
        +----------------------------+             |
                                                   |
        +----------------------------+             |
        | SFMC REST API              |------------>|
        | *.rest.marketingcloudapis  |  log rows   |
        +----------------------------+             |
```

Two personas talk to the app:

| Phase | Caller | What happens |
|---|---|---|
| **Design-time** (marketer configuring the activity) | Marketer's browser inside Journey Builder iframe | Loads `index.html` → runs `customActivity.js` → collects config → `connection.trigger('updateActivity', payload)` saves config back to SFMC. |
| **Run-time** (journey firing per contact) | SFMC server | POSTs `/execute` once per contact passing the saved config + contact data → backend calls PostGrid to create the piece → backend writes a log row to an SFMC Data Extension. |

---

## 2. File-by-File Breakdown

```
salesforce-marketing-cloud-release-3.0/
├── app.js                     # Express server, CSP, static hosting, route wiring
├── routes/
│   └── activity.js            # Runtime handlers + SFMC SOAP / REST brokers
├── public/
│   ├── index.html             # 5-step wizard markup (2,217 lines)
│   ├── config.json            # SFMC activity manifest (endpoints, modal size, steps)
│   ├── css/
│   │   ├── style.css          # Wizard styles (1,345 lines)
│   │   └── font-awesome.min.css
│   ├── js/
│   │   ├── customActivity.js  # Wizard logic (2,731 lines)
│   │   ├── loader.js          # AMD bootstrap
│   │   ├── require.js         # AMD loader
│   │   ├── postmonger.js      # SFMC<->iframe message bus
│   │   └── jquery.min.js
│   ├── fonts/                 # FontAwesome woff/woff2/ttf (self-hosted)
│   └── images/                # loginScreen.jpg, postgridicon.png
├── eslint.config.mjs
├── .stylelintrc.json
├── fix_js.js                  # One-off codemod to swap .hide/.show/.css-display-none for classes
├── package.json
└── README.md                  # 1 line, effectively empty
```

### 2.1 `app.js` (lines 1-162) — Express bootstrap & security headers

Key responsibilities:

| Lines | What it does |
|---|---|
| 1-7 | `require('dotenv')`, express, helmet, and the activity router. |
| 9-14 | `trust proxy` (Railway / App Runner front TLS terminator) + hide `X-Powered-By`. |
| 17-104 | **`helmet()` configuration**. HSTS, noSniff, no-referrer, and the CSP (see §4). `frameguard: false` because `frame-ancestors` already covers embedding. |
| 106-126 | Manual `Cache-Control` middleware: no-cache for HTML/JSON/XML, `max-age=31536000, immutable` for static assets. Satisfies the "missing Cache-Control" ZAP finding. |
| 128-133 | `express.static('public')` with `etag:false, lastModified:false` — the manual middleware above is the single source of caching truth. |
| 136-137 | JSON / URL-encoded body parsers, 50 MB limit (generous — lets PDFs flow through if ever needed). |
| 140-150 | Route wiring for the 6 SFMC lifecycle endpoints + `/stop` (the stop route was missing earlier; it's now a stub). |
| 153-155 | `/health` for the PaaS health check. |
| 157-161 | `app.listen(process.env.PORT || 3000)`. |

### 2.2 `routes/activity.js` (lines 1-281) — Runtime + SFMC brokers

| Export | Lines | What it does |
|---|---|---|
| `edit` | 8-10 | Stub 200 response. |
| `save` | 16-18 | Stub 200 response — the real "save" is done client-side via `updateActivity`. |
| **`execute`** | 27-112 | **The hot path.** For each contact, builds a PostGrid payload from saved `inArguments[0]`, merges `mergeVariableSchema`, injects contact address fields into `postcardJson.to`, stamps `sendDate = now+5min`, picks `X-API-KEY` (test or live), posts to `api.postgrid.com/print-mail/v1/{postcards\|letters\|self_mailers}`, then calls `logToDataExtension` to audit success/failure. |
| `publish` | 118-120 | Stub. |
| `validate` | 126-128 | Stub. |
| **`fetchClientCredentials`** | 137-172 | SOAP `RetrieveRequestMsg` against `{authTSSD}.soap.marketingcloudapis.com` to pull `Client_Id`, `Client_Secret`, `TestAPIKey`, `LiveAPIKey` from a Data Extension identified by external key. Used by the wizard step 1. |
| **`fetchExternalKey`** | 181-219 | SOAP lookup to resolve a Data Extension **Name** → **CustomerKey** (external key). |
| `getAuthToken` (private) | 227-244 | Client-credentials OAuth2 against `{authTSSD}.auth.marketingcloudapis.com/v2/token`. |
| `logToDataExtension` (private) | 252-281 | Async insert of an audit row (`Status, Response, TimeStamp, ContactKey, JourneyId, ActivityId, Object`) via REST into `key:{loggingExternalKey}`. |

### 2.3 `public/config.json` — SFMC activity manifest

Tells Journey Builder:

* `workflowApiVersion: 1.1`, category `message`, icon path.
* Modal size: `1048 x 500` (fullscreen: false).
* 5 wizard steps: Connect Account → Select Method → Select Message → Select Contact → Preview.
* Endpoint URLs (all point at an **App Runner** domain, hardcoded):
  * `execute`, `save`, `publish`, `validate`, `stop`.
* `applicationExtensionKey` is hardcoded to a specific GUID — this is environment-specific and should be templated per tenant / env.

### 2.4 `public/index.html` (2,217 lines)

Five `<div id="stepN" class="step">` blocks that the wizard shows one at a time:

| Step | Lines | Contents |
|---|---|---|
| 1 | 22-44 | Test / Live API key inputs (with eye-toggle), loader overlay, inline validation spans. |
| 2 | 46-154 | Message-type radios (Letters / Postcards / Self Mailer), design-format radios (HTML / PDF / Existing Template), Card-Insert sub-panel, Live Mode switch. |
| 3 | 156-2037 | Five parallel sub-screens — one per message type — each with 3 creation modes (HTML editor / PDF URL / Template picker), size radios, mailing-class selects, extra-service dropdowns, envelope-type dropdowns, and per-type checkboxes (Color, Express, Perforate, Double-sided, Insert Blank Page, etc.). This is where most of the 2,217 lines live. |
| 4 | 2040-2192 | Sender contact block (existing vs. create-new form), plus 10 DE-field → recipient-address mapping selects. |
| 5 | 2194-2215 | `<iframe id="pdf-preview" sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation-by-user-activation" referrerpolicy="no-referrer">` + retry button. |

**Important facts verified by grep:**

* `style="..."` attributes: **0** in the HTML.
* Inline event handlers (`onclick=`, `onload=`, etc.): **0**.
* `<script>` tags without `src`: **0** (all scripts are external).
* `<form>` tags: **0** (everything is JS-wired).
* External CDN references in markup: only **preconnect** hints to `fonts.googleapis.com` and `fonts.gstatic.com` — no actual font stylesheet or font file is loaded from Google (see §5.2, this is a dead preconnect).

So the HTML itself is CSP-clean. The CSP errors come from elsewhere (§4).

### 2.5 `public/js/customActivity.js` (2,731 lines)

AMD module (`define(['postmonger'], fn)`). Entry point `onRender()` (line 38).

**Global state (mutable) at module top (lines 8-26):**

* `connection` — Postmonger session.
* `payload` — raw SFMC activity config, mutated throughout.
* `previewPayload` — collected wizard state **including the API keys**.
* `deData` — map `{fieldName: "{{Contact.Attribute.DE.\"field\"}}"}` for merge into PostGrid.
* `authToken`, `authTSSD`, `et_subdomain` — SFMC-provided.
* `fromContact`, `toContact`, `mergeVariablesFields` — user selections.
* `POSTGRID_API_BASE_URL = 'https://api.postgrid.com/print-mail/v1/'` — **hardcoded**, duplicates the backend env var.

**Postmonger event map:**

| Direction | Event | Handler / Trigger site | Purpose |
|---|---|---|---|
| In | `initActivity` | `initialize()` line 87 | Hydrate the form from saved JSON. |
| In | `clickedNext` | `onClickedNext()` line 299 | Step-aware validator / navigator. |
| In | `clickedBack` | `onClickedBack()` | Go back a step. |
| In | `gotoStep` | `onGotoStep()` | Jump to a step. |
| In | `requestedSchema` | line 57 — builds DE-field dropdown options + `deData` map. |
| In | `requestedTokens` | line 288 — captures `authToken` / `authTSSD` / `et_subdomain` for backend SOAP calls. |
| In | `requestedEndpoints` | line 282 — currently no-op. |
| Out | `ready`, `updateButton`, `requestSchema`, `requestTokens`, `requestEndpoints`, `nextStep`, `prevStep`, `updateActivity` | see lines 40-47, 308, 418, 467, 471, 485-532, 769. |

**Top-level helper functions (approximate line numbers):**

| Line | Function | Purpose |
|---|---|---|
| 38 | `onRender` | DOM-ready hook; fires initial Postmonger triggers. |
| 87 | `initialize(data)` | Hydrate UI from `payload['arguments'].execute.inArguments[0]`. |
| 299 | `onClickedNext` | Per-step validate → advance. |
| 479 | `showStep(n)` | Hide other step divs, relabel Next button. |
| 541 | `save()` | Serialize everything into `inArguments[0]`, `connection.trigger('updateActivity', payload)`. |
| 790 | `validateApiKeys` | Presence + format check on test/live keys. |
| 827 | `validateStep2` | Message + creation type chosen. |
| 968 | `validateStep3` | Ensure chosen creation sub-screen has required content. |
| 1541 | `createMessage` | POST to PostGrid to create a postcard/letter/self-mailer (preview build). |
| 1805 | `fetchMessageDetails` | GET /print-mail/v1/{type}/{id} to pull `url` for preview. |
| 1830 | `showPdfPreview` | Poll until PDF URL is ready, set iframe `src`. |
| 1878 | `getPreviewURL` | Orchestrates createMessage + showPdfPreview. |
| 1897 | `createContact(isFromContact)` | POST contact to PostGrid. |
| 1972 | `fetchContacts`, 2120 `fetchTemplates`, 2176 `fetchReturnEnvelope` | Searchable autocomplete loaders. |
| 2288 | `validateApiKey` | Calls `GET /contacts?limit=1` to prove the key works. |
| 2311 | `authenticateApiKeys` | Validate test + live in parallel. |
| 2321 | `fetchClientCredentials` | POST to **our own** `/client-credentials/` endpoint. |
| 2372 | `fetchExternalKey` | POST to `/fetch-external-key/`. |

### 2.6 `public/js/loader.js`

Three-line bootstrap: `require({baseUrl: "js"}, ["customActivity"])`. That's it.

### 2.7 `public/css/style.css` (1,345 lines)

* One CSS custom property (`:root { --heading: 24px }`).
* No `@import`, no `@font-face`, no external `url(...)` beyond the local `../images/loginScreen.jpg`.
* Font family is `Roboto, sans-serif` at line 8 — **Roboto is not loaded anywhere**; it silently falls back to `sans-serif` in most SFMC browsers.
* Uses `hidden-display`, `block-display`, `text-danger`, `hidden`, `show` utility classes — these are what `fix_js.js` was written to migrate *some* `.css()` calls toward.

### 2.8 `fix_js.js`

One-off codemod. Replaces, in `customActivity.js`:

| From | To |
|---|---|
| `.hide()` | `.addClass('hidden-display').removeClass('block-display')` |
| `.show()` | `.removeClass('hidden-display').addClass('block-display')` |
| `.css('display', 'none')` | `.addClass('hidden-display').removeClass('block-display')` |
| `.css('color', 'red')` | `.addClass('text-danger')` |

It is the right idea but **incomplete** — see §4.

---

## 3. End-to-End Flow

### 3.1 Design-time (marketer configuring the tile)

1. Marketer drags the PostGrid tile into a journey. SFMC reads `config.json`, renders an iframe pointing at `https://<app>/index.html` and sizes it to 1048×500.
2. Browser loads `index.html` → `jquery.min.js` → `require.js` → `loader.js` → `customActivity.js` (AMD).
3. `onRender` fires Postmonger triggers: `requestSchema`, `requestTokens`, `requestEndpoints`, `ready`.
4. SFMC answers with `initActivity` (saved config), `requestedSchema` (DE columns for the entry event), `requestedTokens` (fuel OAuth token + tenant subdomain).
5. **Step 1 — Connect Account.** User pastes Test (required) and Live (optional) API keys. On Next:
   * `validateApiKey` calls `GET https://api.postgrid.com/print-mail/v1/contacts?limit=1` with the key.
   * `fetchClientCredentials` POSTs `{authTSSD, token, externalKey}` to `/client-credentials/`. Backend calls the SFMC SOAP API and returns the XML the client parses.
6. **Steps 2–3 — Choose & author the piece.** Templates/envelopes/contacts are fetched from PostGrid on demand.
7. **Step 4 — Map fields.** DE columns are wired to PostGrid address fields (`firstName`, `addressLine1`, …).
8. **Step 5 — Preview.** `createMessage` creates a one-off piece at PostGrid, iframe is pointed at the returned PDF URL (S3-signed link on `*.amazonaws.com`).
9. On Save, `save()` serializes **everything** (including both API keys) into `inArguments[0].internalPostcardJson` and triggers `updateActivity`. SFMC persists the JSON as part of the journey definition.

### 3.2 Run-time (journey firing)

1. A contact enters the activity. SFMC POSTs `/execute` with:
   ```
   {
     keyValue, journeyId, activityId,
     inArguments: [{ authorization: {authToken, authTSSD}, internalPostcardJson, MapDESchema, mergeVariableSchema, postcardJson, ... }]
   }
   ```
2. `exports.execute` (routes/activity.js:27) merges the contact's DE values into `postcardJson.to` + `mergeVariables`, stamps `sendDate = now + 5 min`, picks test vs. live key, POSTs to PostGrid.
3. On success it writes an audit row to the logging DE via `logToDataExtension`. On failure it writes the error body and returns 500.

---

## 4. Why CSP / `style-src` Errors Fire — Root-Cause Analysis

> This is the single most important section.

### 4.1 The CSP being sent

`app.js:54-59`:

```js
styleSrc: [
  '\'self\'',
  'https://*.marketingcloudapps.com',
  'https://fonts.googleapis.com',
  'https://cdnjs.cloudflare.com'
],
```

Notice the comment on line 53: *"unsafe-inline removed for ZAP compliance"*. That is the crux.

### 4.2 What the browser actually blocks

CSP Level 3 splits `style-src` into two sub-directives that are **both** gated by `'unsafe-inline'` when set via `style-src`:

| Sub-directive | Governs |
|---|---|
| `style-src-elem` | `<style>` elements and `<link rel="stylesheet">` |
| `style-src-attr` | `style="…"` attributes **and `element.style.prop = value` from JavaScript** (jQuery's `.css(prop, val)` is compiled to exactly this) |

Because `styleSrc` does not include `'unsafe-inline'`, **every JS-driven style write** is rejected by Chrome/Edge. That is the exact string the user is seeing in DevTools:

> Refused to apply inline style because it violates the following Content Security Policy directive: "style-src 'self' https://*.marketingcloudapps.com ..."

### 4.3 Where the violating writes live (verified)

`customActivity.js` contains **23 style-write call-sites** (line numbers):

| Line | Call | Trigger |
|---|---|---|
| 798, 802, 814, 2090, 2095, 2301 | `.css('border', '1px solid red')` | Validation-failure red borders. |
| 808, 824, 2113 | `.css('border', '')` | Clearing validation. |
| 904, 905, 2424-2429 | `.css('display','block')` | Showing "Existing Template" radio. |
| 1846 | `.css('display','inline-block')` | Retry-preview button. |
| 2364 | `$('body').css('overflow','')` | Restoring scroll after modal close. |
| 2449, 2453 | `.css('color','gray')` / `.css('color', color)` | Disabled extra-service text. |
| 2505, 2507 | `.css('color','grey'/'black')` | Editor placeholder. |
| 2514, 2517 | `.css('color','black'/'gray')` | Express-delivery label. |

A further **8 call-sites read** styles (`.css('display') === 'block'`) — reads do **not** trigger CSP, only writes do. Lines 985, 1096, 1166, 1311, 1383, 1447, 2721, 2726.

So **every time a user** (a) enters a bad API key, (b) opens the preview, (c) toggles Express Delivery, (d) clicks Next with an invalid field, or (e) reaches Step 2 with certain states — the browser throws a CSP error and the UI silently fails (red border doesn't show, button doesn't appear, etc.).

### 4.4 Other CSP observations

| Directive | State | Notes |
|---|---|---|
| `scriptSrc` | Strict (`'self'` + specific CDNs). | No inline `<script>`, nothing executed via CDN at runtime → **no script-src violations expected**. |
| `scriptSrc` list | Contains `code.jquery.com`, `cdnjs.cloudflare.com`, `cdn.jsdelivr.net` | **Dead**: nothing actually loads from these domains at runtime. Safe to remove. |
| `require.js` | Uses dynamic `<script>` tag injection (not `eval`) for AMD modules. | OK under strict CSP as long as the URL is allowed. Here it loads `./js/customActivity.js` (same origin) — fine. |
| `frameAncestors` | `'self'`, `*.marketingcloudapps.com`, `*.salesforce.com`, `*.exacttarget.com` | ✅ Correct for SFMC embedding. |
| `frameSrc` | `'self'`, `blob:`, `*.postgrid.com`, `*.amazonaws.com` | ✅ Needed because PostGrid preview PDFs resolve to S3-signed URLs. |
| `connectSrc` | `'self'`, `*.marketingcloudapps.com`, `api.postgrid.com` | ✅ Matches runtime traffic. |
| `fontSrc` | `'self'`, `fonts.gstatic.com`, `cdnjs.cloudflare.com` | Only `self` is used today. gstatic/cdnjs entries are dead. |
| `workerSrc: 'none'`, `objectSrc: 'none'`, `baseUri: 'self'` | ✅ | Good hygiene. |

### 4.5 Two ways to fix `style-src`

**Option A — Pragmatic / fastest:** add `'unsafe-inline'` to `styleSrc`.
Pros: one-line fix, everything works.
Cons: ZAP / security reviewers will flag it. Loses a real layer of XSS defence (a CSS-based exfiltration path).

**Option B — Correct / aligned with the existing `fix_js.js` intent:** replace every write `.css()` with a CSS-class toggle.

Concretely, extend `fix_js.js` and `style.css` to cover:

```js
// in fix_js.js
code = code.replace(
  /\.css\(['"]border['"]\s*,\s*['"]1px solid red['"]\)/g,
  ".addClass('error-border')"
);
code = code.replace(
  /\.css\(['"]border['"]\s*,\s*['"]['"]\)/g,
  ".removeClass('error-border')"
);
code = code.replace(
  /\.css\(['"]display['"]\s*,\s*['"]block['"]\)/g,
  ".removeClass('hidden-display').addClass('block-display')"
);
code = code.replace(
  /\.css\(['"]display['"]\s*,\s*['"]inline-block['"]\)/g,
  ".removeClass('hidden-display').addClass('inline-block-display')"
);
code = code.replace(
  /\.css\(['"]color['"]\s*,\s*['"](gray|grey)['"]\)/g,
  ".addClass('text-muted')"
);
code = code.replace(
  /\.css\(['"]color['"]\s*,\s*['"]black['"]\)/g,
  ".removeClass('text-muted')"
);
```

Then add to `style.css`:

```css
.error-border      { border: 1px solid red !important; }
.inline-block-display { display: inline-block !important; }
.text-muted        { color: gray !important; }
```

Remaining awkward cases:

* `$('body').css('overflow','')` at line 2364 — either use a class toggle or simply remove (it's a reset to default; unsetting `overflow` has no visible effect if no class ever set it).
* Lines 2449, 2453 use a **variable** color (`.css('color', color)`) — this cannot be classified without knowing what `color` is at runtime. Refactor to a handful of modifier classes (`.text-enabled`, `.text-disabled`).

**Option C — Nonces / hashes.** Over-engineered for this use-case; skip.

**Recommendation:** ship **Option A first** to unblock users, then deliver **Option B** and remove `'unsafe-inline'` again.

---

## 5. Gap Analysis (Beyond CSP)

### 5.1 Security gaps

1. **API keys exposed to the client.** `previewPayload.test_api_key` / `live_api_key` are held in browser memory *and* persisted into `inArguments[0].internalPostcardJson` — i.e., into the journey definition JSON. Anyone with Journey Builder access can read them via DevTools or by exporting the journey. Better: pass a *reference* (DE external key) to the backend and let `execute` fetch the real keys server-side per run.
2. **SOAP template injection.** `routes/activity.js:140-158` and `184-205` interpolate `${externalKey}`, `${deName}`, `${token}`, `${authTSSD}` straight into an XML body. A `deName` containing `<`, `>`, `&`, `]]>`, or an injected `</Value><Value>…` can break or subvert the SOAP call. Fix: XML-escape these values (`&amp;`, `&lt;`, `&gt;`, `&quot;`) before interpolation.
3. **SSRF surface on `authTSSD`.** `https://${authTSSD}.soap.marketingcloudapis.com` — if the attacker can control `authTSSD`, a value like `evil.attacker.com/x#` can redirect the request. Fix: whitelist-regex `authTSSD` (`^[a-z0-9-]+$`) on the server.
4. **No input validation on any POST body.** `/client-credentials`, `/fetch-external-key`, `/execute` assume the shape is correct. Add a schema validator (`zod`, `joi`, or hand-rolled) and 400 on violation.
5. **No rate-limiting.** `/execute` is unauthenticated from the network's perspective (SFMC doesn't sign the request by default unless `useJwt: true` is set). Anyone who finds the URL can trigger mail creation. Turn on `useJwt: true` in `config.json` and verify the JWT in `/execute`.
6. **No JWT verification today.** `config.json` has `useJwt: false`. Marketing Cloud can sign requests with a shared secret; the backend should verify it on every lifecycle call.
7. **`helmet` `crossOriginResourcePolicy: cross-origin`** — required for iframe embedding, fine, but worth noting.
8. **No CORS middleware.** Works by accident because the iframe is same-origin with the app server. Add `cors()` with an explicit allow-list in case tenants ever embed from a different domain.
9. **Body limit 50 MB** (`app.js:136-137`) — far larger than needed, enlarges DoS surface. Drop to ~1 MB.
10. **`loggingExternalKey` trusted from the client.** The client can ask the backend to log audit rows into *any* DE whose key it knows. Restrict to a configured DE or verify ownership.

### 5.2 Architectural / code-quality gaps

1. **Frontend monolith.** `customActivity.js` is 2,731 lines of shared-mutable globals. Split by concern: `state.js`, `postmonger-adapter.js`, `steps/stepN.js`, `api/postgrid.js`, `api/sfmc.js`. Use ES modules and drop AMD/require.js.
2. **Duplicate base URL.** Frontend hardcodes `https://api.postgrid.com/print-mail/v1/` at line 24; backend reads `process.env.POSTGRID_API_BASE_URL`. They can drift. Have the backend inject a `/config.json` endpoint the frontend reads.
3. **Dead preconnect to Google Fonts** (`index.html:16-17`). The CSS references `Roboto` but nothing loads it. Either load the font or drop the preconnects. Today the UI silently falls back to system sans-serif.
4. **Dead CDN entries in CSP** (`code.jquery.com`, `cdnjs`, `jsdelivr` in `scriptSrc`; `gstatic`, `cdnjs` in `fontSrc`). Remove anything unused to tighten the policy.
5. **Hardcoded environment values.** `config.json` pins a specific App Runner URL and an `applicationExtensionKey` GUID. Template these per environment; otherwise you cannot promote cleanly dev → staging → prod.
6. **`config.json` has `save/publish/validate/stop` URLs but not `execute`** under `configurationArguments` — `execute` is under `arguments`. This is per SFMC spec, but note that `save` stub in `routes/activity.js:16` doesn't actually persist anything; SFMC's Postmonger `updateActivity` is doing the work. Document this or remove the misleading stub.
7. **No structured logging.** `console.log` only in `app.js:161`. No request IDs, no per-contact trace, so journey-run failures are hard to investigate. Pick `pino` or `winston`.
8. **`execute` responds 200 even after `logToDataExtension` is fired-and-forgotten** (line 111). If the log-write fails, it silently swallows. Await it and 5xx on failure, or at minimum `.catch` it explicitly.
9. **`execute` returns 500 on PostGrid failure** but the response body still says `'Postcard creation failed'`/`'Error creating postcard'`. SFMC will either retry (dangerous if the piece was actually created) or mark the contact errored. Decide: retriable (5xx) vs. permanent (4xx) based on PostGrid's error code.
10. **No idempotency key.** If SFMC retries `/execute`, the contact gets duplicate mail. Pass `Idempotency-Key: <journeyId>-<activityId>-<contactKey>` to PostGrid.
11. **jQuery + require.js** ~170 KB of dependencies for what modern browsers do natively. Removing them cuts bundle and attack surface.
12. **CSS `100vh` inside a 500 px SFMC modal** (`style.css:350`, `1024`, `1234-1235`) — guaranteed overflow. Switch to `height: 100%` inside a flex column.
13. **No tests.** `package.json:10` has the placeholder `echo "Error: no test specified" && exit 1`. At minimum, contract-test the `/execute` payload and the two SOAP brokers.
14. **`execute` sets `sendDate = now + 5 min`** unconditionally — a journey delay earlier in the canvas is ignored. Confirm this is intentional; otherwise pass the scheduled send time from SFMC.
15. **`fetchTemplates` / `fetchContacts` call PostGrid from the browser with the API key.** Even without the key-exposure issue, CORS would eventually break if PostGrid tightens cross-origin. Proxy through the backend.
16. **`previewPayload.authorization` embeds a live OAuth token into the saved journey activity.** That token is short-lived, but still. The backend can mint a fresh token on `execute` — it already does in `getAuthToken`. Stop storing the token client-side.

### 5.3 UX / correctness gaps

1. Step 5 preview retries for 60 s with no user feedback beyond a spinner (`showPdfPreview`, line 1830). Show a status message every 10 s.
2. Validation errors only style a border — with CSP active they silently fail and the user has no idea why the Next button won't advance.
3. `fix_js.js` exists but is not wired into `npm run build`. Easy to forget to run.
4. `README.md` is one line. Nothing describes setup, env vars, deploy.

### 5.4 Best-practice comparison

| Area | Current | Industry-standard SFMC Custom Activity |
|---|---|---|
| JWT on lifecycle calls | Off | On — verify shared secret from SFMC `config.json → useJwt: true`. |
| Credential storage | In journey JSON | In an SFMC Installed Package / Data Extension, fetched server-side on execute. |
| Bundler | None (raw files) | esbuild/webpack, one minified bundle per entry. |
| Module system | AMD + globals | ES modules, tree-shaken. |
| State management | jQuery DOM + globals | A small store (e.g. Zustand, or plain pub/sub) with pure step validators. |
| Logging | console | `pino` + JSON logs + request IDs, shipped to the same log backend as the PaaS. |
| Secrets | `.env` | Secrets manager (AWS Secrets Manager / Railway secrets). |
| Retries | None | Exponential backoff + idempotency keys on PostGrid calls. |
| CSP | Strict `style-src` without class-migration → broken | Strict `style-src` **after** migrating all style writes to class toggles. |

---

## 6. Prioritised Fix List

> Top item is your user-visible symptom. Work top-to-bottom.

| # | Severity | Fix | Effort |
|---|---|---|---|
| 1 | 🔴 Blocker | **Add `'unsafe-inline'` to `styleSrc`** to unblock production today (`app.js:54`). | 1 min |
| 2 | 🔴 Blocker | Extend `fix_js.js` + `style.css` to cover `border`, `display:block/inline-block`, `color` writes; re-run the codemod; remove `'unsafe-inline'` again. | 1–2 hrs |
| 3 | 🟠 High | XML-escape `externalKey`, `deName`, `token`, `authTSSD` in the two SOAP brokers (`routes/activity.js`). | 30 min |
| 4 | 🟠 High | Validate `authTSSD` against `^[a-z0-9-]+$` before building SOAP URLs. | 10 min |
| 5 | 🟠 High | Turn on `useJwt: true` in `config.json` and verify JWT in `app.js`. | 2–3 hrs |
| 6 | 🟠 High | Stop persisting raw API keys + OAuth token in `inArguments`. Store a DE external-key reference and fetch on execute. | 0.5–1 day |
| 7 | 🟠 High | Add idempotency key on PostGrid POST in `execute`. | 30 min |
| 8 | 🟡 Medium | Drop body-parser limit from 50 MB to 1 MB (`app.js:136-137`). | 1 min |
| 9 | 🟡 Medium | Await `logToDataExtension` and surface failures in `execute`. | 20 min |
| 10 | 🟡 Medium | Remove dead CDN entries from CSP (`scriptSrc` / `fontSrc`). | 5 min |
| 11 | 🟡 Medium | Remove the dead Google-Fonts preconnect, or actually load Roboto. | 10 min |
| 12 | 🟡 Medium | Replace `100vh` with `height: 100%` in `style.css` inside `#step1`, `.mapping-divider`, `.loader-overlay`. | 20 min |
| 13 | 🟢 Low | Structured logging via `pino`. | 1 hr |
| 14 | 🟢 Low | Split `customActivity.js` into ES modules by step. | 1–2 days |
| 15 | 🟢 Low | Drop jQuery / require.js. | 2–3 days |
| 16 | 🟢 Low | Add CI tests for `/execute` payload shape and SOAP brokers. | 1 day |

---

## 7. Quick-reference: Every Endpoint

| Method | Path | Handler | Auth | Purpose |
|---|---|---|---|---|
| GET | `/health` | `app.js:153` | none | Liveness probe. |
| POST | `/client-credentials/` | `activity.fetchClientCredentials` | **none today** | SOAP retrieve PostGrid creds from a DE. |
| POST | `/fetch-external-key/` | `activity.fetchExternalKey` | none | Resolve DE name → CustomerKey. |
| POST | `/save/` | `activity.save` | none | Stub. |
| POST | `/validate/` | `activity.validate` | none | Stub. |
| POST | `/publish/` | `activity.publish` | none | Stub. |
| POST | `/execute/` | `activity.execute` | none (should be JWT) | Runtime: create PostGrid piece + log. |
| POST | `/stop/` | inline in `app.js:148` | none | Stub. |

---

## 8. TL;DR

* The app is a standard SFMC Custom Activity: Express + static SPA + Postmonger wizard + per-contact `/execute`.
* The `style-src` errors the user is seeing are **caused by 23 `.css('prop', value)` writes in `customActivity.js`**, because `app.js` sends a strict `style-src` without `'unsafe-inline'` and modern Chrome enforces `style-src-attr` for JS-set `element.style.*`.
* Shortest path to green: add `'unsafe-inline'` back to `styleSrc` now, then finish the class-migration that `fix_js.js` started and drop `'unsafe-inline'` again.
* Biggest non-CSP risk: **PostGrid API keys and SFMC OAuth tokens are persisted inside the journey JSON**. This should be replaced with a backend-fetch-on-execute pattern.
* Second biggest: no JWT verification on lifecycle calls, and SOAP queries interpolate user-controlled strings without escaping.
