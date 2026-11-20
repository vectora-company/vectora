"""Host das extensões Vext no Vectora.

O host instala, ativa e supervisiona extensões e faz a ponte entre elas e o
harness. A extensão oferece tools com a semântica das tools MCP e roda num
processo separado, dentro do jail; tudo o que ela recebe é o identificador da
tool e os argumentos explícitos da chamada. O formato do pacote, o manifesto e o
SDK são contratos do repositório Vext, fora deste módulo.
"""
