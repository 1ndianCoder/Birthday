import { useState } from 'react';
import { AVATARS } from '../lib/format';
import { errMsg, rpc } from '../lib/supabase';
import { Button, useToast } from '../components/ui';

export function Landing({ onEnter }: { onEnter: (gameId: string) => void }) {
  const params = new URLSearchParams(window.location.search);
  const [mode, setMode] = useState<'join' | 'host'>(params.get('code') ? 'join' : 'join');
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

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col px-5 safe-top safe-bottom">
      <header className="pt-10 pb-8">
        <div className="flex items-center gap-2 text-[13px] font-bold text-flare">
          <span className="h-2 w-2 rounded-full bg-flare live-dot text-flare" /> Sydney, NSW
        </div>
        <h1 className="display mt-4 text-[56px] font-bold leading-[.92] tracking-tight">
          City<br />Manhunt
        </h1>
        <p className="mt-4 max-w-[30ch] text-[17px] leading-relaxed text-mute">
          Solve the riddle, find the place, unlock the next clue. Victoria Cross to the arcade.
        </p>
        <svg viewBox="0 0 320 64" className="mt-6 w-full text-volt" aria-hidden>
          <path d="M8 52 C 70 52, 70 14, 130 18 S 200 50, 250 30 S 300 12, 312 12" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="5 6" opacity=".7" />
          {[[8, 52], [130, 18], [250, 30]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="5" fill="#10131B" stroke="currentColor" strokeWidth="2" />)}
          <rect x="304" y="4" width="16" height="16" rx="4" fill="#FF8A1F" />
        </svg>
      </header>

      <div className="panel p-1.5 grid grid-cols-2 gap-1" role="tablist">
        {(['join', 'host'] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
            className={`h-11 rounded-[14px] font-bold transition ${mode === m ? 'bg-deck2 text-ink border border-line' : 'text-mute'}`}>
            {m === 'join' ? 'Join a game' : 'Host a game'}
          </button>
        ))}
      </div>

      <section className="mt-5 space-y-4">
        {mode === 'join' ? (
          <div>
            <label className="label" htmlFor="code">Game code</label>
            <input id="code" className="field display text-center text-3xl tracking-[.35em] uppercase" inputMode="text" autoCapitalize="characters"
              autoComplete="off" maxLength={6} value={code} placeholder="••••••"
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} />
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
          <span className="label">Avatar</span>
          <div className="grid grid-cols-8 gap-1.5">
            {AVATARS.map((a) => (
              <button key={a} onClick={() => setAvatar(a)} aria-label={`Avatar ${a}`} aria-pressed={avatar === a}
                className={`aspect-square rounded-xl text-[22px] transition ${avatar === a ? 'bg-volt/20 ring-2 ring-volt' : 'bg-deck border border-line'}`}>
                {a}
              </button>
            ))}
          </div>
        </div>
        <Button size="lg" className="w-full" variant={mode === 'join' ? 'primary' : 'accent'} loading={busy}
          disabled={mode === 'join' && code.length !== 6} onClick={submit}>
          {mode === 'join' ? 'Join game' : 'Create game'}
        </Button>
      </section>

      <p className="mt-auto pt-10 pb-4 text-center text-[12px] text-mute">
        Your location is never shared unless you switch it on during the game.
      </p>
    </main>
  );
}
