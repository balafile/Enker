/**
 * Wisepurse — Google Apps Script backend.
 *
 * SETUP (one time):
 * 1. Open your Google Sheet → Extensions → Apps Script.
 * 2. Delete anything in Code.gs and paste this whole file in.
 * 3. Run the "setupSheets" function once (▶ button, choose setupSheets from the
 *    dropdown) — it creates the Users / Expenses / Sessions tabs with headers.
 *    The first run will ask you to authorize the script; that's expected.
 * 4. Deploy → New deployment → type "Web app".
 *      - Execute as: Me
 *      - Who has access: Anyone
 * 5. Copy the "Web app URL" it gives you (ends in /exec) into js/config.js
 *    as APPS_SCRIPT_URL in your website's files.
 *
 * That's it — no Google Cloud Console, no service account.
 */

const USERS_SHEET = 'Users';       // ID | Name | PasswordHash | Salt | CreatedAt
const EXPENSES_SHEET = 'Expenses'; // ID | UserID | Date | Category | Description | PaymentMethod | Amount | Type | Status | CreatedAt
const SESSIONS_SHEET = 'Sessions'; // Token | UserID | Name | CreatedAt | ExpiresAt
const SESSION_DAYS = 7;
const MIN_PASSWORD_LENGTH = 6;

/* ------------------------------------------------------------------ */
/* One-time setup                                                      */
/* ------------------------------------------------------------------ */
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, USERS_SHEET, ['ID', 'Name', 'PasswordHash', 'Salt', 'CreatedAt']);
  ensureSheet_(ss, EXPENSES_SHEET, [
    'ID', 'UserID', 'Date', 'Category', 'Description', 'PaymentMethod', 'Amount', 'Type', 'Status', 'CreatedAt',
  ]);
  ensureSheet_(ss, SESSIONS_SHEET, ['Token', 'UserID', 'Name', 'CreatedAt', 'ExpiresAt']);
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
}

/* ------------------------------------------------------------------ */
/* HTTP entry points                                                    */
/* ------------------------------------------------------------------ */
function doGet(e) {
  try {
    const action = (e.parameter.action || '').trim();
    if (action === 'list') return listExpenses_(e.parameter.token);
    if (action === 'ping') return jsonOut_({ success: true, message: 'Wisepurse backend is running.' });
    return jsonOut_({ success: false, message: 'Unknown action.' });
  } catch (err) {
    return jsonOut_({ success: false, message: err.message || 'Server error.' });
  }
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut_({ success: false, message: 'Invalid request body.' });
  }

  const action = body.action;
  try {
    switch (action) {
      case 'signup':
        return signup_(body.name, body.password);
      case 'login':
        return login_(body.name, body.password);
      case 'logout':
        return logout_(body.token);
      case 'add':
        return addExpense_(body);
      case 'update':
        return updateExpense_(body);
      case 'delete':
        return deleteExpense_(body.token, body.id);
      default:
        return jsonOut_({ success: false, message: 'Unknown action.' });
    }
  } catch (err) {
    return jsonOut_({ success: false, message: err.message || 'Server error.' });
  }
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ------------------------------------------------------------------ */
/* Auth                                                                 */
/* ------------------------------------------------------------------ */
function signup_(name, password) {
  name = (name || '').trim();
  if (!name || !password) return jsonOut_({ success: false, message: 'Name and password are required.' });
  if (password.length < MIN_PASSWORD_LENGTH) {
    return jsonOut_({ success: false, message: 'Password must be more than 5 characters.' });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet_(USERS_SHEET);
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][1]).trim().toLowerCase() === name.toLowerCase()) {
        return jsonOut_({ success: false, message: 'An account with this name already exists. Try logging in instead.' });
      }
    }
    const id = Utilities.getUuid();
    const salt = Utilities.getUuid();
    const hash = hashPassword_(password, salt);
    sheet.appendRow([id, name, hash, salt, new Date().toISOString()]);

    const token = createSession_(id, name);
    return jsonOut_({ success: true, token, user: { id, name } });
  } finally {
    lock.releaseLock();
  }
}

function login_(name, password) {
  name = (name || '').trim();
  if (!name || !password) return jsonOut_({ success: false, message: 'Name and password are required.' });

  const sheet = getSheet_(USERS_SHEET);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][1]).trim().toLowerCase() === name.toLowerCase()) {
      const [id, storedName, storedHash, salt] = rows[i];
      const hash = hashPassword_(password, salt);
      if (hash !== storedHash) {
        return jsonOut_({ success: false, message: 'Incorrect password. Please try again.' });
      }
      const token = createSession_(id, storedName);
      return jsonOut_({ success: true, token, user: { id, name: storedName } });
    }
  }
  return jsonOut_({ success: false, message: "We couldn't find that account. Check the name or sign up instead." });
}

function logout_(token) {
  const sheet = getSheet_(SESSIONS_SHEET);
  const rows = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (rows[i][0] === token) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
  return jsonOut_({ success: true });
}

function hashPassword_(password, salt) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + '::' + salt);
  return digest.map((b) => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

function createSession_(userId, name) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet_(SESSIONS_SHEET);
    const token = Utilities.getUuid();
    const now = new Date();
    const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    sheet.appendRow([token, userId, name, now.toISOString(), expires.toISOString()]);
    return token;
  } finally {
    lock.releaseLock();
  }
}

// Returns { id, name } for a valid, unexpired token, or null.
function validateToken_(token) {
  if (!token) return null;
  const sheet = getSheet_(SESSIONS_SHEET);
  const rows = sheet.getDataRange().getValues();
  const now = new Date();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === token) {
      const expires = new Date(rows[i][4]);
      if (expires < now) return null;
      return { id: rows[i][1], name: rows[i][2] };
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Expenses                                                             */
/* ------------------------------------------------------------------ */
function listExpenses_(token) {
  const user = validateToken_(token);
  if (!user) return jsonOut_({ success: false, message: 'Session expired. Please log in again.' });

  const sheet = getSheet_(EXPENSES_SHEET);
  const rows = sheet.getDataRange().getValues();
  const expenses = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] === user.id) expenses.push(rowToExpense_(rows[i]));
  }
  return jsonOut_({ success: true, expenses });
}

function addExpense_(body) {
  const user = validateToken_(body.token);
  if (!user) return jsonOut_({ success: false, message: 'Session expired. Please log in again.' });
  if (!body.date || !body.category || body.amount === undefined || !body.type) {
    return jsonOut_({ success: false, message: 'Please fill in date, category, amount and type.' });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet_(EXPENSES_SHEET);
    const id = Utilities.getUuid();
    const row = [
      id, user.id, body.date, body.category, body.description || '', body.paymentMethod || '',
      Number(body.amount), body.type, body.status || 'Completed', new Date().toISOString(),
    ];
    sheet.appendRow(row);
    return jsonOut_({ success: true, expense: rowToExpense_(row) });
  } finally {
    lock.releaseLock();
  }
}

function updateExpense_(body) {
  const user = validateToken_(body.token);
  if (!user) return jsonOut_({ success: false, message: 'Session expired. Please log in again.' });
  if (!body.id) return jsonOut_({ success: false, message: 'Missing expense id.' });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet_(EXPENSES_SHEET);
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === body.id && rows[i][1] === user.id) {
        const existing = rows[i];
        const updated = [
          body.id, user.id,
          body.date !== undefined ? body.date : existing[2],
          body.category !== undefined ? body.category : existing[3],
          body.description !== undefined ? body.description : existing[4],
          body.paymentMethod !== undefined ? body.paymentMethod : existing[5],
          body.amount !== undefined ? Number(body.amount) : existing[6],
          body.type !== undefined ? body.type : existing[7],
          body.status !== undefined ? body.status : existing[8],
          existing[9],
        ];
        sheet.getRange(i + 1, 1, 1, updated.length).setValues([updated]);
        return jsonOut_({ success: true, expense: rowToExpense_(updated) });
      }
    }
    return jsonOut_({ success: false, message: 'Expense not found.' });
  } finally {
    lock.releaseLock();
  }
}

function deleteExpense_(token, id) {
  const user = validateToken_(token);
  if (!user) return jsonOut_({ success: false, message: 'Session expired. Please log in again.' });
  if (!id) return jsonOut_({ success: false, message: 'Missing expense id.' });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet_(EXPENSES_SHEET);
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === id && rows[i][1] === user.id) {
        sheet.deleteRow(i + 1);
        return jsonOut_({ success: true, id });
      }
    }
    return jsonOut_({ success: false, message: 'Expense not found.' });
  } finally {
    lock.releaseLock();
  }
}

function rowToExpense_(row) {
  return {
    id: row[0],
    userId: row[1],
    date: row[2] instanceof Date ? Utilities.formatDate(row[2], Session.getScriptTimeZone(), 'yyyy-MM-dd') : row[2],
    category: row[3],
    description: row[4] || '',
    paymentMethod: row[5] || '',
    amount: parseFloat(row[6] || 0),
    type: row[7],
    status: row[8] || 'Completed',
    createdAt: row[9],
  };
}

function getSheet_(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error(`Sheet "${name}" is missing. Run setupSheets() once from the Apps Script editor.`);
  return sheet;
}
