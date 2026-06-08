const fs = require('fs');
const path = require('path');
const { chatCompletionJSON } = require('./llm');
const { countTokens, getBudget, LAYER_BUDGETS } = require('./tokens');

const INIT_SYSTEM = `You are a project analyzer for the stratvibe substrate protocol.

Your job: read project files and compress them into a 4-layer structured representation.

Layers:
- spec (${LAYER_BUDGETS.spec} token budget): Project intent, architecture boundaries, key decisions. What the system IS.
- tasks (${LAYER_BUDGETS.tasks} token budget): Current work units, what needs to happen. Bounded, sequenced.
- snippets (${LAYER_BUDGETS.snippets} token budget): Key implementation patterns, reusable modules.
- atomic (${LAYER_BUDGETS.atomic} token budget): Config values, env vars, constants. Lookup only.

Output a JSON object with this exact structure:
{
  "spec": {
    "intent": "one-paragraph project purpose",
    "architecture": ["boundary 1", "boundary 2"],
    "decisions": [{"decision": "...", "rationale": "..."}],
    "constraints": ["constraint 1"]
  },
  "tasks": {
    "active": [{"title": "...", "status": "pending|active|blocked|done", "effort": "small|medium|large"}],
    "backlog": [{"title": "...", "effort": "small|medium|large"}]
  },
  "snippets": {
    "patterns": [{"pattern": "...", "files": ["..."], "description": "..."}],
    "key_modules": [{"name": "...", "purpose": "...", "path": "..."}]
  },
  "atomic": {
    "config": [{"key": "...", "value": "...", "source": "..."}],
    "env_vars": [{"key": "...", "required": true, "description": "..."}],
    "constants": [{"key": "...", "value": "..."}]
  },
  "dropped_fields": ["description of what was omitted and why"],
  "confidence": 0.0-1.0
}

Rules:
- Be concise. Token budgets are ceilings.
- Only include what you can actually derive from the input. Do not invent.
- If information is ambiguous, lower confidence and note it in dropped_fields.
- Output ONLY the JSON object. No markdown fences, no explanation.`;

function scanProjectFiles(targetDir) {
  const files = {};

  const readIfExists = (rel) => {
    const full = path.join(targetDir, rel);
    if (fs.existsSync(full)) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.length < 50000) {
        files[rel] = content;
      } else {
        files[rel] = content.slice(0, 8000) + '\n\n[... truncated ...]';
      }
    }
  };

  readIfExists('README.md');
  readIfExists('README');
  readIfExists('package.json');
  readIfExists('Cargo.toml');
  readIfExists('pyproject.toml');
  readIfExists('go.mod');
  readIfExists('pom.xml');
  readIfExists('Makefile');
  readIfExists('.env.example');
  readIfExists('ARCHITECTURE.md');
  readIfExists('CHANGELOG.md');
  readIfExists('TODO.md');
  readIfExists('BACKLOG.md');

  const tree = buildTree(targetDir, 3);
  files['__tree__'] = tree;

  const entryPoints = findEntryPoints(targetDir);
  for (const ep of entryPoints.slice(0, 3)) {
    readIfExists(ep);
  }

  return files;
}

function buildTree(dir, maxDepth, prefix = '', depth = 0) {
  if (depth >= maxDepth) return '';

  const IGNORE = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', '.venv', 'vendor', 'coverage']);

  let result = '';
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return '';
  }

  entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of entries) {
    if (IGNORE.has(entry.name) || entry.name.startsWith('.')) continue;
    result += `${prefix}${entry.name}${entry.isDirectory() ? '/' : ''}\n`;
    if (entry.isDirectory()) {
      result += buildTree(path.join(dir, entry.name), maxDepth, prefix + '  ', depth + 1);
    }
  }

  return result;
}

function findEntryPoints(dir) {
  const candidates = [
    'src/index.js', 'src/index.ts', 'src/main.js', 'src/main.ts',
    'src/app.js', 'src/app.ts', 'src/cli.js', 'src/cli.ts',
    'index.js', 'index.ts', 'main.js', 'main.ts', 'app.js', 'app.ts',
    'lib/index.js', 'lib/main.js',
    'src/lib.rs', 'src/main.rs', 'main.go', 'cmd/main.go',
    'app.py', 'main.py', 'src/main.py',
  ];

  const found = [];
  for (const c of candidates) {
    if (fs.existsSync(path.join(dir, c))) {
      found.push(c);
    }
  }

  if (found.length === 0) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
      if (pkg.main) found.push(pkg.main);
    } catch {}
  }

  return found;
}

async function runInitInference(targetDir) {
  const projectFiles = scanProjectFiles(targetDir);

  if (Object.keys(projectFiles).length === 0) {
    return { success: false, error: 'No project files found to analyze.' };
  }

  const userMessage = `Analyze this project and produce the structured layer representation.

Project files:
${Object.entries(projectFiles).map(([name, content]) => `--- ${name} ---\n${content}`).join('\n\n')}`;

  const inputTokens = countTokens(userMessage);

  const result = await chatCompletionJSON({
    system: INIT_SYSTEM,
    messages: [{ role: 'user', content: userMessage }],
    maxTokens: 4096,
    temperature: 0.2,
  });

  const layers = result.data;

  return {
    success: true,
    layers,
    meta: {
      input_tokens: inputTokens,
      files_scanned: Object.keys(projectFiles).length,
      model: result.model,
      confidence: layers.confidence || 0.5,
      dropped_fields: layers.dropped_fields || [],
    }
  };
}

function writeDraftLayers(targetDir, layers) {
  const written = [];

  if (layers.spec) {
    const specDir = path.join(targetDir, 'spec');
    if (!fs.existsSync(specDir)) fs.mkdirSync(specDir, { recursive: true });
    const specPath = path.join(specDir, 'draft-init.md');
    const specContent = renderSpec(layers.spec);
    fs.writeFileSync(specPath, specContent, 'utf8');
    written.push('spec/draft-init.md');
  }

  if (layers.tasks) {
    const tasksDir = path.join(targetDir, 'tasks');
    if (!fs.existsSync(tasksDir)) fs.mkdirSync(tasksDir, { recursive: true });
    const tasksPath = path.join(tasksDir, 'draft-init.md');
    const tasksContent = renderTasks(layers.tasks);
    fs.writeFileSync(tasksPath, tasksContent, 'utf8');
    written.push('tasks/draft-init.md');
  }

  if (layers.snippets) {
    const snippetsDir = path.join(targetDir, 'snippets');
    if (!fs.existsSync(snippetsDir)) fs.mkdirSync(snippetsDir, { recursive: true });
    const snippetsPath = path.join(snippetsDir, 'draft-init.md');
    const snippetsContent = renderSnippets(layers.snippets);
    fs.writeFileSync(snippetsPath, snippetsContent, 'utf8');
    written.push('snippets/draft-init.md');
  }

  if (layers.atomic) {
    const atomicDir = path.join(targetDir, 'atomic');
    if (!fs.existsSync(atomicDir)) fs.mkdirSync(atomicDir, { recursive: true });
    const atomicPath = path.join(atomicDir, 'draft-init.md');
    const atomicContent = renderAtomic(layers.atomic);
    fs.writeFileSync(atomicPath, atomicContent, 'utf8');
    written.push('atomic/draft-init.md');
  }

  return written;
}

function renderSpec(spec) {
  let md = '# Spec — Draft (auto-generated)\n\n';
  if (spec.intent) md += `## Intent\n${spec.intent}\n\n`;
  if (spec.architecture && spec.architecture.length > 0) {
    md += '## Architecture Boundaries\n';
    spec.architecture.forEach(a => { md += `- ${a}\n`; });
    md += '\n';
  }
  if (spec.decisions && spec.decisions.length > 0) {
    md += '## Key Decisions\n';
    spec.decisions.forEach(d => { md += `- **${d.decision}** — ${d.rationale || 'no rationale given'}\n`; });
    md += '\n';
  }
  if (spec.constraints && spec.constraints.length > 0) {
    md += '## Constraints\n';
    spec.constraints.forEach(c => { md += `- ${c}\n`; });
    md += '\n';
  }
  return md;
}

function renderTasks(tasks) {
  let md = '# Tasks — Draft (auto-generated)\n\n';
  if (tasks.active && tasks.active.length > 0) {
    md += '## Active\n';
    tasks.active.forEach(t => { md += `- [${t.status === 'done' ? 'x' : ' '}] ${t.title} (${t.effort || 'unknown'})\n`; });
    md += '\n';
  }
  if (tasks.backlog && tasks.backlog.length > 0) {
    md += '## Backlog\n';
    tasks.backlog.forEach(t => { md += `- [ ] ${t.title} (${t.effort || 'unknown'})\n`; });
    md += '\n';
  }
  return md;
}

function renderSnippets(snippets) {
  let md = '# Snippets — Draft (auto-generated)\n\n';
  if (snippets.patterns && snippets.patterns.length > 0) {
    md += '## Patterns\n';
    snippets.patterns.forEach(p => {
      md += `### ${p.pattern}\n${p.description || ''}\nFiles: ${(p.files || []).join(', ')}\n\n`;
    });
  }
  if (snippets.key_modules && snippets.key_modules.length > 0) {
    md += '## Key Modules\n';
    snippets.key_modules.forEach(m => { md += `- **${m.name}** (${m.path}) — ${m.purpose}\n`; });
    md += '\n';
  }
  return md;
}

function renderAtomic(atomic) {
  let md = '# Atomic — Draft (auto-generated)\n\n';
  if (atomic.config && atomic.config.length > 0) {
    md += '## Config\n| Key | Value | Source |\n|-----|-------|--------|\n';
    atomic.config.forEach(c => { md += `| ${c.key} | ${c.value} | ${c.source} |\n`; });
    md += '\n';
  }
  if (atomic.env_vars && atomic.env_vars.length > 0) {
    md += '## Environment Variables\n| Key | Required | Description |\n|-----|----------|-------------|\n';
    atomic.env_vars.forEach(e => { md += `| ${e.key} | ${e.required ? 'yes' : 'no'} | ${e.description} |\n`; });
    md += '\n';
  }
  if (atomic.constants && atomic.constants.length > 0) {
    md += '## Constants\n| Key | Value |\n|-----|-------|\n';
    atomic.constants.forEach(c => { md += `| ${c.key} | ${c.value} |\n`; });
    md += '\n';
  }
  return md;
}

module.exports = { runInitInference, writeDraftLayers, scanProjectFiles };
