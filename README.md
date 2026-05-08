# University Rooms Dashboard

Одностраничный dashboard для просмотра занятости аудиторий вуза. Проект показывает карту корпуса, позволяет кликнуть на аудиторию и увидеть занятия в ней, а также искать сегодняшние пары по преподавателю или группе с подсветкой аудиторий на карте.

## Состав проекта

- `frontend` - React + Vite SPA.
- `backend` - FastAPI API.
- `docker-compose.yml` - запуск frontend и backend одной командой.
- `frontend/src/data/mireaMap.generated.json` - сгенерированная карта корпуса `В-78` на основе `https://map.kkmbr.ru/`.
- `frontend/src/data/campusMaps.js` - список доступных корпусов для интерфейса карты: `В-78`, `С-20`, `МП-1`.

## Требования

Для запуска через Docker:

- Docker Desktop.
- Docker Compose.

Для локального запуска без Docker:

- Node.js 20+ или 22+.
- Python 3.12+.
- Доступ к PostgreSQL вуза, если `DEMO_MODE=false`.

## Быстрый запуск через Docker

Из корня проекта выполните:

```bash
docker compose up --build
```

После запуска откройте:

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Swagger/OpenAPI: http://localhost:8000/docs

По умолчанию проект запускается в демо-режиме, поэтому реальная база данных не нужна.

## Настройка `.env`

Создайте файл `.env` в корне проекта. Для демо-режима можно оставить так:

```env
DEMO_MODE=true
DATABASE_URL=
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

Для подключения к PostgreSQL вуза:

```env
DEMO_MODE=false
DATABASE_URL=postgresql+asyncpg://user:password@university-db-host:5432/university_schedule
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

Если база доступна только из сети вуза или через VPN, Docker нужно запускать на машине, где уже есть доступ к этой сети.

## Локальный запуск без Docker

Backend:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend будет доступен на:

```text
http://localhost:8000
```

Frontend в отдельном терминале:

```bash
cd frontend
npm install
npm run dev
```

Frontend будет доступен на:

```text
http://localhost:5173
```

Если PowerShell блокирует `npm`, используйте:

```bash
npm.cmd install
npm.cmd run dev
```

## Проверка сборки

Frontend:

```bash
cd frontend
npm.cmd run build
```

Backend:

```bash
python -m compileall backend/app
```

Docker Compose config:

```bash
docker compose config
```

## Как работает карта

Карта корпуса `В-78` уже сгенерирована и хранится в:

```text
frontend/src/data/mireaMap.generated.json
```

Frontend связывает расписание с картой по названию аудитории: например `А-107`, `Б-210`, `В-214`. Поэтому при подключении реальной БД важно, чтобы поле аудитории в расписании совпадало с названием аудитории на карте или нормализовалось на backend.

Если нужно пересобрать карту из локальной копии сайта, сначала распакуйте архив сайта в `.map-source`, затем выполните:

```bash
node scripts/extract_mirea_map.mjs
```

Для `В-78`, `С-20` и `МП-1` подключены оригинальные SVG-планы этажей с `map.kkmbr.ru`. У `В-78` дополнительно есть граф объектов аудиторий, поэтому кликабельный слой точнее. В SVG `С-20` и `МП-1` аудитории сохранены как графические элементы без `data-object`, поэтому интерактивные зоны для них пока приблизительные и могут уточняться отдельно.

## Ожидаемая схема данных

Backend сейчас рассчитан на простую структуру:

- `rooms` - аудитории.
- `lessons` - занятия на конкретную дату.

Минимальные поля для `lessons`:

- `date`
- `starts_at`
- `ends_at`
- `subject`
- `teacher`
- `group_name`
- `room_id`

Если структура PostgreSQL вуза отличается, проще всего создать SQL view с нужными полями или адаптировать запросы в `backend/app/repository.py`.

## Полезные команды

Остановить контейнеры:

```bash
docker compose down
```

Пересобрать контейнеры:

```bash
docker compose up --build
```

Посмотреть логи backend:

```bash
docker compose logs backend
```

Посмотреть логи frontend:

```bash
docker compose logs frontend
```
