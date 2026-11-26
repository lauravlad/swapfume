/*
  Romanian for Swapfume. A light translation layer: when the language is Română, any piece of
  interface text that exactly matches an English phrase below is shown in Romanian (headings,
  buttons, labels, placeholders, tabs, notices). Members' own words (posts, comments, messages,
  notes) are never touched. Sentences built with names or numbers inside them stay in English
  until they get their own entry.

  Language: the member's choice (footer: "Română" / "English"), else the phone's language.
  To translate more: add "English text": "Romanian text" lines to RO (exact text, as shown).
*/
(function () {
  const RO = {
    // ---- Navigation, tabs, common ----
    "Matches": "Potriviri", "Browse": "Explorează", "Collection": "Colecție", "Swaps": "Schimburi", "Community": "Comunitate", "Me": "Eu",
    "Sharing is caring": "Împărțim cu drag", "Notifications": "Notificări", "Messages": "Mesaje", "Search": "Caută", "🔍 Search": "🔍 Caută",
    "Feed": "Flux", "Discover": "Descoperă", "Friends": "Prieteni", "Groups": "Grupuri", "Meetups": "Întâlniri", "Saved": "Salvate",
    "Pass & give": "Dă mai departe", "Sign in": "Autentificare", "Sign out": "Deconectare", "Create account": "Creează cont",
    "Cancel": "Anulează", "Remove": "Elimină", "Report": "Raportează", "Edit": "Editează", "Delete": "Șterge", "Save": "Salvează",
    "Send": "Trimite", "Close": "Închide", "Confirm": "Confirmă", "Approve": "Aprobă", "Reject": "Respinge", "Decline": "Refuză",
    "Done": "Gata", "To do": "De făcut", "Go": "Mergi", "Join": "Alătură-te", "Leave": "Ieși", "Post": "Publică", "Publish": "Publică",
    "Change": "Schimbă", "Clear": "Golește", "Not now": "Nu acum", "Block": "Blochează", "Unblock": "Deblochează",
    "(optional)": "(opțional)", "Email": "Email", "Password": "Parolă", "Display name": "Nume afișat", "Name": "Nume", "City": "Oraș",
    "Date of birth": "Data nașterii", "Country you live in": "Țara în care locuiești", "Title": "Titlu", "Details": "Detalii",
    "Perfume": "Parfum", "Brand": "Brand", "Size": "Mărime", "Note": "Notă", "Notes": "Note", "Comments": "Comentarii", "Comment": "Comentează",
    "Full bottle": "Sticlă întreagă", "Decant": "Decant", "Sample": "Mostră", "Classic": "Clasic", "New member": "Membru nou",
    "Friend": "Prieten", "Add friend": "Adaugă prieten", "✓ Friends": "✓ Prieteni", "Wishlist": "Listă de dorințe", "Reviews": "Recenzii",
    "Privacy Policy": "Politica de confidențialitate", "Terms of Use": "Termeni de utilizare", "Support": "Ajutor",
    "Decanting guide": "Ghid de decantare", "Add my country": "Adaugă țara mea", "Our mission": "Misiunea noastră",
    "Swapfume is run by Octopup Studio · No money, ever.": "Swapfume este creat de Octopup Studio · Fără bani, niciodată.",
    "Take a photo": "Fă o poză", "Take one or choose from your photos": "Fă una sau alege din pozele tale",
    "Add a photo": "Adaugă o poză", "Photo added": "Poză adăugată", "Tap to change it": "Atinge ca s-o schimbi",
    "Remove photo": "Elimină poza", "Write a comment…": "Scrie un comentariu…", "Reply": "Răspunde", "Hidden": "Ascuns",
    "Admin": "Admin", "Private": "Privat", "Not found": "Nu a fost găsit",

    // ---- Welcome ----
    "A perfume swap community": "O comunitate de schimb de parfumuri", "Swap the scents": "Schimbă parfumurile", "you love.": "pe care le iubești.",
    "Trade samples, decants and bottles with fellow perfume lovers. No money, ever — just generosity and good packing.":
      "Schimbă mostre, decanturi și sticle cu alți iubitori de parfum. Fără bani, niciodată: doar generozitate și ambalaj bun.",
    "List your shelf": "Pune-ți raftul pe listă", "List what you have, what you'd trade, and what you're hunting for.":
      "Spune ce ai, ce ai schimba și ce cauți.", "Get matched": "Găsește potriviri",
    "Swap with confidence": "Schimbă cu încredere", "Addresses stay private until both of you accept the swap.":
      "Adresele rămân private până când acceptați amândoi schimbul.",
    "Reviews and a completed-swap count help you trade with confidence.": "Recenziile și numărul de schimburi încheiate te ajută să schimbi cu încredere.",
    "Join the circle": "Intră în cerc", "or with email": "sau cu email", "Forgot password?": "Ai uitat parola?",
    "Resend confirmation email": "Retrimite emailul de confirmare", "At least 8 characters.": "Cel puțin 8 caractere.",
    "You'll see matches and meetups in your country.": "Vei vedea potriviri și întâlniri din țara ta.",
    "What should people call you?": "Cum să-ți spună lumea?", "Continue with Google": "Continuă cu Google", "Continue with Apple": "Continuă cu Apple",
    "invited you to Swapfume. Join and you'll be friends right away.": "te-a invitat pe Swapfume. Intră și veți fi prieteni imediat.",
    "One quick check": "O verificare rapidă", "Please confirm your age": "Te rugăm să-ți confirmi vârsta",

    // ---- Mission ----
    "Make the world smell better,": "Hai să facem lumea să miroasă mai frumos,", "without the cost.": "fără să coste.",
    "I started Swapfume because fragrance should be a joy you discover on your own skin, not something you're talked into buying.":
      "Am creat Swapfume pentru că parfumul ar trebui să fie o bucurie pe care o descoperi pe propria piele, nu ceva ce ești convins să cumperi.",
    "Try it before you fall for it": "Încearcă-l înainte să te îndrăgostești",
    "Too many beautiful, expensive bottles are bought blind, just because an influencer called them a must-have. Here, a few drops from a fellow perfume lover come first. Wear it for a day, live with it for a week, and let your own nose decide.":
      "Prea multe sticle frumoase și scumpe sunt cumpărate pe nemirosite, doar pentru că un influencer le-a numit obligatorii. Aici, întâi vin câteva picături de la un alt iubitor de parfum. Poartă-l o zi, trăiește cu el o săptămână și lasă-ți nasul să decidă.",
    "A shelf of favorites, not a warehouse": "Un raft de preferate, nu un depozit",
    "Happiness doesn't live in hundreds of half-used bottles. A small collection you truly love is worth more than a wall of impulse buys. Swapfume is my quiet stand against perfume consumerism: share what you have, and keep what you cherish.":
      "Fericirea nu stă în sute de sticle pe jumătate folosite. O colecție mică pe care o iubești cu adevărat valorează mai mult decât un perete de cumpărături din impuls. Swapfume e felul meu discret de a mă opune consumerismului în parfumerie: împarte ce ai și păstrează ce prețuiești.",
    "Generosity is the whole point": "Generozitatea e totul",
    "Some of the loveliest discoveries arrive as a tiny vial from someone who simply wanted to share. I'm always more than happy to gift small samples, and I hope Swapfume makes that kind of kindness easy for everyone.":
      "Unele dintre cele mai frumoase descoperiri vin într-o fiolă mică, de la cineva care a vrut pur și simplu să împartă. Mă bucur mereu să dăruiesc mostre mici și sper ca Swapfume să facă această bunătate ușoară pentru toată lumea.",
    "Less buying, more sharing. Let's make the world smell better, together.": "Mai puține cumpărături, mai mult împărțit. Hai să facem împreună lumea să miroasă mai frumos.",
    "Back to Swapfume": "Înapoi la Swapfume",

    // ---- Notifications ----
    "Activity": "Activitate", "Mark all as read": "Marchează tot ca citit", "You're all caught up": "Ești la zi",
    "When someone messages you, comments, sends a friend request or answers a swap, it shows up here.":
      "Când cineva îți scrie, comentează, îți trimite o cerere de prietenie sau răspunde la un schimb, apare aici.",
    "Emails about this activity:": "Emailuri despre această activitate:", "change under Me": "schimbă din Eu",
    "Today": "Azi", "Yesterday": "Ieri", "This week": "Săptămâna aceasta", "Earlier": "Mai devreme",
    "sent you a message": "ți-a trimis un mesaj", "commented on your post": "a comentat la postarea ta",
    "also commented on a post you joined": "a comentat și la o postare la care ai participat", "liked your post": "a apreciat postarea ta",
    "sent you a friend request": "ți-a trimis o cerere de prietenie", "accepted your friend request": "ți-a acceptat cererea de prietenie",
    "would like to swap with you": "ar vrea să facă un schimb cu tine", "wants to give you a gift": "vrea să-ți facă un cadou",
    "accepted your swap": "a acceptat schimbul", "declined your swap": "a refuzat schimbul", "withdrew a swap proposal": "și-a retras propunerea de schimb",
    "shipped their side of your swap": "a trimis coletul pentru schimb", "received your package": "a primit coletul tău",
    "completed your swap. Leave a review?": "a încheiat schimbul. Lași o recenzie?", "left you a review": "ți-a lăsat o recenzie",
    "is coming to your meetup": "vine la întâlnirea ta", "commented on a meetup": "a comentat la o întâlnire", "cancelled a meetup you joined": "a anulat o întâlnire la care participai",
    "joined your pass-around": "s-a alăturat circuitului tău", "entered your giveaway": "s-a înscris la oferta ta",
    "started the pass-around. You're on the route!": "a pornit circuitul. Ești pe traseu!", "sent the pass-around bottle on to you": "ți-a trimis mai departe sticla din circuit",
    "received your pass-around bottle": "a primit sticla din circuitul tău", "drew you as a winner of their giveaway!": "te-a ales câștigător la oferta sa!",
    "cancelled a pass-around or giveaway you joined": "a anulat un circuit sau o ofertă la care participai",
    "joined Swapfume with your invite! You're now friends.": "a intrat pe Swapfume cu invitația ta! Acum sunteți prieteni.",
    "replied to your comment": "ți-a răspuns la comentariu", "mentioned you": "te-a menționat",
    "opened a claim on a swap": "a deschis o reclamație la un schimb", "closed a claim on your swap": "a închis o reclamație la schimbul tău",
    "Email me about new messages, comments, friend requests and swap updates I haven't seen (at most one email every 30 minutes)":
      "Trimite-mi email despre mesaje, comentarii, cereri de prietenie și noutăți la schimburi pe care nu le-am văzut (cel mult un email la 30 de minute)",
    "Email me when someone sends me a swap proposal or a gift": "Trimite-mi email când cineva îmi propune un schimb sau un cadou",
    "Tell me when someone near me lists a perfume from my wishlist": "Anunță-mă când cineva din apropiere pune la schimb un parfum de pe lista mea de dorințe",

    // ---- Chat ----
    "No messages yet. Say hi! 👋": "Niciun mesaj încă. Spune salut! 👋", "Seen": "Văzut", "Add a photo ": "Adaugă o poză",
    "Keep it on Swapfume: don't share emails, phone numbers or payment apps. Swapfume never involves money.":
      "Rămâneți pe Swapfume: nu dați emailuri, numere de telefon sau aplicații de plată. Pe Swapfume nu circulă niciodată bani.",
    "All messages": "Toate mesajele", "No messages yet": "Niciun mesaj încă",

    // ---- Groups ----
    "Find your people": "Găsește-ți oamenii", "Your groups": "Grupurile tale", "More groups": "Mai multe grupuri", "All groups": "Toate grupurile",
    "Start a group": "Pornește un grup", "Group not found": "Grupul nu a fost găsit",
    "Clubs for every taste, open to members in every country. Join a few and their posts gather in each group.":
      "Cluburi pentru fiecare gust, deschise membrilor din orice țară. Alătură-te câtorva și postările se adună în fiecare grup.",
    "Join the group to post here. Anyone can read along.": "Alătură-te grupului ca să postezi aici. Oricine poate citi.",
    "A club for a taste, a style or a place. You can start up to 2.": "Un club pentru un gust, un stil sau un loc. Poți porni până la 2.",
    "What's it about?": "Despre ce e?", "Create group": "Creează grupul", "No posts yet": "Nicio postare încă",
    "Niche houses": "Case de nișă", "Ouds & ambers": "Ouduri și chihlimbar", "Vintage & classics": "Vintage și clasice",
    "Designer favourites": "Preferate de designer", "Fresh & green": "Proaspete și verzi", "Gourmands": "Gurmande",
    "Decanters' corner": "Colțul decantorilor", "Beginners welcome": "Începătorii sunt bineveniți",

    // ---- Pass-arounds and giveaways ----
    "Pass-arounds & giveaways": "Circuite și oferte", "Pass-around": "Circuit", "Giveaway": "Ofertă", "Start one": "Pornește unul",
    "Open now": "Deschise acum", "Mine": "Ale mele", "Open": "Deschis", "Closed": "Închis", "On its way": "Pe drum", "Back home": "Înapoi acasă",
    "Drawn": "Tras la sorți", "Cancelled": "Anulat", "You won!": "Ai câștigat!", "You're in": "Ești înscris",
    "Start a pass-around or giveaway": "Pornește un circuit sau o ofertă", "What kind?": "Ce fel?", "What travels": "Ce călătorește",
    "Each person takes": "Fiecare ia", "Each winner gets": "Fiecare câștigător primește", "How many people": "Câte persoane", "How many samples": "Câte mostre",
    "Entries close": "Înscrierile se închid", "Search the catalog.": "Caută în catalog.", "Enter the giveaway": "Înscrie-te la ofertă",
    "Withdraw my entry": "Retrage-mi înscrierea", "You're entered. Good luck! 🍀": "Ești înscris. Baftă! 🍀", "Join the pass-around": "Intră în circuit",
    "You'll need your shipping address saved under Me.": "Trebuie să ai adresa de livrare salvată la Eu.", "It's full.": "E plin.",
    "Start it: fix the route": "Pornește-l: fixează traseul", "The route follows joining order and ends back with you.": "Traseul urmează ordinea înscrierii și se încheie la tine.",
    "You have the bottle.": "Sticla e la tine.", "I've sent it": "Am trimis-o", "It's on its way to you!": "E pe drum spre tine!", "It arrived": "A ajuns",
    "(host)": "(gazdă)", "has it now": "o are acum", "No one yet. Be the first!": "Nimeni încă. Fii primul!", "Send it to": "Trimite-o la",
    "Winners 🎁": "Câștigători 🎁", "Send their gift": "Trimite-le cadoul", "The host cancelled this.": "Gazda a anulat.",
    "Entries": "Înscrieri", "Who's joining": "Cine participă", "The route": "Traseul",

    // ---- Posts, saved, search ----
    "Scent of the day": "Parfumul zilei", "New discovery": "Descoperire nouă", "Haul": "Achiziții", "Question": "Întrebare", "Thoughts": "Gânduri",
    "📊 Add a poll": "📊 Adaugă un sondaj", "Remove the poll": "Elimină sondajul", "Poll options": "Opțiuni de sondaj",
    "🔖 Save": "🔖 Salvează", "🔖 Saved": "🔖 Salvat", "Pin": "Fixează", "Unpin": "Anulează fixarea", "📌 Pinned": "📌 Fixat", "edited": "editat",
    "Just for you": "Doar pentru tine", "Saved posts": "Postări salvate", "Posts you saved for later. Only you can see this list.": "Postări salvate pentru mai târziu. Doar tu vezi lista.",
    "Nothing saved yet": "Nimic salvat încă", "Find people and posts": "Găsește oameni și postări", "People": "Oameni", "Posts": "Postări",
    "Type at least 2 letters.": "Scrie cel puțin 2 litere.", "Looking for a perfume?": "Cauți un parfum?", "Write a post": "Scrie o postare",
    "Go to Discover": "Mergi la Descoperă", "Your feed is quiet": "Fluxul tău e liniștit",

    // ---- Friends and invites ----
    "Invite a friend 💐": "Invită un prieten 💐", "Share your link. When they join, you'll be friends straight away.": "Trimite-ți linkul. Când intră, veți fi prieteni imediat.",
    "Share": "Trimite", "Friend requests": "Cereri de prietenie", "Accept": "Acceptă",

    // ---- Swaps, shipping, claims ----
    "📦 Shipping": "📦 Livrare", "Your tracking number (optional)": "Numărul tău de urmărire (opțional)", "Add": "Adaugă", "Update": "Actualizează",
    "Something went wrong?": "A apărut o problemă?", "It didn't arrive": "Nu a ajuns", "It arrived damaged": "A ajuns deteriorat", "Not as described": "Nu e cum a fost descris",
    "Leaked, broken or crushed.": "S-a scurs, s-a spart sau s-a turtit.", "Open a claim": "Deschide o reclamație", "It's sorted, close my claim": "S-a rezolvat, închide reclamația",
    "Resolution:": "Rezolvare:", "Propose a swap": "Propune un schimb", "Give a gift": "Fă un cadou", "Accept swap": "Acceptă schimbul",
    "Accept gift": "Acceptă cadoul", "No, thank you": "Nu, mulțumesc", "I've shipped my package": "Am trimis coletul", "I've shipped the gift": "Am trimis cadoul",
    "Their package arrived": "Coletul lor a ajuns", "My gift arrived": "Cadoul a ajuns", "We met up and swapped": "Ne-am întâlnit și am făcut schimbul",
    "Meet in person": "Întâlnire în persoană", "Ship by mail": "Trimite prin poștă", "Write a review": "Scrie o recenzie",

    // ---- Collection, catalog ----
    "My collection": "Colecția mea", "Add a perfume": "Adaugă un parfum", "Paste a list or photo": "Lipește o listă sau o poză",
    "Your shelf is empty": "Raftul tău e gol", "Add to wishlist": "Adaugă la dorințe", "I have this": "Îl am", "I want this": "Îl vreau",
    "On your wishlist": "Pe lista ta de dorințe", "Available to swap": "Disponibil la schimb", "Member reviews": "Recenziile membrilor",
    "Your review": "Recenzia ta", "Longevity": "Persistență", "Sillage": "Dâră", "Top notes": "Note de vârf", "Heart notes": "Note de inimă", "Base notes": "Note de bază",
    "Your matches": "Potrivirile tale", "Two-way match": "Potrivire în ambele sensuri", "Getting started": "Primii pași", "Browse trades": "Vezi schimburile",
    "Edit profile": "Editează profilul", "Community meetups": "Întâlniri ale comunității", "Organize a meetup": "Organizează o întâlnire", "All meetups": "Toate întâlnirile"
  };

  const KEY = "swapfume_lang";
  const pick = () => { try { const v = localStorage.getItem(KEY); if (v === "ro" || v === "en") return v; } catch (e) { /* private mode */ } return /^ro\b/i.test(navigator.language || "") ? "ro" : "en"; };
  const lang = pick();
  window.I18N = {
    lang,
    t: (s) => (lang === "ro" && RO[s]) || s,
    set(l) { try { localStorage.setItem(KEY, l); } catch (e) { /* ignore */ } location.reload(); }
  };

  // Footer switch: shows the other language.
  const sw = document.getElementById("langSwitch");
  if (sw) { sw.textContent = lang === "ro" ? "English" : "Română"; sw.lang = lang === "ro" ? "en" : "ro"; sw.addEventListener("click", (e) => { e.preventDefault(); window.I18N.set(lang === "ro" ? "en" : "ro"); }); }
  if (lang !== "ro") return;
  document.documentElement.lang = "ro";

  // Never translate members' own words.
  const SKIP = "script,style,textarea,pre,code,.post-body,.bubble,.notif-quote,.comment-list .bubble,.addr-box,[data-noi18n],#langSwitch";
  const ATTRS = ["placeholder", "aria-label", "title"];
  function textNode(n) {
    const v = n.nodeValue, k = v.trim();
    if (!k || !RO[k] || RO[k] === k) return;   // same in both languages: nothing to do (and no loop)
    if (n.parentElement && n.parentElement.closest(SKIP)) return;
    const next = v.replace(k, RO[k]);
    if (next !== v) n.nodeValue = next;
  }
  function element(el) {
    if (el.closest && el.closest(SKIP)) return;
    ATTRS.forEach((a) => { const v = el.getAttribute && el.getAttribute(a), t = v && RO[v.trim()]; if (t && t !== v) el.setAttribute(a, t); });
  }
  function run(root) {
    if (root.nodeType === 3) return textNode(root);
    if (root.nodeType !== 1) return;
    element(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let n = w.nextNode(); n; n = w.nextNode()) n.nodeType === 3 ? textNode(n) : element(n);
  }
  run(document.body);
  new MutationObserver((ms) => ms.forEach((m) => {
    if (m.type === "characterData") textNode(m.target);
    else m.addedNodes.forEach(run);
  })).observe(document.body, { childList: true, subtree: true, characterData: true });
})();
