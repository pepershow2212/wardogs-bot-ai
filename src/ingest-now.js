import { Client, Events, GatewayIntentBits } from 'discord.js';
import { config } from './config.js';
import { refreshGuildKnowledge } from './lib/knowledgeSync.js';
import { logError, logInfo } from './lib/logger.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  allowedMentions: { parse: [] },
});

client.once(Events.ClientReady, async (ready) => {
  try {
    const guildId = config.discordGuildId;
    if (!guildId) {
      throw new Error('Не задан DISCORD_GUILD_ID');
    }

    const guild = await ready.guilds.fetch(guildId);
    await guild.channels.fetch();
    await guild.roles.fetch();

    const result = await refreshGuildKnowledge(guild);
    const publicChannels = [...guild.channels.cache.values()]
      .filter((channel) => !channel.isThread?.())
      .map((channel) => channel.name)
      .slice(0, 80);

    logInfo(
      `обучение снято: ${guild.name} каналов=${result.channelCount} ролей=${result.roleCount} форумов=${result.forums} live=${result.chars}`,
    );
    logInfo(`публичные каналы: ${publicChannels.join(', ')}`);
  } catch (error) {
    logError('ingest failed', error.message);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(config.discordToken).catch((error) => {
  logError('ingest login failed', error.message);
  process.exit(1);
});
