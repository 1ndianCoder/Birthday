-- =====================================================================
-- CITY MANHUNT — Supabase schema
-- Run this whole file once in Supabase: Dashboard > SQL Editor > New query.
-- It is safe to re-run: it drops and recreates the manhunt objects.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- clean re-run ------------------------------------------------
drop table if exists public.locations cascade;
drop table if exists public.score_events cascade;
drop table if exists public.arrivals cascade;
drop table if exists public.stages cascade;
drop table if exists public.players cascade;
drop table if exists public.teams cascade;
drop table if exists public.games cascade;

-- ---------- tables ------------------------------------------------------
create table public.games (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null default 'City Manhunt',
  host_id uuid not null references auth.users(id) on delete cascade,
  mode text not null default 'individual' check (mode in ('individual','team')),
  status text not null default 'lobby' check (status in ('lobby','active','paused','ended')),
  hint_penalty int not null default 20 check (hint_penalty between 0 and 500),
  challenge_points int not null default 50 check (challenge_points between 0 and 500),
  bonus_points int not null default 25 check (bonus_points between 0 and 500),
  emergency_contacts jsonb not null default '[]'::jsonb,
  start_name text not null default 'Victoria Cross Metro Station',
  start_lat double precision,
  start_lng double precision,
  reveal_finish boolean not null default true,
  started_at timestamptz,
  paused_at timestamptz,
  paused_seconds int not null default 0,
  ended_at timestamptz,
  arcade_ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 24),
  color text not null default '#2E8BFF',
  current_stage int not null default 0,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null check (char_length(username) between 1 and 20),
  avatar text not null default '🦊',
  is_host boolean not null default false,
  competing boolean not null default true,
  team_id uuid references public.teams(id) on delete set null,
  current_stage int not null default 0,
  finished_at timestamptz,
  sharing_location boolean not null default false,
  location_consent_at timestamptz,
  needs_help boolean not null default false,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (game_id, user_id)
);

create table public.stages (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  position int not null default 0,
  title text not null default 'New destination',
  riddle text not null default '',
  image_url text,
  destination_name text not null default '',
  address text,
  lat double precision,
  lng double precision,
  radius_m int not null default 50 check (radius_m between 10 and 500),
  hint text,
  points int not null default 100 check (points between 0 and 1000),
  challenge text,
  safety_note text,
  confirmed boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.arrivals (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  stage_id uuid not null references public.stages(id) on delete cascade,
  player_id uuid references public.players(id) on delete set null,
  team_id uuid references public.teams(id) on delete cascade,
  method text not null check (method in ('gps','host')),
  created_at timestamptz not null default now()
);
create unique index arrivals_once on public.arrivals (stage_id, (coalesce(team_id, player_id)));

create table public.score_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid references public.players(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  stage_id uuid references public.stages(id) on delete set null,
  kind text not null check (kind in ('arrival','hint','challenge','bonus','manual')),
  points int not null,
  note text,
  created_at timestamptz not null default now()
);
create unique index hint_once on public.score_events (stage_id, (coalesce(team_id, player_id))) where kind = 'hint';

create table public.locations (
  player_id uuid primary key references public.players(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  fix_at timestamptz,
  updated_at timestamptz not null default now()
);

create index on public.players (game_id);
create index on public.stages (game_id, position);
create index on public.arrivals (game_id);
create index on public.score_events (game_id);
create index on public.locations (game_id);

-- ---------- helpers -----------------------------------------------------
create or replace function public.is_member(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from players where game_id = g and user_id = auth.uid());
$$;

create or replace function public.is_host(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from games where id = g and host_id = auth.uid());
$$;

create or replace function public.can_share(pid uuid, gid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from players p join games g on g.id = p.game_id
    where p.id = pid and p.game_id = gid and p.user_id = auth.uid()
      and p.sharing_location and g.status in ('active','paused')
  );
$$;

create or replace function public._distance_m(lat1 double precision, lng1 double precision,
                                               lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)));
$$;

create or replace function public._stage_at(g uuid, idx int) returns public.stages
language sql stable security definer set search_path = public as $$
  select * from stages where game_id = g order by position, created_at offset idx limit 1;
$$;

-- ---------- triggers ----------------------------------------------------
-- Locations always get a server timestamp (never trust the phone's clock).
create or replace function public._touch_location() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
create trigger locations_touch before insert or update on public.locations
  for each row execute function public._touch_location();

-- Nobody can switch on location sharing for someone else, and pausing
-- sharing immediately deletes the stored location.
create or replace function public._guard_player() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.sharing_location and not old.sharing_location
     and auth.uid() is not null and new.user_id <> auth.uid() then
    raise exception 'Only the player can turn on their own location sharing';
  end if;
  if old.sharing_location and not new.sharing_location then
    delete from locations where player_id = new.id;
  end if;
  return new;
end $$;
create trigger players_guard before update on public.players
  for each row execute function public._guard_player();

-- ---------- row level security -----------------------------------------
alter table public.games enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.stages enable row level security;
alter table public.arrivals enable row level security;
alter table public.score_events enable row level security;
alter table public.locations enable row level security;

revoke all on public.games, public.teams, public.players, public.stages,
              public.arrivals, public.score_events, public.locations from anon;

-- games: members read; host edits settings (status changes go through RPCs)
create policy games_select on public.games for select using (is_member(id));
create policy games_update on public.games for update using (is_host(id)) with check (is_host(id));
create policy games_delete on public.games for delete using (is_host(id));
revoke insert, update on public.games from authenticated;
grant update (name, mode, hint_penalty, challenge_points, bonus_points, emergency_contacts,
              start_name, start_lat, start_lng, reveal_finish, arcade_ends_at)
  on public.games to authenticated;

-- teams: members read; host renames
create policy teams_select on public.teams for select using (is_member(game_id));
create policy teams_update on public.teams for update using (is_host(game_id)) with check (is_host(game_id));
revoke insert, update, delete on public.teams from authenticated;
grant update (name, color) on public.teams to authenticated;

-- players: members read; players edit their own profile/sharing; host can clear help flags
create policy players_select on public.players for select using (is_member(game_id));
create policy players_update on public.players for update
  using (user_id = auth.uid() or is_host(game_id))
  with check (user_id = auth.uid() or is_host(game_id));
create policy players_delete on public.players for delete using (user_id = auth.uid() or is_host(game_id));
revoke insert, update on public.players from authenticated;
grant update (username, avatar, sharing_location, location_consent_at, needs_help, last_seen)
  on public.players to authenticated;

-- stages: ONLY the host can read them directly. Players get unlocked clues via get_clues().
create policy stages_host on public.stages for all using (is_host(game_id)) with check (is_host(game_id));

-- arrivals and scores: members read; writes only through RPCs
create policy arrivals_select on public.arrivals for select using (is_member(game_id));
create policy scores_select on public.score_events for select using (is_member(game_id));
revoke insert, update, delete on public.arrivals, public.score_events from authenticated;

-- locations: members of the same game read; you can only write your own, only while sharing,
-- only while the game is active or paused
create policy loc_select on public.locations for select using (is_member(game_id));
create policy loc_insert on public.locations for insert with check (can_share(player_id, game_id));
create policy loc_update on public.locations for update
  using (can_share(player_id, game_id)) with check (can_share(player_id, game_id));
create policy loc_delete on public.locations for delete using (
  exists (select 1 from players p where p.id = player_id and p.user_id = auth.uid()) or is_host(game_id));

-- ---------- realtime ----------------------------------------------------
alter publication supabase_realtime add table public.games, public.teams, public.players,
  public.stages, public.arrivals, public.score_events, public.locations;

-- ---------- default route ----------------------------------------------
-- Coordinates: Victoria Cross is from public station data. Every stage below starts
-- UNCONFIRMED with approximate coordinates — the host must check each pin on the map
-- (or stand there and tap "Use my location") and tick "confirmed" before the game can start.
create or replace function public._seed_route(g uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into stages (game_id, position, title, riddle, destination_name, address, lat, lng, radius_m, hint, points, challenge, safety_note)
  values
  (g, 1, 'The giant coat hanger',
   E'Your first mission: cross the most famous bridge in Sydney! 🌉\n\nPeople call it "the Coathanger" because of its shape.\n\nWalk all the way across it, then find the park right UNDERNEATH the bridge, next to the water.\n\nIf you look up and the bridge is right above your head, you''ve found it!',
   'Dawes Point Park (under the Harbour Bridge)', 'Hickson Road, Dawes Point NSW 2000', -33.853949, 151.208883, 80,
   'It''s the Sydney Harbour Bridge! Walk to Milsons Point and go up the stairs onto the bridge footpath. Walk across, take the stairs down into The Rocks, then walk downhill to the water. The park is right under the bridge.',
   100, 'Take a group photo with the whole bridge behind you!',
   'Stay on the footpath and stick together. Never climb on the fences or railings.'),
  (g, 2, 'Something smells yummy',
   E'Now follow the water south, with the harbour on your right. 🌊\n\nKeep walking until you reach the tall shiny towers of Barangaroo.\n\nSniff the air! Find a bakery that''s named after a street:\n\nB _ _ _ _ _   Street Bakery 🥐',
   'Bourke Street Bakery Barangaroo', 'Barangaroo Avenue, Barangaroo NSW 2000', -33.864522, 151.201427, 80,
   'The answer is Bourke Street Bakery! Walk along Hickson Road to Barangaroo. The bakery is on Barangaroo Avenue, near the big towers.',
   100, 'Everyone says their favourite thing from a bakery. The host picks the funniest answer!',
   'Hickson Road has cars and buses. Stay on the footpath and cross at the lights.'),
  (g, 3, 'Ice cream train ride',
   E'Time to ride the train that has no driver! 🚇\n\nGo down into Barangaroo Metro Station and ride the train towards Sydenham. Get off after 4 stops, at Waterloo.\n\nThen find a sweet, cold treat with LOTS of flavours on Locomotive Street. 🍨\n\n(Psst — "locomotive" is another word for train!)',
   'ANITA Gelato South Eveleigh', 'Locomotive Street, Eveleigh NSW 2015', -33.894746, 151.196803, 70,
   'It''s ANITA Gelato! Take the Metro from Barangaroo to Waterloo (4 stops). Then walk west for about 5 to 10 minutes into South Eveleigh to Locomotive Street.',
   100, 'Everyone tries a different flavour and describes it in just ONE word!',
   'Stand behind the yellow line on the platform and hold the rail on the escalators.'),
  (g, 4, 'The finish line',
   E'Last mission! 🏁\n\nWalk back to the station where the train dropped you off.\n\nThe brand new buildings sitting right on TOP of that station are the finish line.\n\nGet there first to win!',
   'Waterloo Metro Quarter', 'Raglan Street, Waterloo NSW 2017', -33.896768, 151.199751, 90,
   'Walk back east to Waterloo Metro Station on Raglan Street. The finish is the Waterloo Metro Quarter, right on top of the station.',
   100, null,
   'Botany Road is busy. Only cross at the lights when the green man shows.');

  update games set start_name = 'Victoria Cross Station (McLaren Street)',
    start_lat = -33.834761, start_lng = 151.207813, hint_penalty = 10 where id = g;
end $$;

-- ---------- RPCs: joining ----------------------------------------------
create or replace function public.create_game(p_name text, p_username text, p_avatar text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_code text; v_id uuid;
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from games where code = v_code);
  end loop;
  insert into games (code, name, host_id) values (v_code, coalesce(nullif(trim(p_name), ''), 'City Manhunt'), auth.uid())
    returning id into v_id;
  insert into players (game_id, user_id, username, avatar, is_host, competing)
    values (v_id, auth.uid(), left(trim(p_username), 20), p_avatar, true, false);
  insert into teams (game_id, name, color) values (v_id, 'Team Blue', '#2E8BFF'), (v_id, 'Team Orange', '#FF8A1F');
  perform _seed_route(v_id);
  return v_id;
end $$;

create or replace function public.join_game(p_code text, p_username text, p_avatar text)
returns uuid language plpgsql security definer set search_path = public as $$
declare g games; v_team uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if char_length(trim(coalesce(p_username, ''))) = 0 then raise exception 'Choose a username'; end if;
  select * into g from games where code = upper(trim(p_code));
  if g.id is null then raise exception 'No game uses that code. Check it with the host.'; end if;
  if g.status = 'ended' then raise exception 'That game has already ended.'; end if;
  if exists (select 1 from players where game_id = g.id and user_id = auth.uid()) then
    update players set username = left(trim(p_username), 20), avatar = p_avatar
      where game_id = g.id and user_id = auth.uid();
    return g.id;
  end if;
  if (select count(*) from players where game_id = g.id) >= 16 then
    raise exception 'This game is full.';
  end if;
  if exists (select 1 from players where game_id = g.id and lower(username) = lower(trim(p_username))) then
    raise exception 'Someone already uses that name. Pick another.';
  end if;
  if g.mode = 'team' then
    select t.id into v_team from teams t where t.game_id = g.id
      order by (select count(*) from players p where p.team_id = t.id), t.created_at limit 1;
  end if;
  insert into players (game_id, user_id, username, avatar, team_id)
    values (g.id, auth.uid(), left(trim(p_username), 20), p_avatar, v_team);
  return g.id;
end $$;

-- ---------- RPCs: playing ----------------------------------------------
create or replace function public._advance(g public.games, s public.stages, p_player uuid, p_team uuid, p_method text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n int; total int; newcur int; fin boolean := false;
begin
  insert into arrivals (game_id, stage_id, player_id, team_id, method)
    values (g.id, s.id, p_player, p_team, p_method) on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('duplicate', true); end if;
  insert into score_events (game_id, player_id, team_id, stage_id, kind, points, note)
    values (g.id, p_player, p_team, s.id, 'arrival', s.points, s.destination_name);
  select count(*) into total from stages where game_id = g.id;
  if p_team is not null then
    update teams set current_stage = current_stage + 1 where id = p_team returning current_stage into newcur;
    if newcur >= total then update teams set finished_at = now() where id = p_team; fin := true; end if;
  else
    update players set current_stage = current_stage + 1 where id = p_player returning current_stage into newcur;
    if newcur >= total then update players set finished_at = now() where id = p_player; fin := true; end if;
  end if;
  return jsonb_build_object('stage_title', s.title, 'destination', s.destination_name, 'finished', fin, 'new_index', newcur);
end $$;

create or replace function public.get_clues(p_game uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  me players; g games; t teams; cur int; fin timestamptz; total int; unit uuid; unit_team uuid;
  clues jsonb := '[]'::jsonb; r record; idx int := 0; used boolean; arr timestamptz;
  last_stage stages; finish jsonb;
begin
  select * into me from players where game_id = p_game and user_id = auth.uid();
  if me.id is null then raise exception 'You are not in this game'; end if;
  select * into g from games where id = p_game;
  select count(*) into total from stages where game_id = p_game;

  if g.mode = 'team' then
    if me.team_id is null then
      return jsonb_build_object('status', g.status, 'mode', g.mode, 'total', total, 'current_index', 0,
        'finished_at', null, 'no_team', true, 'clues', '[]'::jsonb, 'finish', null);
    end if;
    select * into t from teams where id = me.team_id;
    cur := t.current_stage; fin := t.finished_at; unit_team := t.id; unit := t.id;
  else
    cur := me.current_stage; fin := me.finished_at; unit := me.id;
  end if;

  select * into last_stage from stages where game_id = p_game order by position desc, created_at desc limit 1;
  if last_stage.id is not null and last_stage.lat is not null and (g.reveal_finish or cur >= total) then
    finish := jsonb_build_object('name', last_stage.destination_name, 'lat', last_stage.lat, 'lng', last_stage.lng);
  end if;

  if g.status <> 'lobby' then
    for r in select * from stages where game_id = p_game order by position, created_at loop
      exit when idx > cur;
      select exists (select 1 from score_events e where e.stage_id = r.id and e.kind = 'hint'
                     and coalesce(e.team_id, e.player_id) = unit) into used;
      if idx < cur then
        select a.created_at into arr from arrivals a
          where a.stage_id = r.id and coalesce(a.team_id, a.player_id) = unit limit 1;
        clues := clues || jsonb_build_object('index', idx, 'status', 'completed', 'id', r.id,
          'title', r.title, 'riddle', r.riddle, 'image_url', r.image_url, 'radius_m', r.radius_m,
          'points', r.points, 'has_hint', coalesce(r.hint, '') <> '', 'hint', case when used then r.hint end,
          'hint_used', used, 'safety_note', r.safety_note, 'destination_name', r.destination_name,
          'lat', r.lat, 'lng', r.lng, 'challenge', r.challenge, 'arrived_at', arr);
      else
        clues := clues || jsonb_build_object('index', idx, 'status', 'current', 'id', r.id,
          'title', r.title, 'riddle', r.riddle, 'image_url', r.image_url, 'radius_m', r.radius_m,
          'points', r.points, 'has_hint', coalesce(r.hint, '') <> '', 'hint', case when used then r.hint end,
          'hint_used', used, 'safety_note', r.safety_note);
      end if;
      idx := idx + 1;
    end loop;
  end if;

  return jsonb_build_object('status', g.status, 'mode', g.mode, 'total', total, 'current_index', cur,
    'finished_at', fin, 'no_team', false, 'clues', clues, 'finish', finish);
end $$;

create or replace function public.check_arrival(p_game uuid, p_lat double precision, p_lng double precision,
                                                p_accuracy double precision default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me players; g games; t teams; s stages; cur int; d double precision; tol double precision; v_team uuid;
begin
  select * into me from players where game_id = p_game and user_id = auth.uid();
  if me.id is null then raise exception 'You are not in this game'; end if;
  select * into g from games where id = p_game;
  if g.status <> 'active' then return jsonb_build_object('arrived', false, 'reason', g.status); end if;
  if not me.competing then return jsonb_build_object('arrived', false, 'reason', 'not_competing'); end if;
  if g.mode = 'team' then
    if me.team_id is null then return jsonb_build_object('arrived', false, 'reason', 'no_team'); end if;
    select * into t from teams where id = me.team_id;
    cur := t.current_stage; v_team := t.id;
  else
    cur := me.current_stage;
  end if;
  s := _stage_at(p_game, cur);
  if s.id is null then return jsonb_build_object('arrived', false, 'reason', 'finished'); end if;
  if s.lat is null or s.lng is null then return jsonb_build_object('arrived', false, 'reason', 'no_destination'); end if;
  d := _distance_m(p_lat, p_lng, s.lat, s.lng);
  tol := least(greatest(coalesce(p_accuracy, 0), 0), 25);
  if d - tol <= s.radius_m then
    return _advance(g, s, me.id, v_team, 'gps') || jsonb_build_object('arrived', true);
  end if;
  return jsonb_build_object('arrived', false, 'reason', 'too_far', 'near', d < 250,
                            'weak_gps', coalesce(p_accuracy, 0) > 100);
end $$;

create or replace function public.use_hint(p_game uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me players; g games; t teams; s stages; cur int; v_team uuid;
begin
  select * into me from players where game_id = p_game and user_id = auth.uid();
  if me.id is null then raise exception 'You are not in this game'; end if;
  select * into g from games where id = p_game;
  if g.status <> 'active' then raise exception 'Hints are only available while the game is running'; end if;
  if g.mode = 'team' then
    select * into t from teams where id = me.team_id;
    if t.id is null then raise exception 'Join a team first'; end if;
    cur := t.current_stage; v_team := t.id;
  else
    cur := me.current_stage;
  end if;
  s := _stage_at(p_game, cur);
  if s.id is null or coalesce(s.hint, '') = '' then raise exception 'There is no hint for this clue'; end if;
  insert into score_events (game_id, player_id, team_id, stage_id, kind, points, note)
    values (p_game, me.id, v_team, s.id, 'hint', -g.hint_penalty, s.title) on conflict do nothing;
  return jsonb_build_object('hint', s.hint);
end $$;

-- ---------- RPCs: host -------------------------------------------------
create or replace function public.host_set_status(p_game uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare g games;
begin
  if not is_host(p_game) then raise exception 'Only the host can do that'; end if;
  select * into g from games where id = p_game;
  if p_status = 'active' and g.status = 'lobby' then
    if not exists (select 1 from stages where game_id = p_game) then
      raise exception 'Add at least one destination before starting'; end if;
    if exists (select 1 from stages where game_id = p_game and (not confirmed or lat is null or lng is null)) then
      raise exception 'Confirm every destination on the route before starting'; end if;
    if g.mode = 'team' and exists (select 1 from players where game_id = p_game and competing and team_id is null) then
      raise exception 'Put every player in a team before starting'; end if;
    update games set status = 'active', started_at = now(), paused_at = null, paused_seconds = 0, ended_at = null where id = p_game;
  elsif p_status = 'paused' and g.status = 'active' then
    update games set status = 'paused', paused_at = now() where id = p_game;
  elsif p_status = 'active' and g.status = 'paused' then
    update games set status = 'active',
      paused_seconds = paused_seconds + coalesce(extract(epoch from now() - paused_at)::int, 0),
      paused_at = null where id = p_game;
  elsif p_status = 'ended' and g.status <> 'ended' then
    update games set status = 'ended', ended_at = now(),
      paused_seconds = paused_seconds + coalesce(extract(epoch from now() - paused_at)::int, 0),
      paused_at = null where id = p_game;
    update players set sharing_location = false where game_id = p_game;
    delete from locations where game_id = p_game;
  else
    raise exception 'Can''t change the game from % to %', g.status, p_status;
  end if;
end $$;

create or replace function public.host_reset(p_game uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_host(p_game) then raise exception 'Only the host can do that'; end if;
  delete from arrivals where game_id = p_game;
  delete from score_events where game_id = p_game;
  delete from locations where game_id = p_game;
  update players set current_stage = 0, finished_at = null, sharing_location = false, needs_help = false where game_id = p_game;
  update teams set current_stage = 0, finished_at = null where game_id = p_game;
  update games set status = 'lobby', started_at = null, paused_at = null, paused_seconds = 0,
    ended_at = null, arcade_ends_at = null where id = p_game;
end $$;

create or replace function public.host_approve_arrival(p_game uuid, p_player uuid default null, p_team uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare g games; s stages; cur int;
begin
  if not is_host(p_game) then raise exception 'Only the host can do that'; end if;
  select * into g from games where id = p_game;
  if g.status not in ('active','paused') then raise exception 'Start the game first'; end if;
  if p_team is not null then
    select current_stage into cur from teams where id = p_team and game_id = p_game;
  else
    select current_stage into cur from players where id = p_player and game_id = p_game;
  end if;
  if cur is null then raise exception 'Player or team not found'; end if;
  s := _stage_at(p_game, cur);
  if s.id is null then raise exception 'They have already finished'; end if;
  return _advance(g, s, p_player, p_team, 'host');
end $$;

create or replace function public.host_award(p_game uuid, p_player uuid, p_team uuid, p_kind text,
                                             p_points int, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_host(p_game) then raise exception 'Only the host can do that'; end if;
  if p_kind not in ('challenge','bonus','manual') then raise exception 'Unknown award type'; end if;
  insert into score_events (game_id, player_id, team_id, kind, points, note)
    values (p_game, p_player, p_team, p_kind, p_points, p_note);
end $$;

create or replace function public.host_set_team(p_player uuid, p_team uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_game uuid;
begin
  select game_id into v_game from players where id = p_player;
  if not is_host(v_game) then raise exception 'Only the host can do that'; end if;
  if p_team is not null and not exists (select 1 from teams where id = p_team and game_id = v_game) then
    raise exception 'That team is not in this game'; end if;
  update players set team_id = p_team where id = p_player;
end $$;

create or replace function public.host_set_competing(p_player uuid, p_competing boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_game uuid;
begin
  select game_id into v_game from players where id = p_player;
  if not is_host(v_game) then raise exception 'Only the host can do that'; end if;
  update players set competing = p_competing where id = p_player and not is_host;
end $$;

create or replace function public.host_reorder(p_game uuid, p_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_host(p_game) then raise exception 'Only the host can do that'; end if;
  for i in 1..coalesce(array_length(p_ids, 1), 0) loop
    update stages set position = i where id = p_ids[i] and game_id = p_game;
  end loop;
end $$;

-- Only signed-in users may call the RPCs
revoke execute on all functions in schema public from anon;
grant execute on function public.create_game, public.join_game, public.get_clues, public.check_arrival,
  public.use_hint, public.host_set_status, public.host_reset, public.host_approve_arrival,
  public.host_award, public.host_set_team, public.host_set_competing, public.host_reorder
  to authenticated;
-- Internal helpers must never be callable from the browser (they would bypass the rules).
revoke execute on function public._advance(public.games, public.stages, uuid, uuid, text),
  public._seed_route(uuid), public._stage_at(uuid, int) from public, anon, authenticated;
