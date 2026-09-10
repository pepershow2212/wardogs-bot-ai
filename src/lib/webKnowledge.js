import { WEB_PATH, writeGeneratedKnowledge } from './knowledge.js';
import { logError, logInfo } from './logger.js';

const STEAM_APP_ID = '1867240';

const SOURCES = [
  {
    id: 'steam-ru',
    url: `https://store.steampowered.com/api/appdetails?appids=${STEAM_APP_ID}&l=russian`,
    kind: 'steam-app',
  },
  {
    id: 'steam-news',
    url: `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${STEAM_APP_ID}&count=10&maxlength=1200`,
    kind: 'steam-news',
  },
  {
    id: 'team17',
    url: 'https://www.team17.com/games/wardogs',
    kind: 'html',
    title: 'Team17 — WARDOGS',
  },
  {
    id: 'bulkhead',
    url: 'https://bulkhead.com/games/wardogs/',
    kind: 'html',
    title: 'BULKHEAD — WARDOGS',
  },
];

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'WARDOGS-BOT-AI/1.0 (public game knowledge; Discord helper)',
      Accept: 'application/json, text/html;q=0.9,*/*;q=0.8',
    },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.text();
}

function parseSteamApp(raw) {
  const payload = JSON.parse(raw);
  const data = payload?.[STEAM_APP_ID]?.data;
  if (!data) return '';

  const req = data.pc_requirements || {};
  const release = data.release_date?.date || 'не указана';
  const coming = data.release_date?.coming_soon ? 'ещё помечалась как coming soon в API' : 'в Steam уже как вышедшая/EA';
  const genres = (data.genres || []).map((item) => item.description).join(', ');
  const cats = (data.categories || []).map((item) => item.description).slice(0, 12).join(', ');

  return `## Steam store (app ${STEAM_APP_ID})
Название: ${data.name}
Разработчик: ${(data.developers || []).join(', ')}
Издатель: ${(data.publishers || []).join(', ')}
Дата в Steam: ${release} (${coming})
Бесплатная: ${data.is_free ? 'да' : 'нет'}
Жанры: ${genres}
Категории: ${cats}

Кратко:
${stripHtml(data.short_description || '').slice(0, 800)}

Описание:
${stripHtml(data.about_the_game || data.detailed_description || '').slice(0, 3500)}

Системные требования:
${stripHtml(req.minimum || '').slice(0, 700)}

${stripHtml(req.recommended || '').slice(0, 700)}

Страница: https://store.steampowered.com/app/${STEAM_APP_ID}/WARDOGS/`;
}

function parseSteamNews(raw) {
  const payload = JSON.parse(raw);
  const items = payload?.appnews?.newsitems || [];
  const official = items.filter(
    (item) =>
      Number(item.appid) === Number(STEAM_APP_ID) &&
      (item.feedname === 'steam_community_announcements' || (item.tags || []).includes('patchnotes')),
  );

  if (!official.length) return '';

  const lines = official.slice(0, 8).map((item) => {
    const when = item.date ? new Date(item.date * 1000).toISOString().slice(0, 10) : '';
    const body = stripHtml(item.contents || '').slice(0, 900);
    return `### ${item.title} (${when})
${body}`;
  });

  return `## Официальные новости Steam
Это объявления разработчиков, не слухи. Если новость старше текущих патчей — не выдавай её за сегодняшний баланс.

${lines.join('\n\n')}`;
}

function parseHtmlPage(raw, title, url) {
  const text = stripHtml(raw).slice(0, 2500);
  if (text.length < 80) return '';
  return `## ${title}
Источник: ${url}

${text}`;
}

export async function ingestWebKnowledge() {
  const sections = [`# Интернет-база WARDOGS

Снято: ${new Date().toISOString()}
Только официальные публичные страницы: Steam, Team17, BULKHEAD.
Случайный интернет и тикеты не читаются.`];

  let ok = 0;
  let failed = 0;

  for (const source of SOURCES) {
    try {
      const raw = await fetchText(source.url);
      let block = '';
      if (source.kind === 'steam-app') block = parseSteamApp(raw);
      else if (source.kind === 'steam-news') block = parseSteamNews(raw);
      else block = parseHtmlPage(raw, source.title, source.url);

      if (block) {
        sections.push(block);
        ok += 1;
      }
    } catch (error) {
      failed += 1;
      logError('web knowledge', source.id, error.message);
    }
  }

  const body = sections.join('\n\n').slice(0, 16_000);
  writeGeneratedKnowledge(WEB_PATH, body);
  logInfo(`интернет-база: источников=${ok} ошибок=${failed} символов=${body.length}`);
  return { sources: ok, failed, chars: body.length };
}
