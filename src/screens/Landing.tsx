import { useState } from 'react';
import { AVATARS } from '../lib/format';
import { errMsg, rpc } from '../lib/supabase';
import { Button, Icons, useToast } from '../components/ui';
import { Logo } from '../components/Logo';

const STEPS = [
  { icon: Icons.clue, title: 'Crack the riddle', text: 'Each clue points to a real place somewhere in the city.' },
  { icon: Icons.pin, title: 'Get there first', text: 'Walk to the spot and check in. GPS confirms you made it.' },
  { icon: Icons.trophy, title: 'Unlock the next one', text: 'Every find scores points and opens the next secret stop.' },
];

const FEATURES = [
  { icon: Icons.map, label: 'Live group map' },
  { icon: Icons.trophy, label: 'Real-time leaderboard' },
  { icon: Icons.clue, label: 'Hints & bonus challenges' },
  { icon: Icons.shield, label: 'Safety & SOS built in' },
];

export function Landing({ onEnter }: { onEnter: (gameId: string) => void }) {
  const params = new URLSearchParams(window.location.search);
  const invited = Boolean(params.get('code'));
  const [mode, setMode] = useState<'join' | 'host'>('join');
  const [code, setCode] = useState((params.get('code') || '').toUpperCase().slice(0, 6));
  const [name, setName] = useState(localStorage.getItem('manhunt-name') || '');
  const [avatar, setAvatar] = useState(localStorage.getItem('manhunt-avatar') || AVATARS[0]);
  const [gameName, setGameName] = useState('Birthday Manhunt');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const submit = async () => {
    if (!name.trim()) return toast('Choose a username first', 'bad');
    setBusy(true);
    try {
      localStorage.setItem('manhunt-name', name.trim());
      localStorage.setItem('manhunt-avatar', avatar);
      const id = mode === 'join'
        ? await rpc<string>('join_game', { p_code: code, p_username: name.trim(), p_avatar: avatar })
        : await rpc<string>('create_game', { p_name: gameName, p_username: name.trim(), p_avatar: avatar });
      window.history.replaceState(null, '', window.location.pathname);
      onEnter(id);
    } catch (e) {
      toast(errMsg(e), 'bad');
    } finally {
      setBusy(false);
    }
  };

  const toForm = () => document.getElementById('play')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col overflow-x-clip px-5 safe-top safe-bottom">
      <nav className="flex items-center justify-between pt-3">
        <div className="flex items-center gap-2">
          <Logo size={30} />
          <span className="display text-[15px] font-bold">Manhunt</span>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-flare/30 bg-flare/10 px-3 py-1 text-[12px] font-bold text-flare">
          <span className="h-1.5 w-1.5 rounded-full bg-flare live-dot text-flare" /> Sydney, NSW
        </div>
      </nav>

      {/* ---------- Hero ---------- */}
      <header className="relative pt-10 pb-6">
        <div className="radar-rings -right-28 -top-6 h-80 w-80" aria-hidden />
        <div className="radar -right-28 -top-6 h-80 w-80" aria-hidden />
        <p className="kicker rise text-voltsoft">{invited ? 'You’ve been invited' : 'A live city scavenger hunt'}</p>
        <h1 className="display rise mt-3 text-[64px] font-bold leading-[.88] tracking-tight" style={{ animationDelay: '.05s' }}>
          <span className="text-shine">City</span><br /><span className="text-shine">Manhunt</span>
        </h1>
        <p className="rise mt-5 max-w-[30ch] text-[17px] leading-relaxed text-mute" style={{ animationDelay: '.1s' }}>
          Solve the riddle, find the place, unlock the next clue. Race your friends across the city.
        </p>
        <div className="rise mt-6 flex gap-2" style={{ animationDelay: '.15s' }}>
          <Button size="lg" className="btn-sheen flex-1" onClick={() => { setMode('join'); toForm(); }}>Join a game</Button>
          <Button size="lg" variant="ghost" className="flex-1" onClick={() => { setMode('host'); toForm(); }}>Host</Button>
        </div>
      </header>

      {/* ---------- Route teaser ---------- */}
      <section className="panel rise relative overflow-hidden p-4" style={{ animationDelay: '.2s' }} aria-label="The route">
        <div className="flex items-center justify-between">
          <span className="kicker text-mute">The route</span>
          <span className="rounded-full bg-volt/15 px-2.5 py-0.5 text-[11px] font-bold text-voltsoft">4 secret stops</span>
        </div>
        <RouteArt />
        <div className="mt-1 grid grid-cols-3 gap-2 text-center">
          <Stat value="4" label="Clues" />
          <Stat value="+100" label="Per find" />
          <Stat value="🏁" label="Mystery finish" />
        </div>
        <div className="mt-3 flex items-center justify-between text-[12px]">
          <span className="text-mute"><b className="text-ink">Start:</b> Victoria Cross Metro</span>
          <span className="text-mute"><b className="text-flare">Finish:</b> ???</span>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section className="mt-8" aria-labelledby="how">
        <h2 id="how" className="kicker text-mute">How it works</h2>
        <ol className="mt-3 space-y-2">
          {STEPS.map((s, i) => (
            <li key={s.title} className="panel flex items-start gap-3.5 p-4">
              <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-volt/15 text-volt">
                <span className="h-5 w-5">{s.icon}</span>
                <span className="display absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-flare text-[11px] font-bold text-base">{i + 1}</span>
              </span>
              <div>
                <div className="font-bold">{s.title}</div>
                <p className="mt-0.5 text-[14px] leading-snug text-mute">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {FEATURES.map((f) => (
            <li key={f.label} className="flex items-center gap-2 rounded-2xl border border-line bg-deck/70 px-3 py-2.5 text-[13px] font-semibold">
              <span className="h-4 w-4 shrink-0 text-voltsoft">{f.icon}</span>{f.label}
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- Join / host form ---------- */}
      <section id="play" className="mt-8 scroll-mt-4">
        <h2 className="kicker text-mute">Ready? Let’s play</h2>
        <div className="panel mt-3 p-4">
          <div className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-base p-1" role="tablist">
            {(['join', 'host'] as const).map((m) => (
              <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
                className={`h-11 rounded-xl font-bold transition ${mode === m ? (m === 'join' ? 'bg-volt text-white' : 'bg-flare text-base') : 'text-mute'}`}>
                {m === 'join' ? 'Join a game' : 'Host a game'}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-4">
            {mode === 'join' ? (
              <div>
                <label className="label" htmlFor="code">Game code</label>
                <input id="code" className="field display text-center text-3xl tracking-[.35em] uppercase" inputMode="text" autoCapitalize="characters"
                  autoComplete="off" maxLength={6} value={code} placeholder="••••••"
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} />
                <p className="mt-2 text-[12px] text-mute">Get the 6-character code from whoever is hosting.</p>
              </div>
            ) : (
              <div>
                <label className="label" htmlFor="gname">Game name</label>
                <input id="gname" className="field" value={gameName} maxLength={40} onChange={(e) => setGameName(e.target.value)} />
                <p className="mt-2 text-[13px] text-mute">You’ll run the game: edit the route, start it and approve arrivals. Hosts aren’t ranked.</p>
              </div>
            )}
            <div>
              <label className="label" htmlFor="uname">Your name</label>
              <input id="uname" className="field" value={name} maxLength={20} autoComplete="nickname" placeholder="e.g. Sam"
                onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <span className="label">Pick your avatar</span>
              <div className="grid grid-cols-8 gap-1.5">
                {AVATARS.map((a) => (
                  <button key={a} onClick={() => setAvatar(a)} aria-label={`Avatar ${a}`} aria-pressed={avatar === a}
                    className={`aspect-square rounded-xl text-[22px] transition ${avatar === a ? 'scale-110 bg-volt/20 ring-2 ring-volt' : 'bg-base border border-line'}`}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <Button size="lg" className="btn-sheen w-full" variant={mode === 'join' ? 'primary' : 'accent'} loading={busy}
              disabled={mode === 'join' && code.length !== 6} onClick={submit}>
              {mode === 'join' ? 'Join game' : 'Create game'}
            </Button>
          </div>
        </div>
      </section>

      <p className="mt-auto pt-10 pb-4 text-center text-[12px] text-mute">
        Your location is never shared unless you switch it on during the game.
      </p>
    </main>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-base/60 py-2">
      <div className="display text-xl font-bold">{value}</div>
      <div className="text-[11px] text-mute">{label}</div>
    </div>
  );
}

/** A stylised, spoiler-free sketch of the route: start, three hidden stops, the finish. */
function RouteArt() {
  const nodes: [number, number][] = [[14, 70], [84, 30], [156, 62], [228, 28]];
  return (
    <svg viewBox="0 0 320 96" className="mt-2 w-full" aria-hidden>
      <path d="M14 70 C 44 70, 54 30, 84 30 S 126 62, 156 62 S 198 28, 228 28 S 284 44, 302 44"
        fill="none" stroke="#2A3142" strokeWidth="6" strokeLinecap="round" />
      <path className="route-flow" d="M14 70 C 44 70, 54 30, 84 30 S 126 62, 156 62 S 198 28, 228 28 S 284 44, 302 44"
        fill="none" stroke="#2E8BFF" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="6 5" />
      {nodes.map(([x, y], i) => (
        <g key={i} className="node-pop" style={{ animationDelay: `${i * 0.35}s` }}>
          <circle cx={x} cy={y} r="9" fill="#10131B" stroke={i === 0 ? '#E9EDF6' : '#2E8BFF'} strokeWidth="2" />
          <text x={x} y={y + 3.5} textAnchor="middle" fontSize="10" fontWeight="700" fill={i === 0 ? '#E9EDF6' : '#9CC8FF'}
            fontFamily="Chakra Petch, sans-serif">{i === 0 ? 'S' : '?'}</text>
        </g>
      ))}
      <rect x="292" y="34" width="20" height="20" rx="6" fill="#FF8A1F" />
      <text x="302" y="48" textAnchor="middle" fontSize="11">🏁</text>
    </svg>
  );
}
