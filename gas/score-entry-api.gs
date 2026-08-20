const SCORE_API = Object.freeze({
  webSpreadsheetId: '1L2c0E5HqsbNhjN-5P81iZVXETtQ4Jwt-CmqslPCLtuk',
  webSheet: '成績入力',
  adminPassword: 's214b318'
});

function doGet() {
  try {
    return json_({ok: true, entries: readWebEntries_()});
  } catch (error) {
    return json_({ok: false, error: String(error && error.message || error)});
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    if (body.action === 'submit') return json_({ok: true, entry: upsertWebEntry_(body.id, body.data)});
    if (body.action === 'url') return json_({ok: true, entry: saveUrl_(body.id, body.url)});
    if (body.action === 'edit') {
      requireAdmin_(body.password);
      return json_({ok: true, entry: upsertWebEntry_(body.id, body.data, true)});
    }
    if (body.action === 'delete') {
      requireAdmin_(body.password);
      deleteWebOverride_(body.id);
      return json_({ok: true});
    }
    throw new Error('不明な操作です。');
  } catch (error) {
    return json_({ok: false, error: String(error && error.message || error)});
  }
}

function readWebEntries_() {
  const sheet = webSheet_();
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 23).getValues()
    .filter(row => row[0] && Number(row[22] || 0) !== 1)
    .map(webRowToEntry_)
    .sort((a, b) => `${a.date}|${a.time}|${a.id}`.localeCompare(`${b.date}|${b.time}|${b.id}`));
}

function webRowToEntry_(row) {
  return {
    id: text_(row[0]), time: timeText_(row[1]), date: dateText_(row[2]), phase: text_(row[3]),
    league: text_(row[4]), table: text_(row[5]), match: text_(row[6]), source: 'web',
    rows: [7, 10, 13, 16].map(i => ({team: text_(row[i]), player: text_(row[i + 1]), score: number_(row[i + 2])})),
    url: text_(row[19]), originKey: text_(row[21])
  };
}

function upsertWebEntry_(id, data) {
  if (!id || !data || !Array.isArray(data.rows) || data.rows.length !== 4) throw new Error('入力データが正しくありません。');
  const sheet = webSheet_();
  const rowNumber = findWebRow_(sheet, id);
  const existing = rowNumber ? sheet.getRange(rowNumber, 1, 1, 23).getValues()[0] : null;
  const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
  const rows = data.rows.slice().sort((a, b) => Number(b.score) - Number(a.score));
  const originKey = data.originKey || (existing ? text_(existing[21]) : '');
  const values = [
    id, existing ? existing[1] : now, data.date, data.phase, data.league || '', data.table || '', data.match,
    ...rows.flatMap(row => [row.team, row.player, Number(row.score)]),
    data.url || (existing ? existing[19] : ''), existing ? existing[20] : '', originKey, 0
  ];
  if (rowNumber) sheet.getRange(rowNumber, 1, 1, 23).setValues([values]);
  else sheet.appendRow(values);
  return webRowToEntry_(values);
}

function saveUrl_(id, url) {
  if (!/^https:\/\/pl\.sega-mj\.com\/mj_viewer\/replayMatch\?/.test(String(url || ''))) throw new Error('試合リプレイのURLではありません。');
  const sheet = webSheet_();
  const rowNumber = findWebRow_(sheet, id);
  if (!rowNumber) throw new Error('対象試合が見つかりません。');
  sheet.getRange(rowNumber, 20, 1, 2).setValues([[url, new Date()]]);
  return webRowToEntry_(sheet.getRange(rowNumber, 1, 1, 23).getValues()[0]);
}

function deleteWebOverride_(id) {
  const sheet = webSheet_();
  const rowNumber = findWebRow_(sheet, id);
  if (rowNumber) sheet.getRange(rowNumber, 23).setValue(1);
}

function findWebRow_(sheet, id) {
  if (sheet.getLastRow() < 2) return 0;
  const match = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).createTextFinder(String(id)).matchEntireCell(true).findNext();
  return match ? match.getRow() : 0;
}

function webSheet_() {
  const sheet = SpreadsheetApp.openById(SCORE_API.webSpreadsheetId).getSheetByName(SCORE_API.webSheet);
  if (!sheet) throw new Error('Web用成績シートが見つかりません。');
  return sheet;
}

function requireAdmin_(password) {
  if (String(password || '') !== SCORE_API.adminPassword) throw new Error('管理者パスワードが違います。');
}

function dateText_(value) {
  if (value instanceof Date) return Utilities.formatDate(value, 'Asia/Tokyo', 'yyyy-MM-dd');
  const text = String(value || '').trim().replace(/\//g, '-');
  const match = text.match(/(20\d{2})-(\d{1,2})-(\d{1,2})/);
  return match ? `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}` : '';
}
function timeText_(value) {
  if (value instanceof Date) return Utilities.formatDate(value, 'Asia/Tokyo', 'HH:mm');
  const match = String(value || '').match(/(\d{1,2})[:時](\d{1,2})/);
  return match ? `${match[1].padStart(2, '0')}:${match[2].padStart(2, '0')}` : '';
}
function text_(value) { return String(value == null ? '' : value).trim(); }
function number_(value) { return Number(String(value == null ? '' : value).replace('▲', '-').replace(/[^0-9+\-.]/g, '')) || 0; }
function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
