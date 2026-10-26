import { sub } from './lib.mjs';
sub('public/sw.js', "const CACHE = 'petalkeeper-v3';", "// the page registers this file as sw.js?v=<app version>, so the offline copy is always named after the app version\nconst CACHE = 'petalkeeper-v' + (new URL(self.location.href).searchParams.get('v') || 'x');");
sub('src/main.tsx', "register('./sw.js')", "register(`./sw.js?v=${__APP_VERSION__}`)");
sub('src/store.tsx', "future.current.push({ d: current.current, parts: prev.parts });", "future.current.push({ d: current.current, parts: prev.parts, text: prev.text, at: prev.at });");
sub('src/store.tsx', "past.current.push({ d: current.current, parts: next.parts });", "past.current.push({ d: current.current, parts: next.parts, text: next.text, at: next.at });");
