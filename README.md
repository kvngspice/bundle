# Bvndle Marketing Tracker

A React/Vite tracker for BVNDLEFEST and the Bundle Concert, with a Google Sheet as the backend.

- **Edit, add and delete tasks in the Google Sheet.** The site picks up changes within 30 seconds.
- **Tick tasks on the site.** It asks for your name and writes "Marked done by [name]" with the time back to the sheet.

Setup takes about 15 minutes.

## 1. Create the sheet

1. In Google Drive: **New > File upload**, choose `sheet/bvndle-tracker-sheet.xlsx`.
2. Open it, then **File > Save as Google Sheets**. Use this Google Sheets copy from now on.
3. Keep the tab names (`Tasks`, `Workstreams`, `Settings`) and the row 1 headers exactly as they are.

## 2. Add the backend

1. In the Google Sheet: **Extensions > Apps Script**.
2. Delete the sample code and paste in everything from `apps-script/Code.gs`. Save.
3. **Project Settings (gear icon) > Script properties > Add property**
   - Property: `TEAM_KEY`
   - Value: any password-like word, e.g. `bvndle-2026-xk42`
4. **Deploy > New deployment**, choose type **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Click **Deploy**, approve the permissions, and copy the **Web app URL** (ends in `/exec`).

Test it: open `YOUR_URL?key=YOUR_TEAM_KEY` in a browser. You should see your tasks as JSON.

> When you change `Code.gs` later, use **Deploy > Manage deployments > Edit > New version** so the URL stays the same.

## 3. Connect the site

```bash
cp .env.example .env
# paste the Web app URL and TEAM_KEY into .env
npm install
npm run dev
```

Without a `.env`, the site runs in **demo mode** with the starter tasks and keeps ticks in your browser only.

## 4. Put it online (Vercel)

1. Push this folder to a GitHub repo.
2. In Vercel: **Add New > Project**, import the repo. Framework: Vite.
3. Under **Environment Variables**, add `VITE_API_URL` and `VITE_TEAM_KEY`.
4. Deploy and share the link with your team.

Netlify works the same way (build command `npm run build`, publish folder `dist`).

## Editing from the sheet

| Tab | What you can do |
|---|---|
| Tasks | Edit task text, due date, day, notes. Add a row to add a task (give it a new unique `id` like `T123`). Delete a row to delete a task. |
| Workstreams | Rename sections, change descriptions, reorder with `order`. |
| Settings | `event_date` drives the countdown. The labels show in the header. |

`done`, `done_by` and `done_at` are filled in by the site, but you can edit or clear them in the sheet too.

## Security note

The team key keeps casual visitors from reading or ticking tasks, but it ships inside the site's code, so anyone determined who has the link could find it. Don't put anything confidential in the sheet. For stronger protection, add password protection on Vercel (Pro plan) or Netlify.
