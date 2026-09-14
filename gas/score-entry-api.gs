const SCORE_API = Object.freeze({
  webSpreadsheetId: '1L2c0E5HqsbNhjN-5P81iZVXETtQ4Jwt-CmqslPCLtuk',
  webSheet: '成績入力',
  teamEntrySpreadsheetId: '1L2c0E5HqsbNhjN-5P81iZVXETtQ4Jwt-CmqslPCLtuk',
  teamEntrySheet: 'Webエントリー2027',
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
    if (body.action === 'teamEntry') return json_({ok: true, entry: saveTeamEntry_(body.data)});
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

function saveTeamEntry_(data) {
  if (!data || !data.teamName || !Array.isArray(data.players)) throw new Error('チーム情報が正しくありません。');
  const players = data.players.filter(player => player && String(player.mjName || '').trim());
  if (players.length < 6 || players.length > 10) throw new Error('選手は6名以上10名以下で登録してください。');
  if (!data.director || !data.message) throw new Error('監督と意気込みは必須です。');
  const book = SpreadsheetApp.openById(SCORE_API.teamEntrySpreadsheetId);
  let sheet = book.getSheetByName(SCORE_API.teamEntrySheet);
  const headers = ['受付日時','引継ぎ元チーム','チーム名','チームXアカウント','チームX ID'];
  for (let i = 1; i <= 10; i++) headers.push('選手' + i + ' MJ','選手' + i + ' Xアカウント','選手' + i + ' X ID');
  headers.push('監督','副監督','意気込み');
  if (!sheet) {
    sheet = book.insertSheet(SCORE_API.teamEntrySheet);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  const padded = players.slice(0, 10);
  while (padded.length < 10) padded.push({mjName: '', xName: '', xId: ''});
  const values = [
    Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss'),
    text_(data.sourceTeam), text_(data.teamName), text_(data.teamXName), text_(data.teamXId),
    ...padded.flatMap(player => [text_(player.mjName), text_(player.xName), text_(player.xId)]),
    text_(data.director), text_(data.deputy), text_(data.message)
  ];
  sheet.appendRow(values);
  return {teamName: text_(data.teamName), acceptedAt: values[0]};
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
