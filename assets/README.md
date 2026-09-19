# Logo

`logo.png` is the Amity University emblem, supplied by the project owner for
use as this assistant's logo. It is embedded in `index.html` as well, so the
page keeps its logo offline and from a `file://` URL.

**It is the university's trademark.** It is used here on the owner's
instruction and authority. If you fork this project, use your own mark or get
permission — and note that the app describes itself as unofficial throughout,
which the logo does not change.

## Replacing it

Drop a new file in as `logo.png` (or `logo.svg`) and reload. The page probes
for that file on load and uses it if present, falling back to the embedded
copy. No rebuild needed.

Rendered at 56px tall, up to 190px wide — a shield or a horizontal lockup both
work. Use a transparent background so it sits correctly in both themes; the
shipped PNG has had its white background removed for exactly that reason.

To change the embedded copy as well, replace the base64 in the
`<img class="brand-logo" id="brandLogo" src="data:image/png;base64,…">` tag in
`index.html`, and the favicon `<link rel="icon">` in the same file.

## Files

| File | Purpose |
| --- | --- |
| `logo.png` | sidebar logo, 110×128, transparent background |
| `favicon.png` | browser tab icon, 64×64 |

## Brand colours in the interface

| Colour | Hex | Where |
| --- | --- | --- |
| Bahama Blue | `#006690` | links, buttons, user messages, bullets, frame rule |
| Supernova | `#ffca08` | logo ring, section rules, AI badge, accents |
| Peach Yellow | `#f9dba9` | soft tint behind footnote blocks |
