import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { studyChannel } from '../lib/study.js';
import { replyAi } from '../lib/reply.js';

export default {
  bypassChannelGuard: true,
  ephemeral: true,
  data: new SlashCommandBuilder()
    .setName('study')
    .setDescription('Read a public channel or knowledge forum into the bot memory')
    .setDescriptionLocalization('ru', 'Прочитать публичный канал или форум базы знаний в память бота')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setNameLocalization('ru', 'канал')
        .setDescription('Public forum or text channel to study')
        .setDescriptionLocalization('ru', 'Публичный форум или канал')
        .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildForum,
          ChannelType.GuildAnnouncement,
          ChannelType.GuildMedia,
          ChannelType.PublicThread,
        )
        .setRequired(true),
    ),
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel', true);
    const result = await studyChannel(channel);
    await replyAi(interaction, result.reply);
  },
};
