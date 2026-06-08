let encoder = null;

function getEncoder() {
  if (encoder) return encoder;
  try {
    const { encoding_for_model } = require('tiktoken');
    encoder = encoding_for_model('gpt-4');
  } catch {
    encoder = null;
  }
  return encoder;
}

function countTokens(text) {
  if (!text) return 0;
  const enc = getEncoder();
  if (enc) {
    return enc.encode(text).length;
  }
  return Math.ceil(text.length / 4);
}

const LAYER_BUDGETS = {
  spec: 4096,
  tasks: 2048,
  snippets: 1024,
  atomic: 512,
};

function getBudget(layer) {
  return LAYER_BUDGETS[layer] || 2048;
}

function isOverBudget(text, layer) {
  return countTokens(text) > getBudget(layer);
}

module.exports = { countTokens, getBudget, isOverBudget, LAYER_BUDGETS };
