const LIMIT = 1900;

export function splitMessage(text) {
  const clean = String(text || '').trim() || 'Пустой ответ.';
  if (clean.length <= LIMIT) return [clean];

  const chunks = [];
  let remaining = clean;

  while (remaining.length > LIMIT) {
    let cut = remaining.lastIndexOf('\n', LIMIT);
    if (cut < 400) cut = remaining.lastIndexOf(' ', LIMIT);
    if (cut < 400) cut = LIMIT;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}
