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
  LAUNCH_COUNTRY: "United States",   // shipping perfume across borders is restricted
  OPERATOR_NAME: "Octopup Studio",    // who runs the service (shown in Terms / Privacy)
  SUPPORT_EMAIL: "hello@swapfume.com",
  MIN_AGE: 18,
  // The public website. Only used by the iPhone app, so email links (confirm sign-up,
  // reset password) open the real site instead of the app's internal address.
  PUBLIC_SITE_URL: "https://swapfume.com/",
  // Live: connected to the Swapfume Supabase project. (Empty both values to go back to demo mode.)
  SUPABASE_URL: "https://lrnymsmajoriksbnoojn.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxybnltc21ham9yaWtzYm5vb2puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5MTU3NzQsImV4cCI6MjEwOTQ5MTc3NH0.icMukRItbaORuRgWELldcAAS2RvIDn_jgcL4VP1uIwI"
};
