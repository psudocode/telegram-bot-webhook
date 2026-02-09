import { db } from '../../config/firebase';
import { FieldValue } from 'firebase-admin/firestore';

// User statistics interface
export interface UserStats {
  userId: number;
  username?: string;
  firstName?: string;
  joinDate: any; // Firestore timestamp
  lastActivity: any; // Firestore timestamp
  messageCount: number;
  spamScore: number;
  warnings: number;
  isBanned: boolean;
  isMuted: boolean;
  points: number; // For gamification
  level: number; // User level based on points
  spamFlags: number; // Total spam flags received
  helpfulFlags: number; // Times marked as helpful
  muteCount: number; // Total times muted
  lastMuteDate?: any; // Last mute timestamp
  lastSpamUpdate?: any; // Last spam score update timestamp
  lastSpamReset?: any; // Last spam score reset timestamp
  banReason?: string; // Reason for ban
  achievements: string[]; // Achievement IDs
  streakDays: number; // Consecutive days active
  lastStreakDate: any; // Last day they were active
}

// Collection reference
const USERS_COLLECTION = 'userStats';

// Create or update user stats
export async function createOrUpdateUserStats(
  userId: number,
  userData: {
    username?: string;
    firstName?: string;
  }
): Promise<void> {
  const userRef = db.collection(USERS_COLLECTION).doc(userId.toString());
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    // Create new user stats
    const newStats: Omit<UserStats, 'userId'> = {
      username: userData.username,
      firstName: userData.firstName,
      joinDate: FieldValue.serverTimestamp(),
      lastActivity: FieldValue.serverTimestamp(),
      messageCount: 0,
      spamScore: 0,
      warnings: 0,
      isBanned: false,
      isMuted: false,
      points: 0,
      level: 1,
      spamFlags: 0,
      helpfulFlags: 0,
      muteCount: 0,
      achievements: [],
      streakDays: 0,
      lastStreakDate: FieldValue.serverTimestamp(),
    };

    await userRef.set({
      userId,
      ...newStats,
    });
  } else {
    // Update existing user with new username/firstName if provided
    const updates: any = {
      lastActivity: FieldValue.serverTimestamp(),
    };

    if (userData.username) updates.username = userData.username;
    if (userData.firstName) updates.firstName = userData.firstName;

    await userRef.update(updates);
  }
}

// Track user message
export async function trackUserMessage(userId: number): Promise<void> {
  const userRef = db.collection(USERS_COLLECTION).doc(userId.toString());
  
  await userRef.update({
    messageCount: FieldValue.increment(1),
    lastActivity: FieldValue.serverTimestamp(),
    points: FieldValue.increment(1), // 1 point per message
  });

  // Check for level up
  await checkLevelUp(userId);
}

// Update spam score
export async function updateSpamScore(userId: number, score: number): Promise<void> {
  const userRef = db.collection(USERS_COLLECTION).doc(userId.toString());
  
  await userRef.update({
    spamScore: score,
    spamFlags: FieldValue.increment(score > 30 ? 1 : 0), // Increment spam flags if score exceeds threshold
    lastSpamUpdate: FieldValue.serverTimestamp()
  });
}

// Increment spam score (additive)
export async function incrementSpamScore(userId: number, scoreToAdd: number): Promise<void> {
  const userRef = db.collection(USERS_COLLECTION).doc(userId.toString());
  const userDoc = await userRef.get();
  
  if (!userDoc.exists) return;
  
  const currentScore = userDoc.data()?.spamScore || 0;
  const newScore = Math.max(0, currentScore + scoreToAdd); // Ensure score doesn't go negative
  
  await userRef.update({
    spamScore: newScore,
    spamFlags: FieldValue.increment(newScore > 30 && currentScore <= 30 ? 1 : 0), // Only increment flag when crossing threshold
    lastSpamUpdate: FieldValue.serverTimestamp()
  });
}

// Add warning to user
export async function addUserWarning(userId: number): Promise<number> {
  const userRef = db.collection(USERS_COLLECTION).doc(userId.toString());
  const userDoc = await userRef.get();
  
  if (!userDoc.exists) return 0;

  const currentWarnings = userDoc.data()?.warnings || 0;
  const newWarnings = currentWarnings + 1;

  await userRef.update({
    warnings: newWarnings,
    points: FieldValue.increment(-5), // Deduct points for warning
  });

  return newWarnings;
}

// Mute user
export async function muteUser(
  userId: number, 
  durationMinutes: number = 30
): Promise<void> {
  const userRef = db.collection(USERS_COLLECTION).doc(userId.toString());
  
  await userRef.update({
    isMuted: true,
    muteCount: FieldValue.increment(1),
    lastMuteDate: FieldValue.serverTimestamp(),
    points: FieldValue.increment(-10), // Deduct points for mute
  });

  // Auto-unmute after duration
  setTimeout(async () => {
    await unmuteUser(userId);
  }, durationMinutes * 60 * 1000);
}

// Unmute user
export async function unmuteUser(userId: number): Promise<void> {
  const userRef = db.collection(USERS_COLLECTION).doc(userId.toString());
  
  await userRef.update({
    isMuted: false,
  });
}

// Ban user
export async function banUser(userId: number, reason?: string): Promise<void> {
  const userRef = db.collection(USERS_COLLECTION).doc(userId.toString());
  
  await userRef.update({
    isBanned: true,
    banReason: reason,
    points: FieldValue.increment(-50), // Heavy point deduction for ban
  });
}

// Unban user
export async function unbanUser(userId: number): Promise<void> {
  const userRef = db.collection(USERS_COLLECTION).doc(userId.toString());
  
  await userRef.update({
    isBanned: false,
    banReason: null,
  });
}

// Clear user warnings
export async function clearUserWarnings(userId: number): Promise<void> {
  const userRef = db.collection(USERS_COLLECTION).doc(userId.toString());
  
  await userRef.update({
    warnings: 0,
  });
}

// Add points to user
export async function addUserPoints(userId: number, points: number): Promise<void> {
  const userRef = db.collection(USERS_COLLECTION).doc(userId.toString());
  
  await userRef.update({
    points: FieldValue.increment(points),
  });

  // Check for level up
  await checkLevelUp(userId);
}

// Mark user as helpful
export async function markUserHelpful(userId: number): Promise<void> {
  const userRef = db.collection(USERS_COLLECTION).doc(userId.toString());
  
  await userRef.update({
    helpfulFlags: FieldValue.increment(1),
    points: FieldValue.increment(5), // Bonus points for being helpful
  });

  await checkLevelUp(userId);
}

// Check and update user level based on points
async function checkLevelUp(userId: number): Promise<void> {
  const userRef = db.collection(USERS_COLLECTION).doc(userId.toString());
  const userDoc = await userRef.get();
  
  if (!userDoc.exists) return;

  const userData = userDoc.data();
  const currentPoints = userData?.points || 0;
  const currentLevel = userData?.level || 1;
  
  // Calculate new level (100 points per level)
  const newLevel = Math.floor(currentPoints / 100) + 1;
  
  if (newLevel > currentLevel) {
    await userRef.update({
      level: newLevel,
    });
    
    // Add level up achievement
    await addAchievement(userId, `level_${newLevel}`);
  }
}

// Add achievement to user
export async function addAchievement(userId: number, achievementId: string): Promise<void> {
  const userRef = db.collection(USERS_COLLECTION).doc(userId.toString());
  
  // Use array union to avoid duplicates
  await userRef.update({
    achievements: FieldValue.arrayUnion(achievementId),
    points: FieldValue.increment(10), // Bonus points for achievements
  });
}

// Update user streak
export async function updateUserStreak(userId: number): Promise<void> {
  const userRef = db.collection(USERS_COLLECTION).doc(userId.toString());
  const userDoc = await userRef.get();
  
  if (!userDoc.exists) return;

  const userData = userDoc.data();
  const lastStreakDate = userData?.lastStreakDate?.toDate();
  const currentStreak = userData?.streakDays || 0;
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  let newStreak = currentStreak;
  
  if (lastStreakDate) {
    const lastActive = new Date(lastStreakDate.getFullYear(), lastStreakDate.getMonth(), lastStreakDate.getDate());
    const diffDays = Math.floor((today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      // Consecutive day
      newStreak++;
    } else if (diffDays > 1) {
      // Streak broken
      newStreak = 1;
    }
    // If diffDays === 0, already active today, don't change streak
  } else {
    newStreak = 1;
  }
  
  await userRef.update({
    streakDays: newStreak,
    lastStreakDate: FieldValue.serverTimestamp(),
  });
  
  // Add streak achievements
  if (newStreak === 7) await addAchievement(userId, 'week_streak');
  if (newStreak === 30) await addAchievement(userId, 'month_streak');
  if (newStreak === 100) await addAchievement(userId, 'century_streak');
}

// Get user stats
export async function getUserStats(userId: number): Promise<UserStats | null> {
  const userRef = db.collection(USERS_COLLECTION).doc(userId.toString());
  const userDoc = await userRef.get();
  
  if (!userDoc.exists) return null;
  
  return userDoc.data() as UserStats;
}

// Get top users by points
export async function getTopUsers(limitCount: number = 10): Promise<UserStats[]> {
  const usersQuery = db.collection(USERS_COLLECTION)
    .orderBy('points', 'desc')
    .limit(limitCount);
  
  const querySnapshot = await usersQuery.get();
  return querySnapshot.docs.map(doc => doc.data() as UserStats);
}

// Get banned users
export async function getBannedUsers(): Promise<UserStats[]> {
  const usersQuery = db.collection(USERS_COLLECTION)
    .where('isBanned', '==', true);
  
  const querySnapshot = await usersQuery.get();
  return querySnapshot.docs.map(doc => doc.data() as UserStats);
}

// Get users with high spam scores
export async function getHighSpamUsers(threshold: number = 30): Promise<UserStats[]> {
  const usersQuery = db.collection(USERS_COLLECTION)
    .where('spamScore', '>', threshold)
    .orderBy('spamScore', 'desc');
  
  const querySnapshot = await usersQuery.get();
  return querySnapshot.docs.map(doc => doc.data() as UserStats);
}

// Reset user spam score
export async function resetUserSpamScore(userId: number): Promise<void> {
  const userRef = db.collection(USERS_COLLECTION).doc(userId.toString());
  await userRef.update({
    spamScore: 0,
    spamFlags: 0,
    lastSpamReset: FieldValue.serverTimestamp()
  });
}

// Auto-reset spam scores for users below threshold for 7 days
export async function autoResetSpamScores(): Promise<void> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const usersQuery = db.collection(USERS_COLLECTION)
    .where('spamScore', '<', 30) // Below spam threshold
    .where('lastActivity', '<', sevenDaysAgo); // Inactive for 7+ days
  
  const querySnapshot = await usersQuery.get();
  
  const batch = db.batch();
  querySnapshot.docs.forEach(doc => {
    batch.update(doc.ref, {
      spamScore: 0,
      spamFlags: 0,
      lastSpamReset: FieldValue.serverTimestamp()
    });
  });
  
  await batch.commit();
  console.log(`Auto-reset spam scores for ${querySnapshot.size} users`);
}
