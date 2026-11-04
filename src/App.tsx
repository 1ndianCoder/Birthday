import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { configured, ensureSession, errMsg, supabase } from './lib/supabase';
import type { Player } from './lib/types';
import { useGame } from './hooks/useGame';
import { Landing } from './screens/Landing';
import { PlayerApp } from './screens/PlayerApp';
import { HostApp } from './screens/host/HostApp';
import { SetupScreen } from './screens/SetupScreen';
import { Button, useToast } from './components/ui';

const GAME_KEY = 'manhunt-game';

export function App() {
  const [userId, setUserId] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string | null>(localStorage.getItem(GAME_KEY));
  const [me, setMe] = useState<Player | null>(null);
  const [booting, setBooting] = useState(true);
  const [fatal, setFatal] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (!configured) { setBooting(false); return; }
    ensureSession()
      .then((s) => setUserId(s.user.id))
      .catch((e) => setFatal(`${errMsg(e)}. In Supabase, turn on Authentication › Sign In / Providers › Allow anonymous sign-ins.`))
      .finally(() => setBooting(false));
  }, []);

  const loadMe = useCallback(async (gid: string, uid: string) => {
    const { data, error } = await supabase.from('players').select('*').eq('game_id', gid).eq('user_id', uid).maybeSingle();
    if (error) { toast(error.message, 'bad'); return; }
    if (!data) {
      localStorage.removeItem(GAME_KEY);
      setGameId(null);
      setMe(null);
      return;
    }
    setMe(data as Player);
  }, [toast]);

  useEffect(() => {
    if (userId && gameId) loadMe(gameId, userId);
  }, [userId, gameId, loadMe]);

  const enter = (id: string) => {
    localStorage.setItem(GAME_KEY, id);
    setMe(null);
    setGameId(id);
  };
  const leave = () => {
    localStorage.removeItem(GAME_KEY);
    setGameId(null);
    setMe(null);
  };

  if (!configured) return <SetupScreen />;
  if (booting) return <Splash />;
  if (fatal) return <Centered><p className="text-bad font-bold">Can’t connect</p><p className="mt-2 text-mute">{fatal}</p><Button className="mt-6" onClick={() => location.reload()}>Try again</Button></Centered>;
  if (!gameId || !userId) return <Landing onEnter={enter} />;
  if (!me) return <Splash />;
  return <GameShell gameId={gameId} meId={me.id} onLeave={leave} />;
}

function GameShell({ gameId, meId, onLeave }: { gameId: string; meId: string; onLeave: () => void }) {
  const data = useGame(gameId, meId);
  const me = data.players.find((p) => p.id === meId) ?? null;

  // Removed by the host, or the game was deleted.
  useEffect(() => {
    if (!data.loading && data.players.length > 0 && !me) onLeave();
    if (!data.loading && !data.game && !data.error) onLeave();
  }, [data.loading, data.players.length, me, data.game, data.error, onLeave]);

  if (data.loading || !data.game || !me) return <Splash />;
  return me.is_host ? <HostApp data={data} me={me} onLeave={onLeave} /> : <PlayerApp data={data} me={me} onLeave={onLeave} />;
}

function Splash() {
  return (
    <Centered>
      <div className="relative h-24 w-24"><div className="unlock-ring !h-24 !w-24" /></div>
      <p className="display mt-6 text-mute">Connecting to mission control…</p>
    </Centered>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex min-h-full flex-col items-center justify-center px-8 text-center">{children}</div>;
}
