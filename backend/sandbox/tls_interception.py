"""Autoridade efêmera do proxy TLS do sandbox.

A chave da CA existe apenas na memória do backend. O jail recebe somente o
certificado público, para confiar no proxy; chaves privadas de certificados de
destino ficam numa pasta temporária do host, fora da pasta montada no jail.
"""

from __future__ import annotations

import hashlib
import ipaddress
import ssl
import tempfile
from datetime import UTC, datetime, timedelta
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID


class WorkspaceTLSAuthority:
    """Emite certificados de servidor por host para um único proxy/workspace."""

    def __init__(self, public_directory: Path) -> None:
        self._public_directory = public_directory
        self._key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        now = datetime.now(UTC)
        subject = issuer = x509.Name(
            [x509.NameAttribute(NameOID.COMMON_NAME, "Vectora sandbox local CA")]
        )
        self._certificate = (
            x509.CertificateBuilder()
            .subject_name(subject)
            .issuer_name(issuer)
            .public_key(self._key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(now - timedelta(minutes=1))
            .not_valid_after(now + timedelta(days=2))
            .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
            .add_extension(
                x509.SubjectKeyIdentifier.from_public_key(self._key.public_key()),
                critical=False,
            )
            .add_extension(
                x509.AuthorityKeyIdentifier.from_issuer_public_key(
                    self._key.public_key()
                ),
                critical=False,
            )
            .add_extension(
                x509.KeyUsage(
                    digital_signature=False,
                    content_commitment=False,
                    key_encipherment=False,
                    data_encipherment=False,
                    key_agreement=False,
                    key_cert_sign=True,
                    crl_sign=True,
                    encipher_only=False,
                    decipher_only=False,
                ),
                critical=True,
            )
            .sign(self._key, hashes.SHA256())
        )
        self.ca_file = public_directory / "sandbox-ca.pem"
        self.ca_file.write_bytes(
            self._certificate.public_bytes(serialization.Encoding.PEM)
        )
        self.ca_file.chmod(0o444)
        self.bundle_file = public_directory / "sandbox-ca-bundle.pem"
        roots = ssl.get_default_verify_paths().cafile
        if roots is None or not Path(roots).is_file():
            try:
                import certifi

                roots = certifi.where()
            except ImportError:
                roots = None
        if roots is None or not Path(roots).is_file():
            raise RuntimeError("bundle de certificados raiz do host indisponível")
        self._private_directory = Path(tempfile.mkdtemp(prefix="vgr-tls-"))
        self._private_directory.chmod(0o700)
        self.bundle_file.write_bytes(
            Path(roots).read_bytes() + b"\n" + self.ca_file.read_bytes()
        )
        self.bundle_file.chmod(0o444)
        self._contexts: dict[str, ssl.SSLContext] = {}

    def server_context(self, hostname: str) -> ssl.SSLContext:
        """Retorna um contexto TLS HTTP/1.1 com SAN restrito ao destino."""
        cached = self._contexts.get(hostname)
        if cached is not None:
            return cached
        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        try:
            address = ipaddress.ip_address(hostname)
            san: x509.GeneralName = x509.IPAddress(address)
        except ValueError:
            san = x509.DNSName(hostname.encode("idna").decode("ascii"))
        now = datetime.now(UTC)
        certificate = (
            x509.CertificateBuilder()
            .subject_name(
                x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, hostname)])
            )
            .issuer_name(self._certificate.subject)
            .public_key(key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(now - timedelta(minutes=1))
            .not_valid_after(now + timedelta(hours=12))
            .add_extension(x509.SubjectAlternativeName([san]), critical=False)
            .add_extension(
                x509.BasicConstraints(ca=False, path_length=None), critical=True
            )
            .add_extension(
                x509.AuthorityKeyIdentifier.from_issuer_public_key(
                    self._key.public_key()
                ),
                critical=False,
            )
            .sign(self._key, hashes.SHA256())
        )
        safe_host = hashlib.sha256(hostname.encode("utf-8")).hexdigest()
        cert_path = self._private_directory / f"{safe_host}.crt"
        key_path = self._private_directory / f"{safe_host}.key"
        cert_path.write_bytes(certificate.public_bytes(serialization.Encoding.PEM))
        key_path.write_bytes(
            key.private_bytes(
                serialization.Encoding.PEM,
                serialization.PrivateFormat.PKCS8,
                serialization.NoEncryption(),
            )
        )
        cert_path.chmod(0o600)
        key_path.chmod(0o600)
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.set_alpn_protocols(["http/1.1"])
        context.load_cert_chain(certfile=cert_path, keyfile=key_path)
        self._contexts[hostname] = context
        return context

    def close(self) -> None:
        """Remove chaves temporárias dos certificados de destino."""
        for path in self._private_directory.iterdir():
            path.unlink(missing_ok=True)
        self._private_directory.rmdir()
        self._contexts.clear()
