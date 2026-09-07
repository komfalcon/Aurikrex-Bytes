export type StreakState = {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
};

export type StreakUpdate = StreakState & { increased: boolean };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function utcDayNumber(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

export function updateDailyStreak(
  state: StreakState,
  today: string
): StreakUpdate {
  if (state.lastActiveDate === today)
    return { ...state, increased: false };

  const isConsecutive =
    state.lastActiveDate !== null &&
    utcDayNumber(today) - utcDayNumber(state.lastActiveDate) === 1;
  const currentStreak = isConsecutive ? state.currentStreak + 1 : 1;
  return {
    currentStreak,
    longestStreak: Math.max(state.longestStreak, currentStreak),
    lastActiveDate: today,
    increased: true,
  };
}
