import { ChannelType } from 'discord.js';
import { SERVER_MAP_PATH, writeGeneratedKnowledge } from './knowledge.js';

const SKIP_NAME_RE =
  /ticket|тикет|mod-?log|мод-?лог|мод-?панел|staff|audit|логи-сервера|мод.?лог|администр|штаб-командир|журнал-бан/i;

function skipChannel(channel) {
  const name = `${channel?.name || ''} ${channel?.parent?.name || ''}`;
  return SKIP_NAME_RE.test(name);
}

function channelLabel(channel) {
  if (channel.type === ChannelType.GuildForum) return 'форум';
  if (channel.type === ChannelType.GuildVoice) return 'войс';
  if (channel.type === ChannelType.GuildStageVoice) return 'сцена';
  if (channel.type === ChannelType.GuildCategory) return 'категория';
  if (channel.isThread?.()) return 'ветка';
  return 'текст';
}

export function buildServerMap(guild) {
  const categories = new Map();
  const uncategorized = [];

  const channels = [...guild.channels.cache.values()]
    .filter((channel) => channel.type !== ChannelType.GuildCategory)
    .filter((channel) => !channel.isThread?.())
    .sort((a, b) => (a.rawPosition ?? 0) - (b.rawPosition ?? 0));

  for (const channel of channels) {
    if (skipChannel(channel)) continue;
    const line = `- ${channel.name} (${channelLabel(channel)})${channel.topic ? ` — ${String(channel.topic).slice(0, 120)}` : ''}`;
    if (channel.parent) {
      if (SKIP_NAME_RE.test(channel.parent.name || '')) continue;
      const list = categories.get(channel.parent.name) || [];
      list.push(line);
      categories.set(channel.parent.name, list);
    } else {
      uncategorized.push(line);
    }
  }

  const roleLines = [...guild.roles.cache.values()]
    .filter((role) => role.name !== '@everyone' && !role.managed)
    .sort((a, b) => b.position - a.position)
    .slice(0, 120)
    .map((role) => `- ${role.name}${role.hoist ? ' (отображается отдельно)' : ''}`);

  const categoryBlocks = [...categories.entries()].map(
    ([name, lines]) => `### ${name}\n${lines.join('\n')}`,
  );

  return `# Карта сервера ${guild.name}

Снято с Discord: ${new Date().toISOString()}
Участников (оценка Discord): ${guild.memberCount || 'неизвестно'}
${guild.description ? `Описание: ${guild.description}\n` : ''}
Публичные каналы и роли. Не выдумывай каналы сверх этого списка.
Тикеты, мод-логи и админ-каналы сюда не входят.

## Каналы
${uncategorized.length ? `${uncategorized.join('\n')}\n\n` : ''}${categoryBlocks.join('\n\n')}

## Роли
${roleLines.join('\n') || '- роли пока не сняты'}
`;
}

export async function refreshGuildSnapshot(guild) {
  await guild.channels.fetch().catch(() => null);
  await guild.roles.fetch().catch(() => null);
  const text = buildServerMap(guild);
  writeGeneratedKnowledge(SERVER_MAP_PATH, text);
  return {
    channelCount: guild.channels.cache.size,
    roleCount: guild.roles.cache.size,
  };
}
