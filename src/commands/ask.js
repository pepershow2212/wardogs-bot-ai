import { SlashCommandBuilder } from 'discord.js';
import { askAi } from '../ai/ask.js';
import { recentChannelContext } from '../lib/context.js';
import { sessionKey } from '../lib/memory.js';
import { canTrainBot, looksLikeStudyRequest, studyFromMessage } from '../lib/study.js';
import { replyAi } from '../lib/reply.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Ask WARDOGS BOT AI a question')
    .setDescriptionLocalization('ru', 'Задать вопрос WARDOGS BOT AI')
    .addStringOption((option) =>
      option
        .setName('question')
        .setNameLocalization('ru', 'вопрос')
        .setDescription('Your question')
        .setDescriptionLocalization('ru', 'Твой вопрос')
        .setRequired(true)
        .setMaxLength(1500),
    ),
  async execute(interaction) {
    const question = interaction.options.getString('question', true);
    if (looksLikeStudyRequest(question) && canTrainBot(interaction.member)) {
      const studied = await studyFromMessage(interaction.guild, interaction, question);
      await replyAi(interaction, studied.reply);
      return;
    }
    const extraContext = await recentChannelContext(interaction.channel, interaction.client.user.id);
    const answer = await askAi({
      userText: question,
      extraContext,
      nsfwChannel: Boolean(interaction.channel?.nsfw),
      memoryKey: sessionKey(interaction),
      guild: interaction.guild,
    });
    await replyAi(interaction, answer);
  },
};
