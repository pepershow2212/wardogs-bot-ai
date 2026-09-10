import { config } from '../config.js';

const sessions = new Map();

export function sessionKey(entity) {
  const userId = entity.user?.id || entity.author?.id;
  return `${entity.guildId || 'dm'}:${entity.channelId}:${userId}`;
}

function prune(now = Date.now()) {
  for (const [key, entry] of sessions) {
    if (now - entry.updatedAt > config.memoryTtlMs) sessions.delete(key);
  }
}

export function getHistory(key) {
  prune();
  const entry = sessions.get(key);
  return entry ? [...entry.messages] : [];
}

export function rememberTurn(key, userText, assistantText) {
  prune();
  const entry = sessions.get(key) || { messages: [], updatedAt: Date.now() };
  entry.messages.push({ role: 'user', content: String(userText || '').slice(0, 800) });
  entry.messages.push({ role: 'assistant', content: String(assistantText || '').slice(0, 1200) });

  const maxMessages = config.memoryTurns;
  if (entry.messages.length > maxMessages) {
    entry.messages = entry.messages.slice(-maxMessages);
  }
  if (entry.messages[0]?.role !== 'user') {
    entry.messages = entry.messages.slice(1);
  }

  entry.updatedAt = Date.now();
  sessions.set(key, entry);
}
