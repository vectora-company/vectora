"""Canais de distribuição do Vectora e o que cada um realmente oferece.

A lista é a fonte da interface e da documentação: um canal só aparece como
disponível quando o artefato existe e a instalação foi validada. Os demais ficam
identificados como planejados ou indisponíveis, sem prometer o que ainda não há.
"""

from __future__ import annotations

from typing import Final, Literal, TypedDict

ChannelStatus = Literal["available", "build_only", "planned"]


class Channel(TypedDict):
    id: str
    name: str
    status: ChannelStatus
    #: Formatos de instalador gerados para o canal (nomes do electron-builder).
    formats: list[str]
    #: Formatos cuja instalação e abertura o CI valida em ambiente limpo.
    install_validated: list[str]
    #: Como o usuário confere a integridade do que baixou.
    integrity: str
    note: str


CHANNELS: Final[list[Channel]] = [
    {
        "id": "github_release",
        "name": "GitHub Releases",
        "status": "available",
        "formats": [
            "nsis",
            "msi",
            "dmg",
            "zip",
            "AppImage",
            "deb",
            "rpm",
            "snap",
            "pacman",
            "flatpak",
            "tar.gz",
        ],
        "install_validated": ["exe", "msi", "dmg", "zip", "deb", "rpm"],
        "integrity": "checksums",
        "note": (
            "Instaladores de cada versão, com checksums. Windows x64 e ARM64, macOS "
            "Apple Silicon e Linux x64 e ARM64. O CI instala e abre exe, msi, dmg, "
            "zip, deb e rpm; AppImage, snap, flatpak, pacman e tar.gz são gerados, "
            "mas a instalação deles ainda não é validada."
        ),
    },
    {
        "id": "flathub",
        "name": "Flathub",
        "status": "build_only",
        "formats": ["flatpak"],
        "install_validated": [],
        "integrity": "checksums",
        "note": "O pacote flatpak é gerado, mas não está publicado no Flathub.",
    },
    {
        "id": "snap_store",
        "name": "Snap Store",
        "status": "build_only",
        "formats": ["snap"],
        "install_validated": [],
        "integrity": "checksums",
        "note": "O pacote snap é gerado, mas não está publicado na Snap Store.",
    },
    {
        "id": "apt_rpm_repository",
        "name": "Repositório APT e RPM",
        "status": "planned",
        "formats": [],
        "install_validated": [],
        "integrity": "",
        "note": "Os pacotes deb e rpm só estão nos GitHub Releases.",
    },
    {
        "id": "homebrew",
        "name": "Homebrew",
        "status": "planned",
        "formats": [],
        "install_validated": [],
        "integrity": "",
        "note": "Ainda não há cask publicado.",
    },
    {
        "id": "scoop",
        "name": "Scoop",
        "status": "planned",
        "formats": [],
        "install_validated": [],
        "integrity": "",
        "note": "Ainda não há manifesto publicado.",
    },
    {
        "id": "winget",
        "name": "WinGet",
        "status": "planned",
        "formats": [],
        "install_validated": [],
        "integrity": "",
        "note": "Ainda não há manifesto publicado.",
    },
    {
        "id": "install_script",
        "name": "Instalador por script",
        "status": "planned",
        "formats": [],
        "install_validated": [],
        "integrity": "",
        "note": "Ainda não há script de instalação publicado.",
    },
]
