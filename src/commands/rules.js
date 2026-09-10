import { SlashCommandBuilder } from 'discord.js';
import { getServerRules } from '../lib/channelRules.js';
import { replyAi } from '../lib/reply.js';

export default {
  light: true,
  data: new SlashCommandBuilder()
    .setName('rules')
    .setDescription('Show public WARDOGS server rules')
    .setDescriptionLocalization('ru', 'Показать публичные правила сервера WARDOGS'),
  async execute(interaction) {
    const rules = await getServerRules(interaction.guild, { force: true });
    await replyAi(interaction, rules);
  },
};
