#!/usr/bin/env bash
# Instala Laya e llama.cpp no perfil do usuário e integra o Laya ao Vectora.
set -Eeuo pipefail

OS=$(uname -s)
case "$OS" in
  Linux) ;;
  MINGW*|MSYS*|CYGWIN*|Windows_NT)
    printf 'laya-install.sh só pode continuar em Linux; Windows detectado.\n' >&2
    exit 1
    ;;
  Darwin)
    printf 'laya-install.sh só pode continuar em Linux; macOS detectado.\n' >&2
    exit 1
    ;;
  *)
    printf 'Sistema operacional não suportado: %s.\n' "$OS" >&2
    exit 1
    ;;
esac

if [[ ! -r /etc/os-release ]]; then
  printf 'Não foi possível detectar a distribuição Linux (/etc/os-release ausente).\n' >&2
  exit 1
fi
# shellcheck disable=SC1091
. /etc/os-release
case "${ID:-}:${ID_LIKE:-}" in
  pop:*|ubuntu:*|debian:*|*:debian*) DISTRO_FAMILY=debian ;;
  fedora:*|*:fedora*) DISTRO_FAMILY=fedora ;;
  arch:*|*:arch*) DISTRO_FAMILY=arch ;;
  *)
    printf 'Distribuição não mapeada: %s. O instalador não altera pacotes do sistema.\n' "${PRETTY_NAME:-unknown}" >&2
    exit 1
    ;;
esac

if (( EUID == 0 )); then
  printf 'Execute como usuário normal; este instalador não usa root nem sudo.\n' >&2
  exit 1
fi
for tool in uv git cmake c++ curl python3 systemctl; do
  command -v "$tool" >/dev/null 2>&1 || {
    printf 'Dependência ausente: %s. Instale-a pelo gerenciador da distribuição.\n' "$tool" >&2
    exit 1
  }
done
if ! systemctl --user show-environment >/dev/null 2>&1; then
  printf 'systemd de usuário não está disponível nesta sessão.\n' >&2
  exit 1
fi

VECTOR_HOME=${VECTORA_HOME:-"$HOME/.vectora-dev"}
DATA_HOME=${XDG_DATA_HOME:-"$HOME/.local/share"}
CONFIG_HOME=${XDG_CONFIG_HOME:-"$HOME/.config"}
LAYA_ROOT="$DATA_HOME/vectora/laya"
LAYA_VENV="$LAYA_ROOT/.venv"
LLAMA_ROOT="$VECTOR_HOME/tools/llama.cpp"
LLAMA_SRC_ROOT="$DATA_HOME/vectora/src"
LAYA_PORT=18000
MODE=${1:-install}
case "$MODE" in
  install|--check|-h|--help) ;;
  *) printf 'Uso: ./laya-install.sh [--check]\n' >&2; exit 2 ;;
esac
if [[ "$MODE" == -h || "$MODE" == --help ]]; then
  printf '%s\n' 'Uso: ./laya-install.sh [--check]' \
    '  padrão    instala Laya, compila llama.cpp e configura o provider Laya no Vectora' \
    '  --check   verifica runtimes, serviço e configuração sem alterar nada'
  exit 0
fi

printf 'Vectora local AI — %s (%s), perfil=%s\n' "${PRETTY_NAME:-Linux}" "$DISTRO_FAMILY" "$VECTOR_HOME"
if [[ "$MODE" == --check ]]; then
  PENDING=0
  if [[ -x "$LAYA_VENV/bin/laya-serve" ]]; then echo '[ok] Laya instalado'; else echo '[pendente] Laya'; ((PENDING+=1)); fi
  if systemctl --user is-active --quiet vectora-laya.service; then echo '[ok] serviço Laya ativo'; else echo '[pendente] serviço Laya'; ((PENDING+=1)); fi
  if [[ -x "$LLAMA_ROOT/active/bin/llama-server" ]]; then echo '[ok] llama.cpp instalado'; else echo '[pendente] llama.cpp'; ((PENDING+=1)); fi
  if [[ -f "$VECTOR_HOME/.env" ]]; then echo '[ok] arquivo de configuração Vectora existe'; else echo '[pendente] configuração Vectora'; ((PENDING+=1)); fi
  (( PENDING == 0 )) || exit 1
  exit 0
fi

mkdir -p "$LAYA_ROOT" "$CONFIG_HOME/systemd/user" "$LLAMA_SRC_ROOT" "$LLAMA_ROOT/versions" "$VECTOR_HOME"
chmod 700 "$LAYA_ROOT" "$CONFIG_HOME/systemd/user" "$VECTOR_HOME"

# Laya distribui seus próprios checkpoints de decisão; não é um modelo GGUF.
# CPU-only evita baixar CUDA e usa até quatro threads neste host.
if [[ ! -x "$LAYA_VENV/bin/python" ]]; then
  uv venv --python 3.12 "$LAYA_VENV"
fi
# Fixa o build CPU também durante a resolução das dependências do Laya. Sem
# essa restrição, o índice PyPI substitui o torch CPU por wheels CUDA enormes.
uv pip install --python "$LAYA_VENV/bin/python" \
  --index-url https://pypi.org/simple \
  --extra-index-url https://download.pytorch.org/whl/cpu \
  --index-strategy unsafe-best-match \
  'torch==2.9.1+cpu' 'laya[serve]==0.4.23'

LAYA_ENV="$CONFIG_HOME/vectora/laya.env"
mkdir -p "$(dirname "$LAYA_ENV")"
if [[ ! -s "$LAYA_ENV" ]]; then
  LAYA_KEY=$(python3 -c 'import secrets; print(secrets.token_hex(32))')
  umask 077
  cat > "$LAYA_ENV" <<EOF
LAYA_HOST=127.0.0.1
LAYA_PORT=$LAYA_PORT
LAYA_DEVICE=cpu
LAYA_PRELOAD=1
LAYA_MODELS=multilingual
LAYA_MAX_LOADED=1
LAYA_THREADS=4
LAYA_API_KEY=$LAYA_KEY
USE_TF=0
HF_HOME=$LAYA_ROOT/huggingface
EOF
fi
chmod 600 "$LAYA_ENV"
cat > "$CONFIG_HOME/systemd/user/vectora-laya.service" <<EOF
[Unit]
Description=Servidor local Laya para Vectora
After=network.target

[Service]
Type=simple
EnvironmentFile=$LAYA_ENV
ExecStart=$LAYA_VENV/bin/laya-serve
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=$LAYA_ROOT/huggingface $LAYA_ROOT

[Install]
WantedBy=default.target
EOF
# Compila o servidor CPU oficial em um diretório versionado e publica-o
# atomicamente no layout que o runtime gerenciado do Vectora já reconhece.
if [[ ! -x "$LLAMA_ROOT/active/bin/llama-server" ]]; then
  BUILD_SOURCE=$(find "$LLAMA_SRC_ROOT" -maxdepth 1 -type d -name 'llama.cpp.*' -print -quit)
  if [[ -z "$BUILD_SOURCE" ]]; then
    BUILD_SOURCE=$(mktemp -d "$LLAMA_SRC_ROOT/llama.cpp.XXXXXX")
    git -c http.version=HTTP/1.1 clone --depth 1 \
      https://github.com/ggml-org/llama.cpp.git "$BUILD_SOURCE/source"
  fi
  LLAMA_COMMIT=$(git -C "$BUILD_SOURCE/source" rev-parse HEAD)
  LLAMA_RUNTIME_ID=${LLAMA_COMMIT:0:16}
  BUILD_DIR="$BUILD_SOURCE/build"
  cmake -S "$BUILD_SOURCE/source" -B "$BUILD_DIR" \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX="$LLAMA_ROOT/versions/$LLAMA_RUNTIME_ID" \
    -DGGML_NATIVE=ON -DGGML_CUDA=OFF -DGGML_VULKAN=OFF -DGGML_METAL=OFF \
    -DLLAMA_BUILD_TESTS=OFF -DLLAMA_BUILD_EXAMPLES=OFF \
    -DLLAMA_BUILD_TOOLS=ON -DLLAMA_BUILD_SERVER=ON -DLLAMA_BUILD_APP=OFF \
    -DLLAMA_TESTS_INSTALL=OFF -DLLAMA_CURL=OFF
  cmake --build "$BUILD_DIR" --target llama-server --parallel "${VECTORA_BUILD_JOBS:-2}"
  cmake --install "$BUILD_DIR"
  VERSION_DIR="$LLAMA_ROOT/versions/$LLAMA_RUNTIME_ID"
  [[ -x "$VERSION_DIR/bin/llama-server" ]] || {
    printf 'O build não produziu llama-server executável.\n' >&2
    exit 1
  }
  "$VERSION_DIR/bin/llama-server" --version >/dev/null
  ln -sfn "versions/$LLAMA_RUNTIME_ID" "$LLAMA_ROOT/.active.tmp"
  mv -Tf "$LLAMA_ROOT/.active.tmp" "$LLAMA_ROOT/active"
  LLAMA_VERSION=$("$VERSION_DIR/bin/llama-server" --version | head -n 1)
  python3 - "$LLAMA_ROOT" "$LLAMA_RUNTIME_ID" "$LLAMA_VERSION" <<'PY'
import hashlib, json, pathlib, sys
from datetime import datetime, timezone
root = pathlib.Path(sys.argv[1])
version = sys.argv[2]
runtime_version = sys.argv[3]
directory = root / "versions" / version
files = [str(path) for path in directory.rglob("*") if path.is_file()]
digest = hashlib.sha256((directory / "bin" / "llama-server").read_bytes()).hexdigest()
manifest_path = root / "runtime-manifest.json"
try:
    old = json.loads(manifest_path.read_text(encoding="utf-8"))
    runtimes = old.get("runtimes", []) if isinstance(old, dict) else []
except (OSError, json.JSONDecodeError):
    runtimes = []
runtimes = [item for item in runtimes if not isinstance(item, dict) or item.get("id") != version]
runtimes.append({"id": version, "asset": "llama.cpp source build", "source": "https://github.com/ggml-org/llama.cpp", "sha256": digest, "files": files, "directory": str(directory), "version": runtime_version, "installed_at": datetime.now(timezone.utc).isoformat()})
manifest = {"runtimes": runtimes}
temporary = manifest_path.with_suffix(".json.tmp")
temporary.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
temporary.replace(manifest_path)
active = root / "active-runtime"
if not active.exists():
    active.write_text(version + "\n", encoding="utf-8")
PY
  rm -rf -- "$BUILD_SOURCE"
fi

systemctl --user daemon-reload
systemctl --user enable --now vectora-laya.service

# Persiste apenas os campos Laya. O segredo é gerado localmente e fica no
# arquivo privado do serviço; SystemOne continua desativado por padrão.
LAYA_KEY=$(sed -n 's/^LAYA_API_KEY=//p' "$LAYA_ENV")
VECTORA_ENV="$VECTOR_HOME/.env"
python3 - "$VECTORA_ENV" "$LAYA_KEY" <<'PY'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
key = sys.argv[2]
updates = {
    "SYSTEMONE_PROVIDER": "laya-local",
    "SYSTEMONE_LAYA_BASE_URL": "http://127.0.0.1:18000",
    "SYSTEMONE_LAYA_MODEL": "convaiinnovations/laya",
    "SYSTEMONE_LAYA_API_KEY": key,
    "LLAMACPP_BASE_URL": "http://127.0.0.1:18080/v1",
    "LLAMACPP_MODE": "managed",
}
lines = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
for name, value in updates.items():
    lines = [line for line in lines if not line.startswith(name + "=")]
    lines.append(f"{name}={value}")
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text("\n".join(lines) + "\n", encoding="utf-8")
path.chmod(0o600)
PY

printf '\nAguardando o health-check do Laya…\n'
ready=0
for _ in $(seq 1 120); do
  if curl --silent --fail --max-time 2 \
    -H "Authorization: Bearer $LAYA_KEY" "http://127.0.0.1:$LAYA_PORT/health" >/dev/null; then
    ready=1
    break
  fi
  sleep 2
done
if (( ! ready )); then
  systemctl --user --no-pager --full status vectora-laya.service || true
  printf 'Laya não ficou saudável; veja journalctl --user -u vectora-laya.service.\n' >&2
  exit 1
fi
printf '[ok] Laya saudável em http://127.0.0.1:%s (SystemOne permanece desativado).\n' "$LAYA_PORT"
if [[ -x "$LLAMA_ROOT/active/bin/llama-server" ]]; then
  printf '[ok] llama.cpp compilado em %s (aguarda um modelo GGUF para iniciar).\n' "$LLAMA_ROOT/active/bin/llama-server"
fi
printf 'Reinicie o Vectora para recarregar as configurações persistidas.\n'
printf 'Serviço: systemctl --user status vectora-laya.service\n'
printf 'Logs:    journalctl --user -u vectora-laya.service -f\n'
