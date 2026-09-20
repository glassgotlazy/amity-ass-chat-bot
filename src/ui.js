
/* =========================================================================
   UI LAYER
   ========================================================================= */

const $ = id => document.getElementById(id);
const threadEl = $('thread'), chatEl = $('chat'), formEl = $('form'), inputEl = $('input'),
      chipsEl = $('chips'), railEl = $('rail'), railTopics = $('railTopics'),
      scrimEl = $('scrim'), toastEl = $('toast'), toBottomEl = $('toBottom'), sendBtn = $('sendBtn');

const STORE_KEY = 'amity-chat-v3';
const THEME_KEY = 'amity-theme';
let transcript = [];
let busy = false;

/* ------------------------------ mark-up ------------------------------ */
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function inline(s){
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\b(amity\.edu\/lucknow)\b/g, '<a href="https://www.$1" target="_blank" rel="noopener">$1</a>')
    .replace(/(\+91-\d{10})/g, '<a href="tel:$1">$1</a>')
    .replace(/\b(1800-180-5522)\b/g, '<a href="tel:$1">$1</a>')
    .replace(/\b(14416)\b/g, '<a href="tel:$1">$1</a>');
}

function md(text){
  /* {{KB_COUNT}} in an answer renders the live topic count, so the
     number in the text can never drift from the knowledge base. */
  const lines = String(text).replace(/\{\{KB_COUNT\}\}/g, KB.length).split('\n');
  let html = '', listTag = null, para = [];
  const flushPara = () => { if(para.length){ html += '<p>' + para.join('<br>') + '</p>'; para = []; } };
  const closeList = () => { if(listTag){ html += '</' + listTag + '>'; listTag = null; } };
  const openList = tag => { if(listTag !== tag){ closeList(); html += '<' + tag + '>'; listTag = tag; } };

  const cells = line => line.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
  const isRow = line => /^\|.*\|$/.test(line);
  const isDivider = line => /^\|[\s:\-|]+\|$/.test(line);

  for(let i = 0; i < lines.length; i++){
    const line = lines[i].trim();
    if(!line){ flushPara(); closeList(); continue; }

    /* table: a header row, a |---| divider, then body rows */
    if(isRow(line) && i + 1 < lines.length && isDivider(lines[i + 1].trim())){
      flushPara(); closeList();
      const head = cells(line);
      let body = '';
      let j = i + 2;
      for(; j < lines.length && isRow(lines[j].trim()); j++){
        body += '<tr>' + cells(lines[j].trim())
          .map(c => '<td>' + inline(esc(c)) + '</td>').join('') + '</tr>';
      }
      html += '<div class="table-wrap"><table><thead><tr>' +
        head.map(c => '<th>' + inline(esc(c)) + '</th>').join('') +
        '</tr></thead><tbody>' + body + '</tbody></table></div>';
      i = j - 1;
      continue;
    }

    /* [[name]] on its own line mounts a widget. The names come from the
       WIDGETS registry rather than a second list here, so adding a tool is
       one change; an unknown name renders nothing instead of leaking text. */
    const widget = /^\[\[([a-z]+)\]\]$/.exec(line);
    if(widget){
      flushPara(); closeList();
      if(WIDGETS[widget[1]]) html += '<div class="widget" data-widget="' + widget[1] + '"></div>';
      continue;
    }
    if(line.startsWith('### ')){ flushPara(); closeList(); html += '<h4>' + inline(esc(line.slice(4))) + '</h4>'; continue; }
    if(line.startsWith('> ')){ flushPara(); closeList(); html += '<span class="note">' + inline(esc(line.slice(2))) + '</span>'; continue; }
    if(/^[-•]\s+/.test(line)){ flushPara(); openList('ul'); html += '<li>' + inline(esc(line.replace(/^[-•]\s+/, ''))) + '</li>'; continue; }
    if(/^\d+\.\s+/.test(line)){ flushPara(); openList('ol'); html += '<li>' + inline(esc(line.replace(/^\d+\.\s+/, ''))) + '</li>'; continue; }
    closeList(); para.push(inline(esc(line)));
  }
  flushPara(); closeList();
  return html;
}

const plain = t => String(t)
  .replace(/\*\*/g, '')
  .replace(/^### /gm, '')
  .replace(/^> /gm, '')
  .replace(/^\|[\s:\-|]+\|$/gm, '')        // table dividers
  .replace(/^\|(.*)\|$/gm, (m, row) =>      // table rows -> aligned text
    row.split('|').map(c => c.trim()).filter(Boolean).join('  ·  '))
  .replace(/\n{3,}/g, '\n\n');
const clockTime = () => new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });

/* ------------------------------ turns ------------------------------ */
function turnNode(msg){
  const turn = document.createElement('div');
  turn.className = 'turn ' + msg.who;

  if(msg.who === 'user'){
    const said = document.createElement('div');
    said.className = 'said';
    said.innerHTML = esc(msg.text).replace(/\n/g, '<br>');
    turn.appendChild(said);
    return turn;
  }

  const mark = document.createElement('div');
  mark.className = 'mark';
  mark.setAttribute('aria-hidden', 'true');
  mark.textContent = '§';

  const body = document.createElement('div');
  const answer = document.createElement('div');
  answer.className = 'answer';
  answer.innerHTML = md(msg.text);
  /* each block fades up just after the one above it */
  Array.prototype.forEach.call(answer.children, (el, i) => el.style.setProperty('--i', i));
  mountWidgets(answer);
  body.appendChild(answer);

  const meta = document.createElement('div');
  meta.className = 'turn-meta';
  const src = document.createElement('span');
  src.className = 'src' + (msg.source === 'ai' ? ' ai' : msg.source === 'refused' ? ' out' : '');
  src.textContent = msg.source === 'ai' ? 'AI-assisted · verify'
                  : msg.source === 'refused' ? 'Out of scope'
                  : (msg.topic || 'Knowledge base');
  meta.appendChild(src);
  const time = document.createElement('span');
  time.textContent = msg.time || clockTime();
  meta.appendChild(time);
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.textContent = 'Copy';
  copy.addEventListener('click', () => {
    copyText(msg.text);
    copy.textContent = 'Copied';
    copy.classList.add('done');
    setTimeout(() => { copy.textContent = 'Copy'; copy.classList.remove('done'); }, 1600);
  });
  meta.appendChild(copy);

  if(msg.id){
    const link = document.createElement('button');
    link.type = 'button';
    link.textContent = 'Link';
    link.title = 'Copy a link that opens this answer';
    link.addEventListener('click', () => {
      copyText.plain = true;
      const url = location.origin + location.pathname + '#t/' + msg.id;
      const done = () => {
        toast('Link copied');
        link.textContent = 'Copied';
        link.classList.add('done');
        setTimeout(() => { link.textContent = 'Link'; link.classList.remove('done'); }, 1600);
      };
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(url).then(done).catch(() => fallbackCopy(url, done));
      } else fallbackCopy(url, done);
    });
    meta.appendChild(link);
  }

  const print = document.createElement('button');
  print.type = 'button';
  print.textContent = 'Print';
  print.title = 'Print or save this conversation as a PDF';
  print.addEventListener('click', () => window.print());
  meta.appendChild(print);

  body.appendChild(meta);

  if(msg.chips && msg.chips.length){
    const row = document.createElement('div');
    row.className = 'suggest';
    msg.chips.forEach((q, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = q;
      b.style.setProperty('--i', i);
      b.addEventListener('click', () => ask(q));
      row.appendChild(b);
    });
    body.appendChild(row);
  }

  turn.appendChild(mark);
  turn.appendChild(body);
  return turn;
}

function pushTurn(msg, save){
  msg.time = msg.time || clockTime();
  /* keep the address bar on the last topic shown, so the page can be
     bookmarked or shared and reopen on the same answer */
  if(msg.id){
    try{ window.history.replaceState(null, '', '#t/' + msg.id); }catch(e){}
  }
  threadEl.appendChild(turnNode(msg));
  if(save !== false){
    transcript.push(msg);
    if(transcript.length > 80) transcript = transcript.slice(-80);
    persist();
  }
  scrollToEnd();
}

function scrollToEnd(){
  requestAnimationFrame(() => { chatEl.scrollTop = chatEl.scrollHeight; });
}

function showThinking(label){
  hideThinking();
  const el = document.createElement('div');
  el.className = 'thinking';
  el.id = 'thinkingRow';
  el.innerHTML = '<div class="mark" aria-hidden="true">§</div>' +
    '<div class="thinking-body"><span class="thinking-label">' + esc(label) + '</span>' +
    '<div class="thinking-bar"><span></span></div></div>';
  threadEl.appendChild(el);
  scrollToEnd();
}
function setThinking(label){
  const el = $('thinkingRow');
  if(el) el.querySelector('.thinking-label').textContent = label;
  else showThinking(label);
}
function hideThinking(){
  const el = $('thinkingRow');
  if(el) el.remove();
}

/* ------------------------------ answering ------------------------------ */
const KB_CONFIDENCE = 0.5;   // below this the knowledge base hit is only 'related'

/* Titles are used as navigation everywhere — the palette, the topic lists and the
   follow-up chips all send one. An exact title is therefore a direct pick and
   opens that entry, instead of being re-run through fuzzy retrieval (which can
   land on a near neighbour). */
const TITLE_INDEX = new Map(KB.map(e => [e.title.toLowerCase(), e]));
const AI_FOOTER = '\n\n> AI-assisted answer, generated outside the offline knowledge base. Treat it as a pointer, not a quotation — confirm anything that matters with the admission office.';

function kbTurns(results){
  return results.map(res => {
    const chips = followUps(res.entry).slice(0, 4);
    if(res.mode === 'weak' && res.alternatives){
      res.alternatives.slice(0, 2).forEach(alt => {
        if(chips.length < 5 && !chips.includes(alt.title)) chips.push(alt.title);
      });
    }
    return { who:'bot', id:res.entry.id, text:res.entry.a, topic:res.entry.topic, source:'kb', chips };
  });
}

function noAnswerTurn(alternatives, extraNote){
  const alts = (alternatives || []).slice(0, 4);
  let text = alts.length
    ? `I don't have that in the offline knowledge base. The closest things I do cover:`
    : `I don't have that in the offline knowledge base yet.`;
  if(extraNote) text += '\n\n> ' + extraNote;
  return {
    who:'bot', text, topic:'Not found', source:'kb',
    chips: alts.map(a => a.title)
  };
}

async function ask(text){
  const question = String(text || '').trim();
  if(!question || busy) return;
  busy = true; sendBtn.disabled = true;

  pushTurn({ who:'user', text:question });
  inputEl.value = '';
  autoGrow();
  closeDrawer();

  try{
    /* ---- direct pick: the exact title of a knowledge-base entry ---- */
    const picked = TITLE_INDEX.get(question.toLowerCase());
    if(picked){
      showThinking('Opening the knowledge base');
      await pause(200);
      hideThinking();
      remember(picked);
      pushTurn({ who:'bot', id:picked.id, text:picked.a, topic:picked.topic, source:'kb', chips:followUps(picked).slice(0, 4) });
      return;
    }

    /* ---- gate 1: is this about Amity at all? ---- */
    const scope = scopeOf(question);
    if(scope === 'out'){
      showThinking('Checking scope');
      await pause(220);
      hideThinking();
      pushTurn({
        who:'bot', text:OFF_TOPIC_REPLY, source:'refused', topic:'Out of scope',
        chips:['What can you help me with?','What courses are offered?','Fee structure','Hostel facilities']
      });
      return;
    }

    /* ---- gate 2: does the offline knowledge base actually answer it? ----
       A confident hit is served offline. A loose, "related but not really
       your question" hit is treated as a miss when the AI fallback is
       available, and kept as a suggestion alongside the AI answer. */
    showThinking('Searching the knowledge base');
    await pause(240 + Math.random() * 200);
    const results = respond(question);
    const top = results[0];
    const confident = top && top.entry &&
      (top.mode === 'routed' || (top.score || 0) >= KB_CONFIDENCE || results.length > 1);

    if(confident){
      hideThinking();
      kbTurns(results).forEach(t => pushTurn(t));
      return;
    }

    /* ---- gate 3: in scope, not confidently covered -> AI fallback ---- */
    const near = top && top.entry ? [top.entry] : [];
    const alternatives = near.concat((top && top.alternatives) || []).slice(0, 4);

    const serveWhatWeHave = note => {
      if(top && top.entry){
        const t = kbTurns([top])[0];
        t.text = t.text + '\n\n> ' + note;
        pushTurn(t);
      } else {
        pushTurn(noAnswerTurn(alternatives, note));
      }
    };

    if(scope !== 'in'){
      hideThinking();
      serveWhatWeHave('That is the closest thing I have offline. Ask it with a bit more detail and I can send it to the AI assistant.');
      return;
    }
    if(!AI.ready){
      hideThinking();
      serveWhatWeHave('That may not be exactly what you asked — the AI fallback is unavailable (' + AI.reason + '), so this is the nearest topic I hold offline.');
      return;
    }

    setThinking('Not covered offline — asking the AI assistant');
    try{
      const data = await askAI(question, convo.lastTopic || '');
      hideThinking();
      pushTurn({
        who:'bot', text:String(data.answer).trim() + AI_FOOTER, source:'ai', topic:'AI',
        chips: alternatives.slice(0, 2).map(a => a.title).concat(['Contact the admission office'])
      });
    }catch(err){
      hideThinking();
      serveWhatWeHave(AI_ERROR_TEXT[err.code] || AI_ERROR_TEXT.upstream_error);
    }
  } finally {
    hideThinking();
    busy = false; sendBtn.disabled = false;
    if(window.matchMedia('(min-width: 880px)').matches) inputEl.focus();
  }
}

const pause = ms => new Promise(r => setTimeout(r, ms));

/* ------------------------------ persistence ------------------------------ */
function persist(){
  try{ localStorage.setItem(STORE_KEY, JSON.stringify(transcript)); }catch(e){}
}
function restore(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(!raw) return false;
    const saved = JSON.parse(raw);
    if(!Array.isArray(saved) || !saved.length) return false;
    transcript = saved.slice(-80);
    transcript.forEach(m => threadEl.appendChild(turnNode(m)));
    scrollToEnd();
    return true;
  }catch(e){ return false; }
}

/* ------------------------------ masthead ------------------------------ */
const STARTERS = [
  ['What courses are offered?','Courses'],
  ['B.Tech eligibility','Eligibility'],
  ['Fee structure','Fees'],
  ['Scholarship options','Scholarships'],
  ['Hostel facilities','Hostel'],
  ['Placement record','Placements'],
  ['Admission process','Admissions'],
  ['ASAT test details','Entrance']
];

function showMasthead(){
  const head = document.createElement('div');
  head.className = 'masthead turn';
  head.innerHTML =
    '<div class="kicker">Offline reference</div>' +
    '<h3>Everything a candidate asks about Amity Lucknow — <em>answered before you finish typing.</em></h3>' +
    '<p><span class="count" id="kbTally">0</span> topics live inside this page, so they answer instantly and work ' +
    'with no internet at all. Ask in your own words; spelling mistakes are fine. Anything about the university ' +
    'that is not covered here can go to the AI assistant, and questions unrelated to Amity are declined.</p>' +
    '<div class="starters" id="starters"></div>';
  threadEl.appendChild(head);
  countUp($('kbTally'), KB.length);

  const list = head.querySelector('#starters');
  STARTERS.forEach(([q, cat], i) => {
    const b = document.createElement('button');
    b.className = 'starter';
    b.type = 'button';
    b.style.setProperty('--d', (i * 50 + 380) + 'ms');
    b.innerHTML = '<span class="idx">' + String(i + 1).padStart(2, '0') + '</span>' +
                  '<span class="q">' + esc(q) + '</span>' +
                  '<span class="cat">' + esc(cat) + '</span>';
    b.addEventListener('click', () => ask(q));
    list.appendChild(b);
  });
  reveal(list.children);
  scrollToEnd();
}

/* --------------------------- motion helpers --------------------------- */
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* counts a number up once, for the topic tally in the masthead */
function countUp(el, target){
  if(!el) return;
  if(reducedMotion){ el.textContent = target; return; }
  const duration = 900, start = performance.now();
  const tick = now => {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(target * eased);
    if(t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* fades elements in as they enter the transcript viewport */
function reveal(nodes){
  const items = Array.prototype.slice.call(nodes);
  if(reducedMotion || !('IntersectionObserver' in window)){
    items.forEach(el => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){ entry.target.classList.add('in'); obs.unobserve(entry.target); }
    });
  }, { root: chatEl, threshold: 0.15 });
  items.forEach(el => io.observe(el));
}

/* ------------------------------ rail ------------------------------ */
function buildRail(){
  const topics = [];
  KB.forEach(e => { if(!e.hidden && !topics.includes(e.topic)) topics.push(e.topic); });
  topics.forEach(topic => {
    const items = KB.filter(e => e.topic === topic && !e.hidden);
    const b = document.createElement('button');
    b.className = 'nav-btn';
    b.type = 'button';
    b.innerHTML = '<span>' + esc(topic) + '</span><span class="cnt">' + items.length + '</span>';
    b.addEventListener('click', () => openTopic(topic, items));
    railTopics.appendChild(b);
  });
}

function openTopic(topic, items){
  closeDrawer();
  pushTurn({ who:'user', text:'Show me ' + topic.toLowerCase() });
  pushTurn({
    who:'bot', topic:topic, source:'kb',
    text:'Everything I cover under **' + topic + '** — pick one:',
    chips: items.slice(0, 8).map(e => e.title)
  });
}

/* ------------------------------ chips ------------------------------ */
const POPULAR = [
  'What courses are offered?','B.Tech eligibility','Fee structure','Scholarship options',
  'Hostel fees','Placement record','Admission process','Documents required',
  'ASAT test details','Important dates','Campus facilities','Education loan',
  'Attendance rules','Which branch to choose','Contact the admission office'
];
function renderChips(){
  chipsEl.innerHTML = '';
  POPULAR.forEach(q => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.type = 'button';
    b.textContent = q;
    b.addEventListener('click', () => ask(q));
    chipsEl.appendChild(b);
  });
}

/* ------------------------------ chrome ------------------------------ */
function toast(msg){
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toastEl.classList.remove('show'), 1800);
}

function copyText(text){
  const body = plain(text);
  const done = () => toast('Copied');
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(body).then(done).catch(() => fallbackCopy(body, done));
  } else fallbackCopy(body, done);
}
function fallbackCopy(text, done){
  try{
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    done();
  }catch(e){ toast('Copy not supported here'); }
}

function applyTheme(mode){
  if(mode === 'dark' || mode === 'light') document.documentElement.setAttribute('data-theme', mode);
  else document.documentElement.removeAttribute('data-theme');
}
function currentTheme(){
  try{ return localStorage.getItem(THEME_KEY) || 'auto'; }catch(e){ return 'auto'; }
}
function toggleTheme(){
  const dark = document.documentElement.getAttribute('data-theme') === 'dark' ||
    (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const next = dark ? 'light' : 'dark';
  try{ localStorage.setItem(THEME_KEY, next); }catch(e){}
  applyTheme(next);
}

function downloadTranscript(){
  if(!transcript.length){ toast('Nothing to save yet'); return; }
  const lines = transcript.map(m =>
    (m.who === 'bot' ? 'Assistant' : 'You') + ' (' + (m.time || '') +
    (m.source === 'ai' ? ', AI-assisted' : '') + '):\n' + plain(m.text) + '\n');
  const blob = new Blob(['Amity Lucknow — Admission Assistant\n\n' + lines.join('\n')], { type:'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'amity-admission-chat.txt';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Transcript saved');
}

function newChat(){
  transcript = [];
  try{ localStorage.removeItem(STORE_KEY); }catch(e){}
  convo.lastCourse = null; convo.lastAspect = null; convo.lastTopic = null; convo.lastId = null;
  threadEl.innerHTML = '';
  showMasthead();
  toast('New conversation');
}

function openDrawer(){
  railEl.classList.add('open'); scrimEl.classList.add('show');
  $('menuBtn').setAttribute('aria-expanded', 'true');
}
function closeDrawer(){
  railEl.classList.remove('open'); scrimEl.classList.remove('show');
  $('menuBtn').setAttribute('aria-expanded', 'false');
}

function autoGrow(){
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 128) + 'px';
}

function paintStatus(){
  const dot = $('statusDot'), txt = $('statusText');
  if(AI.ready){
    dot.classList.remove('off');
    txt.textContent = 'Offline KB + AI fallback';
    $('statusLine').title = 'In-scope questions missing from the knowledge base go to ' + (AI.model || 'the AI assistant');
  } else {
    dot.classList.add('off');
    txt.textContent = 'Offline knowledge base';
    $('statusLine').title = 'AI fallback unavailable: ' + AI.reason;
  }
}


/* ------------------------------ cost estimator ------------------------------
   An offline calculator rendered inside its knowledge-base answer. Figures come
   from the same 2026 listings the fee entries quote. */
const COURSE_COST = {
  btech: { label:'B.Tech', years:4, tuition:[220000, 406000] },
  bba:   { label:'BBA', years:3, tuition:[250000, 384000] },
  mba:   { label:'MBA', years:2, tuition:[400000, 546000] },
  bca:   { label:'BCA', years:3, tuition:[120000, 200000] },
  mca:   { label:'MCA', years:2, tuition:[140000, 220000] },
  law:   { label:'BA LLB / BBA LLB', years:5, tuition:[150000, 250000] },
  bcom:  { label:'B.Com (Hons) / BA (Hons)', years:3, tuition:[100000, 180000] },
  bsc:   { label:'B.Sc / M.Sc / B.Pharm', years:3, tuition:[120000, 250000] }
};
const LIVING_COST = {
  hostel:    { label:'Hostel (standard) + mess', perYear:[108000, 138000] },
  hostelac:  { label:'Hostel (AC) + mess',       perYear:[182000, 212000] },
  dayscholar:{ label:'Day scholar + campus bus', perYear:[25000, 50000] },
  home:      { label:'Living at home, own transport', perYear:[0, 12000] }
};
const EXTRAS_PER_YEAR = [30000, 60000];   // books, materials, exam fees, personal

const rupees = n => '₹' + Math.round(n).toLocaleString('en-IN');
const lakhs = n => (n / 100000).toFixed(1) + ' L';

function mountEstimator(host){
  host.innerHTML =
    '<div class="est">' +
      '<div class="est-controls">' +
        '<label>Programme<select data-f="course">' +
          Object.keys(COURSE_COST).map(k => '<option value="' + k + '">' + esc(COURSE_COST[k].label) + '</option>').join('') +
        '</select></label>' +
        '<label>Living<select data-f="living">' +
          Object.keys(LIVING_COST).map(k => '<option value="' + k + '">' + esc(LIVING_COST[k].label) + '</option>').join('') +
        '</select></label>' +
        '<label>Scholarship<select data-f="scholarship">' +
          [0, 25, 50, 100].map(v => '<option value="' + v + '">' + (v ? v + '% of tuition' : 'None') + '</option>').join('') +
        '</select></label>' +
        '<label>Fee rise each year<select data-f="inflation">' +
          [['5','5% a year (typical)'], ['0','No rise'], ['7','7% a year'], ['10','10% a year']]
            .map(o => '<option value="' + o[0] + '">' + o[1] + '</option>').join('') +
        '</select></label>' +
      '</div>' +
      '<div class="est-out" data-out></div>' +
    '</div>';

  const recalc = () => {
    const course = COURSE_COST[host.querySelector('[data-f="course"]').value];
    const living = LIVING_COST[host.querySelector('[data-f="living"]').value];
    const waiver = Number(host.querySelector('[data-f="scholarship"]').value) / 100;
    const rise   = Number(host.querySelector('[data-f="inflation"]').value) / 100;

    /* Fees are revised upward each year, so year 2 costs more than year 1.
       Each year is compounded rather than multiplying the first-year fee by
       the course length. Living costs and extras rise with it. */
    const compound = base => {
      let total = 0;
      for(let y = 0; y < course.years; y++) total += base * Math.pow(1 + rise, y);
      return total;
    };
    const flat = base => base * course.years;

    const tuition = course.tuition.map(v => compound(v) * (1 - waiver));
    const live    = living.perYear.map(compound);
    const extras  = EXTRAS_PER_YEAR.map(compound);
    const total   = tuition.map((v, i) => v + live[i] + extras[i]);
    const saved   = course.tuition.map(v => compound(v) * waiver);
    const noRise  = course.tuition.map((v, i) => flat(v) * (1 - waiver) + flat(living.perYear[i]) + flat(EXTRAS_PER_YEAR[i]));
    const riseCost = total.map((v, i) => v - noRise[i]);

    const firstYear = course.tuition.map(v => v * (1 - waiver));
    const lastYear  = course.tuition.map(v => v * Math.pow(1 + rise, course.years - 1) * (1 - waiver));

    host.querySelector('[data-out]').innerHTML =
      '<table><thead><tr><th>Over ' + course.years + ' years</th><th>Low</th><th>High</th></tr></thead><tbody>' +
      '<tr><td>Tuition' + (waiver ? ' (after ' + (waiver * 100) + '% waiver)' : '') + '</td><td>' + rupees(tuition[0]) + '</td><td>' + rupees(tuition[1]) + '</td></tr>' +
      '<tr><td>' + esc(living.label) + '</td><td>' + rupees(live[0]) + '</td><td>' + rupees(live[1]) + '</td></tr>' +
      '<tr><td>Books, exams, personal</td><td>' + rupees(extras[0]) + '</td><td>' + rupees(extras[1]) + '</td></tr>' +
      (rise ? '<tr class="est-rise"><td>of which the ' + (rise * 100) + '% yearly rise adds</td><td>' +
        rupees(riseCost[0]) + '</td><td>' + rupees(riseCost[1]) + '</td></tr>' : '') +
      '</tbody></table>' +
      '<div class="est-total"><span>Total cost of the degree</span>' +
        '<strong>' + lakhs(total[0]) + ' – ' + lakhs(total[1]) + '</strong></div>' +
      '<div class="est-note">' +
        'Tuition in year 1: ' + rupees(firstYear[0]) + ' – ' + rupees(firstYear[1]) +
        (rise ? ' · by the final year: ' + rupees(lastYear[0]) + ' – ' + rupees(lastYear[1]) : '') +
        (waiver ? ' · scholarship saves ' + lakhs(saved[0]) + ' – ' + lakhs(saved[1]) : '') +
      '</div>';
  };

  host.querySelectorAll('select').forEach(sel => sel.addEventListener('change', recalc));
  recalc();
}

/* ------------------------------ eligibility check ------------------------------ */
const ELIGIBILITY = [
  { name:'B.Tech — CSE, AI/ML, IT, ECE, Mechanical, Civil', streams:['science'], maths:true,  min:60, note:'PCM, plus JEE Main or ASAT' },
  { name:'B.Tech Biotechnology',        streams:['science'], maths:false, min:60, note:'PCM or PCB accepted' },
  { name:'B.Pharm',                      streams:['science'], maths:false, min:50, note:'PCM or PCB, PCI norms' },
  { name:'B.Sc — Biotech, Microbiology, Forensic Science', streams:['science'], maths:false, min:50 },
  { name:'BCA',                          streams:['science','commerce','arts'], maths:true,  min:50, note:'Maths or Computer Science at Class 12' },
  { name:'BBA',                          streams:['science','commerce','arts'], maths:false, min:50 },
  { name:'B.Com (Hons)',                 streams:['science','commerce','arts'], maths:false, min:50 },
  { name:'BA (Hons) Economics',          streams:['science','commerce','arts'], maths:true,  min:50, note:'Maths at Class 12 usually expected' },
  { name:'BA LLB / BBA LLB (Hons)',      streams:['science','commerce','arts'], maths:false, min:50, note:'plus a law aptitude test and interview' },
  { name:'BA (Hons) Psychology, English, Political Science', streams:['science','commerce','arts'], maths:false, min:50 },
  { name:'Journalism & Mass Communication', streams:['science','commerce','arts'], maths:false, min:50 },
  { name:'Design — fashion, interior, product', streams:['science','commerce','arts'], maths:false, min:50, note:'portfolio and/or design aptitude test' }
];

function mountEligibility(host){
  host.innerHTML =
    '<div class="est">' +
      '<div class="est-controls">' +
        '<label>Class 12 stream<select data-f="stream">' +
          '<option value="science">Science</option><option value="commerce">Commerce</option><option value="arts">Arts / Humanities</option>' +
        '</select></label>' +
        '<label>Maths at Class 12<select data-f="maths"><option value="yes">Yes</option><option value="no">No</option></select></label>' +
        '<label>Aggregate %<input data-f="marks" type="number" min="33" max="100" step="0.1" value="70"></label>' +
      '</div>' +
      '<div class="est-out" data-out></div>' +
    '</div>';

  const recalc = () => {
    const stream = host.querySelector('[data-f="stream"]').value;
    const maths  = host.querySelector('[data-f="maths"]').value === 'yes';
    const marks  = Number(host.querySelector('[data-f="marks"]').value) || 0;

    const rows = ELIGIBILITY.map(p => {
      const streamOk = p.streams.includes(stream);
      const mathsOk  = !p.maths || maths;
      let status, cls;
      if(!streamOk){ status = 'Stream does not match'; cls = 'no'; }
      else if(!mathsOk){ status = 'Needs Maths at Class 12'; cls = 'no'; }
      else if(marks >= p.min){ status = 'Meets the indicative bar'; cls = 'yes'; }
      else if(marks >= p.min - 5){ status = 'Borderline — worth asking'; cls = 'maybe'; }
      else { status = 'Below the indicative ' + p.min + '%'; cls = 'no'; }
      return { p, status, cls };
    });
    const yes = rows.filter(r => r.cls === 'yes').length;

    host.querySelector('[data-out]').innerHTML =
      '<table><thead><tr><th>Programme</th><th>With ' + marks + '%</th></tr></thead><tbody>' +
      rows.map(r =>
        '<tr class="elig-' + r.cls + '"><td>' + esc(r.p.name) +
        (r.p.note ? '<span class="elig-note">' + esc(r.p.note) + '</span>' : '') +
        '</td><td>' + esc(r.status) + '</td></tr>').join('') +
      '</tbody></table>' +
      '<div class="est-note">' + yes + ' of ' + rows.length + ' programmes match on the indicative minimums. ' +
      'These are guidance figures, not the published cut-off — the admission office decides, and actual cut-offs can sit higher when demand is strong.</div>';
  };

  host.querySelectorAll('select, input').forEach(el => {
    el.addEventListener('change', recalc);
    el.addEventListener('input', recalc);
  });
  recalc();
}

/* ------------------------------ admission checklist ------------------------------ */
const CHECKLIST = [
  ['Shortlist your programme and branch', 'Compare the median package and fee for the exact branch, not the university.'],
  ['Register on amity.edu/lucknow', 'Use an email and phone you check daily — every deadline arrives there.'],
  ['Pay the application fee', 'Official portal only. Save the receipt.'],
  ['Book and take ASAT', 'Or submit your JEE / CAT / CLAT score. The same score sets your scholarship slab.'],
  ['Attend the interview or GD-PI', 'Required for management, law, design, media and most PG programmes.'],
  ['Read the offer letter fully', 'Fee schedule, scholarship percentage, its continuation conditions, acceptance deadline.'],
  ['Pay the seat-confirmation amount', 'Diarise the deadline — missing it can release the seat.'],
  ['Opt for hostel and transport', 'Allotment is first-come; AC and low-occupancy rooms go first.'],
  ['Apply for an education loan', 'The bank needs the offer letter and official fee structure. Allow 2–4 weeks.'],
  ['Assemble documents', 'Originals plus two photocopy sets, 8–10 photographs, and scans in cloud storage.'],
  ['Claim category concessions', 'Sports, defence, sibling certificates must go in with the application.'],
  ['Attend document verification', 'Get written acknowledgement for anything the university retains.'],
  ['Pack for the hostel', 'Bedding, formals, winter layers, laptop, lock, medicines with prescriptions.'],
  ['Report and complete induction', 'Collect the ID card and Amizone credentials.']
];

function mountChecklist(host){
  let saved = {};
  try{ saved = JSON.parse(localStorage.getItem('amity-checklist') || '{}') || {}; }catch(e){ saved = {}; }

  host.innerHTML =
    '<div class="est check">' +
      '<div class="check-head"><span data-progress></span>' +
        '<button type="button" data-reset class="check-reset">Clear</button></div>' +
      '<ol class="check-list">' +
        CHECKLIST.map((item, i) =>
          '<li><label><input type="checkbox" data-i="' + i + '"' + (saved[i] ? ' checked' : '') + '>' +
          '<span><b>' + esc(item[0]) + '</b><em>' + esc(item[1]) + '</em></span></label></li>').join('') +
      '</ol>' +
    '</div>';

  const persist = () => { try{ localStorage.setItem('amity-checklist', JSON.stringify(saved)); }catch(e){} };
  const paint = () => {
    const done = Object.values(saved).filter(Boolean).length;
    host.querySelector('[data-progress]').textContent =
      done + ' of ' + CHECKLIST.length + ' done' + (done === CHECKLIST.length ? ' — you are ready' : '');
    host.querySelectorAll('.check-list li').forEach((li, i) => li.classList.toggle('done', !!saved[i]));
  };

  host.querySelectorAll('input[type="checkbox"]').forEach(box => {
    box.addEventListener('change', () => {
      saved[box.dataset.i] = box.checked;
      persist(); paint();
    });
  });
  host.querySelector('[data-reset]').addEventListener('click', () => {
    saved = {}; persist();
    host.querySelectorAll('input[type="checkbox"]').forEach(b => { b.checked = false; });
    paint();
    toast('Checklist cleared');
  });
  paint();
}

/* ------------------------------ programme comparator ------------------------------
   Side-by-side on the numbers people actually decide on. Figures are the same
   indicative ranges the cost estimator uses, so the two tools never disagree. */
const PROGRAMMES = {
  btech:  { label:'B.Tech (CSE / IT)', years:4, tuition:[220000, 406000], median:5.5, placed:'88%',
            eligibility:'Class 12 with PCM, 60%+, plus JEE Main or ASAT',
            suits:'You like problem-solving and will put the hours into coding.',
            roles:'Software engineer, analyst, support engineer, testing' },
  btechcore:{ label:'B.Tech (core branches)', years:4, tuition:[220000, 380000], median:4.2, placed:'80%',
            eligibility:'Class 12 with PCM, 60%+, plus JEE Main or ASAT',
            suits:'You want engineering itself, and will plan for GATE or a master\'s.',
            roles:'Design, production, site, quality, PSU through GATE' },
  mba:    { label:'MBA', years:2, tuition:[400000, 546000], median:5.5, placed:'92%',
            eligibility:'Any bachelor\'s, 50%+, plus CAT / MAT / ASAT and an interview',
            suits:'You want business roles and can sell an idea in a room.',
            roles:'Sales, marketing, HR, operations, analyst' },
  bba:    { label:'BBA', years:3, tuition:[250000, 384000], median:3.6, placed:'70%',
            eligibility:'Class 12 in any stream, 50%+',
            suits:'You are sure about management and intend to follow with an MBA.',
            roles:'Sales, operations, HR executive, business development' },
  bca:    { label:'BCA', years:3, tuition:[120000, 200000], median:3.4, placed:'68%',
            eligibility:'Class 12 with Maths or Computer Science, 50%+',
            suits:'You want computing without the engineering maths load.',
            roles:'Developer, support, testing, web development' },
  mca:    { label:'MCA', years:2, tuition:[140000, 220000], median:4.6, placed:'82%',
            eligibility:'Bachelor\'s with Maths, 50%+',
            suits:'You want to reach CSE-equivalent roles from a non-engineering degree.',
            roles:'Software engineer, analyst, developer' },
  law:    { label:'BA LLB / BBA LLB', years:5, tuition:[150000, 250000], median:4.5, placed:'65%',
            eligibility:'Class 12 in any stream, 50%+, plus an aptitude test and interview',
            suits:'You read closely, argue carefully and can commit five years.',
            roles:'Law firm associate, litigation junior, compliance, legal research' },
  bcom:   { label:'B.Com (Hons) / BA (Hons)', years:3, tuition:[100000, 180000], median:3.2, placed:'62%',
            eligibility:'Class 12 in any stream, 50%+',
            suits:'You plan a professional qualification or a master\'s after it.',
            roles:'Accounts, audit support, analyst, operations' },
  bpharm: { label:'B.Pharm', years:4, tuition:[120000, 250000], median:3.5, placed:'72%',
            eligibility:'Class 12 with PCM or PCB, 50%+, PCI norms',
            suits:'You want healthcare and industry rather than clinical practice.',
            roles:'QA/QC, production, regulatory affairs, medical writing, sales' },
  design: { label:'Design / Fashion', years:4, tuition:[150000, 280000], median:3.4, placed:'60%',
            eligibility:'Class 12 in any stream, 50%+, portfolio or aptitude test',
            suits:'You will build a portfolio for four years without being told to.',
            roles:'Junior designer, visualiser, merchandiser, UI designer' },
  media:  { label:'Journalism & Mass Comm.', years:3, tuition:[130000, 240000], median:3.0, placed:'58%',
            eligibility:'Class 12 in any stream, 50%+',
            suits:'You write or speak well and want to work in media.',
            roles:'Reporter, sub-editor, digital content, production assistant' }
};

function mountCompare(host){
  const keys = Object.keys(PROGRAMMES);
  const opt = (sel) => keys.map(k =>
    '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + esc(PROGRAMMES[k].label) + '</option>').join('');

  host.innerHTML =
    '<div class="est cmp">' +
      '<div class="est-controls cmp-controls">' +
        '<label>First programme<select data-f="a">' + opt('btech') + '</select></label>' +
        '<label>Second programme<select data-f="b">' + opt('mba') + '</select></label>' +
      '</div>' +
      '<div class="est-out" data-out></div>' +
    '</div>';

  const recalc = () => {
    const a = PROGRAMMES[host.querySelector('[data-f="a"]').value];
    const b = PROGRAMMES[host.querySelector('[data-f="b"]').value];

    /* Total tuition compounds at the same 5% the cost estimator assumes, so the
       two tools cannot give different answers for the same programme. */
    const total = p => {
      const sum = base => { let t = 0; for(let y = 0; y < p.years; y++) t += base * Math.pow(1.05, y); return t; };
      return [sum(p.tuition[0]), sum(p.tuition[1])];
    };
    const ta = total(a), tb = total(b);
    const ratio = (p, t) => (t[1] / 100000 / p.median).toFixed(1);

    const row = (head, va, vb, cls) =>
      '<tr' + (cls ? ' class="' + cls + '"' : '') + '><th scope="row">' + esc(head) + '</th>' +
      '<td>' + va + '</td><td>' + vb + '</td></tr>';

    host.querySelector('[data-out]').innerHTML =
      '<table class="cmp-table"><thead><tr><th></th>' +
        '<th>' + esc(a.label) + '</th><th>' + esc(b.label) + '</th></tr></thead><tbody>' +
        row('Duration', a.years + ' years', b.years + ' years') +
        row('Tuition, whole course', lakhs(ta[0]) + ' – ' + lakhs(ta[1]), lakhs(tb[0]) + ' – ' + lakhs(tb[1])) +
        row('Median starting package', a.median.toFixed(1) + ' LPA', b.median.toFixed(1) + ' LPA') +
        row('Typically placed', a.placed, b.placed) +
        row('Cost ÷ median package', ratio(a, ta) + '×', ratio(b, tb) + '×', 'cmp-ratio') +
        row('Eligibility', esc(a.eligibility), esc(b.eligibility)) +
        row('Common first roles', esc(a.roles), esc(b.roles)) +
        row('Suits you if', esc(a.suits), esc(b.suits)) +
      '</tbody></table>' +
      '<div class="est-note">Tuition compounds at 5% a year and excludes hostel, mess and transport — the cost estimator adds those. ' +
      '<b>Cost ÷ median</b> is the upper tuition estimate divided by the median starting package: under about 3× is comfortable, well above it deserves a hard look. ' +
      'Placement figures are indicative; ask the placement cell for the current branch-level numbers.</div>';
  };

  host.querySelectorAll('select').forEach(sel => sel.addEventListener('change', recalc));
  recalc();
}

/* ------------------------------ education loan calculator ------------------------------ */
function mountLoan(host){
  host.innerHTML =
    '<div class="est">' +
      '<div class="est-controls">' +
        '<label>Loan amount (₹)<input data-f="amount" type="number" min="50000" max="5000000" step="50000" value="800000"></label>' +
        '<label>Interest rate<select data-f="rate">' +
          ['8.5','9','9.5','10','10.5','11','12','13'].map(r =>
            '<option value="' + r + '"' + (r === '9.5' ? ' selected' : '') + '>' + r + '% a year</option>').join('') +
        '</select></label>' +
        '<label>Repayment period<select data-f="years">' +
          [5,7,10,12,15].map(y => '<option value="' + y + '"' + (y === 10 ? ' selected' : '') + '>' + y + ' years</option>').join('') +
        '</select></label>' +
        '<label>Course + grace<select data-f="moratorium">' +
          [['4.5','4 yr course + 6 months'], ['2.5','2 yr course + 6 months'], ['3.5','3 yr course + 6 months'], ['5.5','5 yr course + 6 months'], ['0','None — repaying now']]
            .map(o => '<option value="' + o[0] + '">' + o[1] + '</option>').join('') +
        '</select></label>' +
        '<label>During the course<select data-f="servicing">' +
          '<option value="no">Pay nothing (interest accrues)</option>' +
          '<option value="yes">Pay the interest monthly</option>' +
        '</select></label>' +
        '<label>Expected starting salary<select data-f="salary">' +
          ['3','3.5','4','4.5','5','5.5','6','8','10','12'].map(v =>
            '<option value="' + v + '"' + (v === '5.5' ? ' selected' : '') + '>' + v + ' LPA</option>').join('') +
        '</select></label>' +
      '</div>' +
      '<div class="est-out" data-out></div>' +
    '</div>';

  const recalc = () => {
    const P0    = Number(host.querySelector('[data-f="amount"]').value) || 0;
    const rate  = Number(host.querySelector('[data-f="rate"]').value) / 100;
    const years = Number(host.querySelector('[data-f="years"]').value);
    const mora  = Number(host.querySelector('[data-f="moratorium"]').value);
    const serviced = host.querySelector('[data-f="servicing"]').value === 'yes';
    const ctc   = Number(host.querySelector('[data-f="salary"]').value) * 100000;

    /* Unserviced interest through the moratorium is capitalised — this is the
       part of an education loan that surprises people, so show it explicitly. */
    const accrued  = P0 * rate * mora;
    const principal = serviced ? P0 : P0 + accrued;
    const servicedPaid = serviced ? accrued : 0;

    const r = rate / 12, n = years * 12;
    const emi = r === 0 ? principal / n : principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
    const totalPaid = emi * n + servicedPaid;
    const interest  = totalPaid - P0;

    /* Take-home is materially below CTC once deductions are counted. 85% of CTC
       spread over 12 months is a fair working figure for an entry-level salary. */
    const monthlyTakeHome = ctc * 0.85 / 12;
    const share = monthlyTakeHome > 0 ? (emi / monthlyTakeHome) * 100 : 0;
    const verdict = share <= 25 ? ['comfortable', 'ok'] :
                    share <= 40 ? ['manageable, but tight', 'warn'] :
                                  ['too high — borrow less or repay over longer', 'bad'];

    host.querySelector('[data-out]').innerHTML =
      '<table><tbody>' +
        '<tr><td>You borrow</td><td>' + rupees(P0) + '</td></tr>' +
        (serviced
          ? '<tr class="est-rise"><td>Interest paid during the course</td><td>' + rupees(accrued) + '</td></tr>'
          : '<tr class="est-rise"><td>Interest added during the course</td><td>+ ' + rupees(accrued) + '</td></tr>') +
        '<tr><td>Amount the EMI is calculated on</td><td>' + rupees(principal) + '</td></tr>' +
        '<tr><td>Total interest over the loan</td><td>' + rupees(interest) + '</td></tr>' +
        '<tr><td>Total you repay</td><td>' + rupees(totalPaid) + '</td></tr>' +
      '</tbody></table>' +
      '<div class="est-total"><span>Monthly EMI for ' + years + ' years</span><strong>' + rupees(emi) + '</strong></div>' +
      '<div class="loan-share ' + verdict[1] + '">' +
        '<div class="loan-bar"><i style="width:' + Math.min(100, share) + '%"></i></div>' +
        '<span><b>' + share.toFixed(0) + '%</b> of an estimated ' + rupees(monthlyTakeHome) +
        ' monthly take-home — ' + verdict[0] + '</span>' +
      '</div>' +
      '<div class="est-note">' +
        (serviced
          ? 'Paying the interest monthly while you study keeps ' + rupees(accrued) + ' off the principal, and many banks give a rate concession for it.'
          : 'Not servicing the interest adds ' + rupees(accrued) + ' to what you repay on. Switch the option above to see the difference.') +
        ' Take-home is estimated at 85% of CTC. Rates, margin money and collateral rules differ by bank — get a written sanction letter before planning on any figure here.' +
      '</div>';
  };

  host.querySelectorAll('select, input').forEach(el => {
    el.addEventListener('change', recalc);
    el.addEventListener('input', recalc);
  });
  recalc();
}

/* ------------------------------ scholarship finder ------------------------------ */
const SCHOLARSHIP_SLABS = [
  { min:95, waiver:100, label:'95% and above' },
  { min:90, waiver:50,  label:'90 – 94.99%' },
  { min:85, waiver:25,  label:'85 – 89.99%' }
];

function mountScholarship(host){
  host.innerHTML =
    '<div class="est">' +
      '<div class="est-controls">' +
        '<label>Class 12 aggregate %<input data-f="marks" type="number" min="33" max="100" step="0.1" value="91"></label>' +
        '<label>Entrance performance<select data-f="exam">' +
          '<option value="0">No entrance score yet</option>' +
          '<option value="25">ASAT / JEE — good</option>' +
          '<option value="50">ASAT / JEE — very strong</option>' +
          '<option value="100">Top-bracket entrance rank</option>' +
        '</select></label>' +
        '<label>Category claim<select data-f="category">' +
          '<option value="0">None</option>' +
          '<option value="25">Sports / defence / sibling</option>' +
        '</select></label>' +
        '<label>Programme<select data-f="course">' +
          Object.keys(COURSE_COST).map(k => '<option value="' + k + '">' + esc(COURSE_COST[k].label) + '</option>').join('') +
        '</select></label>' +
      '</div>' +
      '<div class="est-out" data-out></div>' +
    '</div>';

  const recalc = () => {
    const marks  = Number(host.querySelector('[data-f="marks"]').value) || 0;
    const exam   = Number(host.querySelector('[data-f="exam"]').value);
    const cat    = Number(host.querySelector('[data-f="category"]').value);
    const course = COURSE_COST[host.querySelector('[data-f="course"]').value];

    const slab = SCHOLARSHIP_SLABS.find(s => marks >= s.min);
    const merit = slab ? slab.waiver : 0;
    /* Waivers are generally not cumulative — the best single claim applies. */
    const best = Math.max(merit, exam, cat);
    const source = best === 0 ? null
                 : best === merit ? 'Class 12 merit slab'
                 : best === exam  ? 'entrance score'
                 : 'category claim';

    const saved = course.tuition.map(v => {
      let t = 0; for(let y = 0; y < course.years; y++) t += v * Math.pow(1.05, y);
      return t * best / 100;
    });

    const nextSlab = SCHOLARSHIP_SLABS.filter(s => s.min > marks).pop();

    host.querySelector('[data-out]').innerHTML =
      '<table><thead><tr><th>Slab</th><th>Tuition waiver</th></tr></thead><tbody>' +
        SCHOLARSHIP_SLABS.map(s =>
          '<tr class="' + (slab && s.min === slab.min ? 'elig-yes' : 'elig-no') + '">' +
          '<td>' + esc(s.label) + '</td><td>' + s.waiver + '%' +
          (slab && s.min === slab.min ? ' — you are here' : '') + '</td></tr>').join('') +
      '</tbody></table>' +
      '<div class="est-total"><span>' + (best ? 'Best claim — ' + source : 'No waiver at these marks') + '</span>' +
        '<strong>' + best + '%</strong></div>' +
      (best
        ? '<div class="est-note">Across ' + course.years + ' years of ' + esc(course.label) +
          ' that is roughly <b>' + lakhs(saved[0]) + ' – ' + lakhs(saved[1]) + '</b> off tuition. ' +
          'Waivers apply to tuition only — hostel, mess and one-time charges are unaffected.</div>'
        : '<div class="est-note">You are ' + (nextSlab ? (nextSlab.min - marks).toFixed(1) + '% short of the ' + esc(nextSlab.label) + ' slab. ' : '') +
          'A strong entrance score can qualify you independently of the board percentage, and category claims are assessed separately.</div>') +
      '<div class="est-note">Slabs are generally <b>not cumulative</b> — the best single claim applies, not the sum. ' +
      'Every waiver carries a CGPA renewal condition, and losing it in year 2 is the commonest financial shock in a private degree. ' +
      'Slabs are revised each cycle; confirm the published policy with the admission office.</div>';
  };

  host.querySelectorAll('select, input').forEach(el => {
    el.addEventListener('change', recalc);
    el.addEventListener('input', recalc);
  });
  recalc();
}

/* ------------------------------ placement explorer ------------------------------
   Indicative branch-level figures, assembled from published placement reporting
   and NIRF disclosures. Sortable, because the whole point is comparison. */
const PLACEMENT_ROWS = [
  { branch:'CSE',                    median:5.5, high:24.0, placed:88, top:'IT services, product, analytics' },
  { branch:'CSE (AI & ML)',          median:5.6, high:22.0, placed:86, top:'Analytics, IT services, product' },
  { branch:'IT',                     median:5.2, high:18.0, placed:85, top:'IT services, support, testing' },
  { branch:'ECE',                    median:4.4, high:14.0, placed:80, top:'IT services, embedded, telecom' },
  { branch:'Electrical',             median:4.0, high:11.0, placed:76, top:'Core, power, IT services' },
  { branch:'Mechanical',             median:3.9, high:10.0, placed:74, top:'Manufacturing, automotive, IT services' },
  { branch:'Civil',                  median:3.7, high:9.0,  placed:70, top:'Construction, infrastructure, consultancy' },
  { branch:'Biotechnology',          median:3.5, high:8.0,  placed:66, top:'Pharma, research, analytics' },
  { branch:'MBA',                    median:5.5, high:16.0, placed:92, top:'Sales, marketing, operations, BFSI' },
  { branch:'BBA',                    median:3.6, high:9.0,  placed:70, top:'Sales, business development, operations' },
  { branch:'MCA',                    median:4.6, high:13.0, placed:82, top:'Software development, analytics' },
  { branch:'BCA',                    median:3.4, high:8.0,  placed:68, top:'Development, support, testing' },
  { branch:'B.Com / BA (Hons)',      median:3.2, high:7.5,  placed:62, top:'Accounts, audit, analyst, operations' },
  { branch:'Law (BA/BBA LLB)',       median:4.5, high:12.0, placed:65, top:'Law firms, compliance, legal research' },
  { branch:'B.Pharm',                median:3.5, high:8.5,  placed:72, top:'Pharma QA/QC, regulatory, sales' },
  { branch:'Design / Fashion',       median:3.4, high:9.0,  placed:60, top:'Design studios, retail, UI/UX' },
  { branch:'Journalism & Mass Comm.',median:3.0, high:7.0,  placed:58, top:'Media houses, digital content, PR' }
];

function mountPlacements(host){
  let sortKey = 'median', desc = true, filter = '';

  host.innerHTML =
    '<div class="est">' +
      '<div class="est-controls">' +
        '<label>Filter<input data-f="q" type="text" placeholder="e.g. CSE, MBA, law"></label>' +
        '<label>Sort by<select data-f="sort">' +
          '<option value="median">Median package</option>' +
          '<option value="high">Highest package</option>' +
          '<option value="placed">Placed %</option>' +
          '<option value="branch">Branch name</option>' +
        '</select></label>' +
      '</div>' +
      '<div class="est-out" data-out></div>' +
    '</div>';

  const paint = () => {
    const rows = PLACEMENT_ROWS
      .filter(r => !filter || r.branch.toLowerCase().includes(filter) || r.top.toLowerCase().includes(filter))
      .slice()
      .sort((a, b) => sortKey === 'branch'
        ? a.branch.localeCompare(b.branch)
        : (desc ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey]));

    const best = Math.max.apply(null, PLACEMENT_ROWS.map(r => r.median));

    host.querySelector('[data-out]').innerHTML = rows.length
      ? '<table class="pl-table"><thead><tr><th>Branch</th><th>Median</th><th>Highest</th><th>Placed</th></tr></thead><tbody>' +
        rows.map(r =>
          '<tr><td>' + esc(r.branch) + '<span class="elig-note">' + esc(r.top) + '</span></td>' +
          '<td><span class="pl-bar"><i style="width:' + (r.median / best * 100).toFixed(0) + '%"></i></span>' +
            '<b>' + r.median.toFixed(1) + '</b></td>' +
          '<td>' + r.high.toFixed(1) + '</td><td>' + r.placed + '%</td></tr>').join('') +
        '</tbody></table>' +
        '<div class="est-note">Packages in LPA. <b>Median</b> is the middle offer and the only figure worth planning on — ' +
        'half the placed students got less. <b>Highest</b> is one student. <b>Placed</b> is of eligible, participating students, ' +
        'not of the whole batch. Indicative figures assembled from published placement reporting and NIRF disclosures; ' +
        'ask the placement cell for the current batch.</div>'
      : '<div class="est-note">Nothing matches “' + esc(filter) + '”. Try a branch name such as CSE, MBA, law or design.</div>';
  };

  host.querySelector('[data-f="q"]').addEventListener('input', e => {
    filter = e.target.value.trim().toLowerCase(); paint();
  });
  host.querySelector('[data-f="sort"]').addEventListener('change', e => {
    sortKey = e.target.value; desc = sortKey !== 'branch'; paint();
  });
  paint();
}

/* ------------------------------ admission timeline ------------------------------
   Months are indicative for a typical cycle; the live distance to each stage is
   computed from today so the planner never reads as a stale calendar. */
const TIMELINE = [
  { month:9,  day:1,  title:'Applications open',            note:'Register early — branch choice and hostel category are both first-come.' },
  { month:11, day:1,  title:'First ASAT windows',           note:'Book a slot. The same score usually sets your scholarship slab.' },
  { month:1,  day:15, title:'Class 12 board preparation',   note:'Your board aggregate decides the merit slab. This is the highest-value month of the year.' },
  { month:2,  day:1,  title:'JEE Main session 1',           note:'If you are using a JEE score instead of ASAT.' },
  { month:3,  day:15, title:'Early offers and interviews',  note:'GD-PI for management, law, design and media programmes.' },
  { month:4,  day:15, title:'Board exams end',              note:'Apply for migration and transfer certificates the week results are declared.' },
  { month:5,  day:15, title:'Results and offer letters',    note:'Read the fee schedule, the scholarship percentage and its renewal condition in full.' },
  { month:6,  day:1,  title:'Seat confirmation deadline',   note:'The single most expensive date to miss — a lapsed deadline can release the seat.' },
  { month:6,  day:15, title:'Education loan sanction',      note:'Banks take two to four weeks. Start the moment you have the offer letter.' },
  { month:7,  day:1,  title:'Hostel and transport booking', note:'Allotment is first-come. AC and lower-occupancy rooms go earliest.' },
  { month:7,  day:15, title:'Document verification',        note:'Originals plus two attested photocopy sets. Get a receipt for anything retained.' },
  { month:8,  day:1,  title:'Reporting and induction',      note:'Collect the ID card and Amizone credentials. Attend all of induction.' }
];

function mountTimeline(host){
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const rows = TIMELINE.map(item => {
    /* Place each stage at its next occurrence, so the planner rolls forward
       into the next cycle rather than showing dates that have gone. */
    let when = new Date(today.getFullYear(), item.month - 1, item.day);
    if(when < today) when = new Date(today.getFullYear() + 1, item.month - 1, item.day);
    const days = Math.round((when - today) / 86400000);
    return { item, when, days };
  }).sort((a, b) => a.days - b.days);

  const fmt = d => d.toLocaleDateString('en-IN', { day:'numeric', month:'short' });
  const away = d => d === 0 ? 'today' : d === 1 ? 'tomorrow'
              : d < 31 ? d + ' days away'
              : d < 365 ? Math.round(d / 30) + ' months away' : 'next cycle';

  host.innerHTML =
    '<div class="est tl">' +
      '<ol class="tl-list">' +
        rows.map((r, i) =>
          '<li' + (i === 0 ? ' class="tl-next"' : '') + '>' +
            '<div class="tl-when"><b>' + fmt(r.when) + '</b><em>' + away(r.days) + '</em></div>' +
            '<div class="tl-what"><b>' + esc(r.item.title) + '</b><em>' + esc(r.item.note) + '</em></div>' +
          '</li>').join('') +
      '</ol>' +
      '<div class="est-note">Ordered from today, with the nearest stage first. Months are indicative for a typical cycle — ' +
      'the admission office publishes the exact calendar each year, and dates do move. Work backwards from the fee deadline, not forwards from today.</div>' +
    '</div>';
}

const WIDGETS = {
  estimator:   mountEstimator,
  eligibility: mountEligibility,
  checklist:   mountChecklist,
  compare:     mountCompare,
  loan:        mountLoan,
  scholarship: mountScholarship,
  placements:  mountPlacements,
  timeline:    mountTimeline
};
function mountWidgets(scope){
  scope.querySelectorAll('[data-widget]').forEach(host => {
    const fn = WIDGETS[host.getAttribute('data-widget')];
    if(fn) fn(host);
  });
}

/* ------------------------------ command palette ------------------------------ */
/* With 200+ topics a flat sidebar list stops being navigable, so every entry is
   searchable by title from one place: Ctrl/Cmd+K, or the search button. */
const PALETTE = KB.filter(e => !e.hidden).map(e => ({
  title: e.title, topic: e.topic, hay: (e.title + ' ' + e.topic + ' ' + e.q.join(' ')).toLowerCase()
}));
let paletteIdx = 0, paletteHits = [];

function paletteOpen(){
  const wrap = $('paletteWrap');
  wrap.classList.add('show');
  $('paletteInput').value = '';
  paletteRender('');
  setTimeout(() => $('paletteInput').focus(), 20);
}
function paletteClose(){
  $('paletteWrap').classList.remove('show');
  if(window.matchMedia('(min-width: 880px)').matches) inputEl.focus();
}
function paletteRender(query){
  const q = String(query).trim().toLowerCase();
  const terms = q.split(/\s+/).filter(Boolean);
  paletteHits = (!terms.length ? PALETTE.slice() : PALETTE.filter(item => terms.every(t => item.hay.includes(t))))
    .sort((a, b) => {
      if(!terms.length) return 0;
      const at = a.title.toLowerCase(), bt = b.title.toLowerCase();
      return (bt.startsWith(terms[0]) - at.startsWith(terms[0])) ||
             (bt.includes(q) - at.includes(q)) || a.title.length - b.title.length;
    })
    .slice(0, 60);
  paletteIdx = 0;

  const list = $('paletteList');
  list.innerHTML = '';
  if(!paletteHits.length){
    list.innerHTML = '<div class="palette-empty">Nothing matches that. Type the question in the box below instead — the assistant handles phrasing it has never seen.</div>';
    return;
  }
  paletteHits.forEach((item, i) => {
    const b = document.createElement('button');
    b.className = 'palette-item' + (i === 0 ? ' active' : '');
    b.type = 'button';
    b.innerHTML = '<span>' + highlight(item.title, terms) + '</span>' +
                  '<span class="pcat">' + esc(item.topic) + '</span>';
    b.addEventListener('click', () => { paletteClose(); ask(item.title); });
    b.addEventListener('mousemove', () => paletteMove(i, true));
    list.appendChild(b);
  });
}
function highlight(title, terms){
  let out = esc(title);
  terms.forEach(t => {
    if(!t) return;
    const re = new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
    out = out.replace(re, '<mark>$1</mark>');
  });
  return out;
}
function paletteMove(to, absolute){
  const items = $('paletteList').querySelectorAll('.palette-item');
  if(!items.length) return;
  items[paletteIdx] && items[paletteIdx].classList.remove('active');
  paletteIdx = absolute ? to : (paletteIdx + to + items.length) % items.length;
  const el = items[paletteIdx];
  el.classList.add('active');
  el.scrollIntoView({ block:'nearest' });
}

$('searchBtn').addEventListener('click', paletteOpen);
$('paletteInput').addEventListener('input', e => paletteRender(e.target.value));
$('paletteWrap').addEventListener('click', e => { if(e.target === $('paletteWrap')) paletteClose(); });
$('paletteInput').addEventListener('keydown', e => {
  if(e.key === 'ArrowDown'){ e.preventDefault(); paletteMove(1); }
  else if(e.key === 'ArrowUp'){ e.preventDefault(); paletteMove(-1); }
  else if(e.key === 'Enter'){
    e.preventDefault();
    const hit = paletteHits[paletteIdx];
    if(hit){ paletteClose(); ask(hit.title); }
    else { const typed = $('paletteInput').value.trim(); if(typed){ paletteClose(); ask(typed); } }
  }
  else if(e.key === 'Escape'){ e.preventDefault(); paletteClose(); }
});

/* ------------------------------ find in conversation ------------------------------
   Walks the rendered text nodes and wraps matches, so the search works on what
   the reader can actually see rather than on the raw markdown. */
const findState = { term:'', hits:[], at:-1 };

function findClear(){
  threadEl.querySelectorAll('mark.find-hit').forEach(m => {
    const parent = m.parentNode;
    parent.replaceChild(document.createTextNode(m.textContent), m);
    parent.normalize();
  });
  findState.hits = []; findState.at = -1;
}

function findRun(term){
  findClear();
  findState.term = term;
  if(term.length < 2){ findPaint(); return; }

  const needle = term.toLowerCase();
  const walker = document.createTreeWalker(threadEl, NodeFilter.SHOW_TEXT, {
    acceptNode: node => {
      if(!node.nodeValue.toLowerCase().includes(needle)) return NodeFilter.FILTER_REJECT;
      /* Never rewrite inside a form control's label or a live widget — the
         widgets re-render themselves and would lose the highlight anyway. */
      if(node.parentElement.closest('.est, script, style')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const targets = [];
  let node;
  while((node = walker.nextNode())) targets.push(node);

  targets.forEach(text => {
    const value = text.nodeValue;
    const frag = document.createDocumentFragment();
    let i = 0, at;
    while((at = value.toLowerCase().indexOf(needle, i)) !== -1){
      if(at > i) frag.appendChild(document.createTextNode(value.slice(i, at)));
      const mark = document.createElement('mark');
      mark.className = 'find-hit';
      mark.textContent = value.slice(at, at + term.length);
      frag.appendChild(mark);
      findState.hits.push(mark);
      i = at + term.length;
    }
    if(i < value.length) frag.appendChild(document.createTextNode(value.slice(i)));
    text.parentNode.replaceChild(frag, text);
  });

  if(findState.hits.length){ findState.at = 0; findFocus(); }
  findPaint();
}

function findPaint(){
  const count = $('findCount');
  if(!count) return;
  count.textContent = findState.term.length < 2 ? ''
    : findState.hits.length ? (findState.at + 1) + ' of ' + findState.hits.length
    : 'no matches';
}

function findFocus(){
  findState.hits.forEach((m, i) => m.classList.toggle('current', i === findState.at));
  const hit = findState.hits[findState.at];
  if(hit) hit.scrollIntoView({ block:'center', behavior:'smooth' });
  findPaint();
}

function findStep(by){
  if(!findState.hits.length) return;
  findState.at = (findState.at + by + findState.hits.length) % findState.hits.length;
  findFocus();
}

function findOpen(){
  const bar = $('findbar');
  bar.hidden = false;
  $('findInput').focus();
  $('findInput').select();
}

function findClose(){
  findClear(); findPaint();
  $('findbar').hidden = true;
  $('findInput').value = '';
  findState.term = '';
}

/* ------------------------------ voice input ------------------------------
   Progressive enhancement: the button stays hidden unless the browser offers
   speech recognition, so nothing on the page depends on it. */
function setupVoice(){
  const Recogniser = window.SpeechRecognition || window.webkitSpeechRecognition;
  const btn = $('micBtn');
  if(!Recogniser || !btn) return;

  const rec = new Recogniser();
  rec.lang = 'en-IN';
  rec.interimResults = true;
  rec.continuous = false;

  let listening = false, base = '';

  btn.hidden = false;
  btn.addEventListener('click', () => {
    if(listening){ rec.stop(); return; }
    base = inputEl.value.trim();
    try{ rec.start(); }catch(e){ /* already starting; ignore */ }
  });

  rec.addEventListener('start', () => {
    listening = true;
    btn.classList.add('listening');
    btn.setAttribute('aria-label', 'Stop listening');
    toast('Listening — speak your question');
  });

  rec.addEventListener('result', e => {
    let said = '';
    for(let i = e.resultIndex; i < e.results.length; i++) said += e.results[i][0].transcript;
    inputEl.value = (base ? base + ' ' : '') + said.trim();
    autoGrow();
  });

  rec.addEventListener('error', e => {
    toast(e.error === 'not-allowed'
      ? 'Microphone permission was declined'
      : 'Could not hear that — try typing instead');
  });

  rec.addEventListener('end', () => {
    listening = false;
    btn.classList.remove('listening');
    btn.setAttribute('aria-label', 'Ask by voice');
    if(inputEl.value.trim()) inputEl.focus();
  });
}

/* ------------------------------ shortcut overlay ------------------------------ */
function helpOpen(){ $('helpWrap').classList.add('show'); }
function helpClose(){ $('helpWrap').classList.remove('show'); }

/* ------------------------------ wiring ------------------------------ */
formEl.addEventListener('submit', e => { e.preventDefault(); ask(inputEl.value); });
inputEl.addEventListener('input', autoGrow);
inputEl.addEventListener('keydown', e => {
  if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); ask(inputEl.value); }
});
$('findBtn').addEventListener('click', () => $('findbar').hidden ? findOpen() : findClose());
$('findInput').addEventListener('input', e => findRun(e.target.value.trim()));
$('findInput').addEventListener('keydown', e => {
  if(e.key === 'Enter'){ e.preventDefault(); findStep(e.shiftKey ? -1 : 1); }
});
$('findNext').addEventListener('click', () => findStep(1));
$('findPrev').addEventListener('click', () => findStep(-1));
$('findClose').addEventListener('click', findClose);
$('helpWrap').addEventListener('click', e => { if(e.target === $('helpWrap')) helpClose(); });
$('themeBtn').addEventListener('click', toggleTheme);
$('saveBtn').addEventListener('click', downloadTranscript);
$('resetBtn').addEventListener('click', newChat);
$('menuBtn').addEventListener('click', () => railEl.classList.contains('open') ? closeDrawer() : openDrawer());
scrimEl.addEventListener('click', closeDrawer);
document.addEventListener('keydown', e => {
  const typing = /^(INPUT|TEXTAREA)$/.test((e.target && e.target.tagName) || '');
  if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'){
    e.preventDefault();
    $('paletteWrap').classList.contains('show') ? paletteClose() : paletteOpen();
    return;
  }
  if(e.key === '/' && !typing){ e.preventDefault(); inputEl.focus(); return; }
  if(e.key === '?' && !typing){
    e.preventDefault();
    $('helpWrap').classList.contains('show') ? helpClose() : helpOpen();
    return;
  }
  if(e.key.toLowerCase() === 'f' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey){
    e.preventDefault(); findOpen(); return;
  }
  if(e.key === 'Escape'){
    if($('helpWrap').classList.contains('show')) helpClose();
    else if($('paletteWrap').classList.contains('show')) paletteClose();
    else if(!$('findbar').hidden) findClose();
    else closeDrawer();
  }
});
toBottomEl.addEventListener('click', scrollToEnd);
chatEl.addEventListener('scroll', () => {
  const far = chatEl.scrollHeight - chatEl.scrollTop - chatEl.clientHeight > 240;
  toBottomEl.classList.toggle('show', far);
});
document.querySelectorAll('[data-ask]').forEach(b => {
  b.addEventListener('click', () => ask(b.getAttribute('data-ask')));
});

/* ---------------------------- optional logo ----------------------------
   The logo is embedded in the page, so it works offline and from a file://
   URL. If assets/logo.png (or .svg) is present it is used instead, which lets
   the logo be replaced without rebuilding the page. */
function loadBrandLogo(){
  const img = $('brandLogo'), mark = $('brandMark');
  if(!img || !mark) return;
  const candidates = ['assets/logo.png', 'assets/logo.svg'];
  let i = 0;
  const tryNext = () => {
    if(i >= candidates.length) return;
    const src = candidates[i++];
    const probe = new Image();
    probe.onload = () => { img.src = src; mark.classList.add('has-logo'); };
    probe.onerror = tryNext;
    probe.src = src;
  };
  tryNext();
}

/* ------------------------------ boot ------------------------------ */
applyTheme(currentTheme());
loadBrandLogo();
setupVoice();
buildRail();
renderChips();
$('kbCount').textContent = KB.length + ' topics offline';
$('searchLabel').textContent = 'Search ' + PALETTE.length + ' topics';
if(!restore()) showMasthead();

/* #t/<entry-id> in the URL opens that answer directly */
function openFromHash(){
  const m = /^#t\/([a-z0-9_]+)$/i.exec(location.hash || '');
  if(!m) return false;
  const entry = INDEX.byId[m[1]];
  if(!entry) return false;
  ask(entry.title);
  return true;
}
openFromHash();
window.addEventListener('hashchange', openFromHash);
paintStatus();
probeAI().then(paintStatus);
if(window.matchMedia('(min-width: 880px)').matches) inputEl.focus();
