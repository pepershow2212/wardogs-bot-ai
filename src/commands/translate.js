import { SlashCommandBuilder } from 'discord.js';
import { askAi } from '../ai/ask.js';
import { replyAi } from '../lib/reply.js';

export default {
  data: new SlashCommandBuilder()
    .setName('translate')
    .setDescription('Translate text')
    .setDescriptionLocalization('ru', 'Перевести текст')
    .addStringOption((option) =>
      option
        .setName('text')
        .setNameLocalization('ru', 'текст')
        .setDescription('Text to translate')
        .setDescriptionLocalization('ru', 'Текст для перевода')
        .setRequired(true)
        .setMaxLength(1500),
    )
    .addStringOption((option) =>
      option
        .setName('language')
        .setNameLocalization('ru', 'язык')
        .setDescription('Target language, e.g. ru, en, de')
        .setDescriptionLocalization('ru', 'На какой язык: ru, en, de и т.д.')
        .setRequired(true)
        .setMaxLength(40),
    ),
  async execute(interaction) {
    const text = interaction.options.getString('text', true);
    const language = interaction.options.getString('language', true);
    const answer = await askAi({
      userText: text,
      nsfwChannel: Boolean(interaction.channel?.nsfw),
      instruction: `Переведи на язык: ${language}. Сначала перевод, затем при необходимости короткий оригинал.`,
      guild: interaction.guild,
    });
    await replyAi(interaction, answer);
  },
};
