import asyncio
from uuid import uuid4

import pytest

from app.services.event_hub import EventHub


@pytest.fixture
def anyio_backend():
    return "asyncio"


async def _next_event(subscription):
    return await subscription.__anext__()


class TestEventHub:
    @pytest.mark.anyio
    async def test_publish_fans_out_to_all_parent_subscribers(self):
        hub = EventHub()
        parent_id = uuid4()
        child_id = uuid4()
        sub_a = hub.subscribe(parent_id)
        sub_b = hub.subscribe(parent_id)
        task_a = asyncio.create_task(_next_event(sub_a))
        task_b = asyncio.create_task(_next_event(sub_b))
        await asyncio.sleep(0)

        published = hub.publish(parent_id, "tasks", "task_completed", child_id)

        assert await task_a == published
        assert await task_b == published
        assert published.data() == {
            "topic": "tasks",
            "parent_id": str(parent_id),
            "child_id": str(child_id),
            "reason": "task_completed",
            "version": 1,
        }

        await sub_a.aclose()
        await sub_b.aclose()

    @pytest.mark.anyio
    async def test_subscribers_are_scoped_by_parent(self):
        hub = EventHub()
        parent_a = uuid4()
        parent_b = uuid4()
        sub_a = hub.subscribe(parent_a)
        sub_b = hub.subscribe(parent_b)
        task_a = asyncio.create_task(_next_event(sub_a))
        await asyncio.sleep(0)

        published = hub.publish(parent_a, "shop", "wish_created")

        assert await task_a == published
        assert hub.subscriber_count(parent_a) == 1
        assert hub.subscriber_count(parent_b) == 0

        await sub_a.aclose()
        await sub_b.aclose()

    @pytest.mark.anyio
    async def test_subscribe_cleanup_removes_empty_parent_bucket(self):
        hub = EventHub()
        parent_id = uuid4()
        sub = hub.subscribe(parent_id)
        task = asyncio.create_task(_next_event(sub))
        await asyncio.sleep(0)
        hub.publish(parent_id, "children", "child_created")
        await task

        assert hub.subscriber_count(parent_id) == 1
        await sub.aclose()
        assert hub.subscriber_count(parent_id) == 0

    @pytest.mark.anyio
    async def test_full_queue_drops_oldest_event(self):
        hub = EventHub(queue_size=1)
        parent_id = uuid4()
        sub = hub.subscribe(parent_id)
        first_task = asyncio.create_task(_next_event(sub))
        await asyncio.sleep(0)
        first = hub.publish(parent_id, "tasks", "first")
        assert await first_task == first

        hub.publish(parent_id, "tasks", "second")
        third = hub.publish(parent_id, "tasks", "third")

        assert await _next_event(sub) == third
        await sub.aclose()
