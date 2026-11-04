import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Arrival, Game, Player, PlayerLocation, ScoreEvent, Stage, Team } from '../lib/types';

export interface GameState {
  game: Game | null;
  players: Player[];
  teams: Team[];
  stages: Stage[]; // empty for non-hosts (row level security hides them)
  arrivals: Arrival[];
  scores: ScoreEvent[];
  locations: Record<string, PlayerLocation>;
  online: Set<string>;
  connected: boolean;
  loading: boolean;
  error: string | null;
}

type Table = 'games' | 'players' | 'teams' | 'stages' | 'arrivals' | 'score_events' | 'locations';

const empty: GameState = {
  game: null, players: [], teams: [], stages: [], arrivals: [], scores: [], locations: {},
  online: new Set(), connected: false, loading: true, error: null,
};

/**
 * Loads everything for one game and keeps it in sync with Supabase Realtime.
 * Presence (who has the app open right now) is tracked on the same channel.
 */
export function useGame(gameId: string, myPlayerId: string) {
  const [state, setState] = useState<GameState>(empty);
  const timers = useRef<Partial<Record<Table, number>>>({});

  const fetchTable = useCallback(async (table: Table) => {
    if (table === 'games') {
      const { data, error } = await supabase.from('games').select('*').eq('id', gameId).maybeSingle();
      if (error) return setState((s) => ({ ...s, error: error.message }));
      setState((s) => ({ ...s, game: data as Game | null }));
    } else if (table === 'players') {
      const { data } = await supabase.from('players').select('*').eq('game_id', gameId).order('created_at');
      if (data) setState((s) => ({ ...s, players: data as Player[] }));
    } else if (table === 'teams') {
      const { data } = await supabase.from('teams').select('*').eq('game_id', gameId).order('created_at');
      if (data) setState((s) => ({ ...s, teams: data as Team[] }));
    } else if (table === 'stages') {
      const { data } = await supabase.from('stages').select('*').eq('game_id', gameId).order('position').order('created_at');
      if (data) setState((s) => ({ ...s, stages: data as Stage[] }));
    } else if (table === 'arrivals') {
      const { data } = await supabase.from('arrivals').select('*').eq('game_id', gameId).order('created_at');
      if (data) setState((s) => ({ ...s, arrivals: data as Arrival[] }));
    } else if (table === 'score_events') {
      const { data } = await supabase.from('score_events').select('*').eq('game_id', gameId).order('created_at');
      if (data) setState((s) => ({ ...s, scores: data as ScoreEvent[] }));
    } else if (table === 'locations') {
      const { data } = await supabase.from('locations').select('*').eq('game_id', gameId);
      if (data) {
        const map: Record<string, PlayerLocation> = {};
        (data as PlayerLocation[]).forEach((l) => { map[l.player_id] = l; });
        setState((s) => ({ ...s, locations: map }));
      }
    }
  }, [gameId]);

  const refresh = useCallback(async () => {
    await Promise.all((['games', 'players', 'teams', 'stages', 'arrivals', 'score_events', 'locations'] as Table[]).map(fetchTable));
    setState((s) => ({ ...s, loading: false }));
  }, [fetchTable]);

  const schedule = useCallback((table: Table) => {
    window.clearTimeout(timers.current[table]);
    timers.current[table] = window.setTimeout(() => fetchTable(table), 200);
  }, [fetchTable]);

  useEffect(() => {
    setState(empty);
    refresh();

    const channel = supabase.channel(`game-${gameId}`, { config: { presence: { key: myPlayerId } } });
    (['players', 'teams', 'stages', 'arrivals', 'score_events'] as Table[]).forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `game_id=eq.${gameId}` }, () => schedule(table));
    });
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, (payload) => {
      if (payload.eventType === 'DELETE') setState((s) => ({ ...s, game: null }));
      else setState((s) => ({ ...s, game: payload.new as Game }));
    });
    // Location updates are applied directly (no refetch) because they arrive every few seconds.
    channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'locations', filter: `game_id=eq.${gameId}` }, (p) => {
      const l = p.new as PlayerLocation;
      setState((s) => ({ ...s, locations: { ...s.locations, [l.player_id]: l } }));
    });
    channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'locations', filter: `game_id=eq.${gameId}` }, (p) => {
      const l = p.new as PlayerLocation;
      setState((s) => ({ ...s, locations: { ...s.locations, [l.player_id]: l } }));
    });
    // Delete events can't be filtered by game, so we check the id ourselves.
    channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'locations' }, (p) => {
      const id = (p.old as { player_id?: string }).player_id;
      if (!id) return;
      setState((s) => {
        if (!s.locations[id]) return s;
        const next = { ...s.locations };
        delete next[id];
        return { ...s, locations: next };
      });
    });
    channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'players' }, () => schedule('players'));
    channel.on('presence', { event: 'sync' }, () => {
      setState((s) => ({ ...s, online: new Set(Object.keys(channel.presenceState())) }));
    });
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        setState((s) => ({ ...s, connected: true }));
        await channel.track({ at: Date.now() });
        refresh(); // catch anything we missed while connecting
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        setState((s) => ({ ...s, connected: false }));
      }
    });

    // Safety net: refetch periodically and when the phone comes back online / to the foreground.
    const poll = window.setInterval(refresh, 30000);
    const onWake = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', onWake);

    // Heartbeat so the host can see when each player last had the app open.
    const beat = () => supabase.from('players').update({ last_seen: new Date().toISOString() }).eq('id', myPlayerId).then(() => undefined);
    beat();
    const heartbeat = window.setInterval(beat, 30000);

    return () => {
      window.clearInterval(poll);
      window.clearInterval(heartbeat);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', onWake);
      Object.values(timers.current).forEach((t) => window.clearTimeout(t));
      supabase.removeChannel(channel);
    };
  }, [gameId, myPlayerId, refresh, schedule]);

  return { ...state, refresh };
}

export type GameData = ReturnType<typeof useGame>;
