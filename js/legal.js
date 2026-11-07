/*
  Privacy Policy, Terms of Use and Support pages.
  TEMPLATES in plain language — have a lawyer review them before launch.
  Names and the support address come from js/config.js.
*/
(function () {
  const C = window.APP_CONFIG;
  const APP = C.APP_NAME, OP = C.OPERATOR_NAME, MAIL = C.SUPPORT_EMAIL, COUNTRY = C.LAUNCH_COUNTRY, AGE = C.MIN_AGE;
  const mail = `<a href="mailto:${MAIL}">${MAIL}</a>`;
  const UPDATED = "November 7, 2026";

  window.LEGAL = {
    privacy: {
      title: "Privacy Policy",
      updated: UPDATED,
      body: `
<p>${APP} is run by ${OP} ("we"). This page explains, in plain words, what we collect, why, and the choices you have.</p>

<h2>What we collect</h2>
<ul>
  <li><b>Your account:</b> email address and password (the password is stored scrambled; we can't read it).</li>
  <li><b>Age check:</b> when you sign up you give your date of birth so we can confirm you are ${AGE} or older. We keep only the fact that you confirmed it and when — not your birthday.</li>
  <li><b>Your public profile:</b> display name, and if you add them, city, country and a short bio.</li>
  <li><b>Your shipping address:</b> the name and address you enter for packages.</li>
  <li><b>Your ZIP code</b>, if you add it, and its approximate centre point (from the public US Census list), used only to work out roughly how far you are from other members.</li>
  <li><b>What you list and write:</b> your collection, wishlist, profile photo and other photos you upload, swaps (including meet-up plans you write), swap reviews, perfume reviews and ratings, "Helpful" votes, catalog suggestions, reports and blocks.</li>
  <li><b>Basic technical data</b> our hosting providers record to keep the service running and secure (for example IP address and browser type in server logs).</li>
</ul>
<p>We do not collect payment details — ${APP} never involves money.</p>

<h2>Who can see what</h2>
<ul>
  <li><b>Other members</b> can see your public profile, what you mark as open to trade, your wishlist, your completed-swap count, reviews, and the perfume reviews you write (with your display name). Who voted "Helpful" is not shown.</li>
  <li><b>Your address</b> is shown only to the other person in a swap by mail, and only after you have <i>both</i> accepted it. It is never shared for swaps where you meet in person.</li>
  <li><b>Your ZIP code</b> is never shown to anyone. Other members see only your city (if you add one), a rounded distance such as "about 8 miles" (only up to 50 miles away), and a small map of your general area on your profile. That map is centred on a point we blur by several miles and has no pin, so it shows the area, never your exact location. People you've blocked, or who blocked you, see none of this.</li>
  <li><b>Photos</b> you upload are stored at a public web address so they can be displayed; anyone with the link could view them. Don't include personal details in photos.</li>
  <li><b>Our admins</b> can see what's needed to moderate: listings, reports, swaps and member accounts.</li>
  <li>People you <b>block</b> can no longer see your listings or wishlist, and you can't see theirs.</li>
</ul>

<h2>Why we use it</h2>
<p>Only to run ${APP}: to let you sign in, match you with other members, show swap partners where to ship, build trust through reviews, keep the community safe (moderation, bans, reports), and answer your support messages. We don't sell your data, and we don't show ads.</p>

<h2>Service providers</h2>
<p>We use trusted providers to host the site and the database (for example Supabase for accounts, data and photo storage, and our web host for the pages). They process data only on our behalf. Fonts are loaded from Google Fonts, and the small area maps from OpenStreetMap; both see your IP address when the page loads.</p>

<h2>How long we keep it</h2>
<p>As long as you have an account. You can remove your ZIP code any time under <b>Me</b>. When you delete your account we remove your profile, listings, wishlist, photos, address, ZIP code and blocks. Swaps you completed stay in your partners' history, and swap reviews and perfume reviews you wrote stay, shown as "Former member" with no link to you. Reviews about you are removed. Backups and logs may keep traces for a short time before they expire.</p>

<h2>Your choices</h2>
<ul>
  <li>Edit your profile and address any time under <b>Me</b>.</li>
  <li>Delete your account any time under <b>Me → Delete account</b>.</li>
  <li>Ask us for a copy of your data, or to correct it, at ${mail}.</li>
</ul>

<h2>Children</h2>
<p>${APP} is only for people ${AGE} or older. If we learn an account belongs to someone younger, we will delete it.</p>

<h2>Changes</h2>
<p>If we change this policy in an important way, we'll tell members in the app. The date at the top shows the latest version.</p>

<h2>Contact</h2>
<p>${OP} · ${mail}</p>`
    },

    terms: {
      title: "Terms of Use",
      updated: UPDATED,
      body: `
<p>These terms are the agreement between you and ${OP}, which runs ${APP}. By creating an account you agree to them. If you don't agree, please don't use ${APP}.</p>

<h2>Who can join</h2>
<ul>
  <li>You must be <b>${AGE} or older</b>.</li>
  <li>You must live in the <b>${COUNTRY}</b> and ship only within it.</li>
  <li>One account per person. Keep your password to yourself; you're responsible for what happens in your account.</li>
</ul>

<h2>No money, no selling</h2>
<p>${APP} is for swapping only. You may not buy, sell, or ask for or offer money, gift cards, payment apps or anything else of money value — not even "just for shipping". Each person pays for and arranges their own shipping. Listings or messages that try to sell will be removed.</p>

<h2>Shipping safely and legally</h2>
<ul>
  <li>Perfume is flammable. Ship <b>by ground only</b>, following your carrier's rules for perfume and the law where you live.</li>
  <li>Pack glass carefully and seal atomizers.</li>
  <li>Ship within the ${COUNTRY} only — no international shipping.</li>
  <li>Only swap what you own, is genuine, and is described honestly (size, how much is left, batch, condition). No fakes or "inspired by" copies passed off as the original.</li>
</ul>

<h2>Meeting in person</h2>
<p>Members within 20 miles of each other may choose to meet instead of shipping. If you do:</p>
<ul>
  <li>Meet only in a busy public place, in daylight. Tell someone where you're going, or bring a friend.</li>
  <li>Swap perfume only — no money, no other goods, no sales.</li>
  <li>You don't have to go through with a meet-up. If anything feels wrong, leave and report it.</li>
  <li>You meet other members at your own risk. ${OP} doesn't check members' identities, isn't present at meet-ups, and, to the extent the law allows, isn't responsible for what happens at them.</li>
</ul>

<h2>Be kind and keep it clean</h2>
<p>No offensive content: no harassment, hate, threats, sexual content, or anything illegal, in your profile, photos, notes, reviews or messages. Don't share other people's personal details. Reviews must be honest and about a real swap.</p>

<h2>Your content</h2>
<p>You keep ownership of the photos and text you post. You give ${OP} permission to store and show them in ${APP} so the service works. Only upload photos you took yourself or have the right to use.</p>

<h2>Our role</h2>
<p>${APP} helps members find each other. We are not part of any swap: we don't inspect, ship, insure or guarantee items, and we can't promise that every member will behave well. Use reviews, start with samples, and report problems. To the extent the law allows, ${APP} is provided "as is", and ${OP} is not responsible for lost, damaged, fake or undelivered items, or for disputes between members.</p>

<h2>Moderation</h2>
<p>We may remove listings, photos, reviews or catalog entries, and suspend or ban accounts, if we believe they break these terms or put others at risk. You can report a member or listing from their page, and block anyone you don't want to deal with.</p>

<h2>Leaving</h2>
<p>You can delete your account at any time under <b>Me → Delete account</b>. See the Privacy Policy for what is kept.</p>

<h2>Changes</h2>
<p>We may update these terms. If the change is important we'll tell members in the app; continuing to use ${APP} means you accept the new version.</p>

<h2>Contact</h2>
<p>${OP} · ${mail}</p>`
    },

    support: {
      title: "Support & contact",
      updated: "",
      body: `
<p>Questions, a problem with a swap, or something we should know? Email us at ${mail} — a real person reads every message. Please include the email you signed up with, and the swap or member it's about.</p>

<h2>Quick answers</h2>
<h3>A package never arrived</h3>
<p>Check any tracking you have and give it a few days — ground shipping can be slow. If it still hasn't arrived, use <b>Report a problem with this swap</b> on the swap page, or email us.</p>
<h3>Someone is rude or tried to sell me something</h3>
<p>Open their profile and tap <b>Report</b>, then <b>Block</b> so you no longer see each other.</p>
<h3>I forgot my password</h3>
<p>On the sign-in screen tap <b>Forgot password?</b> and we'll email you a link to choose a new one.</p>
<h3>A perfume is missing or its notes are wrong</h3>
<p>Use <b>Suggest a perfume</b> under Me, or <b>Suggest a correction</b> on the perfume's page. An admin checks every suggestion.</p>
<h3>How do I delete my account?</h3>
<p>Go to <b>Me → Delete account</b>. Finish any swap in progress first.</p>
<h3>Safety tips</h3>
<p>Start with samples or decants, read reviews, ship by ground only, and never send money — ${APP} never involves payments.</p>`
    }
  };
})();
