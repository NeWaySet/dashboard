# Campus System Dashboard

Одностраничный dashboard для просмотра занятости аудиторий. В приложении есть интерактивная карта корпусов, поиск по аудитории, преподавателю и группе, фильтр по дате и паре, подсветка свободных/занятых/найденных аудиторий и выезжающее меню расписания аудитории.

## Состав проекта

- `frontend` - React + Vite SPA.
- `backend` - FastAPI API.
- `database/init/001_dump_rasp.sql` - локальный SQL-дамп расписания для PostgreSQL.
- `docker-compose.yml` - запуск PostgreSQL, backend и frontend одной командой.

## Быстрый запуск через Docker

1. Убедитесь, что Docker Desktop запущен.
2. Из корня проекта выполните:

```bash
docker compose up --build
```

Первый запуск может занять несколько минут: PostgreSQL импортирует `database/init/001_dump_rasp.sql`.

После запуска:

- Frontend: http://localhost:3000
- PostgreSQL из Docker: `localhost:5433`, база `dump_rasp`, пользователь `postgres`, пароль `postgres`

## Если дамп не импортировался

PostgreSQL выполняет файлы из `database/init` только при первом создании volume. Если контейнер базы уже запускался раньше, пересоздайте volume:

```bash
docker compose down -v
docker compose up --build
```

## Настройка `.env`

Файл `.env` необязателен: docker-compose уже содержит рабочие значения по умолчанию. Если нужно изменить пароль или базу, создайте `.env` по примеру:

```env
DEMO_MODE=false
POSTGRES_DB=dump_rasp
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_PORT=5433
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

Если хотите подключиться к базе из pgAdmin вместо контейнера `db`, задайте `DATABASE_URL`:

```env
DEMO_MODE=false
DATABASE_URL=postgresql+asyncpg://postgres:YOUR_PASSWORD@host.docker.internal:5432/dump_rasp
```

Для локального запуска backend без Docker используйте `localhost` вместо `host.docker.internal`.

## Проверка API

```bash
curl http://localhost:8000/api/health
curl http://localhost:8000/api/rooms
curl "http://localhost:8000/api/schedule?date=2026-06-03"
curl "http://localhost:8000/api/search/group?query=КМБО&date=2026-06-03"
```

## Локальный запуск без Docker

Backend:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Локальный frontend будет доступен на http://localhost:5173.

## Проверка сборки

```bash
cd frontend
npm.cmd run build
```

```bash
python -m compileall backend/app
```

## Работа с БД

Backend адаптирован под структуру дампа:

- `sc_rasp18`, `sc_rasp18_days` - занятия и даты;
- `sc_rasp18_rooms` - аудитории занятий;
- `sc_rasp18_groups`, `sc_group` - учебные группы;
- `sc_rasp18_preps`, `sc_prep` - преподаватели;
- `sc_disc` - дисциплины.

В dump строки лежат в mojibake-виде, например `Рђ-2` вместо `А-2`. Backend автоматически восстанавливает кириллицу при чтении данных, поэтому карта и поиск работают с нормальными названиями аудиторий, групп, преподавателей и предметов.

## Полезные команды

Остановить контейнеры:

```bash
docker compose down
```

Остановить контейнеры и удалить volume PostgreSQL:

```bash
docker compose down -v
```

Посмотреть логи backend:

```bash
docker compose logs backend
```

Посмотреть логи базы:

```bash
docker compose logs db
```
