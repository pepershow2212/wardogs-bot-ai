import { ApplicationCommandType, ContextMenuCommandBuilder } from 'discord.js';
import { askAi } from '../ai/ask.js';
import { messageText } from '../lib/locale.js';
import { sessionKey } from '../lib/memory.js';
import { replyAi } from '../lib/reply.js';

export default {
  data: new ContextMenuCommandBuilder()
    .setName('Explain')
    .setNameLocalization('ru', 'Объяснить')
    .setType(ApplicationCommandType.Message),
  async execute(interaction) {
    const text = messageText(interaction.targetMessage);
    if (!text) {
      await replyAi(interaction, 'В этом сообщении нет текста — объяснить нечего.');
      return;
    }

    const answer = await askAi({
      userText: text,
      nsfwChannel: Boolean(interaction.channel?.nsfw),
      instruction: 'Объясни это сообщение простыми словами. Коротко и без лишней воды.',
      memoryKey: sessionKey(interaction),
      guild: interaction.guild,
    });
    await replyAi(interaction, answer);
  },
};
