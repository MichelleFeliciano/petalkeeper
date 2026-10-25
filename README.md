# Petalkeeper — *Tend to what matters.*

A gentle, private, offline-capable personal planner with a cottagecore garden theme.
React + TypeScript + Vite. No backend, no login, no analytics, no paid services. All data stays in your browser.

## Run locally (Windows)

Requires Node.js 18+ (tested with Node 24).

```powershell
cd Petalkeeper
npm install
npm run dev        # opens at http://localhost:5173
```

Other commands:

```powershell
npm test           # run the automated tests
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build locally
```

## Sections

| Name | What it is |
| --- | --- |
| Today's Garden | Daily dashboard: next up, timeline, flexible tasks, progress, quick add, **Adjust My Day**, copy yesterday's plan |
| Daily Rituals | Morning / evening checklists (editable, reorderable, skip-able; resets every day) |
| The Garden Path | Weekly planner (week grid or agenda), move tasks between days, overlap warnings |
| Seed Pouch | All tasks with filters: Today, Upcoming, Overdue, Unscheduled, Completed |
| Garden Shed | Settings, JSON export/import, reset |

Garden behaviour is deliberately kind: blooms only ever accumulate, nothing withers, there are no streaks, and the fairy and garden can be switched off in the Garden Shed without affecting any scheduling feature.

## Backup and restore

Data lives in this browser's `localStorage` (key `petalkeeper.v1`). It **does not sync between devices** and is lost if you clear site data.

- **Back up:** Garden Shed → *Export backup (JSON)*. A `petalkeeper-backup-YYYY-MM-DD.json` file downloads. Keep it somewhere safe (it is git-ignored; never commit it).
- **Restore:** Garden Shed → *Import backup…* and choose the file. The file is validated first; a malformed file is rejected and your current data is left untouched.
- To move to another device, export on one and import on the other.

## Private GitHub repository

```powershell
git add -A
git commit -m "Initial Petalkeeper"
gh auth login                                   # once, if not signed in
gh repo create petalkeeper --private --source . --push
```

Or without the GitHub CLI: create an empty private repo on github.com, then
`git remote add origin https://github.com/<you>/petalkeeper.git` and `git push -u origin main`.

## Deploy for free (GitHub Pages)

The build uses relative asset paths (`base: './'`) and hash navigation, so it works under any repo name.

1. `npm run build`
2. Publish the `dist/` folder, either:
   - **GitHub Actions:** repo *Settings → Pages → Source: GitHub Actions*, then use GitHub's "Deploy static content" workflow with `npm ci && npm run build` and upload `dist`.
   - **Manual:** push `dist/` contents to a `gh-pages` branch and set *Pages → Source* to that branch.

Any free static host (Netlify, Cloudflare Pages) also works with `dist/`. Remember: each browser/device has its own separate data.

## Design notes

- Palette tokens: sage `#A8B99A`, dusty petal `#E8B8C4`, cream `#FFF7E9`, lilac `#C9B8D9`, moss `#687B5D` (a slightly deeper moss is used behind white button text for contrast).
- The fairy and garden are original inline SVG (`src/components/Fairy.tsx`), four poses: welcome, focus, rest, encouragement. No remote assets or fonts.
- Light and dark ("twilight") themes; respects reduced motion; keyboard-navigable with visible focus; completion is shown with text/✓ as well as color.

## Extras

- **Hours view** on Today's Garden (List / Hours toggle), **Print** buttons, and a print-friendly layout.
- **Edit just this day** of a repeating task (the rest of the series is untouched).
- **Undo** for deletes, moves, copies and templates (a few seconds after the change).
- **Day templates:** save a day, add it to any other day.
- **Search** across all tasks in the Seed Pouch.
- **Drag and drop** tasks between days on the Garden Path and reorder routine steps by dragging while editing.
- **Guide me:** step-by-step routine mode with an optional timer for steps that have minutes.
- **Week in review:** a kind summary, with no scores or streaks.
- **Calendar export (.ics):** one week from the Garden Path, or the next 90 days from the Garden Shed.
- **Custom categories** (name, emoji, color) and four garden decoration styles.
- **Backup nudge:** a gentle note on Today after about three weeks without an export.
- **Install as an app / offline:** production builds register a small service worker and web manifest, so a browser can install Petalkeeper and it keeps working offline. (It only registers on the built site, not `npm run dev`.)
- **Reminders:** optional browser notifications for timed activities, enabled in the Garden Shed. They only appear while Petalkeeper is open in a browser tab.

## Phone + computer sync

Petalkeeper syncs through a **private GitHub repository you own**. There is no other service, and no server of ours. Your schedule is only ever written to that private repo.

1. Create a **private** repo on github.com (e.g. `petalkeeper-data`, tick "Add a README"). Keep it separate from the app's source repo.
2. Create a *fine-grained personal access token*: Settings → Developer settings → Personal access tokens → Fine-grained. Repository access: **only that repo**. Permissions: **Contents → Read and write**.
3. In Petalkeeper: Garden Shed → *Sync between devices* → enter `owner/petalkeeper-data` and the token → Connect. Do the same on the other device. When connecting a new device that already has cloud data, choose "Use the cloud copy here".

How it behaves: changes sync a few seconds after you make them, when you open or return to the app, and every ~90 seconds while it is visible. Edits made on two devices are merged (new items from both are kept, deletions carry over, and if the *same* item was changed on both, the device you're syncing from wins). If you're offline, everything keeps working and syncs later. The token is stored only in that browser's storage and is never included in backups or in the cloud copy. Keep exporting backups too, since sync isn't a backup of last resort.

## Put it on your phone

The app must be hosted at a web address so your phone can open it. Hosting is free:

- **GitHub Pages** (workflow included at `.github/workflows/deploy.yml`): push this project to a GitHub repo, then Settings → Pages → Source: *GitHub Actions*. Free Pages needs a **public** source repo. That is fine here because no personal data lives in the code repo (your schedule lives only in the private data repo and on your devices). If you want the code private, use Cloudflare Pages or Netlify instead (both free; build command `npm run build`, output folder `dist`).
- Open the address on your phone, then use the browser's *Add to Home Screen* / *Install app*. It then opens like a normal app and works offline.

## Not included

- Reminders when the browser is completely closed.
- Medication checklist items are your own reminders, not medical advice.

## Routines and daily extras (v1.3)

- **Routines by part of the day** (Morning, Midday, Afternoon, Evening, Bedtime), optionally for certain weekdays, with ready-made starters (Wake-up, Laundry day, Therapy day, and more).
- **Steps** can be essential (★, kept on gentle days), optional (never block a routine), or limited to certain weekdays.
- **Today** has a "do this now" card, routines with checkboxes, pause (just today, 3 days, a week, until you resume) and gentle-day mode, little counters, and a private mood check-in.
- **History** shows the last four weeks per routine with no streaks or scores; the week review includes routine and mood notes.
- **Calendar nudges:** give a routine a nudge time, then export `.ics` from the Garden Shed so your phone's calendar can remind you even when the app is closed.
- **This device:** text size, an optional casual PIN lock, and a welcome tour; these never sync.

## v1.4

- **Places & modes** (Home, Mom's, Vacation, Road trip, plus your own): switch where you are on Today and routines and steps tied to other places step aside. Plan stays ahead of time; copy a routine for a place from Daily Rituals → Edit.
- **Sync:** restore an earlier saved version of your cloud copy, and optionally encrypt the cloud copy with a passphrase (AES-GCM; a forgotten passphrase can't be recovered).
- **As needed** items ("last done 8:10 am"), **countdowns**, **planned rests**, optional routine **timing**, step **notes and links**.
- **Garden Journal:** month calendar of moods and notes, search, and a soft weekday observation once there's enough history.
- **Share to Petalkeeper** (Android, installed app) adds shared text to the Seed Pouch; optional **weekly backup download**.

## v1.5

- First open can start with an **empty garden** instead of the examples.
- **Token expiry** heads-up and a **Replace token** button for sync; a clearer message when GitHub stops accepting the token.
- **Damaged-data recovery** banner, number boxes you can clear while typing, and notes that **autosave** as you pause.
- Automated **accessibility checks** (axe) in the test suite.
- Home-screen **shortcuts**, an **offline** note, **paste a list** to add routine steps, a **tomorrow preview** in the evening, **undo** for the "do this now" buttons, a **shareable summary** (print, PDF or copy as text), and a **week-at-a-glance** routine grid.
