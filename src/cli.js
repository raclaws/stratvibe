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
Output only the AGENTS.md markdown content No conversational filler`
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
  console.log(`${colors.blue}🎯 stratvibe init${colors.reset}`);
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

  // Summary
  console.log(`\n${colors.green}Substrate v0.1 ready.${colors.reset}`);
    // Copy plan.template.md -> plan.md
  const planSrc = path.join(__dirname, '..', 'plan.template.md');
  const planDest = path.join(process.cwd(), 'plan.md');
  if (!fs.existsSync(planDest)) {
    const templateExists = fs.existsSync(planSrc);
    if (templateExists) {
      fs.copyFileSync(planSrc, planDest);
    } else {
      // Fallback: write minimal plan inline
      fs.writeFileSync(planDest, '# [Project Name] — Technical Plan' + NL + NL);
    }
    console.log(`${colors.green}✓${colors.reset} Written plan.md`);
    createdCount++;
  }

console.log(`${colors.gray}Created: ${createdCount} items, Skipped: ${skippedCount} existing${colors.reset}`);

  if (skippedCount > 0) {
    console.log(`\n${colors.yellow}Note: Some files/directories already existed.${colors.reset}`);
    console.log(`${colors.yellow}Use --force to overwrite (not implemented yet).${colors.reset}`);
  }

  console.log(`\n${colors.blue}Next:${colors.reset}`);
  console.log(`${colors.gray}  • Fill plan.md with your project intent${colors.reset}`);
  console.log(`${colors.gray}  • Run stratvibe connect to generate AGENTS.md${colors.reset}`);
  console.log(`${colors.gray}  • Start with spec/ architecture decisions${colors.reset}`);
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

  const args = process.argv.slice(3); // Arguments after 'validate'
  const inputSource = args[0] || '-'; // Default to stdin

  // Check if substrate is initialized
  const schemaPath = path.join(process.cwd(), '.substrate/schema.json');
  if (!fs.existsSync(schemaPath)) {
    console.log(`${colors.red}Error:${colors.reset} Substrate not initialized in this directory.`);
    console.log(`${colors.gray}Run 'stratvibe init' first to create .substrate/schema.json${colors.reset}`);
    process.exit(1);
  }

  try {
    // Load schema version (for display only)
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

    // Read JSON to validate
    let jsonToValidate;
    if (inputSource === '-' && process.stdin.isTTY) {
      // No stdin and no file specified
      console.log(`${colors.gray}Reading JSON from stdin (pipe or redirect)...${colors.reset}`);
      console.log(`${colors.gray}Or specify a file: stratvibe validate handoff.json${colors.reset}`);
      process.exit(1);
    }

    jsonToValidate = readJsonInput(inputSource);

    // Simple structure validation
    const errors = [];

    // Required top-level sections
    const requiredSections = ['handoff', 'context', 'payload', 'reasoning', 'meta'];
    requiredSections.forEach(section => {
      if (!jsonToValidate[section]) {
        errors.push(`Missing top-level section: ${section}`);
      } else if (typeof jsonToValidate[section] !== 'object') {
        errors.push(`Section ${section} must be an object`);
      }
    });

    if (errors.length > 0) {
      console.log(`${colors.red}✗${colors.reset} Handoff JSON invalid`);
      errors.forEach(err => console.log(`${colors.gray}  • ${err}${colors.reset}`));
      process.exit(1);
    }

    // Check handoff fields
    const handoff = jsonToValidate.handoff;
    const handoffRequired = ['id', 'timestamp', 'layer_origin', 'layer_target', 'agent_role', 'status'];
    handoffRequired.forEach(field => {
      if (!handoff[field]) {
        errors.push(`handoff.${field} is required`);
      }
    });

    // Check layer_origin and layer_target values
    const validLayers = ['spec', 'tasks', 'snippets', 'atomic', 'human'];
    if (handoff.layer_origin && !validLayers.includes(handoff.layer_origin)) {
      errors.push(`handoff.layer_origin must be one of: ${validLayers.join(', ')}`);
    }
    if (handoff.layer_target && !validLayers.includes(handoff.layer_target)) {
      errors.push(`handoff.layer_target must be one of: ${validLayers.join(', ')}`);
    }

    // Check agent_role
    const validRoles = ['planner', 'coordinator', 'implementer', 'resolver', 'summarizer'];
    if (handoff.agent_role && !validRoles.includes(handoff.agent_role)) {
      errors.push(`handoff.agent_role must be one of: ${validRoles.join(', ')}`);
    }

    // Check status
    const validStatus = ['pending', 'active', 'blocked', 'done', 'failed'];
    if (handoff.status && !validStatus.includes(handoff.status)) {
      errors.push(`handoff.status must be one of: ${validStatus.join(', ')}`);
    }

    // Check confidence range
    const reasoning = jsonToValidate.reasoning;
    if (reasoning && reasoning.confidence !== undefined) {
      const conf = reasoning.confidence;
      if (typeof conf !== 'number' || conf < 0 || conf > 1) {
        errors.push(`reasoning.confidence must be a number between 0.0 and 1.0`);
      }
    }

    if (errors.length > 0) {
      console.log(`${colors.red}✗${colors.reset} Handoff JSON invalid`);
      errors.forEach(err => console.log(`${colors.gray}  • ${err}${colors.reset}`));
      process.exit(1);
    }

    // Success
    console.log(`${colors.green}✓${colors.reset} Handoff JSON valid`);
    console.log(`${colors.gray}Schema: ${schema.$version || 'v0.1.0'}${colors.reset}`);
    console.log(`${colors.gray}Layers: ${handoff.layer_origin} → ${handoff.layer_target}${colors.reset}`);
    if (reasoning && reasoning.confidence !== undefined) {
      console.log(`${colors.gray}Confidence: ${(reasoning.confidence * 100).toFixed(1)}%${colors.reset}`);
    }
  } catch (error) {
    console.log(`${colors.red}Error:${colors.reset} ${error.message}`);
    process.exit(1);
  }
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

function helpCommand() {
  console.log(`stratvibe - KISS substrate for LLM agent pipelines

Usage:
  stratvibe init           # Initialize substrate v0.1 in current directory
  stratvibe validate       # Validate handoff JSON against schema
  stratvibe connect        # Guide to generate AGENTS.md from plan.md
  stratvibe ignore         # Add .stratvibe/ to .gitignore
  stratvibe eject          # Remove substrate without touching codebase
  stratvibe --help         # Show this help
  stratvibe --version      # Show version

No flags, no prompts, no config.
Just like git init.

Created by R & GIaL - 2026`);
}

/**
 * Show version
 */
function versionCommand() {
  console.log('stratvibe v0.1.0 (substrate v0.1)');
}

/**
 * Main command dispatcher
 */
function main() {
  const args = process.argv.slice(2);

  // No arguments or "init" command
  if (args.length === 0 || args[0] === 'init') {
    initCommand();
    return;
  }

  const command = args[0];

  switch (command) {
    case 'connect':
      connectCommand();
      break;
    case 'validate':
      validateCommand();
      break;
    case 'ignore':
      ignoreCommand();
      break;
    case 'eject':
      ejectCommand();
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