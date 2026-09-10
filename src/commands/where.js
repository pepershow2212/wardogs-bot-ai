import { ChannelType, SlashCommandBuilder } from 'discord.js';
import { askAi } from '../ai/ask.js';
import { buildManagerRoute, findChannel, channelRef } from '../lib/manager.js';
import { replyAi } from '../lib/reply.js';

function fallbackRoute(guild, question) {
  const route = buildManagerRoute(guild, question);
  if (!guild) return 'Напиши вопрос: куда идти с жалобой, отрядом, Запретом или правилами.';

  const help = findChannel(guild, /помощ|вопрос/i);
  const lfg = findChannel(guild, /поиск|отряд|lfg|набор/i);
  const bot = findChannel(guild, /wardogs-?ai|бот-?аи/i);
  const rules = guild.channels.cache.find(
    (channel) => /правил|rules/i.test(channel.name || '') && channel.type !== ChannelType.GuildCategory,
  );

  const lines = [
    'Я менеджер сообщества, не человек и не администратор.',
    lfg ? `• отряд / пати — ${channelRef(lfg)}` : null,
    help ? `• жалоба / помощь — ${channelRef(help)}` : '• жалобы и баны — к администрации, я не наказываю',
    rules ? `• правила — ${channelRef(rules)} или /rules` : '• правила — /rules',
    bot ? `• вопросы ко мне — ${channelRef(bot)} или /ask` : '• вопросы ко мне — /ask',
    '• Запрет / как зайти в Discord — /ask, гайд из базы',
    'Тикеты, войсы и панели — WARDOGS TOOLS, не я.',
  ].filter(Boolean);

  return route ? `${lines.join('\n')}` : lines.join('\n');
}

export default {
  data: new SlashCommandBuilder()
    .setName('where')
    .setDescription('Where to go on the server with this question')
    .setDescriptionLocalization('ru', 'Куда идти на сервере с этим вопросом')
    .addStringOption((option) =>
      option
        .setName('topic')
        .setNameLocalization('ru', 'тема')
        .setDescription('What you need: squad, zapret, report, rules, voice...')
        .setDescriptionLocalization('ru', 'Что нужно: отряд, запрет, жалоба, правила, войс...')
        .setRequired(false)
        .setMaxLength(200),
    ),
  async execute(interaction) {
    const topic = interaction.options.getString('topic');
    if (!topic) {
      await replyAi(interaction, fallbackRoute(interaction.guild, 'куда идти'));
      return;
    }

    const answer = await askAi({
      userText: `Куда на сервере идти с этим: ${topic}`,
      instruction:
        'Ты менеджер сервера. Ответь 1–4 короткими строками: куда идти и что делать. Если есть канал в маршруте — укажи его. Не читай мораль. Не обещай бан/мут/тикет от себя.',
      nsfwChannel: Boolean(interaction.channel?.nsfw),
      guild: interaction.guild,
    });
    await replyAi(interaction, answer);
  },
};
