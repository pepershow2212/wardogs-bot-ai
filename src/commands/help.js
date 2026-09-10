import { SlashCommandBuilder } from 'discord.js';
import { replyAi } from '../lib/reply.js';

const HELP_TEXT = `Я менеджер сообщества WARDOGS, не человек и не администратор.

Как обратиться:
• \`/ask\` — вопрос по серверу, игре или Запрету
• \`/where\` — куда идти: отряд, жалоба, правила, войс, бот
• \`/rules\` — публичные правила
• \`/summary\` / \`/explain\` / \`/translate\`
• ПКМ по сообщению → «Объяснить» или «Перевести»
• \`@пинг\` — раз в 3 минуты, только нормальный вопрос. На баловство молчу
• \`/ping\` — онлайн ли я
• модеры: \`/fact\`, \`/sync\`, \`/study\`
• только модеры: \`@бот изучи #база-знаний\` — читает канал и запоминает. Обычные участники так обучить не могут.

Баны, муты, тикеты и войсы делает администрация и WARDOGS TOOLS. Я направляю и отвечаю по базе.
Тикеты, мод-логи и админку не читаю.`;

export default {
  light: true,
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('How to use WARDOGS BOT AI')
    .setDescriptionLocalization('ru', 'Как пользоваться WARDOGS BOT AI'),
  async execute(interaction) {
    await replyAi(interaction, HELP_TEXT);
  },
};
