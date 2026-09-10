import { config } from '../config.js';

export async function chatCompletion(messages, { maxTokens = 900, temperature = 0.55 } = {}) {
  const response = await fetch(`${config.openaiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': config.siteUrl,
      'X-Title': config.siteName,
    },
    body: JSON.stringify({
      model: config.openaiModel,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = payload?.error?.message || response.statusText || 'unknown error';
    throw new Error(`AI API error (${response.status}): ${detail}`);
  }

  const text = payload?.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error('AI API вернул пустой ответ');
  }

  return text;
}
