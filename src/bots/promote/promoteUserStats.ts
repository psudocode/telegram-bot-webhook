import { db } from '../../config/firebase';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { REGULAR_DAILY_LIMIT, PREMIUM_DAILY_LIMIT } from './limiter';

export interface PromoteUserStats {
  userId: string;
  isPremium: boolean;
  dailyMessageCount: number;
  lastMessageDate: string; // YYYY-MM-DD format
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const USERS_COLLECTION = 'promote_users';

function getToday(): string {
  // Use Jakarta timezone (UTC+07:00) for Indonesia
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

export async function getPromoteUserStats(userId: string | number): Promise<PromoteUserStats | null> {
  const userRef = db.collection(USERS_COLLECTION).doc(userId.toString());
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    return null;
  }

  return userSnap.data() as PromoteUserStats;
}

export async function createPromoteUser(userId: string | number, isPremium: boolean = false): Promise<PromoteUserStats> {
  const today = getToday();
  const userRef = db.collection(USERS_COLLECTION).doc(userId.toString());

  const newUser: Omit<PromoteUserStats, 'createdAt' | 'updatedAt'> = {
    userId: userId.toString(),
    isPremium,
    dailyMessageCount: 0,
    lastMessageDate: today,
  };

  await userRef.set({
    ...newUser,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    ...newUser,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  } as PromoteUserStats;
}

export async function incrementPromoteUserMessageCount(userId: string | number): Promise<PromoteUserStats> {
  const userRef = db.collection(USERS_COLLECTION).doc(userId.toString());
  const today = getToday();

  let userStats = await getPromoteUserStats(userId);

  if (!userStats) {
    userStats = await createPromoteUser(userId, false);
  }

  // Reset daily count if it's a new day
  const isNewDay = userStats.lastMessageDate !== today;
  const newDailyCount = isNewDay ? 1 : userStats.dailyMessageCount + 1;

  const updates = {
    dailyMessageCount: newDailyCount,
    lastMessageDate: today,
    updatedAt: FieldValue.serverTimestamp(),
  };

  await userRef.update(updates);

  return {
    ...userStats,
    dailyMessageCount: newDailyCount,
    lastMessageDate: today,
    updatedAt: Timestamp.now(),
  } as PromoteUserStats;
}

export async function canPromoteUserSendMessage(userId: string | number): Promise<{
  allowed: boolean;
  stats: PromoteUserStats;
  remaining: number;
}> {
  let userStats = await getPromoteUserStats(userId);

  if (!userStats) {
    userStats = await createPromoteUser(userId, false);
  }

  const today = getToday();
  const isNewDay = userStats.lastMessageDate !== today;
  const dailyCount = isNewDay ? 0 : userStats.dailyMessageCount;
  const limit = userStats.isPremium ? PREMIUM_DAILY_LIMIT : REGULAR_DAILY_LIMIT;
  const remaining = limit - dailyCount;

  return {
    allowed: dailyCount < limit,
    stats: { ...userStats, dailyMessageCount: dailyCount },
    remaining,
  };
}

export async function setPromoteUserPremiumStatus(
  userId: string | number,
  isPremium: boolean
): Promise<void> {
  const userRef = db.collection(USERS_COLLECTION).doc(userId.toString());
  const userStats = await getPromoteUserStats(userId);

  if (!userStats) {
    await createPromoteUser(userId, isPremium);
    return;
  }

  await userRef.update({
    isPremium,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function resetDailyCountIfNewDay(userId: string | number): Promise<void> {
  const userRef = db.collection(USERS_COLLECTION).doc(userId.toString());
  const userStats = await getPromoteUserStats(userId);

  if (!userStats) {
    return;
  }

  const today = getToday();
  if (userStats.lastMessageDate !== today) {
    await userRef.update({
      dailyMessageCount: 0,
      lastMessageDate: today,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}
