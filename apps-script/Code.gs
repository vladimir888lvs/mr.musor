/**
 * Mr. Musor — waitlist backend (Google Apps Script, bound to a Google Sheet).
 *
 * What it does on every application from the website:
 *   1. gives it a number MM-0001, MM-0002, … (later = Kaspi contract number)
 *   2. writes a row to the "Заявки" tab
 *   3. emails you (the owner) the details
 *   4. emails the customer a confirmation in their language (if they gave an email)
 *   The "Сводка по ЖК" tab counts applications per district / ЖК / plan automatically.
 *
 * Setup: see README.md in the website folder (step 2).
 */

var CONFIG = {
  OWNER_EMAIL: '',            // leave empty = the Google account that deploys the script
  SEND_CUSTOMER_EMAIL: true,  // confirmation email to customers who left an email
  DEDUPE_MINUTES: 30          // same phone + apartment within this time = same application
};

var SHEET_APPS = 'Заявки';
var SHEET_SUMMARY = 'Сводка по ЖК';

var COLS = [
  ['id', 'Номер'], ['ts', 'Дата'], ['lang', 'Язык'], ['name', 'Имя'], ['phone', 'Телефон'],
  ['whatsapp', 'WhatsApp'], ['email', 'Email'], ['method', 'Связь'], ['district', 'Район'],
  ['zhk', 'ЖК'], ['street', 'Улица и дом'], ['block', 'Блок'], ['entrance', 'Подъезд'],
  ['floor', 'Этаж'], ['apartment', 'Квартира'], ['elevator', 'Лифт'], ['plan', 'Тариф'],
  ['residents', 'Жильцов'], ['source', 'Источник'], ['comment', 'Комментарий'],
  ['utm', 'UTM'], ['page', 'Страница'], ['status', 'Статус']
];

var LABELS = {
  lang: { ru: 'RU', kk: 'KZ', en: 'EN' },
  whatsapp: { yes: 'да', no: 'нет' },
  method: { whatsapp: 'WhatsApp', call: 'Звонок', email: 'Email' },
  elevator: { yes: 'есть', no: 'нет' },
  plan: { basic: 'Базовый', daily: 'Каждый день', house: 'Частный дом', unsure: 'Не решил' },
  source: { instagram: 'Instagram', neighbors: 'Соседи', flyer: 'Листовка', chat: 'Чат ЖК', '2gis': '2ГИС / поиск', other: 'Другое' }
};

var DISTRICTS = ['Алатауский', 'Алмалинский', 'Ауэзовский', 'Бостандыкский', 'Жетысуский', 'Медеуский', 'Наурызбайский', 'Турксибский'];

/** Run once from the editor (▶ Run → setup) to create the tabs. Safe to run again. */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_APPS) || ss.insertSheet(SHEET_APPS, 0);
  sh.getRange(1, 1, 1, COLS.length).setValues([COLS.map(function (c) { return c[1]; })])
    .setFontWeight('bold').setBackground('#0E1A14').setFontColor('#B9F08A');
  sh.setFrozenRows(1);
  sh.getRange('A:A').setNumberFormat('@');
  sh.getRange('B:B').setNumberFormat('dd.MM.yyyy HH:mm');
  sh.getRange('E:E').setNumberFormat('@');

  // status dropdown for your own follow-up
  var statusCol = colIndex('status');
  sh.getRange(2, statusCol, 1000, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['новая', 'связались', 'ждёт запуска ЖК', 'подключён', 'отказ'], true).build());

  var sum = ss.getSheetByName(SHEET_SUMMARY) || ss.insertSheet(SHEET_SUMMARY);
  sum.clear();
  var L = function (key) { return colLetter(colIndex(key)); };
  var src = "'" + SHEET_APPS + "'!A1:" + colLetter(COLS.length);
  sum.getRange('A1').setValue('Заявки по ЖК и тарифам').setFontWeight('bold').setFontSize(13);
  sum.getRange('A2').setFormula('=IFERROR(QUERY(' + src + ', "select ' + L('district') + ', ' + L('zhk') +
    ', count(' + L('id') + ') where ' + L('id') + ' is not null group by ' + L('district') + ', ' + L('zhk') +
    ' pivot ' + L('plan') + '", 1), "Пока нет заявок")');
  sum.getRange('J1').setValue('Всего по ЖК').setFontWeight('bold').setFontSize(13);
  sum.getRange('J2').setFormula('=IFERROR(QUERY(' + src + ', "select ' + L('zhk') + ', count(' + L('id') + ') where ' +
    L('id') + ' is not null group by ' + L('zhk') + ' order by count(' + L('id') + ') desc label count(' + L('id') + ') \'Заявок\'", 1), "")');
  sum.getRange('M1').setValue('Источники').setFontWeight('bold').setFontSize(13);
  sum.getRange('M2').setFormula('=IFERROR(QUERY(' + src + ', "select ' + L('source') + ', count(' + L('id') + ') where ' +
    L('id') + ' is not null group by ' + L('source') + ' label count(' + L('id') + ') \'Заявок\'", 1), "")');
  sum.getRange('P1').setValue('Всего заявок').setFontWeight('bold').setFontSize(13);
  sum.getRange('P2').setFormula("=COUNTA('" + SHEET_APPS + "'!A2:A)").setFontSize(20).setFontWeight('bold');

  // Ask for mail permission now so the first real application doesn't fail.
  MailApp.getRemainingDailyQuota();
}

function doGet() {
  return json({ ok: true, service: 'Mr. Musor waitlist' });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var d = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    // Spam trap: real people never fill the hidden "website" field.
    if (d.website) return json({ ok: true, id: 'MM-0000' });

    var err = check(d);
    if (err) return json({ ok: false, error: err });

    lock.waitLock(20000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(SHEET_APPS);
    if (!sh) { setup(); sh = ss.getSheetByName(SHEET_APPS); }

    var phone = clean(d.phone, 20);
    var apt = clean(d.apartment, 8);
    var dup = findRecent(sh, phone, apt);
    if (dup) return json({ ok: true, id: dup, duplicate: true });

    var props = PropertiesService.getScriptProperties();
    var n = Math.max(Number(props.getProperty('lastNumber') || 0), sh.getLastRow() - 1) + 1;
    props.setProperty('lastNumber', String(n));
    var id = 'MM-' + ('0000' + n).slice(-4);

    var rec = {
      id: id, ts: new Date(), lang: label('lang', d.lang), name: clean(d.name, 80), phone: phone,
      whatsapp: label('whatsapp', d.whatsapp), email: clean(d.email, 120), method: label('method', d.method),
      district: clean(d.district, 40), zhk: clean(d.zhk, 100), street: clean(d.street, 120),
      block: clean(d.block, 10), entrance: clean(d.entrance, 5), floor: clean(d.floor, 5), apartment: apt,
      elevator: label('elevator', d.elevator), plan: label('plan', d.plan), residents: clean(d.residents, 3),
      source: label('source', d.source), comment: clean(d.comment, 500), utm: clean(d.utm, 200),
      page: clean(d.page, 200), status: 'новая'
    };
    sh.appendRow(COLS.map(function (c) { return rec[c[0]]; }));
    SpreadsheetApp.flush();
    lock.releaseLock();

    try { notifyOwner(rec); } catch (x) { console.error('owner mail', x); }
    if (CONFIG.SEND_CUSTOMER_EMAIL && rec.email) {
      try { confirmCustomer(rec, d.lang); } catch (x) { console.error('customer mail', x); }
    }
    return json({ ok: true, id: id });
  } catch (x) {
    console.error(x);
    return json({ ok: false, error: 'server' });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

/* ---------- helpers ---------- */
function check(d) {
  if (!d || typeof d !== 'object') return 'empty';
  var need = ['name', 'phone', 'district', 'zhk', 'street', 'apartment', 'plan'];
  for (var i = 0; i < need.length; i++) if (!String(d[need[i]] || '').trim()) return 'missing_' + need[i];
  if (!/^\+7\d{10}$/.test(String(d.phone))) return 'bad_phone';
  if (d.consent !== 'yes') return 'no_consent';
  if (DISTRICTS.indexOf(String(d.district)) < 0) return 'bad_district';
  if (!LABELS.plan[d.plan]) return 'bad_plan';
  return '';
}

function findRecent(sh, phone, apt) {
  var last = sh.getLastRow();
  if (last < 2) return '';
  var from = Math.max(2, last - 200);
  var rows = sh.getRange(from, 1, last - from + 1, COLS.length).getValues();
  var cutoff = Date.now() - CONFIG.DEDUPE_MINUTES * 60000;
  var iTs = colIndex('ts') - 1, iPh = colIndex('phone') - 1, iApt = colIndex('apartment') - 1;
  for (var r = rows.length - 1; r >= 0; r--) {
    var ts = rows[r][iTs];
    if (!(ts instanceof Date) || ts.getTime() < cutoff) break;
    if (String(rows[r][iPh]) === phone && String(rows[r][iApt]) === apt) return String(rows[r][0]);
  }
  return '';
}

function notifyOwner(r) {
  var to = CONFIG.OWNER_EMAIL || Session.getEffectiveUser().getEmail();
  if (!to) return;
  var lines = COLS.filter(function (c) { return c[0] !== 'status'; }).map(function (c) {
    var v = r[c[0]];
    if (v instanceof Date) v = Utilities.formatDate(v, 'Asia/Almaty', 'dd.MM.yyyy HH:mm');
    return c[1] + ': ' + (v === '' || v == null ? '—' : v);
  });
  var wa = r.phone.replace(/\D/g, '');
  lines.push('', 'WhatsApp: https://wa.me/' + wa);
  lines.push('Таблица: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl());
  MailApp.sendEmail({
    to: to,
    subject: 'Mr. Musor · новая заявка ' + r.id + ' · ' + r.zhk + ' · ' + r.plan,
    body: lines.join('\n'),
    name: 'Mr. Musor — заявки'
  });
}

function confirmCustomer(r, lang) {
  var t = {
    ru: { s: 'Mr. Musor — заявка ' + r.id + ' принята',
          b: 'Здравствуйте, ' + r.name + '!\n\nСпасибо за заявку в Mr. Musor. Ваш номер: ' + r.id + '.\n\n' +
             'Мы пока не работаем — собираем заявки по ЖК. Когда в «' + r.zhk + '» наберётся достаточно соседей, мы свяжемся с вами, ' +
             'приклеим наклейку на дверь и принесём первый рулон фирменных пакетов. Первые 2 недели — бесплатно.\n\n' +
             'Сейчас ничего платить не нужно. После запуска номер ' + r.id + ' станет номером договора для оплаты в Kaspi.\n\n' +
             'Оставьте пакет у двери — я заберу.\nMr. Musor, Алматы' },
    kk: { s: 'Mr. Musor — ' + r.id + ' өтінімі қабылданды',
          b: 'Сәлеметсіз бе, ' + r.name + '!\n\nMr. Musor-ға өтінім қалдырғаныңызға рахмет. Нөміріңіз: ' + r.id + '.\n\n' +
             'Біз әлі жұмыс істеп жатқан жоқпыз — тұрғын кешендер бойынша өтінім жинап жатырмыз. «' + r.zhk + '» кешенінде көршілер жеткілікті жиналғанда, ' +
             'сізбен хабарласып, есігіңізге жапсырма жапсырамыз және фирмалық пакеттердің алғашқы орамын әкелеміз. Алғашқы 2 апта — тегін.\n\n' +
             'Қазір ештеңе төлеудің қажеті жоқ. Іске қосылғаннан кейін ' + r.id + ' нөмірі Kaspi-де төлеуге арналған шарт нөмірі болады.\n\n' +
             'Пакетті есік алдына қалдырыңыз — мен алып кетемін.\nMr. Musor, Алматы' },
    en: { s: 'Mr. Musor — application ' + r.id + ' received',
          b: 'Hello ' + r.name + ',\n\nThanks for signing up with Mr. Musor. Your number is ' + r.id + '.\n\n' +
             'We’re not operating yet — we’re collecting sign-ups building by building. Once enough neighbors at ' + r.zhk + ' join, we’ll contact you, ' +
             'put the sticker on your door and bring your first roll of branded bags. The first 2 weeks are free.\n\n' +
             'There’s nothing to pay now. After launch, ' + r.id + ' becomes your contract number for paying in Kaspi.\n\n' +
             'Leave the bag at the door, I’ll pick it up.\nMr. Musor, Almaty' }
  }[lang] || null;
  if (!t) return;
  MailApp.sendEmail({ to: r.email, subject: t.s, body: t.b, name: 'Mr. Musor' });
}

function label(group, v) { return (LABELS[group] && LABELS[group][v]) || clean(v, 40); }
function clean(v, max) {
  var s = String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max || 200);
  return /^[=+\-@]/.test(s) && !/^\+7\d{10}$/.test(s) ? "'" + s : s; // block spreadsheet formula injection
}
function colIndex(key) { for (var i = 0; i < COLS.length; i++) if (COLS[i][0] === key) return i + 1; return -1; }
function colLetter(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
