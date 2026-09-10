import { config } from '../config.js';
import { looksLikeCheatDump } from './problemScan.js';

export async function recentChannelContext(channel, botId, requested = 0) {
  const limit = Math.min(10, Math.max(5, requested || config.maxContextMessages));
  const fetched = await channel.messages.fetch({ limit }).catch(() => null);
  if (!fetched) return '';

  return [...fetched.values()]
    .reverse()
    .filter((message) => message.content && (!message.author.bot || message.author.id === botId))
    .filter((message) => !looksLikeCheatDump(message.content))
    .map((message) => {
      const name = message.member?.displayName || message.author.username;
      const text = message.content.replace(/\s+/g, ' ').slice(0, 350);
      return `${name}: ${text}`;
    })
    .join('\n');
}
