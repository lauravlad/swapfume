# Swapfume — Swap the scents you love.

Swapfume is a small community website where people swap perfume samples, decants and bottles with each other. No money is involved, ever.

## What it does

- **Accounts and profiles.** Members sign up with an email and password, then add a display name, city and a short bio. **18+ only:** sign-up asks for a date of birth and refuses anyone under 18. Only "confirmed adult" is stored, never the birthday. Members who joined before this check are asked once. **Forgot password?** on the sign-in screen sends a reset email; the link opens a page to choose a new password.
- **Collection.** "I have" lists your samples, decants and full bottles, with volume, how much is left, an optional photo, and whether you'd trade it. "I want" is your wishlist.
- **Catalog.** 2,758 perfumes from 206 houses are built in: designer and their flankers, niche, celebrity, mass-market, Middle Eastern houses (Lattafa, Armaf, Afnan, Al Haramain, Rasasi, Amouage and others) and a few Asian houses (Shiseido, Shiro). Brand and name are always there; 656 also have a scent family and notes, and 362 have their perfumer. The rest show **"Details coming soon"** until members suggest them (empty is better than guessed). I wrote the list by hand; it was not copied from Fragrantica or any other site. **Rule:** everything from 2000 onward, and from before 2000 only true classics that are still sold today. Those show a small "Classic" label. Where I wasn't sure of a release year, the page says "Year unknown" and an admin can fill it in from the perfume's page. Anything I couldn't describe confidently is left out so members can suggest it. That includes most releases from smaller Gulf houses like Ard Al Zaafaran, Paris Corner, Zimaya and Gulf Orchid. Members can suggest missing perfumes, and the form asks for the release year. An admin approves each suggestion; pre-2000 suggestions are flagged "approve only if it's a classic". Near-duplicates are caught automatically, including spelling variants: "Al-Haramain" = "Al Haramain", "Oudh"/"Aoud" = "Oud", "EDP" = "Eau de Parfum", and "Attar"/"Perfume Oil" = "Perfume Oil / Attar".
- **Perfumers.** The perfume page shows "Perfumer: …" with a link to **more by this perfumer**; search finds perfumers too (try "Kurkdjian"). Members suggest missing perfumers in the same correction form as notes.
- **Perfume reviews.** Separate from swap reviews: members rate any catalog perfume 1–5 stars, optionally write a short review, and tag longevity (weak → beast), sillage (intimate → strong), seasons and day/night. One review per member per perfume, editable and deletable. The perfume page shows the average, bar summaries of the tags and the newest reviews with **Helpful** votes. **Browse → Catalog & reviews** lists the whole catalog with average stars and a **Top rated** sort. Reviews can be reported; admins can hide them. Banned members' reviews and reviews between blocked members are hidden; deleted members' reviews show "Former member". Demo mode includes a few sample reviews by the pretend members, labelled "Demo review" — none are added to the real database.
- **Admin bulk import (CSV).** Admin → **Import CSV**: upload a file with columns `brand, name, concentration, year, family, notes_top, notes_heart, notes_base, perfumers` (only brand and name required; several notes in one cell separated by `;`). It shows a preview — new, already in catalog, duplicate in file, pre-2000 (skipped unless you allow classics), or problem — and adds nothing until you confirm. It uses the same duplicate check as everything else, so "EDP"/"Eau de Parfum" or "Al-Haramain"/"Al Haramain" are caught. Meant for loading a licensed perfume dataset later; only import data you have the right to use.
- **Notes and pictures.** Every catalog perfume has a scent family (floral, woody, amber and so on) and top, heart and base notes. I wrote these from general knowledge, not copied from any site, and kept them short and general where I wasn't sure. Members can suggest corrections, and an admin approves them in the same way as new perfumes. The page says that notes are community-maintained and may be approximate. **Pictures are never copied from brands or shops.** Each perfume gets a drawn bottle, tinted by its scent family and in one of five shapes. Once a member uploads a photo of their own bottle, the catalog page shows the newest one. An admin can also set a catalog photo they have the rights to use, with a credit line.
- **Matching.** The home page lists people who have something you want *and* want something you have. Below that come one-way matches. You can also browse and search everything that's open to trade.
- **Swaps.** A swap goes through these steps: proposed → accepted (or declined) → each side ships → each side confirms the package arrived → completed → each side reviews. **A shipping address is shown only to your swap partner, and only after both of you have agreed.**
- **Trust.** Every profile shows a completed-swap count, an average star rating and reviews. Only the two people in a completed swap can review each other, and only once. New members see a tip to start with samples before trading full bottles.
- **Safety.** There is a Report button on members, listings and swaps. The admin page lets an admin approve catalog suggestions, read reports, hide a listing, and ban or unban a member. A ban stops the member from listing, proposing and reviewing, and cancels their open proposals.
- **Blocking.** Any member can block another from their profile. Neither then sees the other's listings or wishlist (in matches, browse or profiles), and neither can propose a swap. Open proposals between them are withdrawn; swaps already accepted carry on so packages can arrive. The blocked person isn't told. **Me → Blocked members** lists them, with Unblock.
- **Delete account.** **Me → Delete account** (type DELETE to confirm) removes the profile, collection, wishlist, photos, address and block list, and withdraws open proposals. Completed swaps stay in the partner's history and reviews the member wrote stay, shown as "Former member". Reviews about them are removed. It's refused while a swap is in progress.
- **Legal and help pages.** Privacy Policy, Terms of Use and Support, linked from the footer, from **Me**, and from the sign-up form ("By creating an account you agree…"). Operator: Octopup Studio. Support email: hello@swapfume.com (both set in `js/config.js`).
- **Add to home screen.** A web app manifest and Swapfume icon (`manifest.webmanifest`, `icons/`), so phones can add it like an app.

**Launch in one country only.** Perfume is flammable, so mailing it is restricted. In the US it can only go by ground and only within the country, and sending it abroad is mostly not allowed. The app tells members it currently serves one country, set in `js/config.js`. It also reminds people to ship by ground and pack glass well.

> **⚖️ The Privacy Policy and Terms of Use (`js/legal.js`) are templates written in plain language, not legal advice. Have a lawyer review them before launch**, especially for age rules, liability, and the privacy laws that apply where your members live (for example US state privacy laws, or GDPR if anyone joins from Europe).

> **📮 Create the `hello@swapfume.com` mailbox or forwarder** with your domain company (most offer free email forwarding) before launch. The app shows that address on the Support, Terms and Privacy pages, and on the suspended-account screen.

**Start small.** Invite 20–50 real swappers first, watch how it goes, and only then open it up more widely.

## Try it now (demo mode)

Demo mode needs no account anywhere. Everything is saved only in your own browser, and five pretend members (Margaux, who is the admin, Theo, June, Ravi and Noor) are already set up with collections.

1. Open Terminal, go to this folder, and start a tiny local web server:
   ```bash
   cd perfume-swap
   ```
   ```bash
   python3 -m http.server 8080
   ```
2. In your browser, open **http://localhost:8080**
   (Double-clicking `index.html` usually works too.)
3. Create an account. Any email works, for example `you@test.com`. Use a date of birth at least 18 years ago (try a younger one to see it refused).
4. Things to try:
   - **Me**: add your city and a shipping address.
   - **Collection**: add *Baccarat Rouge 540*, mark it "open to trade", and add *Santal 33* to "I want".
   - **Matches**: Theo now shows up as a two-way match. Propose a swap.
   - **Me → Demo tools → Theo**: you are now Theo. Open **Swaps**, accept, and mark his package as shipped.
   - Switch back to yourself, mark yours as shipped and confirm his arrived. Switch to Theo and confirm yours arrived. The swap is now complete, and both of you can leave a review.
   - **Me → Demo tools → Margaux** to see the admin page.
   - **Forgot password?** (signed out): in demo mode no email is sent; the page offers the reset link directly.
   - On Theo's profile tap **Block**: he disappears from your matches and browse. Unblock under **Me → Blocked members**.
   - **Me → Delete account** removes your demo account; your partners then see you as "Former member".
   - **Me → Reset demo data** starts everything over.

## Going live with a real database (Supabase)

Supabase is a free hosted service that provides logins, a database and photo storage. You need your own account. I did not create one for you.

1. Go to **supabase.com**, sign up, and click **New project**. Pick a region near your members and save the database password somewhere safe.
2. In the project, open **SQL Editor**. Paste and run each of these files in this order, one at a time:
   1. `supabase/migrations/001_tables.sql`
   2. `supabase/migrations/002_security.sql`
   3. `supabase/migrations/003_functions.sql`
   4. `supabase/migrations/004_storage.sql`
   5. `supabase/migrations/005_notes_and_images.sql` (scent notes, pictures, note corrections)
   6. `supabase/migrations/006_catalog_expansion.sql` (the bigger catalog, classics, smarter duplicate check)
   7. `supabase/migrations/007_middle_east_more.sql` (more Middle Eastern releases, admins can edit years)
   8. `supabase/migrations/008_launch.sql` (18+ check, blocking, delete account)
   9. `supabase/migrations/009_perfumers_reviews.sql` (perfumers, perfume reviews, CSV import, the full catalog)

   **The SQL Editor chokes on very big pastes**, and 009 is about 440 KB because it carries the whole catalog. So everything from 005 onward is also split into small files in **`supabase/live-update/`**, each under 120 KB, numbered in run order. **Use those in the SQL Editor instead of 005–009**:
   - Fresh database: run `001`–`004` from `migrations/`, then every file in `live-update/` in number order (`01_…` to `10_…`).
   - Database that already has some of 005–009: run all of `live-update/` in order anyway — every file is safe to run again; perfumes already there are skipped, and years and perfumers are only filled where empty.
   - `supabase/seed.sql` is no longer needed (it's the same catalog in one big file, for the command-line tool).
   - 005 adds notes and pictures.
   - 006 marks the classics, adds the new perfumes, and skips any that are already there.
   - 006 also removes pre-2000 perfumes from the first list that aren't classics (Samsara, Gucci Rush, Gucci Envy), but only if no member uses them in a collection, wishlist or swap.
   - 007 adds more Middle Eastern releases and fills in release years only where yours are blank.
   - 009 adds perfumers, perfume reviews and CSV import, and the bigger catalog.
   - 008 adds the 18+ check, blocking and account deletion. **Members who already exist (including you) are asked for their date of birth once** the next time they open the app; until then they can browse but not list, propose or review.
   - Running any of these files twice does no harm.
3. Open **Project Settings → API** and copy the **Project URL** and the **anon public** key. Paste both into `js/config.js`:
   ```js
   SUPABASE_URL: "https://xxxx.supabase.co",
   SUPABASE_ANON_KEY: "eyJ...",
   ```
   The anon key is meant to be public. The security rules in `002_security.sql` are what keep the data safe.
4. Open **Authentication → URL Configuration**:
   - **Site URL:** `https://swapfume.com`
   - **Redirect URLs:** add `https://swapfume.com/**` and `https://www.swapfume.com/**`. While testing, also add `http://localhost:8080/**`.

   These tell Supabase where it may send people back to after they click the link in their sign-up or password-reset email. Leave email confirmation on.

   Optional: under **Authentication → Email Templates → Reset Password**, you can change the wording of the reset email (keep the `{{ .ConfirmationURL }}` link). Supabase's built-in email sender is limited to a few emails per hour; before launch, set up your own SMTP under **Project Settings → Authentication → SMTP** (for example with Resend, Postmark or your email host) so reset and sign-up emails arrive reliably.
5. **Deploy the "delete account" function.** Deleting a login needs Supabase's secret service-role key, which must never be in the website, so it runs as a small Supabase Edge Function (`supabase/functions/delete-account/index.ts`). Supabase provides the key to the function automatically; you don't paste it anywhere. One-time setup, in Terminal from this folder:
   ```bash
   npx supabase login
   ```
   ```bash
   npx supabase functions deploy delete-account --project-ref YOUR-PROJECT-REF
   ```
   (Your project ref is the `xxxx` part of `https://xxxx.supabase.co`.) Alternatively, in the dashboard go to **Edge Functions → Deploy a new function → Via editor**, name it `delete-account`, paste the file's contents and deploy. Leave **Verify JWT** on. Until it's deployed, **Delete account** shows an error and nothing is deleted.
6. Create your own account in the app. Then make yourself admin by running this in the SQL Editor, with your own email:
   ```sql
   update public.profiles set is_admin = true
   where id = (select id from auth.users where email = 'YOUR-EMAIL');
   ```
7. Put the site online. Any static host works, including GitHub Pages like your class apps. Upload the contents of this folder so `index.html` sits at the top level (the site root). All paths are relative, so it works at `https://swapfume.com/` and at a sub-path like `https://lauravlad.github.io/swapfume/`. Nothing needs to be built first. The `supabase/` and `tools/` folders don't need to be public, but nothing secret is in them.

### Pointing swapfume.com at the site (GitHub Pages)

Do this only when you're ready for the site to be public. The app itself never mentions the domain, so these steps are the only setup it needs.

1. Create a GitHub repository (for example `swapfume`) and upload the contents of this folder. In the repository, go to **Settings → Pages**, choose **Deploy from a branch**, pick `main` and `/ (root)`, and save. The site first appears at `https://lauravlad.github.io/swapfume/`.
2. On the same **Pages** screen, type `swapfume.com` under **Custom domain** and save. GitHub adds a small file called `CNAME` to the repository. Leave it there.
3. Log in to the company where you bought swapfume.com and open its **DNS** settings. Add these records:

   | Type | Name | Value |
   | --- | --- | --- |
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |
   | CNAME | `www` | `lauravlad.github.io` |

   Delete any older A or CNAME records for `@` or `www` (often a "parked domain" page). It usually starts working within an hour, but can take up to a day.
4. Back in **Settings → Pages**, tick **Enforce HTTPS** once GitHub offers it. That gives you the padlock in the browser.
5. Check that `https://swapfume.com` loads. Then sign up with a fresh email and click the confirmation link to make sure it brings you back to swapfume.com. If it doesn't, recheck step 4 of the Supabase steps above.

To check the DNS addresses yourself, GitHub's help page "Managing a custom domain for your GitHub Pages site" lists them.

### What the database protects (already written into the rules)

- Only signed-in members can see anything.
- You can change only your own profile, items and wishlist. Nobody can make themselves an admin.
- An address can be read only by its owner, and by a swap partner once the swap is accepted.
- Swap steps happen only through checked actions. You can't accept your own proposal, and you can't confirm a package arrived before it was marked shipped.
- A review requires a completed swap, comes from one participant about the other, and is limited to one per person per swap.
- Reports can be read only by admins. Banned members can't list, propose or review.
- Note corrections can be read only by the person who suggested them and by admins. Only admins can approve them or set a catalog photo.
- Photos: each member can upload only into their own folder. Photos are shrunk before upload, with a 2 MB limit.
- Under-18 sign-ups are refused by the database itself, and members without an age confirmation can't list, propose or review.
- Blocks: your block list is readable only by you; the database hides listings and wishlists in both directions and refuses swap proposals or acceptances between blocked members.
- Account deletion can be started only by the signed-in member, for themselves.
- Perfume reviews: one per member per perfume; only the author can edit or delete theirs; nobody can fake the Helpful count or vote on their own review; only admins can hide a review or import perfumes.

I tested these rules on a local copy of Postgres (the same database Supabase uses), going through the full swap, the permission checks, duplicate catalog requests and bans. For 005 and 006, I also tested both a database that already had the old catalog and a fresh install. The result was the same catalog with no duplicates. A pre-2000 perfume someone had on their wishlist was kept rather than deleted. For 009 and the split `live-update/` files, I tested a fresh install (001–004 + live-update), the full migrations + seed, and an older database run through live-update twice: all three end with the same 2,758 perfumes, 114 classics, 362 with perfumers, and no duplicates; a pre-2000 perfume that someone had wishlisted was kept. Reviews: one per member, tags checked, Helpful counts can't be faked, admin hide and bans update the average, blocked/banned authors hidden, deleted member → "Former member". CSV import: preview and commit, duplicates within the file, existing perfumes, pre-2000 rows, missing brand, bad year, unknown family. For 008, I tested: under-18 sign-up refused, age confirmation, blocking in both directions (including admins), proposals refused and withdrawn, deletion refused during a swap in progress, and after deletion the swap and the review the member wrote kept with "Former member" while everything else was gone. The Edge Function itself can only run on Supabase, so it's untested until you deploy it. I have not yet run any of this on a real Supabase project.

## What is not in this first version

- **No in-app chat.** People use the note attached to the proposal. Chat or email notifications would be a good next step. Right now nobody gets an email when they receive a proposal.
- **Collections don't update after a swap.** The swap page reminds people to update their own collection afterwards.
- **Not in the app stores yet.** It can be added to a phone's home screen. Putting it in the App Store and Google Play needs a wrapper app (for example Capacitor) plus developer accounts; that's a later step. Apple requires in-app account deletion and blocking/reporting for apps like this, which are now in place.
- **No offline mode.** There is no service worker; the app needs a connection.
- **No automatic sample-first rule.** "Samples before full bottles for new members" is shown as a tip, not enforced.
- **Photos in demo mode** stay in your browser and take up its limited storage space. Use small photos there.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The page shell |
| `css/styles.css` | Look and feel |
| `js/config.js` | App name, launch country, operator name, support email, minimum age, Supabase keys |
| `js/legal.js` | Privacy Policy, Terms of Use and Support text (templates — have a lawyer review) |
| `manifest.webmanifest`, `icons/` | Home-screen app settings and the Swapfume icon (SVG source + PNGs) |
| `js/app.js` | All the screens |
| `js/api-demo.js` | Demo data layer (browser storage, pretend members) |
| `js/api-supabase.js` | Real data layer (same functions, talks to Supabase) |
| `js/catalog-seed.js`, `js/catalog/*.js` | The perfume catalog: the detailed lists (with families and notes) and the `more-*.js` name-only lists, plus `perfumers.js`. Edit them, then run `node tools/make-seed-sql.js`. It checks every row, skips duplicates, prints counts per category, and regenerates `supabase/seed.sql`, the data parts of migrations 005–009, and all of `supabase/live-update/` |
| `supabase/live-update/` | Migrations 005–009 split into numbered files under 120 KB for the SQL Editor |
| `supabase/` | Database tables, security rules, actions, storage, catalog |
| `supabase/functions/delete-account/` | Edge Function that deletes a member's photos and login (deploy once, see above) |
