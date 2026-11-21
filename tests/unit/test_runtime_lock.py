import socket
import threading
from pathlib import Path

import pytest

from backend.runtime_lock import (
    RuntimeHomeAlreadyRunningError,
    lock_runtime_home,
    unix_socket_is_active,
)


def test_runtime_home_lock_rejects_a_concurrent_owner_and_releases_afterward(
    tmp_path: Path,
) -> None:
    with lock_runtime_home(tmp_path):
        with pytest.raises(RuntimeHomeAlreadyRunningError, match="Outra instância"):
            with lock_runtime_home(tmp_path):
                pytest.fail("the second runtime must not enter the critical section")

    with lock_runtime_home(tmp_path):
        pass


@pytest.mark.skipif(not hasattr(socket, "AF_UNIX"), reason="Unix sockets unavailable")
def test_unix_socket_is_active_detects_a_listener_and_ignores_missing_path(
    tmp_path: Path,
) -> None:
    socket_path = tmp_path / "vectora.sock"
    server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    server.bind(str(socket_path))
    server.listen(1)
    worker = threading.Thread(
        target=lambda: _respond_to_unix_socket_probe(server),
        daemon=True,
    )
    worker.start()
    try:
        assert unix_socket_is_active(socket_path)
    finally:
        server.close()
        worker.join(timeout=1)
        socket_path.unlink(missing_ok=True)

    assert not unix_socket_is_active(socket_path)


def _respond_to_unix_socket_probe(server: socket.socket) -> None:
    connection, _ = server.accept()
    with connection:
        connection.recv(1024)
        connection.sendall(b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n")
