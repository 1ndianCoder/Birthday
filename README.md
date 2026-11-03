# City Manhunt — Birthday Edition
 
A mobile-first, real-time multiplayer manhunt for Sydney. Players start at Victoria Cross Metro, solve riddles, walk to each destination, and finish at an arcade. Built with React, TypeScript, Tailwind, Supabase (auth, Postgres, Realtime, Row Level Security) and Leaflet/OpenStreetMap. Runs in Safari on iPhone — no App Store.
 
---
 
## 1. Set up Supabase (about 5 minutes)
 
1. Create a free project at **supabase.com**. Pick the **Sydney (ap-southeast-2)** region.
2. **SQL Editor › New query** → paste the whole of `supabase/schema.sql` → **Run**.
   This creates the tables, security rules, realtime publication, game functions and the default Sydney route.
   (Re-running it wipes all manhunt data and starts fresh.)
3. **Authentication › Sign In / Providers** → turn on **Allow anonymous sign-ins**.
   Every phone gets a private anonymous account automatically, so nobody needs an email or password.
4. **Project Settings › API** → copy the **Project URL** and the **anon public** key.
## 2. Run it locally
 
```bash
cp .env.example .env.local      # then paste your URL and anon key into .env.local
npm install
npm run dev
```
 
Location only works on **HTTPS** (or `localhost`), so for testing on phones, deploy it (next step).
 
## 3. Deploy (free) so the iPhones can use it
 
**Vercel:** push this folder to a GitHub repo → vercel.com › Add New Project → import it → add the two environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` → Deploy.
**Netlify:** same idea; build command `npm run build`, publish directory `dist`, add the same two variables.
 
Send everyone the link. On iPhone they can tap **Share › Add to Home Screen** for a full-screen app.
 
---
 
## 4. Before the day (host checklist)
 
1. Open the app → **Host a game** → you get a 6-character code.
2. **Route tab** — the default route is seeded but **every destination starts unconfirmed**:
   - Open each one, check the pin (tap the map to move it, or stand at the spot and tap **Use my current location**), and use **Check in Google Maps** to double-check.
   - Confirm it’s public and open at your game time, and reachable on footpaths with signalled crossings.
   - Tick **Confirmed** and save. The game can’t start until every destination is confirmed.
   - The final arcade is seeded as Timezone George Street (505 George St). Check its opening hours, or swap in another arcade.
3. **Settings tab** — add emergency contacts (parents’ phones), choose individual or team mode, adjust points.
4. Do a test run: join from a second phone, start the game, walk ~50 m to a test destination, then **Reset game**.
### Default route
| # | Destination | Notes |
|---|---|---|
| Start | Victoria Cross Metro Station, Miller St | Coordinates from public station data |
| 1 | Barangaroo Metro Station | One stop on the Metro, under the harbour |
| 2 | Barangaroo Reserve | Headland park built from 10,000+ sandstone blocks |
| 3 | Queen Victoria Building | Sydney CBD |
| 4 | Pyrmont Bridge | Pedestrian swing bridge, Darling Harbour |
| 5 | Tumbalong Park | Southern end of Darling Harbour |
| Final | Timezone George Street | Arcade, ~1 hour |
 
All the riddles, hints and challenges are editable.
 
## 5. On the day
 
- Everyone opens the link → **Join a game** → code, name, avatar.
- Each player chooses whether to share their location (there’s a consent screen first). They can pause it any time from the Map or Safety tab.
- Host taps **Start the hunt**. Everyone gets the first clue with an unlock animation.
- Arrival is detected automatically when sharing is on (checked every 10 s), or players tap **I’m here — check in**.
- If GPS misbehaves (underground, tall buildings), the host taps **Approve arrival** in the Players tab.
- Challenges and bonuses: players show the host, host taps **Challenge +50** / **Bonus +25**.
- At the arcade, start the **60-minute timer** from the Control tab. Then **End game** — this stops all location sharing and deletes every stored position.
---
 
## How it works
 
| Feature | Where |
|---|---|
| Rooms, 6-char codes, join | `create_game` / `join_game` functions in `schema.sql` |
| Live sync | `src/hooks/useGame.ts` — Supabase Realtime postgres changes + Presence (online/offline) |
| Location | `src/hooks/useLocationSharing.ts` — `watchPosition`, sent every 5 s, server timestamps |
| Arrival check | `check_arrival` runs **on the server**, so players never receive future coordinates |
| Clue secrecy | Players can’t read the `stages` table at all; `get_clues` returns only unlocked clues |
| Scoring | `score_events` table; only server functions can write to it |
| Leaderboard | `src/lib/leaderboard.ts` |
 
### Privacy and safety built in
- Location is **off by default**, requires an explicit consent screen, and only works while the game is active or paused (enforced by database rules, not just the app).
- Pausing sharing deletes that player’s stored position. Ending the game deletes all positions.
- Nobody — including the host — can switch on someone else’s sharing.
- Only people in the same game can see positions. Nothing is public.
- Faded markers show “last known position, X ago” rather than pretending a dropped phone is live.
- Safety tab: one-tap 000, host-added contacts, an “Alert the host” button, and street rules.
### iPhone notes
- Safari only sends location while the page is open and the screen is on. Turn on **Keep screen awake** in the Safety tab (uses more battery — bring power banks).
- If location was denied: Settings › Privacy & Security › Location Services › Safari Websites › While Using the App.
- Underground (the Metro), GPS won’t work — the first destination’s radius is generous, and the host can approve arrivals.
### Map tiles
Uses the CARTO Dark Matter basemap built on OpenStreetMap data, which is fine for a small private game. Attribution is shown on the map.
 
