import { useCallback, useEffect, useRef, useState } from "react";
import { getLiveGame, subscribeLiveGame } from "../../services/api";
import type { LiveGameView } from "../../types";

/**
 * The game as this person sees it, kept current: Realtime tells us when it
 * changes, and a slow poll covers dropped connections on weak networks.
 */
export function useLiveGame(gameId: string) {
  const [game, setGame] = useState<LiveGameView | null>(null);
  const [missing, setMissing] = useState(false);
  const pending = useRef<number | undefined>(undefined);
  const latest = useRef(0);

  const refresh = useCallback(() => {
    const ticket = ++latest.current;
    getLiveGame(gameId)
      .then((view) => {
        // Only the newest answer counts if several overlap.
        if (ticket === latest.current) setGame(view);
      })
      .catch(() => setMissing(true));
  }, [gameId]);

  useEffect(() => {
    refresh();
    const unsubscribe = subscribeLiveGame(gameId, () => {
      window.clearTimeout(pending.current);
      pending.current = window.setTimeout(refresh, 120);
    });
    const poll = window.setInterval(refresh, 5000);
    return () => {
      unsubscribe();
      window.clearInterval(poll);
      window.clearTimeout(pending.current);
    };
  }, [gameId, refresh]);

  return { game, missing, refresh, setGame };
}
