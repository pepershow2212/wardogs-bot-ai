import { loadKnowledge } from '../config.js';
import { LIVE_PATH, SERVER_MAP_PATH, STUDIED_PATH } from './knowledge.js';
import { readFileSync, existsSync } from 'node:fs';

const STOP = new Set([
  'как', 'что', 'это', 'для', 'или', 'при', 'без', 'над', 'под', 'про', 'там', 'тут',
  'меня', 'тебе', 'меня', 'есть', 'если', 'тоже', 'только', 'можно', 'нужно', 'скажи',
  'the', 'and', 'for', 'you', 'are',
]);

const BOOST = [
  ['запрет', ['zapret', 'winws', 'dpi', 'service', 'конфиг']],
  ['zapret', ['запрет', 'winws', 'dpi']],
  ['отряд', ['поиск', 'lfg', 'пати']],
  ['правил', ['rules', 'муты']],
  ['канал', ['каналы', 'карта', 'discord', 'сервер']],
  ['роль', ['роли']],
  ['сервер', ['карта', 'каналы', 'роли', 'discord', 'форум']],
  ['discord', ['карта', 'каналы', 'роли', 'сервер']],
  ['изуч', ['карта', 'каналы', 'роли', 'база', 'гайд']],
];

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP.has(word));
}

function expand(tokens) {
  const extra = [];
  for (const token of tokens) {
    for (const [key, aliases] of BOOST) {
      if (token.includes(key) || key.includes(token)) extra.push(...aliases);
    }
  }
  return [...new Set([...tokens, ...extra])];
}

function chunkKnowledge(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  const blocks = raw.split(/\n(?=#{1,3}\s)/);
  const chunks = [];
  for (const block of blocks) {
    const trimmed = block.trim();
    if (trimmed.length < 40) continue;
    if (trimmed.length <= 1200) {
      chunks.push(trimmed);
      continue;
    }
    for (let i = 0; i < trimmed.length; i += 1000) {
      chunks.push(trimmed.slice(i, i + 1200));
    }
  }
  return chunks.slice(0, 80);
}

function scoreChunk(chunk, tokens) {
  const hay = chunk.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (!hay.includes(token)) continue;
    score += token.length > 5 ? 3 : 1;
    if (hay.slice(0, 120).includes(token)) score += 2;
  }
  return score;
}

export function retrieveKnowledge(query, { limit = 5, maxChars = 12000 } = {}) {
  const knowledge = loadKnowledge();
  const tokens = expand(tokenize(query));
  const wantsServer = /сервер|discord|канал|роль|изуч|карта|форум|гайд|база/i.test(String(query || ''));

  const extras = [];
  if (wantsServer) {
    for (const filePath of [SERVER_MAP_PATH, LIVE_PATH, STUDIED_PATH]) {
      if (!existsSync(filePath)) continue;
      extras.push(readFileSync(filePath, 'utf8').trim().slice(0, 6000));
    }
  }

  if (!tokens.length) {
    return [extras.join('\n\n'), knowledge.slice(0, 8000)].filter(Boolean).join('\n\n').slice(0, maxChars);
  }

  const ranked = chunkKnowledge(knowledge)
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, tokens) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.chunk);

  const body = [...extras, ...(ranked.length ? ranked : [knowledge.slice(0, 8000)])].join('\n\n');
  return body.slice(0, maxChars);
}
