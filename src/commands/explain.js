import { SlashCommandBuilder } from 'discord.js';
import { askAi } from '../ai/ask.js';
import { recentChannelContext } from '../lib/context.js';
import { sessionKey } from '../lib/memory.js';
import { replyAi } from '../lib/reply.js';

export default {
  data: new SlashCommandBuilder()
    .setName('explain')
    .setDescription('Explain a message or topic in simple words')
    .setDescriptionLocalization('ru', 'Объяснить сообщение или тему простыми словами')
    .addStringOption((option) =>
      option
        .setName('text')
        .setNameLocalization('ru', 'текст')
        .setDescription('Text to explain')
        .setDescriptionLocalization('ru', 'Текст, который нужно объяснить')
        .setRequired(true)
        .setMaxLength(1500),
    ),
  async execute(interaction) {
    const text = interaction.options.getString('text', true);
    const extraContext = await recentChannelContext(interaction.channel, interaction.client.user.id);
    const answer = await askAi({
      userText: text,
      extraContext,
      nsfwChannel: Boolean(interaction.channel?.nsfw),
      instruction: 'Объясни простыми словами. Коротко и без лишней воды.',
      memoryKey: sessionKey(interaction),
      guild: interaction.guild,
    });
    await replyAi(interaction, answer);
  },
};
