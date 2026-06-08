#!/usr/bin/env node

/**
 * stratvibe CLI - KISS substrate for LLM agent pipelines
 * One command. One job. No questions asked.
 */

const fs = require('fs');
const path = require('path');

// ANSI colors for minimal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  red: '\x1b[31m'
};

// Token counting - uses tiktoken if available, falls back to rough estimate
function countTokens(text) {
  // Rough estimate: ~4 chars per token
  return Math.ceil(text.length / 4);
}

// Static template content (verbatim from our design)
const TEMPLATES = {
  '.substrate/taxonomy.md': `# Taxonomy v0.1

## Principles
- Structure is stable, semantics are project-specific
- Context budget reflects information density, not importance
- Natural language is human-facing only
- Handoffs are structured, typed, explicit

## Layers

### spec/ (2048-4096 tokens)
**Purpose:** Intent and constraints, not implementation
**Contains:** What the system is, why decisions were made
**Invariants:**
- architecture/ = system boundaries and rationale
- api/ = contracts between components
- components/ = behavioral definitions, not code
**Handoff type:** JSON with explicit decision fields
**Agent role:** Planner

### tasks/ (1024-2048 tokens)
**Purpose:** Bounded units of work with clear completion state
**Contains:** What needs to happen, in what order
**Invariants:**
- sprint*/ = time-bounded, sequenced
- backlog/ = unsequenced, unprioritized candidates
**Handoff type:** JSON with status enum
**Agent role:** Coordinator
**Status enum:** [pending, active, blocked, done]

### snippets/ (512-1024 tokens)
**Purpose:** Reusable implementations with known behavior
**Contains:** Code patterns, not business logic
**Invariants:**
- components/ = UI or functional units
- hooks/ = stateful behavior patterns
- utilities/ = pure functions, no side effects
**Handoff type:** JSON with dependency fields
**Agent role:** Implementer

### atomic/ (256-512 tokens)
**Purpose:** Lookup, not reasoning
**Contains:** Values, not logic
**Invariants:**
- errors/ = typed, coded, no ambiguity
- configs/ = environment-bounded values
- env-vars/ = external dependencies declaration
**Handoff type:** Direct reference, no summarization needed
**Agent role:** Resolver

## Handoff Protocol
- Layer N output → summarizer → Layer N+1 input
- Summarizer strips to schema fields only
- No natural language between layers
- Natural language only at human interface layer

## Invariant Rules
1. Components in spec/ = contracts
2. Components in snippets/ = implementations
3. Same term at different layers = different abstraction, must be prefixed if referenced cross-layer
4. Junk drawer folders forbidden - if it doesn't fit, taxonomy needs updating not a new misc/ folder
5. Token budgets are ceilings, not targets

**The last rule is important** - junk drawers are where taxonomies die.`,

  '.substrate/schema.json': `{
 "$schema": ".substrate/schema.json",
 "$version": "0.1.0",

 "handoff": {
 "id": "string | uuid",
 "timestamp": "string | iso8601",
 "layer_origin": "enum | spec | tasks | snippets | atomic",
 "layer_target": "enum | spec | tasks | snippets | atomic | human",
 "agent_role": "enum | planner | coordinator | implementer | resolver | summarizer",
 "status": "enum | pending | active | blocked | done | failed"
 },

 "context": {
 "project_id": "string",
 "sprint_id": "string | null",
 "token_budget": "integer",
 "token_used": "integer",
 "compression_applied": "boolean"
 },

 "payload": {
 "type": "enum | decision | task | snippet | lookup | summary",
 "ref": "string | filepath",
 "content": "object | layer-specific schema below",
 "dependencies": ["string | filepath"],
 "invalidates": ["string | filepath | null"]
 },

 "reasoning": {
 "confidence": "float | 0.0-1.0",
 "rationale_ref": "string | filepath | null",
 "assumptions": ["string"],
 "flags": ["enum | needs_review | uncertain | blocking | breaking_change"]
 },

 "layer_schemas": {

 "spec": {
 "decision": "string",
 "constraints": ["string"],
 "rationale": "string | filepath",
 "affects": ["string | component_id"]
 },

 "tasks": {
 "title": "string",
 "acceptance_criteria": ["string"],
 "blocked_by": ["string | task_id | null"],
 "sprint": "string | null",
 "effort": "enum | small | medium | large"
 },

 "snippets": {
 "pattern": "string",
 "inputs": ["string | typed"],
 "outputs": ["string | typed"],
 "side_effects": "boolean",
 "tested": "boolean"
 },

 "atomic": {
 "key": "string",
 "value": "string | number | boolean",
 "environment": "enum | dev | staging | prod | all",
 "sensitive": "boolean"
 }

 },

 "meta": {
 "taxonomy_version": "string",
 "substrate_version": "string",
 "human_review_required": "boolean",
 "notes": "string | null"
 }

}`,

  '.substrate/agent-roles.md': `# Agent Roles v0.1

## Principles
- Each role has one responsibility
- Roles do not reason outside their layer
- No role has full system visibility
- Human is always the terminal role

## Roles

### Planner
**Layer:** spec/
**Token budget:** 2048-4096
**Receives from:** Human | Summarizer
**Sends to:** Summarizer → Coordinator
**Responsibility:** Intent to structure
**Can:**
- Define system boundaries
- Make architectural decisions
- Define component contracts
- Flag breaking changes
**Cannot:**
- Write implementation
- Assign tasks
- Access atomic layer directly
- Resolve ambiguity without flagging

### Coordinator
**Layer:** tasks/
**Token budget:** 1024-2048
**Receives from:** Summarizer ← Planner
**Sends to:** Summarizer → Implementer
**Responsibility:** Structure to bounded work units
**Can:**
- Break decisions into tasks
- Sequence and prioritize
- Assign sprint membership
- Flag blockers
**Cannot:**
- Make architectural decisions
- Write code
- Modify spec layer
- Merge or close tasks unilaterally

### Implementer
**Layer:** snippets/
**Token budget:** 512-1024
**Receives from:** Summarizer ← Coordinator
**Sends to:** Summarizer → Resolver | Human
**Responsibility:** Task to reusable implementation
**Can:**
- Write code patterns
- Reference atomic layer for lookups
- Flag untested outputs
- Declare dependencies
**Cannot:**
- Make architectural decisions
- Create new tasks
- Modify configs directly
- Assume environment values

### Resolver
**Layer:** atomic/
**Token budget:** 256-512
**Receives from:** Implementer | Coordinator
**Sends to:** Implementer | Human
**Responsibility:** Lookup only, no reasoning
**Can:**
- Return typed values
- Flag missing keys
- Flag environment mismatches
- Flag sensitive values
**Cannot:**
- Infer missing values
- Modify configs
- Reason about implementation
- Access spec or tasks layer

### Summarizer
**Layer:** between all layers
**Token budget:** 512 max output
**Receives from:** Any role
**Sends to:** Any role
**Responsibility:** Compression and noise removal
**Can:**
- Strip to schema fields only
- Reduce token count
- Flag information loss
- Enforce handoff protocol
**Cannot:**
- Add information not in input
- Interpret ambiguity
- Make decisions
- Pass natural language between agents

### Human
**Layer:** terminal
**Token budget:** unlimited
**Receives from:** Any role via Summarizer
**Sends to:** Planner | any role directly
**Responsibility:** Judgment, trust, continuous learning
**Can:**
- Override any decision
- Redefine taxonomy
- Approve flagged outputs
- Inject context at any layer
**Cannot:**
- Be removed from the pipeline
- Be approximated by another agent
- Delegate trust boundary decisions`,

  '.substrate/context-budgets.md': `# Context Budgets v0.1

## Layer Token Ceilings
| Layer | Max Tokens | Purpose |
|-------|------------|---------|
| **spec/** | 4096 | Architectural decisions, system boundaries |
| **tasks/** | 2048 | Bounded work units, acceptance criteria |
| **snippets/** | 1024 | Reusable code patterns, implementations |
| **atomic/** | 512 | Lookup values only, no reasoning |

## Budget Enforcement Rules
1. **Ceilings, not targets** - Efficiency is rewarded
2. **Summarizer must reduce** - Output always smaller than input
3. **Human review on overflow** - Any layer exceeding its budget triggers review
4. **Progressive compression** - 4096 → 2048 → 1024 → 512 enforced between layers

## Token Counting Method
- Primary: Target model's tokenizer
- Fallback: cl100k_base (GPT-4 tokenizer)
- Rough estimate beats wrong precision
- Revisit when real budget violations occur

## Compression Priority (Summarizer)
When hitting token limits, drop in order:
1. notes (optional commentary)
2. rationale_ref (reference to full rationale)
3. assumptions (contextual assumptions)
4. dependencies (cross-references)

**Never drop:** decision, status, flags, confidence`,

  '.substrate/substrate-summary.md': `# Substrate v0.1 - Meta Summary

## What This Is
A project-agnostic cognitive substrate for LLM agent pipelines.
Structure is stable. Semantics are project-specific. Process is explicit.

## Core Principles
- Natural language is human-facing only
- Structured handoffs (JSON) between all agents
- Context is designed, not assumed
- Human is non-optional in the pipeline
- Information loss is visible, never silent

## Layers
| Layer | Budget | Role | Purpose |
|-----------|---------------|-------------|----------------------------|
| spec/ | 2048-4096 | Planner | Intent to structure |
| tasks/ | 1024-2048 | Coordinator | Structure to work units |
| snippets/ | 512-1024 | Implementer | Task to implementation |
| atomic/ | 256-512 | Resolver | Lookup only, no reasoning |

## Flow
Human → Planner → Summarizer → Coordinator → Summarizer → Implementer ↔ Resolver → Summarizer → Human

## Hard Constraints
1. No natural language between agents
2. No role reasons outside its layer
3. Resolver never infers
4. Summarizer output always smaller than input
5. Breaking changes always return to Human
6. Junk drawer folders forbidden
7. Human cannot be removed from pipeline

## LLM Operational Notes
- You are a frozen approximation operating within defined context boundaries
- Confidence is a float, not a feeling
- When uncertain, set flag - do not infer
- Token budget is a ceiling, not a target
- If input doesn't fit schema, reject and flag - do not reinterpret`,

  '.substrate/connect.md': `# Stratvibe Connect: Generate AGENTS.md

You are the Lead Architect.

## Inputs
1. **Uploaded File**: plan.md (The human intent, stack, and structure)
2. **This Prompt**: The instructions for generating AGENTS.md

## Task
Generate a AGENTS.md file that serves as the developer manual for this specific project.
Note: Do not include Substrate protocol rules like handoffs or token limits. They belong in .substrate/.

## AGENTS.md Structure
1. **Project Context**: Summary stack and North Star goals
2. **Architecture**: ASCII file tree and module responsibilities
3. **Development Standards**: Naming conventions linting testing commands and commit styles
4. **Sprint Status**: What tasks are active blocked or done

## Output
Output only the AGENTS.md markdown content No conversational filler`,

  '.substrate/sprint-log.md': `# Sprint Log v0.1

## Invariants
- Append-only, never edit existing rows
- Timestamp is ISO8601 UTC
- Event must be from valid enum
- Role must match agent-roles.md
- One row per event, no batching

## Events
chain_start | role_complete | summarize | gate_pass | gate_fail | human_intervention | sprint_complete | error

## Log

| timestamp | event | role | detail |
|-----------|-------|------|--------|`
};

// Layer directories with their invariants (from taxonomy)
const LAYER_STRUCTURE = {
  'spec': ['architecture', 'api', 'components'],
  'tasks': ['sprint1', 'backlog'],
  'snippets': ['components', 'hooks', 'utilities'],
  'atomic': ['errors', 'configs', 'env-vars']
};

/**
 * Create directory if it doesn't exist
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    return true;
  }
  return false;
}

/**
 * Write file if it doesn't exist (no overwrites)
 */
function writeIfNotExists(filePath, content) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

/**
 * Initialize substrate v0.1
 */
function initCommand() {
  const args = process.argv.slice(3);
  const deep = args.includes('--deep');

  console.log(`${colors.blue}stratvibe init${colors.reset}`);
  console.log(`${colors.gray}One command. One job. No questions asked.${colors.reset}\n`);

  let createdCount = 0;
  let skippedCount = 0;

  // Create .substrate/ directory first
  if (ensureDir('.substrate')) {
    console.log(`${colors.green}✓${colors.reset} Created .substrate/`);
    createdCount++;
  }

  // Write meta templates
  Object.entries(TEMPLATES).forEach(([filePath, content]) => {
    const fullPath = path.join(process.cwd(), filePath);
    const dir = path.dirname(fullPath);

    ensureDir(dir);

    if (writeIfNotExists(fullPath, content)) {
      console.log(`${colors.green}✓${colors.reset} Written ${filePath}`);
      createdCount++;
    } else {
      console.log(`${colors.yellow}⚠${colors.reset} Skipped ${filePath} (already exists)`);
      skippedCount++;
    }
  });

  // Create layer directories with invariants
  Object.entries(LAYER_STRUCTURE).forEach(([layer, invariants]) => {
    const layerPath = path.join(process.cwd(), layer);

    if (ensureDir(layerPath)) {
      console.log(`${colors.green}✓${colors.reset} Created ${layer}/`);
      createdCount++;
    }

    // Create invariant subdirectories
    invariants.forEach(invariant => {
      const invariantPath = path.join(layerPath, invariant);
      if (ensureDir(invariantPath)) {
        console.log(`${colors.green}✓${colors.reset} Created ${layer}/${invariant}/`);
        createdCount++;
      }
    });
  });

  // Scaffold sprint-log.md into sprint directories
  ['sprint1', 'sprint2'].forEach(sprint => {
    const sprintDir = path.join(process.cwd(), 'tasks', sprint);
    ensureDir(sprintDir);
    const sprintLogPath = path.join(sprintDir, 'sprint-log.md');
    const sprintLogContent = TEMPLATES['.substrate/sprint-log.md'];
    if (writeIfNotExists(sprintLogPath, sprintLogContent)) {
      console.log(`${colors.green}✓${colors.reset} Written tasks/${sprint}/sprint-log.md`);
      createdCount++;
    }
  });

  // Summary
  console.log(`\n${colors.green}Substrate v0.2 ready.${colors.reset}`);
  // Copy plan.template.md -> plan.md
  const planSrc = path.join(__dirname, '..', 'plan.template.md');
  const planDest = path.join(process.cwd(), 'plan.md');
  if (!fs.existsSync(planDest)) {
    const templateExists = fs.existsSync(planSrc);
    if (templateExists) {
      fs.copyFileSync(planSrc, planDest);
    } else {
      fs.writeFileSync(planDest, '# [Project Name] — Technical Plan\n\n');
    }
    console.log(`${colors.green}✓${colors.reset} Written plan.md`);
    createdCount++;
  }

  console.log(`${colors.gray}Created: ${createdCount} items, Skipped: ${skippedCount} existing${colors.reset}`);

  if (skippedCount > 0) {
    console.log(`\n${colors.yellow}Note: Some files/directories already existed.${colors.reset}`);
  }

  // Inference phase
  const { isAvailable } = require('./llm');

  if (deep) {
    console.log(`\n${colors.blue}[--deep] Running genealogy first...${colors.reset}`);
    try {
      genealogyCommand();
    } catch (e) {
      console.log(`${colors.yellow}⚠${colors.reset} Genealogy failed: ${e.message}. Continuing with init.`);
    }
  }

  if (isAvailable()) {
    console.log(`\n${colors.blue}LLM detected.${colors.reset} Running inference-powered init...`);
    const { runInitInference, writeDraftLayers } = require('./init-inference');

    runInitInference(process.cwd()).then(result => {
      if (!result.success) {
        console.log(`${colors.yellow}⚠${colors.reset} Inference skipped: ${result.error}`);
        printNextSteps();
        return;
      }

      const written = writeDraftLayers(process.cwd(), result.layers);
      console.log(`${colors.green}✓${colors.reset} Draft layers written:`);
      written.forEach(f => console.log(`${colors.gray}    ${f}${colors.reset}`));

      if (result.meta.dropped_fields.length > 0) {
        console.log(`${colors.yellow}Dropped:${colors.reset}`);
        result.meta.dropped_fields.forEach(d => console.log(`${colors.gray}  • ${d}${colors.reset}`));
      }

      console.log(`${colors.gray}  Confidence: ${(result.meta.confidence * 100).toFixed(0)}%${colors.reset}`);
      console.log(`${colors.gray}  Model: ${result.meta.model}${colors.reset}`);
      console.log(`\n${colors.green}Draft substrate ready.${colors.reset} Review draft-init.md files, then run ${colors.blue}stratvibe validate${colors.reset}`);
    }).catch(err => {
      console.log(`${colors.red}Inference failed:${colors.reset} ${err.message}`);
      printNextSteps();
    });
  } else {
    printNextSteps();
  }
}

function printNextSteps() {
  console.log(`\n${colors.blue}Next:${colors.reset}`);
  console.log(`${colors.gray}  • Fill plan.md with your project intent${colors.reset}`);
  console.log(`${colors.gray}  • Run stratvibe connect to generate AGENTS.md${colors.reset}`);
  console.log(`${colors.gray}  • Start with spec/ architecture decisions${colors.reset}`);
  console.log(`${colors.gray}  • Set STRATVIBE_LLM_URL for inference-powered init${colors.reset}`);
}

/**
 * Read JSON from file or stdin
 */
function readJsonInput(source) {
  if (!source || source === '-') {
    // Read from stdin
    return new Promise((resolve, reject) => {
      let data = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', chunk => data += chunk);
      process.stdin.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(new Error(`Invalid JSON from stdin: ${err.message}`));
        }
      });
      process.stdin.on('error', reject);
    });
  } else {
    // Read from file
    const filePath = path.isAbsolute(source) ? source : path.join(process.cwd(), source);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } catch (err) {
      throw new Error(`Failed to read JSON from ${source}: ${err.message}`);
    }
  }
}

/**
 * Validate handoff JSON against schema
 */
function validateCommand() {
  console.log(`${colors.blue}🔍 stratvibe validate${colors.reset}`);

  const args = process.argv.slice(3);
  const inputSource = args[0] || null;

  // Check if substrate is initialized
  const schemaPath = path.join(process.cwd(), '.substrate/schema.json');
  if (!fs.existsSync(schemaPath)) {
    console.log(`${colors.red}Error:${colors.reset} Substrate not initialized in this directory.`);
    console.log(`${colors.gray}Run 'stratvibe init' first to create .substrate/schema.json${colors.reset}`);
    process.exit(1);
  }

  let schema;
  try {
    schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  } catch (error) {
    console.log(`${colors.red}Error:${colors.reset} Invalid schema.json: ${error.message}`);
    process.exit(1);
  }

  // Auto-discover handoff files when no args given
  let filesToValidate = [];
  if (inputSource) {
    filesToValidate = [inputSource];
  } else {
    // Scan .substrate/ and .substrate/handoffs/ for JSON files
    const handoffDir = path.join(process.cwd(), '.substrate', 'handoffs');
    const substrateDir = path.join(process.cwd(), '.substrate');

    if (fs.existsSync(handoffDir)) {
      const scanDir = (dir) => {
        if (!fs.existsSync(dir)) return;
        fs.readdirSync(dir).forEach(file => {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            scanDir(fullPath);
          } else if (file.endsWith('.json') && file.startsWith('handoff')) {
            filesToValidate.push(fullPath);
          }
        });
      };
      scanDir(handoffDir);
    }

    // Also check root .substrate/ for handoff-*.json
    if (fs.existsSync(substrateDir)) {
      fs.readdirSync(substrateDir).forEach(file => {
        const fullPath = path.join(substrateDir, file);
        if (file.endsWith('.json') && file.startsWith('handoff') && !filesToValidate.includes(fullPath)) {
          filesToValidate.push(fullPath);
        }
      });
    }

    if (filesToValidate.length === 0) {
      console.log(`${colors.yellow}⚠${colors.reset} No handoff JSON files found in .substrate/`);
      console.log(`${colors.gray}Usage: stratvibe validate [file.json]${colors.reset}`);
      process.exit(0);
    }
  }

  let totalValid = 0;
  let totalInvalid = 0;

  filesToValidate.forEach(filePath => {
    const resolvedPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);

    if (!fs.existsSync(resolvedPath)) {
      console.log(`\n${colors.red}✗${colors.reset} File not found: ${filePath}`);
      totalInvalid++;
      return;
    }

    let jsonToValidate;
    try {
      const content = fs.readFileSync(resolvedPath, 'utf8');
      jsonToValidate = JSON.parse(content);
    } catch (error) {
      console.log(`\n${colors.red}✗${colors.reset} ${path.basename(filePath)}: Invalid JSON — ${error.message}`);
      totalInvalid++;
      return;
    }

    const errors = validateHandoff(jsonToValidate);

    if (errors.length > 0) {
      console.log(`\n${colors.red}✗${colors.reset} ${path.basename(filePath)}: Invalid`);
      errors.forEach(err => console.log(`${colors.gray}  • ${err}${colors.reset}`));
      totalInvalid++;
    } else {
      const handoff = jsonToValidate.handoff;
      const reasoning = jsonToValidate.reasoning;
      const content = fs.readFileSync(resolvedPath, 'utf8');
      const tokens = countTokens(content);
      const budget = jsonToValidate.context?.token_budget;
      const used = jsonToValidate.context?.token_used;

      console.log(`\n${colors.green}✓${colors.reset} ${path.basename(filePath)}`);
      console.log(`${colors.gray}  Schema: ${schema.$version || 'v0.1.0'}${colors.reset}`);
      console.log(`${colors.gray}  Layers: ${handoff.layer_origin} → ${handoff.layer_target}${colors.reset}`);
      console.log(`${colors.gray}  Role: ${handoff.agent_role}${colors.reset}`);
      console.log(`${colors.gray}  Status: ${handoff.status}${colors.reset}`);
      if (reasoning && reasoning.confidence !== undefined) {
        console.log(`${colors.gray}  Confidence: ${(reasoning.confidence * 100).toFixed(1)}%${colors.reset}`);
      }
      if (budget) {
        const pct = ((tokens / budget) * 100).toFixed(0);
        const over = tokens > budget ? ` ${colors.red}(OVER BUDGET by ${tokens - budget})${colors.reset}` : '';
        console.log(`${colors.gray}  Token budget: ${tokens}/${budget} (${pct}%)${colors.reset}${over}`);
      } else {
        console.log(`${colors.gray}  Tokens: ${tokens}${colors.reset}`);
      }
      if (used !== undefined) {
        const drift = Math.abs(tokens - used);
        const driftPct = ((drift / used) * 100).toFixed(0);
        console.log(`${colors.gray}  Reported: ${used} (drift: ${drift} / ${driftPct}%)${colors.reset}`);
      }
      totalValid++;
    }
  });

  // Summary
  console.log(`\n${colors.gray}─────────────────────────${colors.reset}`);
  console.log(`${colors.green}Valid: ${totalValid}${colors.reset}  ${colors.red}Invalid: ${totalInvalid}${colors.reset}  ${colors.gray}Total: ${totalValid + totalInvalid}${colors.reset}`);

  if (totalInvalid > 0) {
    process.exit(1);
  }
}

/**
 * Validate a single handoff object, returns array of errors
 */
function validateHandoff(json) {
  const errors = [];

  const requiredSections = ['handoff', 'context', 'payload', 'reasoning', 'meta'];
  requiredSections.forEach(section => {
    if (!json[section]) {
      errors.push(`Missing top-level section: ${section}`);
    } else if (typeof json[section] !== 'object') {
      errors.push(`Section ${section} must be an object`);
    }
  });

  if (errors.length > 0) return errors;

  const handoff = json.handoff;
  const handoffRequired = ['id', 'timestamp', 'layer_origin', 'layer_target', 'agent_role', 'status'];
  handoffRequired.forEach(field => {
    if (!handoff[field]) {
      errors.push(`handoff.${field} is required`);
    }
  });

  const validLayers = ['spec', 'tasks', 'snippets', 'atomic', 'human'];
  if (handoff.layer_origin && !validLayers.includes(handoff.layer_origin)) {
    errors.push(`handoff.layer_origin must be one of: ${validLayers.join(', ')}`);
  }
  if (handoff.layer_target && !validLayers.includes(handoff.layer_target)) {
    errors.push(`handoff.layer_target must be one of: ${validLayers.join(', ')}`);
  }

  const validRoles = ['planner', 'coordinator', 'implementer', 'resolver', 'summarizer'];
  if (handoff.agent_role && !validRoles.includes(handoff.agent_role)) {
    errors.push(`handoff.agent_role must be one of: ${validRoles.join(', ')}`);
  }

  const validStatus = ['pending', 'active', 'blocked', 'done', 'failed'];
  if (handoff.status && !validStatus.includes(handoff.status)) {
    errors.push(`handoff.status must be one of: ${validStatus.join(', ')}`);
  }

  const reasoning = json.reasoning;
  if (reasoning && reasoning.confidence !== undefined) {
    const conf = reasoning.confidence;
    if (typeof conf !== 'number' || conf < 0 || conf > 1) {
      errors.push(`reasoning.confidence must be a number between 0.0 and 1.0`);
    }
  }

  return errors;
}

/**
 * Show help
 */

function connectCommand() {
  console.log(`${colors.blue}🔗 stratvibe connect${colors.reset}`);
  console.log(`${colors.gray}Generate AGENTS.md from your plan.md...${colors.reset}`);
  console.log("");
  console.log("1. Fill in plan.md with your project intent");
  console.log("2. Feed plan.md + .substrate/connect.md to any LLM");
  console.log("3. Place generated AGENTS.md in project root");
  console.log("4. Start building with your agent of choice");
  console.log("");
  console.log(`${colors.green}✓ Connect prompt ready:${colors.reset} .substrate/connect.md`);
  console.log(`${colors.green}✓ Project plan:${colors.reset} plan.md`);
}

/**
 * Add .stratvibe/ to .gitignore
 */
function ignoreCommand() {
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  const ignoreEntry = '.stratvibe/';

  let gitignoreContent = '';

  if (fs.existsSync(gitignorePath)) {
    gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');

    const lines = gitignoreContent.split(/\r?\n/).map(line => line.trim());
    if (lines.includes(ignoreEntry)) {
      console.log(`${colors.yellow}⚠${colors.reset} .stratvibe/ already in .gitignore`);
      return;
    }
  }

  const prefix = gitignoreContent.length > 0 && !gitignoreContent.endsWith('\n') ? '\n' : '';
  fs.writeFileSync(gitignorePath, gitignoreContent + prefix + ignoreEntry + '\n', 'utf8');
  console.log(`${colors.green}✓${colors.reset} Added .stratvibe/ to .gitignore`);
}

/**
 * Remove substrate without touching codebase
 */
function ejectCommand() {
  const args = process.argv.slice(3);
  const force = args.includes('--force') || args.includes('-f');

  if (!force) {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('Remove substrate? (y/n) ', (answer) => {
      rl.close();
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        performEject();
      } else {
        console.log(`${colors.yellow}Aborted.${colors.reset}`);
      }
    });
  } else {
    performEject();
  }
}

function performEject() {
  const items = [
    { path: '.substrate', type: 'dir' },
    { path: 'plan.md', type: 'file' }
  ];

  let removedCount = 0;

  items.forEach(item => {
    const fullPath = path.join(process.cwd(), item.path);
    if (fs.existsSync(fullPath)) {
      if (item.type === 'dir') {
        fs.rmSync(fullPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(fullPath);
      }
      const suffix = item.type === 'dir' ? '/' : '';
      console.log(`${colors.red}✗${colors.reset} Removed ${item.path}${suffix}`);
      removedCount++;
    }
  });

  if (removedCount === 0) {
    console.log(`${colors.yellow}⚠${colors.reset} No substrate items found to remove`);
  } else {
    console.log(`\n${colors.red}Substrate removed.${colors.reset}`);
    console.log(`${colors.gray}spec/ tasks/ snippets/ atomic/ untouched.${colors.reset}`);
  }
}

/**
 * Scan sprint task files for status
 */
function scanSprints() {
  const tasksDir = path.join(process.cwd(), 'tasks');
  if (!fs.existsSync(tasksDir)) return [];

  const sprints = [];
  const entries = fs.readdirSync(tasksDir);

  entries.forEach(entry => {
    if (!entry.startsWith('sprint')) return;
    const sprintPath = path.join(tasksDir, entry);
    if (!fs.statSync(sprintPath).isDirectory()) return;

    const tasks = [];
    const files = fs.readdirSync(sprintPath);

    files.forEach(file => {
      if (!file.endsWith('.md') || file === 'sprint-log.md' || file === 'sprint-sequence.md') return;
      const taskPath = path.join(sprintPath, file);
      const content = fs.readFileSync(taskPath, 'utf8');

      const titleMatch = content.match(/^#\s+Task\s+\d+:\s*(.+)$/m);
      const effortMatch = content.match(/^##\s+Effort\s*\n\s*(.+)$/m);
      const blockedByMatch = content.match(/^##\s+Blocked\s+By\s*\n\s*-\s*(.+)$/m);

      const checkboxes = content.match(/\[[ x]\]/g) || [];
      const checked = checkboxes.filter(c => c === '[x]').length;
      const total = checkboxes.length;
      let status = 'pending';
      if (total > 0 && checked === total) status = 'done';
      else if (checked > 0) status = 'active';

      if (blockedByMatch && blockedByMatch[1].toLowerCase() !== 'none') {
        status = 'blocked';
      }

      tasks.push({
        file,
        title: titleMatch ? titleMatch[1].trim() : file.replace('.md', ''),
        effort: effortMatch ? effortMatch[1].trim() : 'unknown',
        status,
        checked,
        total
      });
    });

    if (tasks.length > 0) {
      const done = tasks.filter(t => t.status === 'done').length;
      sprints.push({ name: entry, tasks, done, total: tasks.length });
    }
  });

  return sprints;
}

/**
 * Scan handoff JSON files for health status
 */
function scanHandoffs() {
  const handoffs = [];
  const substrateDir = path.join(process.cwd(), '.substrate');
  const handoffDir = path.join(substrateDir, 'handoffs');

  const scanDir = (dir) => {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        scanDir(fullPath);
      } else if (file.endsWith('.json') && file.startsWith('handoff')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const json = JSON.parse(content);
          const reasoning = json.reasoning || {};
          const handoff = json.handoff || {};
          const context = json.context || {};

          const flags = reasoning.flags || [];
          const confidence = reasoning.confidence;
          let status = handoff.status || 'unknown';
          let humanTrigger = false;
          let triggerReasons = [];

          if (confidence !== undefined && confidence < 0.7) {
            humanTrigger = true;
            triggerReasons.push(`conf:${confidence.toFixed(2)}`);
          }
          if (flags.includes('breaking_change')) {
            humanTrigger = true;
            triggerReasons.push('breaking_change');
          }
          if (flags.includes('needs_review')) {
            triggerReasons.push('needs_review');
          }
          if (context.token_used > context.token_budget) {
            humanTrigger = true;
            triggerReasons.push('budget_overflow');
          }

          handoffs.push({
            file,
            role: handoff.agent_role || 'unknown',
            status,
            confidence,
            layerOrigin: handoff.layer_origin,
            layerTarget: handoff.layer_target,
            flags,
            humanTrigger,
            triggerReasons
          });
        } catch (e) {
          handoffs.push({ file, role: 'error', status: 'failed', error: e.message });
        }
      }
    });
  };

  if (fs.existsSync(handoffDir)) scanDir(handoffDir);
  if (fs.existsSync(substrateDir)) {
    fs.readdirSync(substrateDir).forEach(file => {
      if (file.endsWith('.json') && file.startsWith('handoff')) {
        const fullPath = path.join(substrateDir, file);
        if (!handoffs.find(h => h.file === file)) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const json = JSON.parse(content);
            const reasoning = json.reasoning || {};
            const handoff = json.handoff || {};
            const context = json.context || {};
            const flags = reasoning.flags || [];
            const confidence = reasoning.confidence;
            let humanTrigger = false;
            let triggerReasons = [];
            if (confidence !== undefined && confidence < 0.7) { humanTrigger = true; triggerReasons.push(`conf:${confidence.toFixed(2)}`); }
            if (flags.includes('breaking_change')) { humanTrigger = true; triggerReasons.push('breaking_change'); }
            handoffs.push({ file, role: handoff.agent_role || 'unknown', status: handoff.status || 'unknown', confidence, flags, humanTrigger, triggerReasons });
          } catch (e) {
            handoffs.push({ file, role: 'error', status: 'failed', error: e.message });
          }
        }
      }
    });
  }

  return handoffs;
}

/**
 * Scan sprint logs for recent events
 */
function scanSprintLogs() {
  const tasksDir = path.join(process.cwd(), 'tasks');
  if (!fs.existsSync(tasksDir)) return [];

  const logs = [];
  const entries = fs.readdirSync(tasksDir);

  entries.forEach(entry => {
    if (!entry.startsWith('sprint')) return;
    const logPath = path.join(tasksDir, entry, 'sprint-log.md');
    if (!fs.existsSync(logPath)) return;

    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split(/\r?\n/);
    let inTable = false;

    lines.forEach(line => {
      if (line.startsWith('| timestamp')) { inTable = true; return; }
      if (inTable && line.startsWith('|---')) return;
      if (inTable && line.startsWith('|') && line.trim().length > 10) {
        const cells = line.split('|').map(c => c.trim()).filter(c => c.length > 0);
        if (cells.length >= 4) {
          logs.push({
            sprint: entry,
            timestamp: cells[0],
            event: cells[1],
            role: cells[2],
            detail: cells[3]
          });
        }
      }
    });
  });

  return logs;
}

/**
 * Render the ASCII dashboard
 */
function renderDashboard(sprints, handoffs, sprintLogs) {
  const W = 50;
  const border = '─'.repeat(W);
  const lines = [];

  lines.push(`${colors.blue}┌─ Stratvibe Dashboard${' '.repeat(W - 22)}┐${colors.reset}`);

  // Sprint sections
  sprints.forEach(sprint => {
    lines.push(`${colors.blue}├─ ${sprint.name}${' '.repeat(W - 2 - sprint.name.length)}┤${colors.reset}`);
    sprint.tasks.forEach(task => {
      const icon = task.status === 'done' ? `${colors.green}✓${colors.reset}` :
                   task.status === 'active' ? `${colors.yellow}⧗${colors.reset}` :
                   task.status === 'blocked' ? `${colors.red}◌${colors.reset}` :
                   `${colors.gray}○${colors.reset}`;
      const title = task.title.length > 20 ? task.title.slice(0, 19) + '…' : task.title;
      const statusColor = task.status === 'done' ? colors.green :
                          task.status === 'blocked' ? colors.red :
                          task.status === 'active' ? colors.yellow : colors.gray;
      const statusStr = statusColor + task.status.padEnd(8) + colors.reset;
      const effort = task.effort.padStart(6);
      const pad = W - 2 - 2 - title.length - 8 - 6;
      lines.push(`${colors.blue}│${colors.reset} ${icon} ${title}${' '.repeat(Math.max(0, pad))}${statusStr}${effort} ${colors.blue}│${colors.reset}`);
    });
    const summary = `${sprint.done}/${sprint.total} complete`;
    const pad = W - 2 - summary.length;
    lines.push(`${colors.blue}│${colors.reset} ${colors.gray}${summary}${' '.repeat(Math.max(0, pad))}${colors.reset} ${colors.blue}│${colors.reset}`);
  });

  if (sprints.length === 0) {
    lines.push(`${colors.blue}├─ No sprints found${' '.repeat(W - 20)}┤${colors.reset}`);
  }

  // Handoff Health
  lines.push(`${colors.blue}├─ Handoff Health${' '.repeat(W - 18)}┤${colors.reset}`);
  if (handoffs.length > 0) {
    handoffs.forEach(h => {
      const icon = h.status === 'done' ? `${colors.green}✓${colors.reset}` :
                   h.status === 'failed' ? `${colors.red}✗${colors.reset}` :
                   h.status === 'pending' ? `${colors.gray}○${colors.reset}` :
                   `${colors.yellow}⧗${colors.reset}`;
      const role = (h.role || 'unknown').padEnd(12);
      const conf = h.confidence !== undefined ? `conf:${h.confidence.toFixed(2)}` : 'no conf';
      const confColor = h.confidence !== undefined && h.confidence < 0.7 ? colors.red : colors.gray;
      const pad = W - 2 - 2 - 12 - conf.length - 1;
      lines.push(`${colors.blue}│${colors.reset} ${icon} ${colors.gray}${role}${colors.reset}${confColor}${conf}${' '.repeat(Math.max(0, pad))}${colors.reset} ${colors.blue}│${colors.reset}`);
    });
  } else {
    const pad = W - 2 - 16;
    lines.push(`${colors.blue}│${colors.reset} ${colors.gray}No handoffs yet${' '.repeat(Math.max(0, pad))}${colors.reset} ${colors.blue}│${colors.reset}`);
  }

  // Human Review Triggers
  const triggers = handoffs.filter(h => h.humanTrigger);
  if (triggers.length > 0) {
    lines.push(`${colors.red}├─ ⚠ Human Review Needed${' '.repeat(W - 24)}┤${colors.reset}`);
    triggers.forEach(h => {
      const reasons = h.triggerReasons.join(', ');
      const msg = `${h.role}: ${reasons}`;
      const truncated = msg.length > W - 4 ? msg.slice(0, W - 5) + '…' : msg;
      const pad = W - 2 - truncated.length;
      lines.push(`${colors.red}│${colors.reset} ${colors.yellow}${truncated}${' '.repeat(Math.max(0, pad))}${colors.reset} ${colors.red}│${colors.reset}`);
    });
  }

  // Recent Log Events
  const recentLogs = sprintLogs.slice(-3);
  if (recentLogs.length > 0) {
    lines.push(`${colors.blue}├─ Recent Events${' '.repeat(W - 16)}┤${colors.reset}`);
    recentLogs.forEach(log => {
      const msg = `${log.sprint}: ${log.event} (${log.role})`;
      const truncated = msg.length > W - 4 ? msg.slice(0, W - 5) + '…' : msg;
      const pad = W - 2 - truncated.length;
      lines.push(`${colors.blue}│${colors.reset} ${colors.gray}${truncated}${' '.repeat(Math.max(0, pad))}${colors.reset} ${colors.blue}│${colors.reset}`);
    });
  }

  // Footer
  lines.push(`${colors.blue}└${border}┘${colors.reset}`);
  lines.push('');
  lines.push(`${colors.gray}Watching: tasks/, .substrate/handoffs/, spec/, snippets/, atomic/${colors.reset}`);
  lines.push(`${colors.gray}Ctrl+C to exit${colors.reset}`);

  return lines.join('\n');
}

/**
 * Watch command - live dashboard with file watching
 */
function watchCommand() {
  const chokidar = require('chokidar');

  if (!fs.existsSync(path.join(process.cwd(), '.substrate'))) {
    console.log(`${colors.red}Error:${colors.reset} Substrate not initialized in this directory.`);
    console.log(`${colors.gray}Run 'stratvibe init' first.${colors.reset}`);
    process.exit(1);
  }

  const watchPaths = [
    path.join(process.cwd(), 'tasks'),
    path.join(process.cwd(), '.substrate', 'handoffs'),
    path.join(process.cwd(), '.substrate', 'handoff-*.json'),
    path.join(process.cwd(), 'spec'),
    path.join(process.cwd(), 'snippets'),
    path.join(process.cwd(), 'atomic')
  ].filter(p => fs.existsSync(p));

  if (watchPaths.length === 0) {
    console.log(`${colors.yellow}⚠${colors.reset} No watchable directories found.`);
    console.log(`${colors.gray}Create tasks/ or .substrate/ first.${colors.reset}`);
    process.exit(1);
  }

  let debounceTimer = null;

  function render() {
    const sprints = scanSprints();
    const handoffs = scanHandoffs();
    const sprintLogs = scanSprintLogs();
    const dashboard = renderDashboard(sprints, handoffs, sprintLogs);
    process.stdout.write('\x1Bc');
    console.log(dashboard);
  }

  function onFileChange() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(render, 300);
  }

  const watcher = chokidar.watch(watchPaths, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
    persistent: true
  });

  watcher.on('ready', () => {
    render();
    watcher.on('all', onFileChange);
  });

  watcher.on('error', (error) => {
    console.error(`${colors.red}Watcher error:${colors.reset} ${error.message}`);
  });

  process.on('SIGINT', () => {
    watcher.close();
    console.log(`\n${colors.gray}Watch stopped.${colors.reset}`);
    process.exit(0);
  });
}

function genealogyCommand() {
  function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === '--target' && argv[i + 1]) {
        args.target = path.resolve(argv[i + 1]);
        i++;
      } else if (argv[i] === '--no-runtime') {
        args.noRuntime = true;
      } else if (argv[i] === '--dry') {
        args.dry = true;
      } else if (argv[i] === '--help' || argv[i] === '-h') {
        args.help = true;
      }
    }
    return args;
  }

  function printDryRun(targetDir) {
    console.log(`${colors.blue}stratvibe genealogy — dry run${colors.reset}`);
    console.log(`${colors.gray}Target: ${targetDir}${colors.reset}\n`);

    if (!fs.existsSync(targetDir)) {
      console.log(`${colors.red}Error: Target directory does not exist.${colors.reset}`);
      process.exit(1);
    }

    const readmeExists = fs.existsSync(path.join(targetDir, 'README.md')) ||
                         fs.existsSync(path.join(targetDir, 'README'));
    const docsExist = fs.existsSync(path.join(targetDir, 'docs'));
    const pkgExists = fs.existsSync(path.join(targetDir, 'package.json'));
    const envExists = fs.existsSync(path.join(targetDir, '.env'));

    console.log(`${colors.blue}Archivist would scan:${colors.reset}`);
    console.log(`  ${readmeExists ? colors.green : colors.yellow}${readmeExists ? '✓' : '✗'} README${colors.reset}`);
    console.log(`  ${docsExist ? colors.green : colors.yellow}${docsExist ? '✓' : '✗'} docs/ directory${colors.reset}`);
    console.log(`  ${colors.gray}? Source code comments${colors.reset}`);
    console.log(`  ${colors.gray}? Git history${colors.reset}`);

    console.log(`\n${colors.blue}Cartographer would scan:${colors.reset}`);
    console.log(`  ${pkgExists ? colors.green : colors.yellow}${pkgExists ? '✓' : '✗'} package.json${colors.reset}`);
    console.log(`  ${colors.gray}? File tree and structure${colors.reset}`);
    console.log(`  ${colors.gray}? Import/require graph${colors.reset}`);

    console.log(`\n${colors.blue}Inspector would scan:${colors.reset}`);
    console.log(`  ${envExists ? colors.green : colors.yellow}${envExists ? '✓' : '✗'} .env file${colors.reset}`);
    console.log(`  ${colors.gray}? Config files (*.config.js, *.json)${colors.reset}`);
    console.log(`  ${colors.gray}? package.json scripts${colors.reset}`);

    console.log(`\n${colors.blue}Genealogist would produce:${colors.reset}`);
    console.log(`  lineage.md — ancestry, mutations, orphans, fossils`);
    console.log(`  delta-report.md — human review document`);

    console.log(`\n${colors.gray}Run without --dry to execute.${colors.reset}`);
  }

  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(`stratvibe genealogy — Legacy code analysis

Usage:
  stratvibe genealogy [--target <path>] [--no-runtime] [--dry]

Flags:
  --target <path>    Directory to analyze (default: current directory)
  --no-runtime       Skip Inspector role (static analysis only)
  --dry              Show what would be analyzed, don't run
  --help, -h         Show this help

Output:
  Creates genealogy/ directory in the target project root with:
  - stated-intent.md       (Archivist output)
  - actual-implementation.md (Cartographer output)
  - actual-behavior.md     (Inspector output)
  - lineage.md             (Genealogist synthesis)
  - delta-report.md        (Human review document)`);
    return;
  }

  const targetDir = args.target || process.cwd();
  const outputDir = path.join(targetDir, 'genealogy');

  if (args.dry) {
    printDryRun(targetDir);
    return;
  }

  if (!fs.existsSync(targetDir)) {
    console.log(`${colors.red}Error:${colors.reset} Target directory does not exist: ${targetDir}`);
    process.exit(1);
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`${colors.blue}┌─ stratvibe genealogy${colors.reset}`);
  console.log(`${colors.blue}│${colors.reset} ${colors.gray}Target: ${targetDir}${colors.reset}`);
  console.log(`${colors.blue}│${colors.reset} ${colors.gray}Output: ${outputDir}${colors.reset}`);
  console.log(`${colors.blue}└${'─'.repeat(40)}${colors.reset}\n`);

  try {
    const archivist = require('./genealogy/archivist');
    const cartographer = require('./genealogy/cartographer');
    const inspector = require('./genealogy/inspector');
    const genealogist = require('./genealogy/genealogist');

    // Phase 1: Archivist
    console.log(`${colors.blue}[1/4] Archivist${colors.reset} — scanning documentation...`);
    const archivistResult = archivist.run(targetDir, path.join(outputDir, 'stated-intent.md'));
    console.log(`${colors.green}  ✓${colors.reset} stated-intent.md written`);
    console.log(`${colors.gray}    Sources: ${archivistResult.sourcesFound}${colors.reset}`);
    console.log(`${colors.gray}    README: ${archivistResult.hasReadme ? 'found' : 'not found'}${colors.reset}`);
    console.log(`${colors.gray}    Docs: ${archivistResult.hasDocDirs ? 'found' : 'not found'}${colors.reset}`);
    console.log(`${colors.gray}    Comments: ${archivistResult.hasComments ? 'found' : 'not found'}${colors.reset}\n`);

    // Phase 2: Cartographer
    console.log(`${colors.blue}[2/4] Cartographer${colors.reset} — mapping codebase...`);
    const cartographerResult = cartographer.run(targetDir, path.join(outputDir, 'actual-implementation.md'));
    console.log(`${colors.green}  ✓${colors.reset} actual-implementation.md written`);
    console.log(`${colors.gray}    Files: ${cartographerResult.totalFiles} (${cartographerResult.codeFiles} code)${colors.reset}`);
    console.log(`${colors.gray}    Fossils: ${cartographerResult.fossils}${colors.reset}`);
    console.log(`${colors.gray}    Orphans: ${cartographerResult.orphans}${colors.reset}`);
    console.log(`${colors.gray}    Patterns: ${cartographerResult.patterns}${colors.reset}\n`);

    // Phase 3: Inspector
    if (args.noRuntime) {
      console.log(`${colors.yellow}[3/4] Inspector${colors.reset} — skipped (--no-runtime)\n`);
    } else {
      console.log(`${colors.blue}[3/4] Inspector${colors.reset} — scanning config...`);
      const inspectorResult = inspector.run(targetDir, path.join(outputDir, 'actual-behavior.md'));
      console.log(`${colors.green}  ✓${colors.reset} actual-behavior.md written`);
      console.log(`${colors.gray}    Config files: ${inspectorResult.configFilesFound}${colors.reset}`);
      console.log(`${colors.gray}    Entries: ${inspectorResult.configEntries}${colors.reset}`);
      console.log(`${colors.gray}    Undocumented: ${inspectorResult.undocumentedConfigs}${colors.reset}\n`);
    }

    // Phase 4: Genealogist
    console.log(`${colors.blue}[4/4] Genealogist${colors.reset} — synthesizing...`);
    const genealogistResult = genealogist.run(
      targetDir,
      outputDir,
      path.join(outputDir, 'stated-intent.md'),
      path.join(outputDir, 'actual-implementation.md'),
      path.join(outputDir, 'actual-behavior.md')
    );
    console.log(`${colors.green}  ✓${colors.reset} lineage.md written`);
    console.log(`${colors.green}  ✓${colors.reset} delta-report.md written\n`);

    // Summary
    console.log(`${colors.blue}┌─ Summary${colors.reset}`);
    console.log(`${colors.blue}│${colors.reset}`);
    console.log(`${colors.blue}│${colors.reset} ${colors.green}Genealogy complete.${colors.reset}`);
    console.log(`${colors.blue}│${colors.reset}`);
    console.log(`${colors.blue}│${colors.reset} ${colors.gray}Output files:${colors.reset}`);
    console.log(`${colors.blue}│${colors.reset}   genealogy/stated-intent.md`);
    console.log(`${colors.blue}│${colors.reset}   genealogy/actual-implementation.md`);
    console.log(`${colors.blue}│${colors.reset}   genealogy/actual-behavior.md`);
    console.log(`${colors.blue}│${colors.reset}   genealogy/lineage.md`);
    console.log(`${colors.blue}│${colors.reset}   genealogy/delta-report.md ${colors.yellow}← start here${colors.reset}`);
    console.log(`${colors.blue}│${colors.reset}`);
    console.log(`${colors.blue}│${colors.reset} ${colors.gray}Next: Review delta-report.md and resolve flagged items.${colors.reset}`);
    console.log(`${colors.blue}└${'─'.repeat(40)}${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset} ${error.message}`);
    console.error(`${colors.gray}${error.stack}${colors.reset}`);
    process.exit(1);
  }
}

function handoffCommand() {
  const args = process.argv.slice(3);
  let fromLayer = null, toLayer = null, role = null, file = null, status = 'pending';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from' && args[i + 1]) { fromLayer = args[++i]; }
    else if (args[i] === '--to' && args[i + 1]) { toLayer = args[++i]; }
    else if (args[i] === '--role' && args[i + 1]) { role = args[++i]; }
    else if (args[i] === '--file' && args[i + 1]) { file = args[++i]; }
    else if (args[i] === '--status' && args[i + 1]) { status = args[++i]; }
    else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`stratvibe handoff — produce a protocol-compliant handoff

Usage:
  echo '{"decision":"..."}' | stratvibe handoff --from spec --to tasks --role planner
  stratvibe handoff --file output.json --from spec --to tasks --role planner

Flags:
  --from <layer>    Origin layer (spec|tasks|snippets|atomic)
  --to <layer>      Target layer (spec|tasks|snippets|atomic|human)
  --role <role>     Agent role (planner|coordinator|implementer|resolver|summarizer)
  --file <path>     Read content from file instead of stdin
  --status <s>      Status (default: pending)`);
      return;
    }
  }

  if (!fromLayer || !toLayer || !role) {
    console.log(`${colors.red}Error:${colors.reset} --from, --to, and --role are required.`);
    console.log(`${colors.gray}Use 'stratvibe handoff --help' for usage.${colors.reset}`);
    process.exit(1);
  }

  const { produceHandoff, writeHandoff } = require('./handoff-producer');

  const run = async (content) => {
    try {
      const handoff = await produceHandoff({ content, fromLayer, toLayer, role, status });
      const filePath = writeHandoff(handoff);
      console.log(`${colors.green}✓${colors.reset} Handoff written: ${path.relative(process.cwd(), filePath)}`);
      console.log(`${colors.gray}  ${fromLayer} → ${toLayer} (${role})${colors.reset}`);
      console.log(`${colors.gray}  Tokens: ${handoff.context.token_used}/${handoff.context.token_budget}${colors.reset}`);
      if (handoff.context.compression_applied) {
        console.log(`${colors.yellow}  Compression applied${colors.reset}`);
      }
      if (handoff.meta.dropped_fields && handoff.meta.dropped_fields.length > 0) {
        console.log(`${colors.yellow}  Dropped:${colors.reset}`);
        handoff.meta.dropped_fields.forEach(d => console.log(`${colors.gray}    • ${d}${colors.reset}`));
      }
    } catch (err) {
      console.error(`${colors.red}Error:${colors.reset} ${err.message}`);
      process.exit(1);
    }
  };

  if (file) {
    const filePath = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
    try {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      run(content);
    } catch (err) {
      console.error(`${colors.red}Error:${colors.reset} Failed to read file: ${err.message}`);
      process.exit(1);
    }
  } else {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => {
      try {
        const content = JSON.parse(data);
        run(content);
      } catch (err) {
        console.error(`${colors.red}Error:${colors.reset} Invalid JSON from stdin: ${err.message}`);
        process.exit(1);
      }
    });
  }
}

function summarizeCommand() {
  const args = process.argv.slice(3);
  let fromLayer = null, toLayer = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from' && args[i + 1]) { fromLayer = args[++i]; }
    else if (args[i] === '--to' && args[i + 1]) { toLayer = args[++i]; }
    else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`stratvibe summarize — compress content between layers

Usage:
  echo '{"decision":"...","rationale":"..."}' | stratvibe summarize --from spec --to tasks

Flags:
  --from <layer>    Source layer
  --to <layer>      Target layer (determines budget)

Requires STRATVIBE_LLM_URL to be set.`);
      return;
    }
  }

  if (!fromLayer || !toLayer) {
    console.log(`${colors.red}Error:${colors.reset} --from and --to are required.`);
    process.exit(1);
  }

  const { isAvailable } = require('./llm');
  if (!isAvailable()) {
    console.log(`${colors.red}Error:${colors.reset} STRATVIBE_LLM_URL not set. Summarizer requires LLM access.`);
    process.exit(1);
  }

  const { summarize } = require('./summarizer');
  const { countTokens, getBudget } = require('./tokens');

  let data = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => data += chunk);
  process.stdin.on('end', async () => {
    try {
      const content = JSON.parse(data);
      const inputTokens = countTokens(JSON.stringify(content));
      const targetBudget = getBudget(toLayer);

      console.log(`${colors.blue}Summarizing${colors.reset} ${fromLayer} → ${toLayer}`);
      console.log(`${colors.gray}Input: ${inputTokens} tokens | Target: ${targetBudget} tokens${colors.reset}`);

      const result = await summarize(content, fromLayer, toLayer);

      console.log(`${colors.green}✓${colors.reset} Compressed: ${result.meta.output_tokens} tokens`);

      if (result.dropped_fields.length > 0) {
        console.log(`${colors.yellow}Dropped:${colors.reset}`);
        result.dropped_fields.forEach(d => console.log(`${colors.gray}  • ${d}${colors.reset}`));
      }

      console.log(`\n${colors.gray}--- Output ---${colors.reset}`);
      console.log(JSON.stringify(result.compressed, null, 2));
    } catch (err) {
      console.error(`${colors.red}Error:${colors.reset} ${err.message}`);
      process.exit(1);
    }
  });
}

function feedCommand() {
  const args = process.argv.slice(3);
  let layer = null, role = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--layer' && args[i + 1]) { layer = args[++i]; }
    else if (args[i] === '--role' && args[i + 1]) { role = args[++i]; }
    else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`stratvibe feed — produce context for an agent at a given layer

Usage:
  stratvibe feed --layer tasks --role coordinator

Flags:
  --layer <layer>   Target layer (spec|tasks|snippets|atomic)
  --role <role>     Agent role to feed context to

Outputs JSON context blob to stdout.`);
      return;
    }
  }

  if (!layer) {
    console.log(`${colors.red}Error:${colors.reset} --layer is required.`);
    process.exit(1);
  }

  const { countTokens, getBudget } = require('./tokens');
  const budget = getBudget(layer);

  // Find latest handoff targeting this layer
  const handoffDir = path.join(process.cwd(), '.substrate', 'handoffs');
  let latestHandoff = null;

  if (fs.existsSync(handoffDir)) {
    const files = fs.readdirSync(handoffDir)
      .filter(f => f.endsWith('.json') && f.includes(`-${layer}-`))
      .sort()
      .reverse();

    if (files.length > 0) {
      try {
        latestHandoff = JSON.parse(fs.readFileSync(path.join(handoffDir, files[0]), 'utf8'));
      } catch {}
    }
  }

  // Read layer's current state
  const layerDir = path.join(process.cwd(), layer);
  let layerFiles = {};
  if (fs.existsSync(layerDir)) {
    const scan = (dir, prefix = '') => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const rel = path.join(prefix, entry.name);
        if (entry.isDirectory()) {
          scan(path.join(dir, entry.name), rel);
        } else if (entry.name.endsWith('.md') || entry.name.endsWith('.json')) {
          const content = fs.readFileSync(path.join(dir, entry.name), 'utf8');
          layerFiles[rel] = content;
        }
      }
    };
    scan(layerDir);
  }

  const context = {
    layer,
    role: role || null,
    token_budget: budget,
    latest_handoff: latestHandoff ? latestHandoff.payload?.content : null,
    handoff_meta: latestHandoff ? {
      from: latestHandoff.handoff?.layer_origin,
      role: latestHandoff.handoff?.agent_role,
      status: latestHandoff.handoff?.status,
      confidence: latestHandoff.reasoning?.confidence,
      flags: latestHandoff.reasoning?.flags,
    } : null,
    layer_state: layerFiles,
  };

  const contextStr = JSON.stringify(context);
  const tokens = countTokens(contextStr);

  if (tokens > budget) {
    context._warning = `Context (${tokens} tokens) exceeds layer budget (${budget}). Consider running stratvibe summarize.`;
  }

  context._tokens = tokens;
  console.log(JSON.stringify(context, null, 2));
}

function helpCommand() {
  console.log(`stratvibe - KISS substrate for LLM agent pipelines

Usage:
  stratvibe init           # Initialize substrate (with LLM inference if configured)
  stratvibe init --deep    # Run genealogy first, then inference-powered init
  stratvibe handoff        # Produce a protocol-compliant handoff JSON
  stratvibe summarize      # Compress content between layers (requires LLM)
  stratvibe feed           # Output context blob for an agent at a layer
  stratvibe validate       # Validate handoff JSON against schema
  stratvibe genealogy      # Run legacy code analysis
  stratvibe connect        # Guide to generate AGENTS.md from plan.md
  stratvibe watch          # Live-refresh dashboard for sprints and handoffs
  stratvibe ignore         # Add .stratvibe/ to .gitignore
  stratvibe eject          # Remove substrate without touching codebase
  stratvibe --help         # Show this help
  stratvibe --version      # Show version

Environment:
  STRATVIBE_LLM_URL        OpenAI-compatible endpoint (enables inference)
  STRATVIBE_LLM_KEY        API key for the endpoint
  STRATVIBE_LLM_MODEL      Model identifier (default: anthropic/claude-sonnet-4-20250514)

No config files. Env vars only.
Created by R & GIaL - 2026`);
}

/**
 * Show version
 */
function versionCommand() {
  console.log('stratvibe v0.2.0 (substrate v0.2)');
}

/**
 * Main command dispatcher
 */
function main() {
  const args = process.argv.slice(2);

  // No arguments shows help, "init" runs init
  if (args.length === 0) {
    helpCommand();
    return;
  }

  if (args[0] === 'init') {
    initCommand();
    return;
  }

  const command = args[0];

  switch (command) {
    case 'connect':
      connectCommand();
      break;
    case 'watch':
      watchCommand();
      break;
    case 'validate':
      validateCommand();
      break;
    case 'handoff':
      handoffCommand();
      break;
    case 'summarize':
      summarizeCommand();
      break;
    case 'feed':
      feedCommand();
      break;
    case 'ignore':
      ignoreCommand();
      break;
    case 'eject':
      ejectCommand();
      break;
    case 'genealogy':
      genealogyCommand();
      break;
    case '--help':
    case '-h':
    case 'help':
      helpCommand();
      break;
    case '--version':
    case '-v':
    case 'version':
      versionCommand();
      break;
    default:
      console.log(`${colors.red}Error:${colors.reset} Unknown command '${command}'`);
      console.log(`${colors.gray}Use stratvibe --help for available commands.${colors.reset}`);
      process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset} ${error.message}`);
    console.error(`${colors.gray}${error.stack}${colors.reset}`);
    process.exit(1);
  }
}

module.exports = { main };