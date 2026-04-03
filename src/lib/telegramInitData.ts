const telegramInitDebugKey = "tg-bot-gambling:telegramInitDebug:v1";

export type TelegramInitUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

export function getTelegramInitDataRaw(): string {
  if (typeof window === "undefined") return "";
  return window.Telegram?.WebApp?.initData ?? "";
}

export function parseTelegramInitData(raw: string): {
  hash: string;
  user: TelegramInitUser | null;
} {
  if (!raw.trim()) {
    return { hash: "", user: null };
  }

  const params = new URLSearchParams(raw);
  const hash = params.get("hash") ?? "";
  const userParam = params.get("user");

  if (!userParam) {
    return { hash, user: null };
  }

  try {
    const parsed = JSON.parse(userParam) as TelegramInitUser;
    if (typeof parsed?.id !== "number") {
      return { hash, user: null };
    }
    return { hash, user: parsed };
  } catch {
    return { hash, user: null };
  }
}

function formatTelegramUsername(user: TelegramInitUser): string {
  if (user.username && user.username.trim()) {
    return `@${user.username.trim()}`;
  }
  const first = user.first_name?.trim() ?? "";
  const last = user.last_name?.trim() ?? "";
  const full = [first, last].filter(Boolean).join(" ");
  return full || "Telegram";
}

export type TelegramProfileData = {
  profileId: string;
  username: string;
  rawInitData: string;
  hash: string;
};

export function getTelegramProfileData(): TelegramProfileData | null {
  const rawInitData = getTelegramInitDataRaw();
  if (!rawInitData) return null;

  const { hash, user } = parseTelegramInitData(rawInitData);
  if (!user) return null;

  try {
    localStorage.setItem(
      telegramInitDebugKey,
      JSON.stringify({ rawInitData, hash, savedAt: new Date().toISOString() }),
    );
  } catch {
    // ignore quota / private mode
  }

  return {
    profileId: String(user.id),
    username: formatTelegramUsername(user),
    rawInitData,
    hash,
  };
}
