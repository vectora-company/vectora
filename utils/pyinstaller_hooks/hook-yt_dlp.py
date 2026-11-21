from __future__ import annotations

import importlib.util

from PyInstaller.utils.hooks import collect_data_files, collect_submodules


def _is_importable(module: str) -> bool:
    return importlib.util.find_spec(module) is not None


def _is_package(module: str) -> bool:
    spec = importlib.util.find_spec(module)
    return spec is not None and spec.submodule_search_locations is not None


def _include_urllib3_submodule(module: str) -> bool:
    return not module.startswith("urllib3.contrib.emscripten")


def _pycryptodome_module() -> str | None:
    if _is_importable("Cryptodome"):
        return "Cryptodome"
    if _is_importable("Crypto"):
        return "Crypto"
    return None


hiddenimports = [
    "yt_dlp.compat._legacy",
    "yt_dlp.compat._deprecated",
    "yt_dlp.utils._legacy",
    "yt_dlp.utils._deprecated",
]

crypto_module = _pycryptodome_module()
if crypto_module is not None:
    hiddenimports.append(crypto_module)

for package in ("websockets", "requests"):
    hiddenimports.extend(collect_submodules(package))

hiddenimports.extend(collect_submodules("urllib3", filter=_include_urllib3_submodule))
hiddenimports.extend(
    module
    for module in ("mutagen", "brotli", "certifi", "secretstorage", "curl_cffi")
    if _is_importable(module)
)

excludedimports = [
    "youtube_dl",
    "youtube_dlc",
    "test",
    "ytdlp_plugins",
    "devscripts",
    "bundle",
]

datas = []
if _is_package("curl_cffi"):
    datas.extend(collect_data_files("curl_cffi", includes=["cacert.pem"]))
if _is_package("yt_dlp_ejs"):
    datas.extend(collect_data_files("yt_dlp_ejs", includes=["**/*.js"]))
