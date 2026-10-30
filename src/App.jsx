import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { loadTracker, toggleTask, isDemo } from './api.js'

const REFRESH_MS = 30000
const NAME_KEY = 'bvndle-name'
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const parseDay = s => {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number)
  return y ? new Date(y, m - 1, d) : null
}
const shortDate = s => {
  const d = parseDay(s)
  return d ? `${MONTHS[d.getMonth()]} ${d.getDate()}` : ''
}
// done_at is Lagos local time from the sheet: format without timezone shifts.
const stamp = s => {
  const m = String(s).match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  return m ? `${+m[3]} ${MONTHS[+m[2] - 1]}, ${m[4]}:${m[5]}` : ''
}

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [name, setName] = useState(() => { try { return localStorage.getItem(NAME_KEY) || '' } catch { return '' } })
  const [needName, setNeedName] = useState(false)
  const [saving, setSaving] = useState({})
  const [notice, setNotice] = useState('')

  const refresh = useCallback(async () => {
    try { setData(await loadTracker()); setError('') }
    catch (e) { setError(e.message === 'unauthorised' ? 'The team key is wrong. Check VITE_TEAM_KEY.' : 'Could not reach the sheet. Retrying in 30 seconds.') }
  }, [])

  useEffect(() => {
    refresh()
    const t = setInterval(() => { if (!document.hidden) refresh() }, REFRESH_MS)
    return () => clearInterval(t)
  }, [refresh])

  const saveName = v => { setName(v); setNeedName(false); try { localStorage.setItem(NAME_KEY, v.trim()) } catch {} }

  const onToggle = async (task, done) => {
    const by = name.trim()
    if (done && !by) { setNeedName(true); document.getElementById('myname')?.focus(); return }
    const before = data
    setSaving(s => ({ ...s, [task.id]: true }))
    setData(d => ({ ...d, tasks: d.tasks.map(t => t.id === task.id ? { ...t, done, done_by: done ? by : '', done_at: done ? 'saving' : '' } : t) }))
    try {
      const r = await toggleTask(task.id, done, by)
      setData(d => ({ ...d, tasks: d.tasks.map(t => t.id === task.id ? { ...t, done, done_by: r.done_by, done_at: r.done_at } : t) }))
      setNotice('')
    } catch (e) {
      setData(before)
      setNotice(e.message === 'not_found' ? 'That task was removed from the sheet. Refreshing.' : 'That change did not save. Try again.')
      refresh()
    } finally {
      setSaving(s => { const n = { ...s }; delete n[task.id]; return n })
    }
  }

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])

  if (!data) {
    return <div className="wrap"><p className="loading">{error || 'Loading the tracker from the sheet…'}</p></div>
  }

  const s = data.settings || {}
  const event = parseDay(s.event_date) || new Date(2026, 11, 11)
  const tasks = data.tasks.map(t => {
    const due = parseDay(t.due)
    const diff = due ? (due - today) / 864e5 : 99
    return { ...t, late: diff < 0, soon: diff >= 0 && diff <= 7 }
  })
  const doneCount = tasks.filter(t => t.done).length
  const daysLeft = Math.max(0, Math.ceil((event - today) / 864e5))
  const match = t => filter === 'all' || (filter === 'open' && !t.done) || (filter === 'week' && t.soon && !t.done) || (filter === 'late' && t.late && !t.done)

  const known = new Set(data.workstreams.map(w => w.id))
  const groups = [...data.workstreams]
  if (tasks.some(t => !known.has(t.workstream))) groups.push({ id: '__other', name: 'Other', description: 'Tasks with a workstream id that is not on the Workstreams tab.' })

  return (
    <div className="wrap">
      <header>
        <div className="band">
          {s.day1_label && <span className="pass free">Day 1 · {s.day1_label.replace(/^Day 1 · /, '')}</span>}
          {s.day2_label && <span className="pass paid">Day 2 · {s.day2_label.replace(/^Day 2 · /, '')}</span>}
          {s.venue && <span className="pass">{s.venue}</span>}
        </div>
        <h1>The Bvndle<br /><span>marketing tracker</span></h1>
        <p className="sub">
          Every marketing task, grouped by workstream and dated against the event. Edit tasks in the Google Sheet; ticks here save back to it.
          {isDemo && <strong className="demo"> Demo mode: not connected to a sheet yet.</strong>}
        </p>
        <div className="stats">
          <div className="stat"><b>{doneCount}</b><small>Done</small></div>
          <div className="stat"><b>{tasks.length - doneCount}</b><small>To do</small></div>
          <div className="stat"><b>{daysLeft}</b><small>Days to Day 1</small></div>
        </div>
        <div className="bar" aria-hidden="true"><i style={{ width: `${tasks.length ? doneCount / tasks.length * 100 : 0}%` }} /></div>
        <div className={`namebar${needName ? ' need' : ''}`}>
          <label htmlFor="myname">Your name</label>
          <input id="myname" type="text" placeholder="e.g. Samson Adebayo" autoComplete="name" value={name} onChange={e => saveName(e.target.value)} />
          <small>{needName ? 'Add your name before marking a task done.' : 'Enter your name once. Every task you tick shows "Marked done by" you.'}</small>
        </div>
        {(notice || (error && data)) && <p className="notice">{notice || error}</p>}
      </header>

      <div className="filters" role="toolbar" aria-label="Filter tasks">
        {[['all', 'All'], ['week', 'Due in 7 days'], ['late', 'Overdue'], ['open', 'Hide done']].map(([k, l]) => (
          <button key={k} className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
        ))}
        <button className="chip ghost" onClick={refresh}>Refresh</button>
      </div>

      <main className="list">
        {groups.map(w => {
          const items = tasks.filter(t => w.id === '__other' ? !known.has(t.workstream) : t.workstream === w.id)
          const shown = items.filter(match)
          if (!items.length || (filter !== 'all' && !shown.length)) return null
          return (
            <details key={w.id} open>
              <summary>
                <span className="caret">▶</span>
                <h2>{w.name}</h2>
                <span className="count">{items.filter(t => t.done).length}/{items.length}</span>
              </summary>
              {w.description && <p className="desc">{w.description}</p>}
              <ul>
                {shown.map(t => {
                  const cls = [t.done && 'is-done', !t.done && t.late && 'is-late', !t.done && t.soon && 'is-soon'].filter(Boolean).join(' ')
                  return (
                    <li key={t.id} className={cls}>
                      <input type="checkbox" id={`c-${t.id}`} checked={!!t.done} disabled={!!saving[t.id]} onChange={e => onToggle(t, e.target.checked)} />
                      <label htmlFor={`c-${t.id}`}>
                        <span className="t">{t.task}</span>
                        {t.day && <span className={`tag ${t.day === 'Day 1' ? 'd1' : 'd2'}`}>{t.day}</span>}
                        {t.notes && <span className="n">{t.notes}</span>}
                        {t.done && (
                          <span className="who">
                            {t.done_at === 'saving' ? 'Saving…' : `Marked done by ${t.done_by || 'a team member'}${stamp(t.done_at) ? ' · ' + stamp(t.done_at) : ''}`}
                          </span>
                        )}
                      </label>
                      <span className="due">{shortDate(t.due)}</span>
                    </li>
                  )
                })}
              </ul>
            </details>
          )
        })}
        {!tasks.some(match) && <p className="empty">No tasks match this filter.</p>}
      </main>
      <footer>Updates from the sheet every 30 seconds. Countdown uses event_date on the Settings tab.</footer>
    </div>
  )
}
