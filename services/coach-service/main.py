"""FastAPI entry point for coach-service."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import database
import kafka_client
import redis_client
from routes.coach import router as coach_router

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await database.init_pool()
        log.info("Database pool initialised")
    except Exception as exc:
        log.warning("Database unavailable at startup: %s", exc)

    try:
        await redis_client.init_redis()
        log.info("Redis connected")
    except Exception as exc:
        log.warning("Redis unavailable at startup: %s", exc)

    try:
        await kafka_client.start_producer()
        log.info("Kafka producer connected")
    except Exception as exc:
        log.warning("Kafka unavailable at startup: %s", exc)

    yield

    await kafka_client.stop_producer()
    await redis_client.close_redis()
    await database.close_pool()


app = FastAPI(
    title="Pacr Coach Service",
    description="Conversational AI running coach powered by Gemini 2.5 Flash",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(coach_router)


@app.get("/health")
async def health() -> dict:
    return {"service": "coach-service", "version": "1.0.0", "status": "running"}
