export type GameStatus = 'lobby' | 'active' | 'paused' | 'ended';
export type GameMode = 'individual' | 'team';

export interface EmergencyContact { name: string; phone: string }

export interface Game {
  id: string;
  code: string;
  name: string;
  host_id: string;
  mode: GameMode;
  status: GameStatus;
  hint_penalty: number;
  challenge_points: number;
  bonus_points: number;
  emergency_contacts: EmergencyContact[];
  start_name: string;
  start_lat: number | null;
  start_lng: number | null;
  reveal_finish: boolean;
  started_at: string | null;
  paused_at: string | null;
  paused_seconds: number;
  ended_at: string | null;
  arcade_ends_at: string | null;
  created_at: string;
}

export interface Team {
  id: string;
  game_id: string;
  name: string;
  color: string;
  current_stage: number;
  finished_at: string | null;
}

export interface Player {
  id: string;
  game_id: string;
  user_id: string;
  username: string;
  avatar: string;
  is_host: boolean;
  competing: boolean;
  team_id: string | null;
  current_stage: number;
  finished_at: string | null;
  sharing_location: boolean;
  location_consent_at: string | null;
  needs_help: boolean;
  last_seen: string;
  created_at: string;
}

export interface Stage {
  id: string;
  game_id: string;
  position: number;
  title: string;
  riddle: string;
  image_url: string | null;
  destination_name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  radius_m: number;
  hint: string | null;
  points: number;
  challenge: string | null;
  safety_note: string | null;
  confirmed: boolean;
  created_at: string;
}

export interface Arrival {
  id: string;
  game_id: string;
  stage_id: string;
  player_id: string | null;
  team_id: string | null;
  method: 'gps' | 'host';
  created_at: string;
}

export interface ScoreEvent {
  id: string;
  game_id: string;
  player_id: string | null;
  team_id: string | null;
  stage_id: string | null;
  kind: 'arrival' | 'hint' | 'challenge' | 'bonus' | 'manual';
  points: number;
  note: string | null;
  created_at: string;
}

export interface PlayerLocation {
  player_id: string;
  game_id: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  fix_at: string | null;
  updated_at: string;
}

export interface ClueView {
  index: number;
  status: 'completed' | 'current';
  id: string;
  title: string;
  riddle: string;
  image_url: string | null;
  radius_m: number;
  points: number;
  has_hint: boolean;
  hint: string | null;
  hint_used: boolean;
  safety_note: string | null;
  destination_name?: string;
  lat?: number | null;
  lng?: number | null;
  challenge?: string | null;
  arrived_at?: string | null;
}

export interface PlayerView {
  status: GameStatus;
  mode: GameMode;
  total: number;
  current_index: number;
  finished_at: string | null;
  no_team: boolean;
  clues: ClueView[];
  finish: { name: string; lat: number; lng: number } | null;
}

export interface ArrivalResult {
  arrived: boolean;
  reason?: string;
  near?: boolean;
  weak_gps?: boolean;
  finished?: boolean;
  destination?: string;
  duplicate?: boolean;
}
