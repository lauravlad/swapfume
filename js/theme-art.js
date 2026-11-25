// SWAPFUME THEME ART: Pierre-Joseph Redouté (botanical rose plates). Theme id: redoute
// Replaced every week by the style agent (themes/WEEKLY-STYLE-AGENT.md), together with css/theme.css.
// Four small inline SVGs for the welcome page: two members (drawn, never real people) and the two
// bottles they swap. Rules: viewBox 0 0 64 64 for avatars (with class="avatar"), 0 0 36 60 for bottles,
// aria-hidden="true", unique gradient ids, no external images, no scripts.
(function () {
  // Vellum cameo ground with a faint stippled rose sprig in two corners
  const PLATE = (id) => `<defs><radialGradient id="${id}" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#FFFBF5"/><stop offset=".7" stop-color="#F8EDE3"/><stop offset="1" stop-color="#EFDCCD"/></radialGradient></defs>
      <rect width="64" height="64" fill="url(#${id})"/>
      <g opacity=".85"><path d="M3 15c4-3 8-3 10 0" fill="none" stroke="#7E9A66" stroke-width=".8"/><path d="M6 13c1-3 4-4 5-2-1 2-3 3-5 2z" fill="#B9CFA3"/><circle cx="4" cy="13" r="2.4" fill="#F1B3BF"/><circle cx="4" cy="13" r="1" fill="#D98799"/>
      <path d="M61 15c-4-3-8-3-10 0" fill="none" stroke="#7E9A66" stroke-width=".8"/><path d="M58 13c-1-3-4-4-5-2 1 2 3 3 5 2z" fill="#B9CFA3"/><circle cx="60" cy="13" r="2.4" fill="#F1B3BF"/><circle cx="60" cy="13" r="1" fill="#D98799"/></g>
      <g fill="#B5566B" opacity=".35"><circle cx="10" cy="5" r=".6"/><circle cx="54" cy="6" r=".6"/><circle cx="7" cy="24" r=".5"/><circle cx="57" cy="25" r=".5"/></g>`;
  window.SwapfumeTheme = {
    id: "redoute",
    name: "Pierre-Joseph Redouté",
    avatarLeft: `<svg class="avatar" viewBox="0 0 64 64" aria-hidden="true">${PLATE("rdL")}
      <path d="M15 33c0-14 7-21 17-21s17 7 17 21v22H15z" fill="#5A3624"/>
      <path d="M8 64c0-12 10-19 24-19s24 7 24 19z" fill="#F3C6CE" stroke="#BD6E80" stroke-width=".8"/>
      <path d="M22 49c4 3 16 3 20 0" fill="none" stroke="#FFFBF5" stroke-width="1.6" stroke-linecap="round"/>
      <g fill="#B5566B" opacity=".45"><circle cx="16" cy="58" r=".7"/><circle cx="20" cy="61" r=".6"/><circle cx="46" cy="58" r=".7"/><circle cx="43" cy="61" r=".6"/></g>
      <rect x="28" y="37" width="8" height="9" rx="3.5" fill="#EBC9B4"/>
      <ellipse cx="32" cy="29" rx="10.5" ry="12" fill="#F6DDCB"/>
      <path d="M21 28c1-9 6-13 12-13 7 0 11 5 11 11-6 0-12-2-16-7-1 4-4 7-7 9z" fill="#5A3624"/>
      <path d="M24 20c3-3 7-4 10-3M37 18c3 1 5 3 6 6" fill="none" stroke="#7A4E36" stroke-width=".7"/>
      <path d="M26 30.5q1.8 1.4 3.6 0M34.4 30.5q1.8 1.4 3.6 0" fill="none" stroke="#3A2620" stroke-width="1.2" stroke-linecap="round"/>
      <circle cx="25" cy="34" r="2" fill="#E994A5" opacity=".45"/><circle cx="39" cy="34" r="2" fill="#E994A5" opacity=".45"/>
      <path d="M29.8 35.6q2.2 1.4 4.4 0" fill="#B5566B" stroke="#9E1F46" stroke-width="1" stroke-linecap="round"/>
      <path d="M40 20c2-2 5-1 5 1" fill="#9DBB86" stroke="#6F8F5A" stroke-width=".5"/>
      <circle cx="44" cy="17" r="3.6" fill="#F1B3BF" stroke="#BD6E80" stroke-width=".6"/>
      <path d="M42.4 16.6c.6-1.4 2.6-1.6 3.4-.2M43 18.2c.8.8 2 .8 2.6-.2" fill="none" stroke="#A84862" stroke-width=".7" stroke-linecap="round"/>
    </svg>`,
    avatarRight: `<svg class="avatar" viewBox="0 0 64 64" aria-hidden="true">${PLATE("rdR")}
      <path d="M8 64c0-12 10-19 24-19s24 7 24 19z" fill="#B9CFA3" stroke="#6F8F5A" stroke-width=".8"/>
      <path d="M26 46l6 7 6-7" fill="#FFFBF5" stroke="#6F8F5A" stroke-width=".7"/>
      <path d="M44 52c2-3 5-3 6-1-2 2-4 2-6 1z" fill="#9DBB86" stroke="#6F8F5A" stroke-width=".5"/><circle cx="43" cy="53" r="2.2" fill="#E994A5" stroke="#B5566B" stroke-width=".5"/>
      <g fill="#6F8F5A" opacity=".45"><circle cx="15" cy="58" r=".7"/><circle cx="19" cy="61" r=".6"/><circle cx="49" cy="60" r=".7"/></g>
      <rect x="28" y="37" width="8" height="9" rx="3.5" fill="#94603F"/>
      <ellipse cx="32" cy="29" rx="11" ry="12" fill="#AE7350"/>
      <g fill="#2E2018"><circle cx="23" cy="22" r="5"/><circle cx="28" cy="17.5" r="5.2"/><circle cx="34" cy="16.5" r="5.2"/><circle cx="39.5" cy="19.5" r="5"/><circle cx="42" cy="24.5" r="3.6"/><circle cx="21.5" cy="26" r="3"/></g>
      <g fill="none" stroke="#6B4A36" stroke-width=".7"><path d="M25 18a1.5 1.5 0 1 1 1.5 1.5"/><path d="M34 15a1.5 1.5 0 1 1 1.5 1.5"/><path d="M40 21a1.3 1.3 0 1 1 1.3 1.3"/><path d="M22 23a1.3 1.3 0 1 1 1.3 1.3"/></g>
      <g fill="none" stroke="#5E4313" stroke-width="1.4"><circle cx="27.3" cy="30" r="3.6"/><circle cx="36.7" cy="30" r="3.6"/><path d="M30.9 29.6h2.2"/></g>
      <circle cx="27.3" cy="30.2" r="1.3" fill="#2E2018"/><circle cx="36.7" cy="30.2" r="1.3" fill="#2E2018"/>
      <path d="M28.3 35.3q3.7 3.2 7.4 0" fill="none" stroke="#4A2418" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    bottleLeft: `<svg viewBox="0 0 36 60" aria-hidden="true">
      <path d="M18 2c-3 0-5 2-5 4.5S15 11 18 11s5-2 5-4.5S21 2 18 2z" fill="#F1B3BF" stroke="#BD6E80" stroke-width=".9"/>
      <path d="M15.6 6c.6-1.6 3.6-1.8 4.6 0" fill="none" stroke="#A84862" stroke-width=".8"/>
      <rect x="14.5" y="10.5" width="7" height="5" fill="#EFE4D6" stroke="#C9B8A2" stroke-width=".7"/>
      <path d="M9 15h18l5 9v24c0 5-4 9-9 9H13c-5 0-9-4-9-9V24z" fill="#FCEEF0" fill-opacity=".9" stroke="#D9A3B1" stroke-width="1.3"/>
      <path d="M18 53V36" stroke="#6F8F5A" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M18 47c-5 0-8-3-9-6 4-1 7 1 9 6z" fill="#B9CFA3" stroke="#6F8F5A" stroke-width=".6"/>
      <path d="M18 43c4-1 7-3 8-6-4-1-7 1-8 6z" fill="#B9CFA3" stroke="#6F8F5A" stroke-width=".6"/>
      <g transform="translate(18 30)">
        <path d="M0 0c-6 0-9-4-7-7 2-3 6-3 7 0 1-3 5-3 7 0 2 3-1 7-7 7z" fill="#F1B3BF" stroke="#BD6E80" stroke-width=".8"/>
        <path d="M-7-1c0 4 3 7 7 7s7-3 7-7" fill="#E994A5" stroke="#B5566B" stroke-width=".8"/>
        <path d="M-3-1c1-2 5-2 6 0M-2 2c1 1 3 1 4 0" fill="none" stroke="#A84862" stroke-width=".8" stroke-linecap="round"/>
      </g>
      <rect x="7" y="25" width="2.6" height="20" rx="1.3" fill="#fff" fill-opacity=".75"/>
    </svg>`,
    bottleRight: `<svg viewBox="0 0 36 60" aria-hidden="true">
      <rect x="13" y="2" width="10" height="9" rx="2" fill="#C9B8A2" stroke="#8C6A4E" stroke-width=".7"/>
      <rect x="10" y="10" width="16" height="48" rx="6" fill="#FFF6E2" fill-opacity=".92" stroke="#D9C08C" stroke-width="1.3"/>
      <rect x="10.7" y="38" width="14.6" height="19.3" rx="5.3" fill="#F6E3B4" fill-opacity=".7"/>
      <path d="M16 16c-2 10-1.5 26 1 38 .6 2 2.4 2 2.6 0 1.2-12 .6-28-1.6-38-.5-1.6-1.6-1.6-2 0z" fill="#4A2C1C"/>
      <path d="M17.2 19c-.8 10-.4 22 .9 32" stroke="#7A4A2E" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <g transform="translate(20.5 17)">
        <path d="M0 0c3-3 6-3 6 0-3 2-5 2-6 0z" fill="#EFE8B8" stroke="#A8A060" stroke-width=".5"/>
        <path d="M0 0c1-4 4-5 5-3-1 3-3 4-5 3zM0 0c4 0 6 2 5 4-3 0-5-2-5-4z" fill="#F5EFC8" stroke="#A8A060" stroke-width=".5"/>
        <circle cx="1.4" cy=".4" r="1" fill="#E6C66A"/>
      </g>
      <path d="M16 15c-2-3-1-6 2-7" fill="none" stroke="#6F8F5A" stroke-width=".9"/>
      <rect x="12.5" y="14" width="2.4" height="38" rx="1.2" fill="#fff" fill-opacity=".7"/>
    </svg>`,
  };
})();
