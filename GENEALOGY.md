# Stratvibe Genealogy — Comprehensive Guide
> Version: v0.1.0 | Status: Design Phase
> Inspired by Nietzsche's Genealogy of Morals — tracing not what code is, but where it came from.

---

## What It Is

`stratvibe genealogy` is the legacy code extension of the substrate protocol.

Where `stratvibe` assumes greenfield intent, `stratvibe genealogy` assumes
the opposite — intent is buried, decisions are forgotten, and documentation lies.

**The core insight:**

Legacy code is accumulated historical decision made by specific developers
with specific constraints now forgotten. What looks like architecture is
actually constructed meaning that hardened into assumed truth.

Genealogy surfaces that truth structurally before any sprint runs against it.

---

## The Problem With Current Legacy Workflows

**What developers do manually today:**

```
1. Read docs          → understand stated intent
2. Read codebase      → understand actual implementation
3. Run program        → understand actual behavior
4. Build mental model → hold all three in head simultaneously
5. Add context to LLM → informal, unstructured, lossy
6. LLM helps          → confident outputs on incomplete input
```

**Why this fails:**

```
Docs are outdated       → written at v1, code is at v7
Docs are incomplete     → nobody documented the hard parts
Mental model is lossy   → human can't hold everything
Context is informal     → dumped into chat, unstructured
LLM gets partial truth  → confident outputs on incomplete input
```

**The delta nobody captures:**

```
Stated intent     ≠ actual implementation
Actual impl       ≠ actual behavior
Stated intent     ≠ actual behavior
```

Legacy debt lives in these three deltas. Genealogy surfaces them explicitly.

---

## Philosophy

### Why "Genealogy"

Nietzsche's Genealogy of Morals wasn't history for its own sake.
It traced how values got their meaning — not what they are,
but where they came from, who decided, and why they feel inevitable
when they're actually constructed.

Legacy code is the same problem:

```
Nietzsche asks    → why do we call this good?
                    who decided? when? what did they want?

Genealogy asks    → why does this code do this?
                    who decided? when? what were they solving?
```

What looks like universal architecture is accumulated technical decision
made by specific developers with specific deadlines now forgotten.

### The Core Vocabulary

```
Ancestor    → original decision, root cause of current pattern
Lineage     → decision chain over time, how we got here
Mutation    → where intent drifted from original design
Orphan      → code with no traceable intent
Fossil      → dead code that never got removed
Delta       → gap between stated intent and actual truth
```

---

## Three Sources of Truth

Genealogy treats legacy code as having three distinct truth layers
that must be read in isolation before synthesis:

```
Source 1: Stated Intent
  → What documentation says the code does
  → README, docs/, comments, git messages
  → Often outdated, incomplete, aspirational

Source 2: Actual Implementation
  → What the code actually does structurally
  → File structure, patterns, dependencies
  → Current truth, not intended truth

Source 3: Actual Behavior
  → What the running program actually does
  → Runtime state, config values, outputs
  → Ground truth, often contradicts both above
```

**Why isolation matters:**

Reading docs first biases how you read code.
Reading code first biases how you interpret docs.
Each source must be captured clean before synthesis.

---

## Roles

### Archivist

```
responsibility: read and structure existing documentation into stated intent
layer:          spec/genealogy/
input:          docs/, README, comments, git history, changelogs
output:         spec/genealogy/stated-intent.md
model:          Sonnet (comprehension task)
budget:         2048 tokens

cannot:
  - read source code directly
  - run the program
  - make judgment calls on conflicts
  - resolve contradictions unilaterally
  - invent intent not present in documentation

human_trigger:
  - missing documentation for core features
  - contradictory documentation between sources
  - documentation predates major refactor
  - confidence < 0.7 on any stated intent
```

**Output structure:**
```markdown
# Stated Intent

## Purpose
{what documentation says this system does}

## Architecture (as documented)
{documented architecture decisions}

## Known Constraints (as documented)
{documented constraints}

## Confidence Map
| Area          | Confidence | Source          | Notes        |
|---------------|------------|-----------------|--------------|
| Auth system   | 0.9        | docs/auth.md    |              |
| Payment flow  | 0.4        | README (v0.2)   | outdated     |
| Data model    | 0.2        | none found      | undocumented |

## Flags
- orphan: {areas with zero documentation}
- outdated: {docs referencing deprecated patterns}
```

---

### Cartographer

```
responsibility: map existing codebase structure and actual patterns
layer:          spec/genealogy/
input:          codebase, file structure, dependencies, package.json
output:         spec/genealogy/actual-implementation.md
model:          Sonnet (analysis task)
budget:         2048 tokens

cannot:
  - read documentation directly
  - run the program
  - infer intent from pattern alone
  - modify any code
  - assume a pattern is intentional

human_trigger:
  - orphaned modules (no imports, no references)
  - fossil patterns (deprecated dependencies still in use)
  - mutation indicators (inconsistent patterns across codebase)
  - ambiguous architecture boundaries
  - confidence < 0.7 on any structural claim
```

**Output structure:**
```markdown
# Actual Implementation

## Structure Map
{file tree with purpose annotations}

## Dependency Graph
{key dependencies and their roles}

## Patterns Identified
{recurring patterns with confidence scores}

## Anomalies
- fossils:   {dead code, unused modules}
- orphans:   {code with no clear parent intent}
- mutations: {where patterns break consistency}

## Confidence Map
| Component     | Confidence | Evidence              | Notes         |
|---------------|------------|-----------------------|---------------|
| Auth module   | 0.85       | clear boundaries      |               |
| Utils folder  | 0.3        | mixed concerns        | possible junk |
| Legacy/       | 0.1        | no references found   | fossil        |
```

---

### Inspector

```
responsibility: probe running program behavior via MCP and runtime queries
layer:          spec/genealogy/
input:          actual-implementation.md, MCP servers, Resolver
output:         spec/genealogy/actual-behavior.md
model:          Haiku (lookup task, MCP queries)
budget:         512 tokens

cannot:
  - read documentation directly
  - modify code or config
  - infer behavior from code alone
  - assume config values
  - proceed without MCP access (fallback: flag and skip)

human_trigger:
  - behavior contradicts implementation
  - missing runtime data
  - environment mismatch (dev config ≠ prod config)
  - MCP unavailable
  - confidence < 0.7 on any behavioral claim

fallback:
  - if program cannot run → static analysis only
  - flag: runtime_unavailable
  - do not block genealogy chain
```

**Output structure:**
```markdown
# Actual Behavior

## Runtime State
{actual config values, environment, dependencies}

## Behavior Map
{what the program actually does when run}

## Config Reality
| Key              | Documented Value | Actual Value | Match  |
|------------------|------------------|--------------|--------|
| DB_URL           | localhost:5432   | prod-db:5432 | ❌     |
| AUTH_PROVIDER    | internal         | firebase     | ❌     |
| CACHE_TTL        | 3600             | 3600         | ✅     |

## Flags
- mismatch:  {where runtime contradicts documentation}
- undocumented_config: {env vars with no documentation}
- dead_endpoints: {routes defined but never called}

## Availability
runtime_available: true | false
mcp_connected: true | false
analysis_type: runtime | static_fallback
```

---

### Genealogist

```
responsibility: synthesize three sources, map lineage, surface deltas
layer:          spec/genealogy/
input:          stated-intent.md
                actual-implementation.md
                actual-behavior.md
output:         spec/genealogy/lineage.md
                spec/genealogy/delta-report.md
model:          Opus (synthesis + judgment task)
budget:         4096 tokens

cannot:
  - resolve conflicts unilaterally
  - modify code
  - invent missing lineage
  - decide which truth wins (human decides)
  - proceed past high-confidence contradictions without flagging

human_trigger:
  - any delta between two sources
  - confidence < 0.7 on lineage claim
  - breaking contradictions
  - orphans with no traceable ancestor
  - fossils that may still be referenced
```

**Output structure:**
```markdown
# Lineage Report

## Ancestry
{how the system arrived at its current state}
{traceable decision chain from earliest evidence}

## Mutations
{where code drifted from stated intent}
{estimated when, inferred why}

## Delta Map
| Concern       | Stated Intent | Implementation | Behavior | Delta |
|---------------|---------------|----------------|----------|-------|
| Auth          | JWT           | Sessions       | Firebase | HIGH  |
| Data model    | Normalized    | Normalized     | unknown  | LOW   |
| Caching       | Redis         | none found     | none     | HIGH  |

## Orphans
{code with no traceable intent across all three sources}

## Fossils
{dead code still present, risk assessment}

## Confidence Map
{overall confidence per system area}

## Recommended Human Decisions
{explicit list of what human must decide before sprint runs}
```

---

## Execution Flow

```
stratvibe genealogy

1. Scan codebase
   → detect docs/, README, git history
   → detect file structure, dependencies
   → detect MCP availability
        ↓
2. Parallel execution
   → Archivist reads documentation
   → Cartographer reads codebase
   (isolated — no shared context between them)
        ↓
3. Inspector probes runtime
   → via MCP + Resolver
   → fallback to static if unavailable
        ↓
4. Genealogist synthesizes
   → reads all three outputs
   → maps lineage
   → surfaces deltas
   → flags orphans, fossils, mutations
        ↓
5. delta-report.md → Human review
   → Human decides which truth wins
   → Human resolves flagged conflicts
   → Human validates lineage
        ↓
6. Validated spec/genealogy/ becomes sprint input
   → Normal substrate chain runs from here
   → sprint execution proceeds on solid ground
```

---

## Output File Structure

```
spec/
└── genealogy/
    ├── stated-intent.md          Archivist output
    ├── actual-implementation.md  Cartographer output
    ├── actual-behavior.md        Inspector output
    ├── lineage.md                Genealogist synthesis
    └── delta-report.md           Human review document
```

---

## Command Design

### Basic genealogy
```bash
stratvibe genealogy

→ Auto-detects docs, codebase, MCP
→ Runs full 4-role chain
→ Outputs delta-report.md for human review
```

### Skip Inspector (no runtime available)
```bash
stratvibe genealogy --no-runtime

→ Runs Archivist + Cartographer + Genealogist
→ Inspector skipped, flagged in report
→ Static analysis only
```

### Target specific source
```bash
stratvibe genealogy --source docs
stratvibe genealogy --source code
stratvibe genealogy --source runtime
```

### Resume interrupted genealogy
```bash
stratvibe genealogy --resume

→ Reads last checkpoint
→ Skips completed roles
→ Continues from last completed source
```

### Dry run
```bash
stratvibe genealogy --dry

→ Shows what would be analyzed
→ No agents spawned
→ No files written
```

---

## Integration With Sprint Flow

Genealogy outputs feed directly into normal substrate chain:

```
Without genealogy (greenfield):
  Human writes plan.md → continue with sprint

With genealogy (legacy):
  stratvibe genealogy
    → delta-report.md
    → Human validates
    → Human writes plan.md from validated spec/genealogy/
    → continue with sprint on solid ground
```

The sprint chain doesn't change. Only the input to plan.md changes —
instead of human intent alone, it's human intent informed by validated lineage.

---

## Human Review — delta-report.md

The most important output. Structured for fast human decision-making.

```markdown
# Delta Report — Human Review Required

Generated: {timestamp}
Codebase: {path}
Genealogy version: v0.1

## Critical Deltas (resolve before sprint)
{HIGH confidence contradictions between sources}
{explicit yes/no decisions required}

## Orphans (decide fate)
{code with no traceable intent}
{options: document intent | mark for removal | investigate}

## Fossils (decide fate)
{dead code identified}
{options: remove | keep | investigate}

## Low Confidence Areas (validate or skip)
{areas where genealogy couldn't determine truth}

## Recommended plan.md Sections
{pre-filled suggestions based on validated lineage}
{human edits before running sprint}

## Sign-off
[ ] Critical deltas resolved
[ ] Orphan decisions made
[ ] Fossil decisions made
[ ] plan.md updated from lineage
[ ] Ready to proceed with sprint
```

---

## Known Limitations

| Limitation                        | Severity     | Workaround                           |
|-----------------------------------|--------------|--------------------------------------|
| Inspector requires running program | known        | --no-runtime flag, static fallback   |
| Git history may be incomplete      | non-blocking | flag gaps, proceed with available    |
| Docs may predate major refactors   | non-blocking | Archivist flags outdated sources     |
| Fossil detection is probabilistic  | non-blocking | human validates before removal       |
| Mutation timing is inferred        | non-blocking | confidence score reflects uncertainty|
| Large codebases hit token ceilings | known        | scope by directory, run in passes    |

---

## Invariant Rules

1. Archivist never reads code
2. Cartographer never reads docs
3. Inspector never infers — queries only
4. Genealogist never resolves conflicts — surfaces only
5. Human decides which truth wins
6. No sprint runs against unvalidated genealogy output
7. delta-report.md is non-optional human review
8. Fossils are never auto-removed
9. Orphans are never auto-documented
10. Confidence scores are required on every claim

---

## Objective

Surface the delta between what legacy code says it does,
what it actually does structurally, and what it actually does at runtime.

Give human developers a structured, validated starting point
before any agent touches legacy code.

```bash
stratvibe genealogy
```

One command. Three sources of truth. One human decision.
Then sprint with confidence.

---

*What looks like architecture is accumulated historical decision
made by specific developers with specific constraints now forgotten.
Genealogy makes the forgotten visible.*
