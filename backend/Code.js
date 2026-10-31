/**
 * Google Apps Script Core JSON API Backend for MangaHub Management System
 * Connected to Google Sheet: 1u3bKrBok0dwhgT_m7FHV_fhXX5mlspitWFiWv3g4B7A
 */

const SPREADSHEET_ID = '1u3bKrBok0dwhgT_m7FHV_fhXX5mlspitWFiWv3g4B7A';
const SHEET_NAME = 'MangaList';
const QUEUE_SHEET_NAME = 'WorkQueue';
const TEAM_SHEET_NAME = 'TeamMembers';
const BUDGET_PAYEE_SHEET_NAME = 'BudgetPayees';
const BUDGET_TRANSACTION_SHEET_NAME = 'BudgetTransactions';
const MANGA_SALES_SHEET_NAME = 'MangaSales';
const WEBSITE_SHEET_NAME = 'Websites';
const ACCESS_PASSCODE = '720102';
const RAW_TRACKER_SHEET_NAME = 'RawTracker';

// --- TELEGRAM CONFIGURATION ---
const TELEGRAM_BOT_TOKEN = '7836927758:AAHpsoCToMUxoeAzo5UMtMum3Ix5rIO_VOc';
const TELEGRAM_CHAT_ID = '-1003994957418';

// --- AUTO UPDATE CONFIGURATION ---
const AUTO_UPDATE_API_URL = 'https://nonstoptoon.pages.dev/api/autoupdate';
const AUTO_UPDATE_SECRET = 'ADOBE445@CHIM9987';

/**
 * Create a standardized JSON response for GAS Web App
 */
function createJsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * GET Handler (Health check & read-only queries)
 */
function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    const action = params.action || 'HEALTH';

    if (action === 'HEALTH') {
      return createJsonResponse({
        status: 'success',
        data: {
          service: 'MangaHub Core GAS API',
          version: '2.0.0',
          spreadsheetId: SPREADSHEET_ID,
          timestamp: new Date().toISOString()
        }
      });
    }

    if (params.passcode !== ACCESS_PASSCODE) {
      return createJsonResponse({ status: 'error', message: 'รหัสผ่านไม่ถูกต้อง (Unauthorized)' });
    }

    if (action === 'GET_DASHBOARD_DATA') {
      return createJsonResponse({ status: 'success', data: getDashboardData(params.forceRefresh === 'true') });
    }

    return createJsonResponse({ status: 'error', message: 'Unknown GET action: ' + action });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

/**
 * POST Handler (Handles both Frontend JSON API and Telegram Webhook)
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ status: 'error', message: 'Empty request body' });
    }

    const contents = JSON.parse(e.postData.contents);

    // 1. Check if this is a Telegram Bot Webhook update
    if (contents.message) {
      const chatId = contents.message.chat.id;
      const text = contents.message.text;

      if (text && text.startsWith('/')) {
        const commandParts = text.split(' ');
        const command = commandParts[0].toLowerCase().split('@')[0];
        const args = commandParts.slice(1);
        handleTelegramCommand(chatId, command, args);
      }
      return createJsonResponse({ ok: true });
    }

    // 2. Frontend JSON API Dispatcher
    const { action, payload = {}, passcode } = contents;

    if (!action) {
      return createJsonResponse({ status: 'error', message: 'Missing action field' });
    }

    // Allow passcode verification endpoint without prior auth
    if (action === 'VERIFY_PASSCODE') {
      const codeToVerify = payload.passcode !== undefined ? payload.passcode : passcode;
      const isValid = verifyPasscode(String(codeToVerify || '').trim());
      return createJsonResponse({
        status: 'success',
        data: { valid: isValid }
      });
    }

    // Verify passcode on every API call
    if (String(passcode || '').trim() !== ACCESS_PASSCODE) {
      return createJsonResponse({
        status: 'error',
        code: 'UNAUTHORIZED',
        message: 'รหัสผ่านเข้าใช้งานไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่'
      });
    }

    let result;

    switch (action) {
      // --- INIT / DASHBOARD ---
      case 'INIT_SHEETS':
        result = initializeAllSheets();
        break;
      case 'GET_DASHBOARD_DATA':
        result = getDashboardData(Boolean(payload.forceRefresh), payload.month, payload.year);
        break;
      case 'GET_ALL_DATA':
        result = getAllData();
        break;

      // --- MANGA CRUD ---
      case 'GET_MANGA_LIST':
        if (payload.forceRefresh) invalidateCache('mangaList');
        result = getMangaList();
        break;
      case 'ADD_MANGA':
        result = addManga(payload);
        break;
      case 'UPDATE_MANGA':
        result = updateManga(payload.id, payload.data);
        break;
      case 'DELETE_MANGA':
        result = deleteManga(payload.id);
        break;

      // --- WORK QUEUE CRUD ---
      case 'GET_WORK_QUEUE':
        result = getWorkQueue(Boolean(payload.forceRefresh), payload.month, payload.year, Boolean(payload.includeIncomplete));
        break;
      case 'ADD_QUEUE':
        result = addQueue(payload);
        break;
      case 'UPDATE_QUEUE_STEP':
        result = updateQueueStep(
          payload.queueId,
          payload.step,
          payload.status,
          payload.assignee,
          payload.link,
          payload.note
        );
        break;
      case 'BULK_UPDATE_QUEUE_STEP':
        result = bulkUpdateQueueStep(
          payload.queueIds,
          payload.step,
          payload.status,
          payload.assignee
        );
        break;
      case 'UPDATE_FULL_QUEUE_ITEM':
        result = updateFullQueueItem(payload.queueId, payload.updateData);
        break;
      case 'DELETE_QUEUE_ITEM':
        result = deleteQueueItem(payload.id);
        break;
      case 'CHECK_QUEUE_LOCK':
        result = checkQueueLock(payload.queueId);
        break;

      // --- TEAM CRUD ---
      case 'GET_TEAM_MEMBERS':
        if (payload.forceRefresh) invalidateCache('teamList');
        result = getTeamMembers();
        break;
      case 'ADD_TEAM_MEMBER':
        result = addTeamMember(payload);
        break;
      case 'UPDATE_TEAM_MEMBER':
        result = updateTeamMember(payload.id, payload.data);
        break;
      case 'DELETE_TEAM_MEMBER':
        result = deleteTeamMember(payload.id);
        break;

      // --- BUDGET & ACCOUNTING CRUD ---
      case 'GET_BUDGET_DATA':
        result = getBudgetData();
        break;
      case 'GET_BUDGET_PAYEES':
        result = getBudgetPayees();
        break;
      case 'ADD_BUDGET_PAYEE':
        result = addBudgetPayee(payload);
        break;
      case 'UPDATE_BUDGET_PAYEE':
        result = updateBudgetPayee(payload.id, payload.data);
        break;
      case 'DELETE_BUDGET_PAYEE':
        result = deleteBudgetPayee(payload.id);
        break;
      case 'GET_BUDGET_TRANSACTIONS':
        result = getBudgetTransactions();
        break;
      case 'ADD_BUDGET_TRANSACTION':
        result = addBudgetTransaction(payload);
        break;
      case 'DELETE_BUDGET_TRANSACTION':
        result = deleteBudgetTransaction(payload.id);
        break;

      // --- FINANCIALS (MANGA SALES) CRUD ---
      case 'GET_FINANCIAL_DATA':
        result = getFinancialInitData();
        break;
      case 'GET_MANGA_SALES':
        result = getMangaSales();
        break;
      case 'ADD_MANGA_SALE':
        result = addMangaSale(payload);
        break;
      case 'BULK_ADD_MANGA_SALES':
        result = bulkAddMangaSales(payload.sales);
        break;
      case 'DELETE_MANGA_SALE':
        result = deleteMangaSale(payload.index, payload.sale);
        break;
      case 'COUNT_FINISHED_CHAPTERS':
        result = countFinishedChapters(payload.mangaId, payload.year, payload.month);
        break;

      // --- SYSTEM TRIGGERS & AUTOMATION ---
      case 'CREATE_AUTO_QUEUE_TRIGGER':
        result = { message: createAutoQueueTrigger() };
        break;
      case 'CREATE_MOVE_PENDING_TRIGGER':
        result = { message: createMovePendingTrigger() };
        break;
      case 'MOVE_PENDING_QUEUE':
        result = { message: movePendingQueueToCurrentMonth(), queue: getWorkQueue(true) };
        break;
      case 'PROCESS_AUTO_QUEUE':
        processAutoQueue();
        result = { message: 'รันระบบคิวงานอัตโนมัติเรียบร้อยแล้ว', queue: getWorkQueue(true) };
        break;

      // --- RAW TRACKER (ต้นฉบับ UPDATE) ---
      case 'GET_RAW_TRACKER_LIST':
        result = getRawTrackerList();
        break;
      case 'ADD_RAW_TRACKER':
        result = addRawTracker(payload);
        break;
      case 'UPDATE_RAW_TRACKER':
        result = updateRawTracker(payload.id, payload.data);
        break;
      case 'DELETE_RAW_TRACKER':
        result = deleteRawTracker(payload.id);
        break;
      case 'SCRAPE_RAW_URL':
        result = scrapeRawUrl(payload.url, payload.pattern);
        break;
      case 'CHECK_ALL_RAW_TRACKERS':
        result = checkAllRawTrackers(Boolean(payload.notifyTelegram));
        break;
      case 'IMPORT_FROM_MANGA_LIST':
        result = importTrackersFromMangaList();
        break;
      case 'SETUP_HOURLY_TRACKER_TRIGGER':
        result = setupHourlyTrackerTrigger();
        break;

      default:
        return createJsonResponse({ status: 'error', message: 'Unknown action: ' + action });
    }

    if (result && result.error) {
      return createJsonResponse({ status: 'error', message: result.error });
    }

    return createJsonResponse({ status: 'success', data: result });
  } catch (err) {
    console.error('Error in doPost:', err);
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

function initializeAllSheets() {
  const sheetNames = [
    SHEET_NAME,
    QUEUE_SHEET_NAME,
    TEAM_SHEET_NAME,
    BUDGET_PAYEE_SHEET_NAME,
    BUDGET_TRANSACTION_SHEET_NAME,
    MANGA_SALES_SHEET_NAME,
    WEBSITE_SHEET_NAME
  ];
  sheetNames.forEach(name => getSheet(name));
  return { initialized: sheetNames };
}

/**
 * Sends an HTTP POST request to update manga episode count on the website.
 * @param {string} mangaSlug The slug identifier for the manga (titleId)
 * @param {number} episodeNumber The episode number to update
 */
function updateMangaEpisodeOnWebsite(mangaSlug, episodeNumber) {
  console.log(`Triggered updateMangaEpisodeOnWebsite for slug: ${mangaSlug}, episode: ${episodeNumber}`);
  
  if (!AUTO_UPDATE_API_URL || AUTO_UPDATE_API_URL === 'YOUR_API_URL_HERE') {
    console.warn('AUTO_UPDATE_API_URL is not configured. Skipping website update.');
    return;
  }

  const payload = {
    "title": mangaSlug,
    "episode": episodeNumber,
    "secret": AUTO_UPDATE_SECRET
  };

  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true
  };

  try {
    const response = UrlFetchApp.fetch(AUTO_UPDATE_API_URL, options);
    const statusCode = response.getResponseCode();
    const content = response.getContentText();
    
    if (statusCode >= 200 && statusCode < 300) {
      console.log(`Successfully updated ${mangaSlug} to episode ${episodeNumber}. Response: ${content}`);
    } else {
      console.error(`Failed to update ${mangaSlug}. Status: ${statusCode}. Response: ${content}`);
    }
  } catch (e) {
    console.error(`Error updating manga episode: ${e.toString()}`);
  }
}

// Spreadsheet Singleton & Cache Helper Functions
let _globalSpreadsheetInstance = null;
function getSpreadsheet() {
  if (!_globalSpreadsheetInstance) {
    _globalSpreadsheetInstance = SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return _globalSpreadsheetInstance;
}

function getCachedData(key, fetchFunction, ttlSeconds = 600) {
  const cache = CacheService.getScriptCache();
  try {
    const metaStr = cache.get(key + '_meta');
    if (metaStr) {
      const numChunks = parseInt(metaStr, 10);
      const chunkKeys = [];
      for (let i = 0; i < numChunks; i++) chunkKeys.push(key + '_' + i);
      const chunksMap = cache.getAll(chunkKeys);
      let combined = '';
      let isComplete = true;
      for (let i = 0; i < numChunks; i++) {
        const part = chunksMap[key + '_' + i];
        if (part === undefined || part === null) {
          isComplete = false;
          break;
        }
        combined += part;
      }
      if (isComplete && combined) {
        return JSON.parse(combined);
      }
    } else {
      const single = cache.get(key);
      if (single) {
        return JSON.parse(single);
      }
    }
  } catch (e) {
    console.warn('Cache read error (' + key + '):', e);
  }

  // Cache Miss: Run fetchFunction
  const result = fetchFunction();
  try {
    const serialized = JSON.stringify(result);
    const CHUNK_SIZE = 90000;
    if (serialized.length <= CHUNK_SIZE) {
      cache.put(key, serialized, ttlSeconds);
    } else {
      const numChunks = Math.ceil(serialized.length / CHUNK_SIZE);
      const chunkMap = {};
      chunkMap[key + '_meta'] = String(numChunks);
      for (let i = 0; i < numChunks; i++) {
        chunkMap[key + '_' + i] = serialized.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      }
      cache.putAll(chunkMap, ttlSeconds);
    }
  } catch (e) {
    console.error('Cache write error (' + key + '):', e);
  }
  return result;
}

function invalidateCache(keys) {
  const cache = CacheService.getScriptCache();
  const keysArray = Array.isArray(keys) ? keys : [keys];
  const toRemove = [];
  keysArray.forEach(k => {
    toRemove.push(k);
    toRemove.push(k + '_meta');
    for (let i = 0; i < 20; i++) {
      toRemove.push(k + '_' + i);
    }
  });
  cache.removeAll(toRemove);
}

function ensureSheetHeaders(sheet, name) {
  if (name === SHEET_NAME) {
    const lastCol = sheet.getLastColumn();
    if (lastCol > 0) {
      const ensureCol = (colName, defaultVal) => {
        const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => h.toString().toLowerCase().trim());
        if (currentHeaders.indexOf(colName.toLowerCase()) === -1) {
          const newCol = sheet.getLastColumn() + 1;
          sheet.getRange(1, newCol).setValue(colName);
          if (defaultVal !== undefined && sheet.getLastRow() > 1) {
            sheet.getRange(2, newCol, sheet.getLastRow() - 1, 1).setValue(defaultVal);
          }
        }
      };
      ensureCol('NeedsExtract', true);
      ensureCol('ReleaseDay', 'None');
      ensureCol('CostPerChapter', 0);
      ensureCol('LockedTranslator', '');
      ensureCol('NotifyOnAdd', false);
      ensureCol('Slug', '');
      ensureCol('IsUrgent', false);
    }
  }

  if (name === QUEUE_SHEET_NAME) {
    const lastCol = sheet.getLastColumn();
    if (lastCol > 0) {
      const currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => h.toString().toLowerCase().trim());
      const required = ['poststatus', 'postername', 'posttime', 'isediting', 'editingby', 'editingtime'];
      const displayMap = {
        'poststatus': 'PostStatus',
        'postername': 'PosterName',
        'posttime': 'PostTime',
        'isediting': 'IsEditing',
        'editingby': 'EditingBy',
        'editingtime': 'EditingTime'
      };
      required.forEach(req => {
        if (currentHeaders.indexOf(req) === -1) {
          const newCol = sheet.getLastColumn() + 1;
          sheet.getRange(1, newCol).setValue(displayMap[req] || (req.charAt(0).toUpperCase() + req.slice(1)));
        }
      });
    }
  }
}

function getSheet(name = SHEET_NAME) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === SHEET_NAME) {
      sheet.appendRow([
        'MangaID', 'MangaName', 'OriginalName', 'OriginalUrl', 'Status',
        'LastChapter', 'LastUpdated', 'NeedsExtract', 'ReleaseDay',
        'CostPerChapter', 'LockedTranslator', 'NotifyOnAdd', 'Slug', 'IsUrgent'
      ]);
      sheet.getRange(1, 1, 1, 14).setFontWeight('bold').setBackground('#4f46e5').setFontColor('#ffffff');
    } else if (name === QUEUE_SHEET_NAME) {
      const headers = [
        'QueueID', 'CreatedAt', 'MangaID', 'Chapter', 
        'UploadStatus', 'UploaderName', 'UploadTime',
        'ExtractStatus', 'ExtractorName', 'ExtractTime',
        'TranslateStatus', 'TranslatorName', 'TranslateTime',
        'TypesetStatus', 'TypesetterName', 'TypesetTime',
        'PublishStatus', 'PublisherName', 'PublishTime', 
        'PostStatus', 'PosterName', 'PostTime',
        'WorkLink', 'Note',
        'IsEditing', 'EditingBy', 'EditingTime'
      ];
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#3730a3').setFontColor('#ffffff');
    } else if (name === TEAM_SHEET_NAME) {
      const headers = ['MemberID', 'Name', 'Role', 'Status'];
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#10b981').setFontColor('#ffffff');
      sheet.appendRow(['T1', 'ตัวอย่าง สมาชิก1', 'Translator', 'Active']);
    } else if (name === BUDGET_PAYEE_SHEET_NAME) {
      const headers = ['PayeeID', 'Name', 'TaxID', 'BankAccount', 'BankName', 'Note'];
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#0ea5e9').setFontColor('#ffffff');
    } else if (name === BUDGET_TRANSACTION_SHEET_NAME) {
      const headers = ['TransactionID', 'Date', 'Type', 'Amount', 'Category', 'Reference', 'Note'];
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f59e0b').setFontColor('#ffffff');
    } else if (name === MANGA_SALES_SHEET_NAME) {
      const headers = [
        'Date', 'Month', 'SeriesChapterID', 'SeriesName', 'ChaptersCount', 
        'Category', 'Website', 'Page', 'TargetPerChapter', 'TotalTarget', 
        'CostPerChapter', 'TotalCost', 'Revenue', 'Profit'
      ];
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#6366f1').setFontColor('#ffffff');
    } else if (name === WEBSITE_SHEET_NAME) {
      const headers = ['WebsiteName'];
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#6366f1').setFontColor('#ffffff');
      const defaults = [
        ['ReadRealm แปลจนเมื่อย'],
        ['ReadRealm น้องแมวส้ม'],
        ['ReadRealm แปลแล้วแปลอีก'],
        ['ReadRealm แปลจนแขนหัก'],
        ['Other']
      ];
      sheet.getRange(2, 1, defaults.length, 1).setValues(defaults);
    } else if (name === RAW_TRACKER_SHEET_NAME) {
      const headers = [
        'TrackerID', 'MangaID', 'MangaName', 'Url', 'Pattern',
        'LastRawText', 'LastRawCount', 'Status', 'LastChecked', 'UpdatedAt', 'AutoCheck'
      ];
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#ec4899').setFontColor('#ffffff');
    }
    ensureSheetHeaders(sheet, name);
  }
  return sheet;
}

/**
 * READ: ดึงข้อมูลและแปลงเป็น Object ตามหัวตาราง
 */
function getMangaList() {
  try {
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    const rawHeaders = data.shift();
    const headers = rawHeaders.map(h => h.toString().toLowerCase().trim());
    
    return data.map(row => {
      let obj = {};
      headers.forEach((header, i) => {
        let val = row[i];
        if (val instanceof Date) {
          val = val.toISOString();
        }
        obj[header] = val;
      });
      return obj;
    }).filter(item => item.manganame);
  } catch (err) {
    console.error('getMangaList Error:', err);
    return [];
  }
}

/**
 * Helper: หา ID ถัดไป
 */
function getNextId() {
  try {
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return 1;
    
    let maxId = 0;
    for (let i = 1; i < data.length; i++) {
      const id = parseInt(data[i][0]);
      if (!isNaN(id) && id > maxId) maxId = id;
    }
    return maxId + 1;
  } catch (e) {
    return 1;
  }
}

/**
 * CREATE: บันทึกข้อมูลใหม่
 */
function addManga(manga) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = getSheet();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => h.toString().toLowerCase().trim());
    
    const id = getNextId();
    const timestamp = new Date();
    
    const newRow = headers.map(header => {
      if (header === 'mangaid') return id;
      if (header === 'manganame') return manga.manganame || '';
      if (header === 'originalname') return manga.originalname || '';
      if (header === 'originalurl') return manga.originalurl || '';
      if (header === 'status') return manga.status || 'Ongoing';
      if (header === 'lastchapter') return manga.lastchapter || '0';
      if (header === 'lastupdated') return timestamp;
      if (header === 'needsextract') return manga.needsextract !== undefined ? manga.needsextract : true;
      if (header === 'releaseday') return manga.releaseday || 'None';
      if (header === 'costperchapter') return manga.costperchapter || 0;
      if (header === 'lockedtranslator') return manga.lockedtranslator || '';
      if (header === 'notifyonadd') return manga.notifyonadd !== undefined ? manga.notifyonadd : false;
      if (header === 'slug') return manga.slug || '';
      if (header === 'isurgent') return manga.isurgent !== undefined ? manga.isurgent : false;
      return '';
    });

    sheet.appendRow(newRow);
    invalidateCache('mangaList');
    return {
      success: true,
      mangaId: id,
      list: getMangaList()
    };
  } catch (err) {
    return { error: 'Add Failed: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

function addTeamMember(member) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = getSheet(TEAM_SHEET_NAME);
    const id = 'T' + new Date().getTime();
    sheet.appendRow([id, member.name, member.role, member.status || 'Active']);
    invalidateCache('teamList');
    return getTeamMembers();
  } catch (err) {
    return { error: 'Add Member Failed: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

function deleteTeamMember(id) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = getSheet(TEAM_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0].toString() === id.toString()) {
        sheet.deleteRow(i + 1);
        invalidateCache('teamList');
        return getTeamMembers();
      }
    }
    return { error: 'Member not found' };
  } catch (err) {
    return { error: 'Delete Member Failed: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

function updateTeamMember(id, updatedMember) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = getSheet(TEAM_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => h.toString().toLowerCase().trim());
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0].toString() === id.toString()) {
        const rowNum = i + 1;
        headers.forEach((header, index) => {
          const colNum = index + 1;
          if (header === 'name') sheet.getRange(rowNum, colNum).setValue(updatedMember.name);
          if (header === 'role') sheet.getRange(rowNum, colNum).setValue(updatedMember.role);
          if (header === 'status') sheet.getRange(rowNum, colNum).setValue(updatedMember.status);
        });
        invalidateCache('teamList');
        return getTeamMembers();
      }
    }
    return { error: 'Member not found: ' + id };
  } catch (err) {
    return { error: 'Update Member Failed: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * UPDATE: แก้ไขข้อมูลมังงะ
 */
function updateManga(id, updatedManga) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => h.toString().toLowerCase().trim());
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0].toString() === id.toString()) {
        const rowNum = i + 1;
        headers.forEach((header, index) => {
          const colNum = index + 1;
          if (header === 'manganame') sheet.getRange(rowNum, colNum).setValue(updatedManga.manganame);
          if (header === 'originalname') sheet.getRange(rowNum, colNum).setValue(updatedManga.originalname);
          if (header === 'originalurl') sheet.getRange(rowNum, colNum).setValue(updatedManga.originalurl);
          if (header === 'status') sheet.getRange(rowNum, colNum).setValue(updatedManga.status);
          if (header === 'lastchapter') sheet.getRange(rowNum, colNum).setValue(updatedManga.lastchapter);
          if (header === 'lastupdated') sheet.getRange(rowNum, colNum).setValue(new Date());
          if (header === 'needsextract') sheet.getRange(rowNum, colNum).setValue(updatedManga.needsextract !== undefined ? updatedManga.needsextract : true);
          if (header === 'releaseday') sheet.getRange(rowNum, colNum).setValue(updatedManga.releaseday || 'None');
          if (header === 'costperchapter') sheet.getRange(rowNum, colNum).setValue(updatedManga.costperchapter || 0);
          if (header === 'lockedtranslator') sheet.getRange(rowNum, colNum).setValue(updatedManga.lockedtranslator || '');
          if (header === 'notifyonadd') sheet.getRange(rowNum, colNum).setValue(updatedManga.notifyonadd !== undefined ? updatedManga.notifyonadd : false);
          if (header === 'slug') sheet.getRange(rowNum, colNum).setValue(updatedManga.slug || '');
          if (header === 'isurgent') sheet.getRange(rowNum, colNum).setValue(updatedManga.isurgent !== undefined ? updatedManga.isurgent : false);
        });
        invalidateCache('mangaList');
        return getMangaList();
      }
    }
    return { error: 'ไม่พบข้อมูล ID: ' + id };
  } catch (err) {
    return { error: 'Update Failed: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * DELETE: ลบข้อมูลมังงะ
 */
function deleteManga(id) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0].toString() === id.toString()) {
        sheet.deleteRow(i + 1);
        invalidateCache('mangaList');
        return getMangaList();
      }
    }
    return { error: 'ไม่พบข้อมูลในการลบ' };
  } catch (err) {
    return { error: 'Delete Failed: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * QUEUE OPERATIONS (Direct Dynamic Query)
 */
function getWorkQueue(forceRefresh = false, month = 'all', year = 'all', includeIncomplete = false) {
  try {
    const sheet = getSheet(QUEUE_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    const headers = data.shift().map(h => h.toString().toLowerCase().trim());
    const mStr = month !== undefined && month !== null && month !== '' ? String(month) : 'all';
    const yStr = year !== undefined && year !== null && year !== '' ? String(year) : 'all';

    const results = [];
    for (let r = 0; r < data.length; r++) {
      const row = data[r];
      let obj = {};
      for (let i = 0; i < headers.length; i++) {
        let val = row[i];
        if (val instanceof Date) val = val.toISOString();
        obj[headers[i]] = val;
      }
      if (!obj.poststatus || String(obj.poststatus).trim() === '') obj.poststatus = 'รอเริ่ม';
      if (!obj.uploadstatus || String(obj.uploadstatus).trim() === '') obj.uploadstatus = 'รอเริ่ม';
      if (!obj.translatestatus || String(obj.translatestatus).trim() === '') obj.translatestatus = 'รอเริ่ม';
      if (!obj.typesetstatus || String(obj.typesetstatus).trim() === '') obj.typesetstatus = 'รอเริ่ม';
      if (!obj.publishstatus || String(obj.publishstatus).trim() === '') obj.publishstatus = 'รอเริ่ม';

      if (mStr === 'all' && yStr === 'all') {
        results.push(obj);
      } else {
        let d = null;
        const idNum = parseInt(obj.queueid);
        if (!isNaN(idNum) && idNum > 1000000000000 && idNum < 2500000000000) {
          d = new Date(idNum);
        } else if (obj.createdat) {
          d = new Date(obj.createdat);
        }
        if (!d || isNaN(d.getTime())) continue;
        const mMatch = mStr === 'all' || String(d.getMonth() + 1) === mStr;
        const yMatch = yStr === 'all' || String(d.getFullYear()) === yStr;
        if (mMatch && yMatch) {
          results.push(obj);
        }
      }
    }
    return results;
  } catch (err) {
    console.error('getWorkQueue Error:', err);
    return [];
  }
}

function addQueue(queueData) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = getSheet(QUEUE_SHEET_NAME);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => h.toString().toLowerCase().trim());
    
    const id = new Date().getTime(); 
    const now = new Date();
    const mangaList = getMangaList();
    const manga = mangaList.find(m => m.mangaid.toString() === queueData.mangaid.toString());
    
    const newRow = headers.map(header => {
      if (header === 'queueid') return id;
      if (header === 'createdat') return now;
      if (header === 'mangaid') return queueData.mangaid;
      if (header === 'chapter') return queueData.chapter;
      
      if (header === 'uploadstatus') return queueData.uploadstatus || 'รอเริ่ม';
      if (header === 'extractstatus') return queueData.extractstatus || 'รอเริ่ม';
      if (header === 'translatestatus') return queueData.translatestatus || 'รอเริ่ม';
      if (header === 'typesetstatus') return queueData.typesetstatus || 'รอเริ่ม';
      if (header === 'publishstatus') return queueData.publishstatus || 'รอเริ่ม';
      if (header === 'poststatus') return queueData.poststatus || 'รอเริ่ม';

      if (header === 'uploadername') return queueData.uploadername || '';
      if (header === 'extractorname') return queueData.extractorname || '';
      if (header === 'translatorname') {
        if (queueData.translatorname) return queueData.translatorname;
        if (manga && manga.lockedtranslator) return manga.lockedtranslator;
        return '';
      }
      if (header === 'typesettername') return queueData.typesettername || '';
      if (header === 'publishername') return queueData.publishername || '';
      if (header === 'postername') return queueData.postername || '';

      if (header === 'worklink') return queueData.worklink || '';
      if (header === 'note') return queueData.note || '';

      return '';
    });

    sheet.appendRow(newRow);
    syncMangaStatus(queueData.mangaid, queueData.chapter);
    
    try {
      if (manga && (manga.notifyonadd === true || manga.notifyonadd === 'true')) {
        let message = `🆕 <b>เพิ่มคิวงานใหม่! (Manual)</b>\n\nเรื่อง: <b>${manga.manganame}</b>\nตอนที่: ${queueData.chapter}\nสถานะ: เริ่มต้นเข้าระบบแล้ว`;
        if (queueData.worklink) {
          message += `\n🔗 <b>ลิงก์งาน:</b> ${queueData.worklink}`;
        }
        sendTelegramNotification(message);
      }
    } catch (e) {
      console.error('Error in addQueue notification:', e);
    }

    invalidateCache(['workQueue', 'mangaList']);
    return { success: true, queue: getWorkQueue(true), manga: getMangaList() };
  } catch (err) {
    return { error: 'Add Queue Failed: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

function updateQueueStep(queueId, step, status, assignee, link, note) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = getSheet(QUEUE_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => h.toString().toLowerCase().trim());
    
    const assigneeHeaders = {
      'upload': 'uploadername',
      'extract': 'extractorname',
      'translate': 'translatorname',
      'typeset': 'typesettername',
      'publish': 'publishername',
      'post': 'postername'
    };
    const assigneeHeader = assigneeHeaders[step.toLowerCase()] || (step.toLowerCase() + 'name');

    const statusCol = headers.indexOf(step.toLowerCase() + 'status') + 1;
    const nameCol = headers.indexOf(assigneeHeader) + 1;
    const timeCol = headers.indexOf(step.toLowerCase() + 'time') + 1;
    const linkCol = headers.indexOf('worklink') + 1;
    const noteCol = headers.indexOf('note') + 1;
    
    if (statusCol === 0) throw new Error('Step not found: ' + step);

    for (let i = 1; i < data.length; i++) {
      if (data[i][0].toString() === queueId.toString()) {
        const rowNum = i + 1;
        
        sheet.getRange(rowNum, statusCol).setValue(status);
        
        if (step.toLowerCase() === 'publish' && status === 'เสร็จแล้ว') {
          const postStatusCol = headers.indexOf('poststatus') + 1;
          if (postStatusCol > 0) {
            const currentPostStatus = data[i][postStatusCol - 1];
            if (!currentPostStatus || currentPostStatus.toString().trim() === '') {
              sheet.getRange(rowNum, postStatusCol).setValue('รอเริ่ม');
            }
          }
        }
        
        if (nameCol > 0 && assignee !== undefined) {
          sheet.getRange(rowNum, nameCol).setValue(assignee);
        }
        
        if (status === 'เสร็จแล้ว') {
          const oldStatus = data[i][statusCol - 1];
          if (oldStatus !== 'เสร็จแล้ว') {
            if (timeCol > 0) sheet.getRange(rowNum, timeCol).setValue(new Date());
            
            try {
              const mangaId = data[i][headers.indexOf('mangaid')];
              const chapter = data[i][headers.indexOf('chapter')];
              const mangaName = getMangaNameById(mangaId);
              const stepLabel = getStepLabel(step);
              
              let message = `✅ <b>งานเสร็จแล้ว!</b>\n\nเรื่อง: <b>${mangaName}</b>\nตอนที่: ${chapter}\nขั้นตอน: <b>${stepLabel}</b>\nโดย: ${assignee || 'ไม่ระบุ'}`;
              
              const existingLinks = data[i][linkCol - 1] || '';
              const finalLink = link || extractLinkForStep(existingLinks, step);
              
              if (finalLink) {
                message += `\n🔗 <b>ลิงก์งาน:</b> ${finalLink}`;
              }
              sendTelegramNotification(message);

              if (step.toLowerCase() === 'publish') {
                try {
                  const mangaList = getMangaList();
                  const manga = mangaList.find(m => m.mangaid.toString() === mangaId.toString());
                  if (manga && manga.slug) {
                    const range = parseChapterRange(chapter);
                    updateMangaEpisodeOnWebsite(manga.slug, range.end);
                  }
                } catch (aue) {
                  console.error('Error triggering auto-update in updateQueueStep:', aue);
                }
              }
            } catch (te) {
              console.error('Telegram notification error in updateQueueStep:', te);
            }
          }
        }
        
        if (link && linkCol > 0) {
          const currentLink = data[i][linkCol - 1] || '';
          const stepLabel = getStepLabel(step);
          let links = currentLink.toString().split('\n').filter(l => l.trim());
          links = links.filter(l => !l.startsWith('[' + stepLabel + ']'));
          if (link.trim()) {
            links.push('[' + stepLabel + '] ' + link.trim());
          }
          const newLink = links.join('\n');
          sheet.getRange(rowNum, linkCol).setValue(newLink);
        }
        
        if (note && noteCol > 0) {
          const currentNote = data[i][noteCol - 1] || '';
          const stepLabel = getStepLabel(step);
          const newNote = currentNote ? currentNote + '\n[' + stepLabel + '] ' + note : '[' + stepLabel + '] ' + note;
          sheet.getRange(rowNum, noteCol).setValue(newNote);
        }
        
        invalidateCache('workQueue');
        return { success: true, queue: getWorkQueue(true) };
      }
    }
    return { error: 'Queue ID not found' };
  } catch (err) {
    return { error: 'Update Step Failed: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

function bulkUpdateQueueStep(queueIds, step, status, assignee) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    if (!queueIds || !Array.isArray(queueIds) || queueIds.length === 0) {
      return { error: 'กรุณาเลือกรายการคิวงานที่ต้องการอัปเดต' };
    }
    if (!step) {
      return { error: 'ไม่พบขั้นตอนที่ต้องการอัปเดต' };
    }

    const sheet = getSheet(QUEUE_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return { error: 'ไม่มีข้อมูลคิวงานในระบบ' };
    }

    const headers = data[0].map(h => h.toString().toLowerCase().trim());
    const stepLower = step.toLowerCase().trim();

    const assigneeHeaders = {
      'upload': 'uploadername',
      'extract': 'extractorname',
      'translate': 'translatorname',
      'typeset': 'typesettername',
      'publish': 'publishername',
      'post': 'postername'
    };
    const assigneeHeader = assigneeHeaders[stepLower] || (stepLower + 'name');

    const statusColIndex = headers.indexOf(stepLower + 'status');
    const nameColIndex = headers.indexOf(assigneeHeader);
    const timeColIndex = headers.indexOf(stepLower + 'time');
    const mangaIdColIndex = headers.indexOf('mangaid');
    const chapterColIndex = headers.indexOf('chapter');
    const postStatusColIndex = headers.indexOf('poststatus');

    if (statusColIndex === -1) {
      return { error: 'ไม่พบคอลัมน์สำหรับขั้นตอน: ' + step };
    }

    const targetIds = new Set(queueIds.map(id => id.toString().trim()));
    const now = new Date();
    let updatedCount = 0;
    const finishedItems = [];
    const shouldUpdateAssignee = assignee !== undefined && assignee !== null && assignee !== '' && assignee !== '__KEEP__';

    for (let i = 1; i < data.length; i++) {
      const currentId = data[i][0].toString().trim();
      if (targetIds.has(currentId)) {
        const oldStatus = data[i][statusColIndex];

        data[i][statusColIndex] = status;

        if (stepLower === 'publish' && status === 'เสร็จแล้ว' && postStatusColIndex !== -1) {
          const currentPostVal = data[i][postStatusColIndex];
          if (!currentPostVal || currentPostVal.toString().trim() === '') {
            data[i][postStatusColIndex] = 'รอเริ่ม';
          }
        }

        if (shouldUpdateAssignee && nameColIndex !== -1) {
          data[i][nameColIndex] = assignee;
        }

        if (status === 'เสร็จแล้ว' && oldStatus !== 'เสร็จแล้ว') {
          if (timeColIndex !== -1) {
            data[i][timeColIndex] = now;
          }

          const mangaId = mangaIdColIndex !== -1 ? data[i][mangaIdColIndex] : '';
          const chapter = chapterColIndex !== -1 ? data[i][chapterColIndex] : '';
          const mangaName = getMangaNameById(mangaId);
          const currentAssignee = shouldUpdateAssignee
            ? assignee
            : (nameColIndex !== -1 ? data[i][nameColIndex] : '');

          finishedItems.push({
            queueId: currentId,
            mangaId: mangaId,
            mangaName: mangaName,
            chapter: chapter,
            assignee: currentAssignee
          });
        }

        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
      invalidateCache('workQueue');

      if (finishedItems.length > 0) {
        try {
          const stepLabel = getStepLabel(step);
          if (finishedItems.length === 1) {
            const item = finishedItems[0];
            let message = `✅ <b>งานเสร็จแล้ว!</b>\n\nเรื่อง: <b>${item.mangaName}</b>\nตอนที่: ${item.chapter}\nขั้นตอน: <b>${stepLabel}</b>\nโดย: ${item.assignee || 'ไม่ระบุ'}`;
            sendTelegramNotification(message);
          } else {
            let message = `✅ <b>อัปเดตงานเสร็จแล้ว (${finishedItems.length} ตอน)!</b>\nขั้นตอน: <b>${stepLabel}</b>\n\n`;
            const listText = finishedItems.slice(0, 15).map(it => `• <b>${it.mangaName}</b> ตอนที่ ${it.chapter}`).join('\n');
            message += listText;
            if (finishedItems.length > 15) {
              message += `\n...และอีก ${finishedItems.length - 15} ตอน`;
            }
            sendTelegramNotification(message);
          }

          if (stepLower === 'publish' || stepLower === 'post') {
            try {
              const mangaList = getMangaList();
              const maxChapters = {};
              finishedItems.forEach(item => {
                if (item.mangaId) {
                  const range = parseChapterRange(item.chapter);
                  if (!maxChapters[item.mangaId] || range.end > maxChapters[item.mangaId]) {
                    maxChapters[item.mangaId] = range.end;
                  }
                }
              });

              for (const mId in maxChapters) {
                const manga = mangaList.find(m => m.mangaid && m.mangaid.toString() === mId.toString());
                if (manga && manga.slug) {
                  updateMangaEpisodeOnWebsite(manga.slug, maxChapters[mId]);
                }
              }
            } catch (aue) {
              console.error('Error triggering auto-update in bulkUpdateQueueStep:', aue);
            }
          }
        } catch (te) {
          console.error('Telegram notification error in bulkUpdateQueueStep:', te);
        }
      }

      return { success: true, count: updatedCount, queue: getWorkQueue(true) };
    }

    return { error: 'ไม่พบรายการคิวงานที่ตรงกับที่เลือก' };
  } catch (err) {
    console.error('bulkUpdateQueueStep error:', err);
    return { error: 'Bulk Update Failed: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

function getStepLabel(step) {
  const labels = {
    'upload': 'อัป Raw',
    'extract': 'ดึงคำ',
    'translate': 'แปล',
    'typeset': 'ลงคำ',
    'publish': 'เผยแพร่',
    'post': 'โพสต์'
  };
  return labels[step.toLowerCase()] || step;
}

function parseChapterRange(chapterStr) {
  if (!chapterStr) return { start: 0, end: 0, count: 0 };
  const s = chapterStr.toString().trim();
  
  if (s.includes('-')) {
    const parts = s.split('-').map(p => parseFloat(p.trim()));
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      const start = Math.min(parts[0], parts[1]);
      const end = Math.max(parts[0], parts[1]);
      const count = end - start + 1;
      return { start, end, count: Math.max(0, count) };
    }
  }
  
  const val = parseFloat(s) || 0;
  return { start: val, end: val, count: 1 };
}

function syncMangaStatus(mangaId, chapter) {
  try {
    const sheet = getSheet(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => h.toString().toLowerCase().trim());
    const lastChapterIdx = headers.indexOf('lastchapter');
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0].toString() === mangaId.toString()) {
        const rowNum = i + 1;
        const currentChapter = parseFloat(lastChapterIdx !== -1 ? data[i][lastChapterIdx] : data[i][5]) || 0;
        
        const range = parseChapterRange(chapter);
        const newChapter = range.end;
        
        if (newChapter >= currentChapter) {
          headers.forEach((header, index) => {
            const colNum = index + 1;
            if (header === 'lastchapter') sheet.getRange(rowNum, colNum).setValue(newChapter);
            if (header === 'lastupdated') sheet.getRange(rowNum, colNum).setValue(new Date());
          });
        }
        break;
      }
    }
  } catch (e) {
    console.error('Sync Error:', e);
  }
}

function deleteQueueItem(id) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = getSheet(QUEUE_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0].toString() === id.toString()) {
        sheet.deleteRow(i + 1);
        invalidateCache('workQueue');
        return { success: true, queue: getWorkQueue(true) };
      }
    }
    return { error: 'Not found' };
  } catch (err) {
    return { error: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

function extractLinkForStep(allLinks, stepKey) {
  if (!allLinks) return null;
  const lines = allLinks.toString().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const aliases = {
    'upload': ['อัป Raw', 'Raw', 'อัป RAW', 'Upload'],
    'extract': ['ดึงคำ', 'Extract', 'Extractor'],
    'translate': ['แปล', 'Translate', 'Translator'],
    'typeset': ['ลงคำ', 'Typeset', 'Typesetter'],
    'publish': ['Publisher', 'เผยแพร่', 'ลงเว็บ', 'Publish'],
    'post': ['โพสต์', 'Post']
  };

  const possibleLabels = (aliases[stepKey.toLowerCase()] || [stepKey]).map(l => l.toLowerCase());

  for (let l of lines) {
    const bracketEnd = l.indexOf(']');
    if (l.startsWith('[') && bracketEnd > 0) {
      const label = l.substring(1, bracketEnd).toLowerCase();
      if (possibleLabels.includes(label)) {
        return l.substring(bracketEnd + 1).trim();
      }
    }
  }

  if (!lines[0].startsWith('[')) {
    return lines[0];
  }

  return null;
}

function updateFullQueueItem(queueId, updateData) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = getSheet(QUEUE_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => h.toString().toLowerCase().trim());

    for (let i = 1; i < data.length; i++) {
      if (data[i][0].toString() === queueId.toString()) {
        const rowNum = i + 1;
        
        const updateCell = (header, val) => {
          const col = headers.indexOf(header) + 1;
          if (col > 0 && val !== undefined) {
            sheet.getRange(rowNum, col).setValue(val);
          }
        };

        updateCell('chapter', updateData.chapter);
        updateCell('uploadstatus', updateData.uploadstatus);
        updateCell('extractstatus', updateData.extractstatus);
        updateCell('translatestatus', updateData.translatestatus);
        updateCell('typesetstatus', updateData.typesetstatus);
        updateCell('publishstatus', updateData.publishstatus);
        updateCell('poststatus', updateData.poststatus);

        updateCell('uploadername', updateData.uploadername);
        updateCell('extractorname', updateData.extractorname);
        updateCell('translatorname', updateData.translatorname);
        updateCell('typesettername', updateData.typesettername);
        updateCell('publishername', updateData.publishername);
        updateCell('postername', updateData.postername);

        try {
          const mangaIdForNoti = data[i][headers.indexOf('mangaid')];
          const chapterForNoti = updateData.chapter || data[i][headers.indexOf('chapter')];
          const mangaNameForNoti = getMangaNameById(mangaIdForNoti);

          const statusFields = ['uploadstatus', 'extractstatus', 'translatestatus', 'typesetstatus', 'publishstatus', 'poststatus'];
          const assigneeMap = {
            'uploadstatus': 'uploadername',
            'extractstatus': 'extractorname',
            'translatestatus': 'translatorname',
            'typesetstatus': 'typesettername',
            'publishstatus': 'publishername',
            'poststatus': 'postername'
          };

          statusFields.forEach(field => {
            const newVal = updateData[field];
            const oldVal = data[i][headers.indexOf(field)];
            if (newVal === 'เสร็จแล้ว' && oldVal !== 'เสร็จแล้ว') {
              const stepKey = field.replace('status', '');
              const timeCol = headers.indexOf(stepKey + 'time') + 1;
              if (timeCol > 0) sheet.getRange(rowNum, timeCol).setValue(new Date());

              const stepLabel = getStepLabel(stepKey);
              const assignee = updateData[assigneeMap[field]] || '';
              let message = `✅ <b>งานเสร็จแล้ว!</b>\n\nเรื่อง: <b>${mangaNameForNoti}</b>\nตอนที่: ${chapterForNoti}\nขั้นตอน: <b>${stepLabel}</b>\nโดย: ${assignee || 'ไม่ระบุ'}`;
              
              const stepLink = extractLinkForStep(updateData.worklink, stepLabel);
              if (stepLink) {
                message += `\n🔗 <b>ลิงก์งาน:</b> ${stepLink}`;
              }
              
              sendTelegramNotification(message);

              if (field === 'poststatus' || field === 'publishstatus') {
                try {
                  const mangaList = getMangaList();
                  const manga = mangaList.find(m => m.mangaid.toString() === mangaIdForNoti.toString());
                  if (manga && manga.slug) {
                    const range = parseChapterRange(chapterForNoti);
                    updateMangaEpisodeOnWebsite(manga.slug, range.end);
                  }
                } catch (aue) {
                  console.error('Error triggering auto-update in updateFullQueueItem:', aue);
                }
              }
            }
          });
        } catch (te) {
          console.error('Telegram notification error in updateFullQueueItem:', te);
        }

        updateCell('worklink', updateData.worklink);
        updateCell('note', updateData.note);
        
        invalidateCache('workQueue');
        return { success: true, queue: getWorkQueue(true) };
      }
    }
    return { error: 'Queue ID not found' };
  } catch (e) {
    return { error: 'Update Failed: ' + e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function getTeamMembers() {
  try {
    const sheet = getSheet(TEAM_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    const headers = data.shift().map(h => h.toString().toLowerCase().trim());
    return data.map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    });
  } catch (err) {
    console.error('getTeamMembers Error:', err);
    return [];
  }
}

/**
 * CRON: รันทุกวันเพื่อดึงมังงะเข้าคิวอัตโนมัติ (Batch Optimized)
 */
function processAutoQueue() {
  const today = getTodayDayName();
  const mangaList = getMangaList();
  const queueList = getWorkQueue();
  
  const scheduled = mangaList.filter(m => 
    m.status === 'Ongoing' && 
    m.releaseday && m.releaseday.split(',').map(d => d.trim()).includes(today)
  );
  
  if (scheduled.length === 0) return;

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = getSheet(QUEUE_SHEET_NAME);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => h.toString().toLowerCase().trim());
    
    const newRows = [];
    const mangaUpdates = [];

    const timestamp = new Date();
    const todayStr = timestamp.toLocaleDateString('th-TH');

    scheduled.forEach(m => {
      const alreadyAdded = queueList.some(q => {
        if (q.mangaid.toString() !== m.mangaid.toString()) return false;
        const qDate = new Date(q.createdat).toLocaleDateString('th-TH');
        if (qDate === todayStr) return true;
        if (q.poststatus !== 'เสร็จแล้ว') return true;
        return false;
      });
      
      if (alreadyAdded) return;

      let nextChapter = (parseFloat(m.lastchapter) || 0) + 1;
      const id = new Date().getTime() + Math.floor(Math.random() * 1000);

      const rowData = headers.map(header => {
        if (header === 'queueid') return id;
        if (header === 'createdat') return timestamp;
        if (header === 'mangaid') return m.mangaid;
        if (header === 'chapter') return nextChapter.toString();
        if (header === 'uploadstatus') return 'รอเริ่ม';
        if (header === 'extractstatus') return (m.needsextract === true || m.needsextract === 'true') ? 'รอเริ่ม' : 'Skipped';
        if (header === 'translatestatus') return 'รอเริ่ม';
        if (header === 'typesetstatus') return 'รอเริ่ม';
        if (header === 'publishstatus') return 'รอเริ่ม';
        if (header === 'poststatus') return 'รอเริ่ม';
        if (header === 'translatorname') return m.lockedtranslator || '';
        return '';
      });
      
      newRows.push(rowData);

      if (m.notifyonadd === true || m.notifyonadd === 'true') {
        const message = `🤖 <b>เพิ่มคิวงานอัตโนมัติ!</b>\n\nเรื่อง: <b>${m.manganame}</b>\nตอนที่: ${nextChapter}\nสถานะ: เข้าระบบตามตารางเวลาแล้ว`;
        sendTelegramNotification(message);
      }
      
      mangaUpdates.push({
        mangaId: m.mangaid,
        newChapter: nextChapter.toString()
      });
    });

    if (newRows.length > 0) {
      const startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, newRows.length, headers.length).setValues(newRows);
      invalidateCache('workQueue');
    }
    
    if (mangaUpdates.length > 0) {
      batchSyncMangaStatus(mangaUpdates);
      invalidateCache('mangaList');
    }
  } catch (err) {
    console.error('Auto Queue Error:', err);
  } finally {
    lock.releaseLock();
  }
}

function batchSyncMangaStatus(updates) {
  try {
    const sheet = getSheet(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => h.toString().toLowerCase().trim());
    
    const idColIndex = 0; 
    const lastChapterColIndex = headers.indexOf('lastchapter');
    const lastUpdatedColIndex = headers.indexOf('lastupdated');
    
    if (lastChapterColIndex === -1 || lastUpdatedColIndex === -1) return;

    let hasChanges = false;
    const now = new Date();

    const updateMap = new Map();
    updates.forEach(u => updateMap.set(u.mangaId.toString(), parseFloat(u.newChapter)));

    for (let i = 1; i < data.length; i++) {
      const currentId = data[i][idColIndex].toString();
      
      if (updateMap.has(currentId)) {
        const rawNewChapter = updateMap.get(currentId);
        const range = parseChapterRange(rawNewChapter);
        const newChapter = range.end;
        const currentChapter = parseFloat(data[i][lastChapterColIndex]) || 0;

        if (newChapter >= currentChapter) {
          data[i][lastChapterColIndex] = newChapter;
          data[i][lastUpdatedColIndex] = now;
          hasChanges = true;
        }
      }
    }

    if (hasChanges) {
      sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
    }
  } catch (e) {
    console.error('Batch Sync Error:', e);
  }
}

function getTodayDayName() {
  const days = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
  return days[new Date().getDay()];
}

function createAutoQueueTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'processAutoQueue') ScriptApp.deleteTrigger(t);
  });
  
  ScriptApp.newTrigger('processAutoQueue')
    .timeBased()
    .everyDays(1)
    .atHour(2)
    .create();
    
  return "สร้างระบบตั้งเวลาอัตโนมัติเรียบร้อยแล้ว! (รันทุกวันเวลา 02:00 น.)";
}

function movePendingQueueToCurrentMonth() {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = getSheet(QUEUE_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => h.toString().toLowerCase().trim());
    
    const createdAtCol = headers.indexOf('createdat');
    const postStatusCol = headers.indexOf('poststatus');

    if (createdAtCol === -1 || postStatusCol === -1) return "Error: Headers mapping failed";

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    let updatedCount = 0;

    for (let i = 1; i < data.length; i++) {
      const postStatus = data[i][postStatusCol];
      const createdAtRaw = data[i][createdAtCol];
      const createdAt = createdAtRaw instanceof Date ? createdAtRaw : new Date(createdAtRaw);

      if (postStatus !== 'เสร็จแล้ว') {
        const isLegacyMonth = createdAt.getMonth() !== currentMonth || createdAt.getFullYear() !== currentYear;
        
        if (isLegacyMonth) {
          const newDate = new Date();
          newDate.setHours(0, 0, 1, 0);
          data[i][createdAtCol] = newDate;
          updatedCount++;
        }
      }
    }

    if (updatedCount > 0) {
      sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
      invalidateCache('workQueue');
      return `ย้ายงานค้าง ${updatedCount} รายการมายังเดือนปัจจุบันเรียบร้อยแล้ว`;
    }

    return "ไม่มีงานค้างเดือนก่อนหน้าที่ต้องย้าย";
  } catch (err) {
    console.error('Move Pending Error:', err);
    return "เกิดข้อผิดพลาด: " + err.toString();
  } finally {
    lock.releaseLock();
  }
}

function createMovePendingTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'movePendingQueueToCurrentMonth') ScriptApp.deleteTrigger(t);
  });
  
  ScriptApp.newTrigger('movePendingQueueToCurrentMonth')
    .timeBased()
    .everyDays(1)
    .atHour(3)
    .create();
    
  return "สร้างระบบตั้งเวลาย้ายงานค้างอัตโนมัติเรียบร้อยแล้ว! (รันทุกวันเวลา 03:00 น.)";
}

// --- BUDGET PAYEES ---
function getBudgetPayees() {
  return readSheetData(BUDGET_PAYEE_SHEET_NAME);
}

function addBudgetPayee(payee) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = getSheet(BUDGET_PAYEE_SHEET_NAME);
    const id = 'P' + new Date().getTime();
    sheet.appendRow([id, payee.name, payee.taxid, payee.bankaccount || '', payee.bankname || '', payee.note || '']);
    invalidateCache('budget_payees');
    return { success: true, payees: getBudgetPayees() };
  } catch (err) {
    return { error: 'Add Payee Failed: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

function updateBudgetPayee(id, updated) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = getSheet(BUDGET_PAYEE_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => h.toString().toLowerCase().trim());
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0].toString() === id.toString()) {
        const rowNum = i + 1;
        headers.forEach((header, index) => {
          const colNum = index + 1;
          if (header === 'name') sheet.getRange(rowNum, colNum).setValue(updated.name);
          if (header === 'taxid') sheet.getRange(rowNum, colNum).setValue(updated.taxid);
          if (header === 'bankaccount') sheet.getRange(rowNum, colNum).setValue(updated.bankaccount);
          if (header === 'bankname') sheet.getRange(rowNum, colNum).setValue(updated.bankname);
          if (header === 'note') sheet.getRange(rowNum, colNum).setValue(updated.note);
        });
        invalidateCache('budget_payees');
        return { success: true, payees: getBudgetPayees() };
      }
    }
    return { error: 'Payee not found' };
  } catch (err) {
    return { error: 'Update Payee Failed: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

function deleteBudgetPayee(id) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = getSheet(BUDGET_PAYEE_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0].toString() === id.toString()) {
        sheet.deleteRow(i + 1);
        invalidateCache('budget_payees');
        return { success: true, payees: getBudgetPayees() };
      }
    }
    return { error: 'Payee not found' };
  } catch (err) {
    return { error: 'Delete Payee Failed: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

// --- BUDGET TRANSACTIONS ---
function getBudgetTransactions() {
  return readSheetData(BUDGET_TRANSACTION_SHEET_NAME);
}

function addBudgetTransaction(trans) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = getSheet(BUDGET_TRANSACTION_SHEET_NAME);
    const id = 'TR' + new Date().getTime();
    const date = trans.date ? new Date(trans.date) : new Date();
    
    sheet.appendRow([
      id, 
      date, 
      trans.type, 
      parseFloat(trans.amount) || 0, 
      trans.category || '', 
      trans.reference || '', 
      trans.note || ''
    ]);
    invalidateCache('budget_transactions');
    return { success: true, transactions: getBudgetTransactions() };
  } catch (err) {
    return { error: 'Add Transaction Failed: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

function deleteBudgetTransaction(id) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = getSheet(BUDGET_TRANSACTION_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0].toString() === id.toString()) {
        sheet.deleteRow(i + 1);
        invalidateCache('budget_transactions');
        return { success: true, transactions: getBudgetTransactions() };
      }
    }
    return { error: 'Transaction not found' };
  } catch (err) {
    return { error: 'Delete Transaction Failed: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

function readSheetData(sheetName) {
  try {
    const sheet = getSheet(sheetName);
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    const rawHeaders = data.shift();
    const headers = rawHeaders.map(h => h.toString().toLowerCase().trim());
    
    return data.map(row => {
      let obj = {};
      headers.forEach((header, i) => {
        let val = row[i];
        if (val instanceof Date) {
          val = val.toISOString();
        }
        obj[header] = val;
      });
      return obj;
    });
  } catch (err) {
    console.error('readSheetData Error (' + sheetName + '):', err);
    return [];
  }
}

function getBudgetData() {
  return {
    payees: getBudgetPayees(),
    transactions: getBudgetTransactions(),
    websites: getWebsiteList()
  };
}

function getAllData() {
  return {
    manga: getMangaList(),
    queue: getWorkQueue(),
    team: getTeamMembers(),
    payees: getBudgetPayees(),
    transactions: getBudgetTransactions(),
    websites: getWebsiteList()
  };
}

function getDashboardData(forceRefresh = false, month, year) {
  const now = new Date();
  const targetMonth = month !== undefined && month !== null && month !== '' ? month : String(now.getMonth() + 1);
  const targetYear = year !== undefined && year !== null && year !== '' ? year : String(now.getFullYear());
  return {
    manga: getMangaList(),
    queue: getWorkQueue(forceRefresh, targetMonth, targetYear, false),
    team: getTeamMembers()
  };
}

function checkQueueLock(queueId) {
  try {
    const sheet = getSheet(QUEUE_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => h.toString().toLowerCase().trim());
    
    const lockCol = headers.indexOf('isediting');
    const byCol = headers.indexOf('editingby');
    const timeCol = headers.indexOf('editingtime');
    
    if (lockCol === -1) return { canEdit: true, reason: 'No lock system' };

    for (let i = 1; i < data.length; i++) {
      if (data[i][0].toString() === queueId.toString()) {
        const isLocked = data[i][lockCol];
        const editingBy = data[i][byCol] || '';
        const editingTime = data[i][timeCol];
        
        if (!isLocked) {
          return { canEdit: true };
        }
        
        if (editingTime) {
          const lockTime = new Date(editingTime);
          const now = new Date();
          const diffMinutes = (now - lockTime) / (1000 * 60);
          
          if (diffMinutes > 10) {
            const rowNum = i + 1;
            sheet.getRange(rowNum, lockCol + 1, 1, 3).setValues([[false, '', '']]);
            return { 
              canEdit: true, 
              wasExpired: true,
              reason: 'Lock expired and auto-released'
            };
          }
        }
        
        return { 
          canEdit: false, 
          lockedBy: editingBy,
          lockedAt: editingTime,
          reason: `กำลังถูกแก้ไขโดย ${editingBy || 'ผู้ใช้อื่น'}`
        };
      }
    }
    return { canEdit: true, reason: 'Item not found' };
  } catch (e) {
    return { canEdit: true, error: e.toString() };
  }
}

/**
 * MANGA SALES (Financials) CRUD
 */
function getMangaSales() {
  try {
    const sheet = getSheet(MANGA_SALES_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    const rawHeaders = data.shift();
    const headers = rawHeaders.map(h => h.toString().toLowerCase().trim());
    
    return data.map((row, idx) => {
      let obj = { _rowIndex: idx };
      headers.forEach((header, i) => {
        let val = row[i];
        if (val instanceof Date) val = val.toISOString();
        obj[header] = val;
      });
      return obj;
    });
  } catch (err) {
    console.error('getMangaSales Error:', err);
    return [];
  }
}

function addMangaSale(sale) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = getSheet(MANGA_SALES_SHEET_NAME);
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) throw new Error("MangaSales sheet headers missing.");
    
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => h.toString().toLowerCase().trim());
    
    const newRow = headers.map(header => {
      if (header === 'date') return sale.date ? new Date(sale.date) : new Date();
      if (header === 'month') return sale.month || '';
      if (header === 'serieschapterid') return sale.serieschapterid || '';
      if (header === 'seriesname') return sale.seriesname || '';
      if (header === 'chapterscount') return sale.chapterscount || 0;
      if (header === 'category') return sale.category || '';
      if (header === 'website') return sale.website || '';
      if (header === 'page') return sale.page || '';
      if (header === 'targetperchapter') return sale.targetperchapter || 0;
      if (header === 'totaltarget') return sale.totaltarget || 0;
      if (header === 'costperchapter') return sale.costperchapter || 0;
      if (header === 'totalcost') return sale.totalcost || 0;
      if (header === 'revenue') return sale.revenue || 0;
      if (header === 'profit') return (parseFloat(sale.revenue) || 0) - (parseFloat(sale.totalcost) || 0);
      return '';
    });

    sheet.appendRow(newRow);
    invalidateCache('manga_sales');
    return { success: true, list: getMangaSales() };
  } catch (err) {
    console.error('addMangaSale Error:', err);
    return { error: 'Add Sale Failed: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

function bulkAddMangaSales(salesArray) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(60000);
    const sheet = getSheet(MANGA_SALES_SHEET_NAME);
    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => h.toString().toLowerCase().trim());
    
    const websiteSheet = getSheet(WEBSITE_SHEET_NAME);
    const existingWebsites = getWebsiteList();
    
    const newRows = salesArray.map(sale => {
      if (sale.website && !existingWebsites.includes(sale.website)) {
        websiteSheet.appendRow([sale.website]);
        existingWebsites.push(sale.website);
        invalidateCache('website_list');
      }
      
      return headers.map(header => {
        if (header === 'date') return sale.date ? new Date(sale.date) : new Date();
        if (header === 'month') return sale.month || '';
        if (header === 'serieschapterid') return sale.serieschapterid || '';
        if (header === 'seriesname') return sale.seriesname || '';
        if (header === 'chapterscount') return sale.chapterscount || 0;
        if (header === 'category') return sale.category || '';
        if (header === 'website') return sale.website || '';
        if (header === 'page') return sale.page || '';
        if (header === 'targetperchapter') return sale.targetperchapter || 0;
        if (header === 'totaltarget') return sale.totaltarget || 0;
        if (header === 'costperchapter') return sale.costperchapter || 0;
        if (header === 'totalcost') return sale.totalcost || 0;
        if (header === 'revenue') return sale.revenue || sale.totaltarget || 0;
        if (header === 'profit') {
          const rev = parseFloat(sale.revenue || sale.totaltarget) || 0;
          const cost = parseFloat(sale.totalcost) || 0;
          return rev - cost;
        }
        return '';
      });
    });

    if (newRows.length > 0) {
      const range = sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, headers.length);
      range.setValues(newRows);
    }
    
    invalidateCache(['manga_sales', 'financial_sales']);
    return { success: true, count: newRows.length, list: getMangaSales(), websites: getWebsiteList() };
  } catch (err) {
    console.error('bulkAddMangaSales Error:', err);
    return { error: 'Bulk Add Failed: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

function deleteMangaSale(index) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = getSheet(MANGA_SALES_SHEET_NAME);
    sheet.deleteRow(Number(index) + 2);
    invalidateCache('manga_sales');
    return { success: true, list: getMangaSales() };
  } catch (err) {
    return { error: 'Delete Sale Failed: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

function countFinishedChapters(mangaId, year, month) {
  try {
    const queue = getWorkQueue();
    let totalCount = 0;
    queue.forEach(q => {
      if (q.mangaid.toString() !== mangaId.toString()) return;
      if (q.poststatus !== 'เสร็จแล้ว') return;
      
      const d = new Date(q.createdat);
      if (d.getFullYear() === parseInt(year) && (d.getMonth() + 1) === parseInt(month)) {
        const range = parseChapterRange(q.chapter);
        totalCount += range.count;
      }
    });
    
    return totalCount;
  } catch (e) {
    return 0;
  }
}

function getWebsiteList() {
  try {
    const sheet = getSheet(WEBSITE_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    data.shift();
    return data.map(row => row[0]).filter(Boolean);
  } catch (err) {
    console.error('getWebsiteList Error:', err);
    return [];
  }
}

function getFinancialInitData() {
  return {
    manga: getMangaList(),
    sales: getMangaSales(),
    websites: getWebsiteList()
  };
}

function verifyPasscode(pass) {
  return pass === ACCESS_PASSCODE;
}

/**
 * Send notification to Telegram
 */
function sendTelegramNotification(message) {
  if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
    return;
  }
  
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const payload = {
    'chat_id': TELEGRAM_CHAT_ID,
    'text': message,
    'parse_mode': 'HTML'
  };
  
  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true
  };
  
  try {
    UrlFetchApp.fetch(url, options);
  } catch (e) {
    console.error('Telegram notification failed:', e);
  }
}

function getMangaNameById(mangaId) {
  const mangaList = getMangaList();
  const manga = mangaList.find(m => m.mangaid.toString() === mangaId.toString());
  return manga ? manga.manganame : 'มังงะไม่ทราบชื่อ';
}

function handleTelegramCommand(chatId, command, args) {
  let response = '';
  
  switch (command) {
    case '/start':
    case '/help':
      response = "<b>📚 ระบบ MangaHub Bot</b>\n\n" +
                 "คำสั่งที่ใช้งานได้:\n" +
                 "/status - ดูภาพรวมงานค้างทั้งหมด\n" +
                 "/waiting [ขั้นตอน] - ดูรายชื่อตอนที่รอทำ\n" +
                 "/ready_publish - ดูงานที่ลงคำเสร็จแล้ว (รอ Publish/อัปเว็บ)\n" +
                 "/ready_typeset - ดูงานที่แปลเสร็จแล้ว (รอลงคำ)\n" +
                 "/ready_translate - ดูงานที่ดึงคำเสร็จแล้ว (รอแปล)\n\n" +
                 "ขั้นตอนที่ระบุได้: <code>raw, extract, translate, typeset, publish, post</code>";
      break;
      
    case '/status':
      response = getTelegramStatusSummary();
      break;
      
    case '/waiting':
      response = getTelegramWaitingList(args[0]);
      break;
      
    case '/ready_publish':
    case '/ready_upload':
      response = getTelegramReadyList('publish');
      break;
      
    case '/ready_typeset':
      response = getTelegramReadyList('typeset');
      break;
      
    case '/ready_translate':
      response = getTelegramReadyList('translate');
      break;

    default:
      if (command.startsWith('/')) {
        response = "ขออภัย ไม่รู้จักคำสั่งนี้ พิมพ์ /help เพื่อดูคำสั่งทั้งหมด";
      }
  }
  
  if (response) {
    sendTelegramDirect(chatId, response);
  }
}

function sendTelegramDirect(chatId, message) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const payload = {
    'chat_id': chatId,
    'text': message,
    'parse_mode': 'HTML'
  };
  
  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true
  };
  
  try {
    UrlFetchApp.fetch(url, options);
  } catch (e) {
    console.error('Failed to send direct Telegram message:', e);
  }
}

function getTelegramStatusSummary() {
  const queue = getWorkQueue();
  let waitUpload = 0, waitExtract = 0, waitTranslate = 0, waitTypeset = 0, waitPublish = 0, waitPost = 0;
  
  const isDone = (s) => s === 'เสร็จแล้ว' || s === 'Skipped' || s === 'ข้าม';
  queue.forEach(q => {
    if (isDone(q.poststatus)) return;

    if (!isDone(q.uploadstatus)) waitUpload++;
    else if (!isDone(q.extractstatus)) waitExtract++;
    else if (!isDone(q.translatestatus)) waitTranslate++;
    else if (!isDone(q.typesetstatus)) waitTypeset++;
    else if (!isDone(q.publishstatus)) waitPublish++;
    else waitPost++;
  });
  
  return "<b>📊 สรุปงานค้างแยกตามขั้นตอน</b>\n\n" +
         `🔼 รออัป Raw: ${waitUpload}\n` +
         `📝 รอดึงคำ: ${waitExtract}\n` +
         `🌐 รอแปล: ${waitTranslate}\n` +
         `✍️ รอลงคำ: ${waitTypeset}\n` +
         `📤 รอ Publish: ${waitPublish}\n` +
         `✉️ รอโพสต์: ${waitPost}\n\n` +
         "พิมพ์ <code>/waiting [ขั้นตอน]</code> เพื่อดูรายละเอียด";
}

function getTelegramWaitingList(step) {
  if (!step) return "กรุณาระบุขั้นตอน เช่น <code>/waiting translate</code>\n(raw, extract, translate, typeset, publish, post)";
  
  const queue = getWorkQueue();
  const mangaList = getMangaList();
  const stepMap = {
    'upload': 'uploadstatus',
    'raw': 'uploadstatus',
    'extract': 'extractstatus',
    'translate': 'translatestatus',
    'typeset': 'typesetstatus',
    'publish': 'publishstatus',
    'post': 'poststatus'
  };
  
  const field = stepMap[step.toLowerCase()];
  if (!field) return "ไม่รู้จักขั้นตอนที่ระบุ กรุณาใช้: raw, extract, translate, typeset, publish, post";
  
  const list = queue.filter(q => q[field] !== 'เสร็จแล้ว' && q[field] !== 'ข้าม');
  
  if (list.length === 0) return `✅ ไม่มีงานค้างในขั้นตอน <b>${step}</b>`;
  
  let msg = `<b>📋 รายการงานค้าง [${step.toUpperCase()}]</b>\n\n`;
  list.slice(0, 25).forEach((q, i) => {
    const manga = mangaList.find(m => m.mangaid.toString() === q.mangaid.toString());
    const name = manga ? manga.manganame : 'มังงะไม่ทราบชื่อ';
    msg += `${i+1}. ${name} ตอนที่ ${q.chapter} (สถานะ: ${q[field]})\n`;
  });
  
  if (list.length > 25) msg += `\n<i>... และอื่นๆ อีก ${list.length - 25} รายการ</i>`;
  
  return msg;
}

function getTelegramReadyList(targetStep) {
  const queue = getWorkQueue();
  const mangaList = getMangaList();
  
  let list = [];
  let stepTitle = "";
  
  if (targetStep === 'publish') {
    stepTitle = "ลงคำเสร็จ -> รอ Publish";
    list = queue.filter(q => q.typesetstatus === 'เสร็จแล้ว' && q.publishstatus !== 'เสร็จแล้ว' && q.publishstatus !== 'ข้าม');
  } else if (targetStep === 'typeset') {
    stepTitle = "แปลเสร็จ -> รอลงคำ";
    list = queue.filter(q => q.translatestatus === 'เสร็จแล้ว' && q.typesetstatus !== 'เสร็จแล้ว' && q.typesetstatus !== 'ข้าม');
  } else if (targetStep === 'translate') {
    stepTitle = "ดึงคำเสร็จ -> รอแปล";
    list = queue.filter(q => q.extractstatus === 'เสร็จแล้ว' && q.translatestatus !== 'เสร็จแล้ว' && q.translatestatus !== 'ข้าม');
  }
  
  if (list.length === 0) return `✅ ไม่มีงานที่ <b>${stepTitle}</b>`;
  
  let msg = `<b>🚀 ${stepTitle} (${list.length} ตอน)</b>\n\n`;
  list.slice(0, 25).forEach((q, i) => {
    const manga = mangaList.find(m => m.mangaid.toString() === q.mangaid.toString());
    const name = manga ? manga.manganame : 'มังงะไม่ทราบชื่อ';
    msg += `${i+1}. ${name} ตอนที่ ${q.chapter}\n`;
  });
  
  if (list.length > 25) msg += `\n<i>... และอื่นๆ อีก ${list.length - 25} รายการ</i>`;
  
  return msg;
}

function setTelegramWebhook() {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=${ScriptApp.getService().getUrl()}`;
  const response = UrlFetchApp.fetch(url);
  Logger.log(response.getContentText());
  return response.getContentText();
}

// ==========================================
// RAW TRACKER & WEBSCRAPING MODULE
// ==========================================

function getRawTrackerList() {
  try {
    const sheet = getSheet(RAW_TRACKER_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    
    // Auto import if empty
    if (data.length <= 1) {
      return importTrackersFromMangaList();
    }

    const headers = data[0].map(h => h.toString().toLowerCase().trim());
    const mangaList = getMangaList();
    const mangaMap = {};
    mangaList.forEach(m => {
      mangaMap[String(m.mangaid)] = m;
    });

    const results = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const obj = {};
      for (let c = 0; c < headers.length; c++) {
        let val = row[c];
        if (val instanceof Date) val = val.toISOString();
        obj[headers[c]] = val;
      }
      const manga = mangaMap[String(obj.mangaid)];
      obj.currentChapter = manga ? (manga.lastchapter || '0') : '0';
      if (!obj.manganame && manga) obj.manganame = manga.manganame;
      results.push(obj);
    }
    return results;
  } catch (err) {
    console.error('getRawTrackerList Error:', err);
    return [];
  }
}

function scrapeRawUrl(url, pattern) {
  if (!url || typeof url !== 'string' || !url.trim().startsWith('http')) {
    return { success: false, error: 'URL ไม่ถูกต้อง' };
  }

  try {
    const cleanUrl = url.trim();
    const options = {
      method: 'get',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,th;q=0.8,en;q=0.7',
      },
      muteHttpExceptions: true,
      followRedirects: true
    };

    const response = UrlFetchApp.fetch(cleanUrl, options);
    const code = response.getResponseCode();
    if (code !== 200) {
      return { success: false, error: 'HTTP Code: ' + code };
    }

    const html = response.getContentText('UTF-8') || response.getContentText();

    let matchedText = '';
    let chapterCount = 0;

    // 1. If custom regex provided
    if (pattern && pattern.trim()) {
      try {
        const regex = new RegExp(pattern.trim());
        const match = html.match(regex);
        if (match) {
          matchedText = match[0];
          if (match[1]) {
            const num = parseFloat(match[1].replace(/,/g, ''));
            if (!isNaN(num)) chapterCount = num;
          }
        }
      } catch (e) {
        console.error('Custom regex error:', e);
      }
    }

    // 2. Kuaikanmanhua default pattern: 共377个内容
    if (!matchedText) {
      const matchKuaikan = html.match(/共\s*(\d+)\s*个内容/);
      if (matchKuaikan) {
        matchedText = matchKuaikan[0];
        chapterCount = parseInt(matchKuaikan[1], 10);
      }
    }

    // 3. QQ Comic pattern: 第...话 or 更新至...话
    if (!matchedText) {
      const matchQq = html.match(/更新至\s*(\d+)\s*话/) || html.match(/共\s*(\d+)\s*话/);
      if (matchQq) {
        matchedText = matchQq[0];
        chapterCount = parseInt(matchQq[1], 10);
      } else {
        const allMatches = html.match(/第\s*(\d+)\s*话/g);
        if (allMatches && allMatches.length > 0) {
          let maxNum = 0;
          allMatches.forEach(m => {
            const n = parseInt(m.replace(/\D/g, ''), 10);
            if (!isNaN(n) && n > maxNum) maxNum = n;
          });
          if (maxNum > 0) {
            matchedText = '第' + maxNum + '话';
            chapterCount = maxNum;
          }
        }
      }
    }

    // 4. Other common patterns
    if (!matchedText) {
      const generic = html.match(/(?:更新至|連載至|连载至|Chapter|Ch\.)\s*(\d+)/i);
      if (generic) {
        matchedText = generic[0];
        chapterCount = parseInt(generic[1], 10);
      }
    }

    if (!matchedText) {
      return {
        success: false,
        error: 'ไม่พบข้อความจำนวนตอน (เช่น 共...个内容) ในหน้าเว็บนี้'
      };
    }

    return {
      success: true,
      rawText: matchedText,
      chapterCount: chapterCount,
      url: cleanUrl,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    return {
      success: false,
      error: 'ดึงข้อมูลไม่สำเร็จ: ' + err.toString()
    };
  }
}

function addRawTracker(item) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = getSheet(RAW_TRACKER_SHEET_NAME);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => h.toString().toLowerCase().trim());

    const id = 'TRK' + new Date().getTime();
    const now = new Date();
    
    // Test scrape initial
    let initialText = '';
    let initialCount = 0;
    let initialStatus = 'กำลังรอตรวจสอบ';
    if (item.url) {
      const sc = scrapeRawUrl(item.url, item.pattern);
      if (sc.success) {
        initialText = sc.rawText;
        initialCount = sc.chapterCount;
        initialStatus = 'เป็นปัจจุบัน';
      }
    }

    const newRow = headers.map(header => {
      if (header === 'trackerid') return id;
      if (header === 'mangaid') return item.mangaid || '';
      if (header === 'manganame') return item.manganame || '';
      if (header === 'url') return item.url || '';
      if (header === 'pattern') return item.pattern || '';
      if (header === 'lastrawtext') return initialText;
      if (header === 'lastrawcount') return initialCount;
      if (header === 'status') return initialStatus;
      if (header === 'lastchecked') return now;
      if (header === 'updatedat') return now;
      if (header === 'autocheck') return item.autocheck !== undefined ? item.autocheck : true;
      return '';
    });

    sheet.appendRow(newRow);
    return getRawTrackerList();
  } catch (err) {
    return { error: 'Add Tracker Failed: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

function updateRawTracker(trackerId, updateData) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = getSheet(RAW_TRACKER_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => h.toString().toLowerCase().trim());
    const idCol = headers.indexOf('trackerid');

    for (let i = 1; i < data.length; i++) {
      if (data[i][idCol].toString() === trackerId.toString()) {
        const rowNum = i + 1;
        Object.keys(updateData).forEach(key => {
          const colIndex = headers.indexOf(key.toLowerCase());
          if (colIndex !== -1) {
            sheet.getRange(rowNum, colIndex + 1).setValue(updateData[key]);
          }
        });
        break;
      }
    }
    return getRawTrackerList();
  } catch (err) {
    return { error: 'Update Tracker Failed: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

function deleteRawTracker(trackerId) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = getSheet(RAW_TRACKER_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const idCol = data[0].map(h => h.toString().toLowerCase().trim()).indexOf('trackerid');

    for (let i = 1; i < data.length; i++) {
      if (data[i][idCol].toString() === trackerId.toString()) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
    return getRawTrackerList();
  } catch (err) {
    return { error: 'Delete Tracker Failed: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

function importTrackersFromMangaList() {
  const mangaList = getMangaList();
  const sheet = getSheet(RAW_TRACKER_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => h.toString().toLowerCase().trim());
  const existingMangaIds = new Set();
  
  if (data.length > 1) {
    const mIdCol = headers.indexOf('mangaid');
    for (let i = 1; i < data.length; i++) {
      existingMangaIds.add(String(data[i][mIdCol]));
    }
  }

  const rowsToAdd = [];
  const now = new Date();
  mangaList.forEach(m => {
    if (m.originalurl && m.originalurl.trim().startsWith('http') && !existingMangaIds.has(String(m.mangaid))) {
      const id = 'TRK' + new Date().getTime() + '_' + m.mangaid;
      const row = headers.map(header => {
        if (header === 'trackerid') return id;
        if (header === 'mangaid') return m.mangaid;
        if (header === 'manganame') return m.manganame;
        if (header === 'url') return m.originalurl.trim();
        if (header === 'pattern') return '';
        if (header === 'lastrawtext') return '';
        if (header === 'lastrawcount') return 0;
        if (header === 'status') return 'รอตรวจสอบครั้งแรก';
        if (header === 'lastchecked') return now;
        if (header === 'updatedat') return now;
        if (header === 'autocheck') return true;
        return '';
      });
      rowsToAdd.push(row);
      existingMangaIds.add(String(m.mangaid));
    }
  });

  if (rowsToAdd.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAdd.length, headers.length).setValues(rowsToAdd);
  }

  return getRawTrackerList();
}

function checkAllRawTrackers(notifyTelegram = false) {
  const sheet = getSheet(RAW_TRACKER_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { checked: 0, newUpdates: [], list: [] };

  const headers = data[0].map(h => h.toString().toLowerCase().trim());
  const idCol = headers.indexOf('trackerid') + 1;
  const nameCol = headers.indexOf('manganame') + 1;
  const urlCol = headers.indexOf('url') + 1;
  const patternCol = headers.indexOf('pattern') + 1;
  const lastTextCol = headers.indexOf('lastrawtext') + 1;
  const lastCountCol = headers.indexOf('lastrawcount') + 1;
  const statusCol = headers.indexOf('status') + 1;
  const lastCheckedCol = headers.indexOf('lastchecked') + 1;
  const updatedAtCol = headers.indexOf('updatedat') + 1;
  const autoCheckCol = headers.indexOf('autocheck') + 1;

  const newUpdates = [];
  const now = new Date();

  for (let i = 1; i < data.length; i++) {
    const rowNum = i + 1;
    const trackerId = data[i][idCol - 1];
    const mangaName = data[i][nameCol - 1];
    const url = data[i][urlCol - 1];
    const pattern = patternCol > 0 ? data[i][patternCol - 1] : '';
    const oldText = lastTextCol > 0 ? String(data[i][lastTextCol - 1] || '').trim() : '';
    const oldCount = lastCountCol > 0 ? (parseFloat(data[i][lastCountCol - 1]) || 0) : 0;
    const autoCheck = autoCheckCol > 0 ? String(data[i][autoCheckCol - 1]).toLowerCase() !== 'false' : true;

    if (!autoCheck || !url || !String(url).trim().startsWith('http')) continue;

    const res = scrapeRawUrl(url, pattern);
    if (res.success) {
      const newText = res.rawText;
      const newCount = res.chapterCount;
      const isChanged = (oldText !== '' && oldText !== newText) || (oldCount > 0 && newCount > oldCount);

      let status = 'เป็นปัจจุบัน';
      if (isChanged) {
        const diff = newCount > oldCount && oldCount > 0 ? (newCount - oldCount) : 1;
        status = 'มีตอนใหม่ (+' + diff + ' ตอน)';
        newUpdates.push({
          mangaName: mangaName,
          oldText: oldText,
          newText: newText,
          url: url,
          newCount: newCount
        });
        if (updatedAtCol > 0) sheet.getRange(rowNum, updatedAtCol).setValue(now);
      }

      if (lastTextCol > 0) sheet.getRange(rowNum, lastTextCol).setValue(newText);
      if (lastCountCol > 0) sheet.getRange(rowNum, lastCountCol).setValue(newCount);
      if (statusCol > 0) sheet.getRange(rowNum, statusCol).setValue(status);
      if (lastCheckedCol > 0) sheet.getRange(rowNum, lastCheckedCol).setValue(now);
    } else {
      if (statusCol > 0) sheet.getRange(rowNum, statusCol).setValue('ตรวจสอบไม่ได้: ' + (res.error || ''));
      if (lastCheckedCol > 0) sheet.getRange(rowNum, lastCheckedCol).setValue(now);
    }
  }

  // Send Telegram notification if updates found
  if (notifyTelegram && newUpdates.length > 0 && TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    try {
      let msg = '🚨 <b>[แจ้งเตือนต้นฉบับอัปเดตตอนใหม่!]</b>\n\n';
      newUpdates.forEach((u, idx) => {
        msg += (idx + 1) + '. 📖 <b>' + u.mangaName + '</b>\n';
        msg += '   ├ เดิม: ' + (u.oldText || 'เพิ่งเริ่มติดตาม') + '\n';
        msg += '   ├ ใหม่: <b>' + u.newText + '</b>\n';
        msg += '   └ 🔗 <a href="' + u.url + '">เปิดดูต้นฉบับ</a>\n\n';
      });
      sendTelegramMessage(TELEGRAM_CHAT_ID, msg);
    } catch (e) {
      console.error('Telegram notification error:', e);
    }
  }

  return {
    success: true,
    checkedAt: now.toISOString(),
    newUpdatesCount: newUpdates.length,
    newUpdates: newUpdates,
    list: getRawTrackerList()
  };
}

function setupHourlyTrackerTrigger() {
  const functionName = 'hourlyRawTrackerJob';
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === functionName) {
      ScriptApp.deleteTrigger(t);
    }
  });

  const newTrigger = ScriptApp.newTrigger(functionName)
    .timeBased()
    .everyHours(1)
    .create();

  return {
    success: true,
    triggerId: newTrigger.getUniqueId(),
    message: 'ตั้งระบบตรวจสอบต้นฉบับอัตโนมัติทุกๆ 1 ชั่วโมงเรียบร้อยแล้ว'
  };
}

function hourlyRawTrackerJob() {
  checkAllRawTrackers(true);
}
