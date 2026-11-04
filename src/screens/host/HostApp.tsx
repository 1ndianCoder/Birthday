import { useMemo, useState } from 'react';
import type { GameData } from '../../hooks/useGame';
import { useLocationSharing } from '../../hooks/useLocationSharing';
import { ago, duration, LIVE_SECONDS, secondsSince } from '../../lib/format';
import { buildLeaderboard, elapsedSeconds } from '../../lib/leaderboard';
import { errMsg, rpc, supabase } from '../../lib/supabase';
import type { Game, Player, Stage, Team } from '../../lib/types';
import { MapView, type Waypoint } from '../../components/MapView';
import { ArcadeTimer, ConsentSheet, Leaderboard, LocationControl } from '../../components/game';
import { Avatar, Button, Icons, Pill, TabBar, useNow, useToast } from '../../components/ui';
import { GameHeader } from '../GameHeader';
import { RouteEditor } from './RouteEditor';
import { Settings } from './Settings';

type Tab = 'control' | 'players' | 'route' | 'map' | 'settings';

export function HostApp({ data, me, onLeave }: { data: GameData; me: Player; onLeave: () => void }) {
  const game = data.game!;
  const [tab, setTab] = useState<Tab>('control');
  const [consentOpen, setConsentOpen] = useState(false);
  const sharing = useLocationSharing({ game, me, autoCheck: false });
  const now = useNow(1000);
  const helpCount = data.players.filter((p) => p.needs_help).length;

  const waypoints = useMemo<Waypoint[]>(() => {
    const w: Waypoint[] = [];
    if (game.start_lat && game.start_lng) w.push({ id: 'start', lat: game.start_lat, lng: game.start_lng, label: `Start: ${game.start_name}`, kind: 'start', text: 'S' });
    data.stages.forEach((s, i) => {
      if (s.lat == null || s.lng == null) return;
      const last = i === data.stages.length - 1;
      w.push({ id: s.id, lat: s.lat, lng: s.lng, label: `${i + 1}. ${s.destination_name}${s.confirmed ? '' : ' (not confirmed)'}`,
        kind: last ? 'finish' : s.confirmed ? 'host-ok' : 'host', text: last ? '🕹' : String(i + 1), radius: s.radius_m });
    });
    return w;
  }, [game.start_lat, game.start_lng, game.start_name, data.stages]);

  const requestShare = () => (me.location_consent_at ? sharing.enable() : setConsentOpen(true));

  return (
    <div className="min-h-full pb-28">
      <GameHeader game={game} me={me} team={null} connected={data.connected} sharingOn={me.sharing_location} />
      {helpCount > 0 && (
        <button onClick={() => setTab('players')} className="block w-full bg-bad/90 px-4 py-2.5 text-center text-[14px] font-bold text-white">
          {helpCount} player{helpCount > 1 ? 's need' : ' needs'} help. Tap to see who.
        </button>
      )}
      <main className="mx-auto max-w-2xl px-4 pt-4">
        {tab === 'control' && <ControlTab data={data} game={game} now={now} />}
        {tab === 'players' && <PlayersTab data={data} game={game} now={now} />}
        {tab === 'route' && <RouteEditor game={game} stages={data.stages} onChanged={data.refresh} />}
        {tab === 'map' && (
          <div className="space-y-3">
            <MapView className="h-[62vh] rounded-3xl border border-line" players={data.players} teams={data.teams}
              locations={data.locations} meId={me.id} waypoints={waypoints} now={now} />
            <LocationControl me={me} loc={data.locations[me.id]} sharing={sharing} onRequest={requestShare} />
            <PlayerStatusList data={data} game={game} now={now} compact />
          </div>
        )}
        {tab === 'settings' && <Settings game={game} teams={data.teams} onLeave={onLeave} />}
      </main>
      <TabBar<Tab> value={tab} onChange={setTab} tabs={[
        { id: 'control', label: 'Control', icon: Icons.control },
        { id: 'players', label: 'Players', icon: Icons.people, badge: helpCount > 0 },
        { id: 'route', label: 'Route', icon: Icons.route, badge: data.stages.some((s) => !s.confirmed) && game.status === 'lobby' },
        { id: 'map', label: 'Map', icon: Icons.map },
        { id: 'settings', label: 'Settings', icon: Icons.gear },
      ]} />
      <ConsentSheet open={consentOpen} onClose={() => setConsentOpen(false)} onAccept={() => { setConsentOpen(false); sharing.enable(); }} />
    </div>
  );
}

/* ---------------- Control ---------------- */
function ControlTab({ data, game, now }: { data: GameData; game: Game; now: number }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const rows = useMemo(() => buildLeaderboard(game, data.players, data.teams, data.scores, data.arrivals),
    [game, data.players, data.teams, data.scores, data.arrivals]);
  const competitors = data.players.filter((p) => p.competing && !p.is_host);
  const unconfirmed = data.stages.filter((s) => !s.confirmed || s.lat == null).length;
  const unassigned = game.mode === 'team' ? competitors.filter((p) => !p.team_id).length : 0;

  const act = async (label: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(label);
    try { await fn(); if (ok) toast(ok, 'ok'); data.refresh(); } catch (e) { toast(errMsg(e), 'bad'); } finally { setBusy(null); }
  };
  const setStatus = (s: string, ok: string) => act(s, () => rpc('host_set_status', { p_game: game.id, p_status: s }), ok);

  const unlockAll = () => {
    if (!confirm('Unlock the next clue for every player or team that hasn’t finished? They each get the destination points.')) return;
    act('unlock', async () => {
      if (game.mode === 'team') {
        for (const t of data.teams.filter((t) => !t.finished_at)) await rpc('host_approve_arrival', { p_game: game.id, p_team: t.id });
      } else {
        for (const p of competitors.filter((p) => !p.finished_at)) await rpc('host_approve_arrival', { p_game: game.id, p_player: p.id });
      }
    }, 'Next clue unlocked for everyone');
  };

  const shareLink = `${window.location.origin}${window.location.pathname}?code=${game.code}`;
  const invite = async () => {
    const text = `Join my City Manhunt! Code ${game.code}`;
    if (navigator.share) await navigator.share({ title: 'City Manhunt', text, url: shareLink }).catch(() => undefined);
    else { await navigator.clipboard.writeText(`${text} ${shareLink}`); toast('Invite link copied', 'ok'); }
  };

  return (
    <div className="space-y-4">
      <section className="panel glow-volt p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="kicker text-voltsoft">Game code</div>
            <div className="display text-4xl font-bold tracking-[.22em]">{game.code}</div>
          </div>
          <Button size="sm" variant="ghost" onClick={invite}>Invite</Button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Mini label="Players" value={`${competitors.length}`} />
          <Mini label="Online" value={`${competitors.filter((p) => data.online.has(p.id)).length}`} />
          <Mini label={game.status === 'lobby' ? 'Mode' : 'Elapsed'} value={game.status === 'lobby' ? (game.mode === 'team' ? 'Teams' : 'Solo') : duration(elapsedSeconds(game, game.ended_at))} />
        </div>
      </section>

      <section className="panel p-5 space-y-3">
        {game.status === 'lobby' && (
          <>
            <Check ok={data.stages.length > 0 && unconfirmed === 0} text={unconfirmed === 0 ? `Route ready: ${data.stages.length} destinations confirmed` : `${unconfirmed} destination${unconfirmed > 1 ? 's' : ''} still need confirming (Route tab)`} />
            <Check ok={competitors.length > 0} text={competitors.length ? `${competitors.length} player${competitors.length > 1 ? 's' : ''} joined` : 'No players have joined yet'} />
            {game.mode === 'team' && <Check ok={unassigned === 0} text={unassigned ? `${unassigned} player${unassigned > 1 ? 's' : ''} without a team (Players tab)` : 'Everyone is in a team'} />}
            <Check ok={game.emergency_contacts.length > 0} text={game.emergency_contacts.length ? 'Emergency contacts added' : 'Add emergency contacts (Settings tab)'} />
            <Button size="lg" className="btn-sheen w-full" loading={busy === 'active'} onClick={() => setStatus('active', 'The hunt has started!')}>Start the hunt</Button>
          </>
        )}
        {game.status === 'active' && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" loading={busy === 'paused'} onClick={() => setStatus('paused', 'Game paused')}>Pause</Button>
            <Button variant="danger" loading={busy === 'ended'} onClick={() => { if (confirm('End the game for everyone? Location sharing stops for all players.')) setStatus('ended', 'Game ended'); }}>End game</Button>
            <Button variant="ghost" className="col-span-2" loading={busy === 'unlock'} onClick={unlockAll}>Unlock next clue for everyone</Button>
          </div>
        )}
        {game.status === 'paused' && (
          <div className="grid grid-cols-2 gap-2">
            <Button loading={busy === 'active'} onClick={() => setStatus('active', 'Game resumed')}>Resume</Button>
            <Button variant="danger" loading={busy === 'ended'} onClick={() => { if (confirm('End the game for everyone?')) setStatus('ended', 'Game ended'); }}>End game</Button>
          </div>
        )}
        {game.status === 'ended' && <p className="text-[14px] text-mute">The game has ended. Locations were deleted. Reset to play again with the same route and players.</p>}
        {game.status !== 'lobby' && (
          <Button variant="quiet" size="sm" className="w-full" loading={busy === 'reset'}
            onClick={() => { if (confirm('Reset the game? All progress, points and locations are wiped. The route and players stay.')) act('reset', () => rpc('host_reset', { p_game: game.id }), 'Game reset to the lobby'); }}>
            Reset game
          </Button>
        )}
      </section>

      {game.status !== 'lobby' && <ArcadeTimer game={game} isHost />}

      <section>
        <h3 className="mb-2 font-bold">Live leaderboard</h3>
        <Leaderboard rows={rows} total={data.stages.length} online={game.mode === 'individual' ? data.online : undefined} />
      </section>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-base/60 border border-line p-2.5"><div className="display text-xl font-bold">{value}</div><div className="text-[11px] text-mute">{label}</div></div>;
}
function Check({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2.5 text-[14px]">
      <span className={`grid h-5 w-5 place-items-center rounded-full text-[12px] font-bold ${ok ? 'bg-ok text-base' : 'bg-flare/20 text-flare'}`}>{ok ? '✓' : '!'}</span>
      <span className={ok ? '' : 'text-flare'}>{text}</span>
    </div>
  );
}

/* ---------------- Players ---------------- */
function PlayersTab({ data, game, now }: { data: GameData; game: Game; now: number }) {
  const competitors = data.players.filter((p) => p.competing && !p.is_host);
  const helpers = data.players.filter((p) => !p.competing && !p.is_host);
  return (
    <div className="space-y-5">
      <HelpAlerts data={data} />
      {game.mode === 'team' ? (
        <>
          {game.status === 'lobby' && competitors.length > 1 && <SplitTeams data={data} competitors={competitors} />}
          {data.teams.map((t) => (
            <TeamCard key={t.id} team={t} game={game} data={data} now={now} members={competitors.filter((p) => p.team_id === t.id)} />
          ))}
          {competitors.some((p) => !p.team_id) && (
            <section>
              <h3 className="mb-2 font-bold text-flare">No team yet</h3>
              <div className="space-y-2">{competitors.filter((p) => !p.team_id).map((p) => <PlayerRow key={p.id} p={p} data={data} game={game} now={now} />)}</div>
            </section>
          )}
        </>
      ) : (
        <section className="space-y-2">
          <h3 className="font-bold">Players ({competitors.length})</h3>
          {competitors.length === 0 && <div className="panel p-5 text-center text-mute">Share the game code. Players appear here as they join.</div>}
          {competitors.map((p) => <PlayerRow key={p.id} p={p} data={data} game={game} now={now} withActions />)}
        </section>
      )}
      {helpers.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-bold">Helpers (not ranked)</h3>
          {helpers.map((p) => <PlayerRow key={p.id} p={p} data={data} game={game} now={now} />)}
        </section>
      )}
    </div>
  );
}

function SplitTeams({ data, competitors }: { data: GameData; competitors: Player[] }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const split = async () => {
    if (data.teams.length < 2) return;
    setBusy(true);
    try {
      const shuffled = [...competitors].sort(() => Math.random() - 0.5);
      for (let i = 0; i < shuffled.length; i++) {
        await rpc('host_set_team', { p_player: shuffled[i].id, p_team: data.teams[i % data.teams.length].id });
      }
      data.refresh();
      toast('Teams shuffled', 'ok');
    } catch (e) { toast(errMsg(e), 'bad'); } finally { setBusy(false); }
  };
  return <Button variant="ghost" className="w-full" loading={busy} onClick={split}>Shuffle players into even teams</Button>;
}

function HelpAlerts({ data }: { data: GameData }) {
  const needing = data.players.filter((p) => p.needs_help);
  if (!needing.length) return null;
  return (
    <section className="space-y-2">
      {needing.map((p) => (
        <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-bad/60 bg-bad/15 p-3.5">
          <Avatar emoji={p.avatar} size={36} />
          <div className="flex-1"><div className="font-bold">{p.username} needs help</div><div className="text-[12px] text-mute">Call them, or check the map.</div></div>
          <Button size="sm" variant="ghost" onClick={() => supabase.from('players').update({ needs_help: false }).eq('id', p.id)}>Handled</Button>
        </div>
      ))}
    </section>
  );
}

function stageLabel(stages: Stage[], idx: number, finished: string | null) {
  if (finished) return 'Finished';
  const s = stages[idx];
  return s ? `On clue ${idx + 1}: ${s.destination_name}` : `On clue ${idx + 1}`;
}

function locationText(p: Player, data: GameData, now: number) {
  const loc = data.locations[p.id];
  if (!p.sharing_location) return { text: 'Location off', tone: 'mute' as const };
  if (!loc) return { text: 'Waiting for first position', tone: 'flare' as const };
  const age = secondsSince(loc.updated_at, now);
  return age <= LIVE_SECONDS ? { text: `Live, ${ago(loc.updated_at, now)}`, tone: 'ok' as const } : { text: `Last seen ${ago(loc.updated_at, now)}`, tone: 'flare' as const };
}

function useUnitActions(game: Game) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try { await fn(); toast(ok, 'ok'); } catch (e) { toast(errMsg(e), 'bad'); } finally { setBusy(null); }
  };
  const approve = (player: string | null, team: string | null) =>
    run('approve', () => rpc('host_approve_arrival', { p_game: game.id, p_player: player, p_team: team }), 'Arrival approved, next clue unlocked');
  const award = (player: string | null, team: string | null, kind: 'challenge' | 'bonus', points: number) =>
    run(kind, () => rpc('host_award', { p_game: game.id, p_player: player, p_team: team, p_kind: kind, p_points: points, p_note: kind }), `+${points} ${kind} points`);
  return { busy, approve, award };
}

function UnitActions({ game, playerId, teamId, finished }: { game: Game; playerId: string | null; teamId: string | null; finished: boolean }) {
  const { busy, approve, award } = useUnitActions(game);
  const running = game.status === 'active' || game.status === 'paused';
  if (!running) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {!finished && <Button size="sm" loading={busy === 'approve'} onClick={() => { if (confirm('Approve arrival at the current destination?')) approve(playerId, teamId); }}>Approve arrival</Button>}
      <Button size="sm" variant="ghost" loading={busy === 'challenge'} onClick={() => award(playerId, teamId, 'challenge', game.challenge_points)}>Challenge +{game.challenge_points}</Button>
      <Button size="sm" variant="ghost" loading={busy === 'bonus'} onClick={() => award(playerId, teamId, 'bonus', game.bonus_points)}>Bonus +{game.bonus_points}</Button>
    </div>
  );
}

function PlayerRow({ p, data, game, now, withActions }: { p: Player; data: GameData; game: Game; now: number; withActions?: boolean }) {
  const toast = useToast();
  const loc = locationText(p, data, now);
  const team = data.teams.find((t) => t.id === p.team_id);
  const setTeam = async (teamId: string) => {
    try { await rpc('host_set_team', { p_player: p.id, p_team: teamId || null }); data.refresh(); } catch (e) { toast(errMsg(e), 'bad'); }
  };
  const toggleCompeting = async () => {
    try { await rpc('host_set_competing', { p_player: p.id, p_competing: !p.competing }); data.refresh(); } catch (e) { toast(errMsg(e), 'bad'); }
  };
  const remove = async () => {
    if (!confirm(`Remove ${p.username} from the game?`)) return;
    const { error } = await supabase.from('players').delete().eq('id', p.id);
    if (error) toast(error.message, 'bad'); else data.refresh();
  };
  return (
    <div className={`panel p-3.5 ${p.needs_help ? 'border-bad/60' : ''}`}>
      <div className="flex items-center gap-3">
        <Avatar emoji={p.avatar} size={42} online={data.online.has(p.id)} ring={team?.color} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-bold">{p.username}</span>
            {p.needs_help && <Pill tone="bad" live>Help</Pill>}
          </div>
          <div className="text-[12px] text-mute">{data.online.has(p.id) ? 'App open' : `App closed, seen ${ago(p.last_seen, now)}`}</div>
          <div className={`text-[12px] font-semibold ${loc.tone === 'ok' ? 'text-ok' : loc.tone === 'flare' ? 'text-flare' : 'text-mute'}`}>{loc.text}</div>
          {game.mode === 'individual' && p.competing && <div className="text-[12px] text-voltsoft">{stageLabel(data.stages, p.current_stage, p.finished_at)}</div>}
        </div>
      </div>
      {withActions && game.mode === 'individual' && <UnitActions game={game} playerId={p.id} teamId={null} finished={Boolean(p.finished_at)} />}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {game.mode === 'team' && p.competing && (
          <select className="field !h-9 !w-auto !py-0 !text-[13px]" value={p.team_id ?? ''} onChange={(e) => setTeam(e.target.value)} aria-label={`Team for ${p.username}`}>
            <option value="">No team</option>
            {data.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        <Button size="sm" variant="quiet" onClick={toggleCompeting}>{p.competing ? 'Make helper' : 'Make competitor'}</Button>
        <Button size="sm" variant="quiet" className="!text-bad" onClick={remove}>Remove</Button>
      </div>
    </div>
  );
}

function TeamCard({ team, members, game, data, now }: { team: Team; members: Player[]; game: Game; data: GameData; now: number }) {
  return (
    <section className="rounded-3xl border p-4" style={{ borderColor: `${team.color}66`, background: `${team.color}0d` }}>
      <div className="flex items-center justify-between">
        <h3 className="display text-xl font-bold" style={{ color: team.color }}>{team.name}</h3>
        <span className="text-[12px] font-bold text-mute">{stageLabel(data.stages, team.current_stage, team.finished_at)}</span>
      </div>
      <UnitActions game={game} playerId={null} teamId={team.id} finished={Boolean(team.finished_at)} />
      <div className="mt-3 space-y-2">
        {members.length === 0 && <p className="text-[13px] text-mute">No players in this team yet.</p>}
        {members.map((p) => <PlayerRow key={p.id} p={p} data={data} game={game} now={now} />)}
      </div>
    </section>
  );
}

function PlayerStatusList({ data, game, now }: { data: GameData; game: Game; now: number; compact?: boolean }) {
  const ps = data.players.filter((p) => !p.is_host);
  return (
    <div className="panel divide-y divide-line">
      {ps.map((p) => {
        const loc = locationText(p, data, now);
        const team = data.teams.find((t) => t.id === p.team_id);
        const idx = game.mode === 'team' ? team?.current_stage ?? 0 : p.current_stage;
        const fin = game.mode === 'team' ? team?.finished_at ?? null : p.finished_at;
        return (
          <div key={p.id} className="flex items-center gap-3 p-3">
            <Avatar emoji={p.avatar} size={32} online={data.online.has(p.id)} ring={team?.color} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-bold">{p.username}{p.needs_help ? ' 🚨' : ''}</div>
              <div className="truncate text-[12px] text-mute">{p.competing ? stageLabel(data.stages, idx, fin) : 'Helper'}</div>
            </div>
            <span className={`text-[12px] font-semibold ${loc.tone === 'ok' ? 'text-ok' : loc.tone === 'flare' ? 'text-flare' : 'text-mute'}`}>{loc.text}</span>
          </div>
        );
      })}
      {ps.length === 0 && <div className="p-4 text-center text-[13px] text-mute">No players yet.</div>}
    </div>
  );
}
