#!/bin/bash
# One command: lint the knowledge base, reassemble it, syntax-check, build the page.
set -e
cd "$(dirname "$0")"
python3 "$(dirname "$0")/lint-kb.py"
cat kb1.js kb2.js kb3.js kb4.js kb5.js kb6.js kb7.js kb8.js kb9.js kb10.js kb11.js kb12.js kb13.js kb14.js kb15.js kb16.js > kb.js
cat kb.js engine.js > core.js
cat kb.js engine.js guard.js ui.js > all.js
node --check core.js
node --check all.js
{ cat part1.html part2.html; echo; echo '<script>'; cat all.js; echo '</script>'; echo; echo '</body>'; echo '</html>'; } > index.html
node -e "
const src=require('fs').readFileSync('core.js','utf8'); eval(src+'; global.T={KB,respond,convo};'); const T=global.T;
let miss=0,tot=0; for(const e of T.KB){for(const q of e.q){tot++;T.convo.lastCourse=null;T.convo.lastAspect=null;const r=T.respond(q);if(!(r[0].entry&&r[0].entry.id===e.id))miss++;}}
console.log('entries: '+T.KB.length+' | self-retrieval: '+(tot-miss)+'/'+tot);
"
echo "index.html: $(du -h index.html | cut -f1)"
