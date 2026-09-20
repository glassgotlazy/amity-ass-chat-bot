#!/usr/bin/env python3
"""Guard the knowledge base against the mistakes that keep biting.

1. An unescaped backtick inside an answer silently ends the template literal,
   truncating the entry and turning the rest of the answer into code.
2. A ${...} in an answer is a template interpolation, not literal text.
3. Duplicate ids or titles break the direct-pick path in the palette.

The previous version of check 1 was wrong: it stopped scanning at the first
backtick and then searched the (now backtick-free) text for a backtick, so it
reported clean no matter what. This walks the literal properly instead and
checks that it ends where an entry should end.
"""
import glob, re, sys

problems = []

def scan_literal(src, start):
    """Return the index of the backtick that closes the literal opened at start."""
    i = start
    while i < len(src):
        c = src[i]
        if c == '\\':
            i += 2
            continue
        if c == '`':
            return i
        i += 1
    return -1

for fn in sorted(glob.glob('kb*.js')):
    if fn == 'kb.js':
        continue
    src = open(fn).read()
    for m in re.finditer(r'\ba:`', src):
        start = m.end()
        close = scan_literal(src, start)
        line = src[:start].count('\n') + 1
        if close < 0:
            problems.append(f'{fn}:{line}: answer literal is never closed')
            continue
        body = src[start:close]
        if '${' in body:
            problems.append(f'{fn}:{line}: ${{...}} in an answer is a template interpolation, not text')
        # An answer must be followed by the next field or the end of the entry.
        after = src[close + 1:close + 40].lstrip()
        if not (after.startswith(',') or after.startswith('}')):
            problems.append(
                f'{fn}:{line}: answer ends early — an unescaped backtick closed it, '
                f'leaving {after[:30]!r} as code')

# Duplicate ids and titles
ids, titles = {}, {}
for fn in sorted(glob.glob('kb*.js')):
    if fn == 'kb.js':
        continue
    src = open(fn).read()
    for m in re.finditer(r"\bid:'([^']+)'", src):
        line = src[:m.start()].count('\n') + 1
        ids.setdefault(m.group(1), []).append(f'{fn}:{line}')
    for m in re.finditer(r"\btitle:'((?:[^'\\]|\\.)*)'", src):
        line = src[:m.start()].count('\n') + 1
        titles.setdefault(m.group(1), []).append(f'{fn}:{line}')

for key, where in ids.items():
    if len(where) > 1:
        problems.append(f'duplicate id {key!r}: ' + ', '.join(where))
for key, where in titles.items():
    if len(where) > 1:
        problems.append(f'duplicate title {key!r}: ' + ', '.join(where))

for p in problems:
    print(p)
print('kb lint: clean' if not problems else f'kb lint: {len(problems)} problem(s)')
sys.exit(1 if problems else 0)
