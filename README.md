# WARDOGS BOT AI

Официальный AI-помощник Discord-сервера WARDOGS.

Бот работает **только через официальный Discord Bot API**. Это не self-bot и не пользовательский аккаунт — такие вещи Discord запрещает.

## Что умеет

- `/ask` — ответить на вопрос
- `/summary` — суммировать последние 5–10 сообщений
- `/explain` — объяснить простыми словами
- `/translate` — перевести
- `/rules` — правила из публичного канала (закрепы + последние посты)
- `/help` — как пользоваться
- `/fact` — модераторы: факт, гайд или текстовый конфиг (до 4000 символов + файл)
- `/sync` — модераторы: сразу обновить карту каналов, роли и публичную базу
- ПКМ по сообщению → **Объяснить** / **Перевести**
- отвечает на **упоминание** и на **ответ на своё сообщение**
- сам читает публичные гайды, форум базы знаний, закрепы, список каналов и ролей
- короткая память диалога в оперативке (без записи на диск)
- отвечает только в каналах из белого списка, если он задан
- в обычный чат сам не вмешивается

## Условия Discord, которые бот соблюдает

- только Bot Token из Developer Portal, без токенов людей
- основные действия — slash-команды (`applications.commands`)
- Message Content Intent включается для упоминаний, правил и чтения публичной базы знаний
- не запрашивает Administrator, Presence и Server Members
- discord.js сам соблюдает rate limit Discord
- антиспам: лимит запросов на пользователя
- не пингует `@everyone` / `@here` / роли
- не сохраняет личную переписку; короткая память живёт только в RAM
- публичные гайды/закрепы и факты из `/fact` пишет в `knowledge/`
- игнорирует админ-каналы, тикеты и мод-логи; может работать только в `ALLOWED_CHANNEL_IDS`
- не пишет в ЛС, пока не включён `ENABLE_DMS`
- очередь запросов и лимит на пользователя, чтобы не спамить API Discord
- отказывается помогать с рейдами, токенами, фишингом, читами, self-bot

Документы Discord:

- [Developer Terms of Service](https://support-dev.discord.com/hc/en-us/articles/8562894815383-Discord-Developer-Terms-of-Service)
- [Developer Policy](https://support-dev.discord.com/hc/en-us/articles/8563934450327-Discord-Developer-Policy)
- [Community Guidelines](https://discord.com/guidelines)

## 1. Создай приложение Discord

1. Открой [Discord Developer Portal](https://discord.com/developers/applications) и нажми **New Application**.
2. Имя: `WARDOGS BOT AI`.
3. Вкладка **Bot**:
   - Reset Token → скопируй токен в `DISCORD_TOKEN`.
   - Public Bot можно оставить включённым, если бот только для вашего сервера — лучше выключить.
   - **Privileged Gateway Intents**:
     - `MESSAGE CONTENT INTENT` — включи, если бот должен отвечать на @упоминания.
     - `PRESENCE INTENT` — выключи.
     - `SERVER MEMBERS INTENT` — выключи.
4. Вкладка **General Information**: скопируй **Application ID** в `DISCORD_CLIENT_ID`.
5. Вкладка **OAuth2 → URL Generator**:
   - Scopes: `bot` и `applications.commands`
   - Bot Permissions:
     - View Channels
     - Send Messages
     - Embed Links
     - Read Message History
   - **Не ставь Administrator.**
6. Открой получившуюся ссылку и пригласи бота на сервер WARDOGS.

Готовая ссылка (подставь свой Application ID):

```
https://discord.com/oauth2/authorize?client_id=APPLICATION_ID&permissions=84992&scope=bot%20applications.commands
```

`84992` = View Channels + Send Messages + Embed Links + Read Message History.

## 2. Настрой бота на компьютере

Нужен [Node.js 18+](https://nodejs.org/).

```bash
copy .env.example .env
npm install
```

В `.env` впиши только свои ключи. Пример без данных лежит в `.env.example` — его можно держать в Git. Файл `.env` в репозиторий не кладётся.

- `DISCORD_TOKEN` — токен бота
- `DISCORD_CLIENT_ID` — Application ID
- `DISCORD_GUILD_ID` — ID сервера WARDOGS (команды появятся сразу)
- `OPENAI_API_KEY` — ключ ProxyAPI из https://console.proxyapi.ru
- `ALLOWED_CHANNEL_IDS` — каналы, где боту можно отвечать (рекомендуется)
- `ADMIN_CHANNEL_IDS` — ID админ/тикет/лог каналов через запятую

Публичные правила бот читает из Discord-канала `правила` / Rules / Community rules. Файл `rules/server-rules.md` — только запасной вариант.  
База знаний по игре: `knowledge/wardogs.md`.  
Локальные факты и гайды (в том числе длинные и файлом) модераторы добавляют командой `/fact`.  
Сам бот периодически снимает карту каналов/ролей и читает публичные форумы/каналы с именами вроде базы знаний, FAQ, гайдов и помощи. Тикеты, мод-логи и админку не читает. Весь общий чат сам не заучивает. Принудительно обновить: `/sync`. Каналы базы можно задать в `KNOWLEDGE_CHANNEL_IDS`.

Запуск:

```bash
npm start
```

## 3. ИИ-провайдер (ProxyAPI)

Оплата в рублях, без тарифов-подписок: слева в консоли **Биллинг** → пополни баланс. Списывается по факту запросов.

Модель бота: `openai/gpt-4o-mini`.  
Адрес API: `https://api.proxyapi.ru/v1`.

Ключ в чат не присылай.

Сообщения пользователя уходят в ProxyAPI только в момент ответа. Локально они не пишутся в файлы. Подробности: [PRIVACY.md](PRIVACY.md).

## 4. Важно про Message Content

Discord считает Message Content привилегированным интентом.

- До ~10 000 пользователей его можно включить в Developer Portal.
- Если интент не нужен, поставь `ENABLE_MENTIONS=false` — останутся только слэш-команды. Это самый безопасный режим с точки зрения Discord.

## Если бот не отвечает

- Проверь, что бот онлайн (`npm start` запущен).
- Slash-команды не видны: задай `DISCORD_GUILD_ID` и перезапусти, либо подожди до часа для глобальных команд.
- Упоминания не работают: включи Message Content Intent и `ENABLE_MENTIONS=true`.
- Бот молчит не в том канале: проверь `ALLOWED_CHANNEL_IDS` и `ADMIN_CHANNEL_IDS`.
- ПКМ-команды не видны: перезапусти бота с заполненным `DISCORD_GUILD_ID`.
- Ошибка AI API: проверь `OPENAI_API_KEY` и `OPENAI_BASE_URL`.
