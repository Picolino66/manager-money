#!/usr/bin/env node

/**
 * Valida a AI Documentation Knowledge Layer de um projeto.
 *
 * Verifica integridade referencial entre /docs/.ai/*.json e /docs/**.md,
 * identidade estável das features, freshness e ausência de secrets indexados.
 *
 * Não faz análise estática de código: apenas checa se os caminhos e símbolos
 * declarados apontam para arquivos existentes. Ver knowledge-layer.md.
 */

import fs from 'node:fs';
import path from 'node:path';

const SUPPORTED_SCHEMA_VERSIONS = ['1'];
const REQUIRED_ARTIFACTS = ['index.json', 'features.json', 'freshness.json'];
const REQUIRED_SYSTEM_ARTIFACTS = ['system.json', 'integration-graph.json'];
const FORBIDDEN_SYSTEM_ARTIFACTS = ['features.json', 'code-graph.json'];
const REQUIRED_METADATA = ['schema_version', 'generated_at', 'source_commit', 'generator', 'repository_id'];
const REQUIRED_SYSTEM_METADATA = ['schema_version', 'generated_at', 'generator', 'system_id'];
const REQUIRED_FRONTMATTER = ['id', 'type', 'module', 'title', 'summary', 'code', 'last_verified_commit'];
const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*){0,2}$/;

const SECRET_PATTERNS = [
  { label: 'chave privada', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { label: 'token bearer', regex: /\bBearer\s+[A-Za-z0-9._~+/-]{20,}/ },
  { label: 'connection string com credenciais', regex: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s:@/]+@/i },
  { label: 'chave de acesso AWS', regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { label: 'atribuição de segredo', regex: /"(password|passwd|secret|api_?key|access_?token|private_?key|client_?secret)"\s*:\s*"(?!\s*$)[^"]{8,}"/i },
];

function fail(message) {
  process.stderr.write('Erro: ' + message + '\n');
  process.exit(2);
}

function parseArgs(argv) {
  const options = { docs: '', root: '', json: '', strict: false };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--strict') {
      options.strict = true;
      continue;
    }

    if (argument === '--help' || argument === '-h') {
      process.stdout.write([
        'Uso:',
        '  node scripts/validate-knowledge-layer.mjs --docs <diretório /docs>',
        '',
        'Opções:',
        '  --docs <caminho>   diretório da documentação (padrão: ./docs)',
        '  --root <caminho>   raiz do repositório, usada para resolver os caminhos',
        '                     declarados em "code" (padrão: pai de --docs)',
        '  --json <arquivo>   grava o relatório completo em JSON',
        '  --strict           trata avisos como erros',
        '',
        'Escopo detectado automaticamente:',
        '  repositório  quando existe .ai/index.json',
        '  sistema      quando existe .ai/system.json (raiz multi-repo)',
        '',
        'Saída:',
        '  0  gate aprovado',
        '  1  gate reprovado (erros encontrados)',
        '  2  uso inválido ou estrutura ausente',
        '',
      ].join('\n'));
      process.exit(0);
    }

    const keyMap = { '--docs': 'docs', '--root': 'root', '--json': 'json' };
    const key = keyMap[argument];
    if (!key) fail('argumento desconhecido: ' + argument);

    const value = argv[index + 1];
    if (!value || value.startsWith('--')) fail('valor ausente para ' + argument);
    options[key] = value;
    index += 1;
  }

  options.docs = path.resolve(options.docs || 'docs');
  options.root = path.resolve(options.root || path.dirname(options.docs));
  return options;
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error('JSON inválido em ' + filePath + ': ' + message);
  }
}

function listMarkdown(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listMarkdown(full, acc);
    else if (entry.name.endsWith('.md')) acc.push(full);
  }
  return acc;
}

/** Parser de frontmatter YAML restrito ao subconjunto permitido pela spec. */
function parseFrontmatter(content) {
  if (!content.startsWith('---')) return null;
  const end = content.indexOf('\n---', 3);
  if (end === -1) return null;

  const block = content.slice(content.indexOf('\n') + 1, end + 1);
  const data = {};
  let currentKey = null;
  let folded = null;

  for (const rawLine of block.split('\n')) {
    if (folded !== null) {
      if (/^\s+\S/.test(rawLine)) {
        folded.push(rawLine.trim());
        continue;
      }
      data[currentKey] = folded.join(' ');
      folded = null;
    }

    if (!rawLine.trim()) continue;

    const item = rawLine.match(/^\s+-\s+(.*)$/);
    if (item && currentKey) {
      if (!Array.isArray(data[currentKey])) data[currentKey] = [];
      data[currentKey].push(item[1].trim().replace(/^["']|["']$/g, ''));
      continue;
    }

    const pair = rawLine.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
    if (!pair) continue;

    currentKey = pair[1];
    const value = pair[2].trim();

    if (value === '>' || value === '|') {
      folded = [];
    } else if (value === '') {
      data[currentKey] = [];
    } else if (value.startsWith('[') && value.endsWith(']')) {
      data[currentKey] = value
        .slice(1, -1)
        .split(',')
        .map((part) => part.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else {
      data[currentKey] = value.replace(/^["']|["']$/g, '');
    }
  }

  if (folded !== null) data[currentKey] = folded.join(' ');
  return data;
}

function internalLinks(content) {
  const links = [];
  const regex = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match = regex.exec(content);
  while (match !== null) {
    const target = match[1];
    if (!/^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(target)) links.push(target.split('#')[0]);
    match = regex.exec(content);
  }
  return links.filter(Boolean);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const errors = [];
  const warnings = [];
  const rel = (p) => path.relative(options.root, p) || p;

  if (!fs.existsSync(options.docs)) fail('diretório de docs não encontrado: ' + options.docs);

  const aiDir = path.join(options.docs, '.ai');
  if (!fs.existsSync(aiDir)) fail('camada de recuperação ausente: ' + rel(aiDir));

  // --- artefatos obrigatórios e metadata --------------------------------
  const artifacts = new Map();
  for (const name of fs.readdirSync(aiDir)) {
    if (!name.endsWith('.json')) continue;
    const full = path.join(aiDir, name);
    try {
      artifacts.set(name, readJson(full));
    } catch (error) {
      errors.push(error.message);
    }
  }

  const isSystemScope = artifacts.has('system.json');
  const requiredArtifacts = isSystemScope ? REQUIRED_SYSTEM_ARTIFACTS : REQUIRED_ARTIFACTS;
  const requiredMetadata = isSystemScope ? REQUIRED_SYSTEM_METADATA : REQUIRED_METADATA;

  for (const name of requiredArtifacts) {
    if (!artifacts.has(name)) errors.push('artefato obrigatório ausente: .ai/' + name);
  }

  if (isSystemScope) {
    for (const name of FORBIDDEN_SYSTEM_ARTIFACTS) {
      if (artifacts.has(name)) {
        errors.push('.ai/' + name + ': não pertence ao escopo sistema — feature e estrutura de código vivem no repositório dono');
      }
    }
  }

  for (const [name, data] of artifacts) {
    for (const field of requiredMetadata) {
      if (data[field] === undefined || data[field] === '') {
        errors.push('.ai/' + name + ': metadata obrigatória ausente: ' + field);
      }
    }
    if (data.schema_version !== undefined && !SUPPORTED_SCHEMA_VERSIONS.includes(String(data.schema_version))) {
      errors.push('.ai/' + name + ': schema_version não suportado: ' + data.schema_version);
    }
  }

  // --- secrets ----------------------------------------------------------
  for (const name of fs.readdirSync(aiDir)) {
    const full = path.join(aiDir, name);
    if (!fs.statSync(full).isFile()) continue;
    const raw = fs.readFileSync(full, 'utf8');
    for (const { label, regex } of SECRET_PATTERNS) {
      if (regex.test(raw)) errors.push('.ai/' + name + ': possível secret indexado (' + label + ')');
    }
  }

  // --- escopo sistema: registro de repositórios e travessias --------------
  let repositoriesIndexed = 0;
  let boundaries = 0;
  let dangling = 0;

  if (isSystemScope) {
    const system = artifacts.get('system.json') || {};
    if (system.scope !== undefined && system.scope !== 'system') {
      errors.push('system.json: campo scope deve ser "system", encontrado: ' + String(system.scope));
    }

    const repos = Array.isArray(system.repositories) ? system.repositories : [];
    if (repos.length === 0) errors.push('system.json: nenhum repositório registrado');

    const seenRepos = new Set();
    for (const repo of repos) {
      const id = repo?.repository_id;
      if (!id) {
        errors.push('system.json: repositório sem repository_id');
        continue;
      }
      if (seenRepos.has(id)) errors.push('system.json: repository_id duplicado: ' + id);
      seenRepos.add(id);

      if (repo.indexed === false) {
        if (!repo.reason) errors.push('system.json: ' + id + ' marcado como não indexado sem razão declarada');
        else warnings.push('repositório não indexado: ' + id + ' (' + repo.reason + ')');
        continue;
      }

      const repoPath = repo.path || id;
      const repoDir = path.resolve(options.root, repoPath);
      if (!fs.existsSync(repoDir)) {
        errors.push('system.json: caminho do repositório inexistente: ' + repoPath + ' [' + id + ']');
        continue;
      }

      repositoriesIndexed += 1;

      if (!repo.source_commit) {
        errors.push('system.json: ' + id + ' sem source_commit — impossível detectar agregação desatualizada');
      }

      for (const field of ['docs', 'knowledge_layer']) {
        const target = repo[field];
        if (!target) {
          warnings.push('system.json: ' + id + ' sem campo ' + field);
          continue;
        }
        if (!fs.existsSync(path.resolve(options.root, target))) {
          errors.push('system.json: ' + id + ' aponta para ' + field + ' inexistente: ' + target);
        }
      }
    }

    const graph = artifacts.get('integration-graph.json') || {};
    const known = new Set(repos.map((repo) => repo?.repository_id).filter(Boolean));
    const seenBoundaries = new Set();

    for (const boundary of Array.isArray(graph.boundaries) ? graph.boundaries : []) {
      boundaries += 1;
      const label = boundary?.id || boundary?.contract || '(sem id)';

      if (!boundary?.contract) errors.push('integration-graph.json: travessia sem contrato: ' + label);
      if (!boundary?.transport) errors.push('integration-graph.json: travessia sem transporte: ' + label);

      if (boundary?.id) {
        if (seenBoundaries.has(boundary.id)) {
          errors.push('integration-graph.json: travessia duplicada no escopo sistema: ' + boundary.id);
        }
        seenBoundaries.add(boundary.id);
      }

      const ends = [boundary?.producer, boundary?.consumer];
      const resolved = ends.filter((end) => end && end.repository_id);

      for (const end of resolved) {
        if (!known.has(end.repository_id)) {
          errors.push('integration-graph.json: travessia ' + label + ' referencia repositório não registrado: ' + end.repository_id);
        }
      }

      if (resolved.length < 2) {
        dangling += 1;
        if (boundary?.dangling !== true) {
          errors.push('integration-graph.json: travessia ' + label + ' tem uma ponta só e não está declarada como dangling');
        } else {
          warnings.push('travessia dangling: ' + label);
        }
      }

      const confidence = boundary?.confidence;
      if (!['deterministic', 'high', 'inferred', 'unknown'].includes(confidence)) {
        errors.push('integration-graph.json: travessia ' + label + ' com confidence inválido: ' + String(confidence));
      } else if (['deterministic', 'high'].includes(confidence) && !(Array.isArray(boundary.evidence) && boundary.evidence.length > 0)) {
        errors.push('integration-graph.json: travessia ' + label + ' declarada como ' + confidence + ' sem evidência');
      }
    }
  }

  // --- documentos e frontmatter -----------------------------------------
  const docs = listMarkdown(options.docs);
  const byId = new Map();
  const docPaths = new Set(docs.map((d) => path.relative(options.docs, d)));

  for (const docPath of docs) {
    const label = path.relative(options.docs, docPath);
    const content = fs.readFileSync(docPath, 'utf8');
    const front = parseFrontmatter(content);

    for (const link of internalLinks(content)) {
      const target = path.resolve(path.dirname(docPath), link);
      if (!fs.existsSync(target)) errors.push(label + ': link interno quebrado -> ' + link);
    }

    const isFeatureDoc = label.startsWith('modules' + path.sep) && !label.endsWith('index.md');
    if (!front) {
      if (isFeatureDoc) errors.push(label + ': documento de feature sem frontmatter');
      continue;
    }

    for (const field of REQUIRED_FRONTMATTER) {
      const value = front[field];
      const empty = value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
      if (empty) errors.push(label + ': frontmatter sem campo obrigatório: ' + field);
    }

    if (front.id) {
      if (!ID_PATTERN.test(front.id)) errors.push(label + ': ID fora da gramática estável: ' + front.id);
      if (byId.has(front.id)) errors.push('ID duplicado "' + front.id + '": ' + byId.get(front.id) + ' e ' + label);
      else byId.set(front.id, label);
    }

    for (const codePath of Array.isArray(front.code) ? front.code : []) {
      if (!fs.existsSync(path.resolve(options.root, codePath))) {
        errors.push(label + ': campo code aponta para arquivo inexistente: ' + codePath);
      }
    }

    for (const field of ['keywords', 'aliases', 'code', 'symbols', 'routes', 'entities', 'events', 'depends_on', 'related', 'business_rules', 'adrs', 'tests']) {
      const value = front[field];
      if (Array.isArray(value) && value.length > 10) {
        warnings.push(label + ': frontmatter com lista longa em "' + field + '" (' + value.length + ' itens) — considere dividir a feature');
      }
    }
  }

  // --- features.json <-> documentos --------------------------------------
  const features = artifacts.get('features.json');
  const featureEntries = Array.isArray(features?.features) ? features.features : [];
  const indexedDocs = new Set();
  const indexedIds = new Set();

  for (const entry of featureEntries) {
    const id = entry?.id;
    if (!id) {
      errors.push('features.json: entrada sem id');
      continue;
    }
    if (indexedIds.has(id)) errors.push('features.json: id duplicado no índice: ' + id);
    indexedIds.add(id);

    if (!ID_PATTERN.test(id)) errors.push('features.json: id fora da gramática estável: ' + id);

    const state = entry.state || 'implemented';
    if (entry.doc) {
      indexedDocs.add(entry.doc);
      if (!docPaths.has(entry.doc)) errors.push('features.json: índice aponta para documento inexistente: ' + entry.doc);
      else if (byId.has(id) && byId.get(id) !== entry.doc) {
        errors.push('features.json: id "' + id + '" indexado em ' + entry.doc + ' mas declarado em ' + byId.get(id));
      }
    } else if (state !== 'planned') {
      errors.push('features.json: entrada "' + id + '" sem documento associado');
    }
  }

  for (const [id, label] of byId) {
    if (!label.startsWith('modules' + path.sep) || label.endsWith('index.md')) continue;
    if (!indexedIds.has(id)) errors.push('documento órfão (sem entrada em features.json): ' + label + ' [' + id + ']');
  }

  // --- freshness ---------------------------------------------------------
  const freshness = artifacts.get('freshness.json');
  const entries = freshness?.documents && typeof freshness.documents === 'object' ? freshness.documents : {};
  let staleCritical = 0;
  let stale = 0;
  let fresh = 0;

  for (const [docKey, entry] of Object.entries(entries)) {
    if (!docPaths.has(docKey)) errors.push('freshness.json: entrada para documento inexistente: ' + docKey);
    if (!entry?.last_verified_commit) errors.push('freshness.json: ' + docKey + ' sem last_verified_commit');
    const state = entry?.state;
    if (!['fresh', 'stale', 'stale-critical'].includes(state)) {
      errors.push('freshness.json: ' + docKey + ' com estado inválido: ' + String(state));
      continue;
    }
    if (state === 'stale-critical') {
      staleCritical += 1;
      errors.push('documento em stale-critical: ' + docKey);
    } else if (state === 'stale') {
      stale += 1;
      warnings.push('documento desatualizado (stale): ' + docKey);
    } else {
      fresh += 1;
    }
  }

  for (const docKey of indexedDocs) {
    if (!(docKey in entries)) warnings.push('freshness.json: documento indexado sem entrada de freshness: ' + docKey);
  }

  // --- integridade dos grafos --------------------------------------------
  for (const name of ['code-graph.json', 'integration-graph.json']) {
    const graph = artifacts.get(name);
    if (!graph) continue;

    const nodes = new Set((Array.isArray(graph.nodes) ? graph.nodes : []).map((node) => node?.id).filter(Boolean));
    for (const edge of Array.isArray(graph.edges) ? graph.edges : []) {
      if (!edge?.from || !edge?.to || !edge?.relation) {
        errors.push(name + ': aresta incompleta (from, to e relation são obrigatórios)');
        continue;
      }
      if (nodes.size > 0) {
        if (!nodes.has(edge.from)) errors.push(name + ': aresta referencia node inexistente: ' + edge.from);
        if (!nodes.has(edge.to)) errors.push(name + ': aresta referencia node inexistente: ' + edge.to);
      }
      const confidence = edge.confidence;
      if (!['deterministic', 'high', 'inferred', 'unknown'].includes(confidence)) {
        errors.push(name + ': aresta ' + edge.from + ' -> ' + edge.to + ' com confidence inválido: ' + String(confidence));
      } else if (['deterministic', 'high'].includes(confidence) && !(Array.isArray(edge.evidence) && edge.evidence.length > 0)) {
        errors.push(name + ': aresta ' + edge.from + ' -> ' + edge.to + ' declarada como ' + confidence + ' sem evidência');
      }
    }
  }

  // --- relatório ----------------------------------------------------------
  const report = {
    scope: isSystemScope ? 'system' : 'repository',
    docs: options.docs,
    documents: docs.length,
    features_indexed: featureEntries.length,
    freshness: { fresh, stale, stale_critical: staleCritical },
    system: isSystemScope
      ? { repositories_indexed: repositoriesIndexed, boundaries, dangling_boundaries: dangling }
      : undefined,
    errors,
    warnings,
  };

  if (options.json) {
    fs.mkdirSync(path.dirname(path.resolve(options.json)), { recursive: true });
    fs.writeFileSync(path.resolve(options.json), JSON.stringify(report, null, 2) + '\n', 'utf8');
  }

  for (const warning of warnings) process.stdout.write('Aviso: ' + warning + '\n');
  for (const error of errors) process.stdout.write('Erro: ' + error + '\n');

  const failed = errors.length > 0 || (options.strict && warnings.length > 0);

  const summary = isSystemScope
    ? repositoriesIndexed + ' repositório(s) indexado(s), ' +
      boundaries + ' travessia(s), ' +
      dangling + ' dangling, '
    : featureEntries.length + ' feature(s) indexada(s), ' +
      fresh + ' fresh / ' + stale + ' stale / ' + staleCritical + ' stale-critical, ';

  process.stdout.write(
    (failed ? 'Gate AI-DOC REPROVADO' : 'Gate AI-DOC aprovado') +
      ' [escopo ' + (isSystemScope ? 'sistema' : 'repositório') + ']: ' +
      docs.length + ' documento(s), ' +
      summary +
      errors.length + ' erro(s), ' +
      warnings.length + ' aviso(s).\n'
  );

  process.exit(failed ? 1 : 0);
}

main();
