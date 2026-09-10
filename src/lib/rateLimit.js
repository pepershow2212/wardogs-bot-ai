import { config } from '../config.js';

const hits = new Map();

export function checkRateLimit(userId) {
  const now = Date.now();
  const windowMs = 60_000;
  const recent = (hits.get(userId) || []).filter((stamp) => now - stamp < windowMs);

  if (recent.length >= config.userRateLimit) {
    hits.set(userId, recent);
    const retryAfterSec = Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000));
    return {
      ok: false,
      reply: `Слишком много запросов. Подожди ещё ${retryAfterSec} сек.`,
    };
  }

  recent.push(now);
  hits.set(userId, recent);
  return { ok: true };
}
