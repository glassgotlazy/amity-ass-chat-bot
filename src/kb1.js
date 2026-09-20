/* =========================================================================
   Amity Lucknow — Admission Assistant
   ---------------------------------------------------------------------
   100% client-side. No API key, no network call, no server: the whole
   assistant (knowledge base + retrieval engine) lives in this one file and
   works offline, straight from a double-clicked index.html.

   HOW IT ANSWERS
     1. The question is normalised (typo repair, abbreviation expansion,
        stop-word removal, light stemming).
     2. A TF-IDF vector is built from it and compared against every entry in
        the knowledge base (cosine similarity), with phrase and bigram
        bonuses on top.
     3. A slot router catches "<course> + <aspect>" questions such as
        "btech fees" or "eligibility for MBA" and jumps straight to the
        precise entry, remembering the last course you asked about so
        follow-ups like "and the hostel?" still make sense.
     4. If nothing clears the confidence bar, the bot offers its closest
        matches instead of a dead end.

   DATA DISCLAIMER: fees, cut-offs and placement figures change every
   admission cycle. Everything here is an indicative summary for guidance
   only — confirm on amity.edu/lucknow before acting on it.

   ANSWER MARK-UP (rendered by render() further down)
     ### Heading -> small caps heading
     - bullet -> list item
     **bold**         -> bold
     > note -> muted footnote line
   ========================================================================= */

const KB = [

/* ------------------------------ small talk ------------------------------ */
{
  id:'greeting', topic:'General', title:'Say hello', hidden:true,
  q:['hi','hello','hey','namaste','hii','helo','good morning','good afternoon','good evening','yo','hola','start','greetings'],
  a:`Hello! I'm the **Amity Lucknow admission assistant** — a fully offline helper for prospective students and parents.

I can answer questions on courses, eligibility, entrance tests, fees, scholarships, hostel, placements, campus life and the application process.

Ask in plain English (typos are fine) or pick a topic from the sidebar.`,
  chips:['What courses are offered?','B.Tech eligibility','What are the fees?','How do I apply?']
},
{
  id:'help', topic:'General', title:'What can I ask?',
  q:['help','what can you do','what can i ask','what can you help me with','topics','options','menu','how do you work','commands','guide me','i need help'],
  a:`Here's everything I cover — ask about any of it in your own words:

### Admissions
- Courses & specialisations, eligibility for each programme
- Entrance tests (ASAT, JEE, CAT/MAT, CLAT, NATA, GATE)
- Step-by-step application process, documents, deadlines, counselling

### Money
- Course-wise fees, hostel & mess charges, other one-time charges
- Scholarships and waivers, instalments, education loans, refund rules

### Campus & life
- Hostel rooms and rules, mess food, transport, clubs, sports, library, labs
- Attendance, grading, backlog rules, internships, study-abroad options

### Outcomes
- Placement statistics, recruiters, internship support, higher-studies help

> Tip: ask follow-ups like "and its fees?" — I remember the course we were just discussing.`,
  chips:['What courses are offered?','Fees for B.Tech','Hostel facilities','Placement record']
},
{
  id:'identity', topic:'General', title:'Who are you?',
  q:['who are you','are you a bot','are you human','are you ai','do you use chatgpt','which model are you','are you official','who made you','is this official','are you real'],
  a:`I'm a **rule-and-retrieval chatbot**, not a live AI service — there's no API key, no server and no internet call behind me. Everything I know is written into this single HTML file, so I keep working on aeroplane mode.

That also means: I'm **not an official Amity University channel**. I'm a study aid built from publicly available information, and figures shift every admission cycle. For anything binding — a fee quote, a cut-off, a deadline — confirm with the admission office.`,
  chips:['Contact the admission office','What can you help me with?']
},
{
  id:'howareyou', topic:'General', title:'How are you?', hidden:true,
  q:['how are you','how are you doing','whats up','how is it going','kaise ho'],
  a:`Running offline and ready to help. What would you like to know about Amity Lucknow admissions?`,
  chips:['What can you help me with?','Courses offered','Fee structure']
},
{
  id:'thanks', topic:'General', title:'Thanks', hidden:true,
  q:['thank','thanks','thank you','thx','thanku','thanks a lot','shukriya','great help','appreciate it'],
  a:`You're welcome! Anything else — fees, hostel, entrance tests, placements?`,
  chips:['Scholarship options','Hostel fees','Placement record']
},
{
  id:'bye', topic:'General', title:'Goodbye', hidden:true,
  q:['bye','goodbye','see you','exit','quit','good night','tata','thats all'],
  a:`All the best with your admission journey! Come back any time — the chat stays saved on this device.`
},

/* --------------------------- university basics --------------------------- */
{
  id:'about', topic:'University', title:'About Amity Lucknow',
  q:['about amity','what is amity','amity lucknow','tell me about the university','overview','introduction','university info','when was amity established','history','who owns amity'],
  a:`**Amity University Uttar Pradesh, Lucknow Campus** is a private university run by the Ritnand Balved Education Foundation (the Amity Education Group), operating in Lucknow since 2010.

- **Campus:** Malhaur (near Malhaur railway station), Gomti Nagar Extension, Lucknow – 226028
- **Size:** roughly a 40-acre residential campus
- **Scale:** 800+ faculty members, 210+ laboratories, a library with 70,000+ books and thousands of e-journals
- **Spread:** engineering, management, law, commerce, computer applications, biotech, pharmacy, design, media, psychology and doctoral programmes under one campus

It is part of the same university as the Noida campus, so degrees are awarded by Amity University Uttar Pradesh.`,
  chips:['Is the degree UGC approved?','Where exactly is the campus?','What courses are offered?','Campus facilities']
},
{
  id:'approval', topic:'University', title:'Approvals & accreditation',
  q:['ugc approved','is amity recognised','recognition','accreditation','aicte approved','bci approved','pci approved','is the degree valid','valid for government jobs','degree validity','is amity fake','is amity legit'],
  a:`### Recognition
- Amity University Uttar Pradesh is a **state private university established by an Act of the UP legislature** and recognised by the **UGC**.
- The Lucknow campus lists recognition by **UGC, AICTE, NCTE, PCI and COA**, with **BCI** approval for the law programmes.
- Amity University Uttar Pradesh holds **NAAC accreditation at grade A+** — awarded to the university, which the Lucknow campus sits under.

### What that means for you
Degrees are valid for government jobs, higher studies and competitive exams like GATE, CAT, UPSC and NET, and for overseas admissions.

> Always verify the current approval status for **your specific programme** on amity.edu/lucknow or the UGC/AICTE portals — approvals are renewed course by course.`,
  chips:['About Amity Lucknow','Placement record','Contact the admission office']
},
{
  id:'ranking', topic:'University', title:'Rankings & reputation',
  q:['ranking','rank','nirf','is amity good','reputation','how good is amity','best private university','rating','reviews','what do students say'],
  a:`Amity University Uttar Pradesh holds **NAAC A+** accreditation and appears in **NIRF** listings — the Noida campus placed **49th in the Management category in NIRF 2025**. The Lucknow campus files its own NIRF data report but is usually discussed under the parent university, so a standalone "Lucknow rank" is rarely meaningful.

### An honest read
- **Strong points:** modern infrastructure, industry certifications built into the syllabus, a large recruiter base, active clubs and fests, strict discipline.
- **Common criticisms:** fees are high compared with state universities, average packages are moderate outside CSE/IT, and outcomes depend heavily on your own effort in coding/aptitude prep.

> Rankings move every year — check the current NIRF list before quoting a number anywhere.`,
  chips:['Placement record','Is Amity worth the fees?','Fee structure']
},
{
  id:'worth', topic:'University', title:'Is it worth it?',
  q:['is amity worth it','worth the money','should i join amity','pros and cons','advantages disadvantages','is it good for me','should i take admission'],
  a:`A balanced view, so you can decide for yourself:

### Reasons students pick it
- Admission is achievable without a top JEE rank
- Campus, labs, hostel and sports facilities are well maintained
- Certification tie-ups, internships and a broad recruiter pool
- Scholarships can cut the fee sharply if you score well in ASAT or Class 12

### Reasons to think twice
- Total cost is much higher than a state or government college
- Average packages are moderate; the headline "highest package" is one outlier
- Attendance and discipline rules are strict
- Placement outcomes depend on the branch and on your own coding/aptitude work

### A practical test
Compare your likely **total cost after scholarship** against the realistic **average package for your branch**, and ask the admission office for branch-wise placement data before paying.`,
  chips:['Scholarship options','Placement record','Fee structure','Education loan']
},
{
  id:'vs_noida', topic:'University', title:'Lucknow vs Noida campus',
  q:['lucknow or noida','amity noida vs lucknow','which campus is better','difference between campuses','noida campus','other campuses','compare campus'],
  a:`Both campuses belong to **Amity University Uttar Pradesh**, so the degree and academic structure are the same. Practical differences:

- **Noida** is the flagship: bigger, more programmes and specialisations, more on-campus recruiters and a denser NCR internship market.
- **Lucknow** is smaller and calmer, with lower living costs, less crowded labs and easier access for students from UP, Bihar and nearby states.
- **Fees** differ by campus and programme — compare the specific course, not the campus as a whole.
- Some niche specialisations run only at Noida, so check the Lucknow course list before assuming a branch exists here.`,
  chips:['What courses are offered?','Fee structure','Placement record']
},
{
  id:'location', topic:'University', title:'Campus address',
  q:['where is amity lucknow','address','location','campus address','where is the campus','pin code','which city'],
  a:`**Amity University Lucknow Campus**
Malhaur (near Malhaur Railway Station), Gomti Nagar Extension, Lucknow – 226028, Uttar Pradesh, India.

It sits on the eastern edge of Lucknow in the Gomti Nagar Extension belt, a few minutes from Malhaur station and well connected to Chinhat and Indira Nagar.`,
  chips:['How do I reach the campus?','Can I visit the campus?','Contact the admission office']
},
{
  id:'reach', topic:'University', title:'How to reach',
  q:['how to reach','how do i get there','nearest railway station','nearest airport','distance from station','distance from airport','how far is the airport','how far is the station','travel to campus','directions','metro','bus to amity','route to campus'],
  a:`### Getting to campus
- **Nearest railway station:** Malhaur — practically next door (a short auto ride).
- **Main railway stations:** Lucknow Charbagh / Lucknow Junction, roughly 15–20 km away.
- **Airport:** Chaudhary Charan Singh International Airport, roughly 25–30 km; allow an hour in traffic.
- **Metro:** the Lucknow Metro's nearest reach is the Munshipulia end of the line; take an auto or cab onward to Malhaur.
- **Road:** autos, e-rickshaws and cabs run regularly from Gomti Nagar, Indira Nagar and Chinhat.

The university also runs campus buses on city routes for day scholars.`,
  chips:['Bus and transport facility','Campus address','Can I visit the campus?']
},
{
  id:'visit', topic:'University', title:'Campus visit',
  q:['can i visit','campus visit','campus tour','open house','see the campus','visit before admission','walk in'],
  a:`Yes — walk-in campus visits are normally welcome on working days during office hours, and the admission cell arranges guided tours for prospective students and parents.

### Worth doing on a visit
- See the hostel room you'd actually be allotted, and eat a meal in the mess
- Ask for **branch-wise** placement data for the last two years, in writing
- Confirm the full fee sheet: tuition, one-time charges, hostel, transport, exam fees
- Meet a department faculty member and, if possible, a current student

Call ahead on **+91-7303789789** to fix a slot, especially during the peak admission season.`,
  chips:['Contact the admission office','Hostel facilities','Documents required']
}
