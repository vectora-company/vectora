"""OpenRouter Decisions: conversão de perguntas e respostas e erros fail-closed."""

import httpx
import pytest

from backend.llm.systemone.api_adapters import OpenRouterDecisionAdapter
from backend.llm.systemone.errors import (
    SystemOneAuthenticationError,
    SystemOneCapabilityError,
)
from backend.llm.systemone.types import (
    ChoiceAnswer,
    ChoiceQuestion,
    NoulAnswer,
    NoulQuestion,
    ScoreAnswer,
    ScoreQuestion,
    SystemOneRequest,
)


def _request() -> SystemOneRequest:
    return SystemOneRequest(
        model="typesafe/jev-1.14",
        state="Ticket: cartão recusado na renovação.",
        questions={
            "churn": NoulQuestion(criterion="O cliente quer cancelar?"),
            "dept": ChoiceQuestion(
                options=["billing", "suporte"],
                criteria={"billing": "cobrança", "suporte": "bugs"},
            ),
            "urgencia": ScoreQuestion(criterion="Urgência", min_score=0, max_score=2),
        },
    )


def _adapter(handler) -> OpenRouterDecisionAdapter:
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    return OpenRouterDecisionAdapter("sk-test", client=client)


@pytest.mark.asyncio
async def test_envia_perguntas_no_formato_do_openrouter_e_converte_respostas() -> None:
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["auth"] = request.headers["authorization"]
        seen["body"] = request.read().decode()
        return httpx.Response(
            200,
            json={
                "answers": {
                    "churn": {"type": "noul", "noul": 0.04, "confidence": 0.96},
                    "dept": {
                        "type": "choice",
                        "choice": "billing",
                        "probabilities": {"billing": 0.9821, "suporte": 0.0178},
                        "confidence": 0.98,
                    },
                    "urgencia": {
                        "type": "score",
                        "score": 1.0,
                        "probabilities": {"0": 0.1, "1": 0.8, "2": 0.1},
                        "confidence": 0.8,
                    },
                },
                "usage": {"input_tokens": 128, "output_tokens": 0},
            },
        )

    response = await _adapter(handler).decide(_request())

    assert seen["url"] == "https://openrouter.ai/api/alpha/decisions"
    assert seen["auth"] == "Bearer sk-test"
    assert '"criteria":{"billing":"cobrança","suporte":"bugs"}' in seen["body"]
    churn = response.answers["churn"]
    dept = response.answers["dept"]
    urgencia = response.answers["urgencia"]
    assert isinstance(churn, NoulAnswer)
    assert isinstance(dept, ChoiceAnswer)
    assert isinstance(urgencia, ScoreAnswer)
    assert churn.probability == 0.04
    assert dept.selection == "billing"
    # nível 1 de 0..2 (3 níveis) cai no meio da escala pedida.
    assert urgencia.score == pytest.approx(1.0)
    assert response.metadata.usage.total_tokens == 128


@pytest.mark.asyncio
async def test_recusa_vira_erro_em_vez_de_decisao() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "answers": {
                    "churn": {"type": "refusal"},
                    "dept": {"type": "refusal"},
                    "urgencia": {"type": "refusal"},
                },
                "usage": {"input_tokens": 1, "output_tokens": 0},
            },
        )

    with pytest.raises(SystemOneCapabilityError):
        await _adapter(handler).decide(_request())


@pytest.mark.asyncio
async def test_sem_chave_e_credito_insuficiente_sao_erros_de_autenticacao() -> None:
    with pytest.raises(SystemOneAuthenticationError):
        await OpenRouterDecisionAdapter("").decide(_request())

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(402, json={"error": {"message": "credits"}})

    with pytest.raises(SystemOneAuthenticationError):
        await _adapter(handler).decide(_request())


@pytest.mark.asyncio
async def test_health_usa_o_endpoint_da_chave() -> None:
    def ok(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/key"
        return httpx.Response(200, json={"data": {}})

    assert await _adapter(ok).health() is True
    with pytest.raises(SystemOneAuthenticationError):
        await _adapter(lambda _r: httpx.Response(401)).health()
