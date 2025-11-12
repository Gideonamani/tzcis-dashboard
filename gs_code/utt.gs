const DEFAULT_UTT_DATE_HINT = 'DD-MM-YYYY';
const DEFAULT_UTT_DATE_DISPLAY_FORMAT = 'dd-MM-yyyy';

function scrapeUttamisFundPerformance() {
  const BASE = 'https://uttamis.co.tz';
  const FUND_PAGE = BASE + '/fund-performance';
  const NAVS_URL  = BASE + '/navs';

  // --- GET page (CSRF + cookies)
  const getResp = UrlFetchApp.fetch(FUND_PAGE, {
    method: 'get',
    muteHttpExceptions: true,
    followRedirects: true,
  });
  const html = getResp.getContentText();
  const headers = getResp.getAllHeaders();

  const csrf = extractCsrfToken_(html);
  if (!csrf) throw new Error('Could not find CSRF token.');
  const cookieHeader = buildCookieHeader_(headers);

  // --- DataTables POST
  const dtParams = {
    draw: 1,
    start: 0,
    length: 5000,
    'search[value]': '',
    'search[regex]': false
  };

  const postResp = UrlFetchApp.fetch(NAVS_URL, {
    method: 'post',
    payload: toForm_(dtParams),
    contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
    muteHttpExceptions: true,
    followRedirects: true,
    headers: {
      'X-CSRF-TOKEN': csrf,
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Origin': BASE,
      'Referer': FUND_PAGE,
      ...(cookieHeader ? {'Cookie': cookieHeader} : {})
    }
  });

  const body = postResp.getContentText();
  let json;
  try { json = JSON.parse(body); }
  catch (e) {
    throw new Error('Unable to parse JSON from /navs: ' + e + '\n' + body.slice(0,300));
  }

  const allRows = (json && json.data) || [];
  if (!Array.isArray(allRows) || allRows.length === 0) {
    throw new Error('No rows returned from /navs');
  }

  // --- Only the first 6 rows
  const top6 = allRows.slice(0, 6);

  // --- Load mapping from _config (Scheme Name -> target sheet)
  const schemeMeta = loadSchemeMetadata_();

  // --- Columns we pull “as is”
  const header = [
    'Scheme Name',
    'Net Asset Value',
    'Outstanding Number of Units',
    'Nav Per Unit',
    'Sale Price per Unit',
    'Repurchase Price/Unit',
    'Date Valued',
    'Scraped Time'
  ];

  // --- Write each of the 6 rows into its mapped sheet at row 2
  top6.forEach(r => {
    const scheme = safeCell_(r.sname);
    const targetMeta = schemeMeta[normalizeKey_(scheme)];
    if (!targetMeta) {
      Logger.log('No target sheet mapping for scheme: ' + scheme + ' (skipping)');
      return;
    }
    const row = [
      scheme,
      safeCell_(r.net_asset_value),
      safeCell_(r.outstanding_number_of_units),
      safeCell_(r.nav_per_unit),
      safeCell_(r.sale_price_per_unit),
      safeCell_(r.repurchase_price_per_unit),
      safeCell_(r.date_valued),
      isoNow_()
    ];
    writeLatestRow_({
      sheetName: targetMeta.sheetName,
      headers: header,
      rowValues: row,
      dateHint: targetMeta.dateHint || DEFAULT_UTT_DATE_HINT,
      dateHeader: /^date\b/i,
      scrapedHeader: /^scraped time$/i,
      dateFormat: targetMeta.dateFormat || DEFAULT_UTT_DATE_DISPLAY_FORMAT
    });
  });
}

/* ===================== Helpers ===================== */

/**
 * Load per-scheme metadata (sheet name + date formats) from _config.
 */
function loadSchemeMetadata_() {
  // 1) Your canonical scheme -> fund_id map (from your note)
  const schemeToFundId = {
    [normalizeKey_('Bond Fund')]:          'utt.bond',
    [normalizeKey_('Jikimu Fund')]:        'utt.jikimu',
    [normalizeKey_('Liquid Fund')]:        'utt.liquid',
    [normalizeKey_('Umoja Fund')]:         'utt.umoja',
    [normalizeKey_('Watoto Fund')]:        'utt.watoto',
    [normalizeKey_('Wekeza Maisha Fund')]: 'utt.wekeza',
  };

  const defaultMeta = {};
  Object.keys(schemeToFundId).forEach(k => {
    defaultMeta[k] = {
      sheetName: schemeToFundId[k],
      dateHint: DEFAULT_UTT_DATE_HINT,
      dateFormat: DEFAULT_UTT_DATE_DISPLAY_FORMAT
    };
  });

  const ss = SpreadsheetApp.openById(RAW_SS_ID);
  const cfg = ss.getSheetByName('_config');
  if (!cfg) return defaultMeta;

  const rows = cfg.getDataRange().getValues();
  if (rows.length < 2) return defaultMeta;

  const header = rows[0].map(v => String(v || '').toLowerCase().trim());
  const idxFund       = header.indexOf('fund_id');
  const idxRawSheet   = header.indexOf('raw_sheetname');
  const idxDateHint   = header.indexOf('date_hint');
  const idxDateFormat = header.indexOf('date_display_format');

  const metaByFund = {};
  if (idxFund >= 0 && idxRawSheet >= 0) {
    for (let i = 1; i < rows.length; i++) {
      const fundId = String(rows[i][idxFund] || '').trim();
      if (!fundId) continue;
      metaByFund[fundId] = {
        sheetName: String(rows[i][idxRawSheet] || '').trim() || fundId,
        dateHint: idxDateHint >= 0 ? String(rows[i][idxDateHint] || '').trim() : '',
        dateFormat: idxDateFormat >= 0 ? String(rows[i][idxDateFormat] || '').trim() : ''
      };
    }
  }

  const result = {};
  Object.keys(schemeToFundId).forEach(key => {
    const fundId = schemeToFundId[key];
    const meta = metaByFund[fundId];
    result[key] = meta ? {
      sheetName: meta.sheetName,
      dateHint: meta.dateHint || DEFAULT_UTT_DATE_HINT,
      dateFormat: meta.dateFormat || DEFAULT_UTT_DATE_DISPLAY_FORMAT
    } : defaultMeta[key];
  });

  return result;
}



function extractCsrfToken_(html) {
  const m = html.match(/<meta\s+name=["']csrf-token["']\s+content=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

function buildCookieHeader_(headers) {
  const sc = headers['Set-Cookie'] || headers['set-cookie'];
  if (!sc) return '';
  const list = Array.isArray(sc) ? sc : [sc];
  const pairs = list.map(line => (line || '').split(';')[0]).filter(Boolean);
  return pairs.join('; ');
}

function toForm_(obj) {
  return Object.keys(obj).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(obj[k])).join('&');
}

function safeCell_(v) { return (v === null || v === undefined) ? '' : v; }
function normalizeKey_(s) { return String(s || '').toLowerCase().trim(); }
