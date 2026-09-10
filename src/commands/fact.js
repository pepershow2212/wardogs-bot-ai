import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { verifyPublicFact } from '../ai/verifyFact.js';
import {
  allowedKnowledgeFile,
  appendLearnedFact,
  FACT_MAX_CHARS,
  FILE_MAX_BYTES,
  FILE_MAX_CHARS,
  looksLikeCommunityGuide,
  saveKnowledgeFile,
  validateFact,
} from '../lib/knowledge.js';
import { replyAi } from '../lib/reply.js';

async function readAttachment(attachment) {
  if (attachment.size > FILE_MAX_BYTES) {
    return { ok: false, reply: 'Файл слишком большой. Нужен текст/конфиг до 200 КБ.' };
  }
  if (!allowedKnowledgeFile(attachment.name, attachment.contentType || '')) {
    return { ok: false, reply: 'Нужен текстовый файл: txt, md, cfg, conf, ini, json, list или bat.' };
  }

  try {
    const response = await fetch(attachment.url);
    if (!response.ok) {
      return { ok: false, reply: 'Не смог скачать файл. Попробуй ещё раз.' };
    }
    const raw = await response.text();
    if (raw.includes('\0')) {
      return { ok: false, reply: 'Это не текстовый файл, в базу не кладу.' };
    }
    return { ok: true, text: raw.slice(0, FILE_MAX_CHARS), name: attachment.name };
  } catch {
    return { ok: false, reply: 'Не смог прочитать файл. Попробуй ещё раз.' };
  }
}

export default {
  bypassChannelGuard: true,
  ephemeral: true,
  data: new SlashCommandBuilder()
    .setName('fact')
    .setDescription('Add a verified public fact or guide to the bot knowledge base')
    .setDescriptionLocalization('ru', 'Добавить проверенный публичный факт, гайд или конфиг в базу бота')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) =>
      option
        .setName('text')
        .setNameLocalization('ru', 'текст')
        .setDescription('Public fact or guide (up to 4000 characters)')
        .setDescriptionLocalization('ru', 'Публичный факт или гайд (до 4000 символов)')
        .setRequired(false)
        .setMaxLength(FACT_MAX_CHARS),
    )
    .addAttachmentOption((option) =>
      option
        .setName('file')
        .setNameLocalization('ru', 'файл')
        .setDescription('txt/md/cfg guide or config')
        .setDescriptionLocalization('ru', 'Текстовый гайд или конфиг (txt, cfg, md)'),
    ),
  async execute(interaction) {
    const submitted = interaction.options.getString('text');
    const attachment = interaction.options.getAttachment('file');

    if (!submitted && !attachment) {
      await replyAi(interaction, 'Нужен текст и/или файл. Для длинных гайдов и Zapret лучше прикрепи .txt');
      return;
    }

    const chunks = [];
    let pendingFile = null;

    if (submitted) {
      const checked = validateFact(submitted);
      if (!checked.ok) {
        await replyAi(interaction, checked.reply);
        return;
      }
      chunks.push(checked.text);
    }

    if (attachment) {
      const file = await readAttachment(attachment);
      if (!file.ok) {
        await replyAi(interaction, file.reply);
        return;
      }
      const checked = validateFact(file.text, { maxChars: FILE_MAX_CHARS });
      if (!checked.ok) {
        await replyAi(interaction, checked.reply);
        return;
      }
      pendingFile = { name: file.name, text: checked.text };
      chunks.push(`Файл ${file.name}:\n${checked.text}`);
    }

    const fact = chunks.join('\n\n').trim();
    let verified;
    try {
      verified = await verifyPublicFact(fact, {
        skipModel: looksLikeCommunityGuide(fact) || Boolean(attachment),
      });
    } catch {
      await replyAi(interaction, 'Проверка не удалась, в базу ничего не записал. Попробуй ещё раз.');
      return;
    }
    if (!verified.ok) {
      await replyAi(interaction, verified.reply);
      return;
    }

    let savedFile = '';
    if (pendingFile) {
      savedFile = saveKnowledgeFile(pendingFile.name, pendingFile.text);
    }

    const learnedBody = submitted
      ? pendingFile
        ? `${chunks[0]}\n\nФайл ${pendingFile.name}:\n${pendingFile.text.slice(0, 6000)}`
        : chunks[0]
      : pendingFile.text.slice(0, 8000);

    appendLearnedFact(learnedBody, {
      title: attachment ? `Гайд/конфиг ${attachment.name}` : 'Факт сообщества',
    });

    const preview = (submitted || attachment?.name || fact).slice(0, 500);
    await replyAi(
      interaction,
      `Проверил и сохранил. Бот начнёт это использовать сразу.\n• ${preview}${
        savedFile ? `\n• файл: knowledge/files/${savedFile}` : ''
      }${verified.reason ? `\n\nПроверка: ${verified.reason}` : ''}`,
    );
  },
};
