import { ChannelType } from 'discord.js';
import { config } from '../config.js';
import { looksLikeCheatDump } from './problemScan.js';

const SKIP_NAME_RE =
  /ticket|тикет|mod-?log|мод-?лог|мод-?панел|staff|audit|логи-сервера|мод.?лог/i;

const ROUTES = [
  {
    id: 'connect',
    match: /запрет|zapret|не\s+заход|не\s+открыв|dpi|winws|service\.bat|как\s+зайт[иь].{0,20}discord|vpn/i,
    needles: /база|гайд|faq|запрет|knowledge|wardogs-?ai|помощ/i,
    line: 'Подключение к Discord — помогу по гайду из базы. Если гайда нет, модератор заливает его через /fact.',
  },
  {
    id: 'lfg',
    match: /отряд|пати|групп|сквад|lfg|поиск\s+игр|с кем играть|набор/i,
    needles: /поиск|отряд|lfg|набор/i,
    line: 'Искать людей в игру — в канал поиска отряда, не в общий чат.',
  },
  {
    id: 'rules',
    match: /правил|можно\s+ли|нельзя|мут\s+за|бан\s+за|что\s+запрещ/i,
    needles: /правил|rules/i,
    line: 'Правила — /rules или канал правил. Я по ним подскажу, наказать никого не могу.',
  },
  {
    id: 'help',
    match: /жалоб|репорт|тикет|пожалов|обжал|кто\s+модер|позови\s+админ|меня\s+забан/i,
    needles: /помощ|вопрос|жалоб/i,
    line: 'Жалобы, баны и споры — к администрации (канал помощи или тикет). Я это не решаю и причины бана не раскрываю.',
  },
  {
    id: 'voice',
    match: /войс|голос|комнат|приватн/i,
    needles: /войс|голос|комнат|создать/i,
    line: 'Голосовые комнаты делает WARDOGS TOOLS / менеджер сервера. Я только подскажу, куда нажать.',
  },
  {
    id: 'bot',
    match: /бот\s+ai|вардогс\s+аи|как\s+тебя\s+спр|slash|команд/i,
    needles: /wardogs-?ai|бот-?аи/i,
    line: 'Вопросы ко мне лучше в /ask или в канал бота, а не спамом в общий чат.',
  },
  {
    id: 'game',
    match: /как\s+играть|фракц|valkyr|lonestar|manticore|зон[аы]|очк|вардогс|wardogs|тактик|сборк/i,
    needles: /гайд|база|faq|общий/i,
    line: 'По игре отвечаю из базы знаний. Если факта нет — не выдумываю.',
  },
];

function skipChannel(channel) {
  if (!channel) return true;
  if (config.adminChannelIds.has(channel.id) || config.adminChannelIds.has(channel.parentId)) return true;
  const name = `${channel.name || ''} ${channel.parent?.name || ''}`;
  return SKIP_NAME_RE.test(name);
}

export function listPublicChannels(guild) {
  if (!guild) return [];
  return [...guild.channels.cache.values()].filter((channel) => {
    if (skipChannel(channel)) return false;
    if (channel.isThread?.()) return false;
    if (channel.type === ChannelType.GuildCategory) return false;
    return Boolean(channel.name);
  });
}

export function findChannel(guild, needles) {
  return listPublicChannels(guild).find((channel) => needles.test(channel.name || ''));
}

export function channelRef(channel) {
  return channel ? `<#${channel.id}>` : '';
}

export function buildManagerRoute(guild, userText) {
  const input = String(userText || '').trim();
  if (!input || !guild) return '';

  if (looksLikeCheatDump(input)) {
    const channel = findChannel(guild, /помощ|вопрос|жалоб|правил/i);
    return [
      'МАРШРУТ МЕНЕДЖЕРА:',
      'Читы, оффсеты и ключи клиента — к модерам. Я такое не разбираю. Жалоба или тикет.',
      channel ? `Куда направить: ${channelRef(channel)}` : 'Если точного канала в карте нет — скажи это честно и предложи /rules или администрацию.',
      'Не выдумывай каналы. Баны/муты/тикеты сам не открываешь и не закрываешь. Это делает администрация и WARDOGS TOOLS.',
    ].join('\n');
  }

  const hit = ROUTES.find((route) => route.match.test(input));
  if (!hit) {
    const help = findChannel(guild, /помощ|вопрос/i);
    const bot = findChannel(guild, /wardogs-?ai|бот-?аи/i);
    return [
      'МАРШРУТ МЕНЕДЖЕРА:',
      help ? `Помощь людям: ${channelRef(help)}` : '',
      bot ? `Вопросы боту: ${channelRef(bot)} или /ask` : 'Вопросы боту: /ask',
      'Не выдумывай каналы. Баны/муты сам не выдаёшь.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  const channel = findChannel(guild, hit.needles);
  return [
    'МАРШРУТ МЕНЕДЖЕРА:',
    hit.line,
    channel ? `Куда направить: ${channelRef(channel)}` : 'Если точного канала в карте нет — скажи это честно и предложи /rules или администрацию.',
    'Не выдумывай каналы. Баны/муты/тикеты сам не открываешь и не закрываешь. Это делает администрация и WARDOGS TOOLS.',
  ].join('\n');
}
