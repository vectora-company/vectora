# Avisos de terceiros

O Vectora é distribuído sob a AGPL-3.0 (ver `LICENSE`). Este arquivo lista as
dependências de terceiros, com a licença declarada por cada uma. É gerado por
`utils/third_party_notices.py` a partir de `uv` (Python) e `pnpm` (frontend);
não edite à mão.

## Resumo

| Categoria | Pacotes |
| --- | ---: |
| Permissiva | 1151 |
| Copyleft fraco (LGPL, MPL, EPL) | 11 |
| Copyleft forte (GPL-2.0-or-later, GPL-3.0, AGPL-3.0) | 4 |
| Requer revisão | 6 |

## Requer revisão

Licença desconhecida, composta de forma incomum ou com restrição de uso.
Cada item precisa de decisão antes de distribuir um build que o contenha.

| Pacote | Versão | Licença |
| --- | --- | --- |
| pyinstaller | 6.22.3 | GPL-2.0-only |
| pyinstaller-hooks-contrib | 2026.10 | Apache-2.0 AND GPL-2.0-only |
| python-xlib | 0.33 | GNU Lesser General Public License v2 or later (LGPLv2+) |
| python3-xlib | 0.15 | GPLv2 |
| vectora | 0.1.25 | AGPL-3.0-only |
| sentry | 0.45.0 | FSL-1.1-Apache-2.0 |

## Copyleft forte

| Pacote | Versão | Licença |
| --- | --- | --- |
| MouseInfo | 0.1.3 | GPL-3.0 |
| mutagen | 1.48.1 | GPL-2.0-or-later |
| pykeepass | 4.2.0 | GPL-3.0 |
| PyMsgBox | 2.0.1 | GPL-3.0 |

## Copyleft fraco

| Pacote | Versão | Licença |
| --- | --- | --- |
| asyncssh | 2.24.1 | EPL-2.0 OR GPL-2.0-or-later |
| certifi | 2026.10.23 | MPL-2.0 |
| pathspec | 1.1.1 | MPL-2.0 |
| psycopg | 3.3.9 | LGPL-3.0-only |
| psycopg-binary | 3.3.9 | LGPL-3.0-only |
| pystray | 0.19.5 | LGPL-3.0 |
| pytest-rerunfailures | 16.7 | MPL-2.0 |
| python-telegram-bot | 22.8 | LGPL-3.0-only |
| tqdm | 4.70.1 | MPL-2.0 AND MIT |
| lightningcss | 1.33.0 | MPL-2.0 |
| lightningcss-linux-x64-gnu | 1.33.0 | MPL-2.0 |

## Atribuição de código incorporado

Parte do frontend pode derivar de um template da LangChain; o aviso abaixo é mantido
por cautela até a proveniência ser confirmada.

```text
MIT License

Copyright (c) 2024 LangChain

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Obras que inspiraram o Git Workbench

O layout e o fluxo do Git Workbench (abas, PRs e issues como documents,
detalhes de commit) se inspiram nos projetos abaixo. Os nomes pertencem aos
respectivos autores; o Vectora não tem vínculo com eles.

### GitDesktop

- Autor: theBGuy, 2026
- Licença: Apache-2.0
- Origem: <https://github.com/theBGuy/GitDesktop>
- Usado em: Git Workbench (layout e fluxo de PRs, issues e commits)

Licença (Apache-2.0):

```text
Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS

   APPENDIX: How to apply the Apache License to your work.

      To apply the Apache License to your work, attach the following
      boilerplate notice, with the fields enclosed by brackets "[]"
      replaced with your own identifying information. (Don't include
      the brackets!)  The text should be enclosed in the appropriate
      comment syntax for the file format. We also recommend that a
      file or class name and description of purpose be included on the
      same "printed page" as the copyright notice for easier
      identification within third-party archives.

   Copyright [yyyy] [name of copyright owner]

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
```

NOTICE:

```text
GitDesktop
Copyright 2026 theBGuy

This product is licensed under the Apache License, Version 2.0. See the LICENSE
file for the full license text.
```

### GitHub Desktop

- Autor: GitHub, Inc.
- Licença: MIT
- Origem: <https://github.com/desktop/desktop>
- Usado em: Git Workbench (modelo de interação do cliente Git)

Licença (MIT):

```text
MIT License

Copyright (c) GitHub, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Permissivas

| Pacote | Versão | Licença |
| --- | --- | --- |
| aiohappyeyeballs | 2.7.1 | PSF-2.0 |
| aiohttp | 3.14.5 | Apache-2.0 AND MIT |
| aiosignal | 1.4.0 | Apache-2.0 |
| aiosqlite | 0.22.1 | MIT |
| altgraph | 0.17.5 | MIT |
| annotated-doc | 0.0.6 | MIT |
| annotated-types | 0.8.0 | MIT |
| anyio | 4.16.0 | MIT |
| argon2-cffi | 25.1.0 | MIT |
| argon2-cffi-bindings | 26.2.0 | MIT |
| ast_serialize | 0.13.1 | MIT |
| asyncpg | 0.32.0 | Apache-2.0 |
| attrs | 26.1.0 | MIT |
| audioop-lts | 0.2.2 | PSF-2.0 |
| av | 19.0.2 | BSD-3-Clause |
| bandit | 1.9.4 | Apache-2.0 |
| brotli | 1.2.1 | MIT |
| cffi | 2.1.1 | MIT-0 |
| charset-normalizer | 3.5.2 | MIT |
| click | 8.5.1 | BSD-3-Clause |
| construct | 2.10.70 | MIT |
| coverage | 7.17.3 | Apache-2.0 |
| croniter | 7.0.0 | MIT |
| cryptography | 50.0.2 | Apache-2.0 OR BSD-3-Clause |
| ctranslate2 | 4.9.0 | MIT |
| curl_cffi | 0.17.0 | MIT |
| defusedxml | 0.7.1 | PSF-2.0 |
| Deprecated | 3.0.1 | MIT |
| deprecation | 2.1.0 | Apache-2.0 |
| discord.py | 2.7.1 | MIT |
| distro | 1.9.0 | Apache-2.0 |
| et_xmlfile | 2.0.0 | MIT |
| fakeredis | 2.40.0 | BSD-3-Clause |
| fastapi | 0.163.2 | MIT |
| faster-whisper | 1.2.1 | MIT |
| filelock | 4.2.11 | MIT |
| flatbuffers | 25.12.19 | Apache-2.0 |
| frozenlist | 1.8.0 | Apache-2.0 |
| fsspec | 2026.9.0 | BSD-3-Clause |
| gitdb | 4.0.12 | BSD |
| GitPython | 3.2.1 | BSD-3-Clause |
| google-auth | 2.62.2 | Apache-2.0 |
| google-genai | 3.4.0 | Apache-2.0 |
| greenlet | 3.5.6 | MIT AND PSF-2.0 |
| grpcio | 1.85.1 | Apache-2.0 |
| h11 | 0.16.0 | MIT |
| h2 | 4.4.1 | MIT |
| hf-xet | 1.8.0 | Apache-2.0 |
| hiredis | 3.5.0 | MIT |
| hpack | 4.2.0 | MIT |
| httpcore | 1.0.9 | BSD-3-Clause |
| httpcore2 | 2.16.2 | BSD-3-Clause |
| httptools | 0.9.0 | MIT |
| httpx | 0.28.1 | BSD |
| httpx2 | 2.16.2 | BSD-3-Clause |
| huggingface_hub | 2.4.0 | Apache-2.0 |
| hyperframe | 6.1.0 | MIT |
| idna | 3.20 | BSD-3-Clause |
| importlib_metadata | 10.2.0 | Apache-2.0 |
| iniconfig | 2.3.1 | MIT |
| jaraco.classes | 3.4.0 | MIT |
| jaraco.context | 6.1.2 | MIT |
| jaraco.functools | 4.6.0 | MIT |
| jeepney | 0.9.0 | MIT |
| jiter | 0.19.0 | MIT |
| jsonschema | 4.26.0 | MIT |
| jsonschema-specifications | 2025.9.1 | MIT |
| keyring | 25.7.0 | MIT |
| lance-namespace | 0.13.0 | Apache-2.0 |
| lance-namespace-urllib3-client | 0.13.0 | Apache-2.0 |
| lancedb | 0.41.0 | Apache-2.0 |
| lazy-importer | 0.1.0 | Apache-2.0 |
| librt | 0.16.0 | MIT |
| limits | 5.8.0 | MIT |
| lxml | 6.1.3 | BSD-3-Clause |
| markdown-it-py | 4.3.0 | MIT |
| mcp | 2.3.0 | MIT |
| mcp-types | 2.3.0 | MIT |
| mdurl | 0.1.2 | MIT |
| more-itertools | 11.2.1 | MIT |
| multidict | 7.2.1 | Apache-2.0 |
| mypy | 2.4.1 | MIT |
| mypy_extensions | 1.2.0 | MIT |
| nats-py | 2.17.0 | Apache-2.0 |
| networkx | 3.7 | BSD-3-Clause |
| nodeenv | 1.12.0 | BSD |
| numpy | 2.5.5 | BSD-3-Clause AND 0BSD AND MIT AND Zlib AND CC0-1.0 |
| onnxruntime | 1.32.0 | MIT |
| openai | 3.53.0 | Apache-2.0 |
| openpyxl | 3.1.5 | MIT |
| opentelemetry-api | 1.45.2 | Apache-2.0 |
| packaging | 26.3 | Apache-2.0 OR BSD-2-Clause |
| pandas | 3.1.1 | BSD-3-Clause |
| pillow | 13.0.0 | MIT-CMU |
| playwright | 1.65.2 | Apache-2.0 |
| pluggy | 1.7.0 | MIT |
| portalocker | 4.4.2 | BSD-3-Clause |
| propcache | 0.5.4 | Apache-2.0 |
| protobuf | 7.36.2 | BSD-3-Clause |
| ptyprocess | 0.7.0 | ISC |
| pyarrow | 26.0.1 | Apache-2.0 |
| pyasn1 | 0.6.5 | BSD-2-Clause |
| pyasn1_modules | 0.4.2 | BSD |
| pyautogui-next | 1.0.0 | BSD-3-Clause |
| pycparser | 3.12 | BSD-3-Clause |
| pycryptodomex | 3.24.2 | BSD AND Public Domain |
| pydantic | 2.14.3 | MIT |
| pydantic-settings | 2.16.3 | MIT |
| pydantic_core | 2.50.4 | MIT |
| PyGetWindow | 0.0.9 | BSD |
| Pygments | 2.21.0 | BSD-2-Clause |
| PyJWT | 2.15.1 | MIT |
| PyNaCl | 1.6.2 | Apache-2.0 |
| PyOTP | 2.12.0 | MIT |
| pypdf | 7.1.0 | BSD-3-Clause |
| pypdfium2 | 5.15.2 | BSD-3-Clause, Apache-2.0, dependency licenses |
| pyperclip | 1.11.0 | BSD |
| PyRect | 0.2.0 | BSD |
| pyright | 1.1.414 | MIT |
| PyScreeze | 1.0.1 | MIT |
| pyseccomp | 0.1.2 | MIT |
| pytest | 9.2.0 | MIT |
| pytest-asyncio | 1.5.0 | Apache-2.0 |
| pytest-cov | 7.1.0 | MIT |
| pytest-order | 1.5.0 | MIT |
| pytest-timeout | 2.4.0 | MIT |
| python-dateutil | 4.0.0 | BSD-3-Clause |
| python-docx | 1.2.0 | MIT |
| python-dotenv | 1.2.4 | BSD-3-Clause |
| python-multipart | 0.0.34 | Apache-2.0 |
| pytweening | 1.2.0 | MIT |
| PyYAML | 6.0.3 | MIT |
| qdrant-client | 1.20.0 | Apache-2.0 |
| rank-bm25 | 0.2.2 | Apache-2.0 |
| RapidFuzz | 3.14.6 | MIT |
| redis | 8.1.0 | MIT |
| referencing | 0.37.0 | MIT |
| regex | 2026.11.15 | Apache-2.0 AND CNRI-Python |
| requests | 2.34.2 | Apache-2.0 |
| rich | 15.0.0 | MIT |
| rpds-py | 2026.9.1 | MIT |
| ruff | 0.17.5 | MIT |
| SCons | 4.11.1 | MIT |
| SecretStorage | 3.5.0 | BSD-3-Clause |
| Send2Trash | 2.2.0 | BSD-3-Clause |
| shellingham | 1.5.4 | ISC |
| six | 1.17.0 | MIT |
| slack_bolt | 1.30.0 | MIT |
| slack_sdk | 3.47.0 | MIT |
| slowapi | 0.1.10 | MIT |
| smmap | 5.0.3 | BSD |
| sniffio | 1.3.1 | Apache-2.0 AND MIT |
| sortedcontainers | 2.4.0 | Apache-2.0 |
| SQLAlchemy | 2.1.9 | MIT |
| sse-starlette | 3.7.0 | BSD-3-Clause |
| starlette | 1.10.0 | BSD-3-Clause |
| stevedore | 5.10.0 | Apache-2.0 |
| tenacity | 9.1.4 | Apache-2.0 |
| tiktoken | 0.14.0 | MIT |
| tokenizers | 0.23.3 | Apache-2.0 |
| tree-sitter | 0.25.2 | MIT |
| tree-sitter-c | 0.24.2 | MIT |
| tree-sitter-cpp | 0.23.4 | MIT |
| tree-sitter-go | 0.25.0 | MIT |
| tree-sitter-java | 0.23.5 | MIT |
| tree-sitter-javascript | 0.25.0 | MIT |
| tree-sitter-json | 0.24.8 | MIT |
| tree-sitter-language-pack | 1.25.2 | MIT |
| tree-sitter-python | 0.25.0 | MIT |
| tree-sitter-rust | 0.24.2 | MIT |
| tree-sitter-typescript | 0.23.2 | MIT |
| truststore | 0.10.5 | MIT |
| ty | 0.0.105 | MIT |
| typer | 0.29.1 | MIT |
| types-python-dateutil | 2.9.0.20261116 | Apache-2.0 |
| typing-inspection | 0.4.5 | MIT |
| typing_extensions | 4.16.0 | PSF-2.0 |
| tzdata | 2026.6 | Apache-2.0 |
| urllib3 | 2.8.0 | MIT |
| uvicorn | 0.54.0 | BSD-3-Clause |
| uvloop | 0.23.0 | Apache-2.0 AND MIT |
| watchdog | 7.1.0 | Apache-2.0 |
| watchfiles | 1.3.0 | MIT |
| websockets | 17.4 | BSD-3-Clause |
| wrapt | 2.5.2 | BSD-2-Clause |
| yarl | 1.25.1 | Apache-2.0 |
| youtube-transcript-api | 1.2.5 | MIT |
| yt-dlp | 2026.10.26 | Unlicense |
| yt-dlp-ejs | 0.8.0 | Unlicense AND MIT AND ISC |
| zipp | 4.1.2 | MIT |
| zstandard | 0.25.0 | BSD-3-Clause |
| @adobe/css-tools | 4.5.0 | MIT |
| @apideck/better-ajv-errors | 0.3.7 | MIT |
| @babel/code-frame | 7.29.7 | MIT |
| @babel/compat-data | 7.29.7 | MIT |
| @babel/core | 7.29.13 | MIT |
| @babel/generator | 7.29.14 | MIT |
| @babel/helper-annotate-as-pure | 7.29.7 | MIT |
| @babel/helper-compilation-targets | 7.29.13 | MIT |
| @babel/helper-create-class-features-plugin | 7.29.13 | MIT |
| @babel/helper-create-regexp-features-plugin | 7.29.14 | MIT |
| @babel/helper-define-polyfill-provider | 0.6.8 | MIT |
| @babel/helper-globals | 7.29.7 | MIT |
| @babel/helper-member-expression-to-functions | 7.29.14 | MIT |
| @babel/helper-module-imports | 7.29.7 | MIT |
| @babel/helper-module-transforms | 7.29.14 | MIT |
| @babel/helper-optimise-call-expression | 7.29.7 | MIT |
| @babel/helper-plugin-utils | 7.29.7 | MIT |
| @babel/helper-remap-async-to-generator | 7.29.7 | MIT |
| @babel/helper-replace-supers | 7.29.7 | MIT |
| @babel/helper-skip-transparent-expression-wrappers | 7.29.13 | MIT |
| @babel/helper-string-parser | 7.29.14, 8.1.2 | MIT |
| @babel/helper-validator-identifier | 7.29.7, 8.0.6 | MIT |
| @babel/helper-validator-option | 7.29.7 | MIT |
| @babel/helper-wrap-function | 7.29.14 | MIT |
| @babel/helpers | 7.29.14 | MIT |
| @babel/parser | 7.29.14, 8.1.2 | MIT |
| @babel/plugin-bugfix-firefox-class-in-computed-class-key | 7.29.7 | MIT |
| @babel/plugin-bugfix-safari-class-field-initializer-scope | 7.29.7 | MIT |
| @babel/plugin-bugfix-safari-id-destructuring-collision-in-function-expression | 7.29.7 | MIT |
| @babel/plugin-bugfix-safari-rest-destructuring-rhs-array | 7.29.13 | MIT |
| @babel/plugin-bugfix-v8-spread-parameters-in-optional-chaining | 7.29.7 | MIT |
| @babel/plugin-bugfix-v8-static-class-fields-redefine-readonly | 7.29.7 | MIT |
| @babel/plugin-proposal-private-property-in-object | 7.21.0-placeholder-for-preset-env.2 | MIT |
| @babel/plugin-syntax-import-assertions | 7.29.7 | MIT |
| @babel/plugin-syntax-import-attributes | 7.29.7 | MIT |
| @babel/plugin-syntax-unicode-sets-regex | 7.18.6 | MIT |
| @babel/plugin-transform-arrow-functions | 7.29.7 | MIT |
| @babel/plugin-transform-async-generator-functions | 7.29.7 | MIT |
| @babel/plugin-transform-async-to-generator | 7.29.7 | MIT |
| @babel/plugin-transform-block-scoped-functions | 7.29.7 | MIT |
| @babel/plugin-transform-block-scoping | 7.29.13 | MIT |
| @babel/plugin-transform-class-properties | 7.29.7 | MIT |
| @babel/plugin-transform-class-static-block | 7.29.14 | MIT |
| @babel/plugin-transform-classes | 7.29.11 | MIT |
| @babel/plugin-transform-computed-properties | 7.29.7 | MIT |
| @babel/plugin-transform-destructuring | 7.29.13 | MIT |
| @babel/plugin-transform-dotall-regex | 7.29.7 | MIT |
| @babel/plugin-transform-duplicate-keys | 7.29.7 | MIT |
| @babel/plugin-transform-duplicate-named-capturing-groups-regex | 7.29.7 | MIT |
| @babel/plugin-transform-dynamic-import | 7.29.7 | MIT |
| @babel/plugin-transform-explicit-resource-management | 7.29.7 | MIT |
| @babel/plugin-transform-exponentiation-operator | 7.29.7 | MIT |
| @babel/plugin-transform-export-namespace-from | 7.29.7 | MIT |
| @babel/plugin-transform-for-of | 7.29.13 | MIT |
| @babel/plugin-transform-function-name | 7.29.7 | MIT |
| @babel/plugin-transform-json-strings | 7.29.7 | MIT |
| @babel/plugin-transform-literals | 7.29.7 | MIT |
| @babel/plugin-transform-logical-assignment-operators | 7.29.7 | MIT |
| @babel/plugin-transform-member-expression-literals | 7.29.7 | MIT |
| @babel/plugin-transform-modules-amd | 7.29.14 | MIT |
| @babel/plugin-transform-modules-commonjs | 7.29.14 | MIT |
| @babel/plugin-transform-modules-systemjs | 7.29.8 | MIT |
| @babel/plugin-transform-modules-umd | 7.29.14 | MIT |
| @babel/plugin-transform-named-capturing-groups-regex | 7.29.7 | MIT |
| @babel/plugin-transform-new-target | 7.29.7 | MIT |
| @babel/plugin-transform-nullish-coalescing-operator | 7.29.7 | MIT |
| @babel/plugin-transform-numeric-separator | 7.29.7 | MIT |
| @babel/plugin-transform-object-rest-spread | 7.29.7 | MIT |
| @babel/plugin-transform-object-super | 7.29.7 | MIT |
| @babel/plugin-transform-optional-catch-binding | 7.29.7 | MIT |
| @babel/plugin-transform-optional-chaining | 7.29.7 | MIT |
| @babel/plugin-transform-parameters | 7.29.7 | MIT |
| @babel/plugin-transform-private-methods | 7.29.7 | MIT |
| @babel/plugin-transform-private-property-in-object | 7.29.7 | MIT |
| @babel/plugin-transform-property-literals | 7.29.7 | MIT |
| @babel/plugin-transform-regenerator | 7.29.8 | MIT |
| @babel/plugin-transform-regexp-modifiers | 7.29.7 | MIT |
| @babel/plugin-transform-reserved-words | 7.29.7 | MIT |
| @babel/plugin-transform-shorthand-properties | 7.29.7 | MIT |
| @babel/plugin-transform-spread | 7.29.11 | MIT |
| @babel/plugin-transform-sticky-regex | 7.29.7 | MIT |
| @babel/plugin-transform-template-literals | 7.29.7 | MIT |
| @babel/plugin-transform-typeof-symbol | 7.29.7 | MIT |
| @babel/plugin-transform-unicode-escapes | 7.29.7 | MIT |
| @babel/plugin-transform-unicode-property-regex | 7.29.7 | MIT |
| @babel/plugin-transform-unicode-regex | 7.29.7 | MIT |
| @babel/plugin-transform-unicode-sets-regex | 7.29.7 | MIT |
| @babel/preset-env | 7.29.14 | MIT |
| @babel/preset-modules | 0.1.6-no-external-plugins | MIT |
| @babel/runtime | 7.29.14 | MIT |
| @babel/template | 7.29.7 | MIT |
| @babel/traverse | 7.29.14 | MIT |
| @babel/types | 7.29.14, 8.1.2 | MIT |
| @bcoe/v8-coverage | 1.0.2 | MIT |
| @bytecodealliance/jco-node-fs | 0.3.2 | (Apache-2.0 WITH LLVM-exception) |
| @bytecodealliance/jco-node-fs-linux-x64-gnu | 0.3.2 | (Apache-2.0 WITH LLVM-exception) |
| @bytecodealliance/jco-transpile | 0.13.0 | (Apache-2.0 WITH LLVM-exception) |
| @bytecodealliance/preview2-shim | 0.24.1, 0.25.0 | (Apache-2.0 WITH LLVM-exception) |
| @bytecodealliance/preview3-shim | 0.6.1 | (Apache-2.0 WITH LLVM-exception) |
| @dimforge/rapier3d-compat | 0.12.0 | Apache-2.0 |
| @dnd-kit/accessibility | 3.1.1 | MIT |
| @dnd-kit/core | 6.3.1 | MIT |
| @dnd-kit/utilities | 3.2.2 | MIT |
| @electron-internal/extract-zip | 1.0.8 | MIT |
| @electron/asar | 3.4.1 | MIT |
| @electron/fuses | 1.8.0 | MIT |
| @electron/get | 3.1.0, 5.1.0 | MIT |
| @electron/notarize | 2.5.0 | MIT |
| @electron/osx-sign | 1.3.3 | BSD-2-Clause |
| @electron/rebuild | 4.2.1 | MIT |
| @electron/universal | 2.0.3 | MIT |
| @electron/windows-sign | 1.2.2 | BSD-2-Clause |
| @esbuild/linux-x64 | 0.28.2 | MIT |
| @exodus/bytes | 1.16.0 | MIT |
| @floating-ui/core | 1.8.0 | MIT |
| @floating-ui/dom | 1.8.0 | MIT |
| @floating-ui/react-dom | 2.1.9 | MIT |
| @floating-ui/utils | 0.2.12 | MIT |
| @inlang/paraglide-js | 3.2.2 | MIT |
| @inlang/recommend-sherlock | 0.2.1 | MIT |
| @inlang/sdk | 4.2.0 | MIT |
| @isaacs/cliui | 9.0.0 | BlueOak-1.0.0 |
| @isaacs/fs-minipass | 4.0.1 | ISC |
| @jridgewell/gen-mapping | 0.3.13 | MIT |
| @jridgewell/remapping | 2.3.5 | MIT |
| @jridgewell/resolve-uri | 3.1.3 | MIT |
| @jridgewell/source-map | 0.3.11 | MIT |
| @jridgewell/sourcemap-codec | 1.6.0 | MIT |
| @jridgewell/trace-mapping | 0.3.31 | MIT |
| @lix-js/sdk | 0.20.1 | MIT |
| @malept/cross-spawn-promise | 2.0.0 | Apache-2.0 |
| @malept/flatpak-bundler | 0.4.0 | MIT |
| @mediapipe/tasks-vision | 0.10.17 | Apache-2.0 |
| @monaco-editor/loader | 1.7.0 | MIT |
| @monaco-editor/react | 4.7.0 | MIT |
| @monogrid/gainmap-js | 3.7.3 | MIT |
| @napi-rs/canvas | 1.1.1 | MIT |
| @napi-rs/canvas-linux-x64-gnu | 1.1.1 | MIT |
| @noble/hashes | 1.8.0 | MIT |
| @opentelemetry/api | 1.10.0 | Apache-2.0 |
| @oxc-minify/binding-linux-x64-gnu | 0.136.0 | MIT |
| @oxc-parser/binding-linux-x64-gnu | 0.152.0, 0.156.0 | MIT |
| @oxc-project/types | 0.152.0, 0.156.0 | MIT |
| @oxc-resolver/binding-linux-x64-gnu | 11.24.2 | MIT |
| @oxlint/binding-linux-x64-gnu | 1.94.0 | MIT |
| @peculiar/asn1-schema | 2.11.1 | MIT |
| @peculiar/json-schema | 1.1.12 | MIT |
| @peculiar/utils | 2.0.3 | MIT |
| @peculiar/webcrypto | 1.7.2 | MIT |
| @playwright/test | 1.65.1 | Apache-2.0 |
| @radix-ui/number | 1.1.3 | MIT |
| @radix-ui/primitive | 1.2.0 | MIT |
| @radix-ui/react-accordion | 1.3.1 | MIT |
| @radix-ui/react-arrow | 1.1.17 | MIT |
| @radix-ui/react-avatar | 1.3.1 | MIT |
| @radix-ui/react-collapsible | 1.2.1 | MIT |
| @radix-ui/react-collection | 1.2.0 | MIT |
| @radix-ui/react-compose-refs | 1.1.5 | MIT |
| @radix-ui/react-context | 1.3.0 | MIT |
| @radix-ui/react-dialog | 1.3.1 | MIT |
| @radix-ui/react-direction | 1.2.0 | MIT |
| @radix-ui/react-dismissable-layer | 1.2.1 | MIT |
| @radix-ui/react-dropdown-menu | 2.2.1 | MIT |
| @radix-ui/react-focus-guards | 1.2.0 | MIT |
| @radix-ui/react-focus-scope | 1.3.1 | MIT |
| @radix-ui/react-hover-card | 1.2.1 | MIT |
| @radix-ui/react-id | 1.1.4 | MIT |
| @radix-ui/react-label | 2.1.17 | MIT |
| @radix-ui/react-menu | 2.2.1 | MIT |
| @radix-ui/react-popover | 1.3.1 | MIT |
| @radix-ui/react-popper | 1.4.0 | MIT |
| @radix-ui/react-portal | 1.2.0 | MIT |
| @radix-ui/react-presence | 1.1.11 | MIT |
| @radix-ui/react-primitive | 2.2.0 | MIT |
| @radix-ui/react-roving-focus | 1.2.1 | MIT |
| @radix-ui/react-scroll-area | 1.4.0 | MIT |
| @radix-ui/react-select | 2.4.1 | MIT |
| @radix-ui/react-separator | 1.2.0 | MIT |
| @radix-ui/react-slider | 1.6.1 | MIT |
| @radix-ui/react-slot | 1.5.0 | MIT |
| @radix-ui/react-switch | 1.4.1 | MIT |
| @radix-ui/react-tabs | 1.2.1 | MIT |
| @radix-ui/react-tooltip | 1.4.1 | MIT |
| @radix-ui/react-use-callback-ref | 1.1.5 | MIT |
| @radix-ui/react-use-controllable-state | 1.3.0 | MIT |
| @radix-ui/react-use-effect-event | 0.0.5 | MIT |
| @radix-ui/react-use-is-hydrated | 0.1.3 | MIT |
| @radix-ui/react-use-layout-effect | 1.1.4 | MIT |
| @radix-ui/react-use-rect | 1.1.4 | MIT |
| @radix-ui/react-use-size | 1.1.5 | MIT |
| @radix-ui/react-visually-hidden | 1.2.13 | MIT |
| @radix-ui/rect | 1.1.3 | MIT |
| @react-spring/animated | 10.0.4 | MIT |
| @react-spring/core | 10.0.4 | MIT |
| @react-spring/rafz | 10.0.4 | MIT |
| @react-spring/shared | 10.0.4 | MIT |
| @react-spring/three | 10.0.4 | MIT |
| @react-spring/types | 10.0.4 | MIT |
| @react-symbols/icons | 1.4.1 | MIT |
| @react-three/drei | 10.7.9 | MIT |
| @react-three/fiber | 9.8.2 | MIT |
| @rolldown/binding-linux-x64-gnu | 1.2.19 | MIT |
| @rolldown/pluginutils | 1.1.1 | MIT |
| @rollup/plugin-babel | 6.1.0 | MIT |
| @rollup/plugin-node-resolve | 16.0.3 | MIT |
| @rollup/plugin-replace | 6.0.3 | MIT |
| @rollup/plugin-terser | 1.0.2 | MIT |
| @rollup/pluginutils | 5.5.1 | MIT |
| @rollup/rollup-linux-x64-gnu | 4.68.4 | MIT |
| @sentry/browser | 11.10.0 | MIT |
| @sentry/browser-utils | 11.10.0 | MIT |
| @sentry/bundler-plugins | 11.10.0 | MIT |
| @sentry/conventions | 0.29.0 | MIT |
| @sentry/core | 11.10.0 | MIT |
| @sentry/electron | 8.4.0 | MIT |
| @sentry/feedback | 11.10.0 | MIT |
| @sentry/node | 11.10.0 | MIT |
| @sentry/opentelemetry | 11.10.0 | MIT |
| @sentry/replay | 11.10.0 | MIT |
| @sentry/replay-canvas | 11.10.0 | MIT |
| @sentry/server-runtime-injection | 11.10.0 | MIT |
| @sentry/server-utils | 11.10.0 | MIT |
| @sinclair/typebox | 0.31.30 | MIT |
| @sindresorhus/is | 4.6.0 | MIT |
| @szmarczak/http-timer | 4.0.6 | MIT |
| @tailwindcss/node | 4.3.5 | MIT |
| @tailwindcss/oxide | 4.3.5 | MIT |
| @tailwindcss/oxide-linux-x64-gnu | 4.3.5 | MIT |
| @tailwindcss/oxide-wasm32-wasi | 4.3.5 | MIT |
| @tailwindcss/typography | 0.5.20 | MIT |
| @tailwindcss/vite | 4.3.5 | MIT |
| @tanstack/history | 1.162.5 | MIT |
| @tanstack/query-core | 5.107.1 | MIT |
| @tanstack/react-query | 5.107.1 | MIT |
| @tanstack/react-router | 1.170.46 | MIT |
| @tanstack/react-store | 0.11.2 | MIT |
| @tanstack/react-virtual | 3.14.26 | MIT |
| @tanstack/router-cli | 1.168.0 | MIT |
| @tanstack/router-core | 1.171.39 | MIT |
| @tanstack/router-generator | 1.168.0 | MIT |
| @tanstack/router-plugin | 1.169.0 | MIT |
| @tanstack/router-utils | 1.163.0 | MIT |
| @tanstack/store | 0.11.2 | MIT |
| @tanstack/virtual-core | 3.19.11 | MIT |
| @tanstack/virtual-file-routes | 1.162.0 | MIT |
| @testing-library/dom | 10.4.2 | MIT |
| @testing-library/jest-dom | 7.0.1 | MIT |
| @testing-library/react | 16.3.3 | MIT |
| @trickfilm400/rollup-plugin-off-main-thread | 3.0.0-pre1 | Apache-2.0 |
| @tweenjs/tween.js | 23.1.3 | MIT |
| @types/aria-query | 5.0.4 | MIT |
| @types/cacheable-request | 6.0.3 | MIT |
| @types/chai | 5.2.3 | MIT |
| @types/debug | 4.1.13 | MIT |
| @types/deep-eql | 4.0.2 | MIT |
| @types/draco3d | 1.4.10 | MIT |
| @types/estree | 1.0.10 | MIT |
| @types/estree-jsx | 1.0.5 | MIT |
| @types/fs-extra | 9.0.13 | MIT |
| @types/hast | 3.0.5 | MIT |
| @types/http-cache-semantics | 4.2.0 | MIT |
| @types/keyv | 3.1.4 | MIT |
| @types/mdast | 4.0.4 | MIT |
| @types/ms | 2.1.0 | MIT |
| @types/node | 24.19.2, 26.6.6 | MIT |
| @types/offscreencanvas | 2019.7.3 | MIT |
| @types/prismjs | 1.26.6 | MIT |
| @types/react | 19.3.0 | MIT |
| @types/react-dom | 19.3.0 | MIT |
| @types/react-reconciler | 0.28.9 | MIT |
| @types/react-syntax-highlighter | 15.5.13 | MIT |
| @types/resolve | 1.20.2 | MIT |
| @types/responselike | 1.0.3 | MIT |
| @types/stats.js | 0.17.4 | MIT |
| @types/three | 0.185.4 | MIT |
| @types/trusted-types | 2.0.7 | MIT |
| @types/unist | 2.0.11, 3.0.3 | MIT |
| @types/webxr | 0.5.24 | MIT |
| @typescript/typescript-linux-x64 | 7.0.2 | Apache-2.0 |
| @ungap/structured-clone | 1.4.0 | ISC |
| @use-gesture/core | 10.3.1 | MIT |
| @use-gesture/react | 10.3.1 | MIT |
| @vitejs/plugin-react | 6.3.0 | MIT |
| @vitest/coverage-v8 | 5.1.0 | MIT |
| @vitest/istanbul-lib-coverage | 2.1.0 | MIT |
| @vitest/istanbul-lib-report | 2.1.0 | MIT |
| @vitest/mocker | 5.1.0 | MIT |
| @vitest/spy | 5.1.0 | MIT |
| @xmldom/xmldom | 0.8.15 | MIT |
| @xterm/addon-fit | 0.11.0 | MIT |
| @xterm/addon-web-links | 0.12.0 | MIT |
| @xterm/xterm | 6.0.0 | MIT |
| @yomguithereal/helpers | 1.1.1 | MIT |
| abbrev | 4.0.0 | ISC |
| acorn | 8.19.0 | MIT |
| agent-base | 7.1.4 | MIT |
| ajv | 8.20.0 | MIT |
| ansi-regex | 5.0.1 | MIT |
| ansi-styles | 4.3.0, 5.2.0 | MIT |
| ansis | 4.5.0 | ISC |
| app-builder-lib | 26.18.0 | MIT |
| argparse | 2.0.1 | Python-2.0 |
| aria-hidden | 1.2.6 | MIT |
| aria-query | 5.3.0, 5.3.2 | Apache-2.0 |
| array-buffer-byte-length | 1.0.2 | MIT |
| array-timsort | 1.0.3 | MIT |
| arraybuffer.prototype.slice | 1.0.4 | MIT |
| asn1js | 3.1.0 | BSD-3-Clause |
| assertion-error | 2.0.1 | MIT |
| ast-v8-to-istanbul | 1.0.8 | MIT |
| async | 3.2.6 | MIT |
| async-exit-hook | 2.0.1 | MIT |
| async-function | 1.0.0 | MIT |
| asynckit | 0.4.0 | MIT |
| at-least-node | 1.0.0 | ISC |
| available-typed-arrays | 1.0.7 | MIT |
| aws4 | 1.13.2 | MIT |
| babel-dead-code-elimination | 1.0.12 | MIT |
| babel-plugin-polyfill-corejs2 | 0.4.17 | MIT |
| babel-plugin-polyfill-corejs3 | 0.14.2 | MIT |
| babel-plugin-polyfill-regenerator | 0.6.8 | MIT |
| bail | 2.0.2 | MIT |
| balanced-match | 1.0.2, 4.0.4 | MIT |
| base64-js | 1.5.1 | MIT |
| baseline-browser-mapping | 2.11.37 | Apache-2.0 |
| bcp-47 | 2.1.2 | MIT |
| bcp-47-match | 2.0.3 | MIT |
| bidi-js | 1.1.0 | MIT |
| binaryen | 130.0.0 | Apache-2.0 |
| bluebird | 3.7.2 | MIT |
| boolean | 3.2.0 | MIT |
| brace-expansion | 1.1.22, 2.1.8, 5.0.13 | MIT |
| browserslist | 4.29.6 | MIT |
| buffer | 6.0.3 | MIT |
| buffer-from | 1.1.2 | MIT |
| builder-util | 26.16.0 | MIT |
| builder-util-runtime | 9.7.0 | MIT |
| bytestreamjs | 2.0.1 | BSD-3-Clause |
| cac | 7.1.0 | MIT |
| cacheable-lookup | 5.0.4 | MIT |
| cacheable-request | 7.0.4 | MIT |
| call-bind | 1.0.9 | MIT |
| call-bind-apply-helpers | 1.0.2 | MIT |
| call-bound | 1.0.4 | MIT |
| camera-controls | 3.1.2 | MIT |
| caniuse-lite | 1.0.30001826 | CC-BY-4.0 |
| ccount | 2.0.1 | MIT |
| chai | 6.3.0 | MIT |
| chalk | 4.1.2 | MIT |
| character-entities | 2.0.2 | MIT |
| character-entities-html4 | 2.1.0 | MIT |
| character-entities-legacy | 3.0.0 | MIT |
| character-reference-invalid | 2.0.1 | MIT |
| chokidar | 5.0.0 | MIT |
| chownr | 3.0.0 | BlueOak-1.0.0 |
| chromium-pickle-js | 0.2.0 | MIT |
| ci-info | 4.3.1, 4.5.0 | MIT |
| class-variance-authority | 0.7.1 | Apache-2.0 |
| classnames | 2.5.1 | MIT |
| cliui | 8.0.1 | ISC |
| clone-response | 1.0.3 | MIT |
| clsx | 2.1.1 | MIT |
| color-convert | 2.0.1 | MIT |
| color-name | 1.1.4 | MIT |
| combined-stream | 1.0.8 | MIT |
| comma-separated-tokens | 2.0.3 | MIT |
| commander | 2.20.3, 5.1.0, 9.5.0, 11.1.0 | MIT |
| comment-json | 4.6.2 | MIT |
| common-tags | 1.8.2 | MIT |
| compare-version | 0.1.2 | MIT |
| concat-map | 0.0.1 | MIT |
| consola | 3.4.0 | MIT |
| convert-source-map | 2.0.0 | MIT |
| cookie-es | 3.1.1 | MIT |
| core-js-compat | 3.51.0 | MIT |
| core-util-is | 1.0.3 | MIT |
| cross-dirname | 0.1.0 | MIT |
| cross-env | 7.0.3 | MIT |
| cross-spawn | 7.0.6 | MIT |
| crypto-random-string | 2.0.0 | MIT |
| css.escape | 1.5.1 | MIT |
| cssesc | 3.0.0 | MIT |
| csstype | 3.2.3 | MIT |
| d3-array | 3.2.5 | ISC |
| d3-binarytree | 1.0.2 | MIT |
| d3-color | 3.1.1 | ISC |
| d3-dispatch | 3.0.2 | ISC |
| d3-force-3d | 3.0.6 | MIT |
| d3-format | 3.1.3 | ISC |
| d3-hierarchy | 3.1.3 | ISC |
| d3-interpolate | 3.0.2 | ISC |
| d3-octree | 1.1.0 | MIT |
| d3-quadtree | 3.0.2 | ISC |
| d3-scale | 4.0.3 | ISC |
| d3-time | 3.1.1 | ISC |
| d3-time-format | 4.1.1 | ISC |
| d3-timer | 3.0.2 | ISC |
| data-urls | 8.0.0 | MIT |
| data-view-buffer | 1.0.2 | MIT |
| data-view-byte-length | 1.0.2 | MIT |
| data-view-byte-offset | 1.0.1 | MIT |
| date-fns | 4.4.0 | MIT |
| debug | 4.4.3 | MIT |
| decimal.js | 10.6.0 | MIT |
| decode-named-character-reference | 1.3.0 | MIT |
| decompress-response | 6.0.0 | MIT |
| deepmerge | 4.3.1 | MIT |
| defer-to-connect | 2.0.1 | MIT |
| define-data-property | 1.1.4 | MIT |
| define-properties | 1.2.1 | MIT |
| delayed-stream | 1.0.0 | MIT |
| dequal | 2.0.3 | MIT |
| detect-gpu | 5.0.70 | MIT |
| detect-libc | 2.1.2 | Apache-2.0 |
| detect-node | 2.1.0 | MIT |
| detect-node-es | 1.1.0 | MIT |
| devlop | 1.1.0 | MIT |
| diff | 9.0.0 | BSD-3-Clause |
| dir-compare | 4.2.0 | MIT |
| dmg-builder | 26.18.0 | MIT |
| dom-accessibility-api | 0.5.16, 0.6.3 | MIT |
| dompurify | 3.4.18 | (MPL-2.0 OR Apache-2.0) |
| dotenv | 16.6.1, 17.4.2 | BSD-2-Clause |
| dotenv-expand | 11.0.7 | BSD-2-Clause |
| draco3d | 1.5.9 | Apache-2.0 |
| dunder-proto | 1.0.1 | MIT |
| duplexer2 | 0.1.4 | BSD-3-Clause |
| ejs | 3.1.10 | Apache-2.0 |
| electron | 45.3.3 | MIT |
| electron-builder | 26.18.0 | MIT |
| electron-builder-squirrel-windows | 26.18.0 | MIT |
| electron-publish | 26.18.0 | MIT |
| electron-to-chromium | 1.5.486 | ISC |
| electron-updater | 6.8.11 | MIT |
| electron-winstaller | 5.4.0 | MIT |
| ellipsize | 0.7.0 | MIT |
| emoji-regex | 8.0.0 | MIT |
| end-of-stream | 1.4.5 | MIT |
| enhanced-resolve | 5.27.0 | MIT |
| entities | 9.0.0 | BSD-2-Clause |
| env-paths | 2.2.1, 3.0.0 | MIT |
| err-code | 2.0.3 | MIT |
| es-abstract | 1.24.2 | MIT |
| es-abstract-get | 1.0.0 | MIT |
| es-define-property | 1.0.1 | MIT |
| es-errors | 1.3.0 | MIT |
| es-module-lexer | 2.3.2 | MIT |
| es-object-atoms | 1.1.2 | MIT |
| es-set-tostringtag | 2.1.0 | MIT |
| es-to-primitive | 1.3.4 | MIT |
| es6-error | 4.1.1 | MIT |
| esbuild | 0.28.2 | MIT |
| escalade | 3.2.0 | MIT |
| escape-string-regexp | 4.0.0, 5.0.0 | MIT |
| esprima | 4.0.1 | BSD-2-Clause |
| estree-util-is-identifier-name | 3.0.0 | MIT |
| estree-walker | 2.0.2, 3.0.3 | MIT |
| esutils | 2.0.3 | BSD-2-Clause |
| eta | 4.6.0 | MIT |
| events | 3.3.0 | MIT |
| expect-type | 1.4.0 | Apache-2.0 |
| exponential-backoff | 3.1.3 | Apache-2.0 |
| extend | 3.0.2 | MIT |
| fast-deep-equal | 3.1.3 | MIT |
| fast-json-stable-stringify | 2.1.0 | MIT |
| fast-uri | 3.1.9 | BSD-3-Clause |
| fault | 1.0.4 | MIT |
| fd-package-json | 2.0.0 | MIT |
| fdir | 6.5.0 | MIT |
| fflate | 0.6.11, 0.8.3 | MIT |
| filelist | 1.0.6 | Apache-2.0 |
| for-each | 0.3.5 | MIT |
| foreground-child | 3.3.1 | ISC |
| form-data | 4.0.6 | MIT |
| format | 0.2.2 | MIT |
| formatly | 0.11.4 | MIT |
| framer-motion | 14.14.0 | MIT |
| fs-extra | 7.0.1, 8.1.0, 9.1.0, 10.1.0, 11.3.1, 11.4.1 | MIT |
| fs.realpath | 1.0.0 | ISC |
| function-bind | 1.1.2 | MIT |
| function.prototype.name | 1.2.0 | MIT |
| functions-have-names | 1.2.3 | MIT |
| generator-function | 2.0.1 | MIT |
| gensync | 1.0.0-beta.2 | MIT |
| get-caller-file | 2.0.5 | ISC |
| get-intrinsic | 1.3.0 | MIT |
| get-nonce | 1.0.1 | MIT |
| get-own-enumerable-property-symbols | 3.0.2 | ISC |
| get-proto | 1.0.1 | MIT |
| get-stream | 5.2.0 | MIT |
| get-symbol-description | 1.1.0 | MIT |
| get-tsconfig | 4.14.3 | MIT |
| glob | 11.1.0, 13.0.7 | BlueOak-1.0.0 |
| glob | 7.2.3 | ISC |
| global-agent | 3.0.0 | BSD-3-Clause |
| globalthis | 1.0.4 | MIT |
| glsl-noise | 0.0.0 | MIT |
| gopd | 1.2.0 | MIT |
| got | 11.8.6 | MIT |
| graceful-fs | 4.2.12 | BlueOak-1.0.0 |
| graphology | 0.26.0 | MIT |
| graphology-indices | 0.17.1 | MIT |
| graphology-layout | 0.6.1 | MIT |
| graphology-layout-forceatlas2 | 0.10.1 | MIT |
| graphology-layout-noverlap | 0.4.2 | MIT |
| graphology-metrics | 2.4.2 | MIT |
| graphology-shortest-path | 2.1.0 | MIT |
| graphology-types | 0.24.8 | MIT |
| graphology-utils | 2.5.2 | MIT |
| has-bigints | 1.1.0 | MIT |
| has-flag | 4.0.0 | MIT |
| has-property-descriptors | 1.0.2 | MIT |
| has-proto | 1.2.0 | MIT |
| has-symbols | 1.1.0 | MIT |
| has-tostringtag | 1.0.2 | MIT |
| hasown | 2.0.4 | MIT |
| hast-util-parse-selector | 4.0.0 | MIT |
| hast-util-to-jsx-runtime | 2.3.7 | MIT |
| hast-util-whitespace | 3.0.0 | MIT |
| hastscript | 9.0.3 | MIT |
| highlight.js | 10.7.3 | BSD-3-Clause |
| highlightjs-vue | 1.0.0 | CC0-1.0 |
| hls.js | 1.7.4 | Apache-2.0 |
| hold-event | 1.1.2 | MIT |
| hosted-git-info | 4.1.0 | ISC |
| html-encoding-sniffer | 7.0.0 | MIT |
| html-url-attributes | 3.0.1 | MIT |
| http-cache-semantics | 4.3.0 | BSD-2-Clause |
| http-proxy-agent | 7.0.2 | MIT |
| http2-wrapper | 1.0.3 | MIT |
| https-proxy-agent | 7.0.6 | MIT |
| idb | 7.1.1 | ISC |
| ieee754 | 1.2.1 | BSD-3-Clause |
| immediate | 3.0.6 | MIT |
| immer | 11.2.10 | MIT |
| indent-string | 4.0.0 | MIT |
| inflight | 1.0.6 | ISC |
| inherits | 2.0.4 | ISC |
| inline-style-parser | 0.2.9 | MIT |
| internal-slot | 1.1.0 | MIT |
| internmap | 2.0.3 | ISC |
| is-alphabetical | 2.0.1 | MIT |
| is-alphanumerical | 2.0.1 | MIT |
| is-array-buffer | 3.0.5 | MIT |
| is-async-function | 2.1.1 | MIT |
| is-bigint | 1.1.0 | MIT |
| is-boolean-object | 1.2.2 | MIT |
| is-callable | 1.2.7 | MIT |
| is-core-module | 2.18.0 | MIT |
| is-data-view | 1.0.2 | MIT |
| is-date-object | 1.1.0 | MIT |
| is-decimal | 2.0.1 | MIT |
| is-document.all | 1.0.0 | MIT |
| is-finalizationregistry | 1.1.1 | MIT |
| is-fullwidth-code-point | 3.0.0 | MIT |
| is-generator-function | 1.1.2 | MIT |
| is-hexadecimal | 2.0.1 | MIT |
| is-map | 2.0.3 | MIT |
| is-module | 1.0.0 | MIT |
| is-negative-zero | 2.0.3 | MIT |
| is-number-object | 1.1.1 | MIT |
| is-obj | 1.0.1 | MIT |
| is-plain-obj | 4.1.0 | MIT |
| is-potential-custom-element-name | 1.0.1 | MIT |
| is-promise | 2.2.2 | MIT |
| is-regex | 1.2.1 | MIT |
| is-regexp | 1.0.0 | MIT |
| is-set | 2.0.3 | MIT |
| is-shared-array-buffer | 1.0.4 | MIT |
| is-stream | 2.0.1 | MIT |
| is-string | 1.1.1 | MIT |
| is-symbol | 1.1.1 | MIT |
| is-typed-array | 1.1.15 | MIT |
| is-weakmap | 2.0.2 | MIT |
| is-weakref | 1.1.1 | MIT |
| is-weakset | 2.0.4 | MIT |
| isarray | 1.0.0, 2.0.5 | MIT |
| isbinaryfile | 4.0.10, 5.0.7 | MIT |
| isbot | 5.2.3 | Unlicense |
| isexe | 2.0.0 | ISC |
| isexe | 3.1.5, 4.0.0 | BlueOak-1.0.0 |
| its-fine | 2.1.1 | MIT |
| jackspeak | 4.2.3 | BlueOak-1.0.0 |
| jake | 10.9.4 | Apache-2.0 |
| jiti | 2.7.0 | MIT |
| js-tokens | 4.0.0, 10.0.0 | MIT |
| js-yaml | 4.3.2 | MIT |
| jsdom | 31.0.1 | MIT |
| jsesc | 3.1.0 | MIT |
| json-buffer | 3.0.1 | MIT |
| json-schema-traverse | 1.0.0 | MIT |
| json-stringify-safe | 5.0.1 | ISC |
| json5 | 2.2.3 | MIT |
| jsonc-parser | 3.3.1 | MIT |
| jsonfile | 4.0.0, 6.2.1 | MIT |
| jsonpointer | 5.0.1 | MIT |
| keyv | 4.5.4 | MIT |
| knip | 6.45.1 | ISC |
| kysely | 0.28.20 | MIT |
| lazy-val | 1.0.5 | MIT |
| leven | 3.1.0 | MIT |
| lie | 3.3.0 | MIT |
| lodash | 4.18.1 | MIT |
| lodash.debounce | 4.0.8 | MIT |
| lodash.escaperegexp | 4.1.2 | MIT |
| lodash.isequal | 4.5.0 | MIT |
| longest-streak | 3.1.0 | MIT |
| lowercase-keys | 2.0.0 | MIT |
| lowlight | 1.20.0 | MIT |
| lru-cache | 11.5.3 | BlueOak-1.0.0 |
| lru-cache | 5.1.1, 6.0.0 | ISC |
| lucide-react | 1.73.0 | ISC |
| lz-string | 1.5.0 | MIT |
| maath | 0.10.8 | MIT |
| magic-string | 0.30.21, 1.4.5 | MIT |
| magicast | 0.5.5 | MIT |
| markdown-table | 3.1.0 | MIT |
| marked | 14.0.0 | MIT |
| matcher | 3.0.0 | MIT |
| math-intrinsics | 1.1.0 | MIT |
| mdast-util-find-and-replace | 3.0.4 | MIT |
| mdast-util-from-markdown | 2.1.0 | MIT |
| mdast-util-gfm | 3.1.0 | MIT |
| mdast-util-gfm-autolink-literal | 2.1.0 | MIT |
| mdast-util-gfm-footnote | 2.1.0 | MIT |
| mdast-util-gfm-strikethrough | 2.0.1 | MIT |
| mdast-util-gfm-table | 2.0.1 | MIT |
| mdast-util-gfm-task-list-item | 2.0.1 | MIT |
| mdast-util-mdx-expression | 2.0.1 | MIT |
| mdast-util-mdx-jsx | 3.2.1 | MIT |
| mdast-util-mdxjs-esm | 2.0.1 | MIT |
| mdast-util-phrasing | 4.1.0 | MIT |
| mdast-util-to-hast | 13.2.2 | MIT |
| mdast-util-to-markdown | 2.2.3 | MIT |
| mdast-util-to-string | 4.0.0 | MIT |
| meshline | 3.3.1 | MIT |
| meshoptimizer | 1.1.1 | MIT |
| micromark | 4.0.3 | MIT |
| micromark-core-commonmark | 2.0.4 | MIT |
| micromark-extension-gfm | 3.0.0 | MIT |
| micromark-extension-gfm-autolink-literal | 2.1.0 | MIT |
| micromark-extension-gfm-footnote | 2.1.0 | MIT |
| micromark-extension-gfm-strikethrough | 2.1.0 | MIT |
| micromark-extension-gfm-table | 2.1.2 | MIT |
| micromark-extension-gfm-tagfilter | 2.0.0 | MIT |
| micromark-extension-gfm-task-list-item | 2.1.0 | MIT |
| micromark-factory-destination | 2.0.1 | MIT |
| micromark-factory-label | 2.0.1 | MIT |
| micromark-factory-space | 2.1.0 | MIT |
| micromark-factory-title | 2.0.1 | MIT |
| micromark-factory-whitespace | 2.0.1 | MIT |
| micromark-util-character | 2.1.1 | MIT |
| micromark-util-chunked | 2.0.1 | MIT |
| micromark-util-classify-character | 2.0.1 | MIT |
| micromark-util-combine-extensions | 2.0.1 | MIT |
| micromark-util-decode-numeric-character-reference | 2.0.2 | MIT |
| micromark-util-decode-string | 2.0.1 | MIT |
| micromark-util-edit-map | 1.0.0 | MIT |
| micromark-util-encode | 2.0.1 | MIT |
| micromark-util-html-tag-name | 2.0.1 | MIT |
| micromark-util-normalize-identifier | 2.0.1 | MIT |
| micromark-util-resolve-all | 2.0.1 | MIT |
| micromark-util-sanitize-uri | 2.0.1 | MIT |
| micromark-util-subtokenize | 2.1.0 | MIT |
| micromark-util-symbol | 2.0.1 | MIT |
| micromark-util-types | 2.0.3 | MIT |
| mime | 2.6.0 | MIT |
| mime-db | 1.52.0 | MIT |
| mime-types | 2.1.35 | MIT |
| mimic-response | 1.0.1, 3.1.0 | MIT |
| min-indent | 1.0.1 | MIT |
| minimatch | 10.2.6 | BlueOak-1.0.0 |
| minimatch | 3.1.5, 5.1.9, 9.0.9 | ISC |
| minimist | 1.2.8 | MIT |
| minipass | 7.1.3 | BlueOak-1.0.0 |
| minizlib | 3.1.0 | MIT |
| mkdirp | 0.5.6 | MIT |
| mnemonist | 0.39.8 | MIT |
| monaco-editor | 0.57.0 | MIT |
| motion | 14.14.0 | MIT |
| motion-dom | 14.14.0 | MIT |
| motion-utils | 14.7.0 | MIT |
| ms | 2.1.3 | MIT |
| nanoid | 3.3.20 | MIT |
| next-themes | 0.4.6 | MIT |
| node-abi | 4.40.0 | MIT |
| node-api-version | 0.2.1 | MIT |
| node-gyp | 12.4.0 | MIT |
| node-int64 | 0.4.0 | MIT |
| node-releases | 2.0.64 | MIT |
| nopt | 9.0.0 | ISC |
| normalize-url | 6.1.0 | MIT |
| object-inspect | 1.13.4 | MIT |
| object-keys | 1.1.1 | MIT |
| object.assign | 4.1.7 | MIT |
| obliterator | 2.0.5 | MIT |
| obug | 3.0.0 | MIT |
| once | 1.4.0 | ISC |
| own-keys | 1.0.2 | MIT |
| oxc-minify | 0.136.0 | MIT |
| oxc-parser | 0.152.0, 0.156.0 | MIT |
| oxc-resolver | 11.24.2 | MIT |
| oxlint | 1.94.0 | MIT |
| p-cancelable | 2.1.1 | MIT |
| p-limit | 3.1.0 | MIT |
| package-json-from-dist | 1.0.1 | BlueOak-1.0.0 |
| package-manager-detector | 1.9.0 | MIT |
| pandemonium | 2.4.1 | MIT |
| parse-entities | 4.0.2 | MIT |
| parse5 | 8.1.1 | MIT |
| parse5-parser-stream | 8.1.1 | MIT |
| path-is-absolute | 1.0.1 | MIT |
| path-key | 3.1.1 | MIT |
| path-parse | 1.0.7 | MIT |
| path-scurry | 2.0.2 | BlueOak-1.0.0 |
| pathe | 2.0.3 | MIT |
| pdfjs-dist | 6.5.438 | Apache-2.0 |
| pe-library | 0.4.1 | MIT |
| picocolors | 1.1.1 | ISC |
| picomatch | 4.0.7 | MIT |
| pkijs | 3.4.3 | BSD-3-Clause |
| playwright | 1.65.1 | Apache-2.0 |
| playwright-core | 1.65.1 | Apache-2.0 |
| plist | 3.1.0 | MIT |
| possible-typed-array-names | 1.1.0 | MIT |
| postcss | 8.5.33 | MIT |
| postcss-selector-parser | 6.0.10 | MIT |
| postject | 1.0.0-alpha.6 | MIT |
| potpack | 1.0.2 | ISC |
| prettier | 3.10.1 | MIT |
| pretty-bytes | 5.6.0, 6.1.1 | MIT |
| pretty-format | 27.5.1 | MIT |
| prismjs | 1.30.0 | MIT |
| proc-log | 6.1.0 | ISC |
| process-nextick-args | 2.0.1 | MIT |
| progress | 2.0.3 | MIT |
| promise-retry | 2.0.1 | MIT |
| promise-worker-transferable | 1.0.4 | Apache-2.0 |
| proper-lockfile | 4.1.2 | MIT |
| property-information | 7.2.0 | MIT |
| pump | 3.0.4 | MIT |
| punycode | 2.3.1 | MIT |
| pvtsutils | 1.3.6 | MIT |
| pvutils | 1.2.0 | MIT |
| quick-lru | 5.1.1 | MIT |
| react | 19.3.1 | MIT |
| react-dom | 19.3.1 | MIT |
| react-is | 17.0.2 | MIT |
| react-markdown | 10.1.0 | MIT |
| react-remove-scroll | 2.7.2 | MIT |
| react-remove-scroll-bar | 2.3.8 | MIT |
| react-style-singleton | 2.2.3 | MIT |
| react-syntax-highlighter | 16.1.2 | MIT |
| react-use-measure | 2.1.7 | MIT |
| read-binary-file-arch | 1.0.6 | MIT |
| readable-stream | 2.3.8 | MIT |
| readdirp | 5.1.1 | MIT |
| reagraph | 4.32.0 | Apache-2.0 |
| redent | 3.0.0 | MIT |
| reflect.getprototypeof | 1.0.10 | MIT |
| refractor | 5.0.0 | MIT |
| regenerate | 1.5.0 | MIT |
| regenerate-unicode-properties | 10.3.0 | MIT |
| regexp.prototype.flags | 1.5.4 | MIT |
| regexpu-core | 6.5.4 | MIT |
| regjsgen | 0.8.0 | MIT |
| regjsparser | 0.14.1 | BSD-2-Clause |
| remark-gfm | 4.0.1 | MIT |
| remark-parse | 11.0.0 | MIT |
| remark-rehype | 11.1.2 | MIT |
| remark-stringify | 11.0.0 | MIT |
| require-directory | 2.1.1 | MIT |
| require-from-string | 2.0.2 | MIT |
| resedit | 1.7.2 | MIT |
| resolve | 1.22.14 | MIT |
| resolve-alpn | 1.2.1 | MIT |
| resolve-pkg-maps | 1.0.0 | MIT |
| responselike | 2.0.1 | MIT |
| retry | 0.12.0 | MIT |
| rimraf | 2.6.3 | ISC |
| roarr | 2.15.4 | BSD-3-Clause |
| rolldown | 1.2.19 | MIT |
| rollup | 4.68.4 | MIT |
| safe-array-concat | 1.1.4 | MIT |
| safe-buffer | 5.1.2 | MIT |
| safe-push-apply | 1.0.0 | MIT |
| safe-regex-test | 1.1.0 | MIT |
| sanitize-filename | 1.6.5 | WTFPL OR ISC |
| sax | 1.6.1 | BlueOak-1.0.0 |
| saxes | 6.0.0 | ISC |
| scheduler | 0.28.0 | MIT |
| semver | 5.7.3, 6.3.2, 7.7.4, 7.8.6 | ISC |
| semver-compare | 1.0.0 | MIT |
| serialize-error | 7.0.1 | MIT |
| serialize-javascript | 7.1.4 | BSD-3-Clause |
| seroval | 1.8.1 | MIT |
| seroval-plugins | 1.8.0 | MIT |
| set-function-length | 1.2.2 | MIT |
| set-function-name | 2.0.2 | MIT |
| set-proto | 1.0.0 | MIT |
| shebang-command | 2.0.0 | MIT |
| shebang-regex | 3.0.0 | MIT |
| side-channel | 1.1.1 | MIT |
| side-channel-list | 1.0.1 | MIT |
| side-channel-map | 1.0.1 | MIT |
| side-channel-weakmap | 1.0.2 | MIT |
| signal-exit | 3.0.7, 4.1.0 | ISC |
| simple-update-notifier | 2.0.0 | MIT |
| smob | 1.6.2 | MIT |
| smol-toml | 1.9.1 | BSD-3-Clause |
| source-map | 0.6.1, 0.8.0 | BSD-3-Clause |
| source-map-js | 1.2.2 | BSD-3-Clause |
| source-map-support | 0.5.21 | MIT |
| space-separated-tokens | 2.0.2 | MIT |
| sprintf-js | 1.1.3 | BSD-3-Clause |
| stat-mode | 1.0.0 | MIT |
| state-local | 1.0.7 | MIT |
| stats-gl | 2.4.2 | MIT |
| stats.js | 0.17.0 | MIT |
| std-env | 4.3.0 | MIT |
| stop-iteration-iterator | 1.1.0 | MIT |
| string-width | 4.2.3 | MIT |
| string.prototype.matchall | 4.1.0 | MIT |
| string.prototype.trim | 1.2.11 | MIT |
| string.prototype.trimend | 1.0.10 | MIT |
| string.prototype.trimstart | 1.0.8 | MIT |
| string_decoder | 1.1.1 | MIT |
| stringify-entities | 4.0.4 | MIT |
| stringify-object | 3.3.0 | BSD-2-Clause |
| strip-ansi | 6.0.1 | MIT |
| strip-comments | 2.0.1 | MIT |
| strip-indent | 3.0.0 | MIT |
| strip-json-comments | 5.0.3 | MIT |
| style-to-object | 2.0.2 | MIT |
| sumchecker | 3.0.1 | Apache-2.0 |
| supports-color | 7.2.0, 8.1.1 | MIT |
| supports-preserve-symlinks-flag | 1.0.0 | MIT |
| suspend-react | 0.1.3 | MIT |
| tailwind-merge | 3.7.0 | MIT |
| tailwindcss | 4.3.5 | MIT |
| tailwindcss-animate | 1.0.7 | MIT |
| tapable | 2.3.4 | MIT |
| tar | 7.5.23 | BlueOak-1.0.0 |
| temp | 0.9.4 | MIT |
| temp-dir | 2.0.0 | MIT |
| temp-file | 3.4.0 | MIT |
| tempy | 0.6.0 | MIT |
| terser | 5.51.2 | BSD-2-Clause |
| three | 0.184.0 | MIT |
| three-mesh-bvh | 0.8.3 | MIT |
| three-stdlib | 2.36.1 | MIT |
| tiny-async-pool | 1.3.0 | MIT |
| tiny-typed-emitter | 2.1.0 | MIT |
| tinybench | 6.2.3 | MIT |
| tinyexec | 1.3.1 | MIT |
| tinyglobby | 0.2.17 | MIT |
| tinyrainbow | 3.2.0 | MIT |
| tldts | 7.5.4 | MIT |
| tldts-core | 7.5.4 | MIT |
| tmp | 0.2.7 | MIT |
| tmp-promise | 3.0.3 | MIT |
| tough-cookie | 6.1.0 | BSD-3-Clause |
| tr46 | 7.0.0 | MIT |
| tree-kill | 1.2.2 | MIT |
| trim-lines | 3.0.1 | MIT |
| troika-three-text | 0.52.5 | MIT |
| troika-three-utils | 0.52.5 | MIT |
| troika-worker-utils | 0.52.0 | MIT |
| trough | 2.2.0 | MIT |
| truncate-utf8-bytes | 1.0.2 | WTFPL |
| tslib | 2.9.1 | 0BSD |
| tsx | 4.23.15 | MIT |
| tunnel-rat | 0.1.2 | MIT |
| type-fest | 0.13.1, 0.16.0 | (MIT OR CC0-1.0) |
| typed-array-buffer | 1.0.3 | MIT |
| typed-array-byte-length | 1.0.3 | MIT |
| typed-array-byte-offset | 1.0.5 | MIT |
| typed-array-length | 1.0.8 | MIT |
| typescript | 7.0.2 | Apache-2.0 |
| unbash | 6.0.4 | ISC |
| unbox-primitive | 1.1.0 | MIT |
| undici | 6.29.1, 7.30.2, 8.12.4 | MIT |
| undici-types | 7.24.6, 8.9.0 | MIT |
| unicode-canonical-property-names-ecmascript | 2.0.1 | MIT |
| unicode-match-property-ecmascript | 2.0.0 | MIT |
| unicode-match-property-value-ecmascript | 2.2.1 | MIT |
| unicode-property-aliases-ecmascript | 2.2.0 | MIT |
| unified | 11.0.5 | MIT |
| unique-string | 2.0.0 | MIT |
| unist-util-is | 6.0.1 | MIT |
| unist-util-position | 5.0.0 | MIT |
| unist-util-stringify-position | 4.0.0 | MIT |
| unist-util-visit | 5.2.0 | MIT |
| unist-util-visit-parents | 6.1.0 | MIT |
| universalify | 0.1.2, 2.0.1 | MIT |
| unplugin | 2.3.11, 3.7.0 | MIT |
| unzipper | 0.12.5 | MIT |
| upath | 1.2.0 | MIT |
| update-browserslist-db | 1.4.0 | MIT |
| urlpattern-polyfill | 10.1.0 | MIT |
| use-callback-ref | 1.3.3 | MIT |
| use-sidecar | 1.1.3 | MIT |
| use-sync-external-store | 1.7.0 | MIT |
| utf8-byte-length | 1.0.5 | (WTFPL OR MIT) |
| util-deprecate | 1.0.2 | MIT |
| utility-types | 3.11.0 | MIT |
| uuid | 14.0.3 | MIT |
| valibot | 1.5.0 | MIT |
| vfile | 6.0.3 | MIT |
| vfile-message | 4.0.4 | MIT |
| vite | 8.3.8 | MIT |
| vite-plugin-pwa | 2.0.0 | MIT |
| vitest | 5.1.0 | MIT |
| w3c-xmlserializer | 6.0.0 | MIT |
| walk-up-path | 4.0.0 | ISC |
| web-vitals | 6.2.3 | Apache-2.0 |
| webcrypto-core | 1.9.2 | MIT |
| webgl-constants | 1.1.1 | MIT |
| webgl-sdf-generator | 1.1.1 | MIT |
| webidl-conversions | 8.0.1 | BSD-2-Clause |
| webpack-virtual-modules | 0.6.2 | MIT |
| whatwg-mimetype | 5.0.0 | MIT |
| whatwg-url | 17.3.0 | MIT |
| which | 2.0.2, 5.0.0, 6.0.1 | ISC |
| which-boxed-primitive | 1.1.1 | MIT |
| which-builtin-type | 1.2.1 | MIT |
| which-collection | 1.0.2 | MIT |
| which-typed-array | 1.1.24 | MIT |
| why-is-node-running | 3.2.1 | MIT |
| workbox-background-sync | 7.4.1 | MIT |
| workbox-broadcast-update | 7.4.1 | MIT |
| workbox-build | 7.4.1 | MIT |
| workbox-cacheable-response | 7.4.1 | MIT |
| workbox-core | 7.4.1 | MIT |
| workbox-expiration | 7.4.1 | MIT |
| workbox-google-analytics | 7.4.1 | MIT |
| workbox-navigation-preload | 7.4.1 | MIT |
| workbox-precaching | 7.4.1 | MIT |
| workbox-range-requests | 7.4.1 | MIT |
| workbox-recipes | 7.4.1 | MIT |
| workbox-routing | 7.4.1 | MIT |
| workbox-strategies | 7.4.1 | MIT |
| workbox-streams | 7.4.1 | MIT |
| workbox-sw | 7.4.1 | MIT |
| workbox-window | 7.4.1 | MIT |
| wrap-ansi | 7.0.0 | MIT |
| wrappy | 1.0.2 | ISC |
| xml-name-validator | 5.0.0 | Apache-2.0 |
| xmlbuilder | 15.1.1 | MIT |
| xmlchars | 2.2.0 | MIT |
| y18n | 5.0.8 | ISC |
| yallist | 3.1.1, 4.0.0 | ISC |
| yallist | 5.0.0 | BlueOak-1.0.0 |
| yaml | 2.9.1 | ISC |
| yargs | 17.7.3 | MIT |
| yargs-parser | 21.1.1 | ISC |
| yocto-queue | 0.1.0 | MIT |
| zod | 4.6.7 | MIT |
| zustand | 4.5.7, 5.0.14, 5.1.0 | MIT |
| zwitch | 2.0.4 | MIT |
