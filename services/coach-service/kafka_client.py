"""aiokafka producer for coach-service."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from aiokafka import AIOKafkaProducer

from config import settings

_producer: AIOKafkaProducer | None = None


async def start_producer() -> None:
    global _producer
    _producer = AIOKafkaProducer(
        bootstrap_servers=settings.kafka_broker_list,
        client_id=settings.kafka_client_id,
        value_serializer=lambda v: json.dumps(v).encode(),
        key_serializer=lambda k: k.encode() if k else None,
    )
    await _producer.start()


async def stop_producer() -> None:
    if _producer:
        await _producer.stop()


async def publish_coaching_message(user_id: str, user_message: str, coach_reply: str) -> None:
    if not _producer:
        return
    event = {
        "eventId": str(uuid.uuid4()),
        "eventType": "coaching.message",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "userId": user_id,
        "payload": {
            "userMessage": user_message,
            "coachReply": coach_reply,
        },
        "metadata": {"service": "coach-service", "version": "1.0"},
    }
    try:
        await _producer.send("coaching.message", value=event, key=user_id)
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("Failed to publish coaching.message: %s", exc)
