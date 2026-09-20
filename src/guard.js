
/* =========================================================================
   SCOPE GATE + AI FALLBACK
   ---------------------------------------------------------------------
   Rule enforced here (and again on the server):
     - Off-topic question           -> refused outright, no API call ever.
     - Amity/campus question, KB hit -> answered offline from the KB.
     - Amity/campus question, no KB hit -> and only then -> the AI endpoint.
   The API is therefore a narrow overflow valve for in-scope questions the
   knowledge base does not cover, never a general-purpose chatbot.

   NOTE: DOMAIN_TERMS below is mirrored in server.js. Keep the two in sync.
   ========================================================================= */

const STRONG_SCOPE = /\b(amity|amizone|aset|abs|amity lucknow|malhaur|gomti nagar|aueet|asat)\b/;

const DOMAIN_TERMS = [
  /* institution */
  'university','campus','college','institute','department','faculty','professor','teacher','warden',
  'lucknow','student','freshers','senior','junior','alumni','convocation','degree','diploma',
  'chancellor','dean','registrar','director','principal','hod','naac','ugc','aicte','nirf','ranking',
  'accreditation','batch','class','lecture','assignment','campus life','amity edu',
  /* admission */
  'admission','apply','application','form','eligibility','criteria','entrance','exam','test','merit',
  'counselling','interview','document','certificate','marksheet','migration','deadline','prospectus',
  'seat','quota','reservation','cutoff','percentage','marks','result','score','dropper','gap',
  /* programmes */
  'course','programme','branch','stream','specialisation','syllabus','curriculum','semester','elective',
  'btech','mtech','bba','mba','bca','mca','bcom','mcom','bsc','msc','ballb','llb','llm','law','bpharm',
  'mpharm','pharmacy','barch','phd','journalism','psychology','biotech','design','engineering','commerce',
  'management','science','arts','media','cse','ece','mechanical','civil',
  /* money */
  'fee','tuition','scholarship','waiver','concession','stipend','loan','instalment','refund','deposit',
  'payment','receipt','cost','expense',
  /* living */
  'hostel','accommodation','room','roommate','mess','food','canteen','cafeteria','laundry','curfew',
  'transport','bus','commute','pg','library','lab','wifi','internet','gym','sports','club','society',
  'fest','ncc','nss','ragging','security','medical','clinic','counsellor','parking','gatepass',
  /* academics + outcomes */
  'attendance','cgpa','sgpa','grade','backlog','exam','revaluation','project','internship','training',
  'placement','recruiter','package','salary','job','career','research','publication','patent','abroad',
  'exchange','timetable','holiday','vacation','induction','orientation','portal','enrolment','id card',
  /* vocabulary the expanded knowledge base introduced. Deliberately no bare
     'gate' or 'cat' here: as an allowlist, an ambiguous word would let a
     genuinely off-topic question reach the API. */
  'emi','moratorium','upsc','psu','aptitude','hackathon','incubation','resume','referral',
  'frro','apostille','equivalence','provisional','lateral','honours','viva','mentor',
  'accessibility','disability','scribe','wellbeing','homesick','moot','portfolio',
  'analytics','internships','recruiters','freeship','concessions','hostels'
];
const DOMAIN_SET = new Set(DOMAIN_TERMS.map(t => canon(t)));
const WEAK_ALONE = new Set(['lucknow','student','class','city','gap','form','result','score'].map(t => canon(t)));

/* 'in'    -> clearly about Amity / campus life
   'follow'-> a bare follow-up in an ongoing in-scope conversation
   'out'   -> anything else: refused without calling the API */
function scopeOf(text){
  const norm = normalise(text);
  if(STRONG_SCOPE.test(norm)) return 'in';

  /* A few domain words are too weak to admit a question on their own: a city
     name or "student" can appear in a question with nothing to do with the
     university ("weather in lucknow tomorrow"). One alone is not enough — it
     needs a second weak term or one properly specific one. Mirrors the same
     rule on the server, which is the gate that actually protects the API. */
  const tokens = tokenise(text);
  let strong = 0, weak = 0;
  for(const t of tokens){
    if(!DOMAIN_SET.has(t)) continue;
    if(WEAK_ALONE.has(t)) weak++; else strong++;
  }
  if(strong > 0 || weak > 1) return 'in';

  /* A bare continuation ("and the fees?", "what about hostel") carries no
     domain word of its own. It counts as in-scope only while an in-scope
     answer is still the subject of the chat, AND every word in it is
     vocabulary the knowledge base actually uses — otherwise "tell me a joke"
     would ride in on the previous question. */
  if(convo.lastId && tokens.length && tokens.length <= 4){
    const continuation = tokens.length <= 2 ||
      /^(and|also|ok|okay|so|then|what about|how about|tell me more|more about|why|but)\b/.test(norm);
    const familiar = tokens.every(t => INDEX.vocabSet.has(t));
    if(continuation && familiar) return 'follow';
  }
  return 'out';
}

const OFF_TOPIC_REPLY =
`I only answer questions about **Amity University, Lucknow** — admissions, courses, fees, hostel, campus life, academics and placements.

That one falls outside it, so I haven't looked it up or sent it anywhere.

Ask me something about the university and I'll either answer from my offline knowledge base or, if it isn't covered there, check with the AI assistant.`;

/* ------------------------------ AI endpoint ------------------------------ */
const AI = {
  ready:false,
  model:'',
  reason:'not checked',
  endpoint:'/api/ask'
};

async function probeAI(){
  /* file:// pages have no server to talk to; skip the probe entirely */
  if(location.protocol === 'file:'){
    AI.ready = false; AI.reason = 'opened as a local file';
    return;
  }
  try{
    const res = await fetch('/api/health', { method:'GET' });
    const data = await res.json();
    AI.ready = !!data.ai;
    AI.model = data.model || '';
    AI.reason = data.reason || (AI.ready ? 'ready' : 'no api key configured');
  }catch(e){
    AI.ready = false; AI.reason = 'assistant server not running';
  }
}

async function askAI(question, topicHint){
  const res = await fetch(AI.endpoint, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ question, topic: topicHint || '' })
  });
  let data = {};
  try{ data = await res.json(); }catch(e){ /* non-JSON error page */ }
  if(!res.ok || !data.answer){
    const err = new Error(data.error || ('http_' + res.status));
    err.code = data.error || ('http_' + res.status);
    throw err;
  }
  return data;
}

const AI_ERROR_TEXT = {
  out_of_scope:  'The assistant server also judged that question to be outside Amity Lucknow admissions, so it was not answered.',
  rate_limited:  'The AI assistant has hit its request limit for now. Try again in a few minutes, or ask something the offline knowledge base covers.',
  ai_disabled:   'The AI fallback is switched off (no API key configured on the server).',
  too_long:      'That question is too long for the AI fallback — try asking it in a sentence or two.',
  upstream_error:'The AI assistant could not be reached just now.'
};
