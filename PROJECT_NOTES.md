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

Run on the live project on 2026-11-05: `supabase/migrations/001`–`004`, then `supabase/live-update/01`–`10` (the SQL Editor can't take big pastes, so 005–009 are split into files under 120 KB). The check query gave **2758 perfumes | 114 classics | 362 with perfumer | 656 with notes | 0 duplicates**.

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

## Still to do

1. Supabase → Authentication → URL Configuration: Site URL `https://swapfume.com`; Redirect URLs `https://swapfume.com/**` and `https://www.swapfume.com/**` (confirm this was done).
2. Your own email sender (SMTP, e.g. Resend) before inviting people. Supabase's built-in sender only manages a few emails per hour.
3. Lawyer review of the Privacy Policy and Terms (`js/legal.js`).
4. iPhone app: free about 40 GB of disk, install Xcode, then the Apple Developer Program ($99/year). Steps are in README → "iPhone app".
5. Later: Google Play (`npx cap add android`), and notifications for new swap proposals.

## Catalog rules

The catalog is written from general knowledge only, never copied from Fragrantica or any other site. Only perfumes we're confident exist go in. The rule is 2000 onward, plus pre-2000 classics that are iconic and still sold (shown with a "Classic" label). Unknown year, notes or perfumer stay empty ("Year unknown", "Details coming soon"). Members suggest the rest, and a licensed dataset can come in through Admin → Import CSV.
