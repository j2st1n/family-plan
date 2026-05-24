import asyncio
import json
from collections import defaultdict
from collections.abc import AsyncGenerator
from dataclasses import dataclass
from itertools import count
from uuid import UUID


@dataclass(frozen=True)
class Event:
    topic: str
    parent_id: UUID
    child_id: UUID | None
    reason: str
    version: int

    def data(self) -> dict[str, str | int | None]:
        return {
            "topic": self.topic,
            "parent_id": str(self.parent_id),
            "child_id": str(self.child_id) if self.child_id else None,
            "reason": self.reason,
            "version": self.version,
        }

    def sse(self) -> str:
        return f"event: update\ndata: {json.dumps(self.data(), separators=(',', ':'))}\n\n"


@dataclass(frozen=True)
class Subscriber:
    loop: asyncio.AbstractEventLoop
    queue: asyncio.Queue[Event]


class EventHub:
    def __init__(self, queue_size: int = 100) -> None:
        self._queue_size = queue_size
        self._parent_subscribers: dict[UUID, set[Subscriber]] = defaultdict(set)
        self._versions = count(1)

    def publish(self, parent_id: UUID, topic: str, reason: str, child_id: UUID | None = None) -> Event:
        event = Event(
            topic=topic,
            parent_id=parent_id,
            child_id=child_id,
            reason=reason,
            version=next(self._versions),
        )
        for subscriber in list(self._parent_subscribers.get(parent_id, set())):
            subscriber.loop.call_soon_threadsafe(self._put_event, subscriber.queue, event)
        return event

    def _put_event(self, queue: asyncio.Queue[Event], event: Event) -> None:
        if queue.full():
            try:
                queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
        queue.put_nowait(event)

    async def subscribe(self, parent_id: UUID) -> AsyncGenerator[Event, None]:
        queue: asyncio.Queue[Event] = asyncio.Queue(maxsize=self._queue_size)
        subscriber = Subscriber(asyncio.get_running_loop(), queue)
        self._parent_subscribers[parent_id].add(subscriber)
        try:
            while True:
                yield await queue.get()
        finally:
            subscribers = self._parent_subscribers.get(parent_id)
            if subscribers is not None:
                subscribers.discard(subscriber)
                if not subscribers:
                    self._parent_subscribers.pop(parent_id, None)

    def subscriber_count(self, parent_id: UUID) -> int:
        return len(self._parent_subscribers.get(parent_id, set()))

    def reset(self) -> None:
        self._parent_subscribers.clear()
        self._versions = count(1)


event_hub = EventHub()
