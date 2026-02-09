import { BotCommand, BotContext } from '../../bot';
import { gcWatcherCommands } from './bot-commands';
import { calculateSpamScore } from './spam-detection';
import { handleNewChatMembers, handleLeftChatMember, trackUserMessage, isUserMuted } from './member-management';
import { createOrUpdateUserStats, trackUserMessage as trackFirebaseMessage, updateSpamScore, incrementSpamScore } from './userStats';

// Constants
const MESSAGES = {
  WELCOME: `🛡️ <b>GCWatcher Bot</b>\n\n` +
    `I am an admin bot designed to manage and protect group chats.\n\n` +
    `<b>Features:</b>\n` +
    `• Automatic spam detection\n` +
    `• Message rate limiting\n` +
    `• Pattern recognition\n` +
    `• Welcome new members\n` +
    `• Farewell messages\n` +
    `• Member management\n` +
    `• Warning system\n` +
    `• User statistics & gamification\n` +
    `• Leaderboards\n` +
    `• Admin notifications\n\n` +
    `<b>Commands:</b>\n` +
    `/me - Check your statistics\n` +
    `/leaderboard - View top 10 users\n` +
    `/appeal_spam - Appeal spam detection\n` +
    `/spam_check - Check spam detection status\n` +
    `/spam_stats - View spam statistics\n` +
    `/member_info - Get member information\n\n` +
    `<b>Admin Commands:</b>\n` +
    `/warn - Warn a user (admin)\n` +
    `/mute - Mute a user (admin)\n` +
    `/unwarn - Clear warnings (admin)\n` +
    `/reset_spam - Reset spam score (admin)\n` +
    `/approve_appeal - Approve appeal (admin)\n` +
    `/send_ad - Send promotional ad (admin)\n` +
    `/help - Show all commands\n\n` +
    `🎮 Earn points by sending messages and climb the leaderboard!\n\n` +
    `Add me to your group as an admin to enable all features!`,
  MUTED_USER: '🔇 You are currently muted and cannot send messages.',
  SPAM_WARNING: (userName: string, score: number) => 
    `⚠️ @${userName}, your message was flagged as spam and removed.\n\n` +
    `Spam Score: ${score}/100\n\n` +
    `Please refrain from spam-like behavior. Continued violations may result in restrictions.`
} as const;

// Promotional ads configuration
const PROMOTIONAL_CONFIG = {
  MESSAGE_INTERVAL: 200, // Send ad every 200 messages
  ADS: `🚀 <b>Check out our partner channels!</b>\n\n` +
    `🚀 @RPStarMenfess - Roleplay Menfess\n` +
    `🤖 @RPStarMenfessBot - Roleplay Menfess Bot\n` +
    `🎮 @RPStarPromotes - Roleplay Promotes\n` +
    `🤖 @RPStarPromoteBot - Roleplay Promote (Send Bio)\n\n`
} as const;

// Message counter for promotions
let messageCounter = 0;

// Helper functions
function isGroupChat(ctx: BotContext): boolean {
  return ctx.message?.chat.type === 'group' || ctx.message?.chat.type === 'supergroup';
}

function getUserName(ctx: BotContext): string {
  return ctx.from?.username || ctx.from?.first_name || 'Unknown';
}

// Send promotional message
export async function sendPromotionalMessage(ctx: BotContext): Promise<void> {
  try {
    const promotionalMessage = PROMOTIONAL_CONFIG.ADS;
    
    await ctx.reply(promotionalMessage, { parse_mode: 'HTML' });
    console.log(`[PROMOTIONAL] Ad sent to group: ${(ctx.message?.chat as any).title || 'Unknown'}`);
  } catch (error) {
    console.error('Error sending promotional message:', error);
  }
}

async function handleSpamDetection(ctx: BotContext, text: string, userId: number): Promise<void> {
  const detection = calculateSpamScore(text, userId);
  
  // Only process if message is actually spam
  if (!detection.isSpam) return;
  
  // Update spam score
  await incrementSpamScore(userId, detection.score);
  
  const userName = getUserName(ctx);
  
  try {
    // Log spam detection
    console.log(`[SPAM DETECTED] User: ${userName} (${userId}), Score: ${detection.score}`);
    console.log(`Reasons: ${detection.reasons.join(', ')}`);
    
    // Delete the spam message
    await ctx.deleteMessage(ctx.message!.message_id);
    
    // Warn user
    await ctx.reply(MESSAGES.SPAM_WARNING(userName, detection.score));
    
    // Report to admin
    const adminId = process.env.SPAM_ADMIN_ID;
    if (adminId) {
      const reportMessage = `🚨 Spam Alert\n\n` +
        `Group: ${(ctx.message!.chat as any).title || 'Unknown'}\n` +
        `User: @${userName} (${userId})\n` +
        `Spam Score: ${detection.score}/100\n` +
        `Message: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}\n` +
        `Reasons: ${detection.reasons.join(', ')}`;
      
      await ctx.telegram.sendMessage(adminId, reportMessage);
    }
  } catch (error) {
    console.error('Error handling spam detection:', error);
  }
}

async function handleMutedUser(ctx: BotContext): Promise<void> {
  try {
    await ctx.deleteMessage(ctx.message!.message_id);
    await ctx.reply(MESSAGES.MUTED_USER);
  } catch (error) {
    console.error('Error handling muted user message:', error);
  }
}

// Export all handlers for the bot configuration
export const spamBotCommands = gcWatcherCommands;

export const spamStartHandler = async (ctx: BotContext): Promise<void> => {
  await ctx.reply(MESSAGES.WELCOME, { parse_mode: 'HTML' });
};

export const spamTextHandler = async (ctx: BotContext): Promise<void> => {
  if (!ctx.message || !('text' in ctx.message) || !ctx.from?.id) return;
  
  // Only process messages in groups
  if (!isGroupChat(ctx)) return;

  const userId = ctx.from.id;
  const text = ctx.message.text;
  
  // Increment message counter and check for promotional ad
  messageCounter++;
  if (messageCounter >= PROMOTIONAL_CONFIG.MESSAGE_INTERVAL) {
    await sendPromotionalMessage(ctx);
    messageCounter = 0; // Reset counter
  }
  
  // Initialize/update user in Firebase
  await createOrUpdateUserStats(userId, {
    username: ctx.from.username,
    firstName: ctx.from.first_name,
  });
  
  // Track message in Firebase
  await trackFirebaseMessage(userId);
  
  // Check if user is muted (using old system for compatibility)
  if (isUserMuted(userId)) {
    await handleMutedUser(ctx);
    return;
  }
  
  // Track user activity in old system (for compatibility)
  trackUserMessage(userId);
  
  // Handle spam detection
  await handleSpamDetection(ctx, text, userId);
};

export const newChatMembersHandler = async (ctx: BotContext): Promise<void> => {
  if (!ctx.message || !('new_chat_members' in ctx.message)) return;
  
  const newMembers = ctx.message.new_chat_members;
  
  for (const member of newMembers) {
    // Skip if the bot itself joined
    if (member.is_bot) continue;
    
    // Create user stats in Firebase
    await createOrUpdateUserStats(member.id, {
      username: member.username,
      firstName: member.first_name,
    });
  }
  
  // Call the original handler for welcome messages
  await handleNewChatMembers(ctx);
};
export const leftChatMemberHandler = handleLeftChatMember;
