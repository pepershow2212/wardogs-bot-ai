import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectUserRequest, sanitizeBotOutput } from '../ai/safety.js';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const KNOWLEDGE_DIR = join(rootDir, 'knowledge');
export const LEARNED_PATH = join(KNOWLEDGE_DIR, 'learned.md');
export const LIVE_PATH = join(KNOWLEDGE_DIR, 'live.md');
export const SERVER_MAP_PATH = join(KNOWLEDGE_DIR, 'server-map.md');
export const WEB_PATH = join(KNOWLEDGE_DIR, 'web.md');
export const STUDIED_PATH = join(KNOWLEDGE_DIR, 'studied.md');
export const FILES_DIR = join(KNOWLEDGE_DIR, 'files');

export const FACT_MAX_CHARS = 4000;
export const FILE_MAX_BYTES = 200_000;
export const FILE_MAX_CHARS = 80_000;

const ALLOWED_FILE_EXT = new Set(['.txt', '.md', '.cfg', '.conf', '.ini', '.json', '.list', '.bat']);

const HEADER = `# Проверенные факты сообщества

Сюда попадают только публичные факты, которые модератор добавил командой \`/fact\`.
Не пиши сюда баны, тикеты, логи и личные данные.
`;

export function looksLikeCommunityGuide(text) {
  const t = String(text || '');
  if (
    /zapret|запрет|goodbye\s*dpi|winws|service\.bat|list-general|list-exclude|list-oblucdc|dpi|filter-filter|auto-update|cloudflare|как зайти в discord|обход\s*dpi/i.test(
      t,
    )
  ) {
    return true;
  }

  const lines = t.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length < 6) return false;
  const hostish = lines.filter((line) => /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:$|\s)/i.test(line)).length;
  return hostish >= 5;
}

export function allowedKnowledgeFile(name = '', contentType = '') {
  const ext = extname(String(name || '')).toLowerCase();
  if (ALLOWED_FILE_EXT.has(ext)) return true;
  return /^(text\/|application\/json)/i.test(contentType);
}

function stripPromptFences(text) {
  return String(text || '').replace(/```+/g, '');
}

export function sanitizeFact(text, { maxChars = FACT_MAX_CHARS } = {}) {
  return sanitizeBotOutput(stripPromptFences(text))
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxChars);
}

export function validateFact(text, { maxChars = FACT_MAX_CHARS } = {}) {
  const clean = sanitizeFact(text, { maxChars });
  if (clean.length < 8) {
    return { ok: false, reply: 'Факт слишком короткий. Напиши гайд или одну понятную публичную мысль.' };
  }

  const safety = inspectUserRequest(clean.slice(0, 4000), { allowNsfwRuleFact: true });
  if (!safety.ok) return safety;

  return { ok: true, text: clean };
}

export function appendLearnedFact(text, { title = '' } = {}) {
  const body = String(text || '').trim();
  const heading = title ? `### ${title}\n` : '';
  const block = body.includes('\n') ? `\n${heading}${body}\n` : `${heading ? `\n${heading}` : '- '}${body}\n`;

  if (!existsSync(LEARNED_PATH) || readFileSync(LEARNED_PATH, 'utf8').trim().length === 0) {
    writeFileSync(LEARNED_PATH, `${HEADER}\n${block}`, 'utf8');
    return;
  }
  appendFileSync(LEARNED_PATH, block.startsWith('\n') ? block : `\n${block}`, 'utf8');
}

function safeFileName(name) {
  const base = String(name || 'guide.txt')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return base || 'guide.txt';
}

export function saveKnowledgeFile(originalName, content) {
  mkdirSync(FILES_DIR, { recursive: true });
  const fileName = `${Date.now()}-${safeFileName(originalName)}`;
  const filePath = join(FILES_DIR, fileName);
  writeFileSync(filePath, content, 'utf8');
  return fileName;
}

export function writeGeneratedKnowledge(filePath, text) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, String(text || '').trim() + '\n', 'utf8');
}

function readIfExists(filePath) {
  if (!existsSync(filePath)) return '';
  return readFileSync(filePath, 'utf8').trim();
}

export function loadLearnedAndLiveKnowledge({ maxTotal = 36_000 } = {}) {
  const parts = [];

  const learned = readIfExists(LEARNED_PATH);
  if (learned) parts.push(learned);

  const map = readIfExists(SERVER_MAP_PATH);
  if (map) parts.push(map.slice(0, 8000));

  const web = readIfExists(WEB_PATH);
  if (web) parts.push(web.slice(0, 12_000));

  const studied = readIfExists(STUDIED_PATH);
  if (studied) parts.push(studied.slice(0, 16_000));

  const live = readIfExists(LIVE_PATH);
  if (live) parts.push(live.slice(0, 18_000));

  if (existsSync(FILES_DIR)) {
    const files = readdirSync(FILES_DIR)
      .filter((name) => allowedKnowledgeFile(name))
      .sort()
      .slice(-12);
    for (const name of files) {
      const body = readIfExists(join(FILES_DIR, name)).slice(0, 8000);
      if (body) parts.push(`## Файл ${name}\n${body}`);
    }
  }

  return parts.join('\n\n').slice(0, maxTotal);
}
