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

## Not included in this version

- Browser notification reminders (they can't be delivered reliably when the browser is closed without a backend).
- Drag-and-drop, search, schedule templates, weekly summaries.
- Editing a single occurrence of a recurring task in place: you can delete or move one occurrence (Adjust My Day / Garden Path "Move to…" create a one-off copy), while the Edit form changes the whole series.
- Medication checklist items are your own reminders, not medical advice.
