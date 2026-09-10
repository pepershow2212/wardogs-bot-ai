import { SlashCommandBuilder } from 'discord.js';
import { askAi } from '../ai/ask.js';
import { recentChannelContext } from '../lib/context.js';
import { replyAi } from '../lib/reply.js';

export default {
  data: new SlashCommandBuilder()
    .setName('summary')
    .setDescription('Summarize the last messages in this channel')
    .setDescriptionLocalization('ru', 'Кратко суммировать последние сообщения канала')
    .addIntegerOption((option) =>
      option
        .setName('count')
        .setNameLocalization('ru', 'количество')
        .setDescription('How many recent messages to summarize (5–10)')
        .setDescriptionLocalization('ru', 'Сколько последних сообщений суммировать (5–10)')
        .setMinValue(5)
        .setMaxValue(10),
    ),
  async execute(interaction) {
    const count = interaction.options.getInteger('count') || 8;
    const extraContext = await recentChannelContext(
      interaction.channel,
      interaction.client.user.id,
      count,
    );

    if (!extraContext) {
      await replyAi(interaction, 'Не вижу недавних сообщений в этом канале. Нужен доступ к истории и Message Content Intent.');
      return;
    }

    const answer = await askAi({
      userText: `Суммируй последние сообщения. Нужно ${count} сообщений контекста, если они есть.`,
      extraContext,
      nsfwChannel: Boolean(interaction.channel?.nsfw),
      instruction: 'Сделай суммаризацию: 3–5 коротких пунктов. Без цитирования всего подряд.',
      guild: interaction.guild,
    });
    await replyAi(interaction, answer);
  },
};
