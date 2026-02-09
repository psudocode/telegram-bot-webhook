import { BotContext } from '../../bot';

// Welcome messages for new members
const WELCOME_MESSAGES = [
  "🎉 Welcome {user} to the group! Feel free to introduce yourself!",
  "👋 Hello {user}! Great to have you here! Please read the group rules.",
  "🌟 Welcome {user}! We're excited to have you join our community!",
  "🎈 Hi {user}! Welcome aboard! Don't hesitate to ask questions.",
  "🎊 Welcome {user}! Hope you have a great time in this group!"
];

// Goodbye messages for leaving members
const GOODBYE_MESSAGES = [
  "👋 Goodbye {user}! Thanks for being part of our community.",
  "🌊 Farewell {user}! We'll miss you in the group.",
  "👤 {user} has left the group. Wishing you all the best!",
  "🚪 {user} has left. Thanks for your contributions!",
  "🌙 Goodbye {user}! Hope to see you again someday!"
];

// Member tracking for analytics
interface MemberStats {
  joinDate: number;
  messageCount: number;
  lastActivity: number;
  warnings: number;
  isMuted: boolean;
}

const memberStats = new Map<number, MemberStats>();

export async function handleNewChatMembers(ctx: BotContext): Promise<void> {
  if (!ctx.message || !('new_chat_members' in ctx.message)) return;
  
  const newMembers = ctx.message.new_chat_members;
  
  for (const member of newMembers) {
    // Skip if the bot itself joined
    if (member.is_bot) continue;
    
    // Track member stats
    if (member.id) {
      memberStats.set(member.id, {
        joinDate: Date.now(),
        messageCount: 0,
        lastActivity: Date.now(),
        warnings: 0,
        isMuted: false
      });
    }
    
    const userName = member.username ? `@${member.username}` : member.first_name || 'Unknown';
    const welcomeMessage = WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)]
      .replace('{user}', userName);
    
    try {
      await ctx.reply(welcomeMessage);
    } catch (error) {
      console.error('Error sending welcome message:', error);
    }
  }
}

export async function handleLeftChatMember(ctx: BotContext): Promise<void> {
  if (!ctx.message || !('left_chat_member' in ctx.message)) return;
  
  const leftMember = ctx.message.left_chat_member;
  
  // Skip if the bot itself left
  if (leftMember.is_bot) return;
  
  // Remove from member stats
  if (leftMember.id) {
    memberStats.delete(leftMember.id);
  }
  
  const userName = leftMember.username ? `@${leftMember.username}` : leftMember.first_name || 'Unknown';
  const goodbyeMessage = GOODBYE_MESSAGES[Math.floor(Math.random() * GOODBYE_MESSAGES.length)]
    .replace('{user}', userName);
  
  try {
    await ctx.reply(goodbyeMessage);
  } catch (error) {
    console.error('Error sending goodbye message:', error);
  }
}

export function trackUserMessage(userId: number): void {
  const stats = memberStats.get(userId);
  if (stats) {
    stats.messageCount++;
    stats.lastActivity = Date.now();
    memberStats.set(userId, stats);
  }
}

export function getUserStats(userId: number): MemberStats | undefined {
  return memberStats.get(userId);
}

export function getAllMemberStats(): Array<{ userId: number; stats: MemberStats }> {
  return Array.from(memberStats.entries()).map(([userId, stats]) => ({ userId, stats }));
}

export function getActiveMembersCount(sinceMinutes: number = 30): number {
  const cutoff = Date.now() - (sinceMinutes * 60 * 1000);
  return Array.from(memberStats.values()).filter(stats => stats.lastActivity > cutoff).length;
}

export function addWarning(userId: number): number {
  const stats = memberStats.get(userId);
  if (stats) {
    stats.warnings++;
    memberStats.set(userId, stats);
    return stats.warnings;
  }
  return 0;
}

export function muteUser(userId: number, durationMinutes: number = 30): void {
  const stats = memberStats.get(userId);
  if (stats) {
    stats.isMuted = true;
    memberStats.set(userId, stats);
    
    // Auto-unmute after duration
    setTimeout(() => {
      const currentStats = memberStats.get(userId);
      if (currentStats) {
        currentStats.isMuted = false;
        memberStats.set(userId, currentStats);
      }
    }, durationMinutes * 60 * 1000);
  }
}

export function isUserMuted(userId: number): boolean {
  const stats = memberStats.get(userId);
  return stats?.isMuted || false;
}

export function clearUserWarnings(userId: number): void {
  const stats = memberStats.get(userId);
  if (stats) {
    stats.warnings = 0;
    memberStats.set(userId, stats);
  }
}
