require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const { PrismaClient } = require('@prisma/client');

// ── Startup validation ───────────────────────────────────────────────────────

if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN is not set. Please add it to your .env file.');
  process.exit(1);
}

const ADMIN_ID = Number(process.env.ADMIN_ID);
if (!process.env.ADMIN_ID || isNaN(ADMIN_ID)) {
  console.error('❌ ADMIN_ID is not set or is invalid. Please add a valid numeric Telegram user ID to your .env file.');
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);
const prisma = new PrismaClient();

// ── Constants ────────────────────────────────────────────────────────────────

const DEPARTMENTS = [
  'Software Engineering',
  'Computer Science',
  'Cyber Security',
  'Information Systems',
  'Information Technology',
];

const CATEGORY_LABELS = {
  Exam: 'Exams 📝',
  Handout: 'Handouts 📚',
  Book: 'Reference Books 📖',
};

// Maps display label → DB enum value
const LABEL_TO_CATEGORY = Object.fromEntries(
  Object.entries(CATEGORY_LABELS).map(([key, label]) => [label, key])
);

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build the main Reply Keyboard shown after /start */
function departmentKeyboard() {
  const rows = [];
  for (let i = 0; i < DEPARTMENTS.length; i += 2) {
    rows.push(DEPARTMENTS.slice(i, i + 2));
  }
  return Markup.keyboard(rows).resize();
}

/** Build the Inline Keyboard shown after a department is selected */
function categoryInlineKeyboard(departmentName) {
  const buttons = Object.entries(CATEGORY_LABELS).map(([category, label]) =>
    Markup.button.callback(label, `cat:${departmentName}:${category}`)
  );
  return Markup.inlineKeyboard(buttons, { columns: 1 });
}

// ── /start ───────────────────────────────────────────────────────────────────

bot.start((ctx) =>
  ctx.reply(
    '🕌 Assalamu Alaikum! Welcome to the *Bahir Dar Muslim Academics Jemea (BDMAJ)* Bot.\n\n' +
      'Please select your department from the menu below to access study materials.',
    {
      parse_mode: 'Markdown',
      ...departmentKeyboard(),
    }
  )
);

// ── Department selection (Reply Keyboard) ────────────────────────────────────

bot.hears(DEPARTMENTS, (ctx) => {
  const department = ctx.message.text;
  return ctx.reply(
    `📂 *${department}*\n\nChoose a category:`,
    {
      parse_mode: 'Markdown',
      ...categoryInlineKeyboard(department),
    }
  );
});

// ── Category selection (Inline Keyboard callback) ────────────────────────────

bot.action(/^cat:(.+):(Exam|Handout|Book)$/, async (ctx) => {
  await ctx.answerCbQuery();

  const departmentName = ctx.match[1];
  const category = ctx.match[2];
  const categoryLabel = CATEGORY_LABELS[category];

  try {
    const department = await prisma.department.findUnique({
      where: { name: departmentName },
    });

    if (!department) {
      return ctx.reply(
        `⚠️ Department "${departmentName}" was not found in the database. Please contact an admin.`
      );
    }

    const materials = await prisma.material.findMany({
      where: {
        departmentId: department.id,
        category,
      },
    });

    if (materials.length === 0) {
      return ctx.reply(
        `😔 No *${categoryLabel}* are available for *${departmentName}* yet. Check back later!`,
        { parse_mode: 'Markdown' }
      );
    }

    await ctx.reply(
      `📋 *${categoryLabel}* for *${departmentName}* — sending ${materials.length} file(s)…`,
      { parse_mode: 'Markdown' }
    );

    for (const material of materials) {
      await ctx.replyWithDocument(material.fileId, {
        caption: material.title,
      });
    }
  } catch (error) {
    console.error('Error fetching materials:', error);
    await ctx.reply('⚠️ An error occurred while fetching materials. Please try again later.');
  }
});

// ── Admin: capture file_id ────────────────────────────────────────────────────
//
// When an admin (whose Telegram user ID is set in ADMIN_ID) forwards or sends
// a document to the bot, the bot replies with the file_id so the admin can
// save it to the database via `prisma studio` or a migration seed script.
//
// Usage:
//   1. Set ADMIN_ID in .env to your Telegram numeric user ID.
//   2. Send any document to the bot.
//   3. The bot replies with the file_id and a reminder of the expected format.

bot.on('document', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return; // ignore non-admins

  const { file_id, file_name } = ctx.message.document;
  const caption = ctx.message.caption || '';

  await ctx.reply(
    `📎 *File received*\n\n` +
      `*Name:* ${file_name || 'unknown'}\n` +
      `*Caption:* ${caption || '(none)'}\n\n` +
      `*file\\_id:*\n\`${file_id}\`\n\n` +
      `Use this \`file_id\` when adding a Material record to the database.`,
    { parse_mode: 'Markdown' }
  );
});

// ── Launch ───────────────────────────────────────────────────────────────────

bot.launch().then(() => console.log('🤖 BDMAJ Bot is running…'));

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
