import asyncio
from uuid import uuid4

import pytest

from app.routes import events
from app.services.event_hub import EventHub


@pytest.fixture
def anyio_backend():
    return 'asyncio'


@pytest.mark.anyio
async def test_idle_heartbeats_preserve_subscription_and_later_event(monkeypatch):
    hub = EventHub()
    monkeypatch.setattr(events, 'event_hub', hub)
    monkeypatch.setattr(events, 'KEEPALIVE_SECONDS', 0.01)
    parent_id = uuid4()
    stream = events._stream_events(parent_id)
    assert await anext(stream) == ': connected\n\n'
    for _ in range(3):
        assert await anext(stream) == ': keepalive\n\n'
        assert hub.subscriber_count(parent_id) == 1
    published = hub.publish(parent_id, 'tasks', 'task_updated')
    assert await asyncio.wait_for(anext(stream), timeout=1) == published.sse()
    await stream.aclose()
    assert hub.subscriber_count(parent_id) == 0


@pytest.mark.anyio
async def test_disconnect_cancels_pending_read_and_removes_subscriber(monkeypatch):
    hub = EventHub()
    monkeypatch.setattr(events, 'event_hub', hub)
    parent_id = uuid4()
    stream = events._stream_events(parent_id)
    await anext(stream)
    pending = asyncio.create_task(anext(stream))
    for _ in range(10):
        if hub.subscriber_count(parent_id):
            break
        await asyncio.sleep(0)
    assert hub.subscriber_count(parent_id) == 1
    pending.cancel()
    with pytest.raises(asyncio.CancelledError):
        await pending
    assert hub.subscriber_count(parent_id) == 0


@pytest.mark.anyio
async def test_child_filter_survives_idle_and_ignores_other_child(monkeypatch):
    hub = EventHub()
    monkeypatch.setattr(events, 'event_hub', hub)
    monkeypatch.setattr(events, 'KEEPALIVE_SECONDS', 0.01)
    parent_id, child_id = uuid4(), uuid4()
    stream = events._stream_events(parent_id, child_id)
    await anext(stream)
    assert await anext(stream) == ': keepalive\n\n'
    hub.publish(parent_id, 'tasks', 'other_child', uuid4())
    published = hub.publish(parent_id, 'tasks', 'same_child', child_id)
    assert await asyncio.wait_for(anext(stream), timeout=1) == published.sse()
    await stream.aclose()
    assert hub.subscriber_count(parent_id) == 0
