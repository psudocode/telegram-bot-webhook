import { BotCommand, BotContext } from '../../bot';
import { isCharLimitExceeded, getDailyQuotaText, REGULAR_TEXT_LIMIT, PREMIUM_TEXT_LIMIT } from './limiter';
import { canPromoteUserSendMessage, incrementPromoteUserMessageCount, getPromoteUserStats, resetDailyCountIfNewDay } from './promoteUserStats';

const RULES = `<b>📋 RULES:</b>
• No inappropriate content
• No hate speech or bullying
• Keep it professional
• No personal information
• One promotion per message
Let's keep this a positive space for everyone! ❤️`;

export const promoteTextHandler = async (ctx: BotContext): Promise<void> => {
  if (!ctx.message || !('text' in ctx.message)) return;
  if (!ctx.from?.id) return;

  const text = ctx.message.text;
  const hashtag = '#' + process.env.PROMOTE_HASHTAG;

  if (!text.includes(hashtag)) {
    await ctx.reply(`Wajib menambahkan #${process.env.PROMOTE_HASHTAG} didalam pesanmu`);
    return;
  }

  if (isCharLimitExceeded(text, false)) {
    await ctx.reply(`❌ Pesanmu terlalu panjang. Maximal ${process.env.PROMOTE_TEXT_LIMIT} karakter`);
    return;
  }

  const { allowed, remaining } = await canPromoteUserSendMessage(ctx.from.id);
  if (!allowed) {
    await ctx.reply(`❌ Anda telah mencapai batas maksimal promosi. Harap coba lagi besok.`);
    return;
  }

  await incrementPromoteUserMessageCount(ctx.from.id);

  // Post promotion to channel
  const channelId = process.env.PROMOTE_CHANNEL_ID;
  if (!channelId) {
    await ctx.reply('❌ Error: Channel ID not configured');
    return;
  }

  try {
    await ctx.telegram.forwardMessage(channelId, ctx.message.chat.id, ctx.message.message_id);
    await ctx.reply(`📝 Promosi berhasil diposting!\nSisa kuota: ${remaining - 1}`);
  } catch (error) {
    console.error('Failed to forward to channel:', error);
    await ctx.reply('❌ Gagal memposting promosi ke channel. Silakan coba lagi.');
  }
};

export const promoteStartHandler = async (ctx: BotContext): Promise<void> => {
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
  const userStats = await getPromoteUserStats(userId);
  const isPremium = userStats?.isPremium ?? false;
  const dailyCount = userStats?.dailyMessageCount ?? 0;
  const quotaText = getDailyQuotaText(isPremium, dailyCount);

  const textLimitText = `${isPremium ? PREMIUM_TEXT_LIMIT : REGULAR_TEXT_LIMIT}`;

  const welcomeMessage = `${dateStringIDLocale}\n\n<b>${process.env.PROMOTE_CHANNEL_ID?.toUpperCase()} - SEND BIO</b>\n\n<b>👤 USER DATA</b>\n┌ Username: ${username}\n├ TelegramID: ${userId}\n├ Status: ${isPremium ? "Premium" : "Regular"}\n└ Max character: ${textLimitText} chars\n\n<b>📊 SISA KUOTA</b>\n└ 🎯 Kuota tersisa ${quotaText} pesan \n\n${RULES}\n\n 📝 <b>NOTE</b>\n 👉 add #${process.env.PROMOTE_HASHTAG} hastag to your bio`;

  await ctx.reply(welcomeMessage, { parse_mode: 'HTML' });
};

export const promoteBotCommands: BotCommand[] = [
  {
    command: 'status',
    description: 'Check bot status',
    handler: async (ctx) => {
      await ctx.reply('✅ Promote Bot is online and ready to receive promotions!');
    }
  },
  {
    command: 'about',
    description: 'About this bot',
    handler: async (ctx) => {
      await ctx.reply('🎯 Promote Bot - A space for self-promotion and showcasing your talents!');
    }
  },
  {
    command: 'rules',
    description: 'Show promotion rules',
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
