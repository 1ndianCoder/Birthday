import { useEffect, useState, type ReactNode } from 'react';
import { mapsLink } from '../../lib/format';
import { errMsg, rpc, supabase } from '../../lib/supabase';
import type { Game, Stage } from '../../lib/types';
import { MapView } from '../../components/MapView';
import { Button, Pill, Sheet, useNow, useToast } from '../../components/ui';

export function RouteEditor({ game, stages, onChanged }: { game: Game; stages: Stage[]; onChanged: () => void }) {
  const [editing, setEditing] = useState<Stage | null>(null);
  const toast = useToast();
  const running = game.status !== 'lobby';

  const move = async (i: number, dir: -1 | 1) => {
    const ids = stages.map((s) => s.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    try { await rpc('host_reorder', { p_game: game.id, p_ids: ids }); onChanged(); } catch (e) { toast(errMsg(e), 'bad'); }
  };

  const add = async () => {
    const position = (stages[stages.length - 1]?.position ?? 0) + 1;
    const { data, error } = await supabase.from('stages').insert({
      game_id: game.id, position, title: 'New destination', riddle: '', destination_name: '', radius_m: 50, points: 100,
    }).select().single();
    if (error) return toast(error.message, 'bad');
    onChanged();
    setEditing(data as Stage);
  };

  const remove = async (s: Stage) => {
    if (!confirm(`Delete “${s.title}”?`)) return;
    const { error } = await supabase.from('stages').delete().eq('id', s.id);
    if (error) toast(error.message, 'bad'); else onChanged();
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="display text-2xl font-bold">Route</h2>
        <p className="mt-1 text-[14px] text-mute">
          Players see one clue at a time. Each destination unlocks the next. The last destination is the final arcade.
          Check every pin yourself and tick “confirmed” before the game can start.
        </p>
        {running && <p className="mt-2 rounded-xl border border-flare/40 bg-flare/10 p-3 text-[13px] text-flare">The game is running. Changing the order now can confuse players who are mid-clue.</p>}
      </div>

      <div className="panel p-4">
        <div className="text-[13px] font-bold text-mute">Start</div>
        <div className="font-bold">{game.start_name}</div>
        <div className="text-[12px] text-mute">Edit the start point in Settings.</div>
      </div>

      <ol className="space-y-2">
        {stages.map((s, i) => {
          const last = i === stages.length - 1;
          return (
            <li key={s.id} className="panel p-4">
              <div className="flex items-start gap-3">
                <span className={`display grid h-9 w-9 shrink-0 place-items-center rounded-xl font-bold ${last ? 'bg-flare text-base' : 'bg-deck2 border border-line'}`}>{last ? '🕹' : i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{s.title}</div>
                  <div className="text-[13px] text-mute">{s.destination_name || 'No destination set'}{last ? ' (final)' : ''}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {s.confirmed && s.lat != null ? <Pill tone="ok">Confirmed</Pill> : <Pill tone="flare">Needs confirming</Pill>}
                    <Pill>{s.radius_m} m radius</Pill>
                    <Pill>{s.points} pts</Pill>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => setEditing(s)}>Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</Button>
                <Button size="sm" variant="ghost" onClick={() => move(i, 1)} disabled={last} aria-label="Move down">↓</Button>
                <Button size="sm" variant="quiet" className="ml-auto !text-bad" onClick={() => remove(s)}>Delete</Button>
              </div>
            </li>
          );
        })}
      </ol>
      <Button variant="ghost" className="w-full" onClick={add}>Add destination</Button>

      {editing && <StageEditor stage={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged(); }} />}
    </div>
  );
}

function StageEditor({ stage, onClose, onSaved }: { stage: Stage; onClose: () => void; onSaved: () => void }) {
  const [s, setS] = useState<Stage>(stage);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const toast = useToast();
  const now = useNow(5000);
  useEffect(() => setS(stage), [stage]);

  const set = <K extends keyof Stage>(k: K, v: Stage[K]) => setS((x) => ({ ...x, [k]: v }));
  const setPin = (lat: number, lng: number) => setS((x) => ({ ...x, lat: +lat.toFixed(6), lng: +lng.toFixed(6), confirmed: false }));

  const useMyLocation = () => {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setPin(p.coords.latitude, p.coords.longitude); setLocating(false); toast(`Pin set (±${Math.round(p.coords.accuracy)} m)`, 'ok'); },
      (e) => { setLocating(false); toast(e.message || 'Location unavailable', 'bad'); },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };

  const save = async () => {
    if (s.confirmed && (s.lat == null || s.lng == null)) return toast('Set a pin before confirming', 'bad');
    setBusy(true);
    const { error } = await supabase.from('stages').update({
      title: s.title.trim() || 'Untitled', riddle: s.riddle, image_url: s.image_url?.trim() || null,
      destination_name: s.destination_name.trim(), address: s.address?.trim() || null,
      lat: s.lat, lng: s.lng, radius_m: Math.min(500, Math.max(10, Math.round(s.radius_m))),
      hint: s.hint?.trim() || null, points: Math.max(0, Math.round(s.points)),
      challenge: s.challenge?.trim() || null, safety_note: s.safety_note?.trim() || null, confirmed: s.confirmed,
    }).eq('id', s.id);
    setBusy(false);
    if (error) toast(error.message, 'bad'); else { toast('Destination saved', 'ok'); onSaved(); }
  };

  return (
    <Sheet open onClose={onClose} title="Edit destination" wide>
      <div className="space-y-4">
        <Field label="Clue title"><input className="field" value={s.title} maxLength={60} onChange={(e) => set('title', e.target.value)} /></Field>
        <Field label="Riddle"><textarea className="field min-h-[140px]" value={s.riddle} onChange={(e) => set('riddle', e.target.value)} /></Field>
        <Field label="Image link (optional)" note="Paste a link to a public image, e.g. a cropped photo of a detail at the destination.">
          <input className="field" inputMode="url" value={s.image_url ?? ''} onChange={(e) => set('image_url', e.target.value)} placeholder="https://…" />
        </Field>
        <Field label="Hint" note="Players can reveal it for a points penalty.">
          <textarea className="field min-h-[80px]" value={s.hint ?? ''} onChange={(e) => set('hint', e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Destination name"><input className="field" value={s.destination_name} onChange={(e) => set('destination_name', e.target.value)} /></Field>
          <Field label="Address"><input className="field" value={s.address ?? ''} onChange={(e) => set('address', e.target.value)} /></Field>
        </div>

        <div>
          <span className="label">Pin — tap the map to move it</span>
          <MapView className="h-72 rounded-2xl border border-line" players={[]} locations={{}} waypoints={[]} now={now}
            pick={s.lat != null && s.lng != null ? { lat: s.lat, lng: s.lng, radius: s.radius_m } : null} onPick={setPin} />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input className="field" inputMode="decimal" aria-label="Latitude" value={s.lat ?? ''} placeholder="Latitude"
              onChange={(e) => set('lat', e.target.value === '' ? null : Number(e.target.value))} />
            <input className="field" inputMode="decimal" aria-label="Longitude" value={s.lng ?? ''} placeholder="Longitude"
              onChange={(e) => set('lng', e.target.value === '' ? null : Number(e.target.value))} />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" loading={locating} onClick={useMyLocation}>Use my current location</Button>
            {s.lat != null && s.lng != null && <a className="btn h-9 px-3 text-[13px] bg-deck2 border border-line" href={mapsLink(s.lat, s.lng)} target="_blank" rel="noreferrer">Check in Google Maps</a>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Arrival radius (m)" note="50–80 m works well in the city.">
            <input className="field" type="number" min={10} max={500} value={s.radius_m} onChange={(e) => set('radius_m', Number(e.target.value))} />
          </Field>
          <Field label="Points"><input className="field" type="number" min={0} max={1000} value={s.points} onChange={(e) => set('points', Number(e.target.value))} /></Field>
        </div>
        <Field label="Challenge at this destination (optional)" note="Shown after arrival. You award the points from the Players tab.">
          <textarea className="field min-h-[70px]" value={s.challenge ?? ''} onChange={(e) => set('challenge', e.target.value)} />
        </Field>
        <Field label="Safety note"><input className="field" value={s.safety_note ?? ''} onChange={(e) => set('safety_note', e.target.value)} /></Field>

        <label className="flex items-start gap-3 rounded-2xl border border-line bg-deck2 p-4">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-[#35D69B]" checked={s.confirmed} onChange={(e) => set('confirmed', e.target.checked)} />
          <span className="text-[14px]"><b>Confirmed.</b> I’ve checked the pin is in the right place, the spot is public and open at game time, and it can be reached on foot using footpaths and signalled crossings.</span>
        </label>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={busy} onClick={save}>Save</Button>
        </div>
      </div>
    </Sheet>
  );
}

function Field({ label, note, children }: { label: string; note?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {note && <span className="mt-1 block text-[12px] text-mute">{note}</span>}
    </label>
  );
}
