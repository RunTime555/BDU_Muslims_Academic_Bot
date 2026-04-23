const http = require('http');
http.createServer((req, res) => {
  res.write('Bot is running!');
  res.end();
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

// Startup Greeting with HTML Styling
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

// ℹ️ About Bot Section with HTML Styling
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

// 🏠 Back to Main Menu
bot.hears('🏠 Back to Main Menu', (ctx) => {
  return ctx.reply('What would you like to access today?', mainKeyboards());
});

// 1. Academic Materials Flow
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

// Year -> Category Selection
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

// 2. Exit Exam Resources Flow
bot.hears('🎓 Exit Exam Resources', (ctx) => {
  const buttons = DEPARTMENTS.map(dept => [Markup.button.callback(dept, `exit:${dept}`)]);
  ctx.reply('🎓 <b>Exit Exam Resources</b>\nSelect Department:', {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([...buttons, [backToMenuBtn]])
  });
});

bot.action(/^exit:(.+)$/, async (ctx) => {
  // Show a loading notification while the database wakes up
  await ctx.answerCbQuery("Fetching resources... please wait.");
  
  const deptName = ctx.match[1];
  try {
    const department = await prisma.department.findUnique({ where: { name: deptName } });
    if (!department) return ctx.reply('⚠️ Department not found in database.');

    const materials = await prisma.material.findMany({ 
      where: { 
        departmentId: department.id, 
        category: 'ExitExam' 
      } 
    });

    if (materials.length === 0) {
      return ctx.reply(` No Exit Exam resources found for ${deptName} yet.`, Markup.inlineKeyboard([backToMenuBtn]));
    }

    // Loop through materials and send clickable links instead of direct files
    for (const m of materials) {
      await ctx.reply(`🎓 *${m.title}*\n\n🔗 [Click here to access resource](${m.fileUrl})`, { 
        parse_mode: 'Markdown' 
      });
    }
  } catch (err) {
    console.error("Exit Exam Error:", err);
    ctx.reply('⚠️ Error fetching resources. Please try again later.');
  }
});

// Category -> Semester Selection
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

// Semester -> Final Check (Exam vs Handout)
bot.action(/^sem:(.+):(\d):(.+):(\d)$/, async (ctx) => {
  // Show loading state while database is queried
  await ctx.answerCbQuery("Loading... please wait.");
  
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
    // Handling Handouts
    const materials = await prisma.material.findMany({
      where: { 
        departmentId: department.id, 
        year: parseInt(year), 
        semester: parseInt(sem), 
        category: 'Handout' 
      }
    });

    if (materials.length === 0) {
      return ctx.reply(` No Handouts found for ${dept} Year ${year} Sem ${sem}.`, 
        Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', `cat:${dept}:${year}:Handout`), backToMenuBtn]]));
    }

    // Send each handout as a clickable link using fileUrl
    for (const m of materials) {
      await ctx.reply(`📚 *${m.title}*\n\n🔗 [Click here to download](${m.fileUrl})`, { 
        parse_mode: 'Markdown' 
      });
    }
  }
});
// Exam Type Selection Result
bot.action(/^extype:(.+):(\d):(\d):(.+)$/, async (ctx) => {
  // Show loading notification
  await ctx.answerCbQuery("Fetching exam resources...");
  
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
    return ctx.reply(` No <b>${type} exam</b> found for this course.`, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', `sem:${dept}:${year}:Exam:${sem}`), backToMenuBtn]])
    });
  }

  // Send exam links using fileUrl and Markdown formatting
  for (const m of materials) {
    await ctx.reply(`📝 *${m.title}*\n\n🔗 [Click here to view exam](${m.fileUrl})`, { 
      parse_mode: 'Markdown' 
    });
  }
});
// Navigation Callbacks
bot.action('main_menu', (ctx) => {
  ctx.answerCbQuery();
  return ctx.reply('What would you like to access today?', mainKeyboards());
});

bot.action(/^back_to_dept:(.+)$/, (ctx) => {
  ctx.answerCbQuery();
  return ctx.reply('Please select your department:', departmentKeyboard());
});

// Admin Capture
bot.on('document', async (ctx) => {
  if (ctx.from.id !== Number(process.env.ADMIN_ID)) return;
  const { file_id, file_name } = ctx.message.document;
  await ctx.reply(`✅ <b>File Received</b>\nID: <code>${file_id}</code>\nName: ${file_name}`, { parse_mode: 'HTML' });
});

process.on('uncaughtException', (err) => {
    console.error('There was an uncaught error', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

bot.launch().then(() => console.log('🤖 BDU Muslim Bot is ONLINE!'));