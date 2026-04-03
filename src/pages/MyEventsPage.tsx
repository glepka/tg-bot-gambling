import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { listBetsByEventId, listMyEvents } from "@/lib/mockApi";
import type { Bet, Event } from "@/types/local";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

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

export function MyEventsPage() {
  const { profile, loading: profLoading } = useProfile();
  const [rows, setRows] = useState<Event[] | null>(null);
  const [betsByEventId, setBetsByEventId] = useState<Record<string, Bet[]>>({});
  const [nowTs, setNowTs] = useState(() => Date.now());

  const load = useCallback(async () => {
    if (!profile?.id) {
      setRows([]);
      setBetsByEventId({});
      return;
    }
    const data = await listMyEvents(profile.id);
    const betRowsByEvent = await Promise.all(
      (data ?? []).map((e) => listBetsByEventId(e.id))
    );

    const map: Record<string, Bet[]> = {};
    for (let i = 0; i < (data ?? []).length; i += 1) {
      map[(data ?? [])[i].id] = (betRowsByEvent[i] as Bet[]) ?? [];
    }

    setBetsByEventId(map);
    setRows(data ?? []);
  }, [profile]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (profLoading || rows === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!profile) {
    return <p className="text-sm text-muted-foreground">Профиль недоступен.</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Мои события</h1>
        <p className="text-sm text-muted-foreground">
          Создатель: {profile.username ?? "—"} · баланс{" "}
          {new Intl.NumberFormat("ru-RU").format(profile.balance)} прокодиков
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Вы ещё не создавали событий.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((e) => {
            const accepting =
              e.status === "open" && nowTs < new Date(e.closes_at).getTime();
            const eventBets = betsByEventId[e.id] ?? [];
            const myWon =
              e.status === "settled" &&
              !!e.winning_outcome_id &&
              eventBets.some((b) => b.outcome_id === e.winning_outcome_id);
            const myLost =
              e.status === "settled" &&
              eventBets.length > 0 &&
              !!e.winning_outcome_id &&
              !myWon;

            const badgeText =
              e.status === "open" && accepting
                ? "идет прием ставок"
                : e.status === "settled" && myWon
                ? "рассчитано · победил"
                : e.status === "settled" && myLost
                ? "рассчитано · проиграл"
                : formatEventStatus(e.status);

            const badgeClassName =
              e.status === "open" && accepting
                ? "border-yellow-600 bg-yellow-500/10 text-yellow-700 dark:border-yellow-500 dark:bg-yellow-400/15 dark:text-yellow-300"
                : e.status === "settled" && myWon
                ? "border-green-600 bg-green-500/10 text-green-700 dark:border-green-500 dark:bg-green-400/15 dark:text-green-300"
                : e.status === "settled" && myLost
                ? "border-red-600 bg-red-500/10 text-red-700 dark:border-red-500 dark:bg-red-400/15 dark:text-red-300"
                : "";

            const badgeVariant =
              e.status === "settled" || (e.status === "open" && accepting)
                ? "outline"
                : "outline";

            return (
              <li key={e.id}>
                <Link to={`/events/${e.id}`}>
                  <Card className="transition-colors hover:bg-muted/40">
                    <CardHeader className="gap-1 pb-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <CardTitle className="text-lg leading-snug">
                          {e.title}
                        </CardTitle>
                        <Badge
                          variant={badgeVariant}
                          className={badgeClassName}
                        >
                          {badgeText}
                        </Badge>
                      </div>
                      {e.description ? (
                        <CardDescription className="line-clamp-2">
                          {e.description}
                        </CardDescription>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        Приём до {formatUtc(e.closes_at)} (МСК)
                      </p>
                    </CardHeader>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
