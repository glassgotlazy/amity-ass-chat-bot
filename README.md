# Amity Lucknow — Admission Assistant

A chatbot that answers admission questions about **Amity University, Lucknow**:
courses, eligibility, entrance tests, fees, scholarships, hostel, campus life,
academics, placements and student services.

It answers **159 topics offline**, from a knowledge base and retrieval engine
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
npm install                 # one dependency: @anthropic-ai/sdk
cp .env.example .env        # then put your Anthropic key in .env
npm start                   # -> http://localhost:3000
```

The key is read by `server.js` only. It is never sent to the browser, `.env`
is git-ignored, and the server refuses to serve that file. Model defaults to
`claude-opus-5`; override with `ANTHROPIC_MODEL` in `.env`.

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

Self-check: **1472 of 1489** trigger phrases retrieve their own entry; the
remainder land on a near-identical neighbour.

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

Topic sidebar (drawer on mobile), starter questions, follow-up suggestions
under every answer, light/dark theme following the OS with a saved override,
conversation saved to `localStorage`, transcript download, copy-answer, and a
composer with `Enter` to send / `Shift`+`Enter` for a new line. Responsive to
360 px; respects `prefers-reduced-motion`.

## Data disclaimer

Fees, cut-offs, dates and placement figures are **indicative summaries that
change every admission cycle**, and this is not an official Amity University
service. AI-assisted answers are generated text and can be wrong. Confirm
anything you will act on at <https://www.amity.edu/lucknow> or with the
admission office.
