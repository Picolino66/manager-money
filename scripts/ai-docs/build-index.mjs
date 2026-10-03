#!/usr/bin/env node
/**
 * Gera a AI Documentation Knowledge Layer (docs/.ai) a partir das fontes canônicas:
 * frontmatter dos documentos em docs/ e lista `features:` das specs em specs/.
 *
 * Uso:
 *   node scripts/ai-docs/build-index.mjs           # regenera docs/.ai/*.json
 *   node scripts/ai-docs/build-index.mjs --check   # falha se índice desatualizado ou stale-critical
 *
 * Nunca edite docs/.ai à mão (ADR-009).
 */
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DOCS = path.join(ROOT, 'docs');
const AI = path.join(DOCS, '.ai');
const SPECS = path.join(ROOT, 'specs');
const CHECK = process.argv.includes('--check');
const REPOSITORY_ID = 'manager-money';
const VOLATILE = new Set(['generated_at', 'source_commit']);
const CRITICAL_TYPES = new Set(['rule', 'integration', 'flow']);

function sha256(text) {
  return 'sha256:' + crypto.createHash('sha256').update(text).digest('hex');
}

function sourceCommit() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
  } catch {
    return 'unknown';
  }
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.name.endsWith('.md')) acc.push(full);
  }
  return acc.sort();
}

// Mesmo dialeto YAML mínimo aceito pelo validador oficial.
function parseFrontmatter(content) {
  if (!content.startsWith('---')) return null;
  const end = content.indexOf('\n---', 3);
  if (end === -1) return null;
  const data = {};
  let key = null;
  let folded = null;
  for (const line of content.slice(content.indexOf('\n') + 1, end + 1).split('\n')) {
    if (folded !== null) {
      if (/^\s+\S/.test(line)) {
        folded.push(line.trim());
        continue;
      }
      data[key] = folded.join(' ');
      folded = null;
    }
    if (!line.trim()) continue;
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && key) {
      if (!Array.isArray(data[key])) data[key] = [];
      data[key].push(item[1].trim().replace(/^["']|["']$/g, ''));
      continue;
    }
    const pair = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
    if (!pair) continue;
    key = pair[1];
    const value = pair[2].trim();
    if (value === '>' || value === '|') folded = [];
    else if (value === '') data[key] = [];
    else if (value.startsWith('[') && value.endsWith(']')) {
      data[key] = value.slice(1, -1).split(',').map((p) => p.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    } else data[key] = value.replace(/^["']|["']$/g, '');
  }
  if (folded !== null) data[key] = folded.join(' ');
  return data;
}

const list = (value) => (Array.isArray(value) ? value : value ? [value] : []);

/** Extrai o corpo de um símbolo (função, const ou método) por contagem de chaves. */
function extractSymbol(source, symbol) {
  const name = symbol.split('.').pop();
  const patterns = [
    new RegExp(`^export\\s+(?:async\\s+)?function\\s+${name}\\b`, 'm'),
    new RegExp(`^export\\s+const\\s+${name}\\b`, 'm'),
    new RegExp(`^(?:async\\s+)?function\\s+${name}\\b`, 'm'),
    new RegExp(`^const\\s+${name}\\b`, 'm'),
    new RegExp(`^\\s+(?:async\\s+)?${name}\\s*\\(`, 'm'),
    new RegExp(`^\\s+(?:async\\s+)?function\\s+${name}\\b`, 'm'),
    new RegExp(`^export\\s+(?:type|class)\\s+${name}\\b`, 'm'),
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(source);
    if (!match) continue;
    const start = match.index;
    if (/\bconst\s/.test(match[0])) {
      // Constantes (inclusive com anotação de tipo): até a primeira linha que fecha na coluna 0.
      const close = /^[\]})][^\n]*$/m.exec(source.slice(start));
      if (close) return source.slice(start, start + close.index + close[0].length);
    }
    const open = source.indexOf('{', start);
    if (open === -1) return source.slice(start, source.indexOf('\n', start));
    let depth = 0;
    for (let i = open; i < source.length; i += 1) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') {
        depth -= 1;
        if (depth === 0) return source.slice(start, i + 1);
      }
    }
  }
  return null;
}

function hashesFor(front) {
  const hashes = {};
  const files = list(front.code).filter((p) => fs.existsSync(path.join(ROOT, p)));
  const sources = files.map((p) => [p, fs.readFileSync(path.join(ROOT, p), 'utf8')]);
  const symbols = list(front.symbols);
  const unresolved = [];
  for (const symbol of symbols) {
    const found = sources.map(([, src]) => extractSymbol(src, symbol)).find(Boolean);
    if (found) hashes[symbol] = sha256(found);
    else unresolved.push(symbol);
  }
  if (symbols.length === 0) for (const [p, src] of sources) hashes[p] = sha256(src);
  return { hashes, unresolved };
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function stripVolatile(value) {
  if (Array.isArray(value)) return value.map(stripVolatile);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).filter(([k]) => !VOLATILE.has(k)).map(([k, v]) => [k, k === 'hash' ? undefined : stripVolatile(v)]),
    );
  }
  return value;
}

function build() {
  const commit = sourceCommit();
  const meta = {
    schema_version: '1',
    generated_at: new Date().toISOString(),
    source_commit: commit,
    generator: 'scripts/ai-docs/build-index.mjs',
    repository_id: REPOSITORY_ID,
  };
  const previous = readJson(path.join(AI, 'freshness.json'))?.documents ?? {};
  const errors = [];
  const features = [];
  const documents = {};
  const modules = [];

  for (const file of walk(DOCS)) {
    const rel = path.relative(DOCS, file);
    const front = parseFrontmatter(fs.readFileSync(file, 'utf8'));
    if (!front?.id) continue;

    const entry = {
      id: front.id,
      type: front.type,
      module: front.module,
      title: front.title,
      summary: front.summary,
      doc: rel,
      state: 'implemented',
    };
    for (const field of ['keywords', 'symbols', 'business_rules', 'adrs', 'tests', 'depends_on']) {
      if (list(front[field]).length) entry[field] = list(front[field]);
    }
    features.push(entry);

    if (front.type === 'module' && rel.startsWith('modules' + path.sep)) {
      modules.push({ id: front.id, title: front.title, doc: rel });
    }

    const { hashes, unresolved } = hashesFor(front);
    for (const symbol of unresolved) errors.push(`${rel}: símbolo não encontrado no código: ${symbol}`);

    const before = previous[rel];
    let state = 'fresh';
    if (before && before.last_verified_commit === front.last_verified_commit) {
      const changed = Object.keys(hashes).some((k) => before.source_hashes?.[k] && before.source_hashes[k] !== hashes[k]);
      if (changed) {
        const critical = list(front.business_rules).length > 0 || CRITICAL_TYPES.has(front.type);
        state = critical ? 'stale-critical' : 'stale';
      } else if (before.state && before.state !== 'fresh') {
        state = before.state;
      }
      // Hashes antigos são preservados até o doc ser re-verificado (novo last_verified_commit).
      if (state !== 'fresh') Object.assign(hashes, Object.fromEntries(Object.entries(before.source_hashes ?? {}).filter(([k]) => k in hashes)));
    }
    documents[rel] = { id: front.id, last_verified_commit: front.last_verified_commit, state, source_hashes: hashes };
  }

  const docIds = new Set(features.map((f) => f.id));
  for (const file of walk(SPECS)) {
    const front = parseFrontmatter(fs.readFileSync(file, 'utf8'));
    if (!front?.spec) continue;
    for (const id of list(front.features)) {
      const existing = features.find((f) => f.id === id);
      if (existing) existing.spec = front.spec;
      else if (!docIds.has(id)) {
        features.push({ id, state: 'planned', spec: front.spec, spec_doc: path.relative(ROOT, file) });
        docIds.add(id);
      }
    }
  }
  features.sort((a, b) => a.id.localeCompare(b.id));
  for (const m of modules) m.features = features.filter((f) => f.module === m.id && f.type === 'feature').length;

  // Suíte de retrieval é autoral (não gerada): apenas referenciada no manifesto.
  const retrievalTests = readJson(path.join(AI, 'retrieval-tests.json'));
  const states = Object.values(documents).map((d) => d.state);
  const featuresJson = { ...meta, features };
  const freshnessJson = { ...meta, documents };
  const artifact = (name, data, count) => ({
    path: `.ai/${name}`,
    count,
    hash: sha256(JSON.stringify(stripVolatile(data))),
  });
  const indexJson = {
    ...meta,
    stack: ['typescript', 'react-native', 'expo', 'zustand', 'supabase', 'postgres'],
    retrieval: 'INDEX FIRST → DOCS SECOND → CODE LAST',
    artifacts: {
      features: artifact('features.json', featuresJson, features.length),
      freshness: artifact('freshness.json', freshnessJson, Object.keys(documents).length),
      ...(retrievalTests
        ? { retrieval_tests: artifact('retrieval-tests.json', retrievalTests, retrievalTests.questions?.length ?? 0) }
        : {}),
    },
    entry_points: {
      business_rules: 'business/business-rules.md',
      requirements: 'business/requirements.md',
      architecture: 'architecture/overview.md',
      contracts: 'architecture/contracts.md',
      journeys: 'flows/journeys.md',
      adrs: '../adr/README.md',
      specs: '../specs/README.md',
      tasks: '../tasks/README.md',
    },
    modules,
    health: {
      fresh: states.filter((s) => s === 'fresh').length,
      stale: states.filter((s) => s === 'stale').length,
      stale_critical: states.filter((s) => s === 'stale-critical').length,
      planned: features.filter((f) => f.state === 'planned').length,
      broken_references: errors.length,
    },
    coverage_exceptions: [
      { scope: 'src/screens', reason: 'telas descritas por feature; símbolos de UI não indexados individualmente' },
      { scope: 'code-graph', reason: 'repositório pequeno; análise de impacto por símbolos do frontmatter (sob demanda)' },
    ],
  };
  return { featuresJson, freshnessJson, indexJson, errors };
}

const out = build();
const files = { 'features.json': out.featuresJson, 'freshness.json': out.freshnessJson, 'index.json': out.indexJson };
const problems = [...out.errors];
const critical = Object.entries(out.freshnessJson.documents).filter(([, d]) => d.state === 'stale-critical');
for (const [doc] of critical) problems.push(`stale-critical: ${doc} — código de regra/contrato mudou sem re-verificar o doc`);

if (CHECK) {
  for (const [name, data] of Object.entries(files)) {
    const disk = readJson(path.join(AI, name));
    if (!disk || JSON.stringify(stripVolatile(disk)) !== JSON.stringify(stripVolatile(data))) {
      problems.push(`docs/.ai/${name} desatualizado — rode \`npm run docs:index\``);
    }
  }
} else {
  fs.mkdirSync(AI, { recursive: true });
  for (const [name, data] of Object.entries(files)) {
    fs.writeFileSync(path.join(AI, name), JSON.stringify(data, null, 2) + '\n');
  }
}

const h = out.indexJson.health;
process.stdout.write(`knowledge layer: ${out.featuresJson.features.length} entradas · fresh ${h.fresh} · stale ${h.stale} · stale-critical ${h.stale_critical} · planned ${h.planned}\n`);
if (problems.length) {
  for (const p of problems) process.stderr.write('✗ ' + p + '\n');
  process.exit(1);
}
