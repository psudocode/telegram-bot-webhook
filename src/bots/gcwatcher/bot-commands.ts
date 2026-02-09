import { BotCommand, BotContext } from '../../bot';
import { calculateSpamScore, getSpamStats, resetUserHistory } from './spam-detection';
import { getUserStats, getAllMemberStats, getActiveMembersCount, addWarning, muteUser, clearUserWarnings, isUserMuted } from './member-management';
import { getUserStats as getFirebaseUserStats, getTopUsers, resetUserSpamScore } from './userStats';

export const gcWatcherCommands: BotCommand[] = [
  {
    command: 'spam_check',
    description: 'Check if a message would be flagged as spam',
    handler: async (ctx) => {
      if (!ctx.message || !('text' in ctx.message)) return;
      
      const textToCheck = ctx.message.text.split(' ').slice(1).join(' ');
      if (!textToCheck) {
        await ctx.reply('Usage: /spam_check <message to test>');
        return;
      }
      
      const detection = calculateSpamScore(textToCheck, ctx.from?.id || 0);
      
      const resultMessage = `📊 <b>Spam Analysis Results</b>\n\n` +
        `Message: "${textToCheck.substring(0, 50)}${textToCheck.length > 50 ? '...' : ''}"\n` +
        `Spam Score: ${detection.score}/100\n` +
        `Status: ${detection.isSpam ? '🚨 FLAGGED AS SPAM' : '✅ NOT SPAM'}\n\n` +
        `<b>Detection Reasons:</b>\n${detection.reasons.length > 0 ? detection.reasons.map(r => `• ${r}`).join('\n') : 'None'}`;
      
      await ctx.reply(resultMessage, { parse_mode: 'HTML' });
    }
  },
  {
    command: 'spam_stats',
    description: 'View spam detection statistics',
    handler: async (ctx) => {
      const stats = getSpamStats();
      const activeMembers = getActiveMembersCount(30);
      
      const statsMessage = `📈 <b>GCWatcher Statistics</b>\n\n` +
        `<b>Spam Detection:</b>\n` +
        `• Total tracked users: ${stats.totalUsers}\n` +
        `• Active users (5min): ${stats.activeUsers}\n` +
        `• Detection patterns: ${stats.patternsCount}\n` +
        `• Spam keywords: ${stats.keywordsCount}\n` +
        `• Spam threshold: 30/100\n\n` +
        `<b>Member Management:</b>\n` +
        `• Active members (30min): ${activeMembers}\n` +
        `• Rate limits: 7 msgs/min\n` +
        `• Similar messages: 5 max`;
      
      await ctx.reply(statsMessage, { parse_mode: 'HTML' });
    }
  },
  {
    command: 'member_info',
    description: 'Get information about a member',
    handler: async (ctx) => {
      if (!ctx.message || !('text' in ctx.message)) return;
      
      const targetUserId = ctx.message.reply_to_message?.from?.id || 
                          parseInt(ctx.message.text.split(' ')[1]) || 
                          ctx.from?.id;
      
      if (!targetUserId) {
        await ctx.reply('Usage: /member_info [user_id] or reply to a message');
        return;
      }
      
      const stats = getUserStats(targetUserId);
      if (!stats) {
        await ctx.reply('❌ No data found for this user');
        return;
      }
      
      const joinDate = new Date(stats.joinDate).toLocaleDateString();
      const lastActivity = new Date(stats.lastActivity).toLocaleDateString();
      
      const infoMessage = `👤 <b>Member Information</b>\n\n` +
        `User ID: ${targetUserId}\n` +
        `Join Date: ${joinDate}\n` +
        `Messages: ${stats.messageCount}\n` +
        `Last Activity: ${lastActivity}\n` +
        `Warnings: ${stats.warnings}\n` +
        `Status: ${stats.isMuted ? '🔇 Muted' : '🔊 Active'}`;
      
      await ctx.reply(infoMessage, { parse_mode: 'HTML' });
    }
  },
  {
    command: 'warn',
    description: 'Warn a user (admin only)',
    handler: async (ctx) => {
      if (!ctx.message || !('text' in ctx.message)) return;
      
      const targetUserId = ctx.message.reply_to_message?.from?.id;
      if (!targetUserId) {
        await ctx.reply('❌ Reply to a user\'s message to warn them');
        return;
      }
      
      const warnings = addWarning(targetUserId);
      const targetUser = ctx.message.reply_to_message?.from;
      const userName = targetUser?.username ? `@${targetUser.username}` : targetUser?.first_name || 'Unknown';
      
      const warnMessage = `⚠️ ${userName} has been warned!\n` +
        `Total warnings: ${warnings}/3\n\n` +
        `Please follow the group rules to avoid further action.`;
      
      await ctx.reply(warnMessage);
      
      // Auto-mute after 3 warnings
      if (warnings >= 3) {
        muteUser(targetUserId, 60); // Mute for 1 hour
        await ctx.reply(`🔇 ${userName} has been muted for 1 hour due to multiple warnings.`);
      }
    }
  },
  {
    command: 'mute',
    description: 'Mute a user (admin only)',
    handler: async (ctx) => {
      if (!ctx.message || !('text' in ctx.message)) return;
      
      const args = ctx.message.text.split(' ');
      const duration = parseInt(args[1]) || 30; // Default 30 minutes
      const targetUserId = ctx.message.reply_to_message?.from?.id;
      
      if (!targetUserId) {
        await ctx.reply('❌ Reply to a user\'s message to mute them');
        return;
      }
      
      muteUser(targetUserId, duration);
      const targetUser = ctx.message.reply_to_message?.from;
      const userName = targetUser?.username ? `@${targetUser.username}` : targetUser?.first_name || 'Unknown';
      
      const muteMessage = `🔇 ${userName} has been muted for ${duration} minutes.`;
      await ctx.reply(muteMessage);
    }
  },
  {
    command: 'unwarn',
    description: 'Clear user warnings (admin only)',
    handler: async (ctx) => {
      if (!ctx.message || !('text' in ctx.message)) return;
      
      const targetUserId = ctx.message.reply_to_message?.from?.id;
      if (!targetUserId) {
        await ctx.reply('❌ Reply to a user\'s message to clear their warnings');
        return;
      }
      
      clearUserWarnings(targetUserId);
      await resetUserSpamScore(targetUserId); // Also reset spam score when warnings are cleared
      const targetUser = ctx.message.reply_to_message?.from;
      const userName = targetUser?.username ? `@${targetUser.username}` : targetUser?.first_name || 'Unknown';
      
      const clearMessage = `✅ Warnings cleared for ${userName}.`;
      await ctx.reply(clearMessage);
    }
  },
  {
    command: 'me',
    description: 'Check your own statistics',
    handler: async (ctx) => {
      const userId = ctx.from?.id;
      if (!userId) return;
      
      const stats = await getFirebaseUserStats(userId);
      
      if (!stats) {
        await ctx.reply('❌ You are not in the database yet. Send a message first!');
        return;
      }
      
      const userName = stats.username ? `@${stats.username}` : stats.firstName || 'Unknown';
      
      const statsMessage = `📊 <b>Your Statistics</b>\n\n` +
        `<b>User:</b> ${userName}\n` +
        `<b>🎯 Level:</b> ${stats.level} (${stats.points} points)\n` +
        `<b>📝 Messages:</b> ${stats.messageCount}\n` +
        `<b>⚠️ Warnings:</b> ${stats.warnings}\n` +
        `<b>🚫 Spam Score:</b> ${stats.spamScore}\n` +
        `<b>🔥 Activity Streak:</b> ${stats.streakDays} days\n` +
        `<b>🏆 Achievements:</b> ${stats.achievements.length}\n` +
        `<b>📊 Status:</b> ${stats.isBanned ? '🚫 Banned' : stats.isMuted ? '🔇 Muted' : '✅ Active'}\n\n` +
        `<i>Keep chatting to earn more points and level up!</i>`;
      
      await ctx.reply(statsMessage, { parse_mode: 'HTML' });
    }
  },
  {
    command: 'leaderboard',
    description: 'View top 10 users by points',
    handler: async (ctx) => {
      const topUsers = await getTopUsers(10);
      
      if (topUsers.length === 0) {
        await ctx.reply('📊 No users found in the leaderboard yet!');
        return;
      }
      
      let leaderboardMessage = `🏆 <b>Top 10 Users</b>\n\n`;
      
      topUsers.forEach((user, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        const userName = user.username ? `@${user.username}` : user.firstName || 'Unknown';
        const status = user.isBanned ? '🚫' : user.isMuted ? '🔇' : '✅';
        
        leaderboardMessage += `${medal} ${userName} - ${user.points} pts (Lvl ${user.level}) ${status}\n`;
      });
      
      leaderboardMessage += `\n<i>💡 Earn points by sending messages and being helpful!</i>`;
      
      await ctx.reply(leaderboardMessage, { parse_mode: 'HTML' });
    }
  },
  {
    command: 'reset_spam',
    description: 'Reset user spam score (admin only)',
    handler: async (ctx) => {
      if (!ctx.message || !('text' in ctx.message)) return;
      
      const targetUserId = ctx.message.reply_to_message?.from?.id || 
                          parseInt(ctx.message.text.split(' ')[1]);
      
      if (!targetUserId) {
        await ctx.reply('❌ Usage: /reset_spam @username or reply to user message');
        return;
      }
      
      await resetUserSpamScore(targetUserId);
      
      const targetUser = ctx.message.reply_to_message?.from || 
                       (await ctx.telegram.getChatMember(ctx.message.chat.id, targetUserId)).user;
      const userName = targetUser?.username ? `@${targetUser.username}` : targetUser?.first_name || 'Unknown';
      
      const resetMessage = `✅ Spam score reset for ${userName}`;
      await ctx.reply(resetMessage);
    }
  },
  {
    command: 'appeal_spam',
    description: 'Appeal spam detection decision',
    handler: async (ctx) => {
      if (!ctx.message || !('text' in ctx.message)) return;
      
      const userId = ctx.from?.id;
      if (!userId) return;
      
      const args = ctx.message.text.split(' ').slice(1).join(' ');
      if (!args) {
        await ctx.reply('❌ Usage: /appeal_spam <reason for appeal>\n\nExample: /appeal_spam This was a legitimate message about crypto');
        return;
      }
      
      const stats = await getFirebaseUserStats(userId);
      if (!stats || stats.spamScore < 30) {
        await ctx.reply('❌ You don\'t have a high spam score to appeal.');
        return;
      }
      
      // Send appeal to admin
      const adminId = process.env.SPAM_ADMIN_ID;
      if (adminId) {
        const appealMessage = `📋 Spam Appeal Request\n\n` +
          `User: @${ctx.from.username || ctx.from.first_name} (${userId})\n` +
          `Current Spam Score: ${stats.spamScore}/100\n` +
          `Appeal Reason: ${args}\n\n` +
          `Reply to this message to approve or deny the appeal.`;
        
        await ctx.telegram.sendMessage(adminId, appealMessage);
        await ctx.reply('✅ Your appeal has been sent to admin for review.');
      } else {
        await ctx.reply('❌ Admin not available to handle appeals.');
      }
    }
  },
  {
    command: 'approve_appeal',
    description: 'Approve spam appeal (admin only)',
    handler: async (ctx) => {
      if (!ctx.message || !('text' in ctx.message)) return;
      
      const targetUserId = ctx.message.reply_to_message?.from?.id || 
                          parseInt(ctx.message.text.split(' ')[1]);
      
      if (!targetUserId) {
        await ctx.reply('❌ Reply to appeal message or provide user ID');
        return;
      }
      
      await resetUserSpamScore(targetUserId);
      const targetUser = ctx.message.reply_to_message?.from || 
                       (await ctx.telegram.getChatMember(ctx.message.chat.id, targetUserId)).user;
      const userName = targetUser?.username ? `@${targetUser.username}` : targetUser?.first_name || 'Unknown';
      
      const approvalMessage = `✅ Spam appeal approved for ${userName}. Spam score has been reset.`;
      await ctx.reply(approvalMessage);
    }
  },
  {
    command: 'spam_whitelist',
    description: 'Manage spam whitelist (admin only)',
    handler: async (ctx) => {
      await ctx.reply('📝 Whitelist management feature coming soon!\n\n' +
        'This will allow admins to whitelist users or phrases from spam detection.');
    }
  },
  {
    command: 'spam_config',
    description: 'Configure spam detection settings (admin only)',
    handler: async (ctx) => {
      if (!ctx.message || !('text' in ctx.message)) return;
      
      const args = ctx.message.text.split(' ').slice(1);
      if (args.length === 0) {
        const configMessage = `⚙️ <b>Current GCWatcher Config</b>\n\n` +
          `Spam threshold: 30/100\n` +
          `Max messages/minute: 7\n` +
          `Max similar messages: 5\n\n` +
          `<b>Usage:</b>\n` +
          `/spam_config threshold <number> - Set spam threshold\n` +
          `/spam_config ratelimit <number> - Set max messages/minute\n` +
          `/spam_config similar <number> - Set max similar messages`;
        
        await ctx.reply(configMessage, { parse_mode: 'HTML' });
        return;
      }
      
      await ctx.reply('⚙️ Configuration updates coming soon! This feature will allow dynamic adjustment of spam detection parameters.');
    }
  },
  {
    command: 'send_ad',
    description: 'Send promotional ad immediately (admin only)',
    handler: async (ctx) => {
      const { sendPromotionalMessage } = await import('./commands');
      
      try {
        await sendPromotionalMessage(ctx);
      } catch (error) {
        console.error('Error sending promotional ad:', error);
        await ctx.reply('❌ Failed to send promotional message. Please check logs.');
      }
    }
  }
];
