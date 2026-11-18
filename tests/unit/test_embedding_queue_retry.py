from pathlib import Path

import pytest

from backend.embedding.queue import EmbeddingQueue


@pytest.mark.asyncio
async def test_retry_failed_makes_exhausted_item_available_again(
    tmp_path: Path,
) -> None:
    queue = EmbeddingQueue(f"sqlite+aiosqlite:///{tmp_path / 'queue.db'}")
    await queue.init()
    try:
        item = await queue.enqueue("document")
        for _ in range(3):
            await queue.mark_processing(item)
        await queue.mark_dlq(item, "provider unavailable")
        assert await queue.get_pending() == []
        assert await queue.retry_failed() == 1
        pending = await queue.get_pending()
        assert [record.queue_id for record in pending] == [item]
        assert pending[0].dlq_reason == "provider unavailable"
    finally:
        await queue.close()


@pytest.mark.asyncio
async def test_retry_failed_respects_limit_and_leaves_success_untouched(
    tmp_path: Path,
) -> None:
    queue = EmbeddingQueue(f"sqlite+aiosqlite:///{tmp_path / 'queue.db'}")
    await queue.init()
    try:
        first = await queue.enqueue("first")
        second = await queue.enqueue("second")
        complete = await queue.enqueue("complete")
        await queue.mark_failed(first, "first failure")
        await queue.mark_failed(second, "second failure")
        await queue.mark_success(complete)
        assert await queue.retry_failed(limit=1) == 1
        assert len(await queue.get_pending()) == 1
        assert len(await queue.get_failed()) == 1
        assert await queue.retry_failed() == 1
        assert {record.queue_id for record in await queue.get_pending()} == {
            first,
            second,
        }
        assert await queue.retry_failed() == 0
    finally:
        await queue.close()
