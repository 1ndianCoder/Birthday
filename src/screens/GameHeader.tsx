import type { Game, Player, Team } from '../lib/types';
import { Avatar, Icons, Pill } from '../components/ui';

const statusTone = { lobby: 'mute', active: 'ok', paused: 'flare', ended: 'mute' } as const;
const statusText = { lobby: 'Lobby', active: 'Live', paused: 'Paused', ended: 'Ended' } as const;

export function GameHeader({ game, me, team, connected, sharingOn, onExit }: { game: Game; me: Player; team: Team | null; connected: boolean; sharingOn: boolean; onExit: () => void }) {
  return (
    <header className="sticky top-0 z-[450] border-b border-line bg-base/85 backdrop-blur-xl safe-top">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 pb-3">
        <Avatar emoji={me.avatar} size={38} ring={team?.color} />
        <div className="min-w-0 flex-1">
          <div className="display truncate text-[17px] font-bold leading-tight">{game.name}</div>
          <div className="truncate text-[12px] text-mute">
            {me.username}{team ? `, ${team.name}` : ''}{me.is_host ? ', host' : ''}, code {game.code}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Pill tone={statusTone[game.status]} live={game.status === 'active'}>{statusText[game.status]}</Pill>
          {!connected
            ? <span className="text-[11px] font-bold text-bad">Reconnecting…</span>
            : <span className={`text-[11px] font-bold ${sharingOn ? 'text-ok' : 'text-mute'}`}>{sharingOn ? 'Location on' : 'Location off'}</span>}
        </div>
        <button onClick={onExit} aria-label={me.is_host ? 'End or leave game' : 'Leave game'}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-deck2 text-mute transition active:scale-95">
          <span className="h-5 w-5">{Icons.exit}</span>
        </button>
      </div>
    </header>
  );
}
