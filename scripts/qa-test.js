#!/usr/bin/env node

/**
 * stratvibe QA test suite
 * No external test framework — just assertions and exit codes.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BIN = path.join(__dirname, '..', 'bin', 'stratvibe');
const TEST_DIR = path.join(require('os').tmpdir(), `stratvibe-qa-${crypto.randomBytes(4).toString('hex')}`);

let passed = 0;
let failed = 0;
const failures = [];

function run(cmd, opts = {}) {
  try {
    const result = execSync(cmd, {
      cwd: opts.cwd || TEST_DIR,
      encoding: 'utf8',
      env: { ...process.env, ...opts.env },
      input: opts.input || undefined,
      timeout: 10000,
    });
    return { stdout: result, exitCode: 0 };
  } catch (e) {
    return { stdout: e.stdout || '', stderr: e.stderr || '', exitCode: e.status || 1 };
  }
}

function assert(name, condition, detail) {
  if (condition) {
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
    passed++;
  } else {
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    if (detail) console.log(`    \x1b[90m${detail}\x1b[0m`);
    failed++;
    failures.push(name);
  }
}

// Setup
console.log('\x1b[34mSetup\x1b[0m');
fs.mkdirSync(TEST_DIR, { recursive: true });
assert('Test directory created', fs.existsSync(TEST_DIR));

// ─── CLI basics ─────────────────────────────────────────────
console.log('\n\x1b[34mCLI Basics\x1b[0m');

const helpResult = run(`node "${BIN}" --help`);
assert('--help exits 0', helpResult.exitCode === 0);
assert('--help shows commands', helpResult.stdout.includes('stratvibe init'));
assert('--help shows env vars', helpResult.stdout.includes('STRATVIBE_LLM_URL'));

const versionResult = run(`node "${BIN}" --version`);
assert('--version exits 0', versionResult.exitCode === 0);
assert('--version shows v0.2', versionResult.stdout.includes('v0.2'));

const unknownResult = run(`node "${BIN}" foobar`);
assert('Unknown command exits 1', unknownResult.exitCode === 1);

// ─── Init (no LLM) ─────────────────────────────────────────
console.log('\n\x1b[34mInit (no LLM)\x1b[0m');

const initResult = run(`node "${BIN}" init`, { env: { STRATVIBE_LLM_URL: '' } });
assert('init exits 0', initResult.exitCode === 0);
assert('init creates .substrate/', fs.existsSync(path.join(TEST_DIR, '.substrate')));
assert('init creates spec/', fs.existsSync(path.join(TEST_DIR, 'spec')));
assert('init creates tasks/', fs.existsSync(path.join(TEST_DIR, 'tasks')));
assert('init creates snippets/', fs.existsSync(path.join(TEST_DIR, 'snippets')));
assert('init creates atomic/', fs.existsSync(path.join(TEST_DIR, 'atomic')));
assert('init creates schema.json', fs.existsSync(path.join(TEST_DIR, '.substrate', 'schema.json')));
assert('init creates taxonomy.md', fs.existsSync(path.join(TEST_DIR, '.substrate', 'taxonomy.md')));
assert('init creates agent-roles.md', fs.existsSync(path.join(TEST_DIR, '.substrate', 'agent-roles.md')));
assert('init creates plan.md', fs.existsSync(path.join(TEST_DIR, 'plan.md')));

// Idempotent
const initResult2 = run(`node "${BIN}" init`, { env: { STRATVIBE_LLM_URL: '' } });
assert('init is idempotent (exits 0 on re-run)', initResult2.exitCode === 0);
assert('init reports skipped files', initResult2.stdout.includes('Skipped'));

// ─── Handoff ────────────────────────────────────────────────
console.log('\n\x1b[34mHandoff\x1b[0m');

const handoffHelpResult = run(`node "${BIN}" handoff --help`);
assert('handoff --help exits 0', handoffHelpResult.exitCode === 0);

const handoffMissingArgs = run(`node "${BIN}" handoff --from spec`);
assert('handoff without required flags exits 1', handoffMissingArgs.exitCode === 1);

const handoffInput = JSON.stringify({ decision: 'use redis for caching', constraints: ['< 5ms reads'] });
const handoffResult = run(`node "${BIN}" handoff --from spec --to spec --role planner`, { input: handoffInput });
assert('handoff spec→spec exits 0', handoffResult.exitCode === 0);
assert('handoff reports file written', handoffResult.stdout.includes('Handoff written'));

const handoffTaskInput = JSON.stringify({ title: 'Setup redis cluster', acceptance_criteria: ['3 nodes', 'auto-failover'], effort: 'large' });
const handoffTaskResult = run(`node "${BIN}" handoff --from spec --to tasks --role coordinator`, { input: handoffTaskInput });
assert('handoff spec→tasks exits 0', handoffTaskResult.exitCode === 0);
assert('handoff shows token count', handoffTaskResult.stdout.includes('Tokens:'));

const handoffBadContent = run(`node "${BIN}" handoff --from spec --to tasks --role coordinator`, { input: '{"decision":"no title field"}' });
assert('handoff rejects invalid content for target layer', handoffBadContent.exitCode === 1);
assert('handoff error mentions missing field', (handoffBadContent.stdout + (handoffBadContent.stderr || '')).includes('title'));

const handoffBadJson = run(`node "${BIN}" handoff --from spec --to spec --role planner`, { input: 'not json' });
assert('handoff rejects non-JSON stdin', handoffBadJson.exitCode === 1);

// ─── Validate ───────────────────────────────────────────────
console.log('\n\x1b[34mValidate\x1b[0m');

const validateResult = run(`node "${BIN}" validate`);
assert('validate exits 0 on valid handoffs', validateResult.exitCode === 0);
assert('validate finds handoffs', validateResult.stdout.includes('Valid:'));

// Write an invalid handoff file
const badHandoff = JSON.stringify({ handoff: { id: 'x' }, context: {}, payload: {}, reasoning: {}, meta: {} });
const badHandoffPath = path.join(TEST_DIR, '.substrate', 'handoffs', 'handoff-bad-test.json');
fs.writeFileSync(badHandoffPath, badHandoff, 'utf8');
const validateBadResult = run(`node "${BIN}" validate`);
assert('validate detects invalid handoff', validateBadResult.exitCode === 1);
assert('validate reports errors', validateBadResult.stdout.includes('Invalid'));
fs.unlinkSync(badHandoffPath);

// ─── Feed ───────────────────────────────────────────────────
console.log('\n\x1b[34mFeed\x1b[0m');

const feedHelpResult = run(`node "${BIN}" feed --help`);
assert('feed --help exits 0', feedHelpResult.exitCode === 0);

const feedMissingLayer = run(`node "${BIN}" feed`);
assert('feed without --layer exits 1', feedMissingLayer.exitCode === 1);

const feedResult = run(`node "${BIN}" feed --layer tasks --role coordinator`);
assert('feed exits 0', feedResult.exitCode === 0);
let feedJson;
try { feedJson = JSON.parse(feedResult.stdout); } catch { feedJson = null; }
assert('feed outputs valid JSON', feedJson !== null);
assert('feed includes layer field', feedJson && feedJson.layer === 'tasks');
assert('feed includes token_budget', feedJson && feedJson.token_budget === 2048);
assert('feed includes latest_handoff', feedJson && feedJson.latest_handoff !== undefined);
assert('feed includes layer_state', feedJson && feedJson.layer_state !== undefined);

// ─── Summarize (no LLM) ────────────────────────────────────
console.log('\n\x1b[34mSummarize (no LLM)\x1b[0m');

const summarizeNoLlm = run(`node "${BIN}" summarize --from spec --to tasks`, {
  input: '{"decision":"test"}',
  env: { STRATVIBE_LLM_URL: '' }
});
assert('summarize without LLM exits 1', summarizeNoLlm.exitCode === 1);
assert('summarize error mentions STRATVIBE_LLM_URL', (summarizeNoLlm.stdout + (summarizeNoLlm.stderr || '')).includes('STRATVIBE_LLM_URL'));

// ─── Tokens module ──────────────────────────────────────────
console.log('\n\x1b[34mTokens module\x1b[0m');

const { countTokens, getBudget, isOverBudget, LAYER_BUDGETS } = require('../src/tokens');
assert('countTokens returns number', typeof countTokens('hello world') === 'number');
assert('countTokens > 0 for non-empty', countTokens('hello world') > 0);
assert('countTokens 0 for empty', countTokens('') === 0);
assert('getBudget spec = 4096', getBudget('spec') === 4096);
assert('getBudget tasks = 2048', getBudget('tasks') === 2048);
assert('getBudget snippets = 1024', getBudget('snippets') === 1024);
assert('getBudget atomic = 512', getBudget('atomic') === 512);
assert('isOverBudget false for short text', !isOverBudget('hi', 'spec'));
assert('LAYER_BUDGETS has 4 entries', Object.keys(LAYER_BUDGETS).length === 4);

// ─── LLM module ─────────────────────────────────────────────
console.log('\n\x1b[34mLLM module\x1b[0m');

const { isAvailable, getConfig } = require('../src/llm');
const origUrl = process.env.STRATVIBE_LLM_URL;
process.env.STRATVIBE_LLM_URL = '';
assert('isAvailable false without env', !isAvailable());
assert('getConfig null without env', getConfig() === null);
process.env.STRATVIBE_LLM_URL = 'http://localhost:1234/v1';
assert('isAvailable true with env', isAvailable());
const config = getConfig();
assert('getConfig returns url', config && config.url === 'http://localhost:1234/v1');
assert('getConfig returns default model', config && config.model.includes('/'));
process.env.STRATVIBE_LLM_URL = origUrl || '';

// ─── Handoff Producer module ────────────────────────────────
console.log('\n\x1b[34mHandoff Producer module\x1b[0m');

const { validateLayerContent } = require('../src/handoff-producer');
assert('validateLayerContent passes valid spec', validateLayerContent({ decision: 'x' }, 'spec').length === 0);
assert('validateLayerContent fails missing spec.decision', validateLayerContent({ foo: 'x' }, 'spec').length > 0);
assert('validateLayerContent passes valid tasks', validateLayerContent({ title: 'x' }, 'tasks').length === 0);
assert('validateLayerContent fails missing tasks.title', validateLayerContent({ effort: 'x' }, 'tasks').length > 0);
assert('validateLayerContent passes valid snippets', validateLayerContent({ pattern: 'x' }, 'snippets').length === 0);
assert('validateLayerContent passes valid atomic', validateLayerContent({ key: 'x', value: 'y' }, 'atomic').length === 0);
assert('validateLayerContent fails null', validateLayerContent(null, 'spec').length > 0);

// ─── Genealogy ──────────────────────────────────────────────
console.log('\n\x1b[34mGenealogy\x1b[0m');

const genealogyHelpResult = run(`node "${BIN}" genealogy --help`);
assert('genealogy --help exits 0', genealogyHelpResult.exitCode === 0);
assert('genealogy --help shows flags', genealogyHelpResult.stdout.includes('--target'));

const genealogyDryResult = run(`node "${BIN}" genealogy --dry`);
assert('genealogy --dry exits 0', genealogyDryResult.exitCode === 0);
assert('genealogy --dry shows preview', genealogyDryResult.stdout.includes('would scan'));

// ─── Other commands ─────────────────────────────────────────
console.log('\n\x1b[34mOther commands\x1b[0m');

const connectResult = run(`node "${BIN}" connect`);
assert('connect exits 0', connectResult.exitCode === 0);
assert('connect shows instructions', connectResult.stdout.includes('plan.md'));

const ignoreResult = run(`node "${BIN}" ignore`);
assert('ignore exits 0', ignoreResult.exitCode === 0);

// ─── Cleanup ────────────────────────────────────────────────
console.log('\n\x1b[34mCleanup\x1b[0m');
fs.rmSync(TEST_DIR, { recursive: true, force: true });
assert('Test directory removed', !fs.existsSync(TEST_DIR));

// ─── Results ────────────────────────────────────────────────
console.log(`\n\x1b[90m${'─'.repeat(40)}\x1b[0m`);
console.log(`\x1b[32mPassed: ${passed}\x1b[0m  \x1b[31mFailed: ${failed}\x1b[0m  Total: ${passed + failed}`);

if (failures.length > 0) {
  console.log(`\n\x1b[31mFailures:\x1b[0m`);
  failures.forEach(f => console.log(`  • ${f}`));
}

process.exit(failed > 0 ? 1 : 0);
