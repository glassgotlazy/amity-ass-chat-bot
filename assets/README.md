# Using the university's own logo

The sidebar shows a plain assistant mark by default — a circle and an "A" in
the Amity brand colours. It is deliberately **not** the university's emblem.

## Why not the official logo out of the box

This is an unofficial study aid. Putting the university's registered emblem on
it makes it look endorsed, which is exactly what every disclaimer in the app is
trying to avoid, and the emblem is Amity's trademark to license.

If you have permission to use it — a departmental project signed off by the
university, a student-body page, or written approval — it is a one-file swap.

## How to swap it in

Save the logo here as **`logo.svg`** (preferred) or **`logo.png`**:

```
assets/logo.svg
```

Reload. The page probes for that file on load and, if it is there, replaces the
default mark with it. If the file is absent the mark stays — nothing breaks.

Sizing: it is rendered at up to 42px tall and 190px wide, so a horizontal
lockup works well. Use an SVG with a transparent background if you can, so it
sits correctly in both the light and dark themes.

## If you deploy as a single file

Opening `index.html` straight from disk, or hosting only that one file, means
there is no `assets/` folder to find. In that case paste the logo as a data URI
directly into the `<img class="brand-logo" id="brandLogo">` tag in
`index.html`, and add `class="brand-mark has-logo"` to its parent `div`.

## Brand colours already in use

The interface is built on Amity's published brand palette, so a swapped-in logo
should sit naturally:

| Colour | Hex | Where it is used |
| --- | --- | --- |
| Bahama Blue | `#006690` | links, buttons, user messages, the frame rule |
| Supernova | `#ffca08` | the mark, section rules, AI-answer badge, accents |
| Peach Yellow | `#f9dba9` | soft tint behind footnote blocks |
