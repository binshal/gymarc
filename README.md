# GymArc — Phase 1 + 2

What's built:
- Next.js 14 (App Router) + Tailwind, dark-mode-first, responsive (bottom
  nav on mobile, sidebar on desktop/laptop)
- Username-only auth via a hidden `username@gymarc.internal` email under the
  hood — real Supabase Auth underneath, no email ever shown to the user
- Signup flow that generates and displays a 6-digit recovery code once
- Password reset using username + recovery code, with a 5-attempt lockout
- Home dashboard shell matching the approved mockup: macro card, streak,
  weight card, and a **Start Workout** button that opens a day picker
  instead of assuming a fixed day
- Placeholder Food / Workout / Feed / Profile pages
- Supabase schema (`supabase/schema.sql`) covering every table we discussed:
  profiles, goals, weight/water/supplement logs, foods, exercises, splits,
  workout sessions/sets, measurements, photos, likes, comments

## Setup

1. `npm install`
2. Create a Supabase project, run `supabase/schema.sql` in its SQL editor
3. Copy `.env.example` to `.env.local` and fill in your Supabase URL + keys
   (get the service role key from Project Settings → API — keep it secret)
4. `npm run dev`

## Phase 2 — added
- Full Row Level Security policies for every table (`supabase/schema.sql`),
  plus `supabase/seed.sql` with a starter exercise library (25 common lifts)
- **Workout tab**: create/edit/delete splits and days, rename days inline
- **Edit Day page**: add exercises from the library or create custom ones,
  mark an exercise as a primary set or an alternate, remove exercises
- **Active workout screen**: previous-session weight/reps shown per exercise,
  set logging with both a keyboard input and +/− steppers, set types
  (warmup/working/drop/failure), a rest timer that starts on each completed
  set, automatic PR detection with a badge, adding an alternate exercise
  mid-workout, and Finish Workout
- **Home tab**: Start Workout now opens a picker of the active split's real
  days (no hardcoded day name), a working Rest Day button, a real streak
  count, and last logged weight
- Session persistence: refreshing mid-workout reuses today's unfinished
  session for that day instead of creating a duplicate

## Phase 3 — added (Food & Goals)
- **Goals** (`/food/goal`): set type (bulk/cut/maintenance), duration
  (14/30/60/90 days), and daily targets (calories/protein/carbs/fat) plus
  optional target weight. Starting a new goal auto-completes the old one.
  "End this goal" lets you stop early without starting a new one.
- **Food tab**: manual entry (name, calories, protein, carbs, fat) with
  unlimited custom fields (e.g. fiber, sugar), optional "save as favorite,"
  a horizontal quick-add strip of recent/favorite foods, today's progress
  bars against your goal's targets, and today's log with delete
- **Home dashboard**: the macro card is now live — real rings for
  calories/protein/carbs/fat against your active goal, tapping it opens
  the Food tab

## Phase 3b — added (Water, Supplements, Weight)
- **Water** (Food tab): progress bar against a daily target (default 3000ml,
  tap the ml/L label to change it), +250ml/+500ml quick-add, custom amount
- **Supplements** (Food tab): add your own (name + dose), a daily
  checklist to tick off, delete a supplement entirely
- **Weight** (Home): tap the Weight card to log — pick a date (so you can
  backfill a day you skipped) and a value. Logging again for a date you
  already logged updates it rather than duplicating.
- **Weight history** (Profile tab): expandable list of every logged
  weight, editable inline, deletable — this is what the weight chart
  (next phase) will read from

Run `supabase/migrations/02_water_target.sql` once — it adds the water
target column to `profiles` (already included in `schema.sql` for anyone
setting up fresh).

## Phase 4 — added (Progress & Charts)
New **Progress** tab (own spot in the nav, between Workout and Feed):
- **Exercise progress**: pick any exercise you've logged, see a line chart
  of your top-set weight and estimated 1RM (Epley formula) per session
- **Weekly volume by muscle group**: stacked bar chart, last 6 weeks,
  volume = Σ(weight × reps) per muscle group, warmup sets excluded
- **Streak calendar**: 42-day grid — red for a workout day, green for a
  rest day, grey for nothing logged — plus the current streak count

## Phase 5 — added (Feed)
- **Feed tab**: every finished workout from every user, newest first.
  Collapsed shows the exercise names; tap to expand into every set,
  volume, and PR count. Like/unlike, add a comment, edit or delete your
  own comments, delete your own posted workout.
- **Public profile** (`/feed/u/[username]`, reached by tapping a name in
  the feed): that user's weight trend chart, a date-picker for their daily
  macros, and their workout history (read-only, expandable sets) — no
  edit/delete controls since it's not your data.
- No schema changes needed — `likes` and `comments` tables/policies were
  already in place from Phase 2.

## Phase 6 — added (Admin + security fix)
- **Security fix, run first:** `supabase/migrations/03_lock_profiles.sql`.
  Before this, any logged-in user could read every user's recovery code
  (and edit their own `is_admin`). It now restricts which `profiles`
  columns the app can read/write. Signup, reset and admin keep working
  because they use the server key.
- **Admin page** (`/admin`, link appears on the Profile tab for admins):
  every user with their recovery code, search, change a code (type one or
  leave empty for random, which also clears any lockout), set a new
  password, make/remove admin, delete a user and all their data.
- Admin actions run through `/api/admin/users`, which re-checks `is_admin`
  in the database on every call, so hiding the link is not the only guard.
- First admin: run `update profiles set is_admin = true where username = 'yourname';`

## Phase 7 — added (Copy a past workout)
- **Copy last workout**: when you start a day, a card offers to copy your
  most recent finished workout for that day. It pre-fills the same
  exercises, weights and reps as unsaved sets, so nothing is logged until
  you tick each one and you can adjust numbers first.
- **Repeat this workout** (Profile > History > expand a workout): starts a
  session from any past workout, not just the latest.
- Run `supabase/migrations/04_session_day_fk.sql` once. Before it, deleting
  a split day that already had workout history would fail. History is kept
  after the fix because every session stores its own day name.
- Build check: `tsc` and a production `next build` both pass. Fixed a
  middleware typing error that `next dev` ignores but Vercel's build would
  have rejected.

## Phase 8 — added (PWA)
- Installable app: manifest, generated "GA" icons (standard, maskable,
  iOS), a small service worker and an offline page. The service worker
  only caches Next's hashed build files; pages, API calls and Supabase
  are never cached, so data is never stale.
- It only activates in production over HTTPS (so not on `npm run dev` or
  plain `http://192.168...`). Test it on your Vercel URL.
- Middleware now lets the PWA files through for logged-out visitors.
- `.gitignore` added so `.env.local` (your service role key) is never
  committed.

## Not built yet (next phases)
- Public/private photo profile via ImageKit
- Body measurements, progress photos via ImageKit
- Weekly volume per muscle group, per-exercise progress charts, 1RM estimate
- Exercise notes/RPE, plate calculator, supersets
- Charts (Recharts is installed, not wired up yet)

## Wiping test data
To reset everything (all users, profiles, splits, workouts — everything,
since every table cascades from `auth.users`), run this single line in the
Supabase SQL editor:

```sql
delete from auth.users;
```

This does **not** drop any tables or touch your schema — only the rows.

## Deploying to Vercel
1. Make sure `.gitignore` is in the project BEFORE your first commit, then
   run `git status` and confirm `.env.local` is not listed.
2. Push to a (private) GitHub repo.
3. Vercel > Add New Project > import the repo. If the Next.js app is in a
   subfolder (e.g. `Frontend`), set **Root Directory** to that folder.
4. Add three Environment Variables, then Deploy:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://<project>.supabase.co` (no path)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only, never prefix with NEXT_PUBLIC)
5. Open the Vercel URL on your phone. Android Chrome: menu > Install app.
   iPhone Safari: Share > Add to Home Screen.
6. Changing an env var later needs a redeploy to take effect.
