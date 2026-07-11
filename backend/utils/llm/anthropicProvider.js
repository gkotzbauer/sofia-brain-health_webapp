const Anthropic = require('@anthropic-ai/sdk');
const { SOFIA_TURN_TOOL_NAME, SOFIA_TURN_TOOL_DESCRIPTION, SOFIA_TURN_PARAMETERS } = require('./schema');

// No BAA with Anthropic as of this writing -- do not route real PHI-bearing
// traffic here until one is signed. See utils/llm/index.js for the
// provider-selection default (OpenAI).
const REQUIRED_ENV_VAR = 'ANTHROPIC_API_KEY';

// Built once and reused across requests, constructed lazily so a missing
// key doesn't crash the whole server at require-time -- utils/llm/index.js
// already checks isConfigured() before this is ever called.
let client = null;
function getClient() {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 20 * 1000,
      maxRetries: 2
    });
  }
  return client;
}

// systemBlocks: array of {type:'text', text, cache_control?} -- Anthropic
// natively supports this shape for prompt caching (see utils/systemPrompt.js).
async function generateTurn({ systemBlocks, messages }) {
  const completion = await getClient().messages.create({
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5',
    max_tokens: 1024,
    system: systemBlocks,
    messages,
    tools: [{ name: SOFIA_TURN_TOOL_NAME, description: SOFIA_TURN_TOOL_DESCRIPTION, input_schema: SOFIA_TURN_PARAMETERS }],
    tool_choice: { type: 'tool', name: SOFIA_TURN_TOOL_NAME }
  });

  const toolUse = completion.content.find((block) => block.type === 'tool_use');
  if (!toolUse) {
    throw new Error('Anthropic response had no tool_use block');
  }
  return toolUse.input;
}

// A one-off forced-tool-call, distinct from the per-turn conversation loop
// above (generateTurn) -- used by routes/documents.js's /extract endpoint to
// pull candidate profile fields out of an uploaded document. See the
// matching function in openaiProvider.js.
async function generateStructuredExtraction({ systemText, userText, toolName, toolDescription, parameters }) {
  const completion = await getClient().messages.create({
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5',
    max_tokens: 1536,
    system: systemText,
    messages: [{ role: 'user', content: userText }],
    tools: [{ name: toolName, description: toolDescription, input_schema: parameters }],
    tool_choice: { type: 'tool', name: toolName }
  });

  const toolUse = completion.content.find((block) => block.type === 'tool_use');
  if (!toolUse) {
    throw new Error('Anthropic response had no tool_use block');
  }
  return toolUse.input;
}

module.exports = { generateTurn, generateStructuredExtraction, REQUIRED_ENV_VAR };
