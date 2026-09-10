export function languageFromLocale(locale) {
  const value = String(locale || 'ru').toLowerCase();
  if (value.startsWith('ru')) return 'русский';
  if (value.startsWith('uk')) return 'украинский';
  if (value.startsWith('en')) return 'английский';
  if (value.startsWith('de')) return 'немецкий';
  if (value.startsWith('pl')) return 'польский';
  if (value.startsWith('fr')) return 'французский';
  if (value.startsWith('es')) return 'испанский';
  return locale || 'русский';
}

export function messageText(message) {
  return String(message?.content || '').trim();
}
