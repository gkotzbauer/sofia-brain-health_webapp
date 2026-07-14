const { encryptJSON, decryptJSON } = require('./phiCrypto');

// The Lancet Commission's 2024 update (Livingston et al., Dementia
// prevention, intervention, and care: 2024 report of the Lancet
// Commission) identified 14 modifiable risk factors across the life
// course that together account for roughly 45% of dementia cases
// worldwide. Sofia's tiered education (see utils/systemPrompt.js) was
// previously entirely conversation-driven -- whatever the person happened
// to bring up -- with no mechanism ensuring even, evidence-based coverage
// over a relationship. This module gives the system prompt a reference
// list to draw from and a durable, per-user record of which domains have
// already been substantively covered, so coverage compounds across
// sessions instead of depending on what the person thinks to ask about.
//
// This is deliberately NOT a checklist Sofia works through -- see the
// system prompt's framing. It only tracks which domains have already come
// up, so a returning conversation doesn't start from zero every time.
const RISK_DOMAINS = [
  { key: 'education', lifeStage: 'Early life', label: 'Lifelong learning', note: 'building and maintaining cognitive reserve through learning, at any age' },
  { key: 'hearing_loss', lifeStage: 'Midlife', label: 'Hearing health', note: 'treating hearing loss (hearing aids, checkups) -- one of the most under-recognized, high-impact steps' },
  { key: 'ldl_cholesterol', lifeStage: 'Midlife', label: 'Cholesterol', note: 'managing high LDL cholesterol as part of overall cardiovascular health' },
  { key: 'depression', lifeStage: 'Midlife / later life', label: 'Mood and depression', note: 'treating depression, which affects both quality of life and brain health' },
  { key: 'traumatic_brain_injury', lifeStage: 'Midlife', label: 'Head injury prevention', note: 'protecting against head injury (falls, sports, driving safety)' },
  { key: 'physical_inactivity', lifeStage: 'Midlife', label: 'Physical activity', note: 'staying physically active in whatever way fits their life' },
  { key: 'diabetes', lifeStage: 'Midlife', label: 'Diabetes management', note: 'managing diabetes/blood sugar' },
  { key: 'smoking', lifeStage: 'Midlife', label: 'Smoking', note: 'reducing or quitting smoking' },
  { key: 'hypertension', lifeStage: 'Midlife', label: 'Blood pressure', note: 'managing high blood pressure' },
  { key: 'obesity', lifeStage: 'Midlife', label: 'Weight and metabolic health', note: 'maintaining a healthy weight, discussed without judgment or fear' },
  { key: 'alcohol', lifeStage: 'Midlife', label: 'Alcohol use', note: 'reducing excessive alcohol consumption' },
  { key: 'social_isolation', lifeStage: 'Later life', label: 'Social connection', note: 'staying socially connected -- one of the most protective, actionable factors' },
  { key: 'air_pollution', lifeStage: 'Later life', label: 'Air quality', note: 'reducing exposure to air pollution where practical' },
  { key: 'vision_loss', lifeStage: 'Later life', label: 'Vision health', note: 'treating untreated vision loss (checkups, glasses, cataract care) -- like hearing, a highly actionable and under-treated factor' }
];

const RISK_DOMAIN_KEYS = RISK_DOMAINS.map((domain) => domain.key);

function isValidDomainKey(key) {
  return RISK_DOMAIN_KEYS.includes(key);
}

// Renders the static reference block for the system prompt's tiered
// education section -- grouped by life stage, one line each, framed
// plainly and never alarmingly (matching the Lancet Commission's own
// communication guidance: prevention is possible at any age, this is not
// a diagnosis or a verdict).
function formatRiskDomainsReference() {
  const byStage = RISK_DOMAINS.reduce((groups, domain) => {
    (groups[domain.lifeStage] = groups[domain.lifeStage] || []).push(domain);
    return groups;
  }, {});

  return Object.entries(byStage)
    .map(([stage, domains]) => `${stage}: ${domains.map((d) => `${d.label} [key: ${d.key}] (${d.note})`).join('; ')}.`)
    .join('\n');
}

// Renders which of these domains this person has already substantively
// explored with Sofia, for the per-user dynamic section of the prompt.
function formatDomainsCovered(riskDomainsCovered) {
  if (!riskDomainsCovered || riskDomainsCovered.length === 0) {
    return 'none yet -- look for natural openings to introduce one, starting wherever fits the conversation.';
  }
  const labels = riskDomainsCovered
    .map((key) => RISK_DOMAINS.find((d) => d.key === key)?.label)
    .filter(Boolean);
  const uncoveredCount = RISK_DOMAINS.length - labels.length;
  return `${labels.join(', ')}${uncoveredCount > 0 ? ` (${uncoveredCount} domain${uncoveredCount === 1 ? '' : 's'} not yet explored)` : ' (all domains explored at least once)'}.`;
}

// Best-effort, append-only record that this person has now had a
// substantive education moment on `domainKey`. Deliberately not routed
// through the proposed_*/pendingConfirmation human-confirmation pattern
// used for goals/values/concerns -- this tracks what Sofia has taught,
// not a claim about the person, so there's nothing for them to review or
// approve. Mirrors utils/conversationTurnLog.js's non-fatal-on-failure
// pattern: a tracking write must never break the turn it's attached to.
async function recordDomainCovered(pool, logger, userId, domainKey) {
  if (!isValidDomainKey(domainKey)) return;

  try {
    const current = await pool.query('SELECT risk_domains_covered FROM about_me_profiles WHERE user_id = $1', [userId]);
    const existing = decryptJSON(current.rows[0]?.risk_domains_covered) || [];
    if (existing.includes(domainKey)) return;

    await pool.query('UPDATE about_me_profiles SET risk_domains_covered = $1 WHERE user_id = $2', [
      encryptJSON([...existing, domainKey]),
      userId
    ]);
  } catch (error) {
    logger?.error('Failed to record risk domain coverage (non-fatal):', error);
  }
}

module.exports = { RISK_DOMAINS, RISK_DOMAIN_KEYS, isValidDomainKey, formatRiskDomainsReference, formatDomainsCovered, recordDomainCovered };
