from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import rooms, schedule, search


settings = get_settings()

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rooms.router, prefix="/api")
app.include_router(schedule.router, prefix="/api")
app.include_router(search.router, prefix="/api")


@app.get("/api/health")
async def health_check() -> dict[str, str | bool]:
    return {
        "status": "ok",
        "demo_mode": settings.should_use_demo_data,
    }
