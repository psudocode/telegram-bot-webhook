import { BotContext } from '../../bot';

export interface SpamDetection {
  isSpam: boolean;
  score: number;
  reasons: string[];
  action: 'NONE' | 'DELETE' | 'MUTE' | 'BAN';
}

interface UserMessageHistory {
  count: number;
  lastMessage: number;
  messages: string[];
}

// Constants
const SPAM_THRESHOLDS = {
  BAN: 70,
  MUTE: 45,
  DELETE: 30
} as const;

const MESSAGE_LIMITS = {
  MAX_MESSAGES_PER_MINUTE: 7,
  MAX_SIMILAR_MESSAGES: 3,
  MIN_MESSAGE_LENGTH: 5,
  MAX_MESSAGE_LENGTH: 800,
  CAPS_RATIO_THRESHOLD: 0.7,
  CAPS_MIN_LENGTH: 20,
  HISTORY_SIZE: 5,
  ACTIVE_USER_TIMEOUT: 300000, // 5 minutes
  RATE_LIMIT_WINDOW: 60000 // 1 minute
} as const;

const SPAM_SCORES = {
  HIGH_RISK_PATTERN: 30,
  MULTIPLE_LINKS: 25,
  RATE_LIMIT_EXCEEDED: 25,
  REPEATED_MESSAGE: 20,
  EXCESSIVE_CAPS: 10,
  VERY_LONG_MESSAGE: 8,
  RISKY_PATTERN: 4,
  VERY_SHORT_MESSAGE: 5
} as const;

// Spam detection patterns
const HIGH_RISK_PATTERNS = [
  /slot|judi|togel|casino|poker|domino|qq/i,
  /bit\.ly|tinyurl|t\.co/i,
  /(https?:\/\/[^\s]+.*https?:\/\/[^\s]+)/i,
];

const RISK_PATTERNS = [
  /🚀|💰|💸|📈|🤑|⚡|🔥|✨/,
  /bitcoin|btc|crypto|investasi|duit|uang|rp/i,
  /promo|diskon|gratis|bonus|hadiah|murah/i,
  /jual|beli|toko|shop|online/i,
];

const URL_PATTERN = /(https?:\/\/[^\s]+)/i;

// User message history storage
const userMessageHistory = new Map<number, UserMessageHistory>();

// Helper functions
function analyzeTextPatterns(text: string): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // High risk patterns
  HIGH_RISK_PATTERNS.forEach(pattern => {
    if (pattern.test(text)) {
      score += SPAM_SCORES.HIGH_RISK_PATTERN;
      reasons.push('High-risk spam pattern detected');
    }
  });

  // Multiple links
  const links = text.match(new RegExp(URL_PATTERN, 'g')) || [];
  if (links.length >= 2) {
    score += SPAM_SCORES.MULTIPLE_LINKS;
    reasons.push('Multiple links in one message');
  }

  // Medium risk patterns
  RISK_PATTERNS.forEach(pattern => {
    if (pattern.test(text)) {
      score += SPAM_SCORES.RISKY_PATTERN;
      reasons.push('Risky wording detected');
    }
  });

  return { score, reasons };
}

function analyzeTextStyle(text: string): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Message length checks
  if (text.length < MESSAGE_LIMITS.MIN_MESSAGE_LENGTH) {
    score += SPAM_SCORES.VERY_SHORT_MESSAGE;
    reasons.push('Very short message');
  }

  if (text.length > MESSAGE_LIMITS.MAX_MESSAGE_LENGTH) {
    score += SPAM_SCORES.VERY_LONG_MESSAGE;
    reasons.push('Very long message');
  }

  // Excessive caps
  const capsCount = (text.match(/[A-Z]/g) || []).length;
  const capsRatio = capsCount / Math.max(1, text.length);

  if (capsRatio > MESSAGE_LIMITS.CAPS_RATIO_THRESHOLD && text.length > MESSAGE_LIMITS.CAPS_MIN_LENGTH) {
    score += SPAM_SCORES.EXCESSIVE_CAPS;
    reasons.push('Excessive ALL CAPS');
  }

  return { score, reasons };
}

function analyzeUserBehavior(text: string, userId: number, now: number): { score: number; reasons: string[]; updatedHistory: UserMessageHistory } {
  let score = 0;
  const reasons: string[] = [];

  const history = userMessageHistory.get(userId) || {
    count: 0,
    lastMessage: 0,
    messages: [],
  };

  // Rate limiting
  if (now - history.lastMessage < MESSAGE_LIMITS.RATE_LIMIT_WINDOW) {
    if (history.count >= MESSAGE_LIMITS.MAX_MESSAGES_PER_MINUTE) {
      score += SPAM_SCORES.RATE_LIMIT_EXCEEDED;
      reasons.push('Too many messages in one minute');
    }
  }

  // Similar message detection
  const updatedMessages = [...history.messages, text];
  if (updatedMessages.length > MESSAGE_LIMITS.HISTORY_SIZE) {
    updatedMessages.shift();
  }

  const similarCount = updatedMessages.filter(
    msg => msg.toLowerCase() === text.toLowerCase()
  ).length;

  if (similarCount >= MESSAGE_LIMITS.MAX_SIMILAR_MESSAGES) {
    score += SPAM_SCORES.REPEATED_MESSAGE;
    reasons.push('Repeated identical messages');
  }

  // Update history
  const updatedHistory: UserMessageHistory = {
    count: now - history.lastMessage < MESSAGE_LIMITS.RATE_LIMIT_WINDOW ? history.count + 1 : 1,
    lastMessage: now,
    messages: updatedMessages,
  };

  userMessageHistory.set(userId, updatedHistory);

  return { score, reasons, updatedHistory };
}

function determineAction(score: number): 'NONE' | 'DELETE' | 'MUTE' | 'BAN' {
  if (score >= SPAM_THRESHOLDS.BAN) return 'BAN';
  if (score >= SPAM_THRESHOLDS.MUTE) return 'MUTE';
  if (score >= SPAM_THRESHOLDS.DELETE) return 'DELETE';
  return 'NONE';
}

// Core spam detection function
function analyzeSpam(text: string, userId: number): SpamDetection {
  const now = Date.now();
  
  const textPatternResult = analyzeTextPatterns(text);
  const textStyleResult = analyzeTextStyle(text);
  const behaviorResult = analyzeUserBehavior(text, userId, now);
  
  const totalScore = textPatternResult.score + textStyleResult.score + behaviorResult.score;
  const allReasons = [...textPatternResult.reasons, ...textStyleResult.reasons, ...behaviorResult.reasons];
  const action = determineAction(totalScore);
  
  return {
    isSpam: action !== 'NONE',
    score: totalScore,
    reasons: allReasons,
    action
  };
}

export async function moderateMessage(
  ctx: BotContext,
  text: string,
  userId: number
): Promise<SpamDetection> {
  const detection = analyzeSpam(text, userId);

  // Execute Telegram actions based on detection
  try {
    switch (detection.action) {
      case 'DELETE':
        await ctx.deleteMessage();
        break;
      case 'MUTE':
        await ctx.restrictChatMember(userId, {
          permissions: { can_send_messages: false },
          until_date: Math.floor(Date.now() / 1000) + 600 // 10 minutes
        });
        break;
      case 'BAN':
        await ctx.banChatMember(userId);
        break;
    }
  } catch (err) {
    console.error('Moderation failed:', err);
  }

  return detection;
}

export function calculateSpamScore(text: string, userId: number): SpamDetection {
  return analyzeSpam(text, userId);
}

export function getSpamStats() {
  const now = Date.now();
  const activeUsers = Array.from(userMessageHistory.values()).filter(
    user => now - user.lastMessage < MESSAGE_LIMITS.ACTIVE_USER_TIMEOUT
  ).length;

  return {
    totalUsers: userMessageHistory.size,
    activeUsers,
    patternsCount: HIGH_RISK_PATTERNS.length + RISK_PATTERNS.length,
    keywordsCount: HIGH_RISK_PATTERNS.length + RISK_PATTERNS.length
  };
}

export function resetUserHistory(userId: number): void {
  userMessageHistory.delete(userId);
}
