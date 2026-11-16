"""Embeddings de texto via endpoint oficial Gemini ``embedContent``."""

from __future__ import annotations

import asyncio

from backend.llm.base import Embeddings
from backend.llm.google.client import GoogleGenAIClient, GoogleGenAIResponseError


class VectoraGoogleEmbeddings(Embeddings):
    def __init__(self, model: str, client: GoogleGenAIClient) -> None:
        self.model = model
        self.client = client

    async def _embed(self, texts: list[str], task_type: str) -> list[list[float]]:
        vectors: list[list[float]] = []
        for text in texts:
            response = await self.client.embed_content(
                self.model, text, task_type=task_type
            )
            embedding = response.get("embedding")
            values = embedding.get("values") if isinstance(embedding, dict) else None
            if not isinstance(values, list) or not values:
                raise GoogleGenAIResponseError(
                    "Google Gemini devolveu embedding em formato inválido"
                )
            vectors.append(values)
        return vectors

    async def aembed_documents(self, texts: list[str]) -> list[list[float]]:
        return await self._embed(texts, "RETRIEVAL_DOCUMENT")

    async def aembed_query(self, text: str) -> list[float]:
        return (await self._embed([text], "RETRIEVAL_QUERY"))[0]

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return asyncio.run(self.aembed_documents(texts))

    def embed_query(self, text: str) -> list[float]:
        return asyncio.run(self.aembed_query(text))
