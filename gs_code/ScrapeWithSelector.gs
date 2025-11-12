/***** =================== CONFIG =================== *****/
const CFG = {
  CONFIG_SHEET: '_config',
  TIMEZONE: Session.getScriptTimeZone() || 'Africa/Dar_es_Salaam',
  // network
  FETCH_TIMEOUT_MS: 30000,
  MAX_RETRIES: 3,
  BACKOFF_MS: 1200,
  // header normalization
  NORM: (s) => String(s || '').toLowerCase().replace(/\s+/g,' ').replace(/[()]/g,'').trim()
};
/***** ============================================== *****/


/***** =============== PUBLIC FUNCTIONS ============== *****/

// Run manually or on a trigger: processes all _config rows
function scrapeFromConfig() {
  const jobs = readConfigRowsLong_();
  if (!jobs.length) {
    console.log('No valid rows in _config.');
    return;
  }

  const logs = [];
  for (const j of jobs) {
    if (!j.source_css_selector) continue;
    try {
      const html = fetchWithRetry_(j.source_url);
      const tableHtml = findTableBySelector_(html, j.source_css_selector);
      if (!tableHtml) {
        logs.push(`✖ ${j.raw_sheetname}: table not found for selector "${j.source_css_selector}"`);
        continue;
      }

      const parsed = parseTable_(tableHtml);
      if (!parsed.dataRows.length) {
        logs.push(`✖ ${j.raw_sheetname}: no data rows detected`);
        continue;
      }

      // Build expected source headers
      const expectedHeaders = compact_([
        j.raw_date_columntitle,
        j.raw_nav_total_columntitle,
        j.raw_units_outstanding_columntitle,
        j.raw_nav_per_unit_columntitle,
        j.raw_sale_price_columntitle,
        j.raw_repurchase_price_columntitle
      ]);

      const mapping = buildHeaderMapping_(parsed.headerNorm, expectedHeaders);
      const dateField = j.raw_date_columntitle;
      const dateIdx = mapping[dateField];

      // find the row with the latest date (assumes ISO‑like format, e.g. YYYY-MM-DD)
      let latestRow = null;
      parsed.dataRows.forEach(row => {
        const rawDate = row[dateIdx];
        const normalized = normalizeDateString_(rawDate, j.date_hint);
        // skip rows that aren't valid dates
        if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return;
        if (!latestRow) {
          latestRow = row;
          latestRow.__normalizedDate = normalized;
        } else if (normalized > latestRow.__normalizedDate) {
          latestRow = row;
          latestRow.__normalizedDate = normalized;
        }
      });

      if (!latestRow) {
        logs.push(`✖ ${j.raw_sheetname}: unable to determine latest date`);
        continue;
      }

      // Build record using the latest row
      const record = {};
      expectedHeaders.forEach(destName => {
        const srcIdx = mapping[destName];
        record[destName] = (latestRow[srcIdx] || '').toString().trim();
      });
      record['Scraped Time'] = isoNow_();

      appendToSheet_(j.raw_sheetname, record, j.date_hint, j.raw_date_columntitle, j.date_display_format);
      logs.push(`✔ ${j.raw_sheetname}: appended latest row (${latestRow[dateIdx]})`);
    } catch (e) {
      logs.push(`✖ ${j.raw_sheetname}: ${e.message}`);
    }
  }
  console.log(logs.join('\n'));
}



// (Optional) daily scheduler helper
function installDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'scrapeFromConfig') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('scrapeFromConfig').timeBased().everyDays(1).atHour(6).nearMinute(20).create();
}


/***** ================= CORE / I/O ================== *****/

function readConfigRowsLong_() {
  const sh = SpreadsheetApp.openById(RAW_SS_ID).getSheetByName(CFG.CONFIG_SHEET);
  if (!sh) throw new Error(`Missing sheet: ${CFG.CONFIG_SHEET}`);

  const vals = sh.getDataRange().getValues();
  if (vals.length < 2) return [];
  const H = vals[0].map(String);

  // Column indexes
  const ix = {};
  [
    'fund_id','raw_sheetname','source_url','source_type','source_css_selector','date_hint','date_display_format',
    'raw_sheetname','raw_date_columntitle','raw_nav_total_columntitle','raw_units_outstanding_columntitle',
    'raw_nav_per_unit_columntitle','raw_sale_price_columntitle','raw_repurchase_price_columntitle'
  ].forEach(k => { ix[k] = H.indexOf(k); });

  // Validate required columns
  ['raw_sheetname','source_url','source_css_selector','raw_date_columntitle'].forEach(k=>{
    if (ix[k] === -1) throw new Error(`_config missing required column: ${k}`);
  });

  const out = [];
  for (let r = 1; r < vals.length; r++) {
    const row = vals[r];
    const raw_sheetname = str_(row[ix.raw_sheetname]);
    const source_url = str_(row[ix.source_url]);
    const source_css_selector = str_(row[ix.source_css_selector]);
    if (!raw_sheetname || !source_url || !source_css_selector) continue;

    out.push({
      fund_id: str_(row[ix.fund_id]),
      raw_sheetname,
      source_url,
      source_type: str_(row[ix.source_type]) || 'html',
      source_css_selector,
      date_hint: str_(row[ix.date_hint]),
      date_display_format: str_(row[ix.date_display_format]),
      raw_sheetname: str_(row[ix.raw_sheetname]),

      raw_date_columntitle: str_(row[ix.raw_date_columntitle]),
      raw_nav_total_columntitle: str_(row[ix.raw_nav_total_columntitle]),
      raw_units_outstanding_columntitle: str_(row[ix.raw_units_outstanding_columntitle]),
      raw_nav_per_unit_columntitle: str_(row[ix.raw_nav_per_unit_columntitle]),
      raw_sale_price_columntitle: str_(row[ix.raw_sale_price_columntitle]),
      raw_repurchase_price_columntitle: str_(row[ix.raw_repurchase_price_columntitle])
    });
  }
  return out;
}

function fetchWithRetry_(url) {
  let lastErr;
  for (let i=0; i<CFG.MAX_RETRIES; i++) {
    try {
      const res = UrlFetchApp.fetch(url, {
        method: 'get',
        muteHttpExceptions: true,
        followRedirects: true,
        validateHttpsCertificates: true,
        headers: { 'User-Agent': 'Mozilla/5.0 (AppsScript CIS Harvester)', 'Accept': 'text/html,*/*' },
        timeout: CFG.FETCH_TIMEOUT_MS
      });
      const code = res.getResponseCode();
      if (code >= 200 && code < 300) return res.getContentText();
      throw new Error(`HTTP ${code}`);
    } catch (e) {
      lastErr = e;
      Utilities.sleep(CFG.BACKOFF_MS * Math.pow(2, i));
    }
  }
  throw lastErr || new Error('Fetch failed');
}


/***** ================== HTML PARSING ================= *****/

function findTableBySelector_(html, selector) {
  const sel = String(selector || '').trim();
  if (!/^table([.#][A-Za-z0-9_-]+)*$/.test(sel)) {
    throw new Error(`Unsupported selector "${selector}". Use table, table#id, or table.classA.classB`);
  }

  const idMatch = sel.match(/#([A-Za-z0-9_-]+)/);
  const wantId = idMatch ? idMatch[1] : null;

  const classMatches = [...sel.matchAll(/\.([A-Za-z0-9_-]+)/g)];
  const wantClasses = classMatches.map(m => m[1]);

  const re = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const full = m[0];
    const open = full.slice(0, full.indexOf('>')+1);

    if (wantId) {
      const idAttr = (open.match(/\bid\s*=\s*["']([^"']+)["']/i) || [,''])[1];
      if ((idAttr || '') !== wantId) continue;
    }
    if (wantClasses.length) {
      const clsAttr = (open.match(/\bclass\s*=\s*["']([^"']+)["']/i) || [,''])[1];
      const have = new Set((clsAttr || '').split(/\s+/).filter(Boolean));
      const ok = wantClasses.every(c => have.has(c));
      if (!ok) continue;
    }
    return full;
  }
  return null;
}

// Return header + rows (arrays of visible text)
function parseTable_(tableHtml) {
  // --- 1) THEAD (preferred) ---
  const theadInner = (tableHtml.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i) || [,''])[1] || '';
  let headerCells = [];
  if (theadInner) {
    const trHead = (theadInner.match(/<tr[^>]*>([\s\S]*?)<\/tr>/i) || [,''])[1] || '';
    if (trHead) headerCells = extractHeaderCellsWithFallback_(trHead);
  }

  // --- 2) TBODY (for data) ---
  const tbodyInner = (tableHtml.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i) || [,''])[1] || '';
  const inner = tbodyInner || tableHtml;

  // Collect tbody rows
  const rows = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rm; while ((rm = rowRe.exec(inner)) !== null) rows.push(rm[1]);

  // --- 3) If no THEAD header, check for a header row inside TBODY (<th> cells) ---
  let startDataIdx = 0;
  if (!headerCells.length && rows.length) {
    const first = rows[0];
    if (/<th\b/i.test(first)) {
      const maybeHdr = extractHeaderCellsWithFallback_(first);
      if (maybeHdr.filter(Boolean).length) {
        headerCells = maybeHdr;
        startDataIdx = 1; // skip this header row in data
      }
    }
  }

  const headerNorm = headerCells.map(CFG.NORM);

  // --- 4) Data rows (skip stray header-ish rows) ---
  const dataRows = [];
  for (let i = startDataIdx; i < rows.length; i++) {
    const rowHtml = rows[i];
    const cells = extractCells_(rowHtml, /*preferTH*/ false);
    // Ignore empty rows and accidental header-like text-only rows
    const rawTxt = cells.join(' ').toLowerCase();
    const digits = rawTxt.replace(/[^\d]/g, '');
    const looksHeaderish = /date|nav|value|unit|price|repurchase|sale/.test(rawTxt) && digits.length === 0;
    if (!cells.length || looksHeaderish) continue;
    dataRows.push(cells);
  }

  return { headerNorm, headerRaw: headerCells, dataRows };
}

// Extract <th> or <td> text; if empty, fall back to aria-label/title/data-title.
// Also trims ": activate to sort…" suffix commonly found in DataTables aria-labels.
function extractHeaderCellsWithFallback_(trHtml) {
  const out = [];
  const thRe = /<th[^>]*>([\s\S]*?)<\/th>/gi;
  let m;
  while ((m = thRe.exec(trHtml)) !== null) {
    let txt = htmlToText_(m[1]).trim();

    if (!txt) {
      const openTag = m[0].slice(0, m[0].indexOf('>') + 1);
      const attr = (name) => {
        const mm = openTag.match(new RegExp(name + '\\s*=\\s*["\']([^"\']+)["\']', 'i'));
        return mm ? mm[1] : '';
      };
      txt = attr('aria-label') || attr('title') || attr('data-title') || '';
      if (txt) {
        // e.g., "Date: activate to sort column ascending" -> "Date"
        const colon = txt.indexOf(':');
        if (colon > -1) txt = txt.slice(0, colon).trim();
      }
    }
    out.push(txt);
  }
  // Fallback: if no <th> found, try <td> (rare header-in-td tables)
  if (!out.length) {
    const tds = extractCells_(trHtml, /*preferTH*/ false);
    return tds;
  }
  return out;
}

function extractCells_(rowHtml, preferTH) {
  const cells = [];
  const cellRe = preferTH ? /<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi
                          : /<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi;
  let cm; while ((cm = cellRe.exec(rowHtml)) !== null) {
    const text = htmlToText_(cm[2]).trim();
    cells.push(text);
  }
  return cells;
}


function extractCells_(rowHtml, preferTH) {
  const cells = [];
  const cellRe = preferTH ? /<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi
                          : /<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi;
  let cm; while ((cm = cellRe.exec(rowHtml)) !== null) {
    const text = htmlToText_(cm[2]).trim();
    cells.push(text);
  }
  return cells;
}

function htmlToText_(s) {
  let t = String(s).replace(/<[^>]+>/g, ' ');
  t = t.replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
       .replace(/&quot;/g,'"')
       .replace(/&#(\d+);/g, (_,n)=>String.fromCharCode(parseInt(n,10)))
       .replace(/&#x([0-9a-fA-F]+);/g, (_,h)=>String.fromCharCode(parseInt(h,16)));
  return t.replace(/\s+/g,' ').trim();
}


/***** ============== MAPPING & APPEND ============== *****/

function buildHeaderMapping_(sourceHeaderNorm, expectedHeaders) {
  const map = {};
  for (const raw of expectedHeaders) {
    const want = CFG.NORM(raw);
    const i = sourceHeaderNorm.findIndex(h => h.includes(want) || want.includes(h));
    if (i === -1) throw new Error(`Header "${raw}" not found in source table.`);
    map[raw] = i; // key by the SAME (raw) name; used as destination column too
  }
  return map; // { "Net Asset Value(TZS)": 1, ... }
}

function appendToSheet_(sheetName, record, dateHint, dateColumnTitle, dateDisplayFormat) {
  const ss = SpreadsheetApp.openById(RAW_SS_ID);
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error(`Destination sheet not found: ${sheetName}`);

  // 1️⃣ Ensure header row
  let headers = sh.getLastRow()
    ? sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String)
    : [];
  if (headers.length === 1 && headers[0] === '') headers = [];

  const headerSet = new Set(headers);
  for (const k of Object.keys(record).concat(['Scraped Time'])) {
    if (!headerSet.has(k)) {
      headers.push(k);
      headerSet.add(k);
    }
  }
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);

  // 2️⃣ Create row array in header order
  const row = headers.map(h => record[h] != null ? record[h] : '');

  // 3️⃣ Insert new row below header
  sh.insertRowsAfter(1, 1);
  const range = sh.getRange(2, 1, 1, headers.length);
  range.setValues([row]);

  // 4️⃣ If there’s a date column and hint, format it
  const dateColIdx = headers.findIndex(h => CFG.NORM(h) === CFG.NORM(dateColumnTitle));
  if (dateColIdx > -1) {
    const cell = sh.getRange(2, dateColIdx + 1);
    const rawVal = cell.getValue();
    const normalized = normalizeDateString_(rawVal, dateHint);
    const parsed = tryParseDate_(normalized || rawVal);
    if (parsed) cell.setValue(parsed);
    const formatToUse = chooseDateDisplayFormat_(dateDisplayFormat, dateHint);
    if (formatToUse) cell.setNumberFormat(formatToUse);
  }
}



function tryParseDate_(s) {
  const parts = String(s).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!parts) return null;
  return new Date(parts[1], parts[2] - 1, parts[3]);
}

function chooseDateDisplayFormat_(explicitFormat, hint) {
  if (explicitFormat) return explicitFormat;
  const key = (hint || '').toUpperCase();
  switch (key) {
    case 'MM/DD/YYYY':
    case 'MDY':
      return 'M/d/yyyy';
    case 'DD/MM/YYYY':
    case 'DMY':
      return 'd/M/yyyy';
    case 'YYYY-MM-DD':
    case 'YMD':
      return 'yyyy-MM-dd';
    case 'DD-MM-YYYY':
      return 'dd-MM-yyyy';
    default:
      return 'yyyy-MM-dd';
  }
}


/***** ================== DATE HELPERS ================== *****/

function normalizeDateString_(input, hint) {
  const s = String(input || '').trim();
  if (!s) return s;

  // If already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Normalize hint variants like 'MM/DD/YYY' -> 'MM/DD/YYYY'
  const hintNorm = (hint || '').toUpperCase().replace(/Y{2,3}Y?/, 'YYYY');

  const tryFmt = (fmt) => {
    if (!fmt) return null;
    const reParts = fmt.replace(/YYYY/,'(\\d{4})')
                       .replace(/MM/,'(\\d{1,2})')
                       .replace(/DD/,'(\\d{1,2})')
                       .replace(/\//g,'\\/')
                       .replace(/\-/g,'\\-');
    const re = new RegExp('^' + reParts + '$');
    const m = s.match(re);
    if (!m) return null;
    const map = {};
    let idx = 1;
    for (const token of fmt.match(/(YYYY|MM|DD)/g) || []) {
      map[token] = m[idx++];
    }
    return buildISO_(map['YYYY'], map['MM'], map['DD']);
  };

  // Try hinted first
  let iso = tryFmt(hintNorm);
  if (iso) return iso;

  // Try common patterns
  const common = ['DD-MM-YYYY','D-M-YYYY','DD/MM/YYYY','D/M/YYYY','MM/DD/YYYY','M/D/YYYY','YYYY-MM-DD'];
  for (const f of common) {
    iso = tryFmt(f);
    if (iso) return iso;
  }

  // Fallback to Date()
  const d = new Date(s);
  if (!isNaN(d)) return buildISO_(d.getFullYear(), d.getMonth()+1, d.getDate());
  return s; // leave as-is if unrecognized
}

function buildISO_(y, m, d) {
  const yyyy = String(y);
  const MM = String(m).padStart(2,'0');
  const dd = String(d).padStart(2,'0');
  return `${yyyy}-${MM}-${dd}`;
}

function sameHeader_(a, b) {
  return CFG.NORM(a) === CFG.NORM(b);
}

function isoNow_() {
  return Utilities.formatDate(new Date(), CFG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
}


/***** ================== SMALL UTILS ================== *****/

function str_(x){ return (x == null) ? '' : String(x).trim(); }
function compact_(arr){ return (arr || []).filter(v => v != null && String(v).trim() !== ''); }
