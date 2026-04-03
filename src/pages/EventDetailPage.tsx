import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  closeEventEarly,
  getEventById,
  listBetsByEventId,
  placeBet as placeBetApi,
  settleEvent,
} from "@/lib/mockApi";
import { useProfile } from "@/hooks/useProfile";
import type { Bet, Event } from "@/types/local";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const money = new Intl.NumberFormat("ru-RU");

function formatUtc(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatEventStatus(status: string) {
  switch (status) {
    case "open":
      return "приём";
    case "closed":
      return "закрыто";
    case "settled":
      return "рассчитано";
    case "cancelled":
      return "отменено";
    default:
      return status;
  }
}

function aggregate(bets: Bet[]): {
  total: number;
  byOutcome: Map<string, number>;
} {
  const byOutcome = new Map<string, number>();
  let total = 0;
  for (const b of bets) {
    total += b.amount;
    byOutcome.set(b.outcome_id, (byOutcome.get(b.outcome_id) ?? 0) + b.amount);
  }
  return { total, byOutcome };
}

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile, refresh: refreshProfile } = useProfile();
  const [event, setEvent] = useState<Event | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [bets, setBets] = useState<Bet[]>([]);
  const [amount, setAmount] = useState("");
  const [outcomeId, setOutcomeId] = useState<string>("");
  const [settleOpen, setSettleOpen] = useState(false);
  const [winPick, setWinPick] = useState<string>("");
  const [nowTs, setNowTs] = useState(() => Date.now());

  const load = useCallback(async () => {
    if (!id) {
      setEvent(null);
      setEventLoading(false);
      return;
    }
    setEventLoading(true);
    const ev = await getEventById(id);
    if (!ev) {
      setEvent(null);
      setEventLoading(false);
      return;
    }
    setEvent(ev);
    setOutcomeId((prev) => prev || ev.outcomes[0]?.id || "");

    const betRows = await listBetsByEventId(id);
    setBets((betRows as Bet[]) ?? []);
    setEventLoading(false);
  }, [id]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const { total, byOutcome } = useMemo(() => aggregate(bets), [bets]);

  let myOutcomeId = "";
  if (profile?.id) {
    const myBets = bets.filter((b) => b.user_id === profile.id);
    if (myBets.length > 0) {
      myOutcomeId = myBets[myBets.length - 1]?.outcome_id ?? "";
    }
  }

  const odds = useMemo(() => {
    const m = new Map<string, number | null>();
    if (!event?.outcomes) return m;
    for (const o of event.outcomes) {
      const pi = byOutcome.get(o.id) ?? 0;
      if (pi <= 0 || total <= 0) m.set(o.id, null);
      else m.set(o.id, total / pi);
    }
    return m;
  }, [event, byOutcome, total]);

  const closesMs = event ? new Date(event.closes_at).getTime() : 0;
  const accepting = event?.status === "open" && nowTs < closesMs;

  const myBets = profile?.id
    ? bets.filter((b) => b.user_id === profile.id)
    : [];
  const myWon =
    event?.status === "settled" &&
    !!event.winning_outcome_id &&
    myBets.some((b) => b.outcome_id === event.winning_outcome_id);
  const myLost =
    event?.status === "settled" &&
    myBets.length > 0 &&
    !!event.winning_outcome_id &&
    !myWon;

  const badgeText =
    event?.status === "open" && accepting
      ? "идет прием ставок"
      : event?.status === "settled" && myWon
      ? "рассчитано"
      : event?.status === "settled" && myLost
      ? "рассчитано"
      : event
      ? formatEventStatus(event.status)
      : "";

  const badgeClassName =
    event?.status === "open" && accepting
      ? "border-yellow-600 bg-yellow-500/10 text-yellow-700 dark:border-yellow-500 dark:bg-yellow-400/15 dark:text-yellow-300"
      : event?.status === "settled" && myWon
      ? "border-green-600 bg-green-500/10 text-green-700 dark:border-green-500 dark:bg-green-400/15 dark:text-green-300"
      : event?.status === "settled" && myLost
      ? "border-red-600 bg-red-500/10 text-red-700 dark:border-red-500 dark:bg-red-400/15 dark:text-red-300"
      : "";

  const badgeVariant =
    event?.status === "settled" || (event?.status === "open" && accepting)
      ? "outline"
      : "secondary";

  const canSettle =
    event &&
    profile &&
    event.creator_id === profile.id &&
    event.status !== "settled" &&
    event.status !== "cancelled" &&
    (event.status === "closed" || nowTs >= closesMs);

  async function placeBet() {
    const pickedOutcomeId = myOutcomeId || outcomeId;
    if (!id || !pickedOutcomeId) return;
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
      toast.error("Введите целое положительное число прокодиков");
      return;
    }
    const r = await placeBetApi({
      eventId: id,
      outcomeId: pickedOutcomeId,
      amount: Math.floor(n),
    });

    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Ставка принята");
    setAmount("");
    await load();
    await refreshProfile();
  }

  async function closeEarly() {
    if (!id) return;
    const r = await closeEventEarly(id);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Приём ставок закрыт");
    await load();
  }

  async function settle() {
    if (!id || !winPick) return;
    const r = await settleEvent(id, winPick);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Расчёт выполнен");
    setSettleOpen(false);
    await load();
    await refreshProfile();
  }

  if (eventLoading) {
    return <p className="text-sm text-muted-foreground">Загрузка…</p>;
  }

  if (event === null) {
    return (
      <p className="text-sm text-destructive">
        Событие не найдено.{" "}
        <Link to="/" className="underline">
          На главную
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <Link
        to="/"
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        ← Все события
      </Link>
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-2xl font-semibold leading-tight">
            {event.title}
          </h1>
          <Badge variant={badgeVariant} className={badgeClassName}>
            {badgeText}
          </Badge>
        </div>
        {event.description ? (
          <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
            {event.description}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">
          Приём ставок до {formatUtc(event.closes_at)} (МСК)
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Пул и коэффициенты</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Всего в пуле:{" "}
            <span className="font-medium tabular-nums">
              {money.format(total)}
            </span>{" "}
            прокодиков
          </p>
          <Separator />
          <ul className="space-y-2">
            {event.outcomes.map((o) => {
              const stake = byOutcome.get(o.id) ?? 0;
              const odd = odds.get(o.id);
              return (
                <li
                  key={o.id}
                  className="flex flex-wrap items-baseline justify-between gap-2"
                >
                  <span className="font-medium">{o.label}</span>
                  <span className="text-muted-foreground tabular-nums">
                    ставок: {money.format(stake)}
                    {odd != null ? (
                      <>
                        {" "}
                        · коэф.{" "}
                        <span className="text-foreground">
                          {odd.toFixed(2)}
                        </span>
                      </>
                    ) : (
                      " · коэф. —"
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {accepting ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Сделать ставку</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="outcome">Исход</Label>
              <select
                id="outcome"
                className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                value={myOutcomeId || outcomeId}
                onChange={(e) => setOutcomeId(e.target.value)}
              >
                {event.outcomes.map((o) => (
                  <option
                    key={o.id}
                    value={o.id}
                    disabled={!!myOutcomeId && o.id !== myOutcomeId}
                  >
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amt">Сумма (прокодики)</Label>
              <Input
                id="amt"
                inputMode="numeric"
                placeholder="100"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            {profile ? (
              <p className="text-xs text-muted-foreground">
                Баланс: {money.format(profile.balance)} прокодиков
              </p>
            ) : null}
            <Button
              className="w-full min-h-11"
              type="button"
              onClick={placeBet}
            >
              Поставить
            </Button>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          Приём ставок завершён. Коэффициенты выше — на момент последней ставки
          в списке.
        </p>
      )}

      {profile && event.creator_id === profile.id ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Создатель</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {event.status === "open" && nowTs < closesMs ? (
              <Button variant="secondary" type="button" onClick={closeEarly}>
                Закрыть приём досрочно
              </Button>
            ) : null}
            {canSettle ? (
              <>
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    const first = event.outcomes[0]?.id ?? "";
                    setWinPick((w) => w || first);
                    setSettleOpen(true);
                  }}
                >
                  Указать победивший исход
                </Button>
                <Dialog open={settleOpen} onOpenChange={setSettleOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Расчёт париматча</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                      <Label htmlFor="win">Победивший исход</Label>
                      <select
                        id="win"
                        className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                        value={winPick || event.outcomes[0]?.id}
                        onChange={(e) => setWinPick(e.target.value)}
                      >
                        {event.outcomes.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <DialogFooter>
                      <Button type="button" onClick={settle}>
                        Рассчитать
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
