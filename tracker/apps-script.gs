// ============================================================
//  ADZ Solutions — Bid Tracker
//  apps-script.gs
//
//  PASTE THIS ENTIRE FILE into script.google.com
//  Then: Deploy → New Deployment → Web App
//        Execute as: Me
//        Who has access: Anyone
//  Copy the deployment URL into tracker.js → APPS_SCRIPT_URL
// ============================================================

// ── CONFIGURATION ──────────────────────────────────────────
const SHEET_NAME     = 'Bids';
const ALLOWED_DOMAIN = 'adzsolutionsgroup.com';

// Column order in the Google Sheet
const COLUMNS = [
  'id','title','county','category','bidNum',
  'deadline','value','status','assigned',
  'contact','link','notes','createdAt'
];

// ── ENTRY POINT ─────────────────────────────────────────────
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const user = verifyCredential(body.credential);   // throws if invalid

    switch (body.action) {
      case 'getBids':    return respond(getBids());
      case 'addBid':     return respond(addBid(body.bid, user.email));
      case 'updateBid':  return respond(updateBid(body.bid));
      case 'deleteBid':  return respond(deleteBid(body.id));
      default:           return respondError('Unknown action');
    }
  } catch (err) {
    return respondError(err.message || 'Server error');
  }
}

// Also handle GET for connectivity checks
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ADZ Bid Tracker API online' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── AUTH ─────────────────────────────────────────────────────
// Verifies the Google ID token sent from the frontend.
// Uses Google's tokeninfo endpoint — no secret keys needed.
function verifyCredential(credential) {
  if (!credential) throw new Error('No credential provided');

  const url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + credential;
  const res  = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const data = JSON.parse(res.getContentText());

  if (data.error_description) throw new Error('Invalid token: ' + data.error_description);

  const email  = data.email || '';
  const domain = email.split('@')[1] || '';

  if (domain !== ALLOWED_DOMAIN) {
    throw new Error('Access denied: ' + email + ' is not an @' + ALLOWED_DOMAIN + ' account');
  }

  return { email, name: data.name };
}

// ── SHEET HELPERS ────────────────────────────────────────────
function getSheet() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let   sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    // First run: create the sheet with headers
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(COLUMNS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, COLUMNS.length)
         .setBackground('#0f1923')
         .setFontColor('#ffffff')
         .setFontWeight('bold');
  }
  return sheet;
}

function rowToObj(row) {
  const obj = {};
  COLUMNS.forEach((col, i) => obj[col] = row[i] || '');
  return obj;
}

function objToRow(bid) {
  return COLUMNS.map(col => bid[col] || '');
}

// ── CRUD ─────────────────────────────────────────────────────
function getBids() {
  const sheet  = getSheet();
  const data   = sheet.getDataRange().getValues();
  if (data.length <= 1) return { bids: [] };  // header only

  const bids = data.slice(1)                   // skip header
    .filter(row => row[0])                      // skip blank rows
    .map(rowToObj)
    .reverse();                                 // newest first

  return { bids };
}

function addBid(bid, addedBy) {
  const sheet = getSheet();
  bid.createdAt = new Date().toISOString();
  bid.addedBy   = addedBy;
  sheet.appendRow(objToRow(bid));
  return { success: true, id: bid.id };
}

function updateBid(bid) {
  const sheet  = getSheet();
  const data   = sheet.getDataRange().getValues();
  const idCol  = COLUMNS.indexOf('id');

  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === bid.id) {
      // Preserve original createdAt
      bid.createdAt = data[i][COLUMNS.indexOf('createdAt')] || '';
      const row = objToRow(bid);
      sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return { success: true };
    }
  }
  throw new Error('Bid not found: ' + bid.id);
}

function deleteBid(id) {
  const sheet  = getSheet();
  const data   = sheet.getDataRange().getValues();
  const idCol  = COLUMNS.indexOf('id');

  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === id) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  throw new Error('Bid not found: ' + id);
}

// ── RESPONSE HELPERS ─────────────────────────────────────────
function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function respondError(msg) {
  return ContentService
    .createTextOutput(JSON.stringify({ error: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}