import type { Arrival, Game, Player, ScoreEvent, Team } from './types';

export interface BoardRow {
  id: string;
  kind: 'player' | 'team';
  name: string;
  avatar: string;
  color: string;
  stage: number;
  completed: number;
  points: number;
  hints: number;
  finishedAt: string | null;
  members: Player[];
  rank: number;
}

export function buildLeaderboard(game: Game, players: Player[], teams: Team[], scores: ScoreEvent[], arrivals: Arrival[]): BoardRow[] {
  const competitors = players.filter((p) => p.competing && !p.is_host);
  let rows: Omit<BoardRow, 'rank'>[];
  if (game.mode === 'team') {
    rows = teams.map((t) => {
      const ev = scores.filter((e) => e.team_id === t.id);
      return {
        id: t.id, kind: 'team' as const, name: t.name, avatar: '', color: t.color,
        stage: t.current_stage,
        completed: arrivals.filter((a) => a.team_id === t.id).length,
        points: ev.reduce((s, e) => s + e.points, 0),
        hints: ev.filter((e) => e.kind === 'hint').length,
        finishedAt: t.finished_at,
        members: competitors.filter((p) => p.team_id === t.id),
      };
    });
  } else {
    rows = competitors.map((p) => {
      const ev = scores.filter((e) => e.player_id === p.id && !e.team_id);
      return {
        id: p.id, kind: 'player' as const, name: p.username, avatar: p.avatar, color: '#2E8BFF',
        stage: p.current_stage,
        completed: arrivals.filter((a) => a.player_id === p.id && !a.team_id).length,
        points: ev.reduce((s, e) => s + e.points, 0),
        hints: ev.filter((e) => e.kind === 'hint').length,
        finishedAt: p.finished_at,
        members: [p],
      };
    });
  }
  const finishTime = (r: { finishedAt: string | null }) => (r.finishedAt ? new Date(r.finishedAt).getTime() : Infinity);
  rows.sort((a, b) =>
    b.points - a.points ||
    b.completed - a.completed ||
    finishTime(a) - finishTime(b) ||
    a.name.localeCompare(b.name));
  let rank = 0;
  return rows.map((r, i) => {
    const prev = rows[i - 1];
    if (!prev || prev.points !== r.points || prev.completed !== r.completed) rank = i + 1;
    return { ...r, rank };
  });
}

/** Seconds from start until `until` (or now), minus time the host had the game paused. */
export function elapsedSeconds(game: Game, until: string | null): number {
  if (!game.started_at) return 0;
  const end = until ? new Date(until).getTime() : Date.now();
  let paused = game.paused_seconds || 0;
  if (game.paused_at && !until) paused += (Date.now() - new Date(game.paused_at).getTime()) / 1000;
  return Math.max(0, (end - new Date(game.started_at).getTime()) / 1000 - paused);
}
