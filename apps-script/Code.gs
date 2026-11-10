/**
 * CriselVC Bookings — intake + bookings backend v1 (2026-10-31)
 * Bound to: _Ledger — CriselVC Bookings
 * Netlify form `criselvc-inquiry` → HTTP POST notification → doPost
 *   → ledger row (Ledger ID) → Drive booking folder → calendar anchor (free until deposit_paid).
 * Status edits in the ledger drive the calendar anchor (onLedgerEdit).
 */

const CFG = {
  FORM_NAME: 'criselvc-inquiry',
  CALENDAR_ID: 'c_73b8edd2bc505fc3a54c073d74f92e1fdeb2b6e41f48bffb474a1593e5edfd66@group.calendar.google.com',
  BOOKINGS_FOLDER_ID: '1tGk32Y1vM0OBqfGpDLV2GIWVqGQFJ-WT',
  TZ: 'Asia/Dubai',
  ALERT_TO: 'pattychooo@pattytiu.com',
  LANES: { Artist: 'ART', Creative: 'CRE', Trader: 'TRD' },
  STATUSES: ['inquiry', 'quoted', 'confirmed', 'deposit_paid', 'performed', 'closed', 'declined'],
  BUSY_FROM: ['deposit_paid', 'performed'],
  COLOR: { inquiry: '8', quoted: '5', confirmed: '9', deposit_paid: '10', performed: '2', closed: '8' },
};

// Ledger header → form field. Order is the ledger's column order.
const FIELD = {
  'Event date': 'event_date', 'City': 'city', 'Name': 'name', 'Email': 'email', 'Phone': 'phone',
  'Company': 'company', 'Artist event type': 'artist_event_type', 'Artist venue': 'artist_venue',
  'Set start': 'artist_set_start', 'Set end': 'artist_set_end', 'Guests': 'artist_guests',
  'DJ equipment': 'artist_equipment', 'Music brief': 'artist_music_brief',
  'Creative service': 'creative_service', 'Creative venue/brand': 'creative_venue',
  'Engagement length': 'creative_duration', 'Creative scope': 'creative_scope',
  'Trader format': 'trader_format', 'Trader delivery': 'trader_delivery',
  'Audience level': 'trader_audience', 'Audience size': 'trader_size', 'Trader brief': 'trader_brief',
  'Trader ack': 'trader_ack', 'Notes': 'notes', 'Consent': 'consent',
};

/* ---------------- Setup (run once) ---------------- */

function setup() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('WEBHOOK_KEY')) {
    props.setProperty('WEBHOOK_KEY', Utilities.getUuid().replace(/-/g, ''));
  }
  const ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone(CFG.TZ);
  const sh = ledger_();
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold');

  const statusCol = cols_(sh)['Status'];
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(CFG.STATUSES, true).setAllowInvalid(false).build();
  sh.getRange(2, statusCol, sh.getMaxRows() - 1, 1).setDataValidation(rule);

  const has = ScriptApp.getProjectTriggers().some((t) => t.getHandlerFunction() === 'onLedgerEdit');
  if (!has) ScriptApp.newTrigger('onLedgerEdit').forSpreadsheet(ss).onEdit().create();

  Calendar.Calendars.get(CFG.CALENDAR_ID); // forces Calendar auth + confirms access
  DriveApp.getFolderById(CFG.BOOKINGS_FOLDER_ID);
  Logger.log('WEBHOOK_KEY = ' + props.getProperty('WEBHOOK_KEY'));
}

/* ---------------- Intake ---------------- */

function doPost(e) {
  const key = PropertiesService.getScriptProperties().getProperty('WEBHOOK_KEY');
  if (!e || !e.parameter || !key || e.parameter.key !== key) return reply_('refused');

  let payload;
  try { payload = JSON.parse(e.postData.contents); } catch (err) { return reply_('bad payload'); }
  if (payload.form_name !== CFG.FORM_NAME) return reply_('wrong form');

  const d = payload.data || {};
  const subId = String(payload.id || '');
  if (!subId) return reply_('no id');
  if (d['bot-field']) return reply_('spam');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = ledger_();
    const c = cols_(sh);
    if (sh.getRange(1, c['Submission ID'], sh.getMaxRows(), 1).createTextFinder(subId).matchEntireCell(true).findNext()) {
      return reply_('duplicate');
    }

    const lane = String(d.lane || '');
    if (!CFG.LANES[lane]) throw new Error('Unknown lane: ' + lane);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.event_date || ''))) throw new Error('Bad event_date');

    const ledgerId = nextId_(sh, c, lane, d.event_date);
    const row = new Array(sh.getLastColumn()).fill('');
    const set = (h, v) => { if (c[h]) row[c[h] - 1] = v == null ? '' : v; };
    set('Ledger ID', ledgerId);
    set('Received (Dubai)', Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd HH:mm'));
    set('Status', 'inquiry');
    set('Lane', lane);
    Object.keys(FIELD).forEach((h) => set(h, d[FIELD[h]]));
    set('Submission ID', subId);

    const folder = DriveApp.getFolderById(CFG.BOOKINGS_FOLDER_ID)
      .createFolder(`${ledgerId} — ${d.name || 'Unnamed'} — ${lane}`);
    set('Drive folder', folder.getUrl());

    const ev = Calendar.Events.insert(eventResource_(ledgerId, lane, d, 'inquiry', folder.getUrl()), CFG.CALENDAR_ID);
    set('Calendar event ID', ev.id);

    sh.appendRow(row);
    return reply_('ok ' + ledgerId);
  } catch (err) {
    alert_('Intake failed', err, payload);
    return reply_('error');
  } finally {
    lock.releaseLock();
  }
}

/* ---------------- Status → calendar ---------------- */

function onLedgerEdit(e) {
  const sh = e.range.getSheet();
  if (sh.getSheetId() !== ledger_().getSheetId() || e.range.getRow() < 2) return;
  const c = cols_(sh);
  if (e.range.getColumn() !== c['Status'] || e.range.getNumRows() !== 1) return;

  const r = e.range.getRow();
  const get = (h) => sh.getRange(r, c[h]).getValue();
  const status = String(e.value || '');
  const eventId = String(get('Calendar event ID') || '');
  if (!eventId || CFG.STATUSES.indexOf(status) < 0) return;

  try {
    if (status === 'declined') {
      Calendar.Events.remove(CFG.CALENDAR_ID, eventId);
      sh.getRange(r, c['Calendar event ID']).setValue('');
      return;
    }
    Calendar.Events.patch({
      summary: summary_(status, get('Lane'), get('Name')),
      colorId: CFG.COLOR[status],
      transparency: CFG.BUSY_FROM.indexOf(status) >= 0 ? 'opaque' : 'transparent',
    }, CFG.CALENDAR_ID, eventId);
  } catch (err) {
    alert_('Status sync failed (' + get('Ledger ID') + ')', err, { status: status });
  }
}

/* ---------------- Helpers ---------------- */

function ledger_() { return SpreadsheetApp.getActive().getSheets()[0]; }

function cols_(sh) {
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const map = {};
  head.forEach((h, i) => { map[String(h).trim()] = i + 1; });
  return map;
}

function nextId_(sh, c, lane, date) {
  const prefix = `CVC-${CFG.LANES[lane]}-${date.replace(/-/g, '')}-`;
  const last = sh.getLastRow();
  const ids = last < 2 ? [] : sh.getRange(2, c['Ledger ID'], last - 1, 1).getValues().map((v) => String(v[0]));
  const n = ids.filter((id) => id.indexOf(prefix) === 0).length + 1;
  return prefix + String(n).padStart(2, '0');
}

function summary_(status, lane, name) {
  return `${String(status).toUpperCase().replace('_', ' ')} · ${lane} · ${name || 'Unnamed'}`;
}

function eventResource_(ledgerId, lane, d, status, folderUrl) {
  const res = {
    summary: summary_(status, lane, d.name),
    description: [
      `Ledger ID: ${ledgerId}`,
      `Lane: ${lane}`,
      `Client: ${d.name || ''} · ${d.email || ''} · ${d.phone || ''}`,
      d.company ? `Company: ${d.company}` : '',
      `Folder: ${folderUrl}`,
    ].filter(Boolean).join('\n'),
    location: [d.artist_venue || d.creative_venue, d.city].filter(Boolean).join(', '),
    colorId: CFG.COLOR[status],
    transparency: 'transparent',
  };
  const s = d.artist_set_start, en = d.artist_set_end;
  if (lane === 'Artist' && /^\d{2}:\d{2}$/.test(s || '') && /^\d{2}:\d{2}$/.test(en || '')) {
    const endDate = en <= s ? addDays_(d.event_date, 1) : d.event_date;
    res.start = { dateTime: `${d.event_date}T${s}:00`, timeZone: CFG.TZ };
    res.end = { dateTime: `${endDate}T${en}:00`, timeZone: CFG.TZ };
  } else {
    res.start = { date: d.event_date };
    res.end = { date: addDays_(d.event_date, 1) };
  }
  return res;
}

function addDays_(ymd, n) {
  const [y, m, dd] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, dd + n));
  return Utilities.formatDate(dt, 'UTC', 'yyyy-MM-dd');
}

function alert_(subject, err, payload) {
  MailApp.sendEmail(CFG.ALERT_TO, `[CriselVC Bookings] ${subject}`,
    `${err && err.stack ? err.stack : err}\n\nPayload:\n${JSON.stringify(payload, null, 2)}`);
}

function reply_(msg) {
  return ContentService.createTextOutput(msg).setMimeType(ContentService.MimeType.TEXT);
}
