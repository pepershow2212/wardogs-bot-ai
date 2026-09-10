import { config } from '../config.js';
import { checkRateLimit } from './rateLimit.js';

const busyUsers = new Set();
const pending = [];
let active = 0;

export function tryAccept(userId) {
  if (busyUsers.has(userId)) {
    return {
      ok: false,
      reply: 'Дождись текущего ответа — я уже обрабатываю твой запрос.',
    };
  }

  if (pending.length >= config.maxQueueSize) {
    return {
      ok: false,
      reply: 'Сейчас очередь переполнена. Попробуй через минуту.',
    };
  }

  const rate = checkRateLimit(userId);
  if (!rate.ok) return rate;

  busyUsers.add(userId);
  return { ok: true };
}

export function releaseUser(userId) {
  busyUsers.delete(userId);
}

export function enqueue(task) {
  return new Promise((resolve, reject) => {
    pending.push({ task, resolve, reject });
    pump();
  });
}

async function pump() {
  if (active >= config.aiConcurrency) return;
  const job = pending.shift();
  if (!job) return;

  active += 1;
  try {
    job.resolve(await job.task());
  } catch (error) {
    job.reject(error);
  } finally {
    active -= 1;
    pump();
  }
}
