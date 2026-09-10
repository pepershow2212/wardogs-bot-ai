import { config } from '../config.js';
import { looksLikeCheatDump, looksLikeGameCrash } from './problemScan.js';

const BOT_TEASE_RE =
  /(?:дроч\w*|задроч\w*|трах\w*|еб(?:и|ать)|соси)\s+(?:его|её|ее|бота|вардог|ai|ай)|не\s+дроч|дроч\w*\s+(?:его|бота)|тролл\w*\s+(?:его|бота)|затрол\w*\s+(?:бота|его)/i;

const OFFTOPIC_RE =
  /(?:погод[аеуыи]|прогноз\s+погод|какая\s+погода|курс\s+(?:доллар|евро)|кто\s+президент|новост\w*\s+(?:в\s+)?(?:мир|росси|москв))/i;

const BAIT_RE =
  /(?:как\s+завтра\s+не\s+умереть|скажи\s+как\s+.{0,30}умереть|напиши\s+(?:стих|рэп|анекдот)|ты\s+(?:туп|лох|гей|пидор|даун|дебил)|пош[её]л\s+нахуй|иди\s+нахуй|соси\s+(?:хуй|член)|кто\s+я\s*\?|любовь\s+это)/i;

const INSULT_BOT_RE =
  /(?:туп(?:ой|ая)\s+бот|бот\s+(?:лох|хуйня|гавно|говно)|зачем\s+ты\s+(?:нужен|живёшь)|зря\s+тебя\s+сделал)/i;

const EMPTY_TEASE_RE =
  /^(?:ну+|лол|ля|ахах+|хаха+|хех+|xd+|xdd+|жиза)\s*[.!?]*$/i;

const PRESENCE_RE =
  /^(?:тут|здесь|хай|привет|ку|ало|алло|да|эй|ау|ты\s+тут|на\s+месте)\s*[.!?]*$/i;

const SERIOUS_RE =
  /(?:запрет|zapret|правил|канал|роль|фракц|valkyr|lonestar|manticore|как\s+зайт|тикет|вардогс|wardogs|зон[аы]\s+контрол|elytra|steam|сборк|отряд|lfg|конфиг|service\.bat|winws|dpi|ранг|патч|укрыт|control\s*zone|вылет|краш|crash|fatal)/i;

const HELPER_CHANNEL_RE = /wardogs-?ai|бот-?аи|ask-?bot|ai-?help/i;

const userCooldownUntil = new Map();
const channelCooldownUntil = new Map();

function pruneMap(map, now) {
  for (const [key, until] of map) {
    if (until <= now) map.delete(key);
  }
}

function lock(map, key, ms) {
  map.set(key, Date.now() + ms);
}

function isLocked(map, key, now) {
  return Boolean(key && map.get(key) > now);
}

export function looksLikeBait(text) {
  const input = String(text || '').trim();
  if (EMPTY_TEASE_RE.test(input)) return true;
  if (BOT_TEASE_RE.test(input)) return true;
  if (OFFTOPIC_RE.test(input)) return true;
  if (BAIT_RE.test(input)) return true;
  if (INSULT_BOT_RE.test(input)) return true;
  return false;
}

export function looksLikePresence(text) {
  const input = String(text || '').trim();
  if (!input) return true;
  return PRESENCE_RE.test(input);
}

export function looksLikeSeriousHelp(text) {
  const input = String(text || '');
  return SERIOUS_RE.test(input) || looksLikeCheatDump(input) || looksLikeGameCrash(input);
}

export function isHelperChannel(channel) {
  const name = String(channel?.name || '');
  const parent = String(channel?.parent?.name || '');
  return HELPER_CHANNEL_RE.test(name) || HELPER_CHANNEL_RE.test(parent);
}

export function mentionGate({ userId, channelId, text, helperChannel = false } = {}) {
  const now = Date.now();
  pruneMap(userCooldownUntil, now);
  pruneMap(channelCooldownUntil, now);

  const userMs = helperChannel ? Math.min(config.mentionCooldownMs, 20_000) : config.mentionCooldownMs;
  const channelMs = config.mentionChannelCooldownMs;
  const input = String(text || '').trim();
  const bait = looksLikeBait(input);
  const serious = looksLikeSeriousHelp(input);
  const presence = looksLikePresence(input);

  if (helperChannel) {
    if (bait && !presence) {
      return { ignore: true, reason: 'bait' };
    }
    if (presence) {
      return {
        ignore: false,
        serious: false,
        canned: 'Да, я здесь. Напиши вопрос или /ask.',
      };
    }
    if (isLocked(userCooldownUntil, userId, now)) {
      return { ignore: false, canned: 'Секунду, уже отвечаю. Можно сразу /ask.' };
    }
    if (userId) lock(userCooldownUntil, userId, 3000);
    return { ignore: false, serious };
  }

  if (isLocked(userCooldownUntil, userId, now) || isLocked(channelCooldownUntil, channelId, now)) {
    return { ignore: true, reason: 'cooldown' };
  }

  if (bait || !serious) {
    if (userId) lock(userCooldownUntil, userId, userMs);
    if (channelId) lock(channelCooldownUntil, channelId, channelMs);
    return { ignore: true, reason: bait ? 'bait' : 'general' };
  }

  if (userId) lock(userCooldownUntil, userId, userMs);
  if (channelId) lock(channelCooldownUntil, channelId, channelMs);
  return { ignore: false, serious };
}
