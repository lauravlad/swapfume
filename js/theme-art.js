// SWAPFUME THEME ART: Gustav Klimt (golden period). Theme id: klimt
// Replaced every week by the style agent (themes/WEEKLY-STYLE-AGENT.md), together with css/theme.css.
// Four small inline SVGs for the welcome page: two members (drawn, never real people) and the two
// bottles they swap. Rules: viewBox 0 0 64 64 for avatars (with class="avatar"), 0 0 36 60 for bottles,
// aria-hidden="true", unique gradient ids, no external images, no scripts.
(function () {
  const GOLD = (id) => `<defs><radialGradient id="${id}" cx="50%" cy="35%" r="75%"><stop offset="0" stop-color="#F7E08A"/><stop offset=".55" stop-color="#D4A437"/><stop offset="1" stop-color="#8C6418"/></radialGradient></defs>
      <rect width="64" height="64" fill="url(#${id})"/>
      <g fill="none" stroke="#8C6418" stroke-width=".9" opacity=".75"><path d="M8 12a3 3 0 1 1 3 3 5 5 0 1 1-5-5"/><path d="M55 9a3 3 0 1 0-3 3 5 5 0 1 0 5-5"/><path d="M6 40a2.5 2.5 0 1 1 2.5 2.5 4 4 0 1 1-4-4"/><path d="M58 38a2.5 2.5 0 1 0-2.5 2.5 4 4 0 1 0 4-4"/></g>
      <g fill="#FFF3C4" opacity=".8"><circle cx="15" cy="5" r=".9"/><circle cx="50" cy="20" r=".9"/><circle cx="5" cy="26" r=".7"/><circle cx="60" cy="27" r=".7"/></g>`;
  window.SwapfumeTheme = {
    id: "klimt",
    name: "Gustav Klimt",
    avatarLeft: `<svg class="avatar" viewBox="0 0 64 64" aria-hidden="true">${GOLD("kgL")}
      <path d="M15 33c0-14 7-21 17-21s17 7 17 21v20H15z" fill="#1E140D"/>
      <path d="M8 64c0-12 10-19 24-19s24 7 24 19z" fill="#E3B341" stroke="#7A5512" stroke-width=".8"/>
      <g stroke="#1E140D" stroke-width=".5"><circle cx="18" cy="56" r="3" fill="#C2185B"/><circle cx="27" cy="52" r="2.4" fill="#2E7D74"/><circle cx="37" cy="53" r="3" fill="#F4E6BE"/><circle cx="46" cy="57" r="2.6" fill="#C2185B"/><circle cx="31" cy="60" r="2.2" fill="#3949AB"/><circle cx="12" cy="62" r="1.8" fill="#F4E6BE"/><circle cx="52" cy="63" r="2" fill="#2E7D74"/></g>
      <g fill="#F7E08A"><circle cx="18" cy="56" r="1"/><circle cx="37" cy="53" r="1"/><circle cx="46" cy="57" r=".9"/></g>
      <rect x="28" y="37" width="8" height="9" rx="3.5" fill="#E8C3A8"/>
      <ellipse cx="32" cy="29" rx="10.5" ry="12" fill="#F5DCC8"/>
      <path d="M21 28c1-9 6-13 12-13 7 0 11 5 11 11-6 0-12-2-16-7-1 4-4 7-7 9z" fill="#1E140D"/>
      <path d="M26 30.5q1.8 1.4 3.6 0M34.4 30.5q1.8 1.4 3.6 0" fill="none" stroke="#3A2620" stroke-width="1.2" stroke-linecap="round"/>
      <circle cx="25" cy="34" r="2" fill="#F08FA2" opacity=".5"/><circle cx="39" cy="34" r="2" fill="#F08FA2" opacity=".5"/>
      <path d="M29.8 35.6q2.2 1.4 4.4 0" fill="#C2185B" stroke="#A3144C" stroke-width="1" stroke-linecap="round"/>
      <g stroke="#7A5512" stroke-width=".4"><circle cx="22" cy="18" r="2.6" fill="#F06292"/><circle cx="27" cy="14" r="2.2" fill="#F4E6BE"/><circle cx="40" cy="15" r="2.4" fill="#7FC8B8"/><circle cx="44.5" cy="20" r="2" fill="#F06292"/></g>
      <g fill="#F2D27A"><circle cx="22" cy="18" r=".9"/><circle cx="27" cy="14" r=".8"/><circle cx="40" cy="15" r=".8"/><circle cx="44.5" cy="20" r=".7"/></g>
    </svg>`,
    avatarRight: `<svg class="avatar" viewBox="0 0 64 64" aria-hidden="true">${GOLD("kgR")}
      <path d="M8 64c0-12 10-19 24-19s24 7 24 19z" fill="#D4A437" stroke="#7A5512" stroke-width=".8"/>
      <g fill="#14100B"><rect x="13" y="54" width="4" height="8"/><rect x="22" y="50" width="3.5" height="7"/><rect x="38" y="51" width="3.5" height="7"/><rect x="47" y="55" width="4" height="8"/><rect x="29" y="58" width="5" height="4"/></g>
      <g fill="#F4E6BE"><rect x="18" y="58" width="3" height="5"/><rect x="42.5" y="58" width="3" height="5"/><rect x="33" y="52" width="2.5" height="5"/><rect x="26" y="59" width="2.5" height="4"/></g>
      <path d="M50 49a2 2 0 1 1-2 2" fill="none" stroke="#7A5512" stroke-width=".8"/>
      <rect x="28" y="37" width="8" height="9" rx="3.5" fill="#94603F"/>
      <ellipse cx="32" cy="29" rx="11" ry="12" fill="#AE7350"/>
      <g fill="#1E140D"><circle cx="23" cy="22" r="5"/><circle cx="28" cy="17.5" r="5.2"/><circle cx="34" cy="16.5" r="5.2"/><circle cx="39.5" cy="19.5" r="5"/><circle cx="42" cy="24.5" r="3.6"/><circle cx="21.5" cy="26" r="3"/></g>
      <g fill="none" stroke="#F2D27A" stroke-width=".7" opacity=".9"><path d="M25 18a1.5 1.5 0 1 1 1.5 1.5"/><path d="M34 15a1.5 1.5 0 1 1 1.5 1.5"/><path d="M40 21a1.3 1.3 0 1 1 1.3 1.3"/></g>
      <g fill="none" stroke="#7A5512" stroke-width="1.4"><circle cx="27.3" cy="30" r="3.6"/><circle cx="36.7" cy="30" r="3.6"/><path d="M30.9 29.6h2.2"/></g>
      <circle cx="27.3" cy="30.2" r="1.3" fill="#1E140D"/><circle cx="36.7" cy="30.2" r="1.3" fill="#1E140D"/>
      <path d="M28.3 35.3q3.7 3.2 7.4 0" fill="none" stroke="#4A2418" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    bottleLeft: `<svg viewBox="0 0 36 60" aria-hidden="true">
      <rect x="13" y="3" width="10" height="8" rx="2" fill="#C9A24A"/><rect x="14.5" y="10" width="7" height="6" fill="#E9D9B0"/>
      <rect x="4" y="15" width="28" height="42" rx="11" fill="#FCE4EC" fill-opacity=".85" stroke="#E7A9BD" stroke-width="1.4"/>
      <path d="M18 54V34" stroke="#4E8B4A" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M18 46c-5-1-8-4-8-7 4 0 7 2 8 7z" fill="#6FAE5F"/><path d="M18 42c4-1 7-3 7-6-4 0-6 2-7 6z" fill="#6FAE5F"/>
      <circle cx="18" cy="28" r="7" fill="#C2185B"/>
      <path d="M13 27c1-4 4-6 7-5 2 1 3 3 2 5" fill="none" stroke="#F06292" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M15.5 29c0-2.5 2-3.5 3.5-3 1.5.5 1.5 2.4 0 3" fill="none" stroke="#880E4F" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M11.5 30c1 3.5 4 5 6.5 5s5-1.5 6.5-4.5" fill="none" stroke="#AD1457" stroke-width="1.3"/>
      <rect x="7" y="19" width="3" height="22" rx="1.5" fill="#fff" fill-opacity=".7"/>
    </svg>`,
    bottleRight: `<svg viewBox="0 0 36 60" aria-hidden="true">
      <rect x="12.5" y="2" width="11" height="9" rx="2.5" fill="#3B2A22"/>
      <rect x="10" y="10" width="16" height="48" rx="6" fill="#FFF3D6" fill-opacity=".9" stroke="#E5C27A" stroke-width="1.4"/>
      <rect x="10.7" y="36" width="14.6" height="21.3" rx="5.3" fill="#F6D99A" fill-opacity=".7"/>
      <path d="M16 15c-2 10-1.5 26 1 39 .6 2 2.4 2 2.6 0 1.2-13 .6-29-1.6-39-.5-1.6-1.6-1.6-2 0z" fill="#4A2C1C"/>
      <path d="M17.2 18c-.8 10-.4 22 .9 33" stroke="#7A4A2E" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <path d="M18 15c1.5-2.5 4-3.5 6-2.5-1.5 2.4-3.6 3.2-6 2.5z" fill="#F7EEC8" stroke="#E5C27A" stroke-width=".6"/>
      <rect x="12.5" y="14" width="2.4" height="38" rx="1.2" fill="#fff" fill-opacity=".7"/>
    </svg>`,
  };
})();
