"""Ajustes de tema da bandeja no Windows."""

import ctypes
import logging
import sys
from typing import Any, cast

logger = logging.getLogger(__name__)


def enable_dark_mode() -> None:
    """Ativa dark mode para menus Win32 via UxTheme ordinal 135 (Windows 10+)."""
    if sys.platform != "win32":
        return
    try:
        uxtheme = cast("Any", ctypes.WinDLL("uxtheme"))
        set_mode = uxtheme[135]
        set_mode.restype = ctypes.c_int
        set_mode(2)
        uxtheme[136]()
    except Exception as exc:
        logger.debug("tray: dark mode win32 indisponível: %s", exc)
