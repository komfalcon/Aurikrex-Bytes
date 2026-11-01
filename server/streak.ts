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

/**
 * Evaluates a reader's current streak without awarding today's streak prematurely.
 * Today's streak is only awarded via updateDailyStreak once the reader finishes today's drop.
 */
export function evaluateStreakDisplay(
  state: StreakState,
  today: string
): StreakUpdate {
  if (!state.lastActiveDate) {
    return {
      currentStreak: 0,
      longestStreak: state.longestStreak,
      lastActiveDate: null,
      increased: false,
    };
  }
  const diffDays = utcDayNumber(today) - utcDayNumber(state.lastActiveDate);
  if (diffDays === 0 || diffDays === 1) {
    return {
      currentStreak: state.currentStreak,
      longestStreak: state.longestStreak,
      lastActiveDate: state.lastActiveDate,
      increased: false,
    };
  }
  return {
    currentStreak: 0,
    longestStreak: state.longestStreak,
    lastActiveDate: state.lastActiveDate,
    increased: false,
  };
}

export interface EmptyTodayCopy {
  phase: "pre_drop" | "in_review" | "evening_wrap";
  eyebrow: string;
  heading: string;
  body: string;
}

export function getTimeAwareEmptyTodayState(
  now = new Date(),
  timeZone = "Africa/Lagos"
): EmptyTodayCopy {
  const hour =
    Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "numeric",
        hour12: false,
      }).format(now)
    ) % 24;

  if (hour < 8) {
    return {
      phase: "pre_drop",
      eyebrow: "Morning edition incoming",
      heading: "Today’s drop lands at 8:00 AM WAT",
      body: "Our editors are finalizing today’s 5–10 stories. Catch up on yesterday’s edition in the archive while you wait.",
    };
  }

  if (hour < 18) {
    return {
      phase: "in_review",
      eyebrow: "Newsroom in session",
      heading: "Today’s edition is being finished",
      body: "Today’s briefing is taking a little longer in editorial review. Yesterday’s Bytes are ready in the archive.",
    };
  }

  return {
    phase: "evening_wrap",
    eyebrow: "Edition wrap",
    heading: "Yesterday’s Bytes are in the archive",
    body: "No new drop was published today. Browse recent editions in the archive — tomorrow’s briefing arrives at 8:00 AM WAT.",
  };
}
