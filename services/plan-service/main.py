"""FastAPI application entry point for plan-service."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import database
import kafka_client
from routes.plans import router as plans_router

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    try:
        await database.init_pool()
        log.info("Database pool initialised")
    except Exception as exc:
        log.warning("Database unavailable at startup: %s", exc)

    try:
        await kafka_client.start_producer()
        await kafka_client.start_consumer()
    except Exception as exc:
        log.warning("Kafka unavailable at startup: %s", exc)

    yield

    # Shutdown
    await kafka_client.stop_consumer()
    await kafka_client.stop_producer()
    await database.close_pool()


app = FastAPI(
    title="Pacr Plan Service",
    description="AI-assisted running training plan generation using Daniels VDOT system",
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

app.include_router(plans_router)


@app.get("/health")
async def health() -> dict:
    return {"service": "plan-service", "version": "1.0.0", "status": "running"}
