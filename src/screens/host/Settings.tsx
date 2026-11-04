import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { EmergencyContact, Game, Team } from '../../lib/types';
import { MapView } from '../../components/MapView';
import { Button, useNow, useToast } from '../../components/ui';

export function Settings({ game, teams, onExit }: { game: Game; teams: Team[]; onExit: () => void }) {
  const toast = useToast();
  const now = useNow(10000);
  const [g, setG] = useState(game);
  const [contacts, setContacts] = useState<EmergencyContact[]>(game.emergency_contacts);
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [showStartMap, setShowStartMap] = useState(false);
  const lobby = game.status === 'lobby';

  useEffect(() => { setG(game); setContacts(game.emergency_contacts); }, [game.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setTeamNames(Object.fromEntries(teams.map((t) => [t.id, t.name]))), [teams]);

  const save = async () => {
    setBusy(true);
    const cleaned = contacts.map((c) => ({ name: c.name.trim(), phone: c.phone.trim() })).filter((c) => c.name && c.phone);
    const { error } = await supabase.from('games').update({
      name: g.name.trim() || 'City Manhunt',
      mode: lobby ? g.mode : game.mode,
      hint_penalty: Math.max(0, Math.round(g.hint_penalty)),
      challenge_points: Math.max(0, Math.round(g.challenge_points)),
      bonus_points: Math.max(0, Math.round(g.bonus_points)),
      emergency_contacts: cleaned,
      start_name: g.start_name.trim() || 'Start',
      start_lat: g.start_lat, start_lng: g.start_lng,
      reveal_finish: g.reveal_finish,
    }).eq('id', game.id);
    for (const t of teams) {
      const n = (teamNames[t.id] || '').trim();
      if (n && n !== t.name) await supabase.from('teams').update({ name: n.slice(0, 24) }).eq('id', t.id);
    }
    setBusy(false);
    if (error) toast(error.message, 'bad'); else toast('Settings saved', 'ok');
  };

  const num = (k: 'hint_penalty' | 'challenge_points' | 'bonus_points') => (
    <input className="field" type="number" min={0} max={500} value={g[k]} onChange={(e) => setG({ ...g, [k]: Number(e.target.value) })} />
  );

  return (
    <div className="space-y-5">
      <h2 className="display text-2xl font-bold">Settings</h2>

      <section className="panel p-4 space-y-4">
        <label className="block"><span className="label">Game name</span>
          <input className="field" value={g.name} maxLength={40} onChange={(e) => setG({ ...g, name: e.target.value })} /></label>
        <div>
          <span className="label">Game mode {lobby ? '' : '(locked while the game runs)'}</span>
          <div className="grid grid-cols-2 gap-2">
            {(['individual', 'team'] as const).map((m) => (
              <button key={m} disabled={!lobby} onClick={() => setG({ ...g, mode: m })}
                className={`rounded-2xl border p-3 text-left transition disabled:opacity-50 ${g.mode === m ? 'border-volt bg-volt/10' : 'border-line bg-deck2'}`}>
                <div className="font-bold">{m === 'individual' ? 'Individual' : 'Two teams'}</div>
                <div className="text-[12px] text-mute">{m === 'individual' ? 'Everyone races alone with the same clues.' : 'Shared progress and team scores.'}</div>
              </button>
            ))}
          </div>
        </div>
        {g.mode === 'team' && (
          <div className="grid grid-cols-2 gap-2">
            {teams.map((t) => (
              <label key={t.id} className="block"><span className="label" style={{ color: t.color }}>Team name</span>
                <input className="field" value={teamNames[t.id] ?? ''} maxLength={24} onChange={(e) => setTeamNames({ ...teamNames, [t.id]: e.target.value })} /></label>
            ))}
          </div>
        )}
      </section>

      <section className="panel p-4">
        <h3 className="font-bold">Points</h3>
        <p className="mb-3 text-[13px] text-mute">Destination points are set per destination on the Route tab (default 100).</p>
        <div className="grid grid-cols-3 gap-2">
          <label><span className="label">Hint cost</span>{num('hint_penalty')}</label>
          <label><span className="label">Challenge</span>{num('challenge_points')}</label>
          <label><span className="label">Bonus</span>{num('bonus_points')}</label>
        </div>
      </section>

      <section className="panel p-4 space-y-3">
        <h3 className="font-bold">Emergency contacts</h3>
        <p className="text-[13px] text-mute">Shown to every player on the Safety tab with a one-tap call button. 000 is always shown.</p>
        {contacts.map((c, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <input className="field" placeholder="Name (e.g. Mum)" value={c.name} onChange={(e) => setContacts(contacts.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
            <input className="field" placeholder="04xx xxx xxx" inputMode="tel" value={c.phone} onChange={(e) => setContacts(contacts.map((x, j) => j === i ? { ...x, phone: e.target.value } : x))} />
            <button className="h-12 w-10 text-mute text-xl" aria-label="Remove contact" onClick={() => setContacts(contacts.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
        <Button size="sm" variant="ghost" onClick={() => setContacts([...contacts, { name: '', phone: '' }])}>Add contact</Button>
      </section>

      <section className="panel p-4 space-y-3">
        <h3 className="font-bold">Map</h3>
        <label className="block"><span className="label">Start point name</span>
          <input className="field" value={g.start_name} onChange={(e) => setG({ ...g, start_name: e.target.value })} /></label>
        <Button size="sm" variant="ghost" onClick={() => setShowStartMap((v) => !v)}>{showStartMap ? 'Hide start map' : 'Move start pin'}</Button>
        {showStartMap && (
          <MapView className="h-64 rounded-2xl border border-line" players={[]} locations={{}} waypoints={[]} now={now}
            pick={g.start_lat != null && g.start_lng != null ? { lat: g.start_lat, lng: g.start_lng, radius: 30 } : null}
            onPick={(lat, lng) => setG({ ...g, start_lat: +lat.toFixed(6), start_lng: +lng.toFixed(6) })} />
        )}
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-[#2E8BFF]" checked={g.reveal_finish} onChange={(e) => setG({ ...g, reveal_finish: e.target.checked })} />
          <span className="text-[14px]">Show the final arcade on everyone’s map from the start. Other destinations stay hidden until they’re found.</span>
        </label>
      </section>

      <Button size="lg" className="w-full" loading={busy} onClick={save}>Save settings</Button>
      <Button variant="danger" className="w-full" onClick={onExit}>End, delete or leave game</Button>
    </div>
  );
}
