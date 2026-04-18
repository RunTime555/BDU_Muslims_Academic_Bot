require('dotenv').config();
const bot = require('./src/bot');

bot.launch().then(() => {
  console.log('🤖 BDUMAJ Academic Bot is running...');
});
