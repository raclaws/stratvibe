const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { countTokens, getBudget } = require('./tokens');
const { summarize } = require('./summarizer');
const { isAvailable } = require('./llm');

const VALID_LAYERS = ['spec', 'tasks', 'snippets', 'atomic', 'human'];
const VALID_ROLES = ['planner', 'coordinator', 'implementer', 'resolver', 'summarizer'];
const VALID_STATUSES = ['pending', 'active', 'blocked', 'done', 'failed'];

function generateId() {
  return crypto.randomUUID();
}

function validateLayerContent(content, layer) {
  const errors = [];
  if (!content || typeof content !== 'object') {
    errors.push('Content must be a non-null object');
    return errors;
  }

  const layerFields = {
    spec: ['decision'],
    tasks: ['title'],
    snippets: ['pattern'],
    atomic: ['key', 'value'],
  };

  const required = layerFields[layer];
  if (required) {
    for (const field of required) {
      if (content[field] === undefined) {
        errors.push(`Missing required field "${field}" for layer "${layer}"`);
      }
    }
  }

  return errors;
}

async function produceHandoff({ content, fromLayer, toLayer, role, status = 'pending', confidence = null, flags = [], projectId = null, sprintId = null }) {
  if (!VALID_LAYERS.includes(fromLayer)) {
    throw new Error(`Invalid layer_origin: "${fromLayer}". Must be one of: ${VALID_LAYERS.join(', ')}`);
  }
  if (!VALID_LAYERS.includes(toLayer)) {
    throw new Error(`Invalid layer_target: "${toLayer}". Must be one of: ${VALID_LAYERS.join(', ')}`);
  }
  if (!VALID_ROLES.includes(role)) {
    throw new Error(`Invalid agent_role: "${role}". Must be one of: ${VALID_ROLES.join(', ')}`);
  }
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid status: "${status}". Must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  const contentErrors = validateLayerContent(content, toLayer);
  if (contentErrors.length > 0) {
    throw new Error(`Content validation failed:\n  ${contentErrors.join('\n  ')}`);
  }

  const contentStr = JSON.stringify(content);
  const tokenCount = countTokens(contentStr);
  const budget = getBudget(toLayer);
  let finalContent = content;
  let droppedFields = [];
  let compressionApplied = false;

  if (tokenCount > budget) {
    if (!isAvailable()) {
      throw new Error(`Content exceeds ${toLayer} budget (${tokenCount}/${budget} tokens) and no LLM is configured for compression. Set STRATVIBE_LLM_URL to enable auto-summarization.`);
    }
    const result = await summarize(content, fromLayer, toLayer);
    finalContent = result.compressed;
    droppedFields = result.dropped_fields;
    compressionApplied = true;
  }

  const finalTokens = countTokens(JSON.stringify(finalContent));

  const handoff = {
    handoff: {
      id: generateId(),
      timestamp: new Date().toISOString(),
      layer_origin: fromLayer,
      layer_target: toLayer,
      agent_role: role,
      status,
    },
    context: {
      project_id: projectId || path.basename(process.cwd()),
      sprint_id: sprintId,
      token_budget: budget,
      token_used: finalTokens,
      compression_applied: compressionApplied,
    },
    payload: {
      type: getPayloadType(toLayer),
      ref: null,
      content: finalContent,
      dependencies: [],
      invalidates: [],
    },
    reasoning: {
      confidence: confidence !== null ? confidence : (compressionApplied ? 0.7 : 0.9),
      rationale_ref: null,
      assumptions: [],
      flags: [...flags, ...(compressionApplied ? ['compression_applied'] : [])],
    },
    meta: {
      taxonomy_version: '0.1',
      substrate_version: '0.2.0',
      human_review_required: flags.includes('breaking_change') || flags.includes('needs_review'),
      notes: null,
    },
  };

  if (droppedFields.length > 0) {
    handoff.meta.dropped_fields = droppedFields;
  }

  return handoff;
}

function getPayloadType(layer) {
  const map = { spec: 'decision', tasks: 'task', snippets: 'snippet', atomic: 'lookup', human: 'summary' };
  return map[layer] || 'summary';
}

function writeHandoff(handoff, outputDir) {
  const dir = outputDir || path.join(process.cwd(), '.substrate', 'handoffs');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filename = `handoff-${handoff.handoff.layer_origin}-${handoff.handoff.layer_target}-${Date.now()}.json`;
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, JSON.stringify(handoff, null, 2), 'utf8');

  return filePath;
}

module.exports = { produceHandoff, writeHandoff, validateLayerContent };
