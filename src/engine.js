
/* =========================================================================
   RETRIEVAL ENGINE  (no dependencies, no network)
   TF-IDF cosine similarity + phrase/bigram bonuses + typo repair,
   with a slot router for "<course> + <aspect>" questions.
   ========================================================================= */

/* Multi-word rewrites applied to the raw text before tokenising. */
const PHRASES = [
  [/\bb\s*\.?\s*tech\b/g,'btech'], [/\bb\s*\.?\s*e\b/g,'btech'],
  [/\bm\s*\.?\s*tech\b/g,'mtech'], [/\bb\s*\.?\s*arch\b/g,'barch'],
  [/\bb\s*\.?\s*com\b/g,'bcom'],   [/\bm\s*\.?\s*com\b/g,'mcom'],
  [/\bb\s*\.?\s*sc\b/g,'bsc'],     [/\bm\s*\.?\s*sc\b/g,'msc'],
  [/\bb\s*\.?\s*pharm\w*\b/g,'bpharm'], [/\bm\s*\.?\s*pharm\w*\b/g,'mpharm'],
  [/\bb\s*\.?\s*des\b/g,'bdes'],   [/\bm\s*\.?\s*des\b/g,'mdes'],
  [/\bba\s*\.?\s*llb\b/g,'ballb'], [/\bbba\s*\.?\s*llb\b/g,'bballb'],
  [/\bl\s*\.?\s*l\s*\.?\s*b\b/g,'llb'], [/\bl\s*\.?\s*l\s*\.?\s*m\b/g,'llm'],
  [/\bph\s*\.?\s*d\b/g,'phd'],
  [/\bcomputer science\b/g,'cse'], [/\bcomputer sci\b/g,'cse'],
  [/\bartificial intelligence\b/g,'ai'], [/\bmachine learning\b/g,'ml'],
  [/\bmass comm\w*\b/g,'journalism'], [/\bjmc\b/g,'journalism'],
  [/\bemi\b/g,'emi loan instalment'], [/\binstal?lment\b/g,'instalment'],
  [/\bhow much\b(?=.*\b(emi|loan)\b)/g,' '],
  [/\bhow much\b/g,'fee how much'], [/\bhow many rupees\b/g,'fee'],
  [/\bper year\b/g,'yearly'], [/\bper annum\b/g,'yearly'],
  [/\bwhat is the\b/g,'what'], [/\bcan you tell me\b/g,'tell'],
  [/\bi want to know\b/g,'tell'], [/\bplease\b/g,' '],
  [/\bwhat's\b/g,'what is'], [/\bdon't\b/g,'do not'], [/\bcan't\b/g,'cannot'],
  [/\bi'm\b/g,'i am'], [/\bit's\b/g,'it is'], [/\bwon't\b/g,'will not'],
  [/\bplz\b|\bpls\b/g,' '], [/\bu\b/g,'you'], [/\br\b/g,'are'],
  [/\bkitna\b|\bkitni\b/g,'how much'], [/\bkya\b/g,'what'], [/\bkaise\b/g,'how'],
  [/\brs\.?\b|\binr\b|₹/g,'fee'],
  [/\belectronics and communication\b/g,'ece'], [/\belectronics\b/g,'ece electronics'],
  [/\btraining and placement\b/g,'placement cell'],
  [/\binformation technology\b/g,'it'], [/\bdata science\b/g,'data science ai']
];

/* token -> canonical token (both the query and the index go through this,
   so a synonym in either place lands on the same term). */
const SYN_GROUPS = {
  fee:['fee','fees','cost','costs','price','prices','pricing','charge','charges','tuition','expense','expenses','expensive','afford','affordable','money','budget','rupee','rupees','lakh','lakhs','amount','payable'],
  eligibility:['eligible','eligibility','criteria','criterion','qualify','qualifying','qualification','qualifications','requirement','requirements','required','require','cutoff','cutoffs','prerequisite','percentage','percent','marks','score','scores'],
  admission:['admission','admissions','admit','admitted','enroll','enrolled','enrolment','enrollment','join','joining','apply','applying','application','applications','register','registration','registering'],
  hostel:['hostel','hostels','accommodation','accomodation','dorm','dormitory','room','rooms','stay','staying','residence','residential','lodging','hostler','hosteller'],
  placement:['placement','placements','job','jobs','recruit','recruited','recruiter','recruiters','recruitment','package','packages','salary','salaries','hiring','hire','ctc','lpa','placed'],
  scholarship:['scholarship','scholarships','waiver','waivers','concession','concessions','discount','discounts','stipend','freeship','aid'],
  course:['course','courses','program','programs','programme','programmes','degree','degrees','branch','branches','stream','streams','specialisation','specialization','specialisations','specializations','subject','subjects','study','studies','studying'],
  exam:['exam','exams','examination','examinations','test','tests','entrance','paper'],
  document:['document','documents','documentation','certificate','certificates','paperwork','marksheet','marksheets','transcript','transcripts'],
  contact:['contact','phone','mobile','helpline','call','calling','email','mail','enquiry','inquiry','enquire','reach'],
  facility:['facility','facilities','infrastructure','amenity','amenities'],
  food:['food','mess','canteen','cafeteria','meal','meals','dining','eating','menu'],
  transport:['transport','transportation','bus','buses','shuttle','commute','commuting','conveyance'],
  btech:['btech','engineering','engineer'],
  cse:['cse'], ece:['ece'],
  mba:['mba'], bba:['bba'], bca:['bca'], mca:['mca'],
  law:['law','llb','ballb','bballb','legal','advocate','lawyer'],
  pharmacy:['pharmacy','bpharm','mpharm','pharma','pharmaceutical','pharmacist'],
  design:['design','designing','fashion','mdes','bdes','textile'],
  journalism:['journalism','media','communication','broadcast','advertising'],
  psychology:['psychology','psychological','counselling','counseling','behavioural','behavioral'],
  biotech:['biotech','biotechnology','microbiology','forensic','biology'],
  good:['good','best','better','great','top','nice','worth','worthy','recommended'],
  duration:['duration','long','length','years','year','semester','semesters'],
  library:['library','libraries','book','books','journal','journals'],
  wifi:['wifi','internet','network','broadband','amizone','portal'],
  sport:['sport','sports','game','games','gym','gymnasium','fitness','cricket','football','basketball'],
  refund:['refund','refunds','refundable','cancel','cancellation','cancelling','withdraw','withdrawal'],
  loan:['loan','loans','emi','instalment','instalments','installment','installments','finance','financing'],
  ragging:['ragging','bullying','harassment','rag'],
  attendance:['attendance','attend','bunk','bunking','absent','absence'],
  internship:['internship','internships','intern','training','trainee'],
  date:['date','dates','deadline','deadlines','timeline','last','when','schedule'],
  interview:['interview','interviews','gdpi','gd','pi','discussion'],
  visit:['visit','visiting','tour','see','campus visit'],
  online:['online','distance','correspondence','remote','virtual'],
  safety:['safety','safe','security','secure','protection'],
  rank:['rank','ranking','rankings','nirf','reputation','rated','rating'],
  approval:['approval','approved','recognised','recognized','recognition','accredited','accreditation','naac','ugc','aicte','valid','validity']
};
const SYN = (() => {
  const m = Object.create(null);
  for(const canon in SYN_GROUPS) for(const w of SYN_GROUPS[canon]) m[w] = canon;
  return m;
})();

const STOP = new Set(['a','an','the','of','for','to','in','on','at','by','with','from','into','as','and','or','but','if','then','than','so','that','this','these','those','it','its','i','me','my','we','our','you','your','yours','he','she','they','them','his','her','their','there','here','am','is','are','was','were','be','been','being','do','does','did','doing','have','has','had','will','would','shall','should','can','could','may','might','must','about','also','just','very','really','some','any','more','most','much','many','tell','know','give','provide','want','need','sir','maam','ok','okay','yes','hmm','please','kindly','thanks','anyone','someone','regarding','related','information','info','details','detail','about','how','what','which','when','where','why','who','whom','whose','whether','there','get','got','like','tell','say','many','lot']);

function normalise(text){
  let t = ' ' + String(text).toLowerCase() + ' ';
  t = t.replace(/[’']/g, "'");
  for(const [re, sub] of PHRASES) t = t.replace(re, sub);
  t = t.replace(/[^a-z0-9%+ ]+/g, ' ').replace(/\s+/g, ' ').trim();
  return t;
}

function stem(w){
  if(w.length < 4) return w;
  if(/ies$/.test(w) && w.length > 4) return w.slice(0, -3) + 'y';
  if(/(ing|ers|ed)$/.test(w) && w.length > 5) return w.replace(/(ing|ers|ed)$/, '');
  if(/s$/.test(w) && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
  return w;
}

function canon(w){
  const direct = SYN[w];
  if(direct) return direct;
  const s = stem(w);
  return SYN[s] || s;
}

function tokenise(text, keepStop){
  const raw = normalise(text).split(' ').filter(Boolean);
  const out = [];
  for(const w of raw){
    if(!keepStop && STOP.has(w)) continue;
    if(w.length < 2 && !/^[0-9]$/.test(w)) continue;
    out.push(canon(w));
  }
  if(!out.length) return raw.map(canon);   // query was entirely stop-words
  return out;
}

/* ----------------------------- the index ----------------------------- */
const INDEX = (() => {
  const docs = [];
  const df = Object.create(null);
  const vocab = new Set();

  for(const entry of KB){
    const tf = Object.create(null);
    const add = (text, weight) => {
      for(const t of tokenise(text)){
        tf[t] = (tf[t] || 0) + weight;
        vocab.add(t);
      }
    };
    for(const phrase of entry.q) add(phrase, 3);
    add(entry.title, 2.2);
    add(entry.topic, 0.8);
    add(String(entry.a).replace(/[#*>\-]/g, ' ').slice(0, 900), 0.45);

    for(const t in tf) df[t] = (df[t] || 0) + 1;
    docs.push({ entry, tf, phrases: entry.q.map(normalise).filter(Boolean) });
  }

  const N = docs.length;
  const idf = Object.create(null);
  for(const t in df) idf[t] = Math.log(1 + N / df[t]);

  for(const d of docs){
    const vec = Object.create(null);
    let norm = 0;
    for(const t in d.tf){
      const v = (1 + Math.log(d.tf[t])) * (idf[t] || 1);
      vec[t] = v; norm += v * v;
    }
    d.vec = vec;
    d.norm = Math.sqrt(norm) || 1;
  }
  return { docs, idf, vocab: Array.from(vocab), vocabSet: vocab, byId: Object.fromEntries(KB.map(e => [e.id, e])) };
})();

/* --------------------------- typo repair --------------------------- */
function editDistance(a, b, limit){
  if(Math.abs(a.length - b.length) > limit) return limit + 1;
  const prev = new Array(b.length + 1);
  const cur = new Array(b.length + 1);
  for(let j = 0; j <= b.length; j++) prev[j] = j;
  for(let i = 1; i <= a.length; i++){
    cur[0] = i;
    let rowMin = cur[0];
    for(let j = 1; j <= b.length; j++){
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if(cur[j] < rowMin) rowMin = cur[j];
    }
    if(rowMin > limit) return limit + 1;
    for(let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}

function repair(tokens){
  const known = new Set(INDEX.vocab);
  return tokens.map(t => {
    if(known.has(t) || t.length < 4) return t;
    const limit = t.length > 6 ? 2 : 1;
    let best = null, bestD = limit + 1;
    for(const v of INDEX.vocab){
      if(Math.abs(v.length - t.length) > limit) continue;
      const d = editDistance(t, v, limit);
      if(d < bestD || (d === bestD && best && v[0] === t[0] && best[0] !== t[0])){
        bestD = d; best = v;
        if(d === 1 && v[0] === t[0]) break;
      }
    }
    return (best && bestD <= limit) ? best : t;
  });
}

/* --------------------------- slot routing --------------------------- */
const COURSE_PATTERNS = [
  ['mtech',  ['mtech']],
  ['mca',    ['mca']],
  ['mba',    ['mba','master of business']],
  ['llm',    ['llm']],
  ['law',    ['ballb','bballb','llb','law']],
  ['barch',  ['barch','architecture']],
  ['btech',  ['btech','engineering','cse','ece','mechanical','civil','ai ml','data science']],
  ['bba',    ['bba','bachelor of business']],
  ['bcom',   ['bcom','mcom','commerce','economics']],
  ['bca',    ['bca']],
  ['bsc',    ['bsc','biotech','biotechnology','microbiology','forensic']],
  ['msc',    ['msc']],
  ['pharm',  ['bpharm','mpharm','pharmacy','pharma']],
  ['design', ['mdes','bdes','design','fashion']],
  ['media',  ['journalism','mass communication']],
  ['arts',   ['psychology','english hons','arts']],
  ['phd',    ['phd','doctorate','doctoral']]
];

const ASPECT_PATTERNS = [
  ['eligibility', ['eligib','criteria','qualification','who can apply','minimum marks','minimum percentage','cut off','cutoff','percentage needed','marks needed','marks required','am i eligible','required for']],
  ['fee',         ['fee','how much','cost','price','charges','tuition','expensive']]
];

const COURSE_CODES = new Set(COURSE_PATTERNS.map(c => c[0]).concat(['btech','mba','bba','bca','mca','law','pharmacy','design','journalism','biotech','psychology']));

const ROUTE = {
  eligibility:{ btech:'el_btech', mtech:'el_mtech', mba:'el_mba', bba:'el_bba', bcom:'el_bcom',
                bca:'el_bca', mca:'el_mca', law:'el_law', llm:'el_law', bsc:'el_science',
                msc:'el_science', pharm:'el_pharm', design:'el_arts', media:'el_arts',
                arts:'el_arts', phd:'el_phd', barch:'el_general' },
  fee:        { btech:'fee_btech', mtech:'fee_btech', mba:'fee_mgmt', bba:'fee_mgmt',
                bcom:'fee_arts', bca:'fee_computer', mca:'fee_computer', law:'fee_law',
                llm:'fee_law', bsc:'fee_science', msc:'fee_science', pharm:'fee_science',
                design:'fee_arts', media:'fee_arts', arts:'fee_arts', phd:'fee_overview',
                barch:'fee_overview' }
};

function detectCourse(norm){
  for(const [code, pats] of COURSE_PATTERNS){
    for(const p of pats){
      if(new RegExp('(^| )' + p.replace(/ /g, ' ') + '( |$)').test(norm)) return code;
    }
  }
  return null;
}
function detectAspect(norm){
  for(const [aspect, pats] of ASPECT_PATTERNS){
    for(const p of pats) if(norm.includes(p)) return aspect;
  }
  return null;
}

/* ---------------------------- scoring ---------------------------- */
function rank(text, opts){
  const norm = normalise(text);
  const tokens = repair(tokenise(text));
  const bigrams = [];
  for(let i = 0; i < tokens.length - 1; i++) bigrams.push(tokens[i] + ' ' + tokens[i + 1]);

  const qtf = Object.create(null);
  for(const t of tokens) qtf[t] = (qtf[t] || 0) + 1;
  const qvec = Object.create(null);
  let qnorm = 0;
  for(const t in qtf){
    const v = (1 + Math.log(qtf[t])) * (INDEX.idf[t] || Math.log(1 + INDEX.docs.length));
    qvec[t] = v; qnorm += v * v;
  }
  qnorm = Math.sqrt(qnorm) || 1;

  const results = [];
  for(const d of INDEX.docs){
    let dot = 0;
    for(const t in qvec){
      const dv = d.vec[t];
      if(dv) dot += qvec[t] * dv;
    }
    let score = dot / (qnorm * d.norm);

    /* phrase bonuses */
    let phraseBonus = 0, exact = false;
    for(const p of d.phrases){
      if(norm === p){ phraseBonus = Math.max(phraseBonus, 0.8); exact = true; break; }
      if(p.length > 3 && norm.includes(p)) phraseBonus = Math.max(phraseBonus, 0.26 + 0.05 * p.split(' ').length);
      else if(p.includes(norm) && norm.length > 4) phraseBonus = Math.max(phraseBonus, 0.16);
    }
    /* bigram bonus */
    let bigramBonus = 0;
    if(bigrams.length){
      const dt = d.entry.q.join(' | ');
      const dn = normalise(dt);
      for(const bg of bigrams) if(dn.includes(bg)) bigramBonus += 0.05;
    }
    /* title hit bonus */
    const titleTokens = new Set(tokenise(d.entry.title));
    let titleHits = 0;
    for(const t of tokens) if(titleTokens.has(t)) titleHits++;
    const titleBonus = titleTokens.size ? 0.12 * (titleHits / Math.max(tokens.length, 1)) : 0;

    score = score + phraseBonus + Math.min(bigramBonus, 0.2) + titleBonus;
    if(d.entry.hidden && !exact && (opts && opts.noHidden)) score *= 0.4;
    results.push({ entry: d.entry, score });
  }
  results.sort((a, b) => b.score - a.score);
  return results;
}

/* --------------------------- conversation --------------------------- */
const CONFIDENT = 0.42;   // answer straight away
const MAYBE     = 0.22;   // answer, but offer alternatives too

const convo = { lastCourse:null, lastAspect:null, lastTopic:null, lastId:null };

function answerOne(text){
  const norm = normalise(text);
  const course = detectCourse(norm);
  const aspect = detectAspect(norm);
  if(course) convo.lastCourse = course;
  if(aspect) convo.lastAspect = aspect;

  /* 0. A bare course name after an aspect question ("btech fees" -> "and mba?")
        inherits that aspect. Only when the question is *nothing but* the course,
        though — "how many lifts are in the engineering block" mentions a course
        word but is plainly a new question, not a follow-up. */
  if(course && !aspect && convo.lastAspect){
    const residual = tokenise(text).filter(t => !COURSE_CODES.has(t));
    if(!residual.length){
      const carried = ROUTE[convo.lastAspect] && ROUTE[convo.lastAspect][course];
      if(carried && INDEX.byId[carried]) return { entry: INDEX.byId[carried], score: 1, mode: 'routed' };
    }
  }

  /* 1. slot router: "<course> + <aspect>" is answered exactly.
        With no course in the sentence we reuse the last one discussed, but
        only for bare follow-ups ("and the fees?") — never for a question
        that carries a subject of its own ("hostel fees"). */
  if(aspect){
    let useCourse = course;
    if(!useCourse && convo.lastCourse){
      const aspectWord = aspect === 'fee' ? 'fee' : 'eligibility';
      const residual = tokenise(text).filter(t => t !== aspectWord && !COURSE_CODES.has(t));
      if(!residual.length) useCourse = convo.lastCourse;
    }
    const id = useCourse && ROUTE[aspect] && ROUTE[aspect][useCourse];
    if(id && INDEX.byId[id]) return { entry: INDEX.byId[id], score: 1, mode: 'routed' };
  }

  /* 2. similarity search */
  const ranked = rank(text, { noHidden: normalise(text).split(' ').length > 3 });
  const top = ranked[0];
  if(!top) return { entry:null, mode:'none', alternatives:[] };

  if(top.score >= CONFIDENT) return { entry: top.entry, score: top.score, mode: 'match' };
  if(top.score >= MAYBE){
    return {
      entry: top.entry, score: top.score, mode: 'weak',
      alternatives: ranked.slice(1, 4).filter(r => r.score > 0.08 && !r.entry.hidden).map(r => r.entry)
    };
  }
  return {
    entry: null, score: top.score, mode: 'unsure',
    alternatives: ranked.slice(0, 4).filter(r => r.score > 0.05 && !r.entry.hidden).map(r => r.entry)
  };
}

/* Splits "fees and hostel?" style questions into parts so both get answered. */
function splitQuestions(text){
  const parts = String(text)
    .split(/\?|,|;|\band also\b|\balso tell\b|\band what about\b|\band\b/i)
    .map(s => s.trim())
    .filter(s => s.length > 2 && tokenise(s).length >= 1);
  if(parts.length < 2) return [text];
  const meaty = parts.filter(p => p.length >= 3 && tokenise(p).length >= 1);
  return meaty.length >= 2 ? meaty.slice(0, 2) : [text];
}

/* Public entry point: returns one or two answers for a user message. */
function respond(text){
  const clean = String(text).trim();
  if(!clean) return [];

  /* two questions in one line ("fees and hostel?") get two answers */
  const parts = splitQuestions(clean);
  if(parts.length > 1){
    const saved = { c: convo.lastCourse, a: convo.lastAspect };
    const a = answerOne(parts[0]);
    const b = answerOne(parts[1]);
    if(a.entry && b.entry && a.entry.id !== b.entry.id &&
       a.mode !== 'unsure' && b.mode !== 'unsure' &&
       (a.score || 0) >= 0.4 && (b.score || 0) >= 0.4){
      remember(b.entry);
      return [a, b];
    }
    convo.lastCourse = saved.c; convo.lastAspect = saved.a;
  }

  const direct = answerOne(clean);
  if(direct.entry) remember(direct.entry);
  return [direct];
}

function remember(entry){
  if(!entry) return;
  convo.lastId = entry.id;
  convo.lastTopic = entry.topic;
}

/* Follow-up suggestions for an answered entry. */
function followUps(entry){
  if(!entry) return [];
  if(entry.chips && entry.chips.length) return entry.chips.slice(0, 4);
  const mates = KB.filter(e => e.topic === entry.topic && e.id !== entry.id && !e.hidden);
  return mates.slice(0, 3).map(e => e.title);
}
