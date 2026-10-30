// Talks to the Google Apps Script web app that sits on the tracker sheet.
// With no VITE_API_URL set, the app runs in demo mode on public/demo.json
// and keeps ticks in this browser only.

const API = import.meta.env.VITE_API_URL || ''
const KEY = import.meta.env.VITE_TEAM_KEY || ''
const DEMO_KEY = 'bvndle-demo-done'

export const isDemo = !API

function demoDone() {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY) || '{}') } catch { return {} }
}

export async function loadTracker() {
  if (isDemo) {
    const data = await (await fetch('/demo.json')).json()
    const done = demoDone()
    data.tasks = data.tasks.map(t => (done[t.id] ? { ...t, ...done[t.id], done: true } : t))
    return data
  }
  const res = await fetch(`${API}?key=${encodeURIComponent(KEY)}&t=${Date.now()}`)
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data
}

export async function toggleTask(id, done, by) {
  if (isDemo) {
    const all = demoDone()
    const rec = { done_by: by, done_at: localStamp() }
    if (done) all[id] = rec; else delete all[id]
    try { localStorage.setItem(DEMO_KEY, JSON.stringify(all)) } catch {}
    return done ? { ok: true, ...rec } : { ok: true, done_by: '', done_at: '' }
  }
  // text/plain avoids a CORS preflight, which Apps Script cannot answer.
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ key: KEY, action: 'toggle', id, done, by })
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data
}

function localStamp() {
  const d = new Date(), p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
