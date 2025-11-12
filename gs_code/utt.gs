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
  const schemeToSheet = loadSchemeToSheetMapping_();

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
    const targetSheetName = schemeToSheet[normalizeKey_(scheme)];
    if (!targetSheetName) {
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
      sheetName: targetSheetName,
      headers: header,
      rowValues: row,
      dateHint: 'DD-MM-YYYY',
      dateHeader: /^date\b/i,
      scrapedHeader: /^scraped time$/i
    });
  });
}

/* ===================== Helpers ===================== */

/**
 * Build mapping: Scheme Name (from website) -> target sheet name.
 * Steps:
 *   1) Map scheme name -> fund_id   (using your fixed mapping)
 *   2) Look up fund_id in _config   (column fund_id) and read raw_sheetname
 */
function loadSchemeToSheetMapping_() {
  // 1) Your canonical scheme -> fund_id map (from your note)
  const schemeToFundId = {
    [normalizeKey_('Bond Fund')]:          'utt.bond',
    [normalizeKey_('Jikimu Fund')]:        'utt.jikimu',
    [normalizeKey_('Liquid Fund')]:        'utt.liquid',
    [normalizeKey_('Umoja Fund')]:         'utt.umoja',
    [normalizeKey_('Watoto Fund')]:        'utt.watoto',
    [normalizeKey_('Wekeza Maisha Fund')]: 'utt.wekeza',
  };

  // 2) Read _config for fund_id -> raw_sheetname
  const ss = SpreadsheetApp.openById(RAW_SS_ID);
  const cfg = ss.getSheetByName('_config');
  if (!cfg) {
    // Fallback: if _config missing, just use fund_id itself as sheet name
    const m = {};
    Object.keys(schemeToFundId).forEach(k => { m[k] = schemeToFundId[k]; });
    return m;
  }

  const rows = cfg.getDataRange().getValues();
  if (rows.length < 2) {
    const m = {};
    Object.keys(schemeToFundId).forEach(k => { m[k] = schemeToFundId[k]; });
    return m;
  }

  // Find columns
  const h = rows[0].map(v => String(v || '').toLowerCase().trim());
  const idxFund       = h.indexOf('fund_id');
  const idxRawSheet   = h.indexOf('raw_sheetname'); // <- column you mentioned

  // Build fund_id -> raw_sheetname lookup
  const fundToRaw = {};
  if (idxFund >= 0 && idxRawSheet >= 0) {
    for (let i = 1; i < rows.length; i++) {
      const fundId = String(rows[i][idxFund] || '').trim();
      const rawSn  = String(rows[i][idxRawSheet] || '').trim();
      if (fundId) fundToRaw[fundId] = rawSn || fundId; // fallback to fund_id
    }
  }

  // Compose final map: schemeName -> (raw_sheetname from _config)
  const schemeToSheet = {};
  Object.keys(schemeToFundId).forEach(schemeKey => {
    const fundId = schemeToFundId[schemeKey];
    const target = fundToRaw[fundId] || fundId; // fallback if not found
    schemeToSheet[schemeKey] = target;
  });

  return schemeToSheet;
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
