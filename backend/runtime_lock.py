"""Exclusive process lock for one Vectora runtime home."""

from __future__ import annotations

import importlib
import socket
from collections.abc import Generator
from contextlib import contextmanager
from pathlib import Path
from typing import Protocol, cast


class _Fcntl(Protocol):
    LOCK_EX: int
    LOCK_NB: int
    LOCK_UN: int

    def flock(self, file_descriptor: int, operation: int) -> None: ...


class _Msvcrt(Protocol):
    LK_NBLCK: int
    LK_UNLCK: int

    def locking(self, file_descriptor: int, mode: int, nbytes: int) -> None: ...


try:
    _fcntl: _Fcntl | None = cast("_Fcntl", importlib.import_module("fcntl"))
except ImportError:  # pragma: no cover - usado no Windows
    _fcntl = None

try:
    _msvcrt: _Msvcrt | None = cast("_Msvcrt", importlib.import_module("msvcrt"))
except ImportError:  # pragma: no cover - usado em sistemas POSIX
    _msvcrt = None


class RuntimeHomeAlreadyRunningError(RuntimeError):
    """Raised when another process already owns the same runtime home."""


def unix_socket_is_active(socket_path: Path) -> bool:
    """Return whether an existing Unix socket accepts backend requests."""
    if not socket_path.exists():
        return False
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as probe:
        probe.settimeout(1)
        try:
            probe.connect(str(socket_path))
            probe.sendall(
                b"GET /health HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n"
            )
            response = bytearray()
            while b"\r\n" not in response:
                chunk = probe.recv(16)
                if not chunk:
                    return False
                response.extend(chunk)
            return response.startswith(b"HTTP/")
        except OSError:
            return False


@contextmanager
def lock_runtime_home(home: Path) -> Generator[None]:
    """Hold an OS-released lock while a backend serves a runtime home."""
    home.mkdir(parents=True, exist_ok=True)
    lock_path = home / "runtime.lock"
    with lock_path.open("a+b") as stream:
        if _fcntl is not None:
            try:
                _fcntl.flock(stream.fileno(), _fcntl.LOCK_EX | _fcntl.LOCK_NB)
            except BlockingIOError as exc:
                raise RuntimeHomeAlreadyRunningError(
                    f"Outra instância do Vectora já está usando {home}."
                ) from exc
            try:
                yield
            finally:
                _fcntl.flock(stream.fileno(), _fcntl.LOCK_UN)
            return

        if _msvcrt is None:  # pragma: no cover - plataforma não suportada
            raise RuntimeError("backend de lock de processo indisponível")
        stream.seek(0, 2)
        if stream.tell() == 0:
            stream.write(b"\0")
            stream.flush()
        stream.seek(0)
        try:
            _msvcrt.locking(stream.fileno(), _msvcrt.LK_NBLCK, 1)
        except OSError as exc:
            raise RuntimeHomeAlreadyRunningError(
                f"Outra instância do Vectora já está usando {home}."
            ) from exc
        try:
            yield
        finally:
            stream.seek(0)
            _msvcrt.locking(stream.fileno(), _msvcrt.LK_UNLCK, 1)
