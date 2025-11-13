/**
 * Shared utility for inserting/updating the latest row in a sheet.
 *
 * Expected globals (if not provided in opts):
 *  - RAW_SS_ID
 *  - TZ
 *  - DATE_FORMAT
 *  - NUM_TOL
 *  - LOG_QA_ON_INSERT
 *  - logQaChange_
 */
function writeLatestRow_(opts) {
  if (!opts || Array.isArray(opts) || typeof opts !== 'object') {
    throw new Error('writeLatestRow_ expects an options object.');
  }

  const {
    sheetId = typeof RAW_SS_ID === 'string' ? RAW_SS_ID : '',
    sheetName,
    headers,
    rowValues,
    dateHint,
    dateHeader = /^date\b/i,
    scrapedHeader = /^scraped time$/i,
    dateFormat = (typeof DATE_FORMAT === 'string' && DATE_FORMAT) || 'yyyy-MM-dd',
    timezone = (typeof TZ === 'string' && TZ) || Session.getScriptTimeZone() || 'UTC',
    numericTolerance = typeof NUM_TOL === 'number' ? NUM_TOL : 0,
    logQaOnInsert = typeof LOG_QA_ON_INSERT === 'boolean' ? LOG_QA_ON_INSERT : false,
    qaLogger = typeof logQaChange_ === 'function' ? logQaChange_ : null,
    ignoreColumns = []
  } = opts;

  if (!sheetId) throw new Error('writeLatestRow_: sheetId missing (pass opts.sheetId or set RAW_SS_ID).');
  if (!sheetName) throw new Error('writeLatestRow_: sheetName is required.');
  if (!Array.isArray(headers) || headers.length === 0) {
    throw new Error('writeLatestRow_: headers array is required.');
  }
  if (!Array.isArray(rowValues) || rowValues.length !== headers.length) {
    throw new Error('writeLatestRow_: rowValues must match headers length.');
  }

  const ss = SpreadsheetApp.openById(sheetId);
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error(`Missing destination sheet: ${sheetName}`);

  ensureHeaderRow_(sh, headers);

  const width = headers.length;
  const headerNorm = headers.map(sheetWriterNorm_);
  const dateCol = findColumnIdx_(headerNorm, dateHeader);
  if (dateCol < 0) throw new Error('writeLatestRow_: unable to locate Date column.');
  const scrapedCol = findColumnIdx_(headerNorm, scrapedHeader);
  const ignoreIdxSet = new Set(resolveColumnIndexes_(headerNorm, ignoreColumns));
  if (rowValues.length !== width) {
    throw new Error(`writeLatestRow_: row width mismatch (got ${rowValues.length}, expected ${width}).`);
  }

  const incomingYMD = parseDateForComparison_(rowValues[dateCol], dateHint, timezone);
  if (!incomingYMD) throw new Error('writeLatestRow_: incoming row has invalid date.');

  const hasTopData = sh.getLastRow() >= 2 && !sh.getRange(2, 1).isBlank();

  const logQa = (action, changedCols, details) => {
    if (!qaLogger) return;
    qaLogger(sheetName, incomingYMD, action, changedCols || '-', details || '-');
  };

  if (!hasTopData) {
    sh.insertRows(2, 1);
    sh.getRange(2, 1, 1, width).setValues([rowValues]);
    formatDateCell_(sh, 2, dateCol + 1, dateFormat);
    if (logQaOnInsert) logQa('INSERTED(FIRST)', '-', 'first row inserted');
    return 'inserted';
  }

  const current = sh.getRange(2, 1, 1, width).getValues()[0];
  const currentYMD = parseDateForComparison_(current[dateCol], dateHint, timezone);
  if (!currentYMD) {
    sh.getRange(2, 1, 1, width).setValues([rowValues]);
    formatDateCell_(sh, 2, dateCol + 1, dateFormat);
    logQa('OVERWRITTEN', '-', 'Invalid existing date; row reset');
    return 'overwritten';
  }

  if (incomingYMD > currentYMD) {
    sh.insertRows(2, 1);
    sh.getRange(2, 1, 1, width).setValues([rowValues]);
    formatDateCell_(sh, 2, dateCol + 1, dateFormat);
    if (logQaOnInsert) {
      logQa('INSERTED', '-', `new latest date: ${currentYMD} → ${incomingYMD}`);
    }
    return 'inserted';
  }

  if (incomingYMD < currentYMD) {
    return 'skipped';
  }

  const diffs = [];
  for (let c = 0; c < width; c++) {
    if (c === dateCol || c === scrapedCol || ignoreIdxSet.has(c)) continue;
    if (!valuesEqual_(current[c], rowValues[c], numericTolerance)) {
      diffs.push({ col: headers[c], oldVal: current[c], newVal: rowValues[c] });
    }
  }

  if (!diffs.length) return 'skipped';

  sh.getRange(2, 1, 1, width).setValues([rowValues]);
  formatDateCell_(sh, 2, dateCol + 1, dateFormat);
  const changedCols = diffs.map(d => d.col).join(', ');
  const details = diffs.map(d => `${d.col}: ${d.oldVal} → ${d.newVal}`).join(' | ');
  logQa('OVERWRITTEN', changedCols, details);
  return 'overwritten';
}

/* ================= Helper utilities ================= */
function ensureHeaderRow_(sh, headers) {
  const width = headers.length;
  let existing = sh.getRange(1, 1, 1, width).getValues()[0];
  const isBlank = existing.every(v => v === '' || v == null);
  const matches = !isBlank && existing.length === width &&
    existing.every((v, i) => String(v).trim() === String(headers[i]).trim());

  if (!matches) {
    sh.getRange(1, 1, 1, width).setValues([headers]);
    sh.autoResizeColumns(1, width);
  }
}

function findColumnIdx_(headerNorm, target) {
  if (typeof target === 'number') return target;
  if (target instanceof RegExp) {
    return headerNorm.findIndex(h => target.test(h));
  }
  const want = sheetWriterNorm_(target);
  let idx = headerNorm.findIndex(h => h === want);
  if (idx > -1) return idx;
  return headerNorm.findIndex(h => h.indexOf(want) === 0);
}

function resolveColumnIndexes_(headerNorm, entries) {
  if (!Array.isArray(entries)) return [];
  const out = [];
  entries.forEach(entry => {
    if (typeof entry === 'number') {
      if (entry >= 0 && entry < headerNorm.length) out.push(entry);
      return;
    }
    if (entry instanceof RegExp) {
      const idx = headerNorm.findIndex(h => entry.test(h));
      if (idx > -1) out.push(idx);
      return;
    }
    const want = sheetWriterNorm_(entry);
    const idx = headerNorm.findIndex(h => h === want);
    if (idx > -1) out.push(idx);
  });
  return out;
}

function parseDateForComparison_(value, hint, timezone) {
  const tryFns = [
    () => (typeof parseDate_ === 'function' ? parseDate_(value, hint) : null),
    () => (typeof normalizeDateString_ === 'function' ? normalizeDateString_(value, hint) : null),
    () => fallbackIsoDate_(value, timezone)
  ];
  for (const fn of tryFns) {
    try {
      const iso = fn();
      if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    } catch (e) {
      // continue to next strategy
    }
  }
  return null;
}

function fallbackIsoDate_(value, timezone) {
  if (value == null || value === '') return null;
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    return Utilities.formatDate(value, timezone || 'UTC', 'yyyy-MM-dd');
  }
  const s = String(value).trim();
  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${String(iso[2]).padStart(2,'0')}-${String(iso[3]).padStart(2,'0')}`;
  }
  const d = new Date(s);
  if (!isNaN(d)) {
    return Utilities.formatDate(d, timezone || 'UTC', 'yyyy-MM-dd');
  }
  return null;
}

function formatDateCell_(sh, row, col, format) {
  try {
    sh.getRange(row, col).setNumberFormat(format || 'yyyy-MM-dd');
  } catch (e) {
    // ignore formatting errors
  }
}

function valuesEqual_(a, b, tol) {
  const sanitized = v => Number(String(v).replace(/[, ]+/g, ''));
  const numA = sanitized(a);
  const numB = sanitized(b);
  const bothNumeric = isFinite(numA) && isFinite(numB);
  if (bothNumeric) {
    return Math.abs(numA - numB) <= (isNaN(tol) ? 0 : tol);
  }
  return String(a) === String(b);
}

function sheetWriterNorm_(s) {
  return String(s || '').trim().toLowerCase();
}
