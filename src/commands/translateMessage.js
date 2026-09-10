import { ApplicationCommandType, ContextMenuCommandBuilder } from 'discord.js';
import { askAi } from '../ai/ask.js';
import { languageFromLocale, messageText } from '../lib/locale.js';
import { replyAi } from '../lib/reply.js';

export default {
  data: new ContextMenuCommandBuilder()
    .setName('Translate')
    .setNameLocalization('ru', 'Перевести')
    .setType(ApplicationCommandType.Message),
  async execute(interaction) {
    const text = messageText(interaction.targetMessage);
    if (!text) {
      await replyAi(interaction, 'В этом сообщении нет текста — переводить нечего.');
      return;
    }

    const language = languageFromLocale(interaction.locale);
    const answer = await askAi({
      userText: text,
      nsfwChannel: Boolean(interaction.channel?.nsfw),
      instruction: `Переведи на язык: ${language}. Сначала перевод, затем при необходимости короткий оригинал.`,
      guild: interaction.guild,
    });
    await replyAi(interaction, answer);
  },
};
