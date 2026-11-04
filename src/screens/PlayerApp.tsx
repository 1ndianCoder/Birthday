import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameData } from '../hooks/useGame';
import { useLocationSharing } from '../hooks/useLocationSharing';
import { buildLeaderboard } from '../lib/leaderboard';
import { time } from '../lib/format';
import { errMsg, rpc } from '../lib/supabase';
import type { ArrivalResult, ClueView, Game, Player, PlayerView } from '../lib/types';
import { MapView, type Waypoint } from '../components/MapView';
import { ConsentSheet, Leaderboard, LocationControl, MissionComplete, Progress, SafetyPanel, UnlockOverlay } from '../components/game';
import { Avatar, Button, Icons, Pill, TabBar, useNow, useToast } from '../components/ui';
import { GameHeader } from './GameHeader';

type Tab = 'mission' | 'map' | 'ranks' | 'safety';

export function PlayerApp({ data, me, onLeave }: { data: GameData; me: Player; onLeave: () => void }) {
  const game = data.game!;
  const [tab, setTab] = useState<Tab>('mission');
  const [view, setView] = useState<PlayerView | null>(null);
  const [unlock, setUnlock] = useState<{ title: string; subtitle: string } | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const prevIndex = useRef<number | null>(null);
  const prevStatus = useRef(game.status);
  const toast = useToast();
  const now = useNow(1000);

  const myTeam = data.teams.find((t) => t.id === me.team_id) ?? null;

  const loadView = useCallback(async () => {
    try {
      const v = await rpc<PlayerView>('get_clues', { p_game: game.id });
      setView(v);
    } catch (e) {
      toast(errMsg(e), 'bad');
    }
  }, [game.id, toast]);

  // Re-fetch my clues whenever anything that could change them changes.
  const unitStage = game.mode === 'team' ? myTeam?.current_stage : me.current_stage;
  useEffect(() => { loadView(); }, [loadView, game.status, game.mode, game.reveal_finish, unitStage, me.team_id, data.arrivals.length, data.scores.length]);

  // Unlock moment when the current clue advances (or the game starts).
  useEffect(() => {
    if (!view) return;
    const idx = view.current_index;
    const started = prevStatus.current === 'lobby' && view.status === 'active';
    if ((prevIndex.current !== null && idx > prevIndex.current) || started) {
      const current = view.clues.find((c) => c.status === 'current');
      if (view.finished_at) setUnlock({ title: 'Mission complete', subtitle: 'Final destination reached' });
      else if (current) setUnlock({ title: current.title, subtitle: started ? 'The hunt has started' : `Clue ${idx + 1} unlocked` });
    }
    prevIndex.current = idx;
    prevStatus.current = view.status;
  }, [view]);

  const onArrival = useCallback((r: ArrivalResult) => {
    if (r.arrived && !r.duplicate) toast(`You found ${r.destination || 'it'}!`, 'ok');
  }, [toast]);

  const sharing = useLocationSharing({ game, me, autoCheck: me.competing, onArrivalResult: onArrival });

  const rows = useMemo(() => buildLeaderboard(game, data.players, data.teams, data.scores, data.arrivals),
    [game, data.players, data.teams, data.scores, data.arrivals]);
  const myRowId = game.mode === 'team' ? me.team_id : me.id;

  // Waypoints players are allowed to see: start, discovered destinations, and (optionally) the arcade.
  const waypoints = useMemo<Waypoint[]>(() => {
    const w: Waypoint[] = [];
    if (game.start_lat && game.start_lng) w.push({ id: 'start', lat: game.start_lat, lng: game.start_lng, label: `Start: ${game.start_name}`, kind: 'start', text: 'S' });
    view?.clues.filter((c) => c.status === 'completed' && c.lat && c.lng).forEach((c) => {
      w.push({ id: c.id, lat: c.lat!, lng: c.lng!, label: `${c.index + 1}. ${c.destination_name}`, kind: 'done', text: String(c.index + 1) });
    });
    if (view?.finish && !w.some((x) => x.lat === view.finish!.lat && x.lng === view.finish!.lng)) {
      w.push({ id: 'finish', lat: view.finish.lat, lng: view.finish.lng, label: `Final: ${view.finish.name}`, kind: 'finish', text: '🕹' });
    }
    return w;
  }, [game.start_lat, game.start_lng, game.start_name, view]);

  const requestShare = () => (me.location_consent_at ? sharing.enable() : setConsentOpen(true));
  const finished = Boolean(view?.finished_at);

  return (
    <div className="min-h-full pb-28">
      <GameHeader game={game} me={me} team={myTeam} connected={data.connected} sharingOn={me.sharing_location} />

      {game.status === 'paused' && (
        <div className="mx-auto max-w-2xl px-4 pt-3">
          <div className="rounded-2xl border border-flare/40 bg-flare/10 px-4 py-3 text-[14px] font-semibold text-flare">
            The host has paused the game. Stay where you are and wait for the restart.
          </div>
        </div>
      )}

      <main className="mx-auto max-w-2xl px-4 pt-4">
        {tab === 'mission' && (
          <MissionTab game={game} me={me} data={data} view={view} finished={finished} rows={rows} myRowId={myRowId}
            onReload={loadView} checkIn={sharing.checkIn} onRequestShare={requestShare} sharingOn={me.sharing_location} />
        )}
        {tab === 'map' && (
          <div className="space-y-3">
            <MapView className="h-[62vh] rounded-3xl border border-line" players={data.players} teams={data.teams}
              locations={data.locations} meId={me.id} waypoints={waypoints} now={now} />
            <LocationControl me={me} loc={data.locations[me.id]} sharing={sharing} onRequest={requestShare} />
            <p className="px-1 text-[12px] text-mute">Faded markers show a last known position, not a live one. Only players who chose to share appear.</p>
          </div>
        )}
        {tab === 'ranks' && (
          <div>
            <h2 className="display mb-3 text-2xl font-bold">Leaderboard</h2>
            <Leaderboard rows={rows} highlightId={myRowId} total={view?.total ?? 0} online={game.mode === 'individual' ? data.online : undefined} />
            <p className="mt-4 text-[12px] text-mute">Destination +100, challenge +{game.challenge_points}, bonus +{game.bonus_points}, hint −{game.hint_penalty}.</p>
          </div>
        )}
        {tab === 'safety' && (
          <div className="space-y-4">
            <LocationControl me={me} loc={data.locations[me.id]} sharing={sharing} onRequest={requestShare} />
            <SafetyPanel game={game} me={me} />
            <Button variant="quiet" className="w-full" onClick={() => { if (confirm('Leave this game on this phone?')) onLeave(); }}>Leave game</Button>
          </div>
        )}
      </main>

      <TabBar<Tab> value={tab} onChange={setTab} tabs={[
        { id: 'mission', label: 'Mission', icon: Icons.clue },
        { id: 'map', label: 'Map', icon: Icons.map },
        { id: 'ranks', label: 'Ranks', icon: Icons.trophy },
        { id: 'safety', label: 'Safety', icon: Icons.shield, badge: me.needs_help },
      ]} />

      <ConsentSheet open={consentOpen} onClose={() => setConsentOpen(false)} onAccept={() => { setConsentOpen(false); sharing.enable(); }} />
      {unlock && <UnlockOverlay title={unlock.title} subtitle={unlock.subtitle} onClose={() => { setUnlock(null); setTab('mission'); }} />}
    </div>
  );
}

/* ---------------- Mission tab ---------------- */
function MissionTab({ game, me, data, view, finished, rows, myRowId, onReload, checkIn, onRequestShare, sharingOn }: {
  game: Game; me: Player; data: GameData; view: PlayerView | null; finished: boolean;
  rows: ReturnType<typeof buildLeaderboard>; myRowId: string | null;
  onReload: () => void; checkIn: () => Promise<ArrivalResult>; onRequestShare: () => void; sharingOn: boolean;
}) {
  if (!view) return <div className="panel p-6 text-center text-mute">Loading your mission…</div>;

  if (game.status === 'lobby') return <Lobby game={game} me={me} data={data} />;
  if (view.no_team) return <div className="panel p-6 text-center"><p className="font-bold">Waiting for a team</p><p className="mt-1 text-mute">The host will put you in a team before the hunt starts.</p></div>;
  if (!me.competing) return <div className="panel p-6 text-center"><p className="font-bold">You’re helping, not competing</p><p className="mt-1 text-mute">The host has set you as a non-competing helper. Use the map and safety tabs.</p></div>;

  if (finished || game.status === 'ended') {
    return (
      <MissionComplete game={game} rows={rows} myRowId={myRowId} total={view.total} finishedAt={view.finished_at}
        completed={view.clues.filter((c) => c.status === 'completed').length} gameEnded={game.status === 'ended'} />
    );
  }

  const current = view.clues.find((c) => c.status === 'current');
  const done = view.clues.filter((c) => c.status === 'completed').reverse();

  return (
    <div className="space-y-4">
      <div className="panel p-4"><Progress total={view.total} current={view.current_index} finished={false} /></div>
      {current && <CurrentClue clue={current} game={game} onReload={onReload} checkIn={checkIn} sharingOn={sharingOn} onRequestShare={onRequestShare} />}
      {done.length > 0 && (
        <section>
          <h3 className="mb-2 mt-6 font-bold">Found so far</h3>
          <ol className="space-y-2">
            {done.map((c) => (
              <li key={c.id} className="panel p-4">
                <div className="flex items-start gap-3">
                  <span className="display grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-volt font-bold text-white">{c.index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">{c.destination_name}</div>
                    <div className="text-[12px] text-mute">{c.title}, found {time(c.arrived_at)}, +{c.points}{c.hint_used ? `, hint −${game.hint_penalty}` : ''}</div>
                    {c.challenge && (
                      <p className="mt-2 rounded-xl border border-flare/30 bg-flare/10 p-2.5 text-[13px]">
                        <b className="text-flare">Challenge +{game.challenge_points}:</b> {c.challenge} Show the host to collect.
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function CurrentClue({ clue, game, onReload, checkIn, sharingOn, onRequestShare }: {
  clue: ClueView; game: Game; onReload: () => void; checkIn: () => Promise<ArrivalResult>; sharingOn: boolean; onRequestShare: () => void;
}) {
  const [hintBusy, setHintBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const toast = useToast();
  const paused = game.status !== 'active';

  const takeHint = async () => {
    if (!confirm(`Use the hint? It costs ${game.hint_penalty} points.`)) return;
    setHintBusy(true);
    try { await rpc('use_hint', { p_game: game.id }); onReload(); } catch (e) { toast(errMsg(e), 'bad'); } finally { setHintBusy(false); }
  };

  const doCheck = async () => {
    setChecking(true);
    setResult(null);
    try {
      const r = await checkIn();
      if (r.arrived) { setResult(null); onReload(); return; }
      if (r.reason === 'paused') setResult('The game is paused.');
      else if (r.weak_gps) setResult('Your GPS signal is weak. Step into the open and try again, or ask the host to approve your arrival.');
      else if (r.near) setResult('Very close — you’re within about 250 m. Look around!');
      else setResult('Not here yet. Keep solving.');
    } catch (e) {
      setResult(errMsg((e as GeolocationPositionError)?.code ? 'Location is blocked or unavailable. The host can approve your arrival.' : e));
    } finally { setChecking(false); }
  };

  return (
    <article className="relative overflow-hidden rounded-3xl border border-volt/40 bg-deck">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-volt via-voltsoft to-flare" />
      <div className="p-5">
        <div className="flex items-center justify-between">
          <Pill tone="volt">Clue {clue.index + 1}</Pill>
          <span className="text-[13px] font-bold text-mute">+{clue.points} pts</span>
        </div>
        <h2 className="display mt-3 text-[28px] font-bold leading-tight">{clue.title}</h2>
        {clue.image_url && <img src={clue.image_url} alt="" className="mt-4 w-full rounded-2xl border border-line object-cover max-h-64" />}
        <p className="mt-4 whitespace-pre-line text-[17px] leading-[1.6]">{clue.riddle}</p>

        {clue.hint_used && clue.hint && (
          <div className="mt-4 rounded-2xl border border-flare/40 bg-flare/10 p-3.5">
            <div className="text-[12px] font-bold text-flare">Hint (−{game.hint_penalty})</div>
            <p className="mt-1 text-[15px]">{clue.hint}</p>
          </div>
        )}
        {clue.safety_note && <p className="mt-4 text-[13px] text-mute"><b className="text-ink">Safety:</b> {clue.safety_note}</p>}
      </div>

      <div className="border-t border-line bg-deck2/60 p-4 space-y-3">
        <Button size="lg" className="w-full" onClick={doCheck} loading={checking} disabled={paused}>I’m here — check in</Button>
        {result && <p className="text-center text-[14px] font-semibold text-voltsoft" aria-live="polite">{result}</p>}
        <div className="flex gap-2">
          {clue.has_hint && !clue.hint_used && (
            <Button variant="ghost" size="sm" className="flex-1" onClick={takeHint} loading={hintBusy} disabled={paused}>Hint (−{game.hint_penalty})</Button>
          )}
          {!sharingOn && <Button variant="ghost" size="sm" className="flex-1" onClick={onRequestShare}>Auto check-in</Button>}
        </div>
        <p className="text-[12px] text-mute text-center">
          {sharingOn ? `Arrival is checked automatically within ${clue.radius_m} m.` : `Check in within ${clue.radius_m} m of the spot. GPS playing up? The host can approve you.`}
        </p>
      </div>
    </article>
  );
}

function Lobby({ game, me, data }: { game: Game; me: Player; data: GameData }) {
  const players = data.players.filter((p) => !p.is_host);
  const host = data.players.find((p) => p.is_host);
  return (
    <div className="space-y-4">
      <div className="panel p-5 text-center">
        <p className="text-[13px] font-bold text-mute">Waiting for the host to start</p>
        <p className="display mt-2 text-4xl font-bold tracking-[.25em]">{game.code}</p>
        <p className="mt-2 text-[13px] text-mute">{game.mode === 'team' ? 'Team mode: you’ll share progress with your team.' : 'Individual mode: everyone races for themselves.'}</p>
      </div>
      <section>
        <h3 className="mb-2 font-bold">Players ({players.length})</h3>
        <ul className="grid grid-cols-2 gap-2">
          {players.map((p) => {
            const team = data.teams.find((t) => t.id === p.team_id);
            return (
              <li key={p.id} className={`panel flex items-center gap-2.5 p-3 ${p.id === me.id ? 'border-volt/50' : ''}`}>
                <Avatar emoji={p.avatar} size={36} online={data.online.has(p.id)} ring={team?.color} />
                <div className="min-w-0">
                  <div className="truncate font-bold text-[14px]">{p.username}</div>
                  <div className="text-[11px] text-mute">{data.online.has(p.id) ? 'Online' : 'Offline'}{team ? `, ${team.name}` : ''}</div>
                </div>
              </li>
            );
          })}
        </ul>
        {host && <p className="mt-3 text-[13px] text-mute">Host: {host.avatar} {host.username}</p>}
      </section>
      <div className="panel p-4 text-[14px] text-mute leading-relaxed">
        <b className="text-ink">Before you go:</b> charge your phone, check the Safety tab for contacts, and decide whether to share your location. You choose — the game asks first.
      </div>
    </div>
  );
}
