import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listEvents } from "@/lib/mockApi";
import type { Event } from "@/types/local";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export function EventsListPage() {
  const [rows, setRows] = useState<Event[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setErr(null);
    }
    try {
      const data = await listEvents();
      setRows(data ?? []);
    } catch (e) {
      if (!silent) {
        setErr(e instanceof Error ? e.message : "unknown_error");
      }
      setRows([]);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  useEffect(() => {
    let inFlight = false;
    const refreshLiveData = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        await load({ silent: true });
      } finally {
        inFlight = false;
      }
    };

    const t = setInterval(() => {
      void refreshLiveData();
    }, 2000);

    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (rows === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (err) {
    return (
      <p className="text-sm text-destructive">
        Не удалось загрузить события: {err}
      </p>
    );
  }

  const sortedRows = [...rows].sort((a, b) => {
    const aCloseTs = new Date(a.closes_at).getTime();
    const bCloseTs = new Date(b.closes_at).getTime();
    const aAccepting = a.status === "open" && aCloseTs > nowTs;
    const bAccepting = b.status === "open" && bCloseTs > nowTs;

    if (aAccepting !== bAccepting) {
      return aAccepting ? -1 : 1;
    }

    const aDistance = Math.abs(aCloseTs - nowTs);
    const bDistance = Math.abs(bCloseTs - nowTs);

    return aDistance - bDistance;
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">События</h1>
        <p className="text-sm text-muted-foreground">
          Париматч на прокодики. Коэффициент растёт, когда на исход ставят меньше.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Пока нет открытых событий.</p>
      ) : (
        <ul className="space-y-3">
          {sortedRows.map((e) => {
            const accepting =
              e.status === "open" && nowTs < new Date(e.closes_at).getTime();

            const badgeText = accepting ? "идет прием ставок" : "ставок больше нет";
            const badgeClassName = accepting
              ? "border-yellow-600 bg-yellow-500/10 text-yellow-700 dark:border-yellow-500 dark:bg-yellow-400/15 dark:text-yellow-300"
              : "";
            const badgeVariant = accepting ? "outline" : "default";

            return (
            <li key={e.id}>
              <Link to={`/events/${e.id}`}>
                <Card className="transition-colors hover:bg-muted/40">
                  <CardHeader className="gap-1 pb-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <CardTitle className="text-lg leading-snug">{e.title}</CardTitle>
                      <Badge
                        variant={e.status === "open" ? badgeVariant : "secondary"}
                        className={e.status === "open" ? badgeClassName : undefined}
                      >
                        {e.status === "open" ? badgeText : "закрыто"}
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
                    <p className="text-xs text-muted-foreground">
                      Исходов: {e.outcomes?.length ?? 0}
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
