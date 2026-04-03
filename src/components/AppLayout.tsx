import { Link, Outlet, useLocation } from "react-router-dom";
import { CalendarPlus, Home, User } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "События", icon: Home },
  { to: "/create", label: "Создать", icon: CalendarPlus },
  { to: "/my", label: "Мои", icon: User },
];

export function AppLayout() {
  const loc = useLocation();

  return (
    <div className="flex min-h-dvh flex-col bg-background pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] pt-[env(safe-area-inset-top,0px)]">
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4">
        <Outlet />
      </main>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around gap-1 px-2 py-2">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = loc.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex min-h-12 min-w-[4.5rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg text-xs font-medium transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
