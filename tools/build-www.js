// Copies the website files into www/ — the folder the iPhone app (Capacitor) bundles.
// Only what the app needs: no supabase/, tools/ or node_modules/.
// Run from the perfume-swap folder:  node tools/build-www.js   (or: npm run ios:sync)
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true });
const copy = (rel) => fs.cpSync(path.join(root, rel), path.join(out, rel), { recursive: true });
['index.html', 'manifest.webmanifest', 'css', 'js', 'icons'].forEach(copy);
console.log('www/ ready');
