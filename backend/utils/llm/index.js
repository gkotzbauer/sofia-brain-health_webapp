const anthropicProvider = require('./anthropicProvider');
const openaiProvider = require('./openaiProvider');

// OpenAI is the default: there's a signed BAA covering OpenAI API usage but
// not yet one with Anthropic, so PHI-bearing chat traffic must not go to
// Claude by default. Set LLM_PROVIDER=anthropic to switch once a BAA with
// Anthropic is in place -- everything else about the conversation engine
// (system prompt, safety pipeline, context cap, fallback handling) is
// unaffected by which provider is selected.
const PROVIDERS = { openai: openaiProvider, anthropic: anthropicProvider };
const DEFAULT_PROVIDER = 'openai';

function getProviderName() {
  return (process.env.LLM_PROVIDER || DEFAULT_PROVIDER).toLowerCase();
}

function getProvider() {
  const name = getProviderName();
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new Error(`Unknown LLM_PROVIDER "${name}" -- expected "openai" or "anthropic"`);
  }
  return provider;
}

function missingEnvVar() {
  return getProvider().REQUIRED_ENV_VAR;
}

function isConfigured() {
  return Boolean(process.env[missingEnvVar()]);
}

module.exports = { getProvider, getProviderName, isConfigured, missingEnvVar };
