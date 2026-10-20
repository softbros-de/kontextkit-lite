import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const I = await import(path.join(PKG, 'install.mjs'));
const tmp = (files = {}) => {
  const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kk-lite-')));
  for (const [f, c] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); fs.writeFileSync(path.join(d, f), c); }
  return d;
};
const read = (r, f) => fs.readFileSync(path.join(r, f), 'utf8');
const exists = (r, f) => fs.existsSync(path.join(r, f));

/** tiny frontmatter reader for the tests (the Lite kit has no parser of its own) */
function fm(text) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!m) return null;
  const data = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([\w-]+):\s*(.*)$/.exec(line);
    if (kv) data[kv[1]] = kv[2].startsWith('"') ? JSON.parse(kv[2]) : kv[2];
  }
  return data;
}

test('install for all tools: skills, commands, prompts, Cursor rule, session blocks', async () => {
  const root = tmp();
  await I.install({ target: root });
  for (const f of ['.claude/skills/handoff/SKILL.md', '.claude/skills/pickup/SKILL.md', '.agents/skills/handoff/SKILL.md',
    '.agents/skills/pickup/SKILL.md', '.github/prompts/handoff.prompt.md',
    'AGENTS.md', 'CLAUDE.md', '.github/copilot-instructions.md']) assert.ok(exists(root, f), f);
  assert.equal(read(root, 'CLAUDE.md'), '@AGENTS.md\n', 'Claude Code reads AGENTS.md only via import once a CLAUDE.md exists');
  for (const f of ['AGENTS.md', '.github/copilot-instructions.md']) {
    const t = read(root, f);
    assert.match(t, /<!-- kontextkit:start -->\n## Session handoff \(KontextKit Lite\)/);
    assert.equal(t.match(/kontextkit:start/g).length, 1);
  }
  assert.ok(!exists(root, '.cursor/commands'), 'Cursor uses skills; no duplicate legacy commands');
});

test('existing instruction files are appended to, never replaced; re-install is idempotent', async () => {
  const root = tmp({ 'AGENTS.md': '# Team rules\n- use pnpm\n' });
  await I.install({ target: root });
  const once = read(root, 'AGENTS.md');
  assert.match(once, /^# Team rules\n- use pnpm\n\n<!-- kontextkit:start -->/);
  await I.install({ target: root });
  assert.equal(read(root, 'AGENTS.md'), once);
});

test('Claude only + existing AGENTS.md: new CLAUDE.md imports it (never hides the team rules)', async () => {
  const root = tmp({ 'AGENTS.md': '# Team\n- pnpm only\n' });
  await I.install({ target: root, tools: ['claude'] });
  assert.match(read(root, 'CLAUDE.md'), /^@AGENTS\.md\n\n<!-- kontextkit:start -->/);
  assert.equal(read(root, 'AGENTS.md'), '# Team\n- pnpm only\n', 'AGENTS.md untouched when Codex is not selected');
});

test('existing CLAUDE.md without import: block is appended, content kept', async () => {
  const root = tmp({ 'CLAUDE.md': '# Mine\n' });
  await I.install({ target: root, tools: ['claude'] });
  assert.match(read(root, 'CLAUDE.md'), /^# Mine\n\n<!-- kontextkit:start -->/);
});

test('CLAUDE.md that imports @AGENTS.md gets no duplicate block', async () => {
  const root = tmp({ 'CLAUDE.md': '@AGENTS.md\n' });
  await I.install({ target: root });
  assert.equal(read(root, 'CLAUDE.md'), '@AGENTS.md\n');
  assert.match(read(root, 'AGENTS.md'), /KontextKit Lite/);
});

test('skills are not duplicated for Cursor: .agents/skills only when Codex is used or Claude is not', () => {
  assert.equal(I.needed('.agents/skills/handoff/SKILL.md', ['claude', 'cursor']), false);
  assert.equal(I.needed('.agents/skills/handoff/SKILL.md', ['cursor']), true);
  assert.equal(I.needed('.agents/skills/handoff/SKILL.md', ['claude', 'codex', 'cursor']), true);
  assert.equal(I.needed('.claude/skills/handoff/SKILL.md', ['codex']), false);
  assert.equal(I.needed('AGENTS.md', []), true);
  assert.equal(I.needed('.cursor/rules/kontextkit-session.mdc', ['codex', 'cursor']), false, 'AGENTS.md already has the block');
  assert.equal(I.needed('.cursor/rules/kontextkit-session.mdc', ['claude', 'cursor']), true);
});

test('--tools claude only', async () => {
  const root = tmp();
  await I.install({ target: root, tools: ['claude'] });
  assert.ok(exists(root, '.claude/skills/handoff/SKILL.md') && exists(root, 'CLAUDE.md'));
  assert.ok(!exists(root, '.agents') && !exists(root, '.cursor') && !exists(root, '.github') && !exists(root, 'AGENTS.md'));
});

test('foreign files are kept without --force; with --force a .kk-bak backup is written', async () => {
  const root = tmp({ '.github/prompts/handoff.prompt.md': 'my own command\n' });
  await I.install({ target: root });
  assert.equal(read(root, '.github/prompts/handoff.prompt.md'), 'my own command\n');
  await I.install({ target: root, force: true });
  assert.match(read(root, '.github/prompts/handoff.prompt.md'), /kontextkit:lite/);
  assert.equal(read(root, '.github/prompts/handoff.prompt.md.kk-bak'), 'my own command\n');
});

test('skill files: valid frontmatter with name + description; Cursor rule has alwaysApply', () => {
  const tpl = path.join(PKG, 'template');
  for (const dir of ['.claude/skills', '.agents/skills']) {
    for (const name of fs.readdirSync(path.join(tpl, dir))) {
      const d = fm(fs.readFileSync(path.join(tpl, dir, name, 'SKILL.md'), 'utf8'));
      assert.ok(d, `${dir}/${name} has frontmatter`);
      assert.equal(d.name, name);
      assert.ok(d.description.length > 20 && d.description.length <= 1024);
    }
  }
  const rule = fm(fs.readFileSync(path.join(tpl, '.cursor/rules/kontextkit-session.mdc'), 'utf8'));
  assert.equal(rule.alwaysApply, 'true');
  assert.ok(fm(fs.readFileSync(path.join(tpl, '.github/prompts/pickup.prompt.md'), 'utf8')).description);
});

test('CLI dry-run writes nothing', () => {
  const root = tmp();
  const out = execFileSync(process.execPath, [path.join(PKG, 'install.mjs'), root, '--dry-run'], { encoding: 'utf8' });
  assert.match(out, /dry-run/);
  assert.deepEqual(fs.readdirSync(root), []);
});

test('skill names do not shadow built-in commands (checked against the Claude Code commands reference, Oct 2026)', () => {
  // A project skill with a built-in's name replaces it in Claude Code (/resume would lose the session picker);
  // a built-in alias (e.g. /checkpoint → /rewind) would hide the skill instead.
  const reserved = ['resume', 'checkpoint', 'rewind', 'undo', 'recap', 'continue', 'memory', 'compact', 'clear', 'init', 'review', 'new', 'skills', 'status', 'usage', 'cost'];
  for (const name of fs.readdirSync(path.join(PKG, 'template/.claude/skills'))) assert.ok(!reserved.includes(name), name);
});
