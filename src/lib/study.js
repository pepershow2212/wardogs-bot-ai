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

function findGuideChannels(guild, exceptId = '') {
  if (!guild) return [];
  return [...guild.channels.cache.values()].filter((channel) => {
    if (!channel || channel.id === exceptId) return false;
    if (skipChannel(channel)) return false;
    if (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildCategory) return false;
    return /база.?знан|knowledge|гайд|zapret|запрет|faq/i.test(channel.name || '');
  });
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

  if (found.size === 0 && /база|гайд|faq|knowledge|подключ|zapret|запрет/i.test(String(text || ''))) {
    for (const channel of guild.channels.cache.values()) {
      if (/база|гайд|faq|knowledge|подключ|zapret|запрет/i.test(channel.name || '')) add(channel);
    }
  }

  return [...found.values()].slice(0, 3);
}

function studyAccessProblem(channel) {
  const me = channel.guild?.members?.me;
  if (!me) return 'Не вижу себя на сервере. Перепригласи WARDOGS AI.';
  const perms = channel.permissionsFor(me);
  if (!perms?.has(PermissionFlagsBits.ViewChannel)) {
    return `Меня не пускает в «${channel.name}». В правах канала добавь WARDOGS AI: Просмотр канала.`;
  }
  if (!perms.has(PermissionFlagsBits.ReadMessageHistory)) {
    return `Вижу «${channel.name}», но не историю сообщений. Выдай WARDOGS AI: Читать историю сообщений.`;
  }
  return null;
}

export async function studyChannel(channel, { allowFallback = true } = {}) {
  if (!channel) {
    return { ok: false, reply: 'Не вижу канал.' };
  }
  if (skipChannel(channel)) {
    return { ok: false, reply: 'Этот канал служебный, его не читаю.' };
  }

  const access = studyAccessProblem(channel);
  if (access) return { ok: false, reply: access };

  let body = '';
  if (isForum(channel)) {
    body = await collectForum(channel, { replies: true, threadLimit: 50, includeBots: true });
  } else {
    body = await collectPinsAndRecent(channel, { recentLimit: 50, includeBots: true });
  }

  if (!body || body.length < 80) {
    if (allowFallback) {
      const guides = findGuideChannels(channel.guild, channel.id);
      if (guides.length) {
        const parts = [
          `<#${channel.id}> почти пустой (приветствие / виджет серверов). Гайды подключения в другом месте — читаю их.`,
        ];
        let any = false;
        for (const guide of guides.slice(0, 2)) {
          const result = await studyChannel(guide, { allowFallback: false });
          parts.push(result.reply);
          if (result.ok) any = true;
        }
        return { ok: any, reply: parts.join('\n\n') };
      }
    }
    return {
      ok: false,
      reply: `«${channel.name}» пустой. Нужен форум с гайдами, обычно #база-знаний. Укажи его в /study.`,
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
