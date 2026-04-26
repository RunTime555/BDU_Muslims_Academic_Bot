const http = require('http');

// This keeps the Render server active
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot is Active');
}).listen(process.env.PORT || 3000);

require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const { PrismaClient } = require('@prisma/client');

const bot = new Telegraf(process.env.BOT_TOKEN);
const prisma = new PrismaClient();

const DEPARTMENTS = [
  'Software Engineering',
  'Computer Science',
  'Cyber Security',
  'Information Systems',
  'Information Technology'
];

// ── Keyboards & Helpers ──────────────────────────────────────────────────────

const mainKeyboards = () => Markup.keyboard([
  ['📚 Academic Materials', '🎓 Exit Exam Resources'],
  ['📝 Mid & Final Exams', 'ℹ️ About Bot']
]).resize();

const departmentKeyboard = () => {
  const rows = [];
  for (let i = 0; i < DEPARTMENTS.length; i += 2) {
    rows.push(DEPARTMENTS.slice(i, i + 2));
  }
  return Markup.keyboard([...rows]).resize();
};

// ── Bot Logic ────────────────────────────────────────────────────────────────

bot.start((ctx) => {
  const welcomeMessage = 
    `🌟 <b>Aselamu Aleykum Warahmatullah!</b> 🌟\n\n` +
    `Welcome to the <b>BDU Muslim Academics Bot</b>\n` +
    `<i>"Your digital library for academic excellence"</i>\n` +
    `__________________________________________\n\n` +
    `📌 <b>What we offer:</b>\n` +
    `• 📚 Updated Handouts\n` +
    `• 📝 Mid & Final Exams\n` +
    `• 🎓 Exit Exam Resources\n\n` +
    `<b>Please select an option from the menu below:</b>`;

  return ctx.reply(welcomeMessage, {
    parse_mode: 'HTML',
    ...mainKeyboards()
  });
});

bot.hears('ℹ️ About Bot', (ctx) => {
  const aboutText = 
    `🤖 <b>About BDU Muslim Academics Bot</b>\n\n` +
    `This bot is designed to help students at <b>Bahir Dar University</b> access academic resources easily.\n\n` +
    `✅ <b>Features:</b>\n` +
    `• Handouts & Reference materials\n` +
    `• Mid and Final Exams hub\n` +
    `• Exit Exam Resources for seniors\n\n` +
    `<i>Developed for the BDU Muslim Community.</i>`;

  return ctx.reply(aboutText, { parse_mode: 'HTML' });
});

bot.hears('📚 Academic Materials', (ctx) => {
  ctx.reply('📂 <b>Please select your department:</b>', { parse_mode: 'HTML', ...departmentKeyboard() });
});

// ── 1. ACADEMIC MATERIALS LOGIC ─────────────────────────────────────────────

bot.hears(DEPARTMENTS, (ctx) => {
  const dept = ctx.message.text;
  const years = dept === 'Software Engineering' ? [2, 3, 4, 5] : [2, 3, 4];
  const buttons = years.map(y => Markup.button.callback(`${y}th Year`, `year:${dept}:${y}`));
  
  return ctx.reply(`🎓 <b>${dept}</b>\nSelect Academic Year:`, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(buttons, { columns: 2 })
  });
});

bot.action(/^year:(.+):(\d)$/, (ctx) => {
  ctx.answerCbQuery();
  const [_, dept, year] = ctx.match;
  const buttons = [
    [Markup.button.callback('1st Semester', `sem:${dept}:${year}:1`),
     Markup.button.callback('2nd Semester', `sem:${dept}:${year}:2`)],
  ];
  return ctx.editMessageText(`📂 <b>${dept} (Year ${year})</b>\nSelect Semester:`, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(buttons)
  });
});

bot.action(/^sem:(.+):(\d):(\d)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery("Loading resources...");
    const [_, dept, year, sem] = ctx.match;
    
    const department = await prisma.department.findUnique({ where: { name: dept } });
    if (!department) return ctx.reply('⚠️ Department not found in database.');

    const materials = await prisma.material.findMany({
      where: { 
        departmentId: department.id, 
        year: parseInt(year), 
        semester: parseInt(sem),
        category: { not: 'CommonExam' }
      }
    });

    if (materials.length === 0) {
      return ctx.reply(`⚠️ No resources found for ${dept} Year ${year} Sem ${sem} yet.`);
    }

    let responseText = `📚 <b>${dept} (Year ${year}, Sem ${sem})</b>\n\n`;
    materials.forEach(m => {
      responseText += `📍 <b>${m.title}</b>\n🔗 <a href="${m.fileUrl}">Download/View</a>\n\n`;
    });

    await ctx.reply(responseText, { parse_mode: 'HTML', disable_web_page_preview: true });
  } catch (err) {
    console.error("Semester Error:", err);
    ctx.reply('⚠️ please try again later.');
  }
});

// ── 2. MID & FINAL EXAMS LOGIC (COMMON HUB) ────────────────────────────────

bot.hears('📝 Mid & Final Exams', async (ctx) => {
  try {
    const courses = await prisma.material.findMany({
      where: { category: 'CommonExam' },
      distinct: ['title'],
      select: { title: true }
    });

    if (courses.length === 0) {
      return ctx.reply('⚠️ No Exams found in the hub yet.');
    }

    const buttons = courses.map(c => Markup.button.callback(c.title, `course:${c.title}`));
    
    return ctx.reply(' <b>Mid & Final Exam Hub</b>\nSelect a course:', {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(buttons, { columns: 2 })
    });
  } catch (err) {
    console.error("Exam Hub Error:", err);
    ctx.reply('⚠️ Error loading exams. Please try again later.');
  }
});

bot.action(/^course:(.+)$/, (ctx) => {
  ctx.answerCbQuery();
  const courseTitle = ctx.match[1];
  const buttons = [
    [Markup.button.callback('Mid Exam ', `extype:${courseTitle}:Mid`),
     Markup.button.callback('Final Exam ', `extype:${courseTitle}:Final`)]
  ];
  return ctx.editMessageText(`🔍 <b>${courseTitle}</b>\nSelect exam type:`, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(buttons)
  });
});

bot.action(/^extype:(.+):(.+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery("Fetching exam...");
    const [_, title, type] = ctx.match;
    const materials = await prisma.material.findMany({
      where: { title: title, examType: type, category: 'CommonExam' }
    });

    if (materials.length === 0) {
      return ctx.reply(`⚠️ No ${type} exam found for ${title}.`);
    }

    for (const m of materials) {
      await ctx.reply(`📝 *${m.title} (${type})*\n\n🔗 [Access Exam](${m.fileUrl})`, { parse_mode: 'Markdown' });
    }
  } catch (err) {
    console.error("Exam Selection Error:", err);
    ctx.reply('⚠️ Error retrieving files.');
  }
});

// ── 3. EXIT EXAM LOGIC ──────────────────────────────────────────────────────

bot.hears('🎓 Exit Exam Resources', (ctx) => {
  const buttons = DEPARTMENTS.map(dept => [Markup.button.callback(dept, `exit:${dept}`)]);
  ctx.reply('🎓 <b>Exit Exam Resources</b>\nSelect Department:', {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(buttons)
  });
});

bot.action(/^exit:(.+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery("Loading...");
    const deptName = ctx.match[1];
    const department = await prisma.department.findUnique({ where: { name: deptName } });
    
    const materials = await prisma.material.findMany({ 
      where: { departmentId: department.id, category: 'ExitExam' } 
    });

    if (materials.length === 0) return ctx.reply(`⚠️ No Exit Exam resources for ${deptName}.`);

    for (const m of materials) {
      await ctx.reply(`🎓 *${m.title}*\n🔗 [Access Link](${m.fileUrl})`, { parse_mode: 'Markdown' });
    }
  } catch (err) {
    console.error("Exit Exam Action Error:", err);
    ctx.reply('⚠️ Error fetching exit exam data.');
  }
});

// Launch
bot.launch()
  .then(() => console.log('✅ BDU Muslim Bot is ONLINE!'))
  .catch((err) => console.error('❌ Failed to launch:', err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));