"""Contrato da fila com PostgreSQL real quando VECTORA_TEST_PG_DSN está definido."""

import os
from pathlib import Path
from uuid import uuid4

import asyncpg
import pytest

from backend.embedding.queue import EmbeddingQueue, PostgresQueueDB


@pytest.mark.asyncio
async def test_postgres_queue_job_lifecycle(monkeypatch: pytest.MonkeyPatch) -> None:
    dsn = os.environ.get("VECTORA_TEST_PG_DSN")
    if not dsn:
        pytest.skip("VECTORA_TEST_PG_DSN não configurado")
    pool = await asyncpg.create_pool(dsn)
    assert pool is not None
    monkeypatch.setattr(
        "backend.storage.factory.get_pg_pool", lambda: _return_pool(pool)
    )
    queue = PostgresQueueDB()
    job_id = str(uuid4())
    try:
        await queue._ensure_table()
        queue_id = await queue.enqueue(
            "documento", "docs", {"workspace_id": "w"}, job_id
        )
        records = await queue.get_pending()
        record = next(record for record in records if record.queue_id == queue_id)
        assert record.job_id == job_id
        await queue.mark_processing(queue_id)
        await queue.mark_dlq(queue_id, "quota")
        with pytest.raises(RuntimeError, match="não está em processamento"):
            await queue.mark_success(queue_id)
        stats = await queue.get_job_stats(job_id)
        assert stats["total"] == 1
        assert stats["dlq"] == 1
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT task_json->>'attempt_count' AS attempts, task_json->>'dlq_reason' AS reason FROM vectora_embedding_queue WHERE queue_id=$1",
                queue_id,
            )
        assert row is not None
        assert row["attempts"] == "1"
        assert row["reason"] == "quota"
        assert await queue.retry_failed(limit=1) == 1
        retried = await queue.get_pending()
        assert [record.queue_id for record in retried] == [queue_id]
        assert retried[0].attempt_count == 0
        async with pool.acquire() as conn:
            reason = await conn.fetchval(
                "SELECT task_json->>'dlq_reason' FROM vectora_embedding_queue WHERE queue_id=$1",
                queue_id,
            )
        assert reason == "quota"
    finally:
        async with pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM vectora_embedding_queue WHERE task_json->>'job_id' = $1",
                job_id,
            )
        await pool.close()


async def _return_pool(pool: asyncpg.Pool) -> asyncpg.Pool:
    return pool


@pytest.mark.asyncio
async def test_import_sqlite_is_repeatable_and_preserves_original(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    dsn = os.environ.get("VECTORA_TEST_PG_DSN")
    if not dsn:
        pytest.skip("VECTORA_TEST_PG_DSN não configurado")
    pool = await asyncpg.create_pool(dsn)
    assert pool is not None
    monkeypatch.setattr(
        "backend.storage.factory.get_pg_pool", lambda: _return_pool(pool)
    )
    source = EmbeddingQueue(f"sqlite+aiosqlite:///{tmp_path / 'queue.db'}")
    await source.init()
    target = PostgresQueueDB()
    job_id = str(uuid4())
    try:
        await target._ensure_table()
        pending = await source.enqueue(
            "documento", "docs", {"workspace_id": "w"}, job_id
        )
        failed = await source.enqueue("outro", "docs", job_id=job_id)
        await source.mark_dlq(failed, "quota")
        assert await target.import_sqlite(source) == 2
        assert await target.import_sqlite(source) == 0
        assert (await target.get_job_stats(job_id))["total"] == 2
        assert (await target.get_job_stats(job_id))["dlq"] == 1
        assert (await source.get_job_stats(job_id))["total"] == 2
        assert [record.queue_id for record in await source.get_pending()] == [pending]
    finally:
        async with pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM vectora_embedding_queue WHERE task_json->>'job_id' = $1",
                job_id,
            )
        await source.close()
        await pool.close()


@pytest.mark.asyncio
async def test_import_rejects_processing_without_copying_anything(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    dsn = os.environ.get("VECTORA_TEST_PG_DSN")
    if not dsn:
        pytest.skip("VECTORA_TEST_PG_DSN não configurado")
    pool = await asyncpg.create_pool(dsn)
    assert pool is not None
    monkeypatch.setattr(
        "backend.storage.factory.get_pg_pool", lambda: _return_pool(pool)
    )
    source = EmbeddingQueue(f"sqlite+aiosqlite:///{tmp_path / 'queue.db'}")
    await source.init()
    target = PostgresQueueDB()
    job_id = str(uuid4())
    try:
        await target._ensure_table()
        item = await source.enqueue("ativo", job_id=job_id)
        await source.mark_processing(item)
        with pytest.raises(RuntimeError, match="em processamento"):
            await target.import_sqlite(source)
        assert (await target.get_job_stats(job_id))["total"] == 0
        assert (await source.get_job_stats(job_id))["processing"] == 1
    finally:
        await source.close()
        await pool.close()


@pytest.mark.asyncio
async def test_import_conflict_rolls_back_all_insertions(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    dsn = os.environ.get("VECTORA_TEST_PG_DSN")
    if not dsn:
        pytest.skip("VECTORA_TEST_PG_DSN não configurado")
    pool = await asyncpg.create_pool(dsn)
    assert pool is not None
    monkeypatch.setattr(
        "backend.storage.factory.get_pg_pool", lambda: _return_pool(pool)
    )
    source = EmbeddingQueue(f"sqlite+aiosqlite:///{tmp_path / 'queue.db'}")
    await source.init()
    target = PostgresQueueDB()
    try:
        await target._ensure_table()
        first = await source.enqueue("primeiro")
        conflict = await source.enqueue("original")
        async with pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO vectora_embedding_queue (queue_id, task_json) VALUES ($1, $2::jsonb)",
                conflict,
                '{"text":"diferente"}',
            )
        with pytest.raises(RuntimeError, match="Conflito de identificador"):
            await target.import_sqlite(source)
        async with pool.acquire() as conn:
            assert (
                await conn.fetchval(
                    "SELECT count(*) FROM vectora_embedding_queue WHERE queue_id = $1",
                    first,
                )
                == 0
            )
            await conn.execute(
                "DELETE FROM vectora_embedding_queue WHERE queue_id = $1", conflict
            )
        assert len(await source.get_pending()) == 2
    finally:
        await source.close()
        await pool.close()


@pytest.mark.asyncio
async def test_import_locks_sqlite_writes_until_postgres_copy_finishes(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    import asyncio
    import sqlite3

    dsn = os.environ.get("VECTORA_TEST_PG_DSN")
    if not dsn:
        pytest.skip("VECTORA_TEST_PG_DSN não configurado")
    pool = await asyncpg.create_pool(dsn)
    assert pool is not None
    locked = asyncio.Event()
    release = asyncio.Event()

    async def wait_for_release() -> asyncpg.Pool:
        locked.set()
        await release.wait()
        return pool

    monkeypatch.setattr("backend.storage.factory.get_pg_pool", wait_for_release)
    db_path = tmp_path / "queue.db"
    source = EmbeddingQueue(f"sqlite+aiosqlite:///{db_path}")
    await source.init()
    target = PostgresQueueDB()
    job_id = str(uuid4())
    task = None
    try:
        async with pool.acquire() as conn:
            await conn.execute(target._CREATE_TABLE)
        await source.enqueue("original", job_id=job_id)
        task = asyncio.create_task(target.import_sqlite(source))
        await asyncio.wait_for(locked.wait(), timeout=5)

        def try_write() -> None:
            with sqlite3.connect(db_path, timeout=0.1) as conn:
                conn.execute("UPDATE embedding_queue SET text = 'alterado'")

        with pytest.raises(sqlite3.OperationalError, match="locked"):
            await asyncio.to_thread(try_write)
        release.set()
        assert await asyncio.wait_for(task, timeout=5) == 1
        async with pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM vectora_embedding_queue WHERE task_json->>'job_id' = $1",
                job_id,
            )
    finally:
        release.set()
        if task is not None and not task.done():
            await task
        await source.close()
        await pool.close()


@pytest.mark.asyncio
async def test_sealed_source_rejects_writes_after_migration(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    import asyncio
    import sqlite3

    dsn = os.environ.get("VECTORA_TEST_PG_DSN")
    if not dsn:
        pytest.skip("VECTORA_TEST_PG_DSN não configurado")
    pool = await asyncpg.create_pool(dsn)
    assert pool is not None
    monkeypatch.setattr(
        "backend.storage.factory.get_pg_pool", lambda: _return_pool(pool)
    )
    path = tmp_path / "queue.db"
    source = EmbeddingQueue(f"sqlite+aiosqlite:///{path}")
    await source.init()
    target = PostgresQueueDB()
    job_id = str(uuid4())
    try:
        await target._ensure_table()
        await source.enqueue("primeiro", job_id=job_id)
        assert await target.import_sqlite(source, seal_source=True) == 1
        assert await target.import_sqlite(source, seal_source=True) == 0
        with pytest.raises(Exception, match="migrada para PostgreSQL"):
            await source.enqueue("novo", job_id=job_id)

        def old_process_write() -> None:
            with sqlite3.connect(path) as conn:
                conn.execute("DELETE FROM embedding_queue")

        with pytest.raises(sqlite3.IntegrityError, match="migrada para PostgreSQL"):
            await asyncio.to_thread(old_process_write)
        assert (await source.get_job_stats(job_id))["total"] == 1
        assert (await target.get_job_stats(job_id))["total"] == 1
    finally:
        async with pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM vectora_embedding_queue WHERE task_json->>'job_id' = $1",
                job_id,
            )
        await source.close()
        await pool.close()


@pytest.mark.asyncio
async def test_sealed_source_rejects_other_destination_or_missing_items(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    dsn = os.environ.get("VECTORA_TEST_PG_DSN")
    if not dsn:
        pytest.skip("VECTORA_TEST_PG_DSN não configurado")
    pool = await asyncpg.create_pool(dsn)
    assert pool is not None
    monkeypatch.setattr(
        "backend.storage.factory.get_pg_pool", lambda: _return_pool(pool)
    )
    source = EmbeddingQueue(f"sqlite+aiosqlite:///{tmp_path / 'queue.db'}")
    await source.init()
    target = PostgresQueueDB()
    target_id = None
    item = None
    try:
        await target._ensure_table()
        item = await source.enqueue("documento")
        assert await target.import_sqlite(source, seal_source=True) == 1
        async with pool.acquire() as conn:
            target_id = await conn.fetchval(
                "SELECT identity FROM vectora_embedding_queue_identity WHERE singleton = TRUE"
            )
            await conn.execute(
                "UPDATE vectora_embedding_queue_identity SET identity = $1 WHERE singleton = TRUE",
                str(uuid4()),
            )
        with pytest.raises(RuntimeError, match="outro PostgreSQL"):
            await target.import_sqlite(source, seal_source=True)
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE vectora_embedding_queue_identity SET identity = $1 WHERE singleton = TRUE",
                target_id,
            )
            await conn.execute(
                "DELETE FROM vectora_embedding_queue WHERE queue_id = $1", item
            )
        with pytest.raises(RuntimeError, match="não contém item"):
            await target.import_sqlite(source, seal_source=True)
        async with pool.acquire() as conn:
            assert (
                await conn.fetchval(
                    "SELECT count(*) FROM vectora_embedding_queue WHERE queue_id=$1",
                    item,
                )
                == 0
            )
    finally:
        if target_id:
            async with pool.acquire() as conn:
                await conn.execute(
                    "UPDATE vectora_embedding_queue_identity SET identity = $1 WHERE singleton = TRUE",
                    target_id,
                )
                if item:
                    await conn.execute(
                        "DELETE FROM vectora_embedding_queue WHERE queue_id=$1", item
                    )
        await source.close()
        await pool.close()


@pytest.mark.asyncio
async def test_resolver_requires_offline_cutover_and_reuses_sealed_source(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    from backend.embedding.queue import resolve_embedding_queue

    dsn = os.environ.get("VECTORA_TEST_PG_DSN")
    if not dsn:
        pytest.skip("VECTORA_TEST_PG_DSN não configurado")
    pool = await asyncpg.create_pool(dsn)
    assert pool is not None
    monkeypatch.setattr(
        "backend.storage.factory.get_pg_pool", lambda: _return_pool(pool)
    )
    source = EmbeddingQueue(f"sqlite+aiosqlite:///{tmp_path / 'queue.db'}")
    await source.init()

    async def get_source(_dsn: str | None) -> EmbeddingQueue:
        return source

    monkeypatch.setattr("backend.embedding.queue.get_embedding_queue", get_source)
    job_id = str(uuid4())
    try:
        await source.enqueue("documento", job_id=job_id)
        assert (
            await resolve_embedding_queue(
                "local", storage_mode="lite", postgres_dsn=None
            )
            is source
        )
        with pytest.raises(RuntimeError, match="corte offline"):
            await resolve_embedding_queue(
                "local", storage_mode="complete", postgres_dsn=dsn
            )
        target = await resolve_embedding_queue(
            "local", storage_mode="complete", postgres_dsn=dsn, offline_cutover=True
        )
        assert isinstance(target, PostgresQueueDB)
        assert (await target.get_job_stats(job_id))["pending"] == 1
        restarted = await resolve_embedding_queue(
            "local", storage_mode="complete", postgres_dsn=dsn
        )
        assert isinstance(restarted, PostgresQueueDB)
        assert (await restarted.get_job_stats(job_id))["total"] == 1
        with pytest.raises(RuntimeError, match="restaure os itens"):
            await resolve_embedding_queue(
                "local", storage_mode="lite", postgres_dsn=None
            )
    finally:
        async with pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM vectora_embedding_queue WHERE task_json->>'job_id' = $1",
                job_id,
            )
        await source.close()
        await pool.close()


@pytest.mark.asyncio
async def test_complete_mode_ingestion_worker_and_progress_use_same_queue(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    from unittest.mock import AsyncMock

    import backend.embedding.queue as queue_module
    from backend.embedding import rag_ingest
    from backend.embedding.background import BackgroundEmbeddingWorker
    from backend.embedding.queue import (
        get_configured_embedding_queue,
        resolve_embedding_queue,
    )
    from backend.settings import settings

    dsn = os.environ.get("VECTORA_TEST_PG_DSN")
    if not dsn:
        pytest.skip("VECTORA_TEST_PG_DSN não configurado")
    pool = await asyncpg.create_pool(dsn)
    assert pool is not None
    monkeypatch.setattr(
        "backend.storage.factory.get_pg_pool", lambda: _return_pool(pool)
    )
    source = EmbeddingQueue(f"sqlite+aiosqlite:///{tmp_path / 'queue.db'}")
    await source.init()

    async def get_source(_dsn: str | None) -> EmbeddingQueue:
        return source

    monkeypatch.setattr(queue_module, "get_embedding_queue", get_source)
    monkeypatch.setattr(queue_module, "_configured_pg_queue", None)
    monkeypatch.setattr(
        "backend.services.license.get_effective_storage_mode", lambda: "complete"
    )
    monkeypatch.setattr(settings, "postgres_dsn", dsn)
    monkeypatch.setattr(rag_ingest, "is_safe_file_path", lambda _path: True)
    folder = tmp_path / "project"
    folder.mkdir()
    (folder / "example.md").write_text("Documento de teste", encoding="utf-8")
    job_id = None
    try:
        await resolve_embedding_queue(
            settings.embedding_queue_dsn,
            storage_mode="complete",
            postgres_dsn=dsn,
            offline_cutover=True,
        )
        result = await rag_ingest.ingest_directory(
            str(folder), file_types="markdown", workspace_id="w"
        )
        job_id = result["job_id"]
        assert result["total_chunks"] == 1
        worker = BackgroundEmbeddingWorker()
        monkeypatch.setattr(
            worker,
            "_generate_embedding",
            AsyncMock(return_value=([0.1, 0.2], "test:model")),
        )
        writer = AsyncMock()
        monkeypatch.setattr(worker, "_write_to_vector_store", writer)
        worker_queue = await worker._get_queue()
        producer_queue = await get_configured_embedding_queue(
            settings.embedding_queue_dsn
        )
        assert worker_queue is producer_queue
        records = await worker_queue.get_pending()
        record = next(record for record in records if record.job_id == job_id)
        await worker._process_record(record, worker_queue)
        writer.assert_awaited_once()
        assert (await producer_queue.get_job_stats(job_id))["success"] == 1
        assert (await source.get_job_stats(job_id))["total"] == 0
    finally:
        if job_id:
            async with pool.acquire() as conn:
                await conn.execute(
                    "DELETE FROM vectora_embedding_queue WHERE task_json->>'job_id'=$1",
                    job_id,
                )
        await source.close()
        await pool.close()


@pytest.mark.asyncio
async def test_postgres_retry_job_does_not_change_other_jobs(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    dsn = os.environ.get("VECTORA_TEST_PG_DSN")
    if not dsn:
        pytest.skip("VECTORA_TEST_PG_DSN não configurado")
    pool = await asyncpg.create_pool(dsn)
    assert pool is not None
    monkeypatch.setattr(
        "backend.storage.factory.get_pg_pool", lambda: _return_pool(pool)
    )
    queue = PostgresQueueDB()
    one, two = str(uuid4()), str(uuid4())
    try:
        await queue._ensure_table()
        first = await queue.enqueue("first", job_id=one)
        second = await queue.enqueue("second", job_id=two)
        await queue.mark_dlq(first, "quota")
        await queue.mark_dlq(second, "quota")
        assert await queue.retry_job(one) == 1
        assert (await queue.get_job_stats(one))["pending"] == 1
        assert (await queue.get_job_stats(two))["dlq"] == 1
        assert await queue.retry_job(one) == 0
    finally:
        async with pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM vectora_embedding_queue WHERE task_json->>'job_id' = ANY($1::text[])",
                [one, two],
            )
        await pool.close()
