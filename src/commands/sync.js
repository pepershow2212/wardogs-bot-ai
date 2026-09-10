import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { refreshGuildKnowledge } from '../lib/knowledgeSync.js';
import { replyAi } from '../lib/reply.js';

export default {
  bypassChannelGuard: true,
  ephemeral: true,
  data: new SlashCommandBuilder()
    .setName('sync')
    .setDescription('Refresh public server map, roles, and knowledge forum for the AI')
    .setDescriptionLocalization('ru', 'Обновить карту сервера, роли и публичную базу знаний для ИИ')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guild) {
      await replyAi(interaction, 'Команда работает только на сервере.');
      return;
    }

    try {
      const result = await refreshGuildKnowledge(interaction.guild);
      await replyAi(
        interaction,
        `Обновил публичные знания.\n• каналов: ${result.channelCount}\n• ролей: ${result.roleCount}\n• форумов: ${result.forums}\n• каналов базы/помощи: ${result.knowledgeChannels}\n• интернет (Steam/Team17): ${result.webSources || 0} источников, ${result.webChars || 0} символов\n\nТикеты и админку не читаю. Интернет — только официальные страницы игры.`,
      );
    } catch {
      await replyAi(interaction, 'Не смог обновить базу с сервера. Проверь права бота: View Channels и Read Message History.');
    }
  },
};
