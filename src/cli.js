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
  gray: '\x1b[90m'
};

// Static template content (verbatim from our design)
const TEMPLATES = {
  'meta/taxonomy.md': `# Taxonomy v0.1

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
4. Junk drawer folders forbidden — if it doesn't fit, taxonomy needs updating not a new misc/ folder
5. Token budgets are ceilings, not targets

**The last rule is important** — junk drawers are where taxonomies die.`,

  'meta/schema.json': `{
 "$schema": "meta/schema.json",
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

  'meta/agent-roles.md': `# Agent Roles v0.1

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

  'meta/context-budgets.md': `# Context Budgets v0.1

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
- Fallback: cl100k_base (GPT‑4 tokenizer)
- Rough estimate beats wrong precision
- Revisit when real budget violations occur

## Compression Priority (Summarizer)
When hitting token limits, drop in order:
1. notes (optional commentary)
2. rationale_ref (reference to full rationale)
3. assumptions (contextual assumptions)
4. dependencies (cross‑references)

**Never drop:** decision, status, flags, confidence`,

  'meta/substrate-summary.md': `# Substrate v0.1 — Meta Summary

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
- When uncertain, set flag — do not infer
- Token budget is a ceiling, not a target
- If input doesn't fit schema, reject and flag — do not reinterpret`
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
  
  // Create meta/ directory first
  if (ensureDir('meta')) {
    console.log(`${colors.green}✓${colors.reset} Created meta/`);
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
  console.log(`${colors.gray}Created: ${createdCount} items, Skipped: ${skippedCount} existing${colors.reset}`);
  
  if (skippedCount > 0) {
    console.log(`\n${colors.yellow}Note: Some files/directories already existed.${colors.reset}`);
    console.log(`${colors.yellow}Use --force to overwrite (not implemented yet).${colors.reset}`);
  }
  
  console.log(`\n${colors.blue}Next:${colors.reset}`);
  console.log(`${colors.gray}  • Read meta/substrate-summary.md for overview${colors.reset}`);
  console.log(`${colors.gray}  • Use stratvibe validate to check handoffs${colors.reset}`);
  console.log(`${colors.gray}  • Start with spec/ architecture decisions${colors.reset}`);
}

/**
 * Validate handoff JSON against schema
 * (Stub - to be implemented)
 */
function validateCommand() {
  console.log(`${colors.blue}🔍 stratvibe validate${colors.reset}`);
  console.log(`${colors.gray}Coming soon. Will validate handoff JSON against schema.${colors.reset}`);
  console.log(`${colors.gray}Use stratvibe init first to create substrate structure.${colors.reset}`);
}

/**
 * Show help
 */
function helpCommand() {
  console.log(`stratvibe - KISS substrate for LLM agent pipelines

Usage:
  stratvibe init           # Initialize substrate v0.1 in current directory
  stratvibe validate       # Validate handoff JSON against schema (coming soon)
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
    case 'validate':
      validateCommand();
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