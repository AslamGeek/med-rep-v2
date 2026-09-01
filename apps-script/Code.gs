const SPREADSHEET_ID = '15LeNu765ZG8AF-zkKUhSEU9-GSf0Y-Ggfaji38Hs_Qs';

const DOCTOR_HEADERS = [
  'ID',
  'Name',
  'Specialties',
  'Hospital',
  'Attached Pharmacy',
  'Area',
  'Camp',
  'Potential',
  'Stockist',
  'Prescriber',
  'OP Timing',
  'Call Schedule',
  'Prescribing Products',
  'Notes',
  'Active',
  'Updated At',
];

const VISIT_HEADERS = [
  'Date',
  'Day',
  'Camp',
  'Doctors (count)',
  'Pharmacy (count)',
  'Doctors',
  'Pharmacy',
];

const SETTINGS_HEADERS = [
  'Areas',
  'Specialties',
  'Camps',
  'Potentials',
  'Stockist',
  'OP Timings',
  'Call Schedule',
];

const PRODUCT_HEADERS = ['ProdID', 'Name', 'DosageForm'];

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function ss() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function sheet(name, headers) {
  const book = ss();
  let sh = book.getSheetByName(name);
  if (!sh) sh = book.insertSheet(name);
  const existing = sh.getRange(1, 1, 1, headers.length).getValues()[0];
  const blank = existing.every(function (v) {
    return v === '' || v === null;
  });
  if (blank) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  return sh;
}

function colIndex(headers, name) {
  const i = headers.indexOf(name);
  return i < 0 ? -1 : i;
}

function hashOf(value) {
  const raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5,
    JSON.stringify(value),
  );
  return raw
    .map(function (b) {
      const v = (b + 256) % 256;
      return ('0' + v.toString(16)).slice(-2);
    })
    .join('');
}

function readTable(sh) {
  const lastRow = Math.max(sh.getLastRow(), 1);
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0].map(String);
  const rows = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (row.every(function (c) {
      return c === '' || c === null;
    })) continue;
    const obj = {};
    headers.forEach(function (h, i) {
      obj[h] = row[i];
    });
    rows.push(obj);
  }
  return { headers: headers, rows: rows };
}

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean);
}

function doctorToApp(row) {
  return {
    id: String(row.ID || ''),
    name: String(row.Name || ''),
    specialties: splitCsv(row.Specialties),
    hospital: String(row.Hospital || ''),
    attachedPharmacy: String(row['Attached Pharmacy'] || ''),
    area: String(row.Area || ''),
    camp: String(row.Camp || ''),
    potential: String(row.Potential || ''),
    stockist: String(row.Stockist || ''),
    prescriber: String(row.Prescriber || 'NRx') === 'Rx' ? 'Rx' : 'NRx',
    opTiming: String(row['OP Timing'] || ''),
    callSchedule: String(row['Call Schedule'] || ''),
    prescribingProducts: splitCsv(row['Prescribing Products']),
    notes: String(row.Notes || ''),
    active: String(row.Active || 'Yes').toLowerCase() !== 'no',
    updatedAt: row['Updated At']
      ? new Date(row['Updated At']).toISOString()
      : '',
  };
}

function visitToApp(row) {
  return {
    date: formatDate(row.Date),
    day: String(row.Day || ''),
    camp: String(row.Camp || ''),
    doctorsCount: Number(row['Doctors (count)'] || 0),
    pharmacyCount: Number(row['Pharmacy (count)'] || 0),
    doctors: String(row.Doctors || ''),
    pharmacy: String(row.Pharmacy || ''),
  };
}

function formatDate(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function productToApp(row) {
  return {
    prodId: String(row.ProdID || ''),
    name: String(row.Name || ''),
    dosageForm: String(row.DosageForm || ''),
  };
}

function readSettings() {
  const sh = sheet('Settings', SETTINGS_HEADERS);
  const data = readTable(sh);
  const lists = {};
  SETTINGS_HEADERS.forEach(function (h) {
    lists[h] = [];
  });
  data.rows.forEach(function (row) {
    SETTINGS_HEADERS.forEach(function (h) {
      const v = String(row[h] || '').trim();
      if (v) lists[h].push(v);
    });
  });
  return lists;
}

function handlePull(body) {
  const doctorsSh = sheet('Doctors', DOCTOR_HEADERS);
  const visitsSh = sheet('Visits', VISIT_HEADERS);
  const productsSh = sheet('Products', PRODUCT_HEADERS);

  const doctorData = readTable(doctorsSh);
  const since = body.sinceUpdatedAt ? new Date(body.sinceUpdatedAt).getTime() : 0;
  const doctors = [];
  doctorData.rows.forEach(function (row) {
    if (!row.ID) return;
    const t = row['Updated At'] ? new Date(row['Updated At']).getTime() : 0;
    if (!since || t > since) doctors.push(doctorToApp(row));
  });

  const settings = readSettings();
  const settingsHash = hashOf(settings);
  const products = readTable(productsSh).rows.map(productToApp).filter(function (p) {
    return p.prodId || p.name;
  });
  const productsHash = hashOf(products);

  const out = {
    ok: true,
    doctors: doctors,
    settingsHash: settingsHash,
    productsHash: productsHash,
  };

  if (!body.settingsHash || body.settingsHash !== settingsHash) {
    out.settings = settings;
  }
  if (!body.productsHash || body.productsHash !== productsHash) {
    out.products = products;
  }

  const visitsSince = body.visitsSinceDate || '';
  const visits = [];
  readTable(visitsSh).rows.forEach(function (row) {
    const d = formatDate(row.Date);
    if (!d) return;
    if (!visitsSince || d >= visitsSince) visits.push(visitToApp(row));
  });
  out.visits = visits;
  return out;
}

function upsertDoctor(body) {
  const d = body.doctor || {};
  const sh = sheet('Doctors', DOCTOR_HEADERS);
  const data = readTable(sh);
  const idIdx = colIndex(data.headers, 'ID') + 1;
  const values = DOCTOR_HEADERS.map(function (h) {
    return d[h] == null ? '' : d[h];
  });
  let found = 0;
  data.rows.forEach(function (row, i) {
    if (String(row.ID) === String(d.ID)) found = i + 2;
  });
  if (found) {
    sh.getRange(found, 1, 1, DOCTOR_HEADERS.length).setValues([values]);
  } else {
    sh.appendRow(values);
  }
  return { ok: true, id: d.ID, col: idIdx };
}

function appendVisit(body) {
  const v = body.visit || {};
  const sh = sheet('Visits', VISIT_HEADERS);
  sh.appendRow(
    VISIT_HEADERS.map(function (h) {
      return v[h] == null ? '' : v[h];
    }),
  );
  return { ok: true };
}

function undoVisit(body) {
  const v = body.visit || {};
  const sh = sheet('Visits', VISIT_HEADERS);
  const data = readTable(sh);
  let found = 0;
  for (let i = data.rows.length - 1; i >= 0; i--) {
    const row = data.rows[i];
    if (
      formatDate(row.Date) === String(v.Date || '') &&
      String(row.Day || '') === String(v.Day || '') &&
      String(row.Doctors || '') === String(v.Doctors || '')
    ) {
      found = i + 2;
      break;
    }
  }
  if (found) sh.deleteRow(found);
  return { ok: true, deleted: !!found };
}

function saveSettings(body) {
  const key = body.key;
  const values = body.values || [];
  const sh = sheet('Settings', SETTINGS_HEADERS);
  const col = SETTINGS_HEADERS.indexOf(key) + 1;
  if (col < 1) return { ok: false, error: 'Unknown settings key' };
  const last = Math.max(sh.getLastRow(), 1);
  if (last > 1) sh.getRange(2, col, last - 1, 1).clearContent();
  if (values.length) {
    const rows = values.map(function (v) {
      return [v];
    });
    sh.getRange(2, col, values.length, 1).setValues(rows);
  }
  return { ok: true };
}

function upsertProduct(body) {
  const p = body.product || {};
  const sh = sheet('Products', PRODUCT_HEADERS);
  const data = readTable(sh);
  const values = [p.ProdID || '', p.Name || '', p.DosageForm || ''];
  let found = 0;
  data.rows.forEach(function (row, i) {
    if (String(row.ProdID) === String(p.ProdID)) found = i + 2;
  });
  if (found) sh.getRange(found, 1, 1, 3).setValues([values]);
  else sh.appendRow(values);
  return { ok: true };
}

function deleteProduct(body) {
  const id = body.prodId;
  const sh = sheet('Products', PRODUCT_HEADERS);
  const data = readTable(sh);
  let found = 0;
  data.rows.forEach(function (row, i) {
    if (String(row.ProdID) === String(id)) found = i + 2;
  });
  if (found) sh.deleteRow(found);
  return { ok: true };
}

function doGet() {
  return json({ ok: true, service: 'medrep' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const body = JSON.parse((e.postData && e.postData.contents) || '{}');
    const action = body.action;
    if (action === 'pull') return json(handlePull(body));
    if (action === 'upsertDoctor') return json(upsertDoctor(body));
    if (action === 'appendVisit') return json(appendVisit(body));
    if (action === 'undoVisit') return json(undoVisit(body));
    if (action === 'saveSettings') return json(saveSettings(body));
    if (action === 'upsertProduct') return json(upsertProduct(body));
    if (action === 'deleteProduct') return json(deleteProduct(body));
    return json({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
