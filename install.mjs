#!/usr/bin/env node
// KontextKit installer: copies the kit into an existing project. Never deletes anything.
//
//   node install.mjs <project-dir> [--tools claude,codex,cursor,copilot] [--starter <name>] [--force] [--dry-run]
//
// Zero dependencies, Node >= 18, Windows/macOS/Linux.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.join(HERE, 'template');
const STARTERS = path.join(HERE, 'starters');
export const TOOLS = ['claude', 'codex', 'cursor', 'copilot'];
const MANAGED_MARK = /kontextkit:(lite|core|pro)|generator: kontextkit/;
const BLOCK_START = '<!-- kontextkit:start -->';
const BLOCK_END = '<!-- kontextkit:end -->';

const posix = (p) => p.split(path.sep).join('/');

function walk(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p, base) : [posix(path.relative(base, p))];
  });
}

/** Which tool needs a template file? null = always. */
export function toolFor(rel) {
  if (rel.startsWith('.claude/')) return ['claude'];
  if (rel.startsWith('.agents/')) return ['codex', 'cursor']; // Codex skills; Cursor loads .agents/skills too
  if (rel.startsWith('.cursor/')) return ['cursor'];
  if (rel.startsWith('.github/')) return ['copilot'];
  return null;
}

/** Is the template file needed for the selected tools? Cursor also loads .claude/skills, so with
 *  Claude + Cursor (without Codex) the .agents/skills copy would only show every skill twice. */
export function needed(rel, tools) {
  const need = toolFor(rel);
  if (!need) return true;
  if (rel.startsWith('.agents/') && !tools.includes('codex')) return tools.includes('cursor') && !tools.includes('claude');
  // Lite session rule: Cursor reads AGENTS.md natively, which already carries the session block when Codex is set up
  if (rel === '.cursor/rules/kontextkit-session.mdc') return tools.includes('cursor') && !tools.includes('codex');
  return need.some((t) => tools.includes(t));
}

export function parseArgs(argv) {
  const o = { target: null, tools: [...TOOLS], starter: null, force: false, dryRun: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--tools') o.tools = (argv[++i] || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    else if (a.startsWith('--tools=')) o.tools = a.slice(8).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    else if (a === '--starter') o.starter = argv[++i];
    else if (a.startsWith('--starter=')) o.starter = a.slice(10);
    else if (a === '--force') o.force = true;
    else if (a === '--dry-run') o.dryRun = true;
    else if (a === '--help' || a === '-h') o.help = true;
    else if (!a.startsWith('-') && !o.target) o.target = a;
    else throw new Error(`Unbekannte Option: ${a}`);
  }
  for (const t of o.tools) if (!TOOLS.includes(t)) throw new Error(`Unbekanntes Tool "${t}". Erlaubt: ${TOOLS.join(', ')}`);
  if (!o.tools.length) throw new Error('Mindestens ein Tool angeben.');
  return o;
}

function upsertBlock(file, block, log, dryRun, label = file) {
  const exists = fs.existsSync(file);
  const cur = exists ? fs.readFileSync(file, 'utf8') : '';
  const wrapped = `${BLOCK_START}\n${block.trim()}\n${BLOCK_END}`;
  let next;
  const re = /<!-- kontextkit:start -->[\s\S]*?<!-- kontextkit:end -->/;
  if (re.test(cur)) next = cur.replace(re, wrapped);
  else next = cur.trim() ? `${cur.trimEnd()}\n\n${wrapped}\n` : `${wrapped}\n`;
  if (next === cur) return log.push(`= ${label} (Session-Block aktuell)`);
  log.push(`${exists ? '~' : '+'} ${label} (Session-Block ${exists ? 'aktualisiert' : 'angelegt'})`);
  if (!dryRun) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, next); }
}

export async function install(argvOrOpts) {
  const o = Array.isArray(argvOrOpts) ? parseArgs(argvOrOpts) : { tools: [...TOOLS], force: false, dryRun: false, starter: null, ...argvOrOpts };
  if (!o.target) throw new Error('Zielordner fehlt: node install.mjs <projektordner>');
  const root = path.resolve(o.target);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new Error(`Ordner nicht gefunden: ${root}`);
  const core = fs.existsSync(path.join(TEMPLATE, '.agent/kontextkit/sync.mjs'));
  const log = [];
  const rel = (p) => posix(path.relative(root, p)) || '.';

  // 1. copy template files
  for (const f of walk(TEMPLATE)) {
    if (!needed(f, o.tools)) continue;
    const src = path.join(TEMPLATE, f);
    const dst = path.join(root, f);
    const content = fs.readFileSync(src);
    if (fs.existsSync(dst)) {
      const cur = fs.readFileSync(dst);
      if (cur.equals(content)) { log.push(`= ${f}`); continue; }
      const managed = MANAGED_MARK.test(cur.toString('utf8')) || f.startsWith('.agent/kontextkit/');
      if (!managed && !o.force) { log.push(`! ${f} existiert schon, bleibt erhalten (mit --force überschreiben, Backup *.kk-bak)`); continue; }
      if (!managed && !o.dryRun) fs.copyFileSync(dst, `${dst}.kk-bak`);
      log.push(`~ ${f} (aktualisiert${managed ? '' : ', Backup .kk-bak'})`);
    } else log.push(`+ ${f}`);
    if (!o.dryRun) { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.writeFileSync(dst, content); }
  }

  if (!core) {
    // 2a. Lite: add the session block to the instruction files of the chosen tools
    const block = fs.readFileSync(path.join(HERE, 'session-block.md'), 'utf8');
    if (o.tools.includes('codex')) upsertBlock(path.join(root, 'AGENTS.md'), block, log, o.dryRun, 'AGENTS.md');
    if (o.tools.includes('claude')) {
      const claude = path.join(root, 'CLAUDE.md');
      const agentsMd = o.tools.includes('codex') || fs.existsSync(path.join(root, 'AGENTS.md'));
      const importsAgents = fs.existsSync(claude) && /^@AGENTS\.md\s*$/m.test(fs.readFileSync(claude, 'utf8'));
      if (!fs.existsSync(claude) && agentsMd) {
        // Claude Code stops reading AGENTS.md as soon as a CLAUDE.md exists, so a new CLAUDE.md must import it
        const body = o.tools.includes('codex') ? '@AGENTS.md\n' : `@AGENTS.md\n\n${BLOCK_START}\n${block.trim()}\n${BLOCK_END}\n`;
        log.push(`+ ${rel(claude)} (importiert @AGENTS.md${o.tools.includes('codex') ? '' : ' + Session-Block'})`);
        if (!o.dryRun) fs.writeFileSync(claude, body);
      } else if (importsAgents && o.tools.includes('codex')) log.push('= CLAUDE.md importiert @AGENTS.md, der Block steht bereits in AGENTS.md');
      else upsertBlock(claude, block, log, o.dryRun, 'CLAUDE.md');
    }
    if (o.tools.includes('copilot')) upsertBlock(path.join(root, '.github/copilot-instructions.md'), block, log, o.dryRun, '.github/copilot-instructions.md');
    return { root, tier: 'lite', log };
  }

  // 2b. Core/Pro: config, starter, init, sync
  const liteRule = path.join(root, '.cursor/rules/kontextkit-session.mdc');
  if (fs.existsSync(liteRule) && /kontextkit:lite/.test(fs.readFileSync(liteRule, 'utf8'))) {
    log.push('- .cursor/rules/kontextkit-session.mdc (Lite-Regel entfernt, das Session-Protokoll kommt jetzt aus dem Sync)');
    if (!o.dryRun) fs.rmSync(liteRule);
  }
  const cfgFile = path.join(root, '.agent/kontextkit.json');
  const targets = [...new Set(o.tools.map((t) => (t === 'codex' ? 'agents' : t)))];
  if (!fs.existsSync(cfgFile)) {
    log.push('+ .agent/kontextkit.json');
    if (!o.dryRun) fs.writeFileSync(cfgFile, JSON.stringify({
      source: '.agent/context.md', rulesDir: '.agent/rules', targets,
      claude: { mode: 'import' }, cursor: { fullContext: false }, copilot: { mode: 'full' }, sessionProtocol: true,
    }, null, 2) + '\n');
  } else log.push('= .agent/kontextkit.json (bestehende Konfiguration behalten)');

  let base = null;
  if (o.starter) {
    const dir = path.join(STARTERS, o.starter);
    if (!fs.existsSync(dir)) throw new Error(`Starter "${o.starter}" gibt es nicht. Verfügbar: ${walk(STARTERS).map((f) => f.split('/')[0]).filter((v, i, a) => a.indexOf(v) === i).join(', ') || 'keine'}`);
    base = fs.readFileSync(path.join(dir, 'context.md'), 'utf8');
    for (const r of walk(path.join(dir, 'rules'))) {
      const dst = path.join(root, '.agent/rules', r);
      if (fs.existsSync(dst)) { log.push(`! .agent/rules/${r} existiert, bleibt erhalten`); continue; }
      log.push(`+ .agent/rules/${r} (Starter ${o.starter})`);
      if (!o.dryRun) { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(path.join(dir, 'rules', r), dst); }
    }
  }

  if (o.dryRun) { log.push('(dry-run: --init und Sync werden übersprungen)'); return { root, tier: 'core', log }; }

  const sync = await import(pathToFileURL(path.join(root, '.agent/kontextkit/sync.mjs')).href);
  if (!fs.existsSync(path.join(root, '.agent/context.md'))) {
    const r = sync.init(root, { base });
    log.push(`+ .agent/context.md${r.imported.length ? ` (importiert: ${r.imported.join(', ')})` : base ? ` (Starter ${o.starter})` : ' (Vorlage)'}`);
    for (const x of r.rules) log.push(`+ Regel übernommen: ${x}`);
  } else if (base) log.push('! .agent/context.md existiert, Starter-Kontext NICHT übernommen (liegt in starters/)');

  const res = sync.sync(root, {});
  for (const a of res.actions) log.push(`${a.action === 'unchanged' ? '=' : '~'} ${a.path} (${a.action}${a.backup ? ', Backup in .agent/kontextkit/backup/' : ''})`);
  for (const c of res.conflicts) log.push(`✗ ${c.path}: ${c.reason}`);
  for (const w of res.warnings) log.push(`⚠ ${w}`);
  return { root, tier: 'core', log, conflicts: res.conflicts };
}

const HELP = `KontextKit Installer
  node install.mjs <projektordner> [--tools claude,codex,cursor,copilot] [--starter <name>] [--force] [--dry-run]

  --tools     nur diese Tools einrichten (Standard: alle vier)
  --starter   (Pro) Projektvorlage: nextjs-supabase | python-fastapi | expo-react-native
  --force     vorhandene, nicht von KontextKit stammende Dateien überschreiben (Backup *.kk-bak)
  --dry-run   nur anzeigen, was passieren würde`;

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const o = parseArgs(process.argv.slice(2));
    if (o.help || !o.target) { console.log(HELP); process.exit(o.help ? 0 : 1); }
    const r = await install(o);
    console.log(`KontextKit ${r.tier === 'lite' ? 'Lite' : 'Core/Pro'} → ${r.root}${o.dryRun ? ' (dry-run)' : ''}`);
    for (const l of r.log) console.log(`  ${l}`);
    if (r.conflicts && r.conflicts.length) {
      console.log('\nKonflikte: Es wurde nichts überschrieben. Prüfe die Dateien oben, übernimm Wichtiges nach .agent/context.md und starte dann:\n  node .agent/kontextkit/sync.mjs --force');
      process.exitCode = 2;
    } else if (r.tier === 'lite') {
      console.log('\nFertig. Nächste Session: /pickup (Claude Code, Cursor, Copilot) bzw. $pickup (Codex). Am Ende: /handoff.');
    } else {
      console.log('\nFertig. Nächste Schritte:\n  1. .agent/context.md prüfen und kürzen\n  2. node .agent/kontextkit/sync.mjs\n  3. In der nächsten Session: /pickup · am Ende: /handoff');
    }
  } catch (e) {
    console.error(`Fehler: ${e.message}`);
    process.exitCode = 1;
  }
}
