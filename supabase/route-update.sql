-- =====================================================================
-- CITY MANHUNT — birthday route (kid-friendly)
-- Run this once in Supabase: Dashboard > SQL Editor > New query > Run.
-- It only replaces the default route used by NEW games. Existing games,
-- players and scores are not touched.
--
-- Victoria Cross → under the Harbour Bridge → Bourke Street Bakery
-- Barangaroo → ANITA Gelato South Eveleigh → Waterloo Metro Quarter
-- =====================================================================

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
