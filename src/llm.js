const { countTokens } = require('./tokens');

const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-20250514';

function getConfig() {
  const url = process.env.STRATVIBE_LLM_URL;
  const key = process.env.STRATVIBE_LLM_KEY;
  const model = process.env.STRATVIBE_LLM_MODEL || DEFAULT_MODEL;

  if (!url) return null;
  return { url, key, model };
}

function isAvailable() {
  return !!process.env.STRATVIBE_LLM_URL;
}

async function chatCompletion({ system, messages, maxTokens = 4096, temperature = 0.3 }) {
  const config = getConfig();
  if (!config) {
    throw new Error('STRATVIBE_LLM_URL not set. Cannot call LLM.');
  }

  const endpoint = config.url.replace(/\/$/, '') + '/chat/completions';

  const headers = {
    'Content-Type': 'application/json',
  };
  if (config.key) {
    headers['Authorization'] = `Bearer ${config.key}`;
  }

  const body = {
    model: config.model,
    messages: [],
    max_tokens: maxTokens,
    temperature,
  };

  if (system) {
    body.messages.push({ role: 'system', content: system });
  }
  body.messages.push(...messages);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`LLM request failed (${response.status}): ${text.slice(0, 200)}`);
  }

  const data = await response.json();

  if (!data.choices || !data.choices[0]) {
    throw new Error('LLM returned no choices');
  }

  const content = data.choices[0].message?.content || '';

  return {
    content,
    usage: data.usage || null,
    model: data.model || config.model,
  };
}

async function chatCompletionJSON({ system, messages, maxTokens = 4096, temperature = 0.2 }) {
  const result = await chatCompletion({ system, messages, maxTokens, temperature });

  let parsed;
  try {
    const jsonMatch = result.content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const raw = jsonMatch ? jsonMatch[1].trim() : result.content.trim();
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`LLM response is not valid JSON: ${e.message}\nRaw: ${result.content.slice(0, 300)}`);
  }

  return {
    data: parsed,
    usage: result.usage,
    model: result.model,
  };
}

module.exports = { getConfig, isAvailable, chatCompletion, chatCompletionJSON };
