# Building the assistant

`index.html` at the repo root is a **build artifact**. Edit the sources here and
rebuild — never hand-edit the built page, or the next build will overwrite it.

```sh
./src/build.sh          # lints, assembles, syntax-checks, tests, writes src/index.html
cp src/index.html .     # deploy
```

## What is where

| File | Holds |
| --- | --- |
| `kb1.js` … `kb16.js` | The knowledge base — one entry per topic |
| `engine.js` | Retrieval: normalising, stemming, synonyms, typo repair, TF-IDF scoring |
| `guard.js` | The browser-side scope gate and the AI client |
| `ui.js` | Rendering, the interactive widgets, keyboard and voice handling |
| `part1.html` | `<head>` and all CSS, including the embedded fonts |
| `part2.html` | Page markup |
| `lint-kb.py` | Knowledge-base checks (see below) |

## Adding a topic

Append an entry to the last `kb*.js` file, before the closing `];`:

```js
{
  id:'unique_id', topic:'Fees', title:'A short, findable title',
  q:['several','ways','someone','might','ask','this'],
  a:`Markdown answer. Tables, lists and > notes all render.`,
  chips:['A follow-up question','Another one']
},
```

- `q` is what retrieval matches on — give it 8–12 genuinely different phrasings.
- A phrasing should belong to **one** entry. Two entries claiming the same words
  means one of them can never be reached by it; `build.sh` reports this.
- `[[estimator]]`, `[[eligibility]]`, `[[checklist]]`, `[[loan]]`,
  `[[scholarship]]`, `[[compare]]`, `[[placements]]` and `[[timeline]]` on a
  line of their own mount an interactive widget. The names come from the
  `WIDGETS` registry in `ui.js`, so adding a widget is one change there.
- `{{KB_COUNT}}` renders the live topic count, so it cannot go stale.

## What the build checks

- **No unescaped backtick inside an answer.** One silently ends the template
  literal and turns the rest of the entry into code. This has bitten twice.
- **No `${...}` in an answer** — that is a template interpolation, not text.
- **No duplicate ids or titles.**
- **Self-retrieval:** every phrasing in every `q` is fed back through the engine
  and must return its own entry. Below about 99% means two entries are
  competing; the build prints which.

## Adding vocabulary to the scope gate

`DOMAIN_TERMS` exists twice — `src/guard.js` (browser) and `lib/assistant.js`
(server) — and the two must agree. The server copy is the one that actually
protects the API key; the browser copy just avoids a pointless request.

It is an **allowlist**, so never add an ambiguous word. A bare `gate` or `cat`
would let "how do I open a gate" through to the API. Words that are too weak to
admit a question on their own (a city name, `student`) belong in `WEAK_ALONE`,
which requires a second term before a question counts as in scope.
