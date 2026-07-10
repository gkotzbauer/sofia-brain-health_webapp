const OpenAI = require('openai');
const { SOFIA_TURN_TOOL_NAME, SOFIA_TURN_TOOL_DESCRIPTION, SOFIA_TURN_PARAMETERS } = require('./schema');

// Default provider (see utils/llm/index.js) -- there is a signed BAA
// covering OpenAI API usage, so PHI-bearing chat traffic should go here
// unless explicitly switched.
const REQUIRED_ENV_VAR = 'OPENAI_API_KEY';

// Built once and reused across requests, constructed lazily so a missing
// key doesn't crash the whole server at require-time -- utils/llm/index.js
// already checks isConfigured() before this is ever called.
let client = null;
function getClient() {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 20 * 1000,
      maxRetries: 2
    });
  }
  return client;
}

// systemBlocks: array of {type:'text', text, cache_control?}. OpenAI has no
// manual cache_control markup -- it applies automatic prefix caching itself
// for prompts over ~1024 tokens, so the blocks are just concatenated into
// one system message and any cache_control flag is ignored.
async function generateTurn({ systemBlocks, messages }) {
  const systemText = systemBlocks.map((block) => block.text).join('\n\n');

  const completion = await getClient().chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    messages: [{ role: 'system', content: systemText }, ...messages],
    tools: [
      {
        type: 'function',
        function: { name: SOFIA_TURN_TOOL_NAME, description: SOFIA_TURN_TOOL_DESCRIPTION, parameters: SOFIA_TURN_PARAMETERS }
      }
    ],
    tool_choice: { type: 'function', function: { name: SOFIA_TURN_TOOL_NAME } }
  });

  const toolCall = completion.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    throw new Error('OpenAI response had no tool call');
  }

  try {
    return JSON.parse(toolCall.function.arguments);
  } catch (parseError) {
    throw new Error('OpenAI tool call arguments were not valid JSON: ' + parseError.message);
  }
}

module.exports = { generateTurn, REQUIRED_ENV_VAR };
