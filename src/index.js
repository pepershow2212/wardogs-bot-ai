import { ActivityType, Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { commandList, loadCommands } from './commands/index.js';
import { config } from './config.js';
import { deployCommands } from './deploy.js';
import { registerInteractionHandler } from './events/interactionCreate.js';
import { registerMessageHandler } from './events/messageCreate.js';
import { startKnowledgeSync } from './lib/knowledgeSync.js';
import { logError, logInfo } from './lib/logger.js';

const intents = [GatewayIntentBits.Guilds];
const partials = [];
const needMessageContent = config.enableMentions || config.readChannelRules || config.syncPublicKnowledge;

if (needMessageContent) {
  intents.push(GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent);
  if (config.enableDms) {
    intents.push(GatewayIntentBits.DirectMessages);
    partials.push(Partials.Channel);
  }
}

const client = new Client({
  intents,
  partials,
  allowedMentions: { parse: [], repliedUser: true },
});

client.commands = loadCommands();

registerInteractionHandler(client);
registerMessageHandler(client);

client.once(Events.ClientReady, async (readyClient) => {
  logInfo(`Вошёл как ${readyClient.user.tag}`);
  if (readyClient.user.id !== config.discordClientId) {
    logError(
      `Чужой токен: вошёл ${readyClient.user.tag} (${readyClient.user.id}), в .env DISCORD_CLIENT_ID=${config.discordClientId}. Это должен быть WARDOGS AI. Команды не трогаю, выхожу.`,
    );
    process.exit(1);
  }
  readyClient.user.setActivity('/where · /ask', { type: ActivityType.Listening });

  if (config.discordGuildId) {
    try {
      await deployCommands(commandList);
    } catch (error) {
      logError('не удалось зарегистрировать команды', error.message);
    }
  } else {
    logInfo('DISCORD_GUILD_ID не задан. Для глобальных команд один раз выполни: npm run deploy');
  }

  startKnowledgeSync(readyClient);
});

process.on('unhandledRejection', (error) => {
  logError('unhandledRejection', error?.message || error);
});

client.login(config.discordToken);
