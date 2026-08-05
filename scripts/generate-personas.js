require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');

const sql = postgres(process.env.POSTGRES_URL_NON_POOLING, { ssl: 'require' });

const ADL_ID = '737de245-2a09-44f9-bdcd-f3357555eeca';
const PORT_ID = '0ffea072-0406-4eae-a47a-6c6a0bd1761c';
const PERIOD = '30d';

// ─── ADL Website ────────────────────────────────────────────────────────────

const adlPersonas = {
  personas: [
    {
      id: 'persona_1',
      name: 'The Passive Scroller',
      archetype: 'Casual Discoverer',
      tagline: 'Stumbled onto ADL and is deciding in seconds whether to stay',
      emoji: '📱',
      prevalence: 65,
      primaryDevice: 'mobile',
      topLocations: ['United States'],
      primarySource: 'Direct',
      avgDurationSeconds: 18,
      avgPageViews: 1.0,
      typicalEntryPage: '/',
      typicalExitPage: '/',
      goals: [
        'Quickly understand what ADL does',
        'Decide if it is worth a longer look',
      ],
      behaviors: [
        'Arrives on mobile, scans the homepage hero section for 10-20 seconds',
        'Does not scroll past the fold in most visits',
        'Leaves without clicking any navigation links',
        'May return later from a different device if initially intrigued',
      ],
      frustrations: [
        'No immediate proof of work above the fold',
        'Unclear who ADL serves within the first screen',
        'Mobile layout does not convey studio quality quickly enough',
      ],
      motivations: 'Likely referred by word of mouth, social media, or stumbled onto the site. Has no urgent hiring need but is passively building awareness of design studios. A quick visual hook could convert them into a return visitor.',
      quote: 'I have about 10 seconds on my phone to decide if this is worth bookmarking. I need to immediately see something that impresses me.',
    },
    {
      id: 'persona_2',
      name: 'The Portfolio Researcher',
      archetype: 'Potential Client',
      tagline: 'Actively evaluating design studios and comparing options',
      emoji: '🔍',
      prevalence: 25,
      primaryDevice: 'desktop',
      topLocations: ['United States'],
      primarySource: 'Direct',
      avgDurationSeconds: 90,
      avgPageViews: 2.5,
      typicalEntryPage: '/',
      typicalExitPage: '/work',
      goals: [
        'Evaluate the quality and relevance of ADL\'s past work',
        'Understand what types of projects ADL specialises in',
        'Shortlist studios for a potential engagement',
      ],
      behaviors: [
        'Arrives on desktop, spends time on the homepage before navigating to /work',
        'Scans the portfolio page quickly (avg 66s) looking for relevant project types',
        'Occasionally visits /services to get a sense of scope and process',
        'Frequently exits from /work without converting — not yet convinced',
      ],
      frustrations: [
        'Portfolio lacks outcome-focused context (no metrics or results shown)',
        'Hard to filter or find work relevant to their specific industry',
        'No social proof or client names to validate credibility',
      ],
      motivations: 'In active search mode for a design partner for an upcoming project. Comparing ADL against 3-5 other studios. Quality signals and industry relevance are the deciding factors — they want to know if ADL has done something like their project before.',
      quote: 'I need to see if you have done this kind of work before. Show me the results, not just the visuals.',
    },
    {
      id: 'persona_3',
      name: 'The Frustrated Closer',
      archetype: 'High-Intent Prospect',
      tagline: 'Ready to reach out but hitting friction at the last moment',
      emoji: '😤',
      prevalence: 10,
      primaryDevice: 'desktop',
      topLocations: ['United States'],
      primarySource: 'Direct',
      avgDurationSeconds: 180,
      avgPageViews: 4.0,
      typicalEntryPage: '/',
      typicalExitPage: '/contact',
      goals: [
        'Confirm ADL is the right studio to contact',
        'Find the easiest way to start a conversation',
        'Get a sense of what happens after they reach out',
      ],
      behaviors: [
        'Completes the full journey: homepage → work → services → contact',
        'Spends the longest time of any persona on the site',
        'Reaches the contact page but hesitates — 5.5 exit intents per session on average',
        'May abandon and come back another time, or seek an alternative contact method',
      ],
      frustrations: [
        'No response time expectation on the contact page',
        'Form feels high-commitment with no lightweight option to just ask a quick question',
        'No alternative contact method (email, phone, LinkedIn) visible',
      ],
      motivations: 'Has done their research and chosen ADL as a top candidate. Now they need reassurance that reaching out is worth their time — a clear response promise and a low-friction contact option would convert them. The high exit intent on the contact page is a solvable problem.',
      quote: 'I have already decided I like your work. I just want to know what happens when I submit this form and how long until I hear back.',
    },
  ],
  summary: 'The ADL Website audience splits sharply into three groups: a large mobile-first casual audience that never engages deeply (65%), a smaller desktop segment actively researching studios who need stronger portfolio proof (25%), and a tiny but high-value group of motivated prospects who reach the contact page but abandon due to friction (10%). Fixing the contact page experience and adding outcome-focused work examples would have the highest impact on conversion.',
};

// ─── Portfolio Website ───────────────────────────────────────────────────────

const portfolioPersonas = {
  personas: [
    {
      id: 'persona_1',
      name: 'The Active Recruiter',
      archetype: 'Hiring Decision Maker',
      tagline: 'Evaluating Pritish for a role or project and going deep to make sure',
      emoji: '🎯',
      prevalence: 30,
      primaryDevice: 'desktop',
      topLocations: ['United States', 'United Kingdom'],
      primarySource: 'Direct',
      avgDurationSeconds: 600,
      avgPageViews: 8.0,
      typicalEntryPage: '/',
      typicalExitPage: '/work/hands-ai',
      goals: [
        'Thoroughly evaluate design thinking and process quality',
        'Confirm experience and skills match an open role or project need',
        'Collect supporting material (resume, case studies) to share with the team',
      ],
      behaviors: [
        'Enters on desktop and methodically navigates through the site',
        'Spends significant time on case studies — often 5–30 minutes per page',
        'Downloads the resume PDF as supporting evidence',
        'Checks /about-me to understand background and experience trajectory',
        'Exits from a case study page rather than reaching /contact',
      ],
      frustrations: [
        'No contact CTA at the end of case studies — has to go find it separately',
        'No availability status visible anywhere on the site',
        'Cannot tell from the homepage alone whether the work is relevant without clicking in',
      ],
      motivations: 'Actively hiring or sourcing for a design role or project. Found the portfolio through a referral, LinkedIn, or a shared link. They invest real time because the work genuinely interests them — but the conversion path from interest to contact is broken.',
      quote: 'I read the full Hands AI case study. The thinking is exactly what we need. Now I just need to figure out how to reach out — and if this person is even available.',
    },
    {
      id: 'persona_2',
      name: 'The Design Peer',
      archetype: 'Fellow Designer / Creative',
      tagline: 'Curious about the work and looking for inspiration or comparison',
      emoji: '👁️',
      prevalence: 40,
      primaryDevice: 'desktop',
      topLocations: ['United States', 'Germany'],
      primarySource: 'Direct',
      avgDurationSeconds: 120,
      avgPageViews: 3.0,
      typicalEntryPage: '/',
      typicalExitPage: '/',
      goals: [
        'See how a fellow designer presents and positions their work',
        'Get a sense of the design aesthetic and process style',
        'Find inspiration for their own portfolio or projects',
      ],
      behaviors: [
        'Enters on desktop, browses the homepage and possibly one case study',
        'Scrolls deeper than the casual visitor but rarely reaches /contact',
        'Sometimes checks /about-me to understand the background and specialisation',
        'Leaves without taking any action — the visit is informational, not transactional',
      ],
      frustrations: [
        'Homepage does not immediately show the range or depth of work',
        'Case studies end without a related-work section to continue browsing',
        'No easy way to follow or save for later (no newsletter, no social link prominence)',
      ],
      motivations: 'Not actively hiring but genuinely interested in the work. May share a link with a colleague if something stands out. Might return later if they have a relevant project or role. This audience builds reputation and referrals over time.',
      quote: 'I love seeing how other designers present their AI work. This case study is interesting — I wish I could see more of this type of project.',
    },
    {
      id: 'persona_3',
      name: 'The Quick Browser',
      archetype: 'Passive or Referred Visitor',
      tagline: 'Landed here but did not find an immediate reason to stay',
      emoji: '⚡',
      prevalence: 30,
      primaryDevice: 'desktop',
      topLocations: ['United States', 'Germany'],
      primarySource: 'Direct',
      avgDurationSeconds: 15,
      avgPageViews: 1.0,
      typicalEntryPage: '/',
      typicalExitPage: '/',
      goals: [
        'Get a quick first impression',
        'Decide in seconds whether to invest more time',
      ],
      behaviors: [
        'Arrives, scrolls the homepage briefly, and leaves within 30 seconds',
        'Does not click any navigation links',
        'High exit intent and mouse thrash signals suggest confusion or unmet expectation',
        'Unlikely to return unless something specific brings them back',
      ],
      frustrations: [
        'Homepage does not immediately answer "who is this and what do they do?"',
        'No featured work thumbnail visible without scrolling',
        'The first screen does not provide a strong enough reason to keep reading',
      ],
      motivations: 'Arrived via a shared link or casual discovery. Not actively looking to hire but could have been converted to a longer visit with a stronger first impression. Represents the largest untapped opportunity for homepage optimisation.',
      quote: 'I clicked a link someone shared, but I could not immediately tell what this person specialises in. I moved on.',
    },
  ],
  summary: 'The portfolio audience is almost entirely desktop-based and splits into three groups: a small but high-value group of active recruiters who read case studies deeply and download the resume but never find a path to contact (30%), a larger group of design peers who browse out of curiosity and generate referrals over time (40%), and a third group of quick browsers who bounce from the homepage before discovering the work (30%). The most immediate opportunity is adding a contact CTA at the end of every case study — those visitors are already convinced.',
};

(async () => {
  try {
    // ADL Website
    await sql`DELETE FROM personas WHERE site_id = ${ADL_ID} AND period = ${PERIOD}`;
    const [adlRecord] = await sql`
      INSERT INTO personas (site_id, period, data)
      VALUES (${ADL_ID}, ${PERIOD}, ${JSON.stringify(adlPersonas)})
      RETURNING id, generated_at
    `;
    console.log('ADL Website personas saved:', adlRecord.id);
    console.log('  Personas:', adlPersonas.personas.map(p => `${p.name} (${p.prevalence}%)`).join(', '));

    // Portfolio Website
    await sql`DELETE FROM personas WHERE site_id = ${PORT_ID} AND period = ${PERIOD}`;
    const [portRecord] = await sql`
      INSERT INTO personas (site_id, period, data)
      VALUES (${PORT_ID}, ${PERIOD}, ${JSON.stringify(portfolioPersonas)})
      RETURNING id, generated_at
    `;
    console.log('Portfolio Website personas saved:', portRecord.id);
    console.log('  Personas:', portfolioPersonas.personas.map(p => `${p.name} (${p.prevalence}%)`).join(', '));

    console.log('\nDone.');
  } finally {
    await sql.end();
  }
})();
