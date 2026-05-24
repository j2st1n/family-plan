import asyncio
from collections.abc import AsyncIterator
from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.core.deps import get_current_child, get_current_parent
from app.models.child import Child
from app.models.child_device import ChildDevice
from app.models.parent import Parent
from app.services.event_hub import Event, event_hub

router = APIRouter(tags=["events"])


async def _stream_events(parent_id: UUID, child_id: UUID | None = None) -> AsyncIterator[str]:
    subscription = event_hub.subscribe(parent_id)
    try:
        yield ": connected\n\n"
        while True:
            try:
                event = await asyncio.wait_for(subscription.__anext__(), timeout=25)
            except TimeoutError:
                yield ": keepalive\n\n"
                continue
            if child_id is not None and event.child_id is not None and event.child_id != child_id:
                continue
            yield _event_sse(event)
    finally:
        await subscription.aclose()


def _event_sse(event: Event) -> str:
    return event.sse()


def _response(parent_id: UUID, child_id: UUID | None = None) -> StreamingResponse:
    return StreamingResponse(
        _stream_events(parent_id, child_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/events/parent")
def parent_events(parent: Parent = Depends(get_current_parent)) -> StreamingResponse:
    return _response(parent.id)


@router.get("/child/events")
def child_events(child_device: tuple[Child, ChildDevice] = Depends(get_current_child)) -> StreamingResponse:
    child, _ = child_device
    return _response(child.parent_id, child.id)
