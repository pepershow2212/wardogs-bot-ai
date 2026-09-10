import { commandList } from './commands/index.js';
import { deployCommands } from './deploy.js';
import { logError } from './lib/logger.js';

try {
  await deployCommands(commandList);
} catch (error) {
  logError(error.message);
  process.exit(1);
}
