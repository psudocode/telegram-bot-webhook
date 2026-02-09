const REGULAR_DAILY_LIMIT = 20;
const PREMIUM_DAILY_LIMIT = 50;

const REGULAR_TEXT_LIMIT = 60;
const PREMIUM_TEXT_LIMIT = 120;

const isCharLimitExceeded = (text: string, isPremium: boolean): boolean => {
    const charCount = text.length;
    return charCount > (isPremium ? PREMIUM_TEXT_LIMIT : REGULAR_TEXT_LIMIT);
}

const isDailyLimitExceeded = (used: number, isPremium: boolean): boolean => {
    const dailyLimit = isPremium ? PREMIUM_DAILY_LIMIT : REGULAR_DAILY_LIMIT;
    return used >= dailyLimit;
}

const getDailyQuotaText = (isPremium: boolean, used: number): string => {
    const dailyLimit = isPremium ? PREMIUM_DAILY_LIMIT : REGULAR_DAILY_LIMIT;
    return `${dailyLimit - used}/${dailyLimit}`;
}

export {
    REGULAR_DAILY_LIMIT,
    PREMIUM_DAILY_LIMIT,
    REGULAR_TEXT_LIMIT,
    PREMIUM_TEXT_LIMIT,
    isCharLimitExceeded,
    isDailyLimitExceeded,
    getDailyQuotaText,
};