import { silentAllowedMentions } from './channelGuard.js';
import { splitMessage } from './splitMessage.js';

function chatPayload(text) {
  return { content: text, allowedMentions: silentAllowedMentions };
}

export async function replyAi(interaction, text) {
  const chunks = splitMessage(text);
  const payload = chatPayload(chunks[0]);

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(payload);
  } else {
    await interaction.reply(payload);
  }

  for (const chunk of chunks.slice(1)) {
    await interaction.followUp(chatPayload(chunk));
  }
}

export async function sendAiMessage(message, text) {
  const chunks = splitMessage(text);
  await message.reply(chatPayload(chunks[0]));
  for (const chunk of chunks.slice(1)) {
    await message.channel.send(chatPayload(chunk));
  }
}
