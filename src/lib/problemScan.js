const UE_DUMP_MARKERS = [
  /\bGObjects\b/i,
  /\bGNames\b/i,
  /\bGWorld\b/i,
  /\bProcessEvent(?:Idx)?\b/i,
  /\bStaticFindObject\b/i,
  /\bDrawTransitionIdx\b/i,
  /\bAppendString\b/i,
  /\bcameraCache\b/i,
  /\bactorsArray\b/i,
  /\bNumElements\b/i,
  /\bRootComponent\b/i,
];

const CRASH_RE =
  /(?:fatal\s*error|lowlevelfatalerror|assertion\s*failed|unhandled\s*exception|ensure\s+condition\s+failed|gpu\s+(?:crash|hung|timeout)|dxgi_error|d3d(?:11|12)\s*(?:device\s*)?(?:removed|hung)|callstack|crashreporter|===+\s*critical\s*error)/i;

export const CHEAT_DUMP_REPLY =
  'Это не лог краша. Это дамп внутренних адресов Unreal (GObjects / GWorld / ProcessEvent) и/или ключ шифрования — материал для читов и взлома клиента.\n\nОффсеты, AES-ключи и обход Elytra не разбираю и не объясняю. На сервере это запрещено. Удали сообщение и напиши модерам.\n\nЕсли игра реально вылетает — пришли текст Fatal error / Callstack из лога WARDOGS, без адресов GObjects и без ключей. Тогда разберём запуск и железо.';

function hexOffsetCount(text) {
  return (String(text || '').match(/0x[0-9a-fA-F]{4,}/g) || []).length;
}

export function looksLikeAesKeyDump(text) {
  const input = String(text || '');
  if (!/AES\s*Key/i.test(input) && !/\bpak\s*(?:decrypt|key)|decrypt(?:ion)?\s*key/i.test(input)) {
    return false;
  }
  return /[0-9A-Fa-f]{32,}/.test(input.replace(/\s+/g, ''));
}

export function looksLikeCheatDump(text) {
  const input = String(text || '');
  if (!input.trim()) return false;
  if (looksLikeAesKeyDump(input)) return true;

  const markers = UE_DUMP_MARKERS.reduce((count, re) => count + (re.test(input) ? 1 : 0), 0);
  const offsets = hexOffsetCount(input);
  if (markers >= 2 && offsets >= 3) return true;
  if (markers >= 1 && /constexpr/i.test(input) && offsets >= 4) return true;
  if (
    /(?:оффсет|offset)\s*(?:dump|дамп)|sdk\s*dump|ue(?:4|5)\s*(?:sdk|dump)|обход\s*elytra/i.test(input) &&
    offsets >= 3
  ) {
    return true;
  }
  return false;
}

export function looksLikeGameCrash(text) {
  const input = String(text || '');
  if (!input.trim() || looksLikeCheatDump(input)) return false;
  return CRASH_RE.test(input);
}

export function scrubCheatDump(text) {
  const input = String(text || '');
  if (looksLikeCheatDump(input)) return '';
  return input
    .split('\n')
    .filter((line) => !looksLikeCheatDump(line) && !looksLikeAesKeyDump(line))
    .join('\n')
    .replace(/AES\s*Key[\s\S]{0,240}/gi, '[ключ убран]')
    .trim();
}
