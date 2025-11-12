/***** LATEST FUND SNAPSHOT ****************************************************
 *
 * Builds a quick-look sheet in the RAW workbook that captures the newest row
 * from every parsed fund sheet. This enables dashboards to query a single
 * table instead of scanning each parsed_<fund> worksheet.
 *
 *****************************************************************************/

const LATEST_FUNDS_SHEET = '_latestFundData';

/**
 * Reads each fund entry from the _config sheet, grabs the most recent parsed
 * row, and rewrites RAW::_latestFundData with those snapshots.
 */
function refreshLatestFundDataSheet() {
  const rawSS = SpreadsheetApp.openById(RAW_SS_ID);
  const parsedSS = SpreadsheetApp.openById(PARSED_SS_ID);
  const cfgSh = rawSS.getSheetByName(CONFIG_SHEET);
  if (!cfgSh) throw new Error(`Missing sheet '${CONFIG_SHEET}' in RAW workbook`);

  const configs = asObjectsTrimmed_(cfgSh);
  const header = latestHeader_();
  const target = ensureLatestSheet_(rawSS, header);

  // Reset existing body before writing the fresh snapshot
  const existingRows = Math.max(0, target.getLastRow() - 1);
  if (existingRows) {
    target.getRange(2, 1, existingRows, header.length).clearContent();
  }

  if (!configs.length) {
    Logger.log('refreshLatestFundDataSheet: no configs found, sheet cleared.');
    return;
  }

  const rows = [];
  let missing = 0;

  configs.forEach(cfg => {
    const fundId = (cfg && cfg.fund_id) ? String(cfg.fund_id).trim() : '';
    if (!fundId) return;

    const parsedName = toParsedSheetName_(fundId);
    const parsedSheet = parsedSS.getSheetByName(parsedName);
    if (!parsedSheet || parsedSheet.getLastRow() < 2) {
      missing++;
      return;
    }

    const lastRowIdx = parsedSheet.getLastRow();
    const latest = parsedSheet
      .getRange(lastRowIdx, 1, 1, header.length - 1) // minus fund_id column
      .getValues()[0];
    rows.push([fundId].concat(latest));
  });

  if (rows.length) {
    target.getRange(2, 1, rows.length, header.length).setValues(rows);
  }

  Logger.log(
    `refreshLatestFundDataSheet: wrote ${rows.length} snapshot rows, missing ${missing}.`
  );
}

function ensureLatestSheet_(rawSS, header) {
  const sh = rawSS.getSheetByName(LATEST_FUNDS_SHEET) || rawSS.insertSheet(LATEST_FUNDS_SHEET);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, header.length).setValues([header]);
    return sh;
  }
  const currentHeader = sh.getRange(1, 1, 1, header.length).getValues()[0];
  const headerMatches = header.every((label, idx) => String(currentHeader[idx] || '') === label);
  if (!headerMatches) {
    sh.clear();
    sh.getRange(1, 1, 1, header.length).setValues([header]);
  }
  return sh;
}

function latestHeader_() {
  const canon =
    (typeof CANON_HEADER !== 'undefined' && Array.isArray(CANON_HEADER) && CANON_HEADER.length)
      ? CANON_HEADER
      : ['date', 'nav_total', 'units_outstanding', 'nav_per_unit', 'sale_price', 'repurchase_price', 'collected_at'];
  return ['fund_id'].concat(canon);
}

function toParsedSheetName_(fundId) {
  return 'parsed_' + String(fundId || '').replace(/\./g, '_');
}
