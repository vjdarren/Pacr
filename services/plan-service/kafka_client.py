"""aiokafka producer + readiness.calculated consumer."""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import date, datetime

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer

from config import settings

log = logging.getLogger(__name__)

_producer: AIOKafkaProducer | None = None
_consumer_task: asyncio.Task | None = None


# ---------------------------------------------------------------------------
# Producer
# ---------------------------------------------------------------------------

async def start_producer() -> None:
    global _producer
    _producer = AIOKafkaProducer(
        bootstrap_servers=settings.kafka_brokers,
        client_id=settings.kafka_client_id,
        value_serializer=lambda v: json.dumps(v).encode(),
        key_serializer=lambda k: k.encode() if k else None,
    )
    await _producer.start()
    log.info("Kafka producer started")


async def stop_producer() -> None:
    if _producer:
        await _producer.stop()


async def publish_plan_generated(user_id: str, plan_id: str) -> None:
    if not _producer:
        return
    try:
        await _producer.send(
            "plan.generated",
            key=user_id,
            value={
                "eventId": str(uuid.uuid4()),
                "eventType": "plan.generated",
                "timestamp": datetime.utcnow().isoformat(),
                "userId": user_id,
                "payload": {"planId": plan_id},
                "metadata": {"service": "plan-service", "version": "1.0"},
            },
        )
    except Exception:
        log.exception("Failed to publish plan.generated")


async def publish_plan_adapted(user_id: str, plan_id: str, reason: str) -> None:
    if not _producer:
        return
    try:
        await _producer.send(
            "plan.adapted",
            key=user_id,
            value={
                "eventId": str(uuid.uuid4()),
                "eventType": "plan.adapted",
                "timestamp": datetime.utcnow().isoformat(),
                "userId": user_id,
                "payload": {"planId": plan_id, "reason": reason},
                "metadata": {"service": "plan-service", "version": "1.0"},
            },
        )
    except Exception:
        log.exception("Failed to publish plan.adapted")


# ---------------------------------------------------------------------------
# Consumer — readiness.calculated
# ---------------------------------------------------------------------------

async def _consume_readiness_events() -> None:
    """Background task: trigger plan adaptation when overtraining_flag is set."""
    # Import here to avoid circular imports at module load time
    from routes.plans import trigger_adapt_for_user

    consumer = AIOKafkaConsumer(
        "readiness.calculated",
        bootstrap_servers=settings.kafka_brokers,
        group_id=settings.kafka_group_id,
        client_id=f"{settings.kafka_client_id}-consumer",
        value_deserializer=lambda v: json.loads(v.decode()),
        auto_offset_reset="latest",
        enable_auto_commit=True,
    )
    await consumer.start()
    log.info("readiness.calculated consumer started")
    try:
        async for msg in consumer:
            try:
                event = msg.value
                if not isinstance(event, dict):
                    continue
                user_id = event.get("userId")
                payload = event.get("payload", {})
                if payload.get("overtraining_flag") and user_id:
                    log.info(
                        "overtraining_flag detected for %s — triggering plan adapt",
                        user_id,
                    )
                    await trigger_adapt_for_user(user_id, reason="low_readiness")
            except Exception:
                log.exception("Error processing readiness.calculated message")
    finally:
        await consumer.stop()


async def start_consumer() -> None:
    global _consumer_task
    _consumer_task = asyncio.create_task(_consume_readiness_events())


async def stop_consumer() -> None:
    if _consumer_task and not _consumer_task.done():
        _consumer_task.cancel()
        try:
            await _consumer_task
        except asyncio.CancelledError:
            pass
