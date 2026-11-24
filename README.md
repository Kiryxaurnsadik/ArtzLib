# ArtzLib
STALKER RP - Artz RolePlay

Сайт-«терминалы» для ролевой игры. У каждой группировки свои устройства, и на каждом только её документы.

- **АГАТ 5189**: ЭЛТ-монитор с оболочкой в духе Windows XP, проводником и двухпанельным файловым менеджером.
- **Ноутбук**: оболочка в духе Windows Vista с «аэро»-окнами, гаджетами и проводником.
- **КПК S2, КПК ТЧ, КПК ЧН, КПК ЗП**: четыре отдельных КПК в духе STALKER 2 и старой трилогии. В КПК только информация: записи группировки и сведения о владельце. У S2 есть несколько вариантов оформления (выбираются в админке).

Оформление сделано заново, как оммаж: ассеты игр и Microsoft не используются.

## Как посмотреть

Сайт статический, сборка не нужна.

- **GitHub Pages**: Settings → Pages → Deploy from a branch → `main` / `(root)`. Сайт уже открыт по адресу https://kiryxaurnsadik.github.io/ArtzLib/.
- **Локально**: `python3 -m http.server 8000` в папке репозитория, затем открыть http://localhost:8000. Если открыть `index.html` двойным щелчком, сайт не заработает: браузер не даёт читать JSON с диска.

Адреса страниц:

- `#/niichaz/pda-s2`: только это устройство. Перейти с него никуда нельзя, это ссылка для игрока.
- `#/niichaz`: выбор устройств одной группировки.
- `#/`: заглушка «Терминал не выбран». Список всех группировок можно включить в админке.
- Устройства: `agat`, `laptop`, `pda-s2`, `pda-shoc`, `pda-cs`, `pda-cop`.
- Если у группировки задан ключ доступа, к ссылке добавляется `?k=ключ`. Готовые ссылки есть в админке во вкладке «Ссылки».

## Готовые ссылки

Сайт: https://kiryxaurnsadik.github.io/ArtzLib/. Ссылки ниже работают, пока у группировки не задан ключ доступа. Если ключ задан, к ссылке добавляется `?k=ключ`, а точные ссылки с ключом есть в админке во вкладке «Ссылки».

Админка: https://kiryxaurnsadik.github.io/ArtzLib/admin.html

Язык: кнопка RU/EN/DE есть на каждой странице, выбор запоминается в браузере. Чтобы ссылка сразу открывалась на нужном языке, добавьте `?lang=en` или `?lang=de` (вместе с ключом: `?k=ключ&lang=en`). Переводы документов лежат в `content/<группировка>/en/` и `content/<группировка>/de/`; если перевода нет, показывается русский текст.

| Группировка | Все устройства | Агат 5189 | Ноутбук | КПК STALKER 2 | КПК ТЧ | КПК ЧН | КПК ЗП |
| --- | --- | --- | --- | --- | --- | --- | --- |
| НИИЧАЗ | [открыть](https://kiryxaurnsadik.github.io/ArtzLib/#/niichaz) | [ссылка](https://kiryxaurnsadik.github.io/ArtzLib/#/niichaz/agat) | [ссылка](https://kiryxaurnsadik.github.io/ArtzLib/#/niichaz/laptop) | [ссылка](https://kiryxaurnsadik.github.io/ArtzLib/#/niichaz/pda-s2) | [ссылка](https://kiryxaurnsadik.github.io/ArtzLib/#/niichaz/pda-shoc) | [ссылка](https://kiryxaurnsadik.github.io/ArtzLib/#/niichaz/pda-cs) | [ссылка](https://kiryxaurnsadik.github.io/ArtzLib/#/niichaz/pda-cop) |
| Чистое Небо | [открыть](https://kiryxaurnsadik.github.io/ArtzLib/#/clear-sky) | [ссылка](https://kiryxaurnsadik.github.io/ArtzLib/#/clear-sky/agat) | [ссылка](https://kiryxaurnsadik.github.io/ArtzLib/#/clear-sky/laptop) | [ссылка](https://kiryxaurnsadik.github.io/ArtzLib/#/clear-sky/pda-s2) | [ссылка](https://kiryxaurnsadik.github.io/ArtzLib/#/clear-sky/pda-shoc) | [ссылка](https://kiryxaurnsadik.github.io/ArtzLib/#/clear-sky/pda-cs) | [ссылка](https://kiryxaurnsadik.github.io/ArtzLib/#/clear-sky/pda-cop) |
| ИИГ | [открыть](https://kiryxaurnsadik.github.io/ArtzLib/#/iig) | [ссылка](https://kiryxaurnsadik.github.io/ArtzLib/#/iig/agat) | [ссылка](https://kiryxaurnsadik.github.io/ArtzLib/#/iig/laptop) | [ссылка](https://kiryxaurnsadik.github.io/ArtzLib/#/iig/pda-s2) | [ссылка](https://kiryxaurnsadik.github.io/ArtzLib/#/iig/pda-shoc) | [ссылка](https://kiryxaurnsadik.github.io/ArtzLib/#/iig/pda-cs) | [ссылка](https://kiryxaurnsadik.github.io/ArtzLib/#/iig/pda-cop) |
| Искра | [открыть](https://kiryxaurnsadik.github.io/ArtzLib/#/iskra) | [ссылка](https://kiryxaurnsadik.github.io/ArtzLib/#/iskra/agat) | [ссылка](https://kiryxaurnsadik.github.io/ArtzLib/#/iskra/laptop) | [ссылка](https://kiryxaurnsadik.github.io/ArtzLib/#/iskra/pda-s2) | [ссылка](https://kiryxaurnsadik.github.io/ArtzLib/#/iskra/pda-shoc) | [ссылка](https://kiryxaurnsadik.github.io/ArtzLib/#/iskra/pda-cs) | [ссылка](https://kiryxaurnsadik.github.io/ArtzLib/#/iskra/pda-cop) |

На каждом устройстве есть кнопка полноэкранного режима (в углу): остаётся только экран, без корпуса. На телефоне корпус скрывается сам.

## Админка

`admin.html`. Пароль по умолчанию **artz**, его стоит сменить во вкладке «Публикация». Это защита «от случайного зрителя», а не настоящая: сайт статический.

- **Экраны**: состояние каждого устройства. Варианты: «Норма», «Заблокировано» (можно задать код разблокировки), «Данные стёрты», «Повреждено», «Нет сигнала», «Своё сообщение». Есть кнопки «всё заблокировать / стереть / вернуть» и бегущая строка-оповещение.
- **Ссылки**: готовые ссылки на каждое устройство для раздачи игрокам.
- **Группировки**: всё, что видно на терминалах.
  - Название, девиз, эмблема, цвета, ключ доступа, какие устройства есть у группировки.
  - Имя и должность пользователя, аватарка, обои Агата и ноутбука, эмблема на рабочем столе.
  - Название систем, имя компьютера, строки загрузки Агата, пароль ноутбука.
  - Оформление КПК S2, ранг и репутация.
  - Разделы документов (можно добавлять свои).
  - Документы: «+ Исследование», «+ Разработка» и другие, правка текста с предпросмотром, вставка картинок, фото записи для КПК.
  - **Импорт** документов из `.docx` (Word, Google Docs: «Файл → Скачать → .docx»), `.md`, `.txt`, `.html`.
  - **Экспорт** документа в `.docx` или `.md` и всех документов группировки одним `.zip`.
- **Публикация**: сохраняет изменения в репозиторий.

Пока изменения не опубликованы, они хранятся только в вашем браузере (черновик). Галочка «Показывать черновик на сайте» позволяет посмотреть их на сайте, но только вам.

### Публикация через GitHub

1. Создайте fine-grained token: GitHub → Settings → Developer settings → Fine-grained tokens. Доступ только к репозиторию `ArtzLib`, право **Contents: Read and write**.
2. Вставьте его во вкладке «Публикация» и нажмите «Опубликовать». Админка запишет тексты документов в `content/`, загруженные картинки в `assets/uploads/`, а настройки в `data/factions.json` и `data/state.json`.
3. Открытые страницы сайта подхватят новые состояния экранов примерно за 15 секунд (плюс кэш GitHub Pages, обычно до минуты).

Токен хранится только в вашем браузере, и то если отмечено «запомнить». В репозиторий он не попадает.

Без токена можно скачать оба JSON и закоммитить их вручную.

## Структура

```
index.html, admin.html    страницы
assets/js/                логика (app, agat, laptop, pda, overlays, admin, ...)
assets/css/               стили устройств
assets/img/emblems/       эмблемы группировок
assets/docs/              картинки из документов
content/<группировка>/    документы в Markdown
assets/uploads/           картинки, загруженные через админку
data/factions.json        группировки, документы, журнал, карта
data/state.json           состояния экранов, оповещение, хэш пароля
```

### Документы

Обычный Markdown: заголовки, списки, таблицы, цитаты, картинки. Документ с `"kind": "chat"` показывается как переписка (дискета):

```
@system Текст системы
@q Вопрос пользователя
@a Ответ терминала
```

### Новая группировка

Проще всего через админку: «Фракции» → «+ Новая группировка» или «Создать вариацию этой», затем публикация. Вручную: добавить объект в `factions` в `data/factions.json`, а тексты положить в `content/<id>/`.

## Источники

- Документы проекта (4 Google Docs) и макеты из Figma. У НИИЧАЗ и «Искры» только их собственные документы.
- На сайте только РП-информация, без справок из вики.
- Тексты «Чистого Неба» и ИИГ написаны для РП: в исходных документах их нет.
