import { useCallback, useEffect, useState } from "react";
import { refreshProfile } from "@/lib/mockApi";
import type { Profile } from "@/types/local";

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const next = await refreshProfile();
    setProfile(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void refresh();
    });
  }, [refresh]);

  return { profile, loading, refresh };
}
