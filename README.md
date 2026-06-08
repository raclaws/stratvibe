# stratvibe

> KISS substrate for LLM agent pipelines.
> One command. One job. No questions asked.

> **This is a vibecoding project.** Built fast, iterated with AI, structured for real use.

**stratvibe** is a project-agnostic cognitive substrate for LLM agent pipelines.  
Structure is stable. Semantics are project-specific. Process is explicit.

Built on **Substrate v0.2** — a formal protocol for human-AI collaboration with visible information loss and non-optional human oversight. Now with an engine layer: inference-powered init, handoff production, and automated compression between layers.

## Philosophy

- **Natural language is human-facing only**  
  No natural language between agents. Structured JSON handoffs only.

- **Context is designed, not assumed**  
  Four layers with decreasing token budgets: spec → tasks → snippets → atomic.

- **Human is non-optional in the pipeline**  
  Cannot be removed, approximated, or delegated. Breaking changes always return to human.

- **Information loss is visible, never silent**  
  Summarizer outputs include `dropped_fields` listing what was omitted.

- **KISS rules**  
  No interactive prompts. No config files. Env vars only.  
  Output is minimal, scannable. Errors are explicit, not verbose.

## Layers & Token Budgets

| Layer | Max Tokens | Role | Purpose |
|-------|------------|------|---------|
| **spec/** | 4096 | Planner | Intent to structure |
| **tasks/** | 2048 | Coordinator | Structure to work units |
| **snippets/** | 1024 | Implementer | Task to implementation |
| **atomic/** | 512 | Resolver | Lookup only, no reasoning |

## Quick Start

### Installation
```bash
npm install -g stratvibe
```

### Initialize a project
```bash
cd your-project
stratvibe init
```

That's it. No prompts, no config, no questions asked.  
Like `git init`, but for substrate pipelines.

### Inference-powered init

Set env vars to enable LLM-powered project analysis on init:

```bash
export STRATVIBE_LLM_URL=https://openrouter.ai/api/v1
export STRATVIBE_LLM_KEY=sk-...
export STRATVIBE_LLM_MODEL=anthropic/claude-sonnet-4-20250514

stratvibe init          # scaffolds + drafts layer content from your project
stratvibe init --deep   # runs genealogy first, then inference-powered init
```

Without env vars, falls back to empty scaffolding (same as v0.1).

### What gets created
```
your-project/
├── .substrate/                 # Core substrate documents
│   ├── taxonomy.md           # Layer definitions, invariant rules
│   ├── schema.json           # Handoff protocol, layer schemas
│   ├── agent-roles.md        # Role responsibilities, cannot rules
│   ├── context-budgets.md    # Token ceilings, compression priority
│   ├── substrate-summary.md  # Meta summary, hard constraints
│   └── handoffs/             # Produced handoff JSON files
├── spec/                      # Intent & constraints
│   ├── architecture/
│   ├── api/
│   └── components/
├── tasks/                     # Bounded work units
│   ├── sprint1/
│   └── backlog/
├── snippets/                  # Reusable implementations
│   ├── components/
│   ├── hooks/
│   └── utilities/
└── atomic/                    # Lookup only
    ├── errors/
    ├── configs/
    └── env-vars/
```

## Commands

### `stratvibe init`
Initializes substrate in current directory. With LLM env vars set, produces draft layer content via inference.

```bash
stratvibe init            # scaffold (+ inference if LLM configured)
stratvibe init --deep     # genealogy first, then inference-powered init
```

### `stratvibe handoff`
Produce a protocol-compliant handoff JSON from agent output. Validates against layer schema, checks token budget, auto-compresses if over budget.

```bash
echo '{"title":"implement auth","effort":"medium"}' | stratvibe handoff --from spec --to tasks --role coordinator
stratvibe handoff --file output.json --from spec --to tasks --role planner
```

### `stratvibe summarize`
Compress content between layers. The Summarizer role — tracks what was dropped.

```bash
echo '{"decision":"...","rationale":"...","notes":"..."}' | stratvibe summarize --from spec --to tasks
```

Requires `STRATVIBE_LLM_URL` to be set.

### `stratvibe feed`
Output a structured context blob for an agent at a given layer. Combines latest handoff + layer state into a single JSON payload.

```bash
stratvibe feed --layer tasks --role coordinator
```

### `stratvibe validate`
Validates handoff JSON against schema. Auto-discovers handoffs if no file specified.

```bash
stratvibe validate handoff.json
stratvibe validate
```

### `stratvibe genealogy`
Legacy code analysis — surfaces deltas between stated intent, actual implementation, and runtime behavior.

```bash
stratvibe genealogy
stratvibe genealogy --target ../some-legacy-project
stratvibe genealogy --no-runtime
stratvibe genealogy --dry
```

See [GENEALOGY.md](GENEALOGY.md) for detailed methodology.

### `stratvibe watch`
Live-refresh dashboard for sprint status and handoff health.

```bash
stratvibe watch
```

### Other commands
- `stratvibe connect` — Guide to generate AGENTS.md from plan.md
- `stratvibe ignore` — Add .stratvibe/ to .gitignore
- `stratvibe eject` — Remove substrate without touching codebase

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `STRATVIBE_LLM_URL` | No | OpenAI-compatible endpoint (enables inference) |
| `STRATVIBE_LLM_KEY` | No | API key for the endpoint |
| `STRATVIBE_LLM_MODEL` | No | Model identifier (default: `anthropic/claude-sonnet-4-20250514`) |

No config files. Env vars only. Provider-agnostic — works with any OpenAI-compatible API (OpenRouter, Ollama, vLLM, etc).

## Core Concepts

### Handoff Protocol
Every agent interaction is a **handoff** — a JSON object that validates against `.substrate/schema.json`.  
Handoffs flow through layers via **summarizer** compression.

### The Engine (v0.2)
Stratvibe is no longer just a scaffold — it's a runtime:
- **Produce** handoffs from agent output (`stratvibe handoff`)
- **Compress** between layers with visible info loss (`stratvibe summarize`)
- **Feed** context to agents at any layer (`stratvibe feed`)
- **Init with inference** — one LLM call drafts all four layers from your project

### Agent Roles
- **Planner** — Intent to structure (spec layer)
- **Coordinator** — Structure to work units (tasks layer)
- **Implementer** — Task to implementation (snippets layer)
- **Resolver** — Lookup only, no reasoning (atomic layer)
- **Summarizer** — Compression between layers, tracks `dropped_fields`
- **Human** — Terminal role, non-optional

### Hard Constraints
1. No natural language between agents
2. No role reasons outside its layer
3. Resolver never infers
4. Summarizer output always smaller than input
5. Breaking changes always return to Human
6. Junk drawer folders forbidden
7. Human cannot be removed from pipeline

## Why Substrate?

Most agent frameworks:
- Assume full autonomy (dangerous)
- Hide information loss (unreliable)
- Mix concerns across layers (confusing)
- Require complex configuration (heavy)

Substrate v0.2:
- **Human-first** — Non-optional oversight
- **Auditable** — Visible information loss via `dropped_fields`
- **Layered** — Clear separation of concerns with token budgets
- **KISS** — No config, no prompts, env vars only
- **Engine** — Produces, compresses, and feeds handoffs (not just validates)

## License
MIT

## Authors
Created by **R & GIaL** — 2026

---

**One command. One job. No questions asked.**
