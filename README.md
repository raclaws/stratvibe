# stratvibe

[![npm version](https://img.shields.io/npm/v/stratvibe.svg)](https://www.npmjs.com/package/stratvibe)
[![npm downloads](https://img.shields.io/npm/dm/stratvibe.svg)](https://www.npmjs.com/package/stratvibe)
[![npm downloads total](https://img.shields.io/npm/dt/stratvibe.svg)](https://www.npmjs.com/package/stratvibe)
[![license](https://img.shields.io/npm/l/stratvibe.svg)](https://github.com/raclaws/stratvibe/blob/main/LICENSE)

> KISS substrate for LLM agent pipelines.
> One command. One job. No questions asked.

> **This is a vibecoding project.** Built fast, iterated with AI, structured for real use.

**stratvibe** is a project‑agnostic cognitive substrate for LLM agent pipelines.  
Structure is stable. Semantics are project‑specific. Process is explicit.

Built on **Substrate v0.1** — a formal protocol for human‑AI collaboration with visible information loss and non‑optional human oversight.

## 🎯 Philosophy

- **Natural language is human‑facing only**  
  No natural language between agents. Structured JSON handoffs only.

- **Context is designed, not assumed**  
  Four layers with decreasing token budgets: spec → tasks → snippets → atomic.

- **Human is non‑optional in the pipeline**  
  Cannot be removed, approximated, or delegated. Breaking changes always return to human.

- **Information loss is visible, never silent**  
  Summarizer outputs include `dropped_fields` listing what was omitted.

- **KISS rules**  
  No interactive prompts. No config files. Flags only when absolutely necessary.  
  Output is minimal, scannable. Errors are explicit, not verbose.

## 🏗️ Layers & Token Budgets

| Layer | Max Tokens | Role | Purpose |
|-------|------------|------|---------|
| **spec/** | 4096 | Planner | Intent to structure |
| **tasks/** | 2048 | Coordinator | Structure to work units |
| **snippets/** | 1024 | Implementer | Task to implementation |
| **atomic/** | 512 | Resolver | Lookup only, no reasoning |

## 🚀 Quick Start

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

### What gets created
```
your-project/
├── .substrate/                 # Core substrate documents
│   ├── taxonomy.md           # Layer definitions, invariant rules
│   ├── schema.json           # Handoff protocol, layer schemas
│   ├── agent-roles.md        # Role responsibilities, cannot rules
│   ├── context-budgets.md    # Token ceilings, compression priority
│   └── substrate-summary.md  # Meta summary, hard constraints
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

## 📚 Core Concepts

### Handoff Protocol
Every agent interaction is a **handoff** — a JSON object that validates against `.substrate/schema.json`.  
Handoffs flow through layers via **summarizer** compression.

### Agent Roles
- **Planner** – Intent to structure (spec layer)
- **Coordinator** – Structure to work units (tasks layer)  
- **Implementer** – Task to implementation (snippets layer)
- **Resolver** – Lookup only, no reasoning (atomic layer)
- **Summarizer** – Compression between layers
- **Human** – Terminal role, non‑optional

### Hard Constraints
1. No natural language between agents
2. No role reasons outside its layer
3. Resolver never infers
4. Summarizer output always smaller than input
5. Breaking changes always return to Human
6. Junk drawer folders forbidden
7. Human cannot be removed from pipeline

## 🔧 Commands

### `stratvibe init`
Initializes substrate v0.1 in current directory.  
Idempotent — skips existing files/directories.

```bash
stratvibe init
stratvibe init --help
```

### `stratvibe validate`
Validates handoff JSON against schema. Auto-discovers handoffs if no file specified.

```bash
stratvibe validate handoff.json
stratvibe validate
```

### `stratvibe watch`
Live-refresh dashboard for sprint status and handoff health.

```bash
stratvibe watch
```

### Other commands
- `stratvibe connect` — Guide to generate AGENTS.md from plan.md
- `stratvibe ignore` — Add .stratvibe/ to .gitignore
- `stratvibe eject` — Remove substrate without touching codebase

### Planned
- `stratvibe run` — Execute agent chain
- `stratvibe sync` — Promote workspace outputs to repo
- Model escalation logic

## 🧠 Why Substrate?

Most agent frameworks:
- Assume full autonomy (dangerous)
- Hide information loss (unreliable)
- Mix concerns across layers (confusing)
- Require complex configuration (heavy)

Substrate v0.1:
- **Human‑first** – Non‑optional oversight
- **Auditable** – Visible information loss
- **Layered** – Clear separation of concerns
- **KISS** – No config, no prompts, just works

## 📄 License
MIT

## 👥 Authors
Created by **R & GIaL** – 2026

---

**One command. One job. No questions asked.**