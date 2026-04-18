require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const prisma = require('./prismaClient');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Department display names to slugs mapping
const DEPARTMENTS = [
  { label: '💻 Software Engineering', slug: 'software' },
  { label: '🖥️ Computer Science', slug: 'computer_science' },
  { label: '🔒 Cyber Security', slug: 'cyber' },
];

// Category display labels to DB enum mapping
const CATEGORIES = {
  '📝 Exams': 'EXAMS',
  '📚 Handouts': 'HANDOUTS',
  '📖 Reference Books': 'REFERENCE_BOOKS',
};

// Reverse lookup: DB enum → display label
const CATEGORY_LABELS = Object.fromEntries(
  Object.entries(CATEGORIES).map(([label, value]) => [value, label])
);

// Build the main reply keyboard from departments
function buildDepartmentKeyboard() {
  const buttons = DEPARTMENTS.map((d) => [d.label]);
  buttons.push(['ℹ️ About']);
  return Markup.keyboard(buttons).resize();
}

// Build inline keyboard for material categories given a department slug
function buildCategoryInlineKeyboard(slug) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📝 Exams', `category:${slug}:EXAMS`)],
    [Markup.button.callback('📚 Handouts', `category:${slug}:HANDOUTS`)],
    [Markup.button.callback('📖 Reference Books', `category:${slug}:REFERENCE_BOOKS`)],
  ]);
}

// /start command — greet user and show department keyboard
bot.start(async (ctx) => {
  await ctx.reply(
    `🕌 Welcome to the *BDU Muslim Academics Bot (BDUMAJ)*!\n\nPlease select your department below:`,
    {
      parse_mode: 'Markdown',
      ...buildDepartmentKeyboard(),
    }
  );
});

// Handle department selection via the custom keyboard
bot.hears(
  DEPARTMENTS.map((d) => d.label),
  async (ctx) => {
    const label = ctx.message.text;
    const dept = DEPARTMENTS.find((d) => d.label === label);
    if (!dept) return;

    await ctx.reply(
      `You selected *${label}*.\n\nWhat would you like to access?`,
      {
        parse_mode: 'Markdown',
        ...buildCategoryInlineKeyboard(dept.slug),
      }
    );
  }
);

// About button
bot.hears('ℹ️ About', async (ctx) => {
  await ctx.reply(
    `*BDUMAJ Academic Bot*\n\nThis bot provides educational materials (exams, handouts, and reference books) for students of Bahir Dar University Muslim Academics Jemea (BDUMAJ).\n\nDeveloped to make academic resources easily accessible through Telegram.`,
    { parse_mode: 'Markdown' }
  );
});

// Handle category inline button callbacks: category:<slug>:<CATEGORY>
bot.action(/^category:(.+):(.+)$/, async (ctx) => {
  const slug = ctx.match[1];
  const category = ctx.match[2];

  const categoryLabel = CATEGORY_LABELS[category];

  await ctx.answerCbQuery();

  let department;
  try {
    department = await prisma.department.findUnique({ where: { slug } });
  } catch (err) {
    console.error('DB error:', err);
    return ctx.reply('⚠️ Database error. Please try again later.');
  }

  if (!department) {
    return ctx.editMessageText(
      `⚠️ Department not found. Please contact an administrator.`
    );
  }

  let materials;
  try {
    materials = await prisma.material.findMany({
      where: { departmentId: department.id, category },
    });
  } catch (err) {
    console.error('DB error:', err);
    return ctx.reply('⚠️ Database error. Please try again later.');
  }

  if (materials.length === 0) {
    return ctx.editMessageText(
      `📭 No *${categoryLabel}* found for *${department.name}* yet.\n\nCheck back later!`,
      { parse_mode: 'Markdown' }
    );
  }

  await ctx.editMessageText(
    `📂 *${categoryLabel}* for *${department.name}*:`,
    { parse_mode: 'Markdown' }
  );

  for (const material of materials) {
    await ctx.replyWithDocument(material.fileId, {
      caption: material.title,
    });
  }
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = bot;
