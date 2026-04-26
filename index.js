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

// ዋናው ሜኑ (ሁልጊዜ ከታች የሚቀመጥ)
const mainKeyboards = () => Markup.keyboard([
  ['📚 Academic Materials', '🎓 Exit Exam Resources'],
  ['📝 Mid & Final Exams', 'ℹ️ About Bot']
]).resize();

// ረድፎችን ለመከፋፈል የሚረዳ (Helper)
function chunk(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) result.push(array.slice(i, i + size));
  return result;
}

// ── Bot Logic ────────────────────────────────────────────────────────────────

bot.start((ctx) => {
  const welcomeMessage = 
    `🌟 <b>Aselamu Aleykum Warahmatullah!</b> 🌟\n\n` +
    `Welcome to the <b>BDU Muslim Academics Bot</b>\n` +
    `<i>"Your digital library for academic excellence"</i>\n` +
    `__________________________________________\n\n` +
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
    `<i>Developed for the BDU Muslim Community.</i>`;

  return ctx.reply(aboutText, { parse_mode: 'HTML' });
});

// 📚 Academic Materials
bot.hears('📚 Academic Materials', (ctx) => {
  const rows = [];
  for (let i = 0; i < DEPARTMENTS.length; i += 2) {
    rows.push(DEPARTMENTS.slice(i, i + 2).map(d => Markup.button.callback(d, `dept:${d}`)));
  }
  ctx.reply('📂 <b>Please select your department:</b>', { 
    parse_mode: 'HTML', 
    ...Markup.inlineKeyboard(rows) 
  });
});

// ── 1. ACADEMIC MATERIALS FLOW ─────────────────────────────────────────────

bot.action(/^dept:(.+)$/, (ctx) => {
  const dept = ctx.match[1];
  const years = dept === 'Software Engineering' ? [2, 3, 4, 5] : [2, 3, 4];
  const buttons = years.map(y => Markup.button.callback(`${y}th Year`, `year:${dept}:${y}`));
  
  return ctx.editMessageText(`🎓 <b>${dept}</b>\nSelect Academic Year:`, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(chunk(buttons, 2))
  });
});

bot.action(/^year:(.+):(\d)$/, (ctx) => {
  const [_, dept, year] = ctx.match;
  const buttons = [
    Markup.button.callback('1st Semester', `sem:${dept}:${year}:1`),
    Markup.button.callback('2nd Semester', `sem:${dept}:${year}:2`)
  ];
  return ctx.editMessageText(`📂 <b>${dept} (Year ${year})</b>\nSelect Semester:`, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(chunk(buttons, 2))
  });
});

bot.action(/^sem:(.+):(\d):(\d)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const [_, dept, year, sem] = ctx.match;
    const department = await prisma.department.findUnique({ where: { name: dept } });

    const materials = await prisma.material.findMany({
      where: { 
        departmentId: department.id, 
        year: parseInt(year), 
        semester: parseInt(sem),
        category: { not: 'CommonExam' }
      }
    });

    if (materials.length === 0) {
      return ctx.reply(`⚠️ No resources found for ${dept} Year ${year} Sem ${sem}.`);
    }

    let responseText = `📚 <b>${dept} (Year ${year}, Sem ${sem})</b>\n\n`;
    materials.forEach(m => {
      responseText += `📍 <b>${m.title}</b>\n🔗 <a href="${m.fileUrl}">Download/View</a>\n\n`;
    });

    await ctx.reply(responseText, { parse_mode: 'HTML', disable_web_page_preview: true });
  } catch (err) {
    console.error(err);
    ctx.reply('⚠️ Error fetching data.');
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
      return ctx.reply('⚠️ No Exams found yet.');
    }

    const buttons = courses.map(c => Markup.button.callback(c.title, `course:${c.title}`));
    
    return ctx.reply('📑 <b>Mid & Final Exam Hub</b>\nSelect a course:', {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(chunk(buttons, 2))
    });
  } catch (err) {
    ctx.reply('⚠️ Database Error.');
  }
});

bot.action(/^course:(.+)$/, (ctx) => {
  const courseTitle = ctx.match[1];
  const buttons = [
    Markup.button.callback('Mid Exam 📝', `extype:${courseTitle}:Mid`),
    Markup.button.callback('Final Exam 🏁', `extype:${courseTitle}:Final`)
  ];
  return ctx.editMessageText(`🔍 <b>${courseTitle}</b>\nWhich exam do you need?`, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(chunk(buttons, 2))
  });
});

bot.action(/^extype:(.+):(.+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
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
    console.error(err);
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
    await ctx.answerCbQuery();
    const deptName = ctx.match[1];
    const department = await prisma.department.findUnique({ where: { name: deptName } });
    const materials = await prisma.material.findMany({ where: { departmentId: department.id, category: 'ExitExam' } });

    if (materials.length === 0) return ctx.reply(`No Exit Exam for ${deptName}.`);

    for (const m of materials) {
      await ctx.reply(`🎓 *${m.title}*\n🔗 [Link](${m.fileUrl})`, { parse_mode: 'Markdown' });
    }
  } catch (err) {
    console.error(err);
  }
});

bot.launch().then(() => console.log('✅ Bot Updated!'));