import { BotCommand, BotContext } from '../../bot';
import { isCharLimitExceeded, getDailyQuotaText, REGULAR_TEXT_LIMIT, PREMIUM_TEXT_LIMIT } from './limiter';
import { canMenfessUserSendMessage, incrementMenfessUserMessageCount, getMenfessUserStats, resetDailyCountIfNewDay } from './menfessUserStats';
import { premiumMenus } from './menus/premium';

const RULES = `<b>📋 RULES:</b>
• No hate speech or bullying
• Keep it appropriate
• No personal information
• One confession per message
Let's keep this a safe space for everyone! ❤️`;

export const menfessTextHandler = async (ctx: BotContext): Promise<void> => {
  if (!ctx.message || !('text' in ctx.message)) return;
  if (!ctx.from?.id) return;

  const text = ctx.message.text;
  const hashtag = '#' + process.env.MENFESS_HASHTAG;

  if (!text.includes(hashtag)) {
    await ctx.reply(`Wajib menambahkan #${process.env.MENFESS_HASHTAG} didalam pesanmu`);
    return;
  }

  if (isCharLimitExceeded(text, false)) {
    await ctx.reply(`❌ Pesanmu terlalu panjang. Maximal ${process.env.MENFESS_TEXT_LIMIT} karakter`);
    return;
  }

  const { allowed, remaining } = await canMenfessUserSendMessage(ctx.from.id);
  if (!allowed) {
    await ctx.reply(`❌ Anda telah mencapai batas maksimal pesan. Harap coba lagi besok.`);
    return;
  }

  await incrementMenfessUserMessageCount(ctx.from.id);

  // Post confession to channel
  const channelId = process.env.MENFESS_CHANNEL_ID;
  if (!channelId) {
    await ctx.reply('❌ Error: Channel ID not configured');
    return;
  }

  try {
    await ctx.telegram.sendMessage(channelId, text);
    await ctx.reply(`📝 Confession berhasil diposting!\nSisa kuota: ${remaining - 1}`);
  } catch (error) {
    console.error('Failed to post to channel:', error);
    await ctx.reply('❌ Gagal memposting confession ke channel. Silakan coba lagi.');
  }
};

export const menfessStartHandler = async (ctx: BotContext): Promise<void> => {
  const date = new Date();
  const datePart = date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const timePart = date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  });
  const dateStringIDLocale = `${datePart} - ${timePart}`;
  const user = ctx.from;
  const username = user?.username ? `@${user.username}` : 'Tidak ada';
  const userId = user?.id || 'Tidak diketahui';

  // Get user stats from Firestore and reset kuota if it's a new day
  await resetDailyCountIfNewDay(userId);
  const userStats = await getMenfessUserStats(userId);
  const isPremium = userStats?.isPremium ?? false;
  const dailyCount = userStats?.dailyMessageCount ?? 0;
  const quotaText = getDailyQuotaText(isPremium, dailyCount);

  const textLimitText = `${isPremium ? PREMIUM_TEXT_LIMIT : REGULAR_TEXT_LIMIT}`;

  const welcomeMessage = `${dateStringIDLocale}\n\n<b>${process.env.MENFESS_CHANNEL_ID?.toUpperCase()} - MENFESS</b>\n\n<b>👤 USER DATA</b>\n┌ Username: ${username}\n├ TelegramID: ${userId}\n├ Status: ${isPremium ? "Premium" : "Regular"}\n└ Max character: ${textLimitText} chars\n\n<b>📊 SISA KUOTA</b>\n└ 🎯 Kuota tersisa ${quotaText} pesan \n\n${RULES}\n\n 📝 <b>NOTE</b>\n 👉 add #${process.env.MENFESS_HASHTAG} hastag to your confession`;

  await ctx.reply(welcomeMessage, { 
    ...premiumMenus.keyboards.main
  });
};

export const menfessCallbackHandler = async (ctx: BotContext): Promise<void> => {
  if (!ctx.callbackQuery) return;
  
  const action = 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : undefined;
  if (!action) return;

  try {
    // Answer the callback query to remove loading state
    await ctx.answerCbQuery();

    // Handle premium menu actions
    await premiumMenus.handler(ctx, action);
  } catch (error) {
    console.error('Callback handler error:', error);
    await ctx.reply('❌ An error occurred while processing your request');
  }
};

export const menfessBotCommands: BotCommand[] = [
  {
    command: 'status',
    description: 'Check bot status',
    handler: async (ctx) => {
      await ctx.reply('✅ Menfess Bot is online and ready to receive confessions!');
    }
  },
  {
    command: 'about',
    description: 'About this bot',
    handler: async (ctx) => {
      await ctx.reply('🤫 Menfess Bot - A safe space for anonymous confessions and thoughts.');
    }
  },
  {
    command: 'rules',
    description: 'Show confession rules',
    handler: async (ctx) => {
      await ctx.reply(RULES);
    }
  },
  {
    command: 'resetme',
    description: 'Reset your daily quota (development only)',
    handler: async (ctx) => {
      if (!ctx.message || !('text' in ctx.message)) return;
      const password = ctx.message.text.split(' ')[1];
      const devPassword = process.env.DEV_RESET_PASSWORD || 'dev123';
      
      if (password !== devPassword) {
        await ctx.reply('❌ Invalid password');
        return;
      }
      
      if (!ctx.from?.id) return;
      
      await resetDailyCountIfNewDay(ctx.from.id);
      await ctx.reply('✅ Your daily quota has been reset');
    }
  }
];
