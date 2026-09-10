import { loadKnowledge } from '../config.js';
import { chatCompletion } from './client.js';
import { looksLikeCheatDump } from '../lib/problemScan.js';

function extractJson(text) {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[«»"'`.,!?:;()\-—–]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksDuplicate(fact, knowledge) {
  const needle = normalize(fact);
  if (needle.length < 16) return false;
  return knowledge.split('\n').some((line) => {
    const hay = normalize(line.replace(/^[-*#\d.]+\s*/, ''));
    if (hay.length < 16) return false;
    return hay === needle || (hay.includes(needle) && needle.length > 24) || (needle.includes(hay) && hay.length > 24);
  });
}

export async function verifyPublicFact(fact, { skipModel = false } = {}) {
  const knowledge = loadKnowledge();
  if (looksLikeCheatDump(fact)) {
    return {
      ok: false,
      reply: 'Это оффсеты/ключи клиента, не публичный гайд. В базу не кладу.',
    };
  }
  if (String(fact || '').length < 1500 && looksDuplicate(fact, knowledge)) {
    return {
      ok: false,
      reply: 'Такой факт уже есть в базе. Дубликат не сохраняю.',
    };
  }

  if (skipModel) {
    return { ok: true, reason: 'Принял как публичный гайд/конфиг сообщества.' };
  }

  const raw = await chatCompletion(
    [
      {
        role: 'system',
        content: `Ты строгий проверяющий фактов для базы знаний Discord-бота WARDOGS.
Тебе дают один кандидат в факт. Сохрани в базу можно только правду, без пиздежа.

Верни ТОЛЬКО JSON:
{"verdict":"accept"|"reject","reason":"коротко по-русски"}

accept — если это:
- согласуется с известной базой знаний, ИЛИ
- явный локальный факт сообщества (каналы, роли, сборы, как пользоваться ботом), ИЛИ
- публичный гайд сообщества как зайти в Discord/игру: Zapret, списки доменов, конфиги клиента, пошаговая настройка. Это не читы и не взлом;
- длинная инструкция/конфиг, если это не баны, не тикеты и не личные данные.

reject — если это:
- противоречит базе знаний;
- выдуманная механика, урон, процент, скрытый бафф фракции, «секрет разработчиков»;
- слух без опоры, теория, шутка, токсичность;
- баны, муты, тикеты, внутренние решения администрации, личные данные;
- читы WARDOGS, обход античита Elytra, взлом аккаунтов, malware;
- порнография, эротика, нюдсы, секс-РП, gore и прочий запрещённый контент Discord;
- слишком общие пустые слова без конкретного факта.

Если не уверен, что игровой факт правдив — reject. Лучше отказать, чем записать ложь.
Публичные гайды подключения к Discord (Zapret и похожее) — accept.

ИЗВЕСТНАЯ БАЗА:
${knowledge.slice(0, 6000)}`,
      },
      {
        role: 'user',
        content: `Проверь факт:\n${String(fact).slice(0, 3500)}`,
      },
    ],
    { maxTokens: 180, temperature: 0 },
  );

  const parsed = extractJson(raw);
  const verdict = String(parsed?.verdict || '').toLowerCase();
  const reason = String(parsed?.reason || '').trim();

  if (verdict !== 'accept') {
    return {
      ok: false,
      reply: `Не прошло проверку, в базу не записал.${reason ? `\nПричина: ${reason}` : ' Похоже на выдумку или спорное утверждение.'}`,
    };
  }

  return { ok: true, reason: reason || 'Проверка пройдена.' };
}
