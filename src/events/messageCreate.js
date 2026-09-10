import { Events } from 'discord.js';
import { askAi } from '../ai/ask.js';
import { config } from '../config.js';
import { checkChannelAccess } from '../lib/channelGuard.js';
import { recentChannelContext } from '../lib/context.js';
import { logError } from '../lib/logger.js';
import { sessionKey } from '../lib/memory.js';
import { enqueue, releaseUser, tryAccept } from '../lib/queue.js';
import { sendAiMessage } from '../lib/reply.js';
import { isHelperChannel, mentionGate } from '../lib/trollGuard.js';
import { canTrainBot, looksLikeStudyRequest, studyFromMessage } from '../lib/study.js';

function mentionedBot(message, botId) {
  if (message.mentions.users.has(botId)) return true;
  return new RegExp(`<@!?${botId}>`).test(message.content || '');
}

export function registerMessageHandler(client) {
  if (!config.enableMentions) return;

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (message.system) return;

    const access = checkChannelAccess(message.channel);
    if (!access.ok) return;

    const botId = client.user.id;
    if (!mentionedBot(message, botId)) return;

    const question = message.content.replace(new RegExp(`<@!?${botId}>`, 'g'), '').trim();
    const helper = isHelperChannel(message.channel);
    const troll = mentionGate({
      channelId: message.channelId,
      userId: message.author.id,
      text: question,
      helperChannel: helper,
    });
    if (troll.ignore) return;

    if (troll.canned) {
      await sendAiMessage(message, troll.canned).catch(() => {});
      return;
    }

    const gate = tryAccept(message.author.id);
    if (!gate.ok) {
      if (helper && gate.reply) await sendAiMessage(message, gate.reply).catch(() => {});
      return;
    }

    try {
      await message.channel.sendTyping();
      if (looksLikeStudyRequest(question)) {
        if (!canTrainBot(message.member)) {
          if (message.mentions.channels?.size) {
            await sendAiMessage(message, 'Обучать бота могут только модераторы.');
            return;
          }
        } else {
          const studied = await studyFromMessage(message.guild, message, question);
          await sendAiMessage(message, studied.reply);
          return;
        }
      }
      const extraContext = helper || troll.serious
        ? await recentChannelContext(message.channel, botId)
        : '';
      const answer = await enqueue(() => askAi({
        userText: question || 'Пользователь позвал бота. Коротко скажи, что ты на месте, и предложи задать вопрос.',
        extraContext,
        nsfwChannel: Boolean(message.channel?.nsfw),
        instruction: helper
          ? 'Ответь по базе знаний. Если спрашивают, что ты изучил на сервере — перечисли публичные каналы, роли, гайды и закрепы из базы. Не выдумывай. Тикеты и админку не раскрывай.'
          : 'Пинг в чате. Максимум 2 предложения. Не корми троллей.',
        memoryKey: sessionKey(message),
        guild: message.guild,
        mention: !helper,
      }));
      await sendAiMessage(
        message,
        answer || 'Не смог сейчас ответить. Напиши /ask ещё раз.',
      );
    } catch (error) {
      logError('message handler failed', error.message);
      await sendAiMessage(message, 'Сбой ответа. Попробуй /ask.').catch(() => {});
    } finally {
      releaseUser(message.author.id);
    }
  });
}
