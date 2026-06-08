const { chatCompletionJSON } = require('./llm');
const { countTokens, getBudget } = require('./tokens');

const COMPRESS_SYSTEM = `You are the Summarizer role in a structured agent pipeline.

Your job: compress content from one layer's token budget to fit the next layer's budget.
You MUST output valid JSON with exactly two fields:
- "compressed": the compressed content object (only schema-valid fields for the target layer)
- "dropped_fields": array of strings describing what was removed and why

Rules:
- Output must be smaller than input (measured in tokens)
- Never add information not present in the input
- Never interpret ambiguity — flag it in dropped_fields instead
- Strip in priority order: notes, rationale_ref, assumptions, dependencies
- NEVER drop: decision, status, flags, confidence

Output only the JSON object. No markdown fences, no explanation.`;

function buildCompressPrompt(content, sourceLayer, targetLayer, targetBudget) {
  return `Compress the following content from the "${sourceLayer}" layer (budget: ${getBudget(sourceLayer)} tokens) to fit the "${targetLayer}" layer (budget: ${targetBudget} tokens).

Current token count: ${countTokens(JSON.stringify(content))}
Target budget: ${targetBudget} tokens

Input content:
${JSON.stringify(content, null, 2)}

Output the compressed JSON with "compressed" and "dropped_fields" fields.`;
}

async function summarize(content, sourceLayer, targetLayer) {
  const targetBudget = getBudget(targetLayer);
  const inputStr = JSON.stringify(content);
  const inputTokens = countTokens(inputStr);

  if (inputTokens <= targetBudget) {
    return {
      compressed: content,
      dropped_fields: [],
      meta: { input_tokens: inputTokens, output_tokens: inputTokens, compression_applied: false }
    };
  }

  const prompt = buildCompressPrompt(content, sourceLayer, targetLayer, targetBudget);

  const result = await chatCompletionJSON({
    system: COMPRESS_SYSTEM,
    messages: [{ role: 'user', content: prompt }],
    maxTokens: targetBudget + 512,
    temperature: 0.1,
  });

  const { compressed, dropped_fields } = result.data;

  if (!compressed) {
    throw new Error('Summarizer returned no "compressed" field');
  }

  const outputTokens = countTokens(JSON.stringify(compressed));

  if (outputTokens > inputTokens) {
    throw new Error(`Summarizer output (${outputTokens}) is larger than input (${inputTokens}). Compression failed.`);
  }

  const stillOver = outputTokens > targetBudget;

  return {
    compressed,
    dropped_fields: dropped_fields || [],
    meta: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      target_budget: targetBudget,
      compression_applied: true,
      still_over_budget: stillOver,
    }
  };
}

module.exports = { summarize };
