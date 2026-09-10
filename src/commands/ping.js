import { SlashCommandBuilder } from 'discord.js';
import { replyAi } from '../lib/reply.js';

export default {
  light: true,
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check that WARDOGS BOT AI is online')
    .setDescriptionLocalization('ru', 'Проверить, что бот онлайн'),
  async execute(interaction) {
    const ping = Math.round(interaction.client.ws.ping);
    await replyAi(interaction, `Онлайн. Задержка Discord: ${ping} мс.`);
  },
};
