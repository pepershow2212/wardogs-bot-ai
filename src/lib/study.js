import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { STUDIED_PATH, writeGeneratedKnowledge } from './knowledge.js';
import { collectForum, collectPinsAndRecent, isForum, skipChannel } from './knowledgeSync.js';

const STUDY_RE = /изуч|прочит|выуч|запомни|проскан|сн[яи]ть.{0,20}баз|обнови.{0,20}баз/i;

export function looksLikeStudyRequest(text) {
  return STUDY_RE.test(String(text || ''));
}

export function canTrainBot(member) {
  return Boolean(member?.permissions?.has?.(PermissionFlagsBits.ManageGuild));
}

function titlesFrom(text) {
  return [...String(text || '').matchAll(/^###\s+(.+)$/gm)].map((item) => item[1].trim()).filter(Boolean).slice(0, 15);
}

export async function resolveStudyTargets(guild, message, text = '') {
  if (!guild) return [];
  const found = new Map();

  const add = (channel) => {
    if (!channel || skipChannel(channel)) return;
    if (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildCategory) return;
    found.set(channel.id, channel);
  };

  const mentionChannels = message?.mentions?.channels;
  if (mentionChannels) {
    for (const channel of mentionChannels.values()) add(channel);
  }

  for (const match of String(text || message?.content || '').matchAll(/<#(\d+)>/g)) {
    const channel = guild.channels.cache.get(match[1]) || await guild.channels.fetch(match[1]).catch(() => null);
    add(channel);
  }

  if (found.size === 0 && /база|гайд|faq|knowledge/i.test(String(text || ''))) {
    for (const channel of guild.channels.cache.values()) {
      if (/база|гайд|faq|knowledge/i.test(channel.name || '')) add(channel);
    }
  }

  return [...found.values()].slice(0, 3);
}

export async function studyChannel(channel) {
  if (!channel) {
    return { ok: false, reply: 'Не вижу канал.' };
  }
  if (skipChannel(channel)) {
    return { ok: false, reply: 'Этот канал служебный, его не читаю.' };
  }

  let body = '';
  if (isForum(channel)) {
    body = await collectForum(channel, { replies: true, threadLimit: 40 });
  } else {
    body = await collectPinsAndRecent(channel, { recentLimit: 25 });
  }

  if (!body || body.length < 20) {
    return {
      ok: false,
      reply: `В «${channel.name}» почти ничего не прочитал. Нужны права View Channel и Read Message History.`,
    };
  }

  const block = `# Изученный канал: ${channel.name}

Снято: ${new Date().toISOString()}
Публичные посты/ветки. Тикеты и админку не беру.

${body}`.slice(0, 18_000);

  writeGeneratedKnowledge(STUDIED_PATH, block);

  const titles = titlesFrom(body);
  const preview = titles.length
    ? titles.map((title) => `• ${title}`).join('\n')
    : body.slice(0, 500);

  return {
    ok: true,
    name: channel.name,
    chars: body.length,
    titles,
    text: body,
    reply: `Изучил <#${channel.id}> (${body.length} символов). Запомнил в базу.\n${preview}\n\nТеперь спрашивай по этим гайдам — отвечу из базы.`,
  };
}

export async function studyFromMessage(guild, message, text) {
  const targets = await resolveStudyTargets(guild, message, text);
  if (!targets.length) {
    return { ok: false, reply: 'Укажи канал: напиши «изучи» и отметь #канал, например #база-знаний.' };
  }

  const chunks = [];
  for (const channel of targets) {
    const result = await studyChannel(channel);
    chunks.push(result.ok ? result.reply : result.reply);
    if (!result.ok) continue;
  }
  return { ok: true, reply: chunks.join('\n\n') };
}
