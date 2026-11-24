// Языки сайта: русский (основной), английский и немецкий.
// Строки интерфейса переводятся по русскому тексту: t('Назад') → 'Back'.
// Тексты группировок и документов берутся из поля i18n в data/factions.json
// и из файлов content/<группировка>/<язык>/<документ>.md.
const safe = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* приватный режим */ } },
};

export const LANGS = { ru: 'RU', en: 'EN', de: 'DE' };
const LOCALES = { ru: 'ru-RU', en: 'en-GB', de: 'de-DE' };
const LS = 'artz.lang';

let cur = 'ru';

export function initLang(fromUrl) {
  const saved = safe.get(LS);
  cur = LANGS[fromUrl] ? fromUrl : LANGS[saved] ? saved : 'ru';
  document.documentElement.lang = cur;
  return cur;
}
export function getLang() { return cur; }
export function setLang(l) {
  if (!LANGS[l]) return;
  cur = l;
  safe.set(LS, l);
  document.documentElement.lang = l;
}
export function nextLang() {
  const k = Object.keys(LANGS);
  return k[(k.indexOf(cur) + 1) % k.length];
}
export const locale = () => LOCALES[cur];

export function t(s, vars) {
  let out = (cur !== 'ru' && DICT[cur]?.[s]) || s;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
  return out;
}

// ---------- данные группировок ----------
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
function merge(base, over) {
  if (!isObj(over)) return base;
  const out = { ...base };
  Object.entries(over).forEach(([k, v]) => {
    if (v === '' || v == null) return;
    out[k] = isObj(v) && isObj(base?.[k]) ? merge(base[k], v) : v;
  });
  return out;
}

// Копия данных с подставленными переводами для текущего языка.
export function localize(data, lang = cur) {
  if (lang === 'ru') return data;
  const F = data.factions;
  const factions = {
    ...F,
    categories: { ...(F.categories || {}), ...(F.i18n?.[lang]?.categories || {}) },
    factions: F.factions.map((f) => {
      const { docs, i18n, ...rest } = f;
      const lf = merge(rest, i18n?.[lang]);
      lf.i18n = i18n;
      lf.docs = (docs || []).map((d) => {
        const ld = merge(d, d.i18n?.[lang]);
        if (d.i18n?.[lang]?.meta) ld.meta = d.i18n[lang].meta;
        if (d.file && !d.i18n?.[lang]?.file) {
          ld.fileOrig = d.file;
          ld.file = d.file.replace(/\/([^/]+)$/, `/${lang}/$1`);
        }
        return ld;
      });
      return lf;
    }),
  };
  return { ...data, factions };
}

// ---------- словари интерфейса ----------
const DICT = {
  en: {
    // общие
    'Терминал ЧАЗ': 'CAZ Terminal',
    'Терминалы ЧАЗ': 'CAZ Terminals',
    'Терминалы': 'Terminals',
    'Терминал не выбран': 'No terminal selected',
    'Терминал не найден': 'Terminal not found',
    'Нет доступа к терминалу': 'Access to the terminal denied',
    'Откройте ссылку на терминал, которую выдал ведущий игры.': 'Open the terminal link you were given.',
    'Архивы группировок Чернобыльской аномальной зоны.': 'Faction archives of the Chernobyl Anomalous Zone.',
    'в сети': 'online',
    'Нет связи с архивом': 'No connection to the archive',
    'Показан черновик из админки (только в этом браузере)': 'Showing an admin draft (this browser only)',
    'Только экран, во весь экран': 'Screen only, full screen',
    'Полноэкранный режим': 'Full screen',
    'Язык': 'Language',
    'Загрузка...': 'Loading...',
    'Документ пуст.': 'The document is empty.',
    'Автор': 'Author',
    'Документ не найден': 'Document not found',
    'Зона': 'Zone',
    'ЧАЗ': 'CAZ',
    'Оператор': 'Operator',
    'Корзина': 'Recycle Bin',
    'Корзина пуста.': 'The Recycle Bin is empty.',
    'Свернуть': 'Minimise',
    'Развернуть': 'Maximise',
    'Закрыть': 'Close',
    // устройства и статусы
    'Агат 5189': 'Agat 5189',
    'Ноутбук': 'Laptop',
    'КПК S2': 'PDA S2',
    'КПК ТЧ': 'PDA SoC',
    'КПК ЧН': 'PDA CS',
    'КПК ЗП': 'PDA CoP',
    'КПК': 'PDA',
    'ЭЛТ-монитор с системой в стиле XP': 'CRT monitor with an XP-style system',
    'Полевой ноутбук с системой в стиле Vista': 'Field laptop with a Vista-style system',
    'КПК в стиле STALKER 2': 'PDA in the STALKER 2 style',
    'КПК в стиле «Тени Чернобыля»': 'PDA in the Shadow of Chernobyl style',
    'КПК в стиле «Чистого Неба»': 'PDA in the Clear Sky style',
    'КПК в стиле «Зова Припяти»': 'PDA in the Call of Pripyat style',
    'Норма': 'Normal',
    'Заблокировано': 'Locked',
    'Данные стёрты': 'Data wiped',
    'Сбой / повреждение': 'Failure / corruption',
    'Нет сигнала': 'No signal',
    'Своё сообщение': 'Custom message',
    // КПК
    'К списку': 'To the list',
    'Назад': 'Back',
    'Владелец': 'Owner',
    'Должность': 'Position',
    'Ранг': 'Rank',
    'Репутация': 'Reputation',
    'Местоположение': 'Location',
    'Записей': 'Entries',
    'Заметки': 'Notes',
    'Сведения': 'Profile',
    'Носитель данных': 'Data carrier',
    'Найдено': 'Found',
    'Все записи': 'All entries',
    'Энциклопедия': 'Encyclopedia',
    'Личное дело': 'Personal file',
    'локальная сеть': 'local network',
    // Агат
    'Питание': 'Power',
    'Терминал': 'Terminal',
    'Загрузка системы...': 'Loading system...',
    '© НПО «Агат», Терминальная редакция для ЧАЗ': '© NPO Agat, Terminal Edition for the CAZ',
    '© НПО «Агат»': '© NPO Agat',
    'Чтобы начать работу, щёлкните имя пользователя': 'To begin, click your user name',
    'Выключить компьютер': 'Turn off computer',
    'пуск': 'start',
    'Сеть ЧАЗ-NET': 'CAZ-NET network',
    'Выход из системы': 'Log off',
    'Выключение': 'Turn off',
    'Просмотр документа': 'Document viewer',
    'Файл': 'File',
    'Правка': 'Edit',
    'Вид': 'View',
    'Избранное': 'Favourites',
    'Сервис': 'Tools',
    'Справка': 'Help',
    'Адрес': 'Address',
    'Задачи для файлов': 'File tasks',
    'Документов: {n}': 'Documents: {n}',
    'Другие места': 'Other places',
    'Папка': 'Folder',
    'Левая': 'Left',
    'Файлы': 'Files',
    'Команды': 'Commands',
    'Параметры': 'Options',
    'Правая': 'Right',
    '{n} файлов': '{n} files',
    'Помощь': 'Help',
    'Просм': 'View',
    'Копир': 'Copy',
    'Удален': 'Delete',
    'Выход': 'Quit',
    'ДИСК': 'DISK',
    'ДОК': 'DOC',
    'Мой терминал': 'My terminal',
    'Теперь питание компьютера можно отключить.': 'It is now safe to turn off your computer.',
    // ноутбук
    'ПОЛЕВОЙ': 'FIELD',
    'Пароль': 'Password',
    'Войти': 'Log in',
    'Подсказка: любой пароль': 'Hint: any password',
    'Неверный пароль. Повторите попытку.': 'Wrong password. Try again.',
    'Добро пожаловать': 'Welcome',
    'Радиационный фон': 'Radiation level',
    'мкЗв/ч': 'µSv/h',
    'Пси-фон': 'Psi level',
    'усл. ед.': 'units',
    'Пуск': 'Start',
    'Начать поиск': 'Start search',
    'Поиск документов': 'Search documents',
    'Блокировать': 'Lock',
    'Завершение работы': 'Shut down',
    'Вперёд': 'Forward',
    'Поиск': 'Search',
    'Упорядочить': 'Organise',
    'Виды': 'Views',
    'Общий доступ': 'Share',
    'Выберите файл для предварительного просмотра.': 'Select a file to preview.',
    'Результаты поиска: {q}': 'Search results: {q}',
    'Документы': 'Documents',
    'Открыть': 'Open',
    'Элементов: {n}': 'Items: {n}',
    'Компьютер': 'Computer',
    'Ничего не найдено': 'Nothing found',
    'Завершение работы...': 'Shutting down...',
    // «Дискета»
    'Запросы к {who}:': 'Queries to {who}:',
    'ИИ': 'AI',
    'Нет данных. Повторите запрос.': 'No data. Repeat the query.',
    // оверлеи
    'ДОСТУП ЗАБЛОКИРОВАН': 'ACCESS LOCKED',
    'ДАННЫЕ СТЁРТЫ': 'DATA WIPED',
    'НЕТ СИГНАЛА': 'NO SIGNAL',
    'Компьютер заблокирован': 'Computer locked',
    'Диск очищен': 'Disk erased',
    'Нет питания': 'No power',
    'КПК ЗАБЛОКИРОВАН': 'PDA LOCKED',
    'ПАМЯТЬ КПК ОЧИЩЕНА': 'PDA MEMORY ERASED',
    'НЕТ СВЯЗИ': 'NO CONNECTION',
    'Код доступа': 'Access code',
    'Ввод': 'Enter',
    'Терминал {name} заблокирован администратором.': 'Terminal {name} has been locked by the administrator.',
    'Неверный код. Попыток: {n}': 'Wrong code. Attempts: {n}',
    'Форматирование...': 'Formatting...',
    'удалено: {f}': 'deleted: {f}',
    '0 байт в 0 файлах': '0 bytes in 0 files',
    'Свободно: 100%': 'Free: 100%',
    'ОШИБКА ЧТЕНИЯ ДАННЫХ': 'DATA READ ERROR',
    'Сектор повреждён. Часть файлов недоступна.': 'Sector damaged. Some files are unavailable.',
    'Системное сообщение': 'System message',
    'ОК': 'OK',
  },
  de: {
    'Терминал ЧАЗ': 'CAZ-Terminal',
    'Терминалы ЧАЗ': 'CAZ-Terminals',
    'Терминалы': 'Terminals',
    'Терминал не выбран': 'Kein Terminal ausgewählt',
    'Терминал не найден': 'Terminal nicht gefunden',
    'Нет доступа к терминалу': 'Kein Zugriff auf das Terminal',
    'Откройте ссылку на терминал, которую выдал ведущий игры.': 'Öffnen Sie den Terminal-Link, den Sie erhalten haben.',
    'Архивы группировок Чернобыльской аномальной зоны.': 'Archive der Gruppierungen der Anomalen Zone von Tschernobyl.',
    'в сети': 'online',
    'Нет связи с архивом': 'Keine Verbindung zum Archiv',
    'Показан черновик из админки (только в этом браузере)': 'Entwurf aus der Verwaltung (nur in diesem Browser)',
    'Только экран, во весь экран': 'Nur Bildschirm, Vollbild',
    'Полноэкранный режим': 'Vollbild',
    'Язык': 'Sprache',
    'Загрузка...': 'Wird geladen...',
    'Документ пуст.': 'Das Dokument ist leer.',
    'Автор': 'Verfasser',
    'Документ не найден': 'Dokument nicht gefunden',
    'Зона': 'Zone',
    'ЧАЗ': 'CAZ',
    'Оператор': 'Operator',
    'Корзина': 'Papierkorb',
    'Корзина пуста.': 'Der Papierkorb ist leer.',
    'Свернуть': 'Minimieren',
    'Развернуть': 'Maximieren',
    'Закрыть': 'Schließen',
    'Агат 5189': 'Agat 5189',
    'Ноутбук': 'Laptop',
    'КПК S2': 'PDA S2',
    'КПК ТЧ': 'PDA SoC',
    'КПК ЧН': 'PDA CS',
    'КПК ЗП': 'PDA CoP',
    'КПК': 'PDA',
    'ЭЛТ-монитор с системой в стиле XP': 'Röhrenmonitor mit einem System im XP-Stil',
    'Полевой ноутбук с системой в стиле Vista': 'Feldlaptop mit einem System im Vista-Stil',
    'КПК в стиле STALKER 2': 'PDA im Stil von STALKER 2',
    'КПК в стиле «Тени Чернобыля»': 'PDA im Stil von „Shadow of Chernobyl“',
    'КПК в стиле «Чистого Неба»': 'PDA im Stil von „Clear Sky“',
    'КПК в стиле «Зова Припяти»': 'PDA im Stil von „Call of Pripyat“',
    'Норма': 'Normal',
    'Заблокировано': 'Gesperrt',
    'Данные стёрты': 'Daten gelöscht',
    'Сбой / повреждение': 'Störung / Beschädigung',
    'Нет сигнала': 'Kein Signal',
    'Своё сообщение': 'Eigene Meldung',
    'К списку': 'Zur Liste',
    'Назад': 'Zurück',
    'Владелец': 'Besitzer',
    'Должность': 'Funktion',
    'Ранг': 'Rang',
    'Репутация': 'Ruf',
    'Местоположение': 'Standort',
    'Записей': 'Einträge',
    'Заметки': 'Notizen',
    'Сведения': 'Profil',
    'Носитель данных': 'Datenträger',
    'Найдено': 'Gefunden',
    'Все записи': 'Alle Einträge',
    'Энциклопедия': 'Enzyklopädie',
    'Личное дело': 'Personalakte',
    'локальная сеть': 'lokales Netz',
    'Питание': 'Strom',
    'Терминал': 'Terminal',
    'Загрузка системы...': 'System wird geladen...',
    '© НПО «Агат», Терминальная редакция для ЧАЗ': '© NPO Agat, Terminalausgabe für die CAZ',
    '© НПО «Агат»': '© NPO Agat',
    'Чтобы начать работу, щёлкните имя пользователя': 'Klicken Sie zum Starten auf Ihren Benutzernamen',
    'Выключить компьютер': 'Computer ausschalten',
    'пуск': 'start',
    'Сеть ЧАЗ-NET': 'Netz CAZ-NET',
    'Выход из системы': 'Abmelden',
    'Выключение': 'Ausschalten',
    'Просмотр документа': 'Dokumentanzeige',
    'Файл': 'Datei',
    'Правка': 'Bearbeiten',
    'Вид': 'Ansicht',
    'Избранное': 'Favoriten',
    'Сервис': 'Extras',
    'Справка': 'Hilfe',
    'Адрес': 'Adresse',
    'Задачи для файлов': 'Datei-Aufgaben',
    'Документов: {n}': 'Dokumente: {n}',
    'Другие места': 'Andere Orte',
    'Папка': 'Ordner',
    'Левая': 'Links',
    'Файлы': 'Dateien',
    'Команды': 'Befehle',
    'Параметры': 'Optionen',
    'Правая': 'Rechts',
    '{n} файлов': '{n} Dateien',
    'Помощь': 'Hilfe',
    'Просм': 'Ansicht',
    'Копир': 'Kopie',
    'Удален': 'Lösch',
    'Выход': 'Ende',
    'ДИСК': 'DISK',
    'ДОК': 'DOK',
    'Мой терминал': 'Mein Terminal',
    'Теперь питание компьютера можно отключить.': 'Sie können den Computer jetzt ausschalten.',
    'ПОЛЕВОЙ': 'FELD',
    'Пароль': 'Kennwort',
    'Войти': 'Anmelden',
    'Подсказка: любой пароль': 'Hinweis: beliebiges Kennwort',
    'Неверный пароль. Повторите попытку.': 'Falsches Kennwort. Versuchen Sie es erneut.',
    'Добро пожаловать': 'Willkommen',
    'Радиационный фон': 'Strahlungspegel',
    'мкЗв/ч': 'µSv/h',
    'Пси-фон': 'Psi-Pegel',
    'усл. ед.': 'Einh.',
    'Пуск': 'Start',
    'Начать поиск': 'Suche starten',
    'Поиск документов': 'Dokumente durchsuchen',
    'Блокировать': 'Sperren',
    'Завершение работы': 'Herunterfahren',
    'Вперёд': 'Vorwärts',
    'Поиск': 'Suche',
    'Упорядочить': 'Organisieren',
    'Виды': 'Ansichten',
    'Общий доступ': 'Freigeben',
    'Выберите файл для предварительного просмотра.': 'Wählen Sie eine Datei für die Vorschau.',
    'Результаты поиска: {q}': 'Suchergebnisse: {q}',
    'Документы': 'Dokumente',
    'Открыть': 'Öffnen',
    'Элементов: {n}': 'Elemente: {n}',
    'Компьютер': 'Computer',
    'Ничего не найдено': 'Nichts gefunden',
    'Завершение работы...': 'Wird heruntergefahren...',
    'Запросы к {who}:': 'Anfragen an {who}:',
    'ИИ': 'KI',
    'Нет данных. Повторите запрос.': 'Keine Daten. Wiederholen Sie die Anfrage.',
    'ДОСТУП ЗАБЛОКИРОВАН': 'ZUGRIFF GESPERRT',
    'ДАННЫЕ СТЁРТЫ': 'DATEN GELÖSCHT',
    'НЕТ СИГНАЛА': 'KEIN SIGNAL',
    'Компьютер заблокирован': 'Computer gesperrt',
    'Диск очищен': 'Datenträger gelöscht',
    'Нет питания': 'Kein Strom',
    'КПК ЗАБЛОКИРОВАН': 'PDA GESPERRT',
    'ПАМЯТЬ КПК ОЧИЩЕНА': 'PDA-SPEICHER GELÖSCHT',
    'НЕТ СВЯЗИ': 'KEINE VERBINDUNG',
    'Код доступа': 'Zugangscode',
    'Ввод': 'Eingabe',
    'Терминал {name} заблокирован администратором.': 'Terminal {name} wurde vom Administrator gesperrt.',
    'Неверный код. Попыток: {n}': 'Falscher Code. Versuche: {n}',
    'Форматирование...': 'Formatierung...',
    'удалено: {f}': 'gelöscht: {f}',
    '0 байт в 0 файлах': '0 Byte in 0 Dateien',
    'Свободно: 100%': 'Frei: 100 %',
    'ОШИБКА ЧТЕНИЯ ДАННЫХ': 'LESEFEHLER',
    'Сектор повреждён. Часть файлов недоступна.': 'Sektor beschädigt. Einige Dateien sind nicht verfügbar.',
    'Системное сообщение': 'Systemmeldung',
    'ОК': 'OK',
  },
};
