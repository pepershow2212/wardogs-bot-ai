import { Collection } from 'discord.js';
import ask from './ask.js';
import summary from './summary.js';
import explain from './explain.js';
import translate from './translate.js';
import rules from './rules.js';
import help from './help.js';
import explainMessage from './explainMessage.js';
import translateMessage from './translateMessage.js';
import fact from './fact.js';
import ping from './ping.js';
import sync from './sync.js';
import where from './where.js';
import study from './study.js';

const commandList = [
  ask,
  where,
  study,
  summary,
  explain,
  translate,
  rules,
  help,
  explainMessage,
  translateMessage,
  fact,
  ping,
  sync,
];

export function loadCommands() {
  const commands = new Collection();
  for (const command of commandList) {
    commands.set(command.data.name, command);
  }
  return commands;
}

export { commandList };
