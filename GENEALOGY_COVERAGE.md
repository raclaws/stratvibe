# Genealogy Language & Feature Coverage

> **v0.1.0** — Comprehensive analysis capabilities across languages and frameworks

stratvibe genealogy provides broad multi-language support for legacy code analysis. This document outlines all supported technologies, file types, and detection patterns.

---

## 📊 Overview

| Component | Status | Notes |
|------------|--------|-------|
| Code analysis | ✅ | 15+ languages via import patterns |
| Documentation | ✅ | Markdown, plain text, comments |
| Configuration | ✅ | 25+ config formats |
| Git history | ✅ | Requires git repository |
| Runtime probing | ⚠️ | Limited to config files, no live execution |

---

## 💻 Code Analysis (Cartographer)

### Supported Languages & Extensions

**JavaScript/TypeScript Ecosystem**
- `.js`, `.mjs`, `.cjs` — JavaScript (CommonJS, ES Modules)
- `.ts`, `.tsx` — TypeScript and React
- `.jsx` — React JSX
- `.vue` — Vue.js single-file components
- `.svelte` — Svelte components

**Python**
- `.py` — Python source files

**Systems Languages**
- `.go` — Go
- `.rs` — Rust
- `.c`, `.cpp`, `.h`, `.hpp` — C/C++

**Enterprise Languages**
- `.java` — Java
- `.kt` — Kotlin
- `.rb` — Ruby
- `.php` — PHP (including Laravel patterns)
- `.swift` — Swift

**Web Templates**
- `.tpl` — Generic templates
- `.blade.php` — Laravel Blade templates
- `.html`, `.htm` — HTML files

**Note:** The cartographer detects imports/exports across mixed-language projects using regex patterns. It normalizes path separators and tries candidate extensions for resolved imports.

### Import/Include Patterns Detected

**Node.js / JavaScript**
```regex
require\s*\(\s*['"]([^'"]+)['"]\s*\)
import\s+(?:.*?\s+from\s+)?['"]([^'"]+)['"]
import\s*\(\s*['"]([^'"]+)['"]\s*\)
from\s+['"]([^'"]+)['"]
```

**PHP**
```regex
require(?:_once)?\s+['"]([^'"]+)['"]
include(?:_once)?\s+['"]([^'"]+)['"]
(?:require|include)(?:_once)?\s*\(\s*[A-Z_]+\s*\.\s*['"]([^'"]+)['"]\s*\)
(?:require|include)(?:_once)?\s*\(\s*__DIR__\s*\.\s*['"]([^'"]+)['"]\s*\)
```

**Dynamic / Framework Patterns**
```regex
<script[^>]+src=['"]([^'"]+)['"]    # HTML script tags
<link[^>]+href=['"]([^'"]*\.css)['"] # HTML link tags
fetch\s*\(\s*['"]([^'"]+)['"]        # Fetch API
axios\.(?:get|post|put|delete)\s*\(\s*['"]([^'"]+)['"] # Axios
\$\.ajax\s*\(\s*\{[^}]*url\s*:\s*['"]([^'"]+)['"]   # jQuery
\$\.(?:get|post)\s*\(\s*['"]([^'"]+)['"]             # jQuery shortcuts
loadModule\s*\(\s*['"]([^'"]+)['"]                    # Custom loader (observed in some PHP)
ModuleUtility::loadModule\s*\(\s*['"]([^'"]+)['"]     # PHP utility pattern
```

---

## 📚 Documentation Analysis (Archivist)

### Document Sources

**Primary Documentation Files**
- `README.md`, `README.txt`, `README`
- `CHANGELOG.md`, `CHANGELOG.txt`, `CHANGELOG`
- `CONTRIBUTING.md`, `CONTRIBUTING.txt`
- `ARCHITECTURE.md`, `ARCHITECTURE.txt`
- `DESIGN.md`, `DESIGN.txt`

**Documentation Directories**
- `docs/` — Most common
- `documentation/` — Full spelling
- `doc/` — Short form
- `wiki/` — Git-style wiki

**Comment Extraction**

| Language | Pattern | Example |
|----------|---------|---------|
| JS/TS | `/**([\\s\\S]*?)\*/` | JSDoc blocks |
| Python | `"""([\\s\\S]*?)"""` or `'''([\\s\\S]*?)'''` | Docstrings |
| Rust | `///(.*)` (line-by-line) | Rustdoc comments |

**Git History**
- Uses `git log --oneline --since="1 year ago" -50`
- Requires git repository in target directory
- Graceful fallback if git unavailable

**Confidence Factors**
- Content length (>100 chars: +0.2, >1000 chars: +0.1)
- Recency (<30 days: +0.15, 30-180: +0.05, >365: -0.2)
- Base score: 0.5, clamped to [0.0, 1.0]

---

## ⚙️ Configuration & Runtime (Inspector)

### Detected Configuration Files

**Package Managers**
- `package.json` — npm/yarn (scripts, engines, main)
- `composer.json` — PHP Composer (require, require-dev)

**Environment & Secrets**
- `.env`
- `.env.local`
- `.env.production`
- `.env.development`
- `.env.example`

**Containerization**
- `docker-compose.yml`
- `docker-compose.yaml`
- `Dockerfile`

**TypeScript / JavaScript**
- `tsconfig.json`
- `jsconfig.json`
- `.babelrc`
- `.eslintrc`
- `.eslintrc.json`
- `.eslintrc.js`

**Build Tools & Frameworks**
- `webpack.config.js`
- `vite.config.js`
- `vite.config.ts`
- `next.config.js`
- `next.config.mjs`
- `tailwind.config.js`

**Testing**
- `jest.config.js`
- `jest.config.ts`
- `playwright.config.js`
- `cypress.config.js`

**Development Tools**
- `nodemon.json`
- `.nvmrc`
- `.node-version`

**Sensitivity Detection**
The inspector marks configuration entries as `sensitive: true` if the key likely contains secrets:
- Keys matching: `password`, `secret`, `key`, `token`, `auth`, `credential`
- Values that look like: JWT tokens, long base64 strings, hashes

**Static Analysis Only**
The genealogy feature does **not** execute the target program. It performs static file analysis and config parsing only. Runtime behavior is inferred from configuration files and package.json scripts.

---

## 🚫 Known Limitations

| Limitation | Severity | Mitigation |
|------------|----------|------------|
| Dynamic imports (`import()` with variable paths) | Medium | May miss some dependencies |
| Template-engine routes (e.g., Laravel, Express views) | Medium | Entry point detection can be incomplete |
| Composer autoloading (PSR-4) without explicit requires | Low | Cartographer may over-flag orphans |
| Git history truncation (shallow clones) | Low | Falls back to available commits |
| Config file outside standard locations | Low | Only scans known patterns |
| Monorepos with nested package.json files | Medium | Scans entire tree; may mix concerns |
| Very large codebases (>10k files) | Medium | May hit system file limits; can scope with `--target` |

---

## 📈 Detection Confidence

The genealogist computes confidence scores for each analysis component:

**High Confidence (≥0.9)**
- File structure mapping (direct filesystem scan)
- Dependency list from package.json/composer.json
- Documentation presence (README, docs/ directory)

**Medium Confidence (0.6-0.8)**
- Import graph (regex-based, misses dynamic imports)
- Fossil detection (import reference count heuristic)
- Orphan detection (entry point heuristics)
- Comment extraction (pattern matching)

**Low Confidence (<0.6)**
- Mutation timing (inferred from patterns)
- Architectural eras (synthetic narrative)
- Configuration reality (static parsing only)

---

## 🎯 Recommended Use Cases

Genealogy works best with:

1. **JavaScript/TypeScript projects** (npm, Next.js, React, Vue)
2. **Python codebases** (Django, Flask, plain scripts)
3. **PHP applications** (Laravel, WordPress plugins, legacy apps)
4. **Mixed-language legacy systems** (gradual migrations)
5. **Monorepos** (analyze subdirectories individually)

### Less Ideal For
- **Pure data/science notebooks** (`.ipynb`) — no import analysis
- **Binary-only deployments** (Docker images without source)
- **Minimal documentation** — genealogy still works but confidence drops
- **Obfuscated/minified code** — import detection may fail
- **Build-generated code** (e.g., dist/ directories) — should be excluded

---

## 📝 Output Structure

All outputs are Markdown (`.md`) for easy human reading:

```
genealogy/
├── stated-intent.md          # Archivist findings
├── actual-implementation.md  # Cartographer findings
├── actual-behavior.md        # Inspector findings
├── lineage.md                # Genealogist synthesis
└── delta-report.md           # Human review checklist
```

---

## 🔧 Extensibility

To add support for a new language or framework:

1. **Add file extension** to `CODE_EXTENSIONS` in `cartographer.js:4`
2. **Add import patterns** to `IMPORT_PATTERNS` in `cartographer.js:24`
3. **Add comment patterns** to `COMMENT_PATTERNS` in `archivist.js:15`
4. **Add config file handler** to `CONFIG_PATTERNS` in `inspector.js:4`

All patterns use JavaScript RegExp with global flag.

---

**One command. Three sources of truth. One human decision.**
