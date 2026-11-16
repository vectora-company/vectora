"""Embeddings de texto via endpoint oficial da OpenAI."""

from __future__ import annotations

import asyncio

from backend.llm.base import Embeddings
from backend.llm.openai.client import OpenAIClient, OpenAIResponseError


class VectoraOpenAIEmbeddings(Embeddings):
    def __init__(self, model: str, client: OpenAIClient) -> None:
        self.model = model
        self.client = client

    async def _embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        response = await self.client.create_embedding(
            {"model": self.model, "input": texts}
        )
        data = response.get("data")
        if not isinstance(data, list) or len(data) != len(texts):
            raise OpenAIResponseError(
                "OpenAI devolveu quantidade inválida de embeddings"
            )
        indexed: dict[int, list[float]] = {}
        for item in data:
            if not isinstance(item, dict) or not isinstance(
                item.get("embedding"), list
            ):
                raise OpenAIResponseError(
                    "OpenAI devolveu embedding em formato inválido"
                )
            indexed[int(item.get("index", len(indexed)))] = item["embedding"]
        if set(indexed) != set(range(len(texts))):
            raise OpenAIResponseError("OpenAI não devolveu todos os vetores de entrada")
        return [indexed[index] for index in range(len(texts))]

    async def aembed_documents(self, texts: list[str]) -> list[list[float]]:
        return await self._embed(texts)

    async def aembed_query(self, text: str) -> list[float]:
        return (await self._embed([text]))[0]

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return asyncio.run(self.aembed_documents(texts))

    def embed_query(self, text: str) -> list[float]:
        return asyncio.run(self.aembed_query(text))
