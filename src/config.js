import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLearnedAndLiveKnowledge } from './lib/knowledge.js';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Не задана переменная окружения ${name}. Скопируй .env.example в .env и заполни значения.`);
  }
  return value;
}

function bool(name, fallback = false) {
  const value = process.env[name];
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function list(name) {
  return (process.env[name] || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function idList(name) {
  return (process.env[name] || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const maxContext = Number(process.env.MAX_CONTEXT_MESSAGES || 8);
const memoryTurns = Number(process.env.MEMORY_TURNS || 6);
const memoryTtl = Number(process.env.MEMORY_TTL_MINUTES || 20);
const aiConcurrency = Number(process.env.AI_CONCURRENCY || 2);
const knowledgeSyncMinutes = Number(process.env.KNOWLEDGE_SYNC_MINUTES || 30);
const mentionCooldown = Number(process.env.MENTION_COOLDOWN_SECONDS || 180);
const mentionChannelCooldown = Number(process.env.MENTION_CHANNEL_COOLDOWN_SECONDS || 45);

export const config = {
  rootDir,
  discordToken: required('DISCORD_TOKEN'),
  discordClientId: required('DISCORD_CLIENT_ID'),
  discordGuildId: process.env.DISCORD_GUILD_ID?.trim() || '',
  openaiApiKey: required('OPENAI_API_KEY'),
  openaiBaseUrl: (process.env.OPENAI_BASE_URL || 'https://api.proxyapi.ru/v1').replace(/\/$/, ''),
  openaiModel: process.env.OPENAI_MODEL || 'openai/gpt-4o-mini',
  siteUrl: process.env.SITE_URL || 'https://discord.com',
  siteName: process.env.SITE_NAME || 'WARDOGS BOT AI',
  enableMentions: bool('ENABLE_MENTIONS', true),
  enableDms: bool('ENABLE_DMS', false),
  adminChannelIds: new Set(idList('ADMIN_CHANNEL_IDS')),
  allowedChannelIds: new Set(idList('ALLOWED_CHANNEL_IDS')),
  rulesChannelIds: new Set(idList('RULES_CHANNEL_IDS')),
  knowledgeChannelIds: new Set(idList('KNOWLEDGE_CHANNEL_IDS')),
  readChannelRules: bool('READ_CHANNEL_RULES', true),
  syncPublicKnowledge: bool('SYNC_PUBLIC_KNOWLEDGE', true),
  knowledgeSyncMs: Math.max(10, Number.isFinite(knowledgeSyncMinutes) ? knowledgeSyncMinutes : 30) * 60_000,
  staffChannelPatterns: list('STAFF_CHANNEL_PATTERNS'),
  maxContextMessages: Math.min(10, Math.max(5, Number.isFinite(maxContext) ? maxContext : 8)),
  userRateLimit: Math.max(1, Number(process.env.USER_RATE_LIMIT_PER_MINUTE || 6)),
  mentionCooldownMs: Math.max(30, Number.isFinite(mentionCooldown) ? mentionCooldown : 180) * 1000,
  mentionChannelCooldownMs: Math.max(10, Number.isFinite(mentionChannelCooldown) ? mentionChannelCooldown : 45) * 1000,
  memoryTurns: Math.min(6, Math.max(4, Number.isFinite(memoryTurns) ? memoryTurns : 6)),
  memoryTtlMs: Math.max(5, Number.isFinite(memoryTtl) ? memoryTtl : 20) * 60_000,
  aiConcurrency: Math.min(4, Math.max(1, Number.isFinite(aiConcurrency) ? aiConcurrency : 2)),
  maxQueueSize: Math.max(3, Number(process.env.MAX_QUEUE_SIZE || 8)),
};

function resolveDataFile(envName, fallbackParts) {
  const customPath = process.env[envName]?.trim();
  if (!customPath) return join(rootDir, ...fallbackParts);
  if (customPath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(customPath)) return customPath;
  return join(rootDir, customPath);
}

function loadTextFile(envName, fallbackParts, emptyMessage) {
  const filePath = resolveDataFile(envName, fallbackParts);
  if (!existsSync(filePath)) return emptyMessage;
  return readFileSync(filePath, 'utf8').trim() || emptyMessage;
}

export function loadServerRules() {
  return loadTextFile(
    'SERVER_RULES_PATH',
    ['rules', 'server-rules.md'],
    'Публичные правила сервера пока не заданы. Уточни у модераторов.',
  );
}

export function loadKnowledge() {
  const base = loadTextFile(
    'KNOWLEDGE_PATH',
    ['knowledge', 'wardogs.md'],
    'Публичная база знаний пока пустая. По игровым фактам лучше уточнить у модераторов.',
  );
  const extra = loadLearnedAndLiveKnowledge();
  if (!extra) return base;
  return `${base}\n\n${extra}`;
}
