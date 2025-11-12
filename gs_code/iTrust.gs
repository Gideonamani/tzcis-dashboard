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

      const result = writeLatestRow_({
        sheetName: r.raw_sheetname,
        headers: itrust_sheet_headers,
        rowValues: row,
        dateHint: r.date_hint,
        dateHeader: /^date\b/i,
        scrapedHeader: /^scraped time$/i,
        dateFormat: DATE_FORMAT,
        timezone: TZ,
        numericTolerance: NUM_TOL,
        logQaOnInsert: LOG_QA_ON_INSERT,
        qaLogger: logQaChange_
      });
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
