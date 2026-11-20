"""Validação de produção das integrações OAuth.

Uma integração só é anunciada como disponível depois de configurada em produção
e aprovada num teste de ponta a ponta (conectar, usar, desconectar e recuperar
de falha). Este registro guarda a evidência de cada validação; um provider fora
dele continua marcado como não validado na interface e na documentação.
"""

from __future__ import annotations

from datetime import date
from typing import Final, NamedTuple


class OAuthValidation(NamedTuple):
    """Evidência de que o fluxo OAuth de um provider foi validado em produção."""

    validated_on: date
    #: Onde está o resultado do teste ponta a ponta (issue ou run), sem segredos.
    evidence: str


#: Providers com validação de produção registrada. Vazio até cada um ser
#: validado; acrescentar uma entrada exige a evidência do teste ponta a ponta.
VALIDATED_OAUTH: Final[dict[str, OAuthValidation]] = {}


def is_oauth_validated(provider_id: str) -> bool:
    return provider_id in VALIDATED_OAUTH
