export const PUSH_TIMEZONE = "Africa/Lagos";

export type PushSlot = "morning" | "evening";

export interface SlotResolution {
  isValid: boolean;
  status?: "outside_window" | "invalid_slot";
  slot?: PushSlot;
  editionDate?: string; // YYYY-MM-DD in Africa/Lagos
  scheduledFor?: Date;
}

export function getLagosParts(now: Date = new Date()) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: PUSH_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  const parts = dtf.formatToParts(now);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") partMap[p.type] = p.value;
  }

  const year = parseInt(partMap.year, 10);
  const month = parseInt(partMap.month, 10);
  const day = parseInt(partMap.day, 10);
  const hour = parseInt(partMap.hour, 10);
  const minute = parseInt(partMap.minute, 10);
  const second = parseInt(partMap.second, 10);

  const yyyy = String(year);
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const dateStr = `${yyyy}-${mm}-${dd}`;

  return { year, month, day, hour, minute, second, dateStr };
}

/**
 * Resolves the push slot and target edition date for the notification trigger.
 * Morning slot: 08:00 WAT (07:00 UTC), active window 08:00 - 11:00 WAT.
 * Evening slot: 22:00 WAT (21:00 UTC), active window 22:00 - 01:00 WAT (spans midnight).
 */
export function resolvePushSlot(
  requestedSlot?: string | null,
  now: Date = new Date(),
  ignoreWindow = false
): SlotResolution {
  const { year, month, day, hour, dateStr } = getLagosParts(now);

  const normSlot = requestedSlot?.trim().toLowerCase();
  if (normSlot && normSlot !== "morning" && normSlot !== "evening") {
    return { isValid: false, status: "invalid_slot" };
  }

  // Morning window: 08:00 - 10:59:59 (hour in [8, 9, 10])
  const inMorningWindow = hour >= 8 && hour < 11;
  // Evening window: 22:00 - 00:59:59 (hour 22, 23, or 0 past midnight)
  const inEveningWindow = hour >= 22 || hour === 0;

  let targetSlot: PushSlot;

  if (normSlot === "morning") {
    if (!ignoreWindow && !inMorningWindow) {
      return { isValid: false, status: "outside_window" };
    }
    targetSlot = "morning";
  } else if (normSlot === "evening") {
    if (!ignoreWindow && !inEveningWindow) {
      return { isValid: false, status: "outside_window" };
    }
    targetSlot = "evening";
  } else {
    // Derive slot automatically from current time window
    if (inMorningWindow) {
      targetSlot = "morning";
    } else if (inEveningWindow) {
      targetSlot = "evening";
    } else {
      if (!ignoreWindow) {
        return { isValid: false, status: "outside_window" };
      }
      // In test/ignoreWindow mode, infer sensible fallback
      targetSlot = hour >= 16 || hour < 4 ? "evening" : "morning";
    }
  }

  if (targetSlot === "morning") {
    // Target scheduled: today at 07:00 UTC (08:00 WAT)
    const scheduledFor = new Date(Date.UTC(year, month - 1, day, 7, 0, 0));
    return {
      isValid: true,
      slot: "morning",
      editionDate: dateStr,
      scheduledFor,
    };
  } else {
    // Evening slot:
    // If hour === 0 (past midnight in Lagos), the target evening edition was scheduled yesterday at 22:00 WAT.
    if (hour === 0) {
      // 2 hours prior is safely inside yesterday evening in Lagos
      const prevDate = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const prevParts = getLagosParts(prevDate);
      const scheduledFor = new Date(
        Date.UTC(prevParts.year, prevParts.month - 1, prevParts.day, 21, 0, 0)
      );
      return {
        isValid: true,
        slot: "evening",
        editionDate: prevParts.dateStr,
        scheduledFor,
      };
    } else {
      // Target scheduled: today at 21:00 UTC (22:00 WAT)
      const scheduledFor = new Date(Date.UTC(year, month - 1, day, 21, 0, 0));
      return {
        isValid: true,
        slot: "evening",
        editionDate: dateStr,
        scheduledFor,
      };
    }
  }
}
