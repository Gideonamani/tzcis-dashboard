/***** CONFIG *****************************************************************
 * Default incremental parsing now looks only at RAW row 2 (the latest scrape)
 * to cut down on Apps Script runtime. Call processAllFundsFullScan() from the
 * UI when you need a full sweep of every RAW row (e.g. brand-new funds).
 *****************************************************************************/
const RAW_SS_ID     = '11YdBfyArmS3V2l2-oSwkyFeuzW1lKvzgPQIg5Sihfog';
const PARSED_SS_ID  = '1zoxwNR8OZUvNwd6NOvJhtWu8-DiWvPkTrpZ_DzWecUM';
const CONFIG_SHEET  = '_config';
const MAX_RUN_MS    = 5 * 60 * 1000; // soft ceiling

/***** PARSED SCHEMA ***********************************************************/
const CANON_HEADER = [
  'date','nav_total','units_outstanding','nav_per_unit',
  'sale_price','repurchase_price','collected_at'
];

/***** ORCHESTRATOR ************************************************************/
function processAllFunds(opts) {
  const fullScan = !!(opts && opts.fullScan);
  const t0 = Date.now();
  const rawSS    = SpreadsheetApp.openById(RAW_SS_ID);
  const parsedSS = SpreadsheetApp.openById(PARSED_SS_ID);
  const cfgSh    = rawSS.getSheetByName(CONFIG_SHEET);
  if (!cfgSh) throw new Error(`Missing sheet '${CONFIG_SHEET}' in RAW workbook`);

  const cfgRows = asObjectsTrimmed_(cfgSh);
  let done = 0, fail = 0;

  for (const c of cfgRows) {
    if ((Date.now() - t0) > MAX_RUN_MS) { Logger.log('Time ceiling hit.'); break; }
    try {
      const pre = preflightFund_(c, rawSS);
      if (!pre.ok) {
        logQA_(parsedSS, c.fund_id || '(no id)', '', `Preflight: ${pre.reason}`);
        continue;
      }

      const psName = 'parsed_' + c.fund_id.replace(/\./g,'_');
      const ps = parsedSS.getSheetByName(psName);
      const needInitial = !ps || ps.getLastRow() < 2;

      if (needInitial) {
        const res = initialParsing(c, rawSS, parsedSS);
        Logger.log(`INITIAL ${c.fund_id}: appended=${res.appended}`);
      } else {
        const res = newLinesParse(c, rawSS, parsedSS, { fullScan });
        Logger.log(`INCR ${c.fund_id}: maxDate=${res.maxDate} appended=${res.appended}`);
      }
      done++;
    } catch (e) {
      fail++;
      logQA_(parsedSS, c.fund_id || '(no id)', '', `Transform failed: ${e}`);
    }
  }
  Logger.log(`processAllFunds: finished=${done}, failures=${fail}`);
}

/***** UI HELPER ***************************************************************/
/**
 * Manual helper for the GUI: forces a full sweep over every RAW row so the
 * parser can re-check older data (useful after onboarding a fund).
 */
function processAllFundsFullScan() {
  processAllFunds({ fullScan: true });
}

/***** PREFLIGHT ***************************************************************/
function preflightFund_(c, rawSS) {
  if (!c || Object.values(c).every(v => v === '')) return { ok:false, reason:'empty config row' };
  if (!c.fund_id)        return { ok:false, reason:'missing fund_id' };
  if (!c.raw_sheetname)  return { ok:false, reason:`missing raw_sheetname for ${c.fund_id}` };

  const rawSh = rawSS.getSheetByName(c.raw_sheetname);
  if (!rawSh)            return { ok:false, reason:`RAW sheet '${c.raw_sheetname}' not found` };

  const lastRow = rawSh.getLastRow(), lastCol = rawSh.getLastColumn();
  if (lastRow < 2)       return { ok:false, reason:'RAW has header only / empty' };

  const header = rawSh.getRange(1,1,1,lastCol).getValues()[0].map(h => String(h||''));
  const needCols = [c.raw_date_columntitle].filter(Boolean);
  const missing  = needCols.filter(t => findColIdxByTitle_(header, t) < 0);
  if (missing.length)    return { ok:false, reason:`missing required column(s): ${missing.join(', ')}` };

  return { ok:true };
}

/***** PHASE 1: INITIAL PARSE **************************************************/
function initialParsing(c, rawSS, parsedSS) {
  const rawSh = rawSS.getSheetByName(c.raw_sheetname);
  const lastRow = rawSh.getLastRow(), lastCol = rawSh.getLastColumn();
  if (lastRow < 2) return { appended: 0, note: 'RAW empty' };

  const psName = 'parsed_' + c.fund_id.replace(/\./g,'_');
  let ps = parsedSS.getSheetByName(psName);
  if (!ps) ps = parsedSS.insertSheet(psName);
  ensureHeader_(ps);

  const header = rawSh.getRange(1,1,1,lastCol).getValues()[0].map(h => String(h||''));
  const block  = rawSh.getRange(2,1,lastRow-1,lastCol).getValues();
  const parsedRows = parseBlockToCanon_(c, header, block);   // ascending
  const cleaned    = uniqueByDateAndSort_(parsedRows);       // unique dates

  // (Re)write body
  const bodyRows = ps.getLastRow() > 1 ? ps.getLastRow()-1 : 0;
  if (bodyRows) ps.getRange(2,1,bodyRows,CANON_HEADER.length).clearContent();
  if (cleaned.length) ps.getRange(2,1,cleaned.length,CANON_HEADER.length).setValues(cleaned);

  return { appended: cleaned.length };
}

/***** PHASE 2: INCREMENTAL NEW-LINES ******************************************/
function newLinesParse(c, rawSS, parsedSS, opts) {
  const forceFullScan = !!(opts && opts.fullScan);
  const rawSh = rawSS.getSheetByName(c.raw_sheetname);
  const lastRow = rawSh.getLastRow(), lastCol = rawSh.getLastColumn();
  if (lastRow < 2) return { appended: 0, maxDate: '' };

  const psName = 'parsed_' + c.fund_id.replace(/\./g,'_');
  const ps = parsedSS.getSheetByName(psName);
  if (!ps || ps.getLastRow() < 2) return { appended: 0, maxDate: '' };

  const { maxDate } = readParsedIndexQuick_(ps);
  const existing    = readParsedDateSet_(ps); // yyyy-mm-dd dates already present
  if (!maxDate || existing.size === 0) {
    ensureParsedSortedAndUnique_(ps);
    return { appended: 0, maxDate: '' };
  }

  const header = rawSh.getRange(1,1,1,lastCol).getValues()[0].map(h => String(h||''));
  if (!forceFullScan) {
    const topRow = rawSh.getRange(2,1,1,lastCol).getValues()[0];
    const fast = tryFastRowIncrement_(c, header, topRow, ps, { maxDate, existing });
    if (fast.handled) return fast.result;
  }

  const block  = rawSh.getRange(2,1,lastRow-1,lastCol).getValues();
  const hint   = (c.date_hint || 'DMY').toUpperCase();
  const newer  = [];

  // RAW newest-first:
  for (let i=0;i<block.length;i++) {
    const r = block[i];
    const dateISO = parseDate_(getCellByTitle_(r, header, c.raw_date_columntitle), hint);
    if (!dateISO) continue;

    if (existing.has(dateISO)) {
      if (dateISO < maxDate) break; // older & already present
      continue;                     // equal -> skip but keep scanning
    }
    if (dateISO > maxDate) {
      const canon = buildCanonRow_(c, header, r);
      if (canon) newer.push(canon);
      continue;
    }
    break; // dateISO < maxDate -> older tail
  }

  if (newer.length) {
    newer.sort((a,b)=> String(a[0]).localeCompare(String(b[0]))); // ascending
    appendCanonRows_(ps, newer);
  }
  ensureParsedSortedAndUnique_(ps); // enforce invariant

  return { appended: newer.length, maxDate };
}

function tryFastRowIncrement_(c, header, row, ps, state) {
  if (!row || !row.length) {
    return { handled: false };
  }
  const maxDate = state && state.maxDate ? state.maxDate : '';
  const existing = (state && state.existing) || new Set();
  const hint = (c.date_hint || 'DMY').toUpperCase();
  const dateISO = parseDate_(getCellByTitle_(row, header, c.raw_date_columntitle), hint);
  if (!dateISO) {
    return { handled: false };
  }
  if ((maxDate && dateISO <= maxDate) || existing.has(dateISO)) {
    return { handled: true, result: { appended: 0, maxDate } };
  }
  const canon = buildCanonRow_(c, header, row);
  if (!canon) {
    return { handled: false };
  }
  appendCanonRows_(ps, [canon]);
  return { handled: true, result: { appended: 1, maxDate } };
}

/***** INVARIANT: UNIQUE (BY DATE) + ASCENDING *********************************/
function ensureParsedSortedAndUnique_(ps) {
  const lastRow = ps.getLastRow();
  if (lastRow < 2) return;

  const body = ps.getRange(2,1,lastRow-1, CANON_HEADER.length).getValues();
  const best = new Map(); // dateISO -> row

  for (const r of body) {
    const iso = toISODateString_(r[0]);
    if (!iso) continue;
    r[0] = iso;

    const prev = best.get(iso);
    if (!prev) { best.set(iso, r); continue; }

    const hasUrlNew = !!String(r[7]||'').trim();
    const hasUrlOld = !!String(prev[7]||'').trim();
    if (hasUrlNew && !hasUrlOld) { best.set(iso, r); continue; }
    if (hasUrlNew === hasUrlOld) {
      const tNew = Date.parse(String(r[8] || '')) || 0;
      const tOld = Date.parse(String(prev[8] || '')) || 0;
      if (tNew > tOld) best.set(iso, r);
    }
  }

  const cleaned = Array.from(best.values())
    .sort((a,b)=> String(a[0]).localeCompare(String(b[0])));

  ps.getRange(2,1,Math.max(0,lastRow-1), CANON_HEADER.length).clearContent();
  if (cleaned.length) ps.getRange(2,1, cleaned.length, CANON_HEADER.length).setValues(cleaned);
}

/***** PARSE HELPERS ***********************************************************/
function parseBlockToCanon_(c, header, rows) {
  const out = [];
  for (const r of rows) {
    const canon = buildCanonRow_(c, header, r);
    if (canon) out.push(canon);
  }
  out.sort((a,b)=> String(a[0]).localeCompare(String(b[0]))); // ascending by date
  return out;
}

function buildCanonRow_(c, header, r) {
  const idx = t => (t ? findColIdxByTitle_(header, t) : -1);
  const iDate = idx(c.raw_date_columntitle);
  const iNavT = idx(c.raw_nav_total_columntitle);
  const iUnits= idx(c.raw_units_outstanding_columntitle);
  const iNavU = idx(c.raw_nav_per_unit_columntitle);
  const iSale = idx(c.raw_sale_price_columntitle);
  const iRep  = idx(c.raw_repurchase_price_columntitle);
  const iFilt = c.raw_filter_column_title ? idx(c.raw_filter_column_title) : -1;
  const iColt = findColIdxByTitle_(header, 'collected_at');

  // optional row filter
  if (iFilt >= 0 && r[iFilt] != null) {
    const rv = String(r[iFilt]).trim();
    if (norm_(rv) !== norm_(c.raw_filter_value || '')) return null;
  }

  const hint = (c.date_hint || 'DMY').toUpperCase();
  const dateISO = parseDate_(getCell_(r, iDate), hint);
  if (!dateISO) return null;

  const navT  = num_(getCell_(r, iNavT));
  const units = num_(getCell_(r, iUnits));
  let   navU  = num_(getCell_(r, iNavU));
  let   sale  = num_(getCell_(r, iSale));
  let   rep   = num_(getCell_(r, iRep));

  if (navU == null && navT != null && isFinite(units) && units > 0) navU = navT / units;
  if (sale == null) sale = navU;
  if (rep  == null) rep  = navU;
  if (navU == null && navT == null) return null;

  // QA (rounding-tolerant)
  if (navT != null && navU != null && units != null) {
    if (shouldFlagNavMismatch_(navT, units, navU, c)) {
      const expected = units * navU;
      logQA_(SpreadsheetApp.openById(PARSED_SS_ID), c.fund_id, dateISO,
        `NAV mismatch | nav_total=${navT} vs units*nav_per_unit=${expected}`);
    }
  }

  const collectedAt = toISO_(iColt >= 0 ? getCell_(r, iColt) : new Date().toISOString());
  return [dateISO, navT, units, navU, sale, rep, collectedAt];
}

/***** QA HELPERS (ADDED – previously missing) *********************************/
function getDp_(c){
  const u = Number(c.units_dp);
  const p = Number(c.nav_per_unit_dp);
  const n = Number(c.nav_total_dp);
  return {
    u_dp: isFinite(u) ? u : 2,
    p_dp: isFinite(p) ? p : 4,
    n_dp: isFinite(n) ? n : 2
  };
}
function roundingTolerance_(units, navUnit, u_dp, p_dp) {
  const qu = Math.pow(10, -u_dp);
  const qp = Math.pow(10, -p_dp);
  return 0.5*qu*navUnit + 0.5*qp*units + 0.25*qu*qp;
}
function shouldFlagNavMismatch_(navTotal, units, navUnit, c) {
  if (navTotal == null || units == null || navUnit == null) return false;
  const { u_dp, p_dp } = getDp_(c);
  const delta = Math.abs(navTotal - (units * navUnit));
  const tol   = roundingTolerance_(units, navUnit, u_dp, p_dp);
  const ABS_FLOOR = 1000; // TZS tolerance floor
  return delta > Math.max(ABS_FLOOR, tol);
}

/***** DEDUPE (INITIAL) *******************************************************/
function uniqueByDateAndSort_(rows) {
  const best = new Map(); // dateISO -> row
  for (const r of rows) {
    const iso = toISODateString_(r[0]);
    if (!iso) continue;
    r[0] = iso;
    const prev = best.get(iso);
    if (!prev) { best.set(iso, r); continue; }
    const hasUrlNew = !!String(r[7]||'').trim();
    const hasUrlOld = !!String(prev[7]||'').trim();
    if (hasUrlNew && !hasUrlOld) { best.set(iso, r); continue; }
    if (hasUrlNew === hasUrlOld) {
      const tNew = Date.parse(String(r[8] || '')) || 0;
      const tOld = Date.parse(String(prev[8] || '')) || 0;
      if (tNew > tOld) best.set(iso, r);
    }
  }
  return Array.from(best.values())
    .sort((a,b)=> String(a[0]).localeCompare(String(b[0])));
}

/***** INDEX + STATE HELPERS ***************************************************/
function readParsedIndexQuick_(ps) {
  const lastRow = ps.getLastRow();
  if (lastRow < 2) return { maxDate: '' };
  const col = ps.getRange(2,1,lastRow-1,1).getValues().map(v => v[0]);
  let maxDate = '';
  for (const v of col) {
    const iso = toISODateString_(v);
    if (iso && iso > maxDate) maxDate = iso;
  }
  return { maxDate };
}

function readParsedDateSet_(ps) {
  const lastRow = ps.getLastRow();
  const set = new Set();
  if (lastRow < 2) return set;
  const col = ps.getRange(2,1,lastRow-1,1).getValues().map(v => v[0]);
  for (const v of col) {
    const iso = toISODateString_(v);
    if (iso) set.add(iso);
  }
  return set;
}

/***** WRITE & HEADER HELPERS **************************************************/
function appendCanonRows_(ps, rows) {
  if (!rows.length) return;
  const start = ps.getLastRow() + 1;
  ps.getRange(start, 1, rows.length, CANON_HEADER.length).setValues(rows);
}

function ensureHeader_(ps) {
  if (ps.getLastRow() === 0) {
    ps.getRange(1,1,1,CANON_HEADER.length).setValues([CANON_HEADER]);
    return;
  }
  const hdr = ps.getRange(1,1,1, ps.getLastColumn()).getValues()[0];
  if (hdr.length !== CANON_HEADER.length || CANON_HEADER.some((h,i)=> String(hdr[i]||'') !== h)) {
    ps.clear();
    ps.getRange(1,1,1,CANON_HEADER.length).setValues([CANON_HEADER]);
  }
}

/***** UTILITIES ***************************************************************/
function asObjectsTrimmed_(sh) {
  const vals = sh.getDataRange().getValues();
  if (!vals.length) return [];
  const head = vals.shift().map(h => String(h||'').trim());
  const idx  = Object.fromEntries(head.map((h,i)=>[ norm_(h), i ]));

  const get = (r, key) => {
    const i = idx[norm_(key)];
    if (i == null || i < 0) return '';
    const v = r[i];
    return (v == null) ? '' : String(v).trim();
  };

  const rows = [];
  for (const r of vals) {
    const row = {
      fund_id:                           get(r, 'fund_id'),
      parsed_sheetname:                  get(r, 'parsed_sheetname'),
      source_url:                        get(r, 'source_url'),
      source_type:                       get(r, 'source_type'),
      date_hint:                         get(r, 'date_hint'),
      raw_sheetname:                     get(r, 'raw_sheetname'),
      raw_date_columntitle:              get(r, 'raw_date_columntitle'),
      raw_nav_total_columntitle:         get(r, 'raw_nav_total_columntitle'),
      raw_units_outstanding_columntitle: get(r, 'raw_units_outstanding_columntitle'),
      raw_nav_per_unit_columntitle:      get(r, 'raw_nav_per_unit_columntitle'),
      raw_sale_price_columntitle:        get(r, 'raw_sale_price_columntitle'),
      raw_repurchase_price_columntitle:  get(r, 'raw_repurchase_price_columntitle'),
      raw_filter_column_title:           get(r, 'raw_filter_column_title'),
      raw_filter_value:                  get(r, 'raw_filter_value'),
      units_dp:                          get(r, 'units_dp'),
      nav_per_unit_dp:                   get(r, 'nav_per_unit_dp'),
      nav_total_dp:                      get(r, 'nav_total_dp')
    };
    if (!row.fund_id || !row.raw_sheetname || !row.raw_date_columntitle) continue; // strict
    rows.push(row);
  }
  return rows;
}

function findColIdxByTitle_(header, title) {
  if (!title) return -1;
  const want = norm_(title);
  let best = -1;
  for (let i=0;i<header.length;i++){
    const have = norm_(header[i]);
    if (have === want) return i;
    if (best < 0 && have.includes(want)) best = i; // forgiving partial match
  }
  return best;
}

// Use the spreadsheet's timezone (falls back to script tz, then UTC)
function getTZ_() {
  try {
    return SpreadsheetApp.openById(RAW_SS_ID).getSpreadsheetTimeZone() ||
           Session.getScriptTimeZone() || 'UTC';
  } catch (e) {
    return Session.getScriptTimeZone() || 'UTC';
  }
}

function parseDate_(v, hint) {
  if (v == null || v === '') return null;

  // If we already have a Date object from Sheets, format it in the sheet's TZ
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) {
    return Utilities.formatDate(v, getTZ_(), 'yyyy-MM-dd');
  }

  // Normalize common separators and strip time
  let s = String(v).trim();
  if (s.includes(' ')) s = s.split(' ')[0];
  s = s.replace(/[.]/g,'-').replace(/\//g,'-');

  const parts = s.split('-').filter(Boolean);
  const pad2 = x => String(x).padStart(2,'0');

  if (parts.length === 3) {
    switch ((hint || 'DMY').toUpperCase()) {
      case 'YYYY-MM-DD':
      case 'YMD':
        return `${parts[0].length===2?'20'+parts[0]:parts[0]}-${pad2(parts[1])}-${pad2(parts[2])}`;
      case 'MM/DD/YYYY':
      case 'MM/DD/YYY':
      case 'MDY':
        return `${parts[2].length===2?'20'+parts[2]:parts[2]}-${pad2(parts[0])}-${pad2(parts[1])}`;
      case 'DD-MM-YYYY':
      case 'DMY':
      default:
        // NOTE: fixed typo here: pad2(parts[0]) (not pad2[parts[0]])
        return `${parts[2].length===2?'20'+parts[2]:parts[2]}-${pad2(parts[1])}-${pad2(parts[0])}`;
    }
  }

  // Fallback: let JS parse then format in sheet TZ (avoids UTC roll-back)
  const d = new Date(String(v));
  return isNaN(d) ? null : Utilities.formatDate(d, getTZ_(), 'yyyy-MM-dd');
}

function num_(x) {
  if (x === '' || x == null) return null;
  let s = String(x).replace(/TZS/ig,'').replace(/,/g,'').trim();
  if (/^\((.*)\)$/.test(s)) s = '-'+s.slice(1,-1);
  const n = Number(s);
  return isFinite(n) ? n : null;
}

function norm_(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9]/g,''); }
function getCell_(row, idx){ return (idx >= 0 ? row[idx] : null); }
function getCellByTitle_(row, header, title){ return getCell_(row, findColIdxByTitle_(header, title)); }

function toISO_(v){
  if (!v) return new Date().toISOString();
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) return v.toISOString();
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s;
  const d = new Date(s);
  return isNaN(d) ? new Date().toISOString() : d.toISOString();
}
function toISODateString_(v) {
  if (v == null || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) {
    return Utilities.formatDate(v, getTZ_(), 'yyyy-MM-dd');
  }
  const s = String(v).trim();

  // If already yyyy-mm-dd (optionally with time), keep the date part
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];

  const d = new Date(s);
  return isNaN(d) ? '' : Utilities.formatDate(d, getTZ_(), 'yyyy-MM-dd');
}
/***** QA LOGGER ***************************************************************/
function logQA_(parsedSS, fund_id, dateISO, issue) {
  const name = 'QA';
  const sh = parsedSS.getSheetByName(name) || parsedSS.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1,1,1,4).setValues([['timestamp','fund_id','date','issue']]);
  }
  sh.appendRow([new Date().toISOString(), fund_id, dateISO, issue]);
}
