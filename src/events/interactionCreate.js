import { Events } from 'discord.js';
import { checkChannelAccess, silentAllowedMentions } from '../lib/channelGuard.js';
import { logError } from '../lib/logger.js';
import { enqueue, releaseUser, tryAccept } from '../lib/queue.js';

export function registerInteractionHandler(client) {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand() && !interaction.isMessageContextMenuCommand()) return;
    if (interaction.user.bot) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    const access = checkChannelAccess(interaction.channel);
    if (!access.ok && !command.bypassChannelGuard) {
      await interaction.reply({
        content: access.reply,
        ephemeral: true,
        allowedMentions: silentAllowedMentions,
      }).catch(() => {});
      return;
    }

    const light = Boolean(command.light);
    if (!light) {
      const gate = tryAccept(interaction.user.id);
      if (!gate.ok) {
        await interaction.reply({
          content: gate.reply,
          ephemeral: true,
          allowedMentions: silentAllowedMentions,
        }).catch(() => {});
        return;
      }
    }

    try {
      await interaction.deferReply({ ephemeral: Boolean(command.ephemeral) });
      if (light) {
        await command.execute(interaction);
      } else {
        await enqueue(() => command.execute(interaction));
      }
    } catch (error) {
      logError('interaction failed', interaction.commandName, error.message);
      const fallback = 'Не получилось ответить. Попробуй ещё раз или уточни у модераторов.';
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: fallback, allowedMentions: silentAllowedMentions }).catch(() => {});
      } else {
        await interaction.reply({
          content: fallback,
          ephemeral: true,
          allowedMentions: silentAllowedMentions,
        }).catch(() => {});
      }
    } finally {
      if (!light) releaseUser(interaction.user.id);
    }
  });
}
