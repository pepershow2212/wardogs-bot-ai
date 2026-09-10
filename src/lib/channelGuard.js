import { config } from '../config.js';

function relatedChannelIds(channel) {
  const ids = [channel.id];
  if (channel.parentId) ids.push(channel.parentId);
  return ids;
}

export function checkChannelAccess(channel) {
  if (!channel) {
    return { ok: false, reply: 'Не вижу канал. Напиши в текстовом канале сервера.' };
  }

  const isDm = !channel.guild;
  if (isDm) {
    if (!config.enableDms) {
      return {
        ok: false,
        reply: 'Я работаю на сервере WARDOGS, не в личных сообщениях. Используй `/ask` там.',
      };
    }
    if (config.allowedChannelIds.size > 0) {
      return {
        ok: false,
        reply: 'Я отвечаю только в разрешённых каналах сервера.',
      };
    }
    return { ok: true };
  }

  const ids = relatedChannelIds(channel);
  if (ids.some((id) => config.adminChannelIds.has(id))) {
    return {
      ok: false,
      reply: 'В этом канале я не отвечаю. Напиши в обычном канале или обратись к администрации напрямую.',
    };
  }

  const name = String(channel.name || channel.parent?.name || '').toLowerCase();
  if (name && config.staffChannelPatterns.some((pattern) => name.includes(pattern))) {
    return {
      ok: false,
      reply: 'В этом канале я не отвечаю. Напиши в обычном канале или обратись к администрации напрямую.',
    };
  }

  if (config.allowedChannelIds.size > 0 && !ids.some((id) => config.allowedChannelIds.has(id))) {
    return {
      ok: false,
      reply: 'Я отвечаю только в разрешённых каналах. Спроси модераторов, где можно писать боту.',
    };
  }

  return { ok: true };
}

export const silentAllowedMentions = {
  parse: [],
  users: [],
  roles: [],
  repliedUser: true,
};
