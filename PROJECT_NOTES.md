# Swapfume — project notes

Everything needed to pick this project up again: what it is, where each piece lives, how they connect, and what's left. Setup details are in `README.md`.

**Swapfume — Swap the scents you love.** A perfume swap community: members list samples, decants and bottles, get matched with people who have what they want, swap by mail, and review each other. No money, ever. Launching in the United States, 18+ only. Run by **Octopup Studio** (octopupstudio.com).

## Where everything lives

| Piece | Where | Notes |
|---|---|---|
| Live website | https://swapfume.com | GitHub Pages, HTTPS enforced. `www.swapfume.com` and `lauravlad.github.io/swapfume` redirect here. |
| Code | https://github.com/lauravlad/swapfume (public) | Pushing to `main` redeploys the site in about a minute. |
| Domain | swapfume.com at **Namecheap** | DNS: four A records `@` → `185.199.108.153`, `.109.153`, `.110.153`, `.111.153`; CNAME `www` → `lauravlad.github.io`. |
| Support email | hello@swapfume.com | Namecheap **Redirect Email** → lauravlad@gmail.com (free forwarding, receive only). |
| Database, logins, photos | **Supabase** project `lrnymsmajoriksbnoojn` | URL and anon (public) key in `js/config.js`. Never put the service_role key in the site. |
| Delete-account function | Supabase Edge Function `delete-account` | Source: `supabase/functions/delete-account/index.ts`. Deployed through the dashboard (Edge Functions → Via Editor). |
| iPhone app | `ios/` (Capacitor 8.5.3) | App ID `com.octopupstudio.swapfume`. Not built yet: needs Xcode (~40 GB disk) and the Apple Developer Program. |
| Admin | lauravlad@gmail.com | Made admin with the SQL in README step 6. |

The project ref `qkgqfrbscxwyxwedfgzg` that appears in old notes is **not** the live project.

## How the pieces connect

```
visitor ─► swapfume.com (Namecheap DNS) ─► GitHub Pages (this repo, main)
                                             │  js/config.js
                                             ▼
                                Supabase lrnymsmajoriksbnoojn
                         (auth, Postgres + RLS, bottle-photos storage,
                          delete-account Edge Function)
                                             │ emails (confirm / reset)
                                             ▼
                              links back to https://swapfume.com
iPhone app (ios/) ─ bundles the same files ─► same Supabase project
```

## Database status

Run on the live project on 2026-11-05: `supabase/migrations/001`–`004`, then `supabase/live-update/01`–`10` (and `11`–`13` on 2026-11-07) (the SQL Editor can't take big pastes, so 005–009 are split into files under 120 KB). The check query gave **2758 perfumes | 114 classics | 362 with perfumer | 656 with notes | 0 duplicates**.

Future database changes: add a new migration, run `node tools/make-seed-sql.js`, then run only the new files in the SQL Editor.

## Testing changes safely

Add `?demo=1` to any address (for example `https://swapfume.com/?demo=1`, or locally `index.html?demo=1`). The app then runs on pretend members (Margaux is admin), and nothing touches real accounts. **Me → Demo tools → Reset demo data** starts over.

## Timeline

- **2026-11-04:** first version: profiles, collections, matching, swaps with private addresses, reviews, reports, admin, demo mode.
- **2026-11-05:**
  - Notes and pictures; catalog expanded to 2,758 perfumes (own knowledge only, no invented releases).
  - Launch must-haves: password reset, blocking, delete account, 18+ gate, legal pages, app icon and manifest.
  - Perfumers, perfume reviews, admin CSV import.
  - Published on GitHub Pages, connected to Supabase, pointed swapfume.com at it, email forwarding set up.
  - iPhone project prepared.
- **2026-11-07:** sign-out made easy to find (top and bottom of **Me**); added the `?demo=1` switch.
- **2026-11-07:** members suggest catalog photos of their own bottles (Admin tools → Photos to approve), profile photos (avatars), a clearer photo picker, and a refreshed design. Database: migration 010 / `live-update/11_photo_suggestions.sql`, run on the live project.
- **2026-11-07:** ZIP-code location (private), "Nearby · about X mi" within 20 miles, a full **Meet in person** swap option (no addresses, meeting plan, both confirm "met up"), many-for-one summary on proposals, Terms/Privacy updated. Database: migration 011 / `live-update/12_location_meetups.sql`. ZIP centre points: `js/data/zips.csv` from the U.S. Census Bureau 2024 Gazetteer (public domain).
- **2026-11-07:** a small general-area map on profiles (OpenStreetMap tiles around a point blurred to 0.1°, no pin; preview under Me). Database: migration 012 / `live-update/13_area_map.sql`.

- **2026-11-26:** the big social update (branch `social-features`), compared against Facebook swap groups:
  - **Notifications:** a bell with an unread count and a Notifications page. Database triggers write them (messages, comments and replies, likes, @mentions, friend requests, swaps and gifts, reviews, meetups, pass-arounds, giveaways, invites, claims), so nothing depends on the app remembering. Emails about unseen activity through the `activity-email` Edge Function: at most one every 30 minutes, never for likes, with an on/off switch under Me. Migration 027.
  - **Real-time chat:** new messages, "Seen" and "typing…" arrive instantly (Supabase Realtime), plus photos in messages. Migration 028.
  - **Pass-arounds and sample giveaways** (Community → Pass & give): one bottle travels a fixed route and comes home; each holder sees only the next person's address. Giveaways draw winners at random, then the host sends gifts. Migration 029.
  - **Interest groups:** eight starter groups plus member-made ones (up to 2 each), open across countries, each with its own feed. Migration 030.
  - **Sign in with Google/Apple** (off until set up, see README) and **invite links** (friends on joining). Migration 031.
  - **Richer posts:** up to 4 photos, polls, editing, replies to comments, @mentions, saved posts, admin-pinned posts, search for people and posts. Migration 032.
  - **Tracking numbers and claims** ("didn't arrive" after 7 days, damaged, not as described), resolved by admins under Admin tools → Claims. Migration 033.
  - **Romanian:** `js/i18n.js` translates the interface (footer: Română / English; Romanian phones get it by default). Members' own words are never translated. Sentences with names or numbers inside them are still English; add more lines to the dictionary in `js/i18n.js`.
  - The `our mission` section on the welcome page and at `#/mission`.

- **2026-11-26 (later):** **wishlist alerts.** When a perfume becomes available to swap, members with it on their wishlist hear about it through the bell (and the activity email): same country or friends only, at most once per perfume per week, never between people who blocked each other; switch under Me. Migration 034 / `live-update/35_wishlist_alerts.sql`, tested on local Postgres (14 checks).
- **Decided 2026-11-26:** no "Popular" feed for now. With few members a likes-ranked feed looks empty and rewards hauls, which goes against the mission. Pause new features, get real members using what's there, and simplify Community's 8 tabs before adding more.

## Turning on the 2026-11-26 update (in this order)

1. **Database first.** In the Supabase SQL Editor run `supabase/live-update/28_notifications.sql` through `34_tracking_claims.sql`, in number order. The current site keeps working with the new database (every changed function keeps its old arguments working), so this can happen before the code goes live. Tested on 2026-11-26 on a local Postgres 17 (Homebrew) with stand-ins for Supabase's auth, storage and Realtime: migrations 001–033 all run in order, the seven new files run a second time without harm, and 62 behaviour checks pass as pretend members (privacy of addresses, notifications and invite codes; blocks; who may draw, pin, edit or close a claim; timing rules). Supabase itself can still differ in small ways: if a file stops with an error, stop there and send the message.
2. **Realtime:** the SQL adds the tables to Supabase Realtime. Check Database → Replication (or Publications) lists `notifications`, `messages` and `thread_reads` under `supabase_realtime`.
3. **Activity emails:** deploy `supabase/functions/activity-email/index.ts` (Edge Functions → Via Editor, same as swap-email; it uses the same `RESEND_API_KEY` secret). Put the name Supabase gives it in `js/config.js` → `ACTIVITY_EMAIL_FUNCTION`. Until then everything works except those emails.
4. **Then push the code** (merge `social-features` into `main`).
5. Optional, later: Google/Apple sign-in (README → "Sign in with Google/Apple"), and have a Romanian speaker read through `js/i18n.js`.
6. iPhone app: `www/` (the copy bundled into the app) is older than the website; refresh it before the next iPhone build.

## Still to do

1. Supabase → Authentication → URL Configuration: Site URL `https://swapfume.com`; Redirect URLs `https://swapfume.com/**` and `https://www.swapfume.com/**` (confirm this was done).
2. Your own email sender (SMTP, e.g. Resend) before inviting people. Supabase's built-in sender only manages a few emails per hour.
3. Lawyer review of the Privacy Policy and Terms (`js/legal.js`).
4. iPhone app: free about 40 GB of disk, install Xcode, then the Apple Developer Program ($99/year). Steps are in README → "iPhone app".
5. Later: Google Play (`npx cap add android`), and notifications for new swap proposals.

## Catalog rules

The catalog is written from general knowledge only, never copied from Fragrantica or any other site. Only perfumes we're confident exist go in. The rule is 2000 onward, plus pre-2000 classics that are iconic and still sold (shown with a "Classic" label). Unknown year, notes or perfumer stay empty ("Year unknown", "Details coming soon"). Members suggest the rest, and a licensed dataset can come in through Admin → Import CSV.
