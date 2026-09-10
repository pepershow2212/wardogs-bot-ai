const ILLEGAL_SEX_RE =
  /(?:child\s*porn|csam|cp\s*pack|loli|shota|детск\w*\s*порно|малолет|педофил|child\s*sex|секс.{0,20}(?:дет|школьн|малолет))/i;

const PORN_RE =
  /(?:\bporn(?:ography|hub|o)?\b|порно(?:графи\w*|хух\w*)?|порнух\w*|hentai|хентай|rule\s*34|onlyfans|нуд[сы]|nudes?|dick\s*pic|секс[\s-]?рп|\berp\b|эротическ\w*|эротика|трах(?:ать|ни)|xxx\s*video|nsfw\s*(?:pic|image|фото|рп|rp)|голые?\s+(?:фото|картин|девуш|женщ)|опиши\s+(?:секс|еблю)|ролевая\s+на\s+секс)/i;

const GORE_RE =
  /(?:\bgore\b|снофф|\bsnuff\b|расчлененк|гибель\s+в\s+деталях|real\s*death\s*video)/i;

const NSFW_RULE_Q_RE =
  /(?:можно|где|в каком канале|разреш\w*|запрещ\w*|пост(?:ить|ить)).{0,60}(?:nsfw|нюдс|18\+|порнограф|эротик)/i;

const CONTINUATION_RE =
  /^(ну\s+)?(а\s+)?(если|расскажи|продолж\w*|подробнее|please|плиз|давай|ну же|почему нет|ну пожалуйста)[\s.!?]*$/i;

export const TOPIC_REFUSAL =
  'На такие темы не общаюсь. Если вопрос по игре или правилам сервера — напиши его без запрещённого контента.';

export const ILLEGAL_REFUSAL = 'Это незаконно. Я этим не занимаюсь.';

export const RULES_ONLY_REFUSAL =
  'Смотри /rules. Такие темы и контент я не обсуждаю.';

const recentTopicRefusal = new Map();
const REFUSAL_TTL_MS = 15 * 60 * 1000;

function pruneRefusals(now = Date.now()) {
  for (const [key, at] of recentTopicRefusal) {
    if (now - at > REFUSAL_TTL_MS) recentTopicRefusal.delete(key);
  }
}

export function markTopicRefusal(key) {
  if (!key) return;
  pruneRefusals();
  recentTopicRefusal.set(key, Date.now());
}

export function hadRecentTopicRefusal(key) {
  if (!key) return false;
  pruneRefusals();
  return recentTopicRefusal.has(key);
}

export function looksLikeContinuation(text) {
  return CONTINUATION_RE.test(String(text || '').trim());
}

export function classifyForbiddenTopic(text) {
  const input = String(text || '');
  if (!input.trim()) return { code: 'ok' };
  if (ILLEGAL_SEX_RE.test(input)) return { code: 'illegal' };
  if (GORE_RE.test(input)) return { code: 'gore' };
  if (NSFW_RULE_Q_RE.test(input) && !/опиши|напиши|скинь|генерир|rp|рп/i.test(input)) {
    return { code: 'rules_only' };
  }
  // «дрочить бота» в чате = троллить, не порно
  const botTease =
    /(?:дроч\w*|задроч\w*)\s+(?:его|её|ее|бота|вардог)|не\s+дроч\w*\s+(?:его|бота|ай)/i.test(input);
  if (PORN_RE.test(input) && !botTease) return { code: 'porn' };
  return { code: 'ok' };
}

export function refusalFor(code) {
  if (code === 'illegal') return ILLEGAL_REFUSAL;
  if (code === 'rules_only') return RULES_ONLY_REFUSAL;
  if (code === 'porn' || code === 'gore') return TOPIC_REFUSAL;
  return null;
}

export function looksLikeForbiddenOutput(text) {
  const classified = classifyForbiddenTopic(text);
  return classified.code !== 'ok' && classified.code !== 'rules_only';
}

export function stripForbiddenLines(text) {
  return String(text || '')
    .split('\n')
    .filter((line) => classifyForbiddenTopic(line).code === 'ok')
    .join('\n')
    .trim();
}
