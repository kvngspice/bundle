/**
 * Bvndle Tracker backend (Google Apps Script).
 * Paste this into Extensions > Apps Script in the tracker Google Sheet,
 * then deploy as a Web app (see README).
 *
 * GET  ?key=TEAM_KEY                      -> { settings, workstreams, tasks }
 * POST {key, action:"toggle", id, done, by} -> marks a task done / not done
 *
 * Set the team key in Project Settings > Script properties: TEAM_KEY.
 */

const TZ = 'Africa/Lagos';

function doGet(e) {
  if (!authorised_(e.parameter.key)) return json_({ error: 'unauthorised' });
  const ss = SpreadsheetApp.getActive();
  return json_({
    settings: readSettings_(ss),
    workstreams: readTable_(ss.getSheetByName('Workstreams'))
      .filter(r => r.id)
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0)),
    tasks: readTable_(ss.getSheetByName('Tasks')).filter(r => r.id && r.task),
    fetchedAt: new Date().toISOString()
  });
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ error: 'bad_request' }); }
  if (!authorised_(body.key)) return json_({ error: 'unauthorised' });
  if (body.action !== 'toggle') return json_({ error: 'unknown_action' });

  const by = String(body.by || '').trim().slice(0, 80);
  if (body.done && !by) return json_({ error: 'name_required' });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = SpreadsheetApp.getActive().getSheetByName('Tasks');
    const values = sh.getDataRange().getValues();
    const head = values[0].map(String);
    const col = name => head.indexOf(name);
    const rowIdx = values.findIndex((r, i) => i > 0 && String(r[col('id')]) === String(body.id));
    if (rowIdx < 1) return json_({ error: 'not_found' });

    const row = rowIdx + 1;
    const at = body.done ? Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ss") : '';
    sh.getRange(row, col('done') + 1).setValue(!!body.done);
    sh.getRange(row, col('done_by') + 1).setValue(body.done ? by : '');
    sh.getRange(row, col('done_at') + 1).setValue(at);
    return json_({ ok: true, id: body.id, done: !!body.done, done_by: body.done ? by : '', done_at: at });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- helpers ---------- */

function authorised_(key) {
  const expected = PropertiesService.getScriptProperties().getProperty('TEAM_KEY');
  return !expected || key === expected; // no key set = open access
}

function readTable_(sh) {
  const values = sh.getDataRange().getValues();
  const head = values.shift().map(h => String(h).trim());
  return values.map(r => {
    const o = {};
    head.forEach((h, i) => { if (h) o[h] = clean_(r[i], h); });
    return o;
  });
}

function readSettings_(ss) {
  const out = {};
  readTable_(ss.getSheetByName('Settings')).forEach(r => { if (r.key) out[r.key] = r.value; });
  return out;
}

function clean_(v, header) {
  if (v instanceof Date) {
    return header === 'done_at'
      ? Utilities.formatDate(v, TZ, "yyyy-MM-dd'T'HH:mm:ss")
      : Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  }
  if (header === 'done') return v === true || String(v).toUpperCase() === 'TRUE';
  return v === null || v === undefined ? '' : v;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
