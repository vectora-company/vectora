"""Cache explícito de contexto do Gemini (backend/llm/google/prompt_cache.py)."""

from __future__ import annotations

import pytest

from backend.llm.google import prompt_cache as pc


class _Client:
    def __init__(self, *, fail: bool = False) -> None:
        self.created: list[dict] = []
        self.fail = fail

    async def create_cached_content(self, payload: dict) -> dict:
        if self.fail:
            raise RuntimeError("recusado")
        self.created.append(payload)
        return {"name": f"cachedContents/{len(self.created)}"}


def _grande() -> dict:
    return {
        "systemInstruction": {"parts": [{"text": "regra " * 4000}]},
        "tools": [{"functionDeclarations": []}],
        "contents": [{"role": "user", "parts": [{"text": "oi"}]}],
    }


@pytest.fixture(autouse=True)
def _limpa() -> None:
    pc.reset_state()


@pytest.mark.asyncio
async def test_prefixo_grande_vira_cached_content_e_e_reaproveitado() -> None:
    client = _Client()
    corpo1, usou1 = await pc.apply_cached_content(client, "gemini-2.5-pro", _grande())
    corpo2, usou2 = await pc.apply_cached_content(client, "gemini-2.5-pro", _grande())

    assert usou1 and usou2
    assert len(client.created) == 1
    assert client.created[0]["model"] == "models/gemini-2.5-pro"
    assert corpo1["cachedContent"] == corpo2["cachedContent"] == "cachedContents/1"
    assert "systemInstruction" not in corpo1
    assert "tools" not in corpo1
    assert corpo1["contents"][0]["parts"][0]["text"] == "oi"


@pytest.mark.asyncio
async def test_prefixo_pequeno_nao_usa_cache() -> None:
    client = _Client()
    payload = {
        "systemInstruction": {"parts": [{"text": "curto"}]},
        "contents": [],
    }

    corpo, usou = await pc.apply_cached_content(client, "gemini-2.5-pro", payload)

    assert usou is False
    assert corpo is payload
    assert client.created == []


@pytest.mark.asyncio
async def test_falha_na_criacao_cai_no_envio_normal_e_nao_insiste() -> None:
    client = _Client(fail=True)
    payload = _grande()

    corpo, usou = await pc.apply_cached_content(client, "m", payload, now=0.0)
    assert usou is False and corpo is payload

    ok = _Client()
    _, usou = await pc.apply_cached_content(ok, "m", payload, now=10.0)
    assert usou is False and ok.created == []
    _, usou = await pc.apply_cached_content(ok, "m", payload, now=400.0)
    assert usou is True


@pytest.mark.asyncio
async def test_cache_vencido_e_recriado() -> None:
    client = _Client()
    await pc.apply_cached_content(client, "m", _grande(), now=0.0)
    await pc.apply_cached_content(client, "m", _grande(), now=4000.0)
    assert len(client.created) == 2


@pytest.mark.asyncio
async def test_desligado_em_settings(monkeypatch) -> None:
    from backend.settings import settings

    monkeypatch.setattr(settings, "prompt_cache_enabled", False)
    client = _Client()
    payload = _grande()

    corpo, usou = await pc.apply_cached_content(client, "m", payload)

    assert usou is False and corpo is payload and client.created == []


class _GeminiFake:
    """Client falso: recusa chamadas com cachedContent, aceita as sem."""

    def __init__(self) -> None:
        self.chamadas: list[dict] = []

    async def create_cached_content(self, payload: dict) -> dict:
        return {"name": "cachedContents/9"}

    async def generate_content(self, model: str, payload: dict) -> dict:
        from backend.llm.google.client import GoogleGenAIResponseError

        self.chamadas.append(payload)
        if "cachedContent" in payload:
            raise GoogleGenAIResponseError("cache expirado")
        return {"candidates": [{"content": {"parts": [{"text": "ok"}]}}]}

    async def stream_generate_content(self, model: str, payload: dict):
        from backend.llm.google.client import GoogleGenAIResponseError

        self.chamadas.append(payload)
        if "cachedContent" in payload:
            raise GoogleGenAIResponseError("cache expirado")
        yield {"candidates": [{"content": {"parts": [{"text": "ok"}]}}]}


def _mensagens_grandes():
    from backend.vtypes.message import MessageRole, text_message

    return [
        text_message(MessageRole.SYSTEM, "regra " * 4000),
        text_message(MessageRole.USER, "oi"),
    ]


@pytest.mark.asyncio
async def test_agenerate_refaz_sem_cache_quando_a_api_recusa() -> None:
    from backend.llm.google.chat_client import GoogleChatClient

    fake = _GeminiFake()
    client = GoogleChatClient("gemini-2.5-pro", fake)  # ty: ignore[invalid-argument-type]

    resposta = await client.agenerate(_mensagens_grandes())

    assert resposta.text() == "ok"
    assert "cachedContent" in fake.chamadas[0]
    assert "cachedContent" not in fake.chamadas[1]
    assert "systemInstruction" in fake.chamadas[1]


@pytest.mark.asyncio
async def test_astream_refaz_sem_cache_quando_a_api_recusa() -> None:
    from backend.llm.google.chat_client import GoogleChatClient

    fake = _GeminiFake()
    client = GoogleChatClient("gemini-2.5-pro", fake)  # ty: ignore[invalid-argument-type]

    textos = [
        chunk.delta_text
        async for chunk in client.astream(_mensagens_grandes())
        if chunk.delta_text
    ]

    assert textos == ["ok"]
    assert "cachedContent" in fake.chamadas[0]
    assert "cachedContent" not in fake.chamadas[1]
