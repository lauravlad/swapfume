/*
  App settings.

  DEMO MODE (default): leave SUPABASE_URL empty. Everything is stored only in
  this browser, with a few pretend members so you can try matching and swapping.

  REAL MODE: paste your Supabase project's URL and "anon public" key below
  (Supabase dashboard → Project Settings → API). The anon key is meant to be
  public; the security rules in supabase/migrations protect the data.
*/
window.APP_CONFIG = {
  APP_NAME: "Swapfume",
  TAGLINE: "Swap the scents you love.",
  // Countries Swapfume is open in: see COUNTRIES in js/util.js (and migration 016 in the database).
  // Members swap only within their own country — perfume can't be mailed across borders.
  OPERATOR_NAME: "Octopup Studio",    // who runs the service (shown in Terms / Privacy)
  SUPPORT_EMAIL: "hello@swapfume.com",
  MIN_AGE: 18,
  // The public website. Only used by the iPhone app, so email links (confirm sign-up,
  // reset password) open the real site instead of the app's internal address.
  PUBLIC_SITE_URL: "https://swapfume.com/",
  // The iPhone app's App Store page. The website shows a "Download on the App Store" badge linking here
  // (hidden inside the app itself). Empty = no badge.
  APP_STORE_URL: "https://apps.apple.com/us/app/swapfume/id6832157343",
  // "Take a photo" (AI reads perfume labels): the name of the Supabase Edge Function that runs
  // supabase/functions/identify-perfumes/index.ts. Supabase named it "super-service" when it was deployed.
  AI_PHOTO_FUNCTION: "super-service",
  // Email to the other member when someone proposes a swap or offers a gift
  // (supabase/functions/swap-email/index.ts). Its web address is "swift-processor" (Supabase picked it).
  SWAP_EMAIL_FUNCTION: "swift-processor",
  // The activity-email Edge Function (messages, comments, friend requests, swap updates...). Its name
  // in Supabase → Edge Functions once deployed; leave "" until then (in-app notifications still work).
  ACTIVITY_EMAIL_FUNCTION: "",
  // "Continue with ..." buttons on the sign-in card. Add "google" and/or "apple" here only after
  // switching that provider on in Supabase → Authentication → Providers (see README → Sign in with Google/Apple).
  OAUTH_PROVIDERS: [],
  // "Buy a sample" link, shown when nobody is swapping a perfume. Members never pay each other on Swapfume.
  // Empty = a plain web search. To send people to one shop, set its name and a search address with {q}
  // where the perfume name goes, e.g. BUY_SAMPLE_URL: "https://shop.example/search?q={q}".
  // If that link earns Swapfume a commission (affiliate), set BUY_SAMPLE_AFFILIATE: true so members are told.
  BUY_SAMPLE_SHOP: "",
  BUY_SAMPLE_URL: "",
  BUY_SAMPLE_AFFILIATE: false,
  // Amazon Associates tracking IDs for the decanting-supplies links on #/decanting (one per Amazon store,
  // e.g. "swapfume-20" for amazon.com). Empty = that country's supply list shows without links.
  // Romania has no Amazon store of its own, so it never shows links.
  AMAZON_TAGS: { US: "swapfume-20", CA: "" },
  // Live: connected to the Swapfume Supabase project. (Empty both values to go back to demo mode.)
  SUPABASE_URL: "https://lrnymsmajoriksbnoojn.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxybnltc21ham9yaWtzYm5vb2puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5MTU3NzQsImV4cCI6MjEwOTQ5MTc3NH0.icMukRItbaORuRgWELldcAAS2RvIDn_jgcL4VP1uIwI"
};
