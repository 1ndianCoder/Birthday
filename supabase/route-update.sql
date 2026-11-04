-- =====================================================================
-- CITY MANHUNT — birthday route (kid-friendly secret-code clues)
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
   E'🔐 Crack the secret code!\n\nEvery letter has moved ONE step forward in the alphabet. To read it, move each letter back one: B becomes A, C becomes B, and A becomes Z.\n\nXbml bdsptt uif cjh csjehf uifo hp voefs ju',
   'Dawes Point Park (under the Harbour Bridge)', 'Hickson Road, Dawes Point NSW 2000', -33.853949, 151.208883, 80,
   'The code says: "Walk across the big bridge then go under it". It''s the Sydney Harbour Bridge! Go up the stairs at Milsons Point, walk across, take the stairs down into The Rocks, then walk downhill to the park right under the bridge.',
   100, 'Take a group photo with the whole bridge behind you!',
   'Stay on the footpath and stick together. Never climb on the fences or railings.'),
  (g, 2, 'Something smells yummy',
   E'🔐 Crack the secret code!\n\nEvery letter has moved ONE step forward in the alphabet. To read it, move each letter back one: B becomes A, C becomes B, and A becomes Z.\n\nGpmmpx uif xbufs up b cblfsz obnfe bgufs b tusffu',
   'Bourke Street Bakery Barangaroo', 'Barangaroo Avenue, Barangaroo NSW 2000', -33.864522, 151.201427, 80,
   'The code says: "Follow the water to a bakery named after a street". It''s Bourke Street Bakery! Walk along Hickson Road with the water on your right to Barangaroo. The bakery is on Barangaroo Avenue, near the big towers.',
   100, 'Everyone says their favourite thing from a bakery. The host picks the funniest answer!',
   'Hickson Road has cars and buses. Stay on the footpath and cross at the lights.'),
  (g, 3, 'Ice cream train ride',
   E'🔐 Crack the secret code!\n\nEvery letter has moved ONE step forward in the alphabet. To read it, move each letter back one: B becomes A, C becomes B, and A becomes Z.\n\nSjef uif nfusp gpvs tupqt uifo gjoe hfmbup',
   'ANITA Gelato South Eveleigh', 'Locomotive Street, Eveleigh NSW 2015', -33.894746, 151.196803, 70,
   'The code says: "Ride the metro four stops then find gelato". Take the Metro from Barangaroo towards Sydenham and get off at Waterloo (4 stops). Then walk west for about 5 to 10 minutes to ANITA Gelato on Locomotive Street, South Eveleigh.',
   100, 'Everyone tries a different flavour and describes it in just ONE word!',
   'Stand behind the yellow line on the platform and hold the rail on the escalators.'),
  (g, 4, 'The finish line',
   E'🔐 Crack the secret code!\n\nEvery letter has moved ONE step forward in the alphabet. To read it, move each letter back one: B becomes A, C becomes B, and A becomes Z.\n\nXbml cbdl up uif tubujpo boe gjoe uif gjojti po upq',
   'Waterloo Metro Quarter', 'Raglan Street, Waterloo NSW 2017', -33.896768, 151.199751, 90,
   'The code says: "Walk back to the station and find the finish on top". Walk back east to Waterloo Metro Station on Raglan Street. The finish is the Waterloo Metro Quarter, right on top of the station.',
   100, null,
   'Botany Road is busy. Only cross at the lights when the green man shows.');

  update games set start_name = 'Victoria Cross Station (McLaren Street)',
    start_lat = -33.834761, start_lng = 151.207813, hint_penalty = 10 where id = g;
end $$;
