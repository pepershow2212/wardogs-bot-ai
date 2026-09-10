import { ChannelType } from 'discord.js';
import { classifyForbiddenTopic } from '../ai/contentPolicy.js';
import { config, loadServerRules } from '../config.js';

const RULES_NAME_RE = /правил|rules|guidelines|правила|rule-list/i;
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map();

function isTextChannel(channel) {
  return Boolean(channel?.isTextBased?.()) && channel.type !== ChannelType.GuildVoice;
}

function usableRuleText(text) {
  const classified = classifyForbiddenTopic(text);
  if (classified.code === 'illegal' || classified.code === 'gore') return false;
  if (classified.code === 'porn') {
    return /запрещ|нельзя|не пост|no\s+(?:nsfw|porn)|don't|dont|not allowed/i.test(text);
  }
  return classified.code === 'ok' || classified.code === 'rules_only';
}

function messageToText(message) {
  const bits = [message.content];
  for (const embed of message.embeds) {
    if (embed.title) bits.push(embed.title);
    if (embed.description) bits.push(embed.description);
    for (const field of embed.fields || []) {
      bits.push(`${field.name}: ${field.value}`);
    }
  }
  return bits.filter(Boolean).join('\n').replace(/\s+\n/g, '\n').trim();
}

async function collectChannelRules(channel) {
  const chunks = [];
  const pins = await channel.messages.fetchPinned().catch(() => null);
  if (pins) {
    for (const message of [...pins.values()].reverse()) {
      const text = messageToText(message);
      if (text && usableRuleText(text)) chunks.push(text);
    }
  }

  const recent = await channel.messages.fetch({ limit: 15 }).catch(() => null);
  if (recent) {
    for (const message of [...recent.values()].reverse()) {
      if (pins?.has(message.id)) continue;
      const text = messageToText(message);
      if (text && usableRuleText(text)) chunks.push(text);
    }
  }

  return chunks.join('\n\n').trim();
}

async function findRulesChannels(guild) {
  const found = [];
  const add = (channel) => {
    if (!channel || !isTextChannel(channel)) return;
    if (config.adminChannelIds.has(channel.id)) return;
    if (found.some((item) => item.id === channel.id)) return;
    found.push(channel);
  };

  if (guild.rulesChannelId) {
    add(guild.rulesChannel || await guild.channels.fetch(guild.rulesChannelId).catch(() => null));
  }

  for (const id of config.rulesChannelIds) {
    add(guild.channels.cache.get(id) || await guild.channels.fetch(id).catch(() => null));
  }

  if (found.length === 0) {
    for (const channel of guild.channels.cache.values()) {
      if (RULES_NAME_RE.test(channel.name || '')) add(channel);
    }
  }

  return found.slice(0, 2);
}

export async function getServerRules(guild, { force = false } = {}) {
  if (!guild || !config.readChannelRules) return loadServerRules();

  const cached = cache.get(guild.id);
  if (!force && cached && Date.now() - cached.at < CACHE_MS) return cached.text;

  try {
    const channels = await findRulesChannels(guild);
    const parts = [];
    for (const channel of channels) {
      const text = await collectChannelRules(channel);
      if (text) parts.push(text);
    }

    const fromChannels = parts.join('\n\n').trim().slice(0, 3500);
    const text = fromChannels || loadServerRules();
    cache.set(guild.id, { text, at: Date.now() });
    return text;
  } catch {
    return cached?.text || loadServerRules();
  }
}
