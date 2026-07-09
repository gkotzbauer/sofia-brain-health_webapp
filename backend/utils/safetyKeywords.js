// Server-side safety pre-filter. Ported verbatim (keyword lists + severity
// mapping) from the client-side safetyMonitoring config that used to live,
// disconnected from any real backend action, in frontend/index.html.
// This is a defense-in-depth layer: it runs independently of the LLM's own
// safety_assessment so a single point of failure in either can't silently
// miss a crisis message (see backend/routes/chat.js, which ORs the two).
const SAFETY_KEYWORDS = {
  emergency: {
    severity: 'critical',
    keywords: [
      'suicide', 'kill myself', 'end my life', 'hurt myself', 'harm myself',
      'emergency', 'chest pain', "can't breathe", 'cant breathe', 'bleeding',
      'collapsed', 'unconscious', 'seizure', 'stroke', 'heart attack',
      'help me', 'dying', '911', '999', 'ambulance'
    ]
  },
  distress: {
    severity: 'high',
    keywords: [
      'hopeless', 'helpless', 'overwhelmed', 'desperate', 'miserable',
      'unbearable', 'terrible', "can't cope", 'cant cope', 'give up',
      'too much', 'lost', 'alone', 'lonely', 'abandoned', 'scared',
      'frightened', 'terrified', 'worthless', 'burden'
    ]
  },
  frustration: {
    severity: 'moderate',
    keywords: [
      'frustrated', 'annoying', 'useless', 'stupid', 'waste of time',
      'not helpful', "doesn't work", 'doesnt work', "doesn't understand",
      'doesnt understand', 'not understanding', 'pointless', 'going in circles',
      'talking to a wall', 'not getting anywhere', 'ridiculous', 'tired of this',
      'fed up', 'unhelpful', 'confused', "this isn't working", 'this isnt working',
      "can't help", 'cant help', 'stop', 'quit', 'end this'
    ]
  },
  repetition: {
    severity: 'moderate',
    keywords: [
      'i already said', 'i told you', 'as i said', 'like i said',
      'i mentioned', 'i just told you', 'again', 'repeating myself',
      'said earlier', 'keep saying', 'once more', 'one more time'
    ]
  },
  inclusion: {
    severity: 'high',
    keywords: [
      'racist', 'sexist', 'discrimination', 'biased', 'unfair',
      'prejudice', 'stereotype', 'offensive', 'inappropriate',
      'disrespectful', 'insensitive'
    ]
  }
};

const SEVERITY_RANK = { low: 1, moderate: 2, high: 3, critical: 4 };

function extractContext(text, keyword, windowSize = 50) {
  const lowerText = text.toLowerCase();
  const keywordIndex = lowerText.indexOf(keyword.toLowerCase());
  if (keywordIndex === -1) return text;

  const start = Math.max(0, keywordIndex - windowSize);
  const end = Math.min(text.length, keywordIndex + keyword.length + windowSize);

  return '...' + text.slice(start, end) + '...';
}

function detectSafetyTriggers(message) {
  const lowerMessage = message.toLowerCase();
  const triggers = [];

  for (const [type, { severity, keywords }] of Object.entries(SAFETY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword)) {
        triggers.push({ type, severity, keyword, context: extractContext(message, keyword) });
      }
    }
  }

  return triggers;
}

function mostSevereTrigger(triggers) {
  if (!triggers || triggers.length === 0) return null;
  return triggers.reduce((worst, trigger) =>
    SEVERITY_RANK[trigger.severity] > SEVERITY_RANK[worst.severity] ? trigger : worst
  );
}

function severityAtLeast(severity, threshold) {
  return (SEVERITY_RANK[severity] || 0) >= (SEVERITY_RANK[threshold] || Infinity);
}

module.exports = { SAFETY_KEYWORDS, SEVERITY_RANK, detectSafetyTriggers, mostSevereTrigger, extractContext, severityAtLeast };
