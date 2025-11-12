/***** CONFIG ******/
const CFG_SHEET = '_config';
const DATE_FORMAT  = 'MM-dd-yyyy';          // display format in Sheets
const TZ           = Session.getScriptTimeZone() || 'Africa/Dar_es_Salaam';
const NUM_TOL = 1e-9;     // ignore tiny rounding drifts (set 0 to disable)
const QA_SHEET = '_qa';
const LOG_QA_ON_INSERT = true; // set false if you ever want to silence insert logs


/***** PUBLIC ENTRY ******/
function updateFromConfig_ItrustOnly() {
  const rows = readConfigRows_();
  const itrustRows = rows.filter(r => /^itrust\./i.test(r.fund_id) && r.source_url && r.raw_sheetname);

  if (!itrustRows.length) {
    Logger.log('No itrust.* rows found in _config.');
    return;
  }

  itrustRows.forEach(r => {
    try {
      const data = fetchJson_(r.source_url);
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Empty or non-array JSON at ' + r.source_url);
      }
      const rec = data[0]; // latest day record

      const dateParts = String(rec.date).split('/'); // MM/DD/YYYY
      // const jsDate = new Date(Number(dateParts[2]), Number(dateParts[0]) - 1, Number(dateParts[1]));
      // const jsDate = parseDate_(rec.date, r.date_hint);

      const row = [
        rec.date, // No need to put jsDate since we want the date as is
        toNum_(rec.netAssetValue),
        toNum_(rec.outStandingUnits),
        toNum_(rec.navPerUnit),
        toNum_(rec.salePricePerUnit),
        toNum_(rec.repurchasePricePerUnit),
        isoNow_()
      ];

      const itrust_sheet_headers = ['Date','Net Asset Value','Units','NAV/Unit','Sale Price','Repurchase Price','Scraped Time'];

      const result = writeLatestRow_(r.raw_sheetname, row, itrust_sheet_headers, r.date_hint);
      if (result !== 'skipped') {
        Logger.log('%s (%s): %s', r.raw_sheetname, result.toUpperCase(), r.source_url);
      }


    } catch (e) {
      Logger.log('Error on %s (%s): %s', r.fund_id, r.source_url, e);
    }
  });
}

/***** HELPERS ******/
function readConfigRows_() {
  const ss = SpreadsheetApp.openById(RAW_SS_ID);
  const sh = ss.getSheetByName(CFG_SHEET);
  if (!sh) throw new Error('Missing sheet: ' + CFG_SHEET);

  const range = sh.getDataRange();
  const values = range.getValues();
  if (values.length < 2) return [];

  const header = values[0].map(h => String(h).trim());
  const idx = (name) => header.findIndex(h => h.toLowerCase() === name.toLowerCase());

  const fundIdx     = idx('fund_id');
  const urlIdx      = idx('source_url');
  const nameIdx     = idx('raw_sheetname');
  const dateHintIdx = idx('date_hint');

  if ([fundIdx, urlIdx, nameIdx].some(i => i < 0)) {
    throw new Error("Expected headers 'fund_id', 'source_url', 'raw_sheetname' in _config.");
  }

  return values.slice(1).filter(r => r.join('').trim() !== '').map(r => ({
    fund_id:      String(r[fundIdx]).trim(),
    source_url:   String(r[urlIdx]).trim(),
    raw_sheetname:String(r[nameIdx]).trim(),
    date_hint:    String(r[dateHintIdx]).trim()
  }));
}

function fetchJson_(url) {
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  const code = res.getResponseCode();
  if (code !== 200) throw new Error('HTTP ' + code + ' for ' + url);
  return JSON.parse(res.getContentText());
}

/**
 * Insert-at-top (row 2) only if:
 *  1) incoming.date > currentTop.date, OR
 *  2) incoming.date == currentTop.date AND any of [B..F] changed
 * On (2), also log the diffs to QA sheet.
 */
function writeLatestRow_(sheetName, rowValues, columnHeaders, dateHint) {
  // Globals expected to exist: RAW_SS_ID, TZ, DATE_FORMAT, NUM_TOL, LOG_QA_ON_INSERT, logQaChange_, ymd_
  const ss = SpreadsheetApp.openById(RAW_SS_ID);
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error('Missing destination sheet: ' + sheetName);

  // --- Ensure header row matches provided columnHeaders
  const width = columnHeaders.length;
  const existing = sh.getRange(1, 1, 1, width).getValues()[0];
  const headerBlank = existing.every(v => v === '' || v === null);

  const sameHeader =
    !headerBlank &&
    existing.length === width &&
    existing.every((v, i) => String(v).trim() === String(columnHeaders[i]).trim());

  if (headerBlank || !sameHeader) {
    sh.getRange(1, 1, 1, width).setValues([columnHeaders]);
    sh.autoResizeColumns(1, width);
  }

  // --- Find critical columns by name
  const header = columnHeaders.map(h => String(h || ''));
  const dateIdx = header.findIndex(h => /^date\b/i.test(h));  // e.g., "Date", Date Valued
  const scrapedIdx = header.findIndex(h => /^scraped time$/i.test(h));    // e.g., "Scraped Time")

  const dateCol = dateIdx >= 0 ? dateIdx : 0;                             // fallback to col 0
  const scrapedCol = scrapedIdx >= 0 ? scrapedIdx : (width - 1);          // fallback to last col
  
  const incomingYMD = parseDate_(rowValues[dateCol], dateHint);


  // --- Sanity: make sure incoming values match width
  if (rowValues.length !== width) {
    throw new Error(`Row width mismatch: got ${rowValues.length}, expected ${width}`);
  }

  // --- Any data already?
  const hasTopData = sh.getLastRow() >= 2 && !sh.getRange(2, 1).isBlank();

  // Helper: set the Date column's number format
  function formatDateCellAtRow2_() {
    sh.getRange(2, dateCol + 1).setNumberFormat(DATE_FORMAT);
  }

  // --- FIRST insertion when no data exists
  if (!hasTopData) {
    sh.insertRows(2, 1);
    sh.getRange(2, 1, 1, width).setValues([rowValues]);
    // formatDateCellAtRow2_();

    if (LOG_QA_ON_INSERT) {
      const msg = `first row inserted → ${incomingYMD}`;
      logQaChange_(sheetName, incomingYMD, 'INSERTED(FIRST)', '-', msg);
    }
    return 'inserted';
  }

  // --- Compare with current latest (row 2)
  const current = sh.getRange(2, 1, 1, width).getValues()[0];
  const currentYMD  = parseDate_(current[dateCol], dateHint);

  // Newer date → insert (keep history)
  if (incomingYMD > currentYMD) {
    const prevDate = currentYMD;
    const newDate  = incomingYMD;

    sh.insertRows(2, 1);
    sh.getRange(2, 1, 1, width).setValues([rowValues]);
    // formatDateCellAtRow2_();

    if (LOG_QA_ON_INSERT) {
      const msg = `new latest date: ${prevDate} → ${newDate}`;
      logQaChange_(sheetName, incomingYMD, 'INSERTED', '-', msg);
    }
    return 'inserted';
  }

  // Older date → ignore
  if (incomingYMD < currentYMD) return 'skipped';

  // Same date → compare columns between Date and Scraped Time (exclusive of Scraped Time)
  const startC = dateCol + 1;                 // first data col after "Date"
  const endC   = Math.max(startC, scrapedCol); // compare up to the column before "Scraped Time"
  const diffs = [];

  for (let c = startC; c < endC; c++) {
    const oldVal = current[c];
    const newVal = rowValues[c];
    const nOld = Number(String(oldVal).replace(/[, ]+/g, ''));
    const nNew = Number(String(newVal).replace(/[, ]+/g, ''));
    const bothNumeric = isFinite(nOld) && isFinite(nNew);
    const equal = bothNumeric
      ? Math.abs(nOld - nNew) <= NUM_TOL
      : String(oldVal) === String(newVal);
    if (!equal) diffs.push({ col: header[c], oldVal, newVal });
  }

  if (diffs.length) {
    // Overwrite row 2 (same date, changed values)
    sh.getRange(2, 1, 1, width).setValues([rowValues]);
    // formatDateCellAtRow2_();

    const changedCols = diffs.map(d => d.col).join(', ');
    const details = diffs.map(d => `${d.col}: ${d.oldVal} → ${d.newVal}`).join(' | ');
    logQaChange_(sheetName, incomingYMD, 'OVERWRITTEN', changedCols, details);
    return 'overwritten';
  }

  // Same date + no changes
  return 'skipped';
}




/***** HELPERS *****/
// QA logger: one row per event, includes action ("INSERTED"/"OVERWRITTEN")
function logQaChange_(sheetName, incomingYMD, action, changedCols, details) {
  const ss = SpreadsheetApp.openById(RAW_SS_ID);
  let qa = ss.getSheetByName(QA_SHEET);
  if (!qa) qa = ss.insertSheet(QA_SHEET);

  const qaHeaders = ['Logged At','Sheet','Date','Action','Changed Columns','Details'];
  if (qa.getLastRow() === 0) {
    qa.getRange(1, 1, 1, qaHeaders.length).setValues([qaHeaders]);
  }

  qa.insertRows(2, 1);
  qa.getRange(2, 1, 1, qaHeaders.length).setValues([[
    (typeof isoNow_ === 'function' ? isoNow_() : new Date().toISOString()),
    sheetName,
    incomingYMD,
    action,
    changedCols || '-',
    details || '-'
  ]]);
}


// Date-only comparable key 'YYYY-MM-DD'
function ymd_(d) {
  const dt = new Date(d);
  return Utilities.formatDate(dt, TZ, 'yyyy-MM-dd');
}



function toNum_(v) {
  const n = Number(String(v).replace(/,/g, '').trim());
  return isNaN(n) ? null : n;
}
