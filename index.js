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
  ['ℹ️ About Bot']
]).resize();

const departmentKeyboard = () => {
  const rows = [];
  for (let i = 0; i < DEPARTMENTS.length; i += 2) {
    rows.push(DEPARTMENTS.slice(i, i + 2));
  }
  return Markup.keyboard([...rows, ['🏠 Back to Main Menu']]).resize();
};

const backToMenuBtn = Markup.button.callback('🏠 Back to Main Menu', 'main_menu');

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
    `• Mid and Final Exams\n` +
    `• Exit Exam Resources for seniors\n\n` +
    `<i>Developed for the BDU Muslim Community. May it be a source of benefit for all!</i>`;

  return ctx.reply(aboutText, { parse_mode: 'HTML' });
});

bot.hears('🏠 Back to Main Menu', (ctx) => {
  return ctx.reply('What would you like to access today?', mainKeyboards());
});

bot.hears('📚 Academic Materials', (ctx) => {
  ctx.reply('📂 <b>Please select your department:</b>', { parse_mode: 'HTML', ...departmentKeyboard() });
});

bot.hears(DEPARTMENTS, (ctx) => {
  const dept = ctx.message.text;
  const years = dept === 'Software Engineering' ? [2, 3, 4, 5] : [2, 3, 4];
  const buttons = years.map(y => Markup.button.callback(`${y}th Year`, `year:${dept}:${y}`));
  
  return ctx.reply(`🎓 <b>${dept}</b>\nSelect Academic Year:`, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([buttons, [backToMenuBtn]], { columns: 2 })
  });
});

bot.action(/^year:(.+):(\d)$/, (ctx) => {
  ctx.answerCbQuery();
  const [_, dept, year] = ctx.match;
  const buttons = [
    [Markup.button.callback('Exams 📝', `cat:${dept}:${year}:Exam`),
     Markup.button.callback('Handouts 📚', `cat:${dept}:${year}:Handout`)],
  ];
  return ctx.editMessageText(`📂 <b>${dept}</b> | Year ${year}\nSelect Category:`, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(buttons)
  });
});

bot.hears('🎓 Exit Exam Resources', (ctx) => {
  const buttons = DEPARTMENTS.map(dept => [Markup.button.callback(dept, `exit:${dept}`)]);
  ctx.reply('🎓 <b>Exit Exam Resources</b>\nSelect Department:', {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([...buttons, [backToMenuBtn]])
  });
});

// FIXED: Added try-catch for Exit Exam
bot.action(/^exit:(.+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery("Fetching resources...");
    const deptName = ctx.match[1];
    
    const department = await prisma.department.findUnique({ where: { name: deptName } });
    if (!department) return ctx.reply('⚠️ Department not found.');

    const materials = await prisma.material.findMany({ 
      where: { departmentId: department.id, category: 'ExitExam' } 
    });

    if (materials.length === 0) {
      return ctx.reply(`No Exit Exam resources found for ${deptName} yet.`, Markup.inlineKeyboard([backToMenuBtn]));
    }

    for (const m of materials) {
      await ctx.reply(`🎓 *${m.title}*\n\n🔗 [Click here to access resource](${m.fileUrl})`, { 
        parse_mode: 'Markdown' 
      });
    }
  } catch (err) {
    console.error("Exit Exam Error:", err);
    ctx.reply('⚠️ ዳታቤዙ ምላሽ አልሰጠም። እባክህ ትንሽ ቆይተህ ድገመው።');
  }
});

bot.action(/^cat:(.+):(\d):(.+)$/, (ctx) => {
  ctx.answerCbQuery();
  const [_, dept, year, cat] = ctx.match;
  const buttons = [
    [Markup.button.callback('1st Semester', `sem:${dept}:${year}:${cat}:1`),
     Markup.button.callback('2nd Semester', `sem:${dept}:${year}:${cat}:2`)],
  ];
  return ctx.editMessageText(`📅 <b>${dept} (Year ${year})</b>\nSelect Semester for ${cat}:`, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(buttons)
  });
});

// FIXED: Added try-catch for Semester selection
bot.action(/^sem:(.+):(\d):(.+):(\d)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery("Loading...");
    const [_, dept, year, cat, sem] = ctx.match;
    
    const department = await prisma.department.findUnique({ where: { name: dept } });
    if (!department) return ctx.reply('⚠️ Department not found.');

    if (cat === 'Exam') {
      const buttons = [
        [Markup.button.callback('Mid Exam ', `extype:${dept}:${year}:${sem}:Mid`),
         Markup.button.callback('Final Exam ', `extype:${dept}:${year}:${sem}:Final`)],
      ];
      return ctx.editMessageText(`📝 <b>Semester ${sem} Exams</b>\nChoose Exam Type:`, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons)
      });
    } else {
      const materials = await prisma.material.findMany({
        where: { 
          departmentId: department.id, 
          year: parseInt(year), 
          semester: parseInt(sem), 
          category: 'Handout' 
        }
      });

      if (materials.length === 0) {
        return ctx.reply(`No Handouts found for ${dept} Year ${year} Sem ${sem}.`, 
          Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', `cat:${dept}:${year}:Handout`), backToMenuBtn]]));
      }

      for (const m of materials) {
        await ctx.reply(`📚 *${m.title}*\n\n🔗 [Click here to download](${m.fileUrl})`, { 
          parse_mode: 'Markdown' 
        });
      }
    }
  } catch (err) {
    console.error("Semester Action Error:", err);
    ctx.reply('⚠️ ዳታቤዙ ለጊዜው አልተነሳም። እባክህ ትንሽ ቆይተህ ሞክር።');
  }
});

// FIXED: Added try-catch for Exam Type selection
bot.action(/^extype:(.+):(\d):(\d):(.+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery("Fetching exams...");
    const [_, dept, year, sem, type] = ctx.match;
    const department = await prisma.department.findUnique({ where: { name: dept } });
    
    const materials = await prisma.material.findMany({
      where: { 
        departmentId: department.id, 
        year: parseInt(year), 
        semester: parseInt(sem), 
        category: 'Exam', 
        examType: type 
      }
    });

    if (materials.length === 0) {
      return ctx.reply(`No <b>${type} exam</b> found for this course.`, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', `sem:${dept}:${year}:Exam:${sem}`), backToMenuBtn]])
      });
    }

    for (const m of materials) {
      await ctx.reply(`📝 *${m.title}*\n\n🔗 [Click here to view exam](${m.fileUrl})`, { 
        parse_mode: 'Markdown' 
      });
    }
  } catch (err) {
    console.error("Exam Type Error:", err);
    ctx.reply('⚠️ ዳታቤዙ ምላሽ አልሰጠም። እባክህ ትንሽ ቆይተህ ድገመው።');
  }
});

bot.action('main_menu', (ctx) => {
  ctx.answerCbQuery();
  return ctx.reply('What would you like to access today?', mainKeyboards());
});

bot.on('document', async (ctx) => {
  if (ctx.from.id !== Number(process.env.ADMIN_ID)) return;
  const { file_id, file_name } = ctx.message.document;
  await ctx.reply(`✅ <b>File Received</b>\nID: <code>${file_id}</code>\nName: ${file_name}`, { parse_mode: 'HTML' });
});

// Global Error Catchers
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
});

bot.launch({
  allowedUpdates: ['message', 'callback_query'],
})
.then(() => {
  console.log('✅ BDU Muslim Bot is ONLINE!');
})
.catch((err) => {
  console.error('❌ Failed to launch bot:', err);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));