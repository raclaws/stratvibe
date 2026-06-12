# Changelog

All notable changes to stratvibe will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-04-08

### Added

- **`stratvibe genealogy` command** - Full integration of legacy code analysis feature
  - 4-role agent pipeline: Archivist, Cartographer, Inspector, Genealogist
  - Generates 5 output files: stated-intent.md, actual-implementation.md, actual-behavior.md, lineage.md, delta-report.md
  - Flags: `--target <path>`, `--no-runtime` (skip Inspector), `--dry` (preview)
  - Support for 15+ languages: JavaScript/TypeScript, Python, Go, Rust, Ruby, Java, Kotlin, C/C++, PHP, Swift, Vue, Svelte
- New `src/genealogy/` directory with analysis modules:
  - `archivist.js` - Documentation scanner (README, docs/, comments, git history)
  - `cartographer.js` - Codebase mapper (structure, imports, fossils, orphans)
  - `inspector.js` - Configuration parser (25+ config formats)
  - `genealogist.js` - Synthesis engine (lineage narrative, delta detection)
- `GENEALOGY_COVERAGE.md` - Comprehensive technical documentation of language and feature support

### Changed

- Updated CLI help output to include `stratvibe genealogy`
- README.md now documents the genealogy command with usage examples
- Adjusted documentation to remove references to planned `stratvibe run` and `stratvibe sync` commands

### Fixed

- Resolved missing `colors.cyan` in genealogyCommand (now uses `colors.blue`)

### Internal

- Copied genealogy modules from `experiments/genealogy/` to `src/genealogy/`
- Added genealogy case to main CLI dispatcher
- Added `parseArgs` and `printDryRun` helpers to `genealogyCommand`

---

## [0.1.0] - 2026-04-05

### Added

- Initial release of stratvibe substrate
- Core commands: `init`, `validate`, `connect`, `watch`, `ignore`, `eject`
- 4-layer handoff protocol: spec (4096) → tasks (2048) → snippets (1024) → atomic (512)
- Schema validation via AJV
- Token counting with tiktoken
- Live dashboard with chokidar file watching
- Full documentation (README.md, GENEALOGY.md design spec)

---

### Unreleased

- Model escalation logic for complex agent handoffs
