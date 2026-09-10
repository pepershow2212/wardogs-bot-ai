import { chatCompletion } from './client.js';
import {
  looksLikeForbiddenOutput,
  markTopicRefusal,
  stripForbiddenLines,
  TOPIC_REFUSAL,
} from './contentPolicy.js';
import { buildSystemPrompt } from './persona.js';
import { inspectUserRequest, looksLikePromptLeak, sanitizeBotOutput } from './safety.js';
import { getServerRules } from '../lib/channelRules.js';
import { getHistory, rememberTurn } from '../lib/memory.js';
import { buildManagerRoute, channelRef, findChannel } from '../lib/manager.js';
import { CHEAT_DUMP_REPLY, scrubCheatDump } from '../lib/problemScan.js';
import { retrieveKnowledge } from '../lib/retrieve.js';

export async function askAi({
  userText,
  extraContext = '',
  nsfwChannel = false,
  instruction = '',
  memoryKey = null,
  guild = null,
  mention = false,
}) {
  const safety = inspectUserRequest(userText, { memoryKey, mention });
  if (!safety.ok) {
    if (safety.topic) markTopicRefusal(memoryKey);
    if (safety.silent) return '';
    if (safety.cheatDump) {
      const help = findChannel(guild, /помощ|вопрос|жалоб/i);
      return `${CHEAT_DUMP_REPLY}${help ? `\nЖалоба модерам: ${channelRef(help)}` : ''}`;
    }
    return safety.reply;
  }

  const cleanedContext = scrubCheatDump(stripForbiddenLines(extraContext));
  const serverRules = await getServerRules(guild);
  const routeHint = buildManagerRoute(guild, userText);
  const relevantKnowledge = retrieveKnowledge(userText);
  const task = safety.crash
    ? 'Это лог вылета Unreal, не читы. Помоги по запуску/GPU/драйверам: что значит ошибка и что проверить. Не проси и не разбирай GObjects, AES, оффсеты и ключи. Если мало данных — скажи прислать кусок Fatal error / Callstack.'
    : instruction
      ? `Задача: ${instruction}`
      : mention
        ? 'Задача: Пинг в чате. Ты менеджер. Максимум 2 предложения. Куда идти — если ясно. Не корми троллей.'
        : 'Задача: Ты менеджер сервера. Сразу ответ и куда идти. Без простыни, если это не пошаговый гайд.';

  const userContent = [
    task.startsWith('Задача:') ? task : `Задача: ${task}`,
    cleanedContext ? `Контекст канала (последние сообщения):\n${cleanedContext}` : '',
    `Сообщение пользователя:\n${userText}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const history = memoryKey ? getHistory(memoryKey) : [];
  const raw = await chatCompletion([
    { role: 'system', content: buildSystemPrompt({ nsfwChannel, serverRules, relevantKnowledge, routeHint }) },
    ...history,
    { role: 'user', content: userContent },
  ]);

  if (looksLikeForbiddenOutput(raw)) {
    markTopicRefusal(memoryKey);
    return mention ? '' : TOPIC_REFUSAL;
  }

  if (looksLikePromptLeak(raw)) {
    return 'Это внутренние инструкции бота. Могу помочь с вопросом по серверу или игре.';
  }

  const answer = sanitizeBotOutput(raw);
  if (memoryKey) rememberTurn(memoryKey, userText, answer);
  return answer;
}
