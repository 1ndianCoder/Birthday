import { useCallback, useEffect, useRef, useState } from 'react';
import { rpc, supabase } from '../lib/supabase';
import type { ArrivalResult, Game, Player } from '../lib/types';

export type ShareStatus = 'off' | 'starting' | 'live' | 'denied' | 'unavailable' | 'error';

const SEND_EVERY_MS = 5000;
const AUTO_CHECK_EVERY_MS = 10000;

interface Options {
  game: Game | null;
  me: Player | null;
  /** Auto-check arrival on every fix (players only). */
  autoCheck: boolean;
  onArrivalResult?: (r: ArrivalResult) => void;
}

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('This browser has no location support'));
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  });
}

export function geoErrorText(e: unknown): string {
  const err = e as GeolocationPositionError;
  if (err && err.code === 1) {
    return 'Location permission is blocked. On iPhone: Settings › Privacy & Security › Location Services › Safari Websites › While Using the App. Then reload this page.';
  }
  if (err && err.code === 2) return 'Your phone can’t find its position right now. Move away from tall buildings or out of the station.';
  if (err && err.code === 3) return 'Finding your position took too long. Try again in the open.';
  return err?.message || 'Location is not available';
}

/**
 * Location sharing that only runs when:
 *  - the player has switched it on themselves (after an explicit consent screen), and
 *  - the game is active or paused.
 * It stops automatically when the game ends, and can be paused at any time.
 */
export function useLocationSharing({ game, me, autoCheck, onArrivalResult }: Options) {
  const [status, setStatus] = useState<ShareStatus>('off');
  const [error, setError] = useState<string | null>(null);
  const [lastFix, setLastFix] = useState<GeolocationPosition | null>(null);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const watchId = useRef<number | null>(null);
  const latest = useRef<GeolocationPosition | null>(null);
  const lastSent = useRef(0);
  const lastCheck = useRef(0);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);
  const cb = useRef(onArrivalResult);
  cb.current = onArrivalResult;

  const gameRunning = game?.status === 'active' || game?.status === 'paused';
  const wantsToShare = Boolean(me?.sharing_location && gameRunning);

  const send = useCallback(async (pos: GeolocationPosition) => {
    if (!me || !game) return;
    lastSent.current = Date.now();
    const { error: e } = await supabase.from('locations').upsert({
      player_id: me.id,
      game_id: game.id,
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: Math.round(pos.coords.accuracy),
      fix_at: new Date(pos.timestamp).toISOString(),
    });
    if (!e) setLastSentAt(Date.now());
  }, [me, game]);

  const checkArrival = useCallback(async (pos: GeolocationPosition): Promise<ArrivalResult | null> => {
    if (!game) return null;
    try {
      const r = await rpc<ArrivalResult>('check_arrival', {
        p_game: game.id, p_lat: pos.coords.latitude, p_lng: pos.coords.longitude, p_accuracy: pos.coords.accuracy,
      });
      cb.current?.(r);
      return r;
    } catch {
      return null;
    }
  }, [game]);

  const stopWatch = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    wakeLock.current?.release().catch(() => undefined);
    wakeLock.current = null;
  }, []);

  const startWatch = useCallback(() => {
    if (!('geolocation' in navigator)) { setStatus('unavailable'); return; }
    if (watchId.current !== null) return;
    setStatus('starting');
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        latest.current = pos;
        setLastFix(pos);
        setStatus('live');
        setError(null);
        if (Date.now() - lastSent.current >= SEND_EVERY_MS) send(pos);
      },
      (err) => {
        setError(geoErrorText(err));
        setStatus(err.code === 1 ? 'denied' : 'error');
      },
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 30000 },
    );
    if (localStorage.getItem('manhunt-keep-awake') === '1' && 'wakeLock' in navigator) {
      (navigator as unknown as { wakeLock: { request: (t: string) => Promise<{ release: () => Promise<void> }> } })
        .wakeLock.request('screen').then((l) => { wakeLock.current = l; }).catch(() => undefined);
    }
  }, [send]);

  // Start/stop the watcher when consent or game state changes.
  useEffect(() => {
    if (wantsToShare) startWatch();
    else { stopWatch(); setStatus('off'); }
    return undefined;
  }, [wantsToShare, startWatch, stopWatch]);

  useEffect(() => () => stopWatch(), [stopWatch]);

  // Every 5 seconds re-send the newest fix (iPhones don't fire updates while standing still),
  // and periodically ask the server whether we've arrived.
  useEffect(() => {
    if (!wantsToShare) return;
    const t = window.setInterval(() => {
      const pos = latest.current;
      if (!pos) return;
      if (Date.now() - pos.timestamp > 120000) return; // don't keep re-sending a fix older than 2 minutes
      if (Date.now() - lastSent.current >= SEND_EVERY_MS - 300) send(pos);
      if (autoCheck && game?.status === 'active' && Date.now() - lastCheck.current >= AUTO_CHECK_EVERY_MS) {
        lastCheck.current = Date.now();
        checkArrival(pos);
      }
    }, 1000);
    return () => window.clearInterval(t);
  }, [wantsToShare, autoCheck, game?.status, send, checkArrival]);

  // iOS pauses location in the background; restart the watcher when the app comes back.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && wantsToShare) { stopWatch(); startWatch(); }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [wantsToShare, startWatch, stopWatch]);

  /** Call only after the player has accepted the consent screen. */
  const enable = useCallback(async () => {
    if (!me) return;
    setError(null);
    setStatus('starting');
    try {
      await getPosition(); // triggers the iPhone permission prompt from a tap
    } catch (e) {
      setError(geoErrorText(e));
      setStatus((e as GeolocationPositionError)?.code === 1 ? 'denied' : 'error');
      return;
    }
    const { error: e } = await supabase.from('players').update({
      sharing_location: true,
      location_consent_at: me.location_consent_at ?? new Date().toISOString(),
    }).eq('id', me.id);
    if (e) { setError(e.message); setStatus('error'); }
  }, [me]);

  const pause = useCallback(async () => {
    if (!me) return;
    stopWatch();
    setStatus('off');
    await supabase.from('locations').delete().eq('player_id', me.id);
    await supabase.from('players').update({ sharing_location: false }).eq('id', me.id);
  }, [me, stopWatch]);

  /** One-off "I'm here" check. Works even while map sharing is paused — the position isn't stored. */
  const checkIn = useCallback(async (): Promise<ArrivalResult> => {
    let pos = latest.current && Date.now() - latest.current.timestamp < 8000 ? latest.current : null;
    if (!pos) pos = await getPosition();
    lastCheck.current = Date.now();
    const r = await checkArrival(pos);
    if (!r) throw new Error('Could not reach the game server. Check your signal and try again.');
    return r;
  }, [checkArrival]);

  return { status, error, lastFix, lastSentAt, enable, pause, checkIn, gameRunning };
}

export type LocationSharing = ReturnType<typeof useLocationSharing>;
