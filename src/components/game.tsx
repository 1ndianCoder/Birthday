import { useEffect, useState } from 'react';
import { ago, clock, duration, LIVE_SECONDS, secondsSince } from '../lib/format';
import { elapsedSeconds, type BoardRow } from '../lib/leaderboard';
import { supabase } from '../lib/supabase';
import type { Game, Player, PlayerLocation } from '../lib/types';
import type { LocationSharing } from '../hooks/useLocationSharing';
import { Avatar, Button, Icons, Pill, Sheet, useNow } from './ui';

/* ---------- Leaderboard ---------- */
export function Leaderboard({ rows, highlightId, total, online }: { rows: BoardRow[]; highlightId?: string | null; total: number; online?: Set<string> }) {
  if (rows.length === 0) {
    return <div className="panel p-6 text-center text-mute">No one is competing yet. Players appear here as they join.</div>;
  }
  return (
    <ol className="space-y-2">
      {rows.map((r) => {
        const mine = r.id === highlightId;
        const pct = total ? Math.round((Math.min(r.completed, total) / total) * 100) : 0;
        return (
          <li key={r.id} className={`panel relative overflow-hidden p-3 ${mine ? '!border-volt/60' : ''} ${r.rank === 1 ? 'glow-flare' : ''}`}>
            <div className="flex items-center gap-3">
            <span className={`display w-8 text-center font-bold ${r.rank <= 3 ? 'text-2xl' : 'text-xl text-mute'}`} aria-label={`Rank ${r.rank}`}>
              {MEDALS[r.rank - 1] ?? r.rank}
            </span>
            {r.kind === 'player'
              ? <Avatar emoji={r.avatar} size={40} online={online ? online.has(r.id) : undefined} />
              : <span className="h-10 w-10 shrink-0 rounded-xl grid place-items-center display font-bold text-base" style={{ background: r.color }}>{(r.name.replace(/^team\s+/i, '')[0] || '?').toUpperCase()}</span>}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-bold">{r.name}</span>
                {mine && <span className="text-[11px] font-bold text-voltsoft">You</span>}
                {r.finishedAt && <span className="text-[11px] font-bold text-ok">Finished</span>}
              </div>
              <div className="text-[12px] text-mute">
                {r.finishedAt ? `All ${total} clues solved` : `Stage ${Math.min(r.stage + 1, total)} of ${total}`}, {r.completed} solved, {r.hints} hint{r.hints === 1 ? '' : 's'}
                {r.kind === 'team' && r.members.length > 0 && <span className="ml-1">{r.members.map((m) => m.avatar).join(' ')}</span>}
              </div>
            </div>
            <span className="text-right">
              <span className="display block text-xl font-bold leading-none tabular-nums">{r.points}</span>
              <span className="text-[10px] font-bold text-mute">PTS</span>
            </span>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
              <div className={`h-full rounded-full transition-all duration-700 ${r.finishedAt ? 'bg-ok' : 'bg-gradient-to-r from-volt to-voltsoft'}`} style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const MEDALS = ['🥇', '🥈', '🥉'];

/* ---------- Invite friends (share sheet on phones, copy link elsewhere) ---------- */
export function InviteButton({ code, name, className = '' }: { code: string; name: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/?code=${code}`;
  const invite = async () => {
    const text = `Join my City Manhunt game “${name}”! Code: ${code}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'City Manhunt', text, url }); } catch { /* share sheet dismissed */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  };
  return (
    <Button variant="ghost" className={className} onClick={invite}>
      <span className="h-4 w-4">{Icons.people}</span>{copied ? 'Invite link copied!' : 'Invite friends'}
    </Button>
  );
}

/* ---------- Arcade countdown ---------- */
export function ArcadeTimer({ game, isHost }: { game: Game; isHost: boolean }) {
  const now = useNow(500);
  const ends = game.arcade_ends_at ? new Date(game.arcade_ends_at).getTime() : null;
  const left = ends ? (ends - now) / 1000 : null;
  const set = (iso: string | null) => supabase.from('games').update({ arcade_ends_at: iso }).eq('id', game.id);
  return (
    <div className="panel-raised p-4">
      <div className="flex items-center justify-between">
        <span className="font-bold">Arcade time</span>
        {left !== null && left <= 0 && <Pill tone="flare">Time’s up</Pill>}
      </div>
      <div className={`display mt-1 text-5xl font-bold tabular-nums ${left !== null && left < 300 ? 'text-flare' : ''}`}>
        {left === null ? '60:00' : clock(left)}
      </div>
      <p className="mt-1 text-[13px] text-mute">
        {left === null ? 'The host starts this when everyone reaches the arcade.' : left > 0 ? 'Then it’s back to the house for birthday dinner.' : 'Head back together for birthday dinner.'}
      </p>
      {isHost && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="accent" onClick={() => set(new Date(Date.now() + 60 * 60000).toISOString())}>{ends ? 'Restart 60 min' : 'Start 60 min'}</Button>
          {ends && <Button size="sm" variant="ghost" onClick={() => set(new Date(Math.max(ends, Date.now()) + 10 * 60000).toISOString())}>Add 10 min</Button>}
          {ends && <Button size="sm" variant="ghost" onClick={() => set(null)}>Clear timer</Button>}
        </div>
      )}
    </div>
  );
}

/* ---------- Location consent ---------- */
export function ConsentSheet({ open, onClose, onAccept }: { open: boolean; onClose: () => void; onAccept: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Share your location?">
      <div className="space-y-3 text-[15px] leading-relaxed">
        <p>Your position will appear on the game map so your group and the host can see where you are.</p>
        <ul className="space-y-2 text-mute">
          <li><b className="text-ink">Who sees it:</b> only people in this game. It’s never public.</li>
          <li><b className="text-ink">When:</b> only while the game is running and the app is open. It updates about every 5 seconds.</li>
          <li><b className="text-ink">Your control:</b> pause sharing any time. Pausing deletes your position from the map.</li>
          <li><b className="text-ink">After the game:</b> sharing stops automatically and every position is deleted.</li>
        </ul>
        <p className="text-mute">You can still play without sharing: tap “I’m here” at each destination to check in.</p>
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Not now</Button>
          <Button onClick={onAccept}>Share location</Button>
        </div>
      </div>
    </Sheet>
  );
}

/* ---------- Location control strip ---------- */
export function LocationControl({ me, loc, sharing, onRequest }: { me: Player; loc?: PlayerLocation; sharing: LocationSharing; onRequest: () => void }) {
  const now = useNow(1000);
  if (!sharing.gameRunning) {
    return <div className="panel px-4 py-3 text-[13px] text-mute">Location sharing becomes available when the host starts the game.</div>;
  }
  const on = me.sharing_location;
  const age = secondsSince(loc?.updated_at, now);
  return (
    <div className="panel p-3.5">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {on
              ? (age <= LIVE_SECONDS ? <Pill tone="ok" live>Sharing live</Pill> : <Pill tone="flare" live={false}>Waiting for signal</Pill>)
              : <Pill tone="mute" live={false}>Location off</Pill>}
          </div>
          <p className="mt-1.5 text-[12px] text-mute">
            {on ? (loc ? `Last sent ${ago(loc.updated_at, now)}${loc.accuracy ? `, about ±${Math.round(loc.accuracy)} m` : ''}` : 'Finding your position…') : 'Nobody can see where you are.'}
          </p>
        </div>
        {on
          ? <Button size="sm" variant="ghost" onClick={sharing.pause}>Pause</Button>
          : <Button size="sm" onClick={onRequest} loading={sharing.status === 'starting'}>Share</Button>}
      </div>
      {sharing.error && <p className="mt-2 rounded-xl bg-bad/10 border border-bad/30 p-2.5 text-[12px] text-[#ffb3bd]">{sharing.error}</p>}
    </div>
  );
}

/* ---------- Safety panel (players & host) ---------- */
export function SafetyPanel({ game, me }: { game: Game; me: Player }) {
  const [keepAwake, setKeepAwake] = useState(localStorage.getItem('manhunt-keep-awake') === '1');
  const toggleAwake = () => {
    const v = !keepAwake;
    setKeepAwake(v);
    localStorage.setItem('manhunt-keep-awake', v ? '1' : '0');
  };
  const help = (v: boolean) => supabase.from('players').update({ needs_help: v }).eq('id', me.id);
  return (
    <div className="space-y-4">
      {!me.is_host && (
        <div className={`panel p-4 ${me.needs_help ? 'border-bad/60' : ''}`}>
          <div className="font-bold">Need the host?</div>
          <p className="mt-1 text-[13px] text-mute">Sends an alert to the host with your name. For anything serious, call 000 first.</p>
          {me.needs_help
            ? <div className="mt-3 flex items-center gap-2"><Pill tone="bad" live>Host alerted</Pill><Button size="sm" variant="ghost" onClick={() => help(false)}>I’m OK now</Button></div>
            : <Button className="mt-3 w-full" variant="danger" onClick={() => help(true)}>Alert the host</Button>}
        </div>
      )}

      <div className="panel p-4">
        <div className="font-bold">Emergency contacts</div>
        <a href="tel:000" className="mt-3 flex items-center justify-between rounded-xl bg-bad/15 border border-bad/40 px-4 py-3">
          <span><span className="block font-bold text-[#ffb3bd]">Emergency: 000</span><span className="text-[12px] text-mute">Police, fire, ambulance (112 also works on mobiles)</span></span>
          <span className="font-bold text-bad">Call</span>
        </a>
        {game.emergency_contacts.length === 0 && <p className="mt-3 text-[13px] text-mute">The host hasn’t added contacts yet.</p>}
        <div className="mt-2 space-y-2">
          {game.emergency_contacts.map((c, i) => (
            <a key={i} href={`tel:${c.phone.replace(/[^\d+]/g, '')}`} className="flex items-center justify-between rounded-xl bg-deck2 border border-line px-4 py-3">
              <span><span className="block font-bold">{c.name}</span><span className="text-[12px] text-mute">{c.phone}</span></span>
              <span className="font-bold text-voltsoft">Call</span>
            </a>
          ))}
        </div>
      </div>

      <div className="panel p-4">
        <div className="font-bold">Street rules</div>
        <ul className="mt-2 space-y-2 text-[14px] text-mute leading-relaxed">
          <li><b className="text-ink">Stop to read.</b> Never look at your phone while crossing a road or walking near traffic.</li>
          <li><b className="text-ink">Walk, don’t run</b> near roads, stations, light rail and the water’s edge.</li>
          <li><b className="text-ink">Cross at lights</b> and wait for the green man, even if the street looks clear.</li>
          <li><b className="text-ink">Public places only.</b> Every destination is a public space. Never enter anywhere private or closed off.</li>
          <li><b className="text-ink">Stay in your group</b> and keep your phone charged. Tell the host before leaving the route.</li>
        </ul>
      </div>

      <div className="panel p-4 flex items-center justify-between gap-3">
        <div>
          <div className="font-bold">Keep screen awake</div>
          <p className="text-[12px] text-mute">Helps location keep updating on iPhone. Uses more battery.</p>
        </div>
        <button role="switch" aria-checked={keepAwake} onClick={toggleAwake}
          className={`h-8 w-14 rounded-full p-1 transition ${keepAwake ? 'bg-volt' : 'bg-line'}`}>
          <span className={`block h-6 w-6 rounded-full bg-white transition ${keepAwake ? 'translate-x-6' : ''}`} />
        </button>
      </div>
    </div>
  );
}

/* ---------- Decrypting title (used by the unlock moment) ---------- */
const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&@';
export function DecryptText({ text, className = '' }: { text: string; className?: string }) {
  const [shown, setShown] = useState(text);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(text); return; }
    let frame = 0;
    const total = 24;
    const t = window.setInterval(() => {
      frame++;
      const settled = Math.floor((frame / total) * text.length);
      setShown(text.split('').map((c, i) => (i < settled || c === ' ' ? c : GLYPHS[Math.floor(Math.random() * GLYPHS.length)])).join(''));
      if (frame >= total) { window.clearInterval(t); setShown(text); }
    }, 40);
    return () => window.clearInterval(t);
  }, [text]);
  return <span className={className}>{shown}</span>;
}

export function UnlockOverlay({ title, subtitle, onClose }: { title: string; subtitle: string; onClose: () => void }) {
  useEffect(() => {
    if ('vibrate' in navigator) navigator.vibrate?.([60, 40, 120]);
  }, []);
  return (
    <div className="fixed inset-0 z-[1500] grid place-items-center bg-base/95 backdrop-blur-md px-6" role="dialog" aria-modal="true" aria-label="Clue unlocked">
      <div className="unlock-ring" aria-hidden />
      <div className="unlock-in relative text-center">
        <p className="font-bold text-flare">{subtitle}</p>
        <h2 className="display mt-3 text-4xl font-bold leading-tight"><DecryptText text={title} /></h2>
        <p className="mt-4 text-mute">Stop somewhere safe before you read the riddle.</p>
        <Button className="mt-8 w-56" size="lg" onClick={onClose}>Open clue</Button>
      </div>
    </div>
  );
}

/* ---------- Mission complete ---------- */
export function MissionComplete({ game, rows, myRowId, total, finishedAt, completed, gameEnded }:
  { game: Game; rows: BoardRow[]; myRowId: string | null; total: number; finishedAt: string | null; completed: number; gameEnded: boolean }) {
  const mine = rows.find((r) => r.id === myRowId);
  const allDone = rows.length > 0 && rows.every((r) => r.finishedAt);
  const leader = rows[0];
  const winnerFinal = gameEnded || allDone;
  return (
    <div className="space-y-4">
      <div className="glow-flare relative overflow-hidden rounded-3xl border border-flare/40 bg-gradient-to-b from-flare/15 to-transparent p-6 text-center">
        <Confetti />
        <div className="text-5xl" aria-hidden>🏁</div>
        <p className="display mt-2 text-[13px] font-bold text-flare">{finishedAt ? 'Final destination reached' : 'Game over'}</p>
        <h2 className="display mt-2 text-4xl font-bold leading-[1.05]">MISSION COMPLETE!</h2>
        <p className="mt-2 font-semibold text-mute">YOU HAVE REACHED THE FINAL DESTINATION.</p>
        <div className="mt-6 grid grid-cols-3 gap-2">
          <Stat label="Points" value={String(mine?.points ?? 0)} />
          <Stat label="Time" value={finishedAt ? duration(elapsedSeconds(game, finishedAt)) : '—'} />
          <Stat label="Clues" value={`${completed}/${total}`} />
        </div>
      </div>
      {leader && (
        <div className="panel p-4 flex items-center gap-3">
          <span className="text-3xl">🏆</span>
          <div>
            <div className="text-[13px] text-mute">{winnerFinal ? (game.mode === 'team' ? 'Winning team' : 'Winner') : 'Leading right now'}</div>
            <div className="display text-xl font-bold">{leader.avatar} {leader.name}, {leader.points} pts</div>
          </div>
        </div>
      )}
      <ArcadeTimer game={game} isHost={false} />
      <div>
        <h3 className="mb-2 font-bold">{winnerFinal ? 'Final leaderboard' : 'Leaderboard'}</h3>
        <Leaderboard rows={rows} highlightId={myRowId} total={total} />
      </div>
    </div>
  );
}

const CONFETTI_COLORS = ['#2E8BFF', '#9CC8FF', '#FF8A1F', '#35D69B', '#E9EDF6'];
function Confetti() {
  return (
    <div className="confetti" aria-hidden>
      {Array.from({ length: 28 }).map((_, i) => (
        <i key={i} style={{
          left: `${(i * 37) % 100}%`,
          background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          animationDelay: `${(i % 9) * 0.33}s`,
          animationDuration: `${2.6 + (i % 5) * 0.4}s`,
        }} />
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-base/60 border border-line p-3">
      <div className="display text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-[12px] text-mute">{label}</div>
    </div>
  );
}

/* ---------- Progress tracker ---------- */
export function Progress({ total, current, finished }: { total: number; current: number; finished: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[13px]">
        <span className="font-bold">{finished ? 'Route complete' : `Stage ${Math.min(current + 1, total)} of ${total}`}</span>
        <span className="text-mute">{current} solved</span>
      </div>
      <div className="mt-2 flex gap-1.5" aria-hidden>
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className={`h-2 flex-1 rounded-full transition-colors ${i < current ? 'bg-volt shadow-[0_0_10px_rgba(46,139,255,.7)]' : i === current && !finished ? 'bg-flare animate-pulse' : 'bg-line'}`} />
        ))}
      </div>
    </div>
  );
}
