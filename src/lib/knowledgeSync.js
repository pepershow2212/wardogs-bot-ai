import { ChannelType } from 'discord.js';
import { config } from '../config.js';
import { classifyForbiddenTopic } from '../ai/contentPolicy.js';
import { looksLikeCheatDump } from './problemScan.js';
import { getServerRules } from './channelRules.js';
import { refreshGuildSnapshot } from './guildSnapshot.js';
import { LIVE_PATH, writeGeneratedKnowledge } from './knowledge.js';
import { ingestWebKnowledge } from './webKnowledge.js';
import { logError, logInfo } from './logger.js';

const SKIP_NAME_RE =
  /ticket|тикет|mod-?log|мод-?лог|мод-?панел|staff|audit|логи-сервера|мод.?лог|администр|штаб-командир|журнал-бан/i;

const KNOWLEDGE_NAME_RE =
  /база|knowledge|faq|гайд|guide|wiki|справк|howto|how-to|инструкц|zapret|запрет|правил|rules/i;

const HELP_NAME_RE = /помощ|help|вопрос|faq/i;

const MAX_LIVE_CHARS = 22_000;
const MAX_THREAD_CHARS = 1100;
const MAX_CHANNEL_CHARS = 1600;

function usableText(text) {
  const classified = classifyForbiddenTopic(text);
  if (classified.code === 'illegal' || classified.code === 'gore' || classified.code === 'porn') return false;
  if (looksLikeCheatDump(text)) return false;
  return true;
}

function messageToText(message) {
  if (!message) return '';
  const bits = [message.content];
  for (const embed of message.embeds || []) {
    if (embed.title) bits.push(embed.title);
    if (embed.description) bits.push(embed.description);
    for (const field of embed.fields || []) {
      bits.push(`${field.name}: ${field.value}`);
    }
  }
  for (const file of message.attachments?.values?.() || []) {
    if (file.name) bits.push(`[файл: ${file.name}]`);
  }
  return bits.filter(Boolean).join('\n').replace(/\s+\n/g, '\n').trim();
}

function skipChannel(channel) {
  if (!channel) return true;
  if (config.adminChannelIds.has(channel.id) || config.adminChannelIds.has(channel.parentId)) return true;
  const name = `${channel.name || ''} ${channel.parent?.name || ''}`;
  return SKIP_NAME_RE.test(name);
}

function isTextLike(channel) {
  return Boolean(channel?.isTextBased?.()) && channel.type !== ChannelType.GuildVoice;
}

function isForum(channel) {
  return channel?.type === ChannelType.GuildForum || channel?.type === ChannelType.GuildMedia;
}

async function findKnowledgeChannels(guild) {
  const found = [];
  const add = (channel) => {
    if (!channel || skipChannel(channel)) return;
    if (!isForum(channel) && !isTextLike(channel)) return;
    if (found.some((item) => item.id === channel.id)) return;
    found.push(channel);
  };

  for (const id of config.knowledgeChannelIds) {
    const channel = guild.channels.cache.get(id) || await guild.channels.fetch(id).catch(() => null);
    add(channel);
  }

  for (const channel of guild.channels.cache.values()) {
    if (channel.isThread?.()) continue;
    const name = channel.name || '';
    if (KNOWLEDGE_NAME_RE.test(name) || HELP_NAME_RE.test(name) || isForum(channel)) {
      add(channel);
    }
  }

  return found.slice(0, 20);
}

export function isSkippedChannel(channel) {
  return skipChannel(channel);
}

export function isForumChannel(channel) {
  return isForum(channel);
}

export async function collectPinsAndRecent(channel, { recentLimit = 8, includeBots = false } = {}) {
  const chunks = [];
  const pins = await channel.messages.fetchPinned().catch(() => null);
  if (pins) {
    for (const message of [...pins.values()].reverse()) {
      const text = messageToText(message);
      if (text && usableText(text)) chunks.push(text);
    }
  }

  if (recentLimit > 0) {
    const recent = await channel.messages.fetch({ limit: recentLimit }).catch(() => null);
    if (recent) {
      for (const message of [...recent.values()].reverse()) {
        if (pins?.has(message.id)) continue;
        if (!includeBots && message.author?.bot && !message.webhookId) continue;
        const text = messageToText(message);
        if (text && usableText(text)) chunks.push(text);
      }
    }
  }

  return chunks.join('\n\n').trim();
}

export async function collectForum(channel, { replies = true, threadLimit = 24, includeBots = false } = {}) {
  const parts = [];
  const active = await channel.threads.fetchActive().catch(() => null);
  const archived = await channel.threads.fetchArchived({ fetchAll: true, limit: 40 }).catch(() =>
    channel.threads.fetchArchived({ fetchAll: false, limit: 25 }).catch(() => null),
  );
  const threads = [
    ...((active && [...active.threads.values()]) || []),
    ...((archived && [...archived.threads.values()]) || []),
  ].slice(0, threadLimit);

  for (const thread of threads) {
    if (skipChannel(thread)) continue;
    const starter = await thread.fetchStarterMessage().catch(() => null);
    const bits = [`### ${thread.name}`];
    const starterText = messageToText(starter);
    if (starterText && usableText(starterText)) bits.push(starterText);
    if (replies) {
      const extra = await thread.messages.fetch({ limit: includeBots ? 12 : 4 }).catch(() => null);
      if (extra) {
        for (const message of [...extra.values()].reverse()) {
          if (starter && message.id === starter.id) continue;
          if (!includeBots && message.author?.bot) continue;
          const text = messageToText(message);
          if (text && usableText(text)) bits.push(text);
        }
      }
    }
    const block = bits.join('\n').trim().slice(0, MAX_THREAD_CHARS);
    if (block.length > 8) parts.push(block);
  }

  return parts.join('\n\n').trim();
}

async function collectPublicPins(guild, already) {
  const parts = [];
  const channels = [...guild.channels.cache.values()]
    .filter((channel) => isTextLike(channel) && !channel.isThread?.())
    .filter((channel) => !skipChannel(channel))
    .filter((channel) => !already.has(channel.id))
    .slice(0, 50);

  for (const channel of channels) {
    const pins = await channel.messages.fetchPinned().catch(() => null);
    if (!pins?.size) continue;
    const texts = [];
    for (const message of [...pins.values()].reverse()) {
      const text = messageToText(message);
      if (text && usableText(text)) texts.push(text);
    }
    if (texts.length) {
      parts.push(`## Закрепы #${channel.name}\n${texts.join('\n\n').slice(0, 1200)}`);
    }
  }

  return parts.join('\n\n').trim();
}

export { isForum, skipChannel };

export async function ingestPublicKnowledge(guild) {
  const sections = [];
  const seen = new Set();
  let forums = 0;
  let channels = 0;

  const rules = await getServerRules(guild, { force: true }).catch(() => '');
  if (rules) sections.push(`## Публичные правила с сервера\n${String(rules).slice(0, 3500)}`);

  const targets = await findKnowledgeChannels(guild);
  for (const channel of targets) {
    seen.add(channel.id);
    const knowledgeLike = KNOWLEDGE_NAME_RE.test(channel.name || '') || HELP_NAME_RE.test(channel.name || '');
    if (isForum(channel)) {
      const text = await collectForum(channel, {
        replies: knowledgeLike,
        threadLimit: knowledgeLike ? 30 : 12,
      });
      if (text) {
        sections.push(`## Форум #${channel.name}\n${text}`);
        forums += 1;
      }
      continue;
    }

    const recentLimit = knowledgeLike ? 15 : 0;
    const text = await collectPinsAndRecent(channel, { recentLimit });
    if (text) {
      sections.push(`## #${channel.name}\n${text.slice(0, MAX_CHANNEL_CHARS)}`);
      channels += 1;
    }
  }

  const pins = await collectPublicPins(guild, seen);
  if (pins) sections.push(pins);

  const body = `# Живая база с сервера

Снято: ${new Date().toISOString()}
Публичные правила, гайды, форумы, закрепы, карта каналов.
Тикеты, мод-логи, админка и весь общий чат не заучиваются.

${sections.join('\n\n')}`.slice(0, MAX_LIVE_CHARS);

  writeGeneratedKnowledge(LIVE_PATH, body);
  return { forums, knowledgeChannels: channels, chars: body.length };
}

export async function refreshGuildKnowledge(guild) {
  const snapshot = await refreshGuildSnapshot(guild);
  const live = config.syncPublicKnowledge
    ? await ingestPublicKnowledge(guild)
    : { forums: 0, knowledgeChannels: 0, chars: 0 };
  const web = await ingestWebKnowledge().catch((error) => {
    logError('web ingest', error.message);
    return { sources: 0, failed: 1, chars: 0 };
  });
  return { ...snapshot, ...live, webSources: web.sources, webChars: web.chars };
}

let syncTimer = null;

export function startKnowledgeSync(client) {
  const run = async () => {
    for (const guild of client.guilds.cache.values()) {
      if (config.discordGuildId && guild.id !== config.discordGuildId) continue;
      try {
        const result = await refreshGuildKnowledge(guild);
        logInfo(
          `знание обновлено: ${guild.name} каналов=${result.channelCount} ролей=${result.roleCount} форумов=${result.forums} live=${result.chars} web=${result.webSources}`,
        );
      } catch (error) {
        logError('knowledge sync failed', guild.name, error.message);
      }
    }
  };

  run().catch((error) => logError('knowledge sync start', error.message));
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = setInterval(() => {
    run().catch((error) => logError('knowledge sync interval', error.message));
  }, config.knowledgeSyncMs);
  syncTimer.unref?.();
}
