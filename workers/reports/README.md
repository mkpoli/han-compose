# The report intake

`ids-reports` is the Cloudflare Worker behind the composition report forms of the IDS workshop
(https://ids.mkpo.li) and the rare-character compendium (https://rare.glyphatlas.org). A reporter
needs no account: the Worker takes what the browser collected and has it filed as an issue on
[mkpoli/han-compose](https://github.com/mkpoli/han-compose), then answers with the issue's number and URL.

The issue is opened by `.github/workflows/file-report.yml`, the repository's own action, so the
`github-actions[bot]` is its author and the report names the person behind it. The Worker dispatches
the report to that run, which files the issue; the Worker finds the issue on GitHub and answers the
dialog with it. For a workshop report, a second job then photographs the drawing from the site and
adds it to the issue. A compendium report carries its own drawing, which the Worker stores.

Each issue is labelled with the site it came from, `from: ids-input` or `from: rare-compendium`.

## The endpoint

### `POST /`

`multipart/form-data`, answered as JSON. Every field is a string part except `image` and
`documentFile`, which have to be file parts; a string sent for either is ignored.

| Field | Required | Limit | What it is |
| --- | --- | --- | --- |
| `symptom` | yes | 1–4000 characters | What went wrong, in the reporter's own words |
| `sequence` | no | 2000 code units | The IDS text being edited |
| `link` | no | must start with one of the site origins | A share URL for the document, or the compendium record |
| `document` | no | 200 KB | The document as JSON |
| `context` | no | 32 KB | A JSON object of environment facts |
| `contact` | no | 200 characters | A handle or an email, if the reporter wants an answer |
| `turnstile` | when a secret is set | — | The Turnstile token |
| `image` | no | 5 MB, PNG, JPEG or WebP | The drawing as it looked |
| `documentFile` | no | 200 KB, JSON | The document as a file |

A `fingerprint` field is accepted and ignored; the dedupe key is computed here.

The keys `context` is read for, in the order the issue's environment table lists them:
`appVersion`, `commit`, `route`, `preview` (the preview's step and badge), `viewport`,
`devicePixelRatio`, `locale`, `theme`, `face`, `userAgent`, `platform`, `fonts` (an array),
`composerBase`, `local`, `previewVersion` and `historyLength`; a compendium report adds `site`
(`"rare"`, which also decides the `from: rare-compendium` label), `style`, `layout`,
`composerVersion` and `record`. `face` and the rest of the settings ride in `context`. A `console` array holds the recent log lines. A
missing key reads as `—`. `locale`, when it is one of `en ja zh-Hans zh-Hant ko vi`, also decides
the `lang:<locale>` label.

Answers:

```json
201 {"number": 123, "url": "https://github.com/mkpoli/han-compose/issues/123", "duplicate": false}
200 {"number": 123, "url": "https://github.com/mkpoli/han-compose/issues/123", "duplicate": true}
```

A `200` means the same sequence and symptom came in within the last fortnight; the existing issue
gets a one-line comment instead of a second issue.

An error is `{"error": "<code>", "message": "<sentence>"}`:

| Status | Code |
| --- | --- |
| 400 | `invalid_request` |
| 403 | `forbidden_origin`, `captcha_failed` |
| 404 | `not_found` |
| 405 | `method_not_allowed` |
| 413 | `too_large` |
| 415 | `unsupported_media_type` |
| 429 | `rate_limited` |
| 502 | `upstream_error` |

The answer takes as long as the action takes to file the issue, about ten seconds. A reporter whose
issue has not appeared after eighty seconds gets a `502` and can try again; a report sent again
within a quarter of an hour is answered with the issue its first run filed.

### `GET /health`

`{"ok": true}`.

### `OPTIONS`

The preflight. `Access-Control-Allow-Methods: POST, OPTIONS`, and `Vary: Origin` on every answer.
Only the origins in `SITE_ORIGINS` (`https://ids.mkpo.li` and `https://rare.glyphatlas.org`), the
workshop's preview versions on `*.workers.dev`, the desktop app
(`tauri://localhost`, and `http://tauri.localhost` on Windows) and any port of `http://localhost`
are allowed; another origin gets `403`. A request with no `Origin` header is not a browser's and passes, so `curl` works.

## What the Worker does with a report

The issue body holds the symptom, the sequence in a fenced block, the share link, the drawing, a
table of the environment, and the console output, the document and the reporter folded into
`<details>`. Every submitted value is escaped for Markdown first, so nothing a reporter writes can
format the issue or arrive as HTML. A `@` is followed by a zero-width space, since a backslash does
not stop GitHub notifying the account a symptom happens to name.

An issue body may hold 65536 characters, which a 200 KB document would overrun on its own, so each
part the reporter controls is cut to a share of that budget: 20000 characters of the document, 8000
of console output, 500 per table cell. A cut part says it was cut.

The drawing goes to the orphan branch `bug-attachments` under `reports/<yyyy>/<mm>/<uuid>.png`,
through the Git Data API, and the body points at
`https://github.com/mkpoli/han-compose/raw/bug-attachments/<path>`. When the page cannot be
photographed or the picture stored, the issue gets a line saying so; a `draw` job that fails before
that step leaves the issue without a drawing.

Abuse control: the total body is capped at 8 MB, checked against `Content-Length` before any of it
is read and counted off the stream as well, since a chunked body carries no length. Per
`CF-Connecting-IP` a reporter may file five an hour and twenty a day, against three hundred a day
for everyone.

The counters are KV keys in fixed windows, so they expire on their own. The day's total is split
over ten keys, because KV accepts one write a second to a key and a single counter would be written
on every report. Counting is best effort throughout: KV is eventually consistent, so a simultaneous
burst across edges can slip one or two past a limit, and a rejected counter write is logged rather
than charged to the reporter.

## Filing the report

`repository_dispatch` with `event_type: report` carries the report's text fields, the report's key
and whether there is a drawing to take: the reporter sent one, the report has a share link and its
context does not say `site: "rare"`. The image itself does not travel, because the action
photographs the drawing from the site. A compendium report's image is stored by the Worker before the
dispatch, which carries its address as `image` (or `imageFailed` when it could not be stored).

GitHub takes a payload under 64 KB, so a report whose fields come to more than 30 KB is answered
`413` and never dispatched.

| What | Where |
| --- | --- |
| The action | `.github/workflows/file-report.yml` |
| Its `file` job | `workers/reports/intake/file.js` |
| Its `draw` job | `workers/reports/intake/draw.js` |

`ensureLabels` runs in the Worker before the dispatch, so the issue is labelled the moment it
exists. The `file` job installs nothing and opens the issue with the run's token. The body ends in
`<!-- report:<key> -->`, where the key is the dedupe key, and the Worker looks for that mark among
the issues labelled `report`: once before dispatching, which is how a report sent again finds its
issue, then six seconds after the dispatch and every four from there. Only the end of a body counts,
since a reporter's text inside it may quote any mark.

The `draw` job runs when the dispatch says `drawing`, which a compendium report never does. It opens the report's `link` in Chromium, in
the face the report's `context` names (`sans`, `serif`, `fangsong` or `klee`; the link carries the
sequence alone), photographs the preview once it has settled on a drawing or on a failure to
compose, commits the picture to `bug-attachments` and rewrites the issue's body to show it.

## Configuration

Vars live in `wrangler.jsonc`: `REPO` and `SITE_ORIGINS`, a comma-separated list of the sites that may send reports, plus the `REPORTS` KV binding.

Secrets:

| Secret | Required | What it is |
| --- | --- | --- |
| `GITHUB_TOKEN` | yes | A fine-grained token on the repository with **Issues: write** and **Contents: write** |
| `TURNSTILE_SECRET` | no | A Turnstile secret key. Unset, the challenge is skipped entirely |

## Running and deploying

```sh
cd workers/reports
bunx wrangler@4.158.0 secret put GITHUB_TOKEN     # paste the token
bunx wrangler@4.158.0 dev                         # http://localhost:8787
bunx wrangler@4.158.0 deploy
```

`wrangler dev` reads secrets from a `.dev.vars` file next to `wrangler.jsonc`:

```sh
printf 'GITHUB_TOKEN=%s\n' "$(gh auth token)" > .dev.vars
```

A local run dispatches to the real repository, so a report from `wrangler dev` files a real issue
once the action runs.

A report by hand:

```sh
curl -sS http://localhost:8787/ \
  -F symptom='The preview is blank after I switch the face.' \
  -F sequence='⿰亻哥' \
  -F link='https://ids.mkpo.li/#s=abc' \
  -F document='{"root":{"kind":"character","value":"亻"}}' \
  -F context='{"appVersion":"0.1.0","locale":"ja","console":["TypeError: x is not a function"]}' \
  -F image=@drawing.png
```

The tests are in `js/tests/report-worker.test.js` and run with the package's:
`cd js && bun test tests/report-worker.test.js`.

## Deploying

`.github/workflows/reports.yml` deploys from `main` whenever `workers/reports/` changes, so a merge
is enough. Two secrets have to exist on the han-compose repository first:

| Secret | What it is |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | A token with **Workers Scripts: Edit**, **Workers KV Storage: Edit** and, for the custom domain, **Workers Routes: Edit** on the zone |
| `REPORTS_GITHUB_TOKEN` | The Worker's own fine-grained token on `mkpoli/han-compose`: it creates the labels, dispatches the report, finds the filed issue and comments on repeats. Needs **Contents: Write** (a repository dispatch asks for it) and **Issues: Write** (the labels), re-applied on every deploy |

The action files with the `GITHUB_TOKEN` GitHub gives it, which on a dispatch is the repository's own
bot; no secret of the repository's stands behind the issue's author.

Until both are set the job skips itself and the deploy stays manual; the token is re-applied before
each deploy, so a version never goes out without it. The Worker answers on
`report.ids.mkpo.li` (a custom domain in the config) and on `ids-reports.mkpoli.workers.dev`.
