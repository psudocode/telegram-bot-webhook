// Example integration of Firebase user stats with existing bot functionality
import { BotContext } from '../../bot';
import { 
  createOrUpdateUserStats, 
  trackUserMessage, 
  updateSpamScore,
  incrementSpamScore,
  addUserWarning,
  getUserStats 
} from './userStats';

// Example: Initialize user when they join the group
export async function handleNewMemberWithStats(ctx: BotContext): Promise<void> {
  if (!ctx.message || !('new_chat_members' in ctx.message)) return;
  
  const newMembers = ctx.message.new_chat_members;
  
  for (const member of newMembers) {
    if (member.is_bot) continue;
    
    // Create user stats in Firebase
    await createOrUpdateUserStats(member.id, {
      username: member.username,
      firstName: member.first_name,
    });
  }
}

// Example: Track message and update stats
export async function trackMessageWithStats(ctx: BotContext): Promise<void> {
  if (!ctx.message || !('text' in ctx.message)) return;
  
  const userId = ctx.from?.id;
  if (!userId) return;
  
  // Update user info if changed
  await createOrUpdateUserStats(userId, {
    username: ctx.from.username,
    firstName: ctx.from.first_name,
  });
  
  // Track the message
  await trackUserMessage(userId);
  
  // Update daily streak
  // await updateUserStreak(userId);
}

// Example: Update spam score when spam is detected
export async function handleSpamDetection(userId: number, spamScore: number): Promise<void> {
  // Use incrementSpamScore to add to existing score rather than replace it
  await incrementSpamScore(userId, spamScore);
  
  // Add warning if spam score exceeds threshold
  if (spamScore > 30) {
    await addUserWarning(userId);
  }
}

// Example: Get user stats for commands
export async function getUserStatsForCommand(userId: number): Promise<string> {
  const stats = await getUserStats(userId);
  
  if (!stats) {
    return '❌ User not found in database';
  }
  
  const userName = stats.username ? `@${stats.username}` : stats.firstName || 'Unknown';
  
  return `📊 **User Statistics for ${userName}**
  
🎯 **Level ${stats.level}** (${stats.points} points)
📝 Messages: ${stats.messageCount}
⚠️ Warnings: ${stats.warnings}
🚫 Spam Score: ${stats.spamScore}
🔥 Streak: ${stats.streakDays} days
🏆 Achievements: ${stats.achievements.length}

**Status:** ${stats.isBanned ? '🚫 Banned' : stats.isMuted ? '🔇 Muted' : '✅ Active'}`;
}
