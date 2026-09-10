import { REST, Routes } from 'discord.js';
import { config } from './config.js';
import { logInfo } from './lib/logger.js';

export async function deployCommands(commandPayloads) {
  if (config.discordClientId !== '1547671651980935168') {
    throw new Error(
      `DISCORD_CLIENT_ID=${config.discordClientId} — это не WARDOGS AI. Команды не регистрирую, чтобы не затереть TOOLS.`,
    );
  }
  const rest = new REST({ version: '10' }).setToken(config.discordToken);
  const body = commandPayloads.map((command) => command.data.toJSON());

  if (config.discordGuildId) {
    await rest.put(
      Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId),
      { body },
    );
    logInfo(`Команды зарегистрированы для сервера ${config.discordGuildId}`);
    return;
  }

  await rest.put(Routes.applicationCommands(config.discordClientId), { body });
  logInfo('Глобальные slash-команды зарегистрированы (могут появиться до часа)');
}
