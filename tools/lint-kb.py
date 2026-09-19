#!/usr/bin/env python3
"""Guard against the one mistake that keeps biting: an unescaped backtick
inside an answer's template literal silently ends the string."""
import glob, re, sys
bad = 0
for fn in sorted(glob.glob('kb*.js')):
    src = open(fn).read()
    for m in re.finditer(r'a:`', src):
        start = m.end()
        i, depth = start, 0
        while i < len(src):
            c = src[i]
            if c == '\\': i += 2; continue
            if c == '`':
                break
            i += 1
        body = src[start:i]
        for hit in re.finditer(r'`', body):
            bad += 1
            line = src[:start+hit.start()].count('\n') + 1
            print(f'{fn}:{line}: unescaped backtick inside an answer')
print('kb lint: clean' if not bad else f'kb lint: {bad} problem(s)')
sys.exit(1 if bad else 0)
