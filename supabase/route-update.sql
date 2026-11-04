-- =====================================================================
-- CITY MANHUNT — birthday route (kid-friendly secret-code clues)
-- Run this once in Supabase: Dashboard > SQL Editor > New query > Run.
-- It only replaces the default route used by NEW games. Existing games,
-- players and scores are not touched.
--
-- Victoria Cross → under the Harbour Bridge → Darling Harbour (SEA LIFE)
-- → ANITA Gelato South Eveleigh → Waterloo Metro Quarter. All walking.
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
  (g, 2, 'Where the sharks live',
   E'🔐 Crack the secret code!\n\nEvery letter has moved ONE step forward in the alphabet. To read it, move each letter back one: B becomes A, C becomes B, and A becomes Z.\n\nGpmmpx uif xbufs up uif brvbsjvn gvmm pg tibslt',
   'Darling Harbour (Pier 26, by SEA LIFE Aquarium)', 'Pier 26, Wheat Road, Darling Harbour NSW 2000', -33.870145, 151.202082, 80,
   'The code says: "Follow the water to the aquarium full of sharks". It''s SEA LIFE Sydney Aquarium at Darling Harbour! Walk along Hickson Road past Barangaroo with the water on your right. Keep going south until you reach Darling Harbour. The aquarium is right next to Pier 26.',
   100, 'Everyone does their best shark impression. The host picks the scariest one!',
   'Keep well back from the edge of the wharf and stick together.'),
  (g, 3, 'Ice cream at the end of a long walk',
   E'🔐 Crack the secret code!\n\nEvery letter has moved ONE step forward in the alphabet. To read it, move each letter back one: B becomes A, C becomes B, and A becomes Z.\n\nXbml tpvui up b usbjo tusffu boe gjoe hfmbup',
   'ANITA Gelato South Eveleigh', '2 Locomotive Street, Eveleigh NSW 2015', -33.894748, 151.196803, 70,
   'The code says: "Walk south to a train street and find gelato". It''s ANITA Gelato at 2 Locomotive Street, South Eveleigh (locomotive means train!). Walk south through Tumbalong Park, cross Broadway at the lights, then keep heading south through Chippendale to South Eveleigh. It''s about 3.5 km, roughly an hour, so use walking directions in Maps if you need to.',
   100, 'Everyone tries a different flavour and describes it in just ONE word!',
   'This is the longest walk. Drink water, take breaks, and only cross big roads like Broadway at the lights.'),
  (g, 4, 'The finish line',
   E'🔐 Crack the secret code!\n\nEvery letter has moved ONE step forward in the alphabet. To read it, move each letter back one: B becomes A, C becomes B, and A becomes Z.\n\nXbml up uif ofx nfusp tubujpo boe gjoe uif gjojti po upq',
   'Waterloo Metro Quarter', 'Raglan Street, Waterloo NSW 2017', -33.896768, 151.199751, 90,
   'The code says: "Walk to the new metro station and find the finish on top". Walk about 5 minutes south-east to Waterloo Metro Station on Raglan Street. The finish is the Waterloo Metro Quarter, the new buildings right on top of the station.',
   100, null,
   'Botany Road is busy. Only cross at the lights when the green man shows.');

  update games set start_name = 'Victoria Cross Station (McLaren Street)',
    start_lat = -33.834763, start_lng = 151.207813, hint_penalty = 10 where id = g;
end $$;
