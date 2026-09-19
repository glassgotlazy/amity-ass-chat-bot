# Amity Lucknow — Admission Assistant

A single-file chatbot that answers admission questions about **Amity University,
Lucknow** — courses, eligibility, entrance tests, fees, scholarships, hostel,
campus life, academics, placements and contact details.

**No API key. No server. No internet.** Everything (knowledge base + retrieval
engine + UI) lives inside `index.html`, so it works from a double-clicked file,
on aeroplane mode, and on a college Wi-Fi that blocks everything.

## Run it

Just open `index.html` in any browser.

Prefer `localhost`? There's an optional dependency-free static server:

```bash
npm start          # -> http://localhost:3000
```

## How it answers

1. **Normalisation** — abbreviation expansion (`b.tech` → `btech`), stop-word
   removal, light stemming, and typo repair against the index vocabulary
   (`hostl fees`, `elgibility`, `plasement` all resolve correctly).
2. **TF-IDF retrieval** — the question is scored against every knowledge-base
   entry by cosine similarity, with phrase, bigram and title bonuses.
3. **Slot routing** — `<course> + <aspect>` questions ("btech fees",
   "eligibility for MBA") jump straight to the exact entry, and the last course
   discussed is remembered, so follow-ups like *"and the fees?"* work.
4. **Multi-question handling** — "fees and hostel?" returns both answers.
5. **Graceful fallback** — below the confidence threshold the bot offers its
   closest matches as tappable chips instead of a dead end.

Measured on its own trigger set: **1144/1148 questions** return the intended
entry.

## UI

- Topic sidebar (drawer on mobile) covering all 13 topic groups
- Rich answers: headings, bullets, bold, links, phone/e-mail links, footnotes
- Contextual follow-up chips under every answer
- Light/dark theme (follows the OS, toggle overrides), saved per device
- Chat history saved in `localStorage`, transcript download, copy-answer button
- Keyboard-friendly composer (`Enter` send, `Shift`+`Enter` newline), responsive
  down to 360 px, `prefers-reduced-motion` support

## Editing the knowledge base

Every answer is an entry in the `KB` array near the top of the `<script>` block:

```js
{
  id:'fee_btech', topic:'Fees', icon:'⚙️', title:'B.Tech fees',
  q:['btech fees','engineering fees','how much is btech'],  // trigger phrases
  a:`### B.Tech (indicative)
- **Tuition:** roughly ...`,                                // answer markup
  chips:['Scholarship options','Hostel fees']               // follow-up chips
}
```

Answer mark-up supports `### heading`, `- bullet`, `1. numbered`, `**bold**`,
`` `code` ``, `[label](url)` and `> footnote`. Add an entry, reload the page —
the index rebuilds itself on load, no build step.

## Data disclaimer

Fees, cut-offs and placement figures are **indicative summaries that change
every admission cycle**, and this is not an official Amity University service.
Confirm anything you'll act on at <https://www.amity.edu/lucknow> or with the
admission office.
