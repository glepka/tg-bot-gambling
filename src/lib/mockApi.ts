import { nanoid } from "./nanoid";
import { supabase } from "./supabaseClient";
import { getTelegramProfileData } from "./telegramInitData";
import type { Bet, Event, EventStatus, Outcome, Profile } from "@/types/local";

const profileIdStorageKey = "tg-bot-gambling:profileId:v1";
const defaultProfileBalance = 1000;

function getNowIso() {
  return new Date().toISOString();
}

function normalizeProfileRow(row: unknown): Profile {
  const p = row as Profile;
  return {
    ...p,
    balance: typeof p.balance === "string" ? Number(p.balance) : p.balance,
  };
}

function getOrCreateLocalProfileId() {
  const existing = localStorage.getItem(profileIdStorageKey);
  if (existing) return existing;
  const created = nanoid();
  localStorage.setItem(profileIdStorageKey, created);
  return created;
}

function resolveProfileIdentity(): {
  profileId: string;
  displayUsername: string;
  syncUsernameFromTelegram: string | null;
} {
  const tg = getTelegramProfileData();
  if (tg) {
    return {
      profileId: tg.profileId,
      displayUsername: tg.username,
      syncUsernameFromTelegram: tg.username,
    };
  }
  return {
    profileId: getOrCreateLocalProfileId(),
    displayUsername: "local",
    syncUsernameFromTelegram: null,
  };
}

async function ensureProfile(): Promise<Profile> {
  const { profileId, displayUsername, syncUsernameFromTelegram } =
    resolveProfileIdentity();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .single();

  if (data) {
    let p = normalizeProfileRow(data);

    if (
      syncUsernameFromTelegram &&
      p.username !== syncUsernameFromTelegram
    ) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ username: syncUsernameFromTelegram })
        .eq("id", profileId);

      if (!updateError) {
        p = { ...p, username: syncUsernameFromTelegram };
      }
    }

    return p;
  }

  const noRow =
    error?.code === "PGRST116" ||
    (typeof error?.message === "string" && error.message.toLowerCase().includes("0 rows"));

  if (!noRow) {
    throw new Error(error?.message ?? "Failed to load profile");
  }

  const { data: created, error: createError } = await supabase
    .from("profiles")
    .insert({
      id: profileId,
      username: displayUsername,
      balance: defaultProfileBalance,
      created_at: getNowIso(),
    })
    .select("*")
    .single();

  if (createError) {
    throw new Error(createError.message);
  }

  return normalizeProfileRow(created);
}

function sortOutcomes(outcomes: Outcome[]) {
  return outcomes.slice().sort((a, b) => a.sort_order - b.sort_order);
}

async function attachOutcomes(events: Event[]): Promise<Event[]> {
  if (events.length === 0) return [];

  const eventIds = events.map((e) => e.id);
  const { data: outcomes, error } = await supabase
    .from("outcomes")
    .select("*")
    .in("event_id", eventIds)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const byEventId: Record<string, Outcome[]> = {};
  for (const o of outcomes ?? []) {
    const out = o as unknown as Outcome & { sort_order?: unknown };
    const sortOrder =
      typeof out.sort_order === "string" ? Number(out.sort_order) : out.sort_order;
    const normalized: Outcome = {
      ...out,
      sort_order: sortOrder as number,
    };

    if (!byEventId[normalized.event_id]) byEventId[normalized.event_id] = [];
    byEventId[normalized.event_id].push(normalized);
  }

  return events.map((e) => ({
    ...e,
    outcomes: sortOutcomes(byEventId[e.id] ?? []),
  }));
}

export async function getProfile() {
  return ensureProfile();
}

export async function refreshProfile() {
  return ensureProfile();
}

export async function listEvents() {
  const { data: events, error } = await supabase
    .from("events")
    .select("*")
    .in("status", ["open", "closed"])
    .order("closes_at", { ascending: true });

  if (error) throw new Error(error.message);

  const safeEvents = (events ?? []) as Event[];
  return attachOutcomes(safeEvents);
}

export async function listMyEvents(profileId: string) {
  const { data: events, error } = await supabase
    .from("events")
    .select("*")
    .eq("creator_id", profileId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const safeEvents = (events ?? []) as Event[];
  return attachOutcomes(safeEvents);
}

export async function listMyRelatedEvents(profileId: string) {
  const [createdEvents, bets] = await Promise.all([
    listMyEvents(profileId),
    supabase
      .from("bets")
      .select("event_id")
      .eq("user_id", profileId),
  ]);

  const { data: betRows, error: betsError } = bets;
  if (betsError) throw new Error(betsError.message);

  const relatedById = new Map(createdEvents.map((event) => [event.id, event]));
  const betEventIds = Array.from(
    new Set((betRows ?? []).map((row) => row.event_id).filter(Boolean)),
  );

  if (betEventIds.length > 0) {
    const { data: participatedEvents, error: eventsError } = await supabase
      .from("events")
      .select("*")
      .in("id", betEventIds)
      .order("created_at", { ascending: false });

    if (eventsError) throw new Error(eventsError.message);

    const safeParticipatedEvents = await attachOutcomes((participatedEvents ?? []) as Event[]);
    for (const event of safeParticipatedEvents) {
      relatedById.set(event.id, event);
    }
  }

  return Array.from(relatedById.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export async function getEventById(id: string) {
  const { data: event, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    const isNoRow =
      error.code === "PGRST116" ||
      (typeof error.message === "string" && error.message.toLowerCase().includes("0 rows"));
    if (isNoRow) return null;
    throw new Error(error.message);
  }

  const { data: outcomes, error: outError } = await supabase
    .from("outcomes")
    .select("*")
    .eq("event_id", id)
    .order("sort_order", { ascending: true });

  if (outError) throw new Error(outError.message);

  const normalizedOutcomes = (outcomes ?? []).map((o) => {
    const out = o as unknown as Outcome;
    return {
      ...out,
      sort_order: typeof out.sort_order === "string" ? Number(out.sort_order) : out.sort_order,
    };
  });

  return {
    ...(event as Event),
    outcomes: sortOutcomes(normalizedOutcomes),
  };
}

export async function listBetsByEventId(eventId: string) {
  const { data: bets, error } = await supabase
    .from("bets")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (bets ?? []).map((b) => {
    const bet = b as unknown as Bet & { amount?: unknown };
    const amount = typeof bet.amount === "string" ? Number(bet.amount) : bet.amount;
    return {
      ...bet,
      amount: amount as number,
    };
  }) as Bet[];
}

export async function createEvent(input: {
  title: string;
  description: string | null;
  closesAtIso: string;
  outcomeLabels: string[];
}) {
  const profile = await ensureProfile();

  const eventId = nanoid();
  const createdAt = getNowIso();

  const outcomes: Outcome[] = input.outcomeLabels.map((label, i) => ({
    id: nanoid(),
    event_id: eventId,
    label,
    sort_order: i,
  }));

  const nowMs = Date.now();
  const closesMs = new Date(input.closesAtIso).getTime();
  const status: EventStatus =
    Number.isFinite(closesMs) && closesMs > nowMs ? "open" : "closed";

  const { error: eventError } = await supabase.from("events").insert({
    id: eventId,
    creator_id: profile.id,
    title: input.title,
    description: input.description,
    closes_at: input.closesAtIso,
    status,
    winning_outcome_id: null,
    created_at: createdAt,
  });

  if (eventError) throw new Error(eventError.message);

  const { error: outcomesError } = await supabase.from("outcomes").insert(
    outcomes.map((o) => ({
      id: o.id,
      event_id: o.event_id,
      label: o.label,
      sort_order: o.sort_order,
    })),
  );

  if (outcomesError) throw new Error(outcomesError.message);

  const { error: notifyError, data: notifyData } = await supabase.functions.invoke(
    "notify-event-created",
    {
      body: {
        eventId,
        title: input.title,
        description: input.description,
        closesAtIso: input.closesAtIso,
        outcomeLabels: input.outcomeLabels,
        creatorUsername: profile.username,
      },
    },
  );

  const notificationSent = !notifyError && notifyData?.ok !== false;

  return {
    eventId,
    notificationSent,
    notificationError: notifyError?.message ?? (notificationSent ? null : "notify_failed"),
  };
}

export async function closeEventEarly(eventId: string) {
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id,status")
    .eq("id", eventId)
    .single();

  if (eventError) {
    const isNoRow =
      eventError.code === "PGRST116" ||
      (typeof eventError.message === "string" &&
        eventError.message.toLowerCase().includes("0 rows"));
    if (isNoRow) return { ok: false as const, error: "not_found" };
    throw new Error(eventError.message);
  }

  if (event.status !== "open") return { ok: false as const, error: "not_open" };

  const { error: updateError } = await supabase
    .from("events")
    .update({ status: "closed" })
    .eq("id", eventId);

  if (updateError) throw new Error(updateError.message);

  return { ok: true as const };
}

export async function settleEvent(eventId: string, winningOutcomeId: string) {
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id,status")
    .eq("id", eventId)
    .single();

  if (eventError) {
    const isNoRow =
      eventError.code === "PGRST116" ||
      (typeof eventError.message === "string" &&
        eventError.message.toLowerCase().includes("0 rows"));
    if (isNoRow) return { ok: false as const, error: "not_found" };
    throw new Error(eventError.message);
  }

  if (event.status !== "open" && event.status !== "closed") {
    return { ok: false as const, error: "already_settled" };
  }

  const { data: bets, error: betsError } = await supabase
    .from("bets")
    .select("*")
    .eq("event_id", eventId);

  if (betsError) throw new Error(betsError.message);

  const safeBets = (bets ?? []) as Bet[];
  const total = safeBets.reduce((sum, b) => sum + Number(b.amount), 0);
  const winnerSum = safeBets
    .filter((b) => b.outcome_id === winningOutcomeId)
    .reduce((sum, b) => sum + Number(b.amount), 0);

  const creditedByUser = new Map<string, number>();

  if (winnerSum > 0) {
    for (const b of safeBets) {
      if (b.outcome_id !== winningOutcomeId) continue;
      const payout = Math.floor((Number(b.amount) * total) / winnerSum);
      creditedByUser.set(
        b.user_id,
        (creditedByUser.get(b.user_id) ?? 0) + payout,
      );
    }
  }

  const userIds = Array.from(creditedByUser.keys());

  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id,balance")
      .in("id", userIds);

    if (profilesError) throw new Error(profilesError.message);

    const updates = (profiles ?? []).map((p) => {
      const add = creditedByUser.get(p.id) ?? 0;
      const currentBalance = typeof p.balance === "string" ? Number(p.balance) : p.balance;
      return supabase
        .from("profiles")
        .update({ balance: currentBalance + add })
        .eq("id", p.id);
    });

    await Promise.all(updates);
  }

  const { error: eventUpdateError } = await supabase
    .from("events")
    .update({ status: "settled", winning_outcome_id: winningOutcomeId })
    .eq("id", eventId);

  if (eventUpdateError) throw new Error(eventUpdateError.message);

  return { ok: true as const };
}

export async function placeBet(input: {
  eventId: string;
  outcomeId: string;
  amount: number;
}) {
  const profile = await ensureProfile();

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id,status,closes_at")
    .eq("id", input.eventId)
    .single();

  if (eventError) {
    const isNoRow =
      eventError.code === "PGRST116" ||
      (typeof eventError.message === "string" &&
        eventError.message.toLowerCase().includes("0 rows"));
    if (isNoRow) return { ok: false as const, error: "event_not_found" };
    throw new Error(eventError.message);
  }

  if (event.status !== "open") return { ok: false as const, error: "event_not_open" };

  const closesMs = new Date(event.closes_at).getTime();
  if (!Number.isFinite(closesMs) || Date.now() >= closesMs) {
    return { ok: false as const, error: "accepting_closed" };
  }

  if (
    !Number.isFinite(input.amount) ||
    input.amount <= 0 ||
    !Number.isInteger(input.amount)
  ) {
    return { ok: false as const, error: "invalid_amount" };
  }

  const { data: latestBet, error: latestError } = await supabase
    .from("bets")
    .select("outcome_id")
    .eq("event_id", input.eventId)
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) throw new Error(latestError.message);

  if (latestBet && latestBet.outcome_id !== input.outcomeId) {
    return {
      ok: false as const,
      error: "Можно ставить только на один исход в каждом событии",
    };
  }

  if (profile.balance < input.amount) {
    return { ok: false as const, error: "not_enough_balance" };
  }

  const bet: Bet = {
    id: nanoid(),
    user_id: profile.id,
    event_id: input.eventId,
    outcome_id: input.outcomeId,
    amount: input.amount,
    created_at: getNowIso(),
  };

  const { error: betError } = await supabase.from("bets").insert({
    id: bet.id,
    user_id: bet.user_id,
    event_id: bet.event_id,
    outcome_id: bet.outcome_id,
    amount: bet.amount,
    created_at: bet.created_at,
  });

  if (betError) throw new Error(betError.message);

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ balance: profile.balance - input.amount })
    .eq("id", profile.id);

  if (profileError) throw new Error(profileError.message);

  return { ok: true as const };
}

export async function setProfile(input: { username: string | null; balance: number }) {
  const profile = await ensureProfile();

  const { error } = await supabase
    .from("profiles")
    .update({
      username: input.username,
      balance: input.balance,
    })
    .eq("id", profile.id);

  if (error) throw new Error(error.message);
}

