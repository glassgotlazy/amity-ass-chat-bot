# Amity Lucknow — Admission Assistant

A chatbot that answers admission questions about **Amity University, Lucknow**:
courses, eligibility, entrance tests, fees, scholarships, hostel, campus life,
academics, placements and student services.

It answers **230 topics offline**, from a knowledge base and retrieval engine
built into `index.html`. No API key, no server and no internet connection are
needed for those. An **optional AI fallback** covers the rest — but only for
questions that are actually about Amity.

## How a question is handled

```
question
   |
   +-- not about Amity / campus  ->  declined. Nothing is sent anywhere.
   |
   +-- about Amity ---------------+
                                  |
                 in the knowledge base  ->  answered offline, instantly
                                  |
              not in the knowledge base  ->  AI fallback (if configured)
```

The scope gate is enforced **twice**: once in the browser (`scopeOf()`) and
again on the server (`inScope()` in `server.js`) before any upstream call is
made. A user who edits the page in devtools still cannot use the key as a
general-purpose chatbot. Off-topic requests are logged and rejected with
`400 out_of_scope`.

> The two copies of the domain term list — in the `guard.js` section of
> `index.html` and near the top of `server.js` — must be kept in sync when
> you add vocabulary.

## Run it

**Offline only (no setup):** open `index.html` in any browser. Everything in
the knowledge base works; the AI fallback reports itself as unavailable.

**With the AI fallback:**

```bash
npm install
cp .env.example .env        # then put your key in .env
npm start                   # -> http://localhost:3000
```

Either provider works — set **one** key in `.env` and that decides which is
used (OpenAI wins if both are set):

| Key in `.env` | Provider | Model setting | Default |
|---|---|---|---|
| `OPENAI_API_KEY` | OpenAI | `OPENAI_MODEL` | `gpt-4o-mini` |
| `ANTHROPIC_API_KEY` | Claude | `ANTHROPIC_MODEL` | `claude-opus-5` |

Set `OPENAI_MODEL` to any chat model your account can use; list them with
`curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY"`.

### Deploying to Vercel

Vercel does not run `server.js` — it serves `index.html` as a static file and
runs anything under `api/` as serverless functions. Those functions are
`api/ask.js` and `api/health.js`; both call the same `lib/assistant.js` as the
local server, so the scope gate and the prompt are identical either way.

Two things are needed for the AI fallback to work there:

1. **Set the key in Vercel, not in a file.** Project -> **Settings** ->
   **Environment Variables** -> add `OPENAI_API_KEY` (and optionally
   `OPENAI_MODEL`) for Production, Preview and Development. `.env` is
   git-ignored, so it is never uploaded and the deployment cannot see it.
2. **Redeploy after adding it.** Environment variables are baked in at build
   time; an existing deployment keeps running without them. Deployments ->
   latest -> **Redeploy**.

Check the result at `https://<your-project>.vercel.app/api/health` — it should
report `{"ai":true,"provider":"openai",...}`. If it reports `ai:false`, the
variable is missing or the deployment predates it. If it 404s, the `api/`
folder was not deployed.

If the site only ever gives knowledge-base answers and the sidebar reads
"Offline knowledge base", that is this exact situation: the page probed
`/api/health`, got nothing usable, and correctly fell back to offline-only.

Note that serverless instances are short-lived, so the in-memory rate limit is
per instance there rather than global. Set a spending limit on your provider
account as the real backstop.

### Running it in GitHub Codespaces

The key can live in a **Codespaces secret** instead of a local `.env`:

1. github.com -> your avatar -> **Settings** -> **Codespaces** -> **Codespaces secrets**
2. **New secret**, named `OPENAI_API_KEY`, and give this repository access to it
3. Open the repo in a Codespace (create it *after* adding the secret, or rebuild
   an existing one -- secrets are injected at container start)
4. `npm start` in the Codespace terminal, then open the forwarded port 3000

`server.js` reads `process.env.OPENAI_API_KEY` directly, so no `.env` file is
needed there. `.devcontainer/devcontainer.json` handles `npm install` and the
port forwarding.

Note the distinction: a **Codespaces** secret reaches the running app; an
**Actions** repository secret (Settings -> Secrets and variables -> Actions)
only exists inside workflow runs and will not reach the server.

**Changing the key later:** edit `.env`, then restart the server — the key is
read once at startup. Check it took with `curl localhost:3000/api/health`,
which reports `{"ai":true,"provider":"openai",...}` without revealing the key.
A shell variable of the same name overrides the file, so `unset OPENAI_API_KEY`
if an old exported value is shadowing your change.

The key is read by `server.js` only. It is never sent to the browser, `.env`
is git-ignored, and the server refuses to serve that file.

Guard rails on the fallback: 15 questions per IP per 10 minutes, 200 per day,
600-character limit per question, and a system prompt that restricts answers to
Amity Lucknow, forbids invented fees/dates/figures, and caps the answer at
about 180 words. Every AI answer is labelled **AI-assisted · verify** in the
transcript.

## How the offline answers are found

1. **Normalisation** — abbreviation expansion (`b.tech` → `btech`), stop-word
   removal, light stemming, synonym folding, and typo repair by edit distance
   against the index vocabulary (`hostl fees`, `elgibility`, `plasement` all
   resolve).
2. **TF-IDF retrieval** — cosine similarity against every entry, with phrase,
   bigram and title bonuses.
3. **Slot routing** — `<course> + <aspect>` questions ("btech fees",
   "eligibility for MBA") jump straight to the exact entry, and the last course
   discussed is remembered so "and the fees?" still works.
4. **Multi-part questions** — "fees and hostel?" returns both answers.
5. **Confidence bar** — a loose match is treated as a miss: it is offered as a
   related topic rather than passed off as the answer, and the question goes to
   the AI fallback instead (when it is available).

Self-check: **1974 of 2014** trigger phrases retrieve their own entry; the
remainder land on a near-identical neighbour. Picking a topic by its exact
title (palette, topic list, follow-up chip) bypasses retrieval and opens that
entry directly.

### Placement figures

The placement, fee and scholarship answers carry figures from the **NIRF 2025
data report** and published 2026 fee listings rather than invented ranges —
B.Tech median ₹5.5 LPA with 92 of 105 placed, MBA median ₹5.5 LPA with 80 of
87, UG median ₹4.08 LPA, PG median ₹4.4 LPA. Each such answer names its source
and says to confirm with the placement cell. Sources are admission portals
summarising the NIRF report, not an official university statement.

## Editing the knowledge base

Each answer is one entry in the `KB` array inside the `<script>` block:

```js
{
  id:'fee_btech', topic:'Fees', title:'B.Tech fees',
  q:['btech fees','engineering fees','how much is btech'],  // trigger phrases
  a:`### B.Tech (indicative)
- **Tuition:** roughly ...`,                                // answer markup
  chips:['Scholarship options','Hostel fees']               // follow-up chips
}
```

Markup supported in `a`: `### heading`, `- bullet`, `1. numbered`, `**bold**`,
`*italic*`, `` `code` ``, `[label](url)`, and `> footnote`. Add an entry and
reload — the index rebuilds on load, there is no build step.

## Interface

Editorial layout rather than a chat-widget look: **Fraunces** for display type,
**IBM Plex Sans** for text and **IBM Plex Mono** for labels and figures. All
three are self-hosted and embedded in the page as base64 woff2 (about 132 KB
total), so the typography survives with no network and from a `file://` URL.

Motion is used to show structure, not for decoration: the monogram draws in on
load, the topic tally counts up, starter rows reveal as they scroll into the
transcript, answer blocks fade up in sequence, the thinking indicator runs a
scanning bar while the knowledge base is searched, and hover states animate the
sidebar rule, chips and suggestions. Everything collapses to no motion under
`prefers-reduced-motion`.

**Ctrl/Cmd + K** opens a command palette over all 226 visible topics, with
type-ahead highlighting, arrow-key selection and Enter to ask; `/` jumps to the
composer. Answers render **tables** (placement figures, fee structures, CTC
breakdowns), which flatten back to aligned text when copied or exported.

Also: topic sidebar (drawer on mobile), follow-up suggestions under every
answer, light/dark theme following the OS with a saved override, conversation
saved to `localStorage`, transcript download, copy-answer, and a composer with
`Enter` to send / `Shift`+`Enter` for a new line. Responsive to 360 px.

## Data disclaimer

Fees, cut-offs, dates and placement figures are **indicative summaries that
change every admission cycle**, and this is not an official Amity University
service. AI-assisted answers are generated text and can be wrong. Confirm
anything you will act on at <https://www.amity.edu/lucknow> or with the
admission office.
