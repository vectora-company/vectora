#!/usr/bin/env bash
# Instala Laya local em modo nativo (Transformers) ou via llama.cpp (GGUF).
set -Eeuo pipefail

OS=$(uname -s)
case "$OS" in
  Linux) ;;
  MINGW*|MSYS*|CYGWIN*|Windows_NT)
    printf 'Este instalador só prossegue em Linux; Windows detectado.\n' >&2
    exit 1
    ;;
  Darwin)
    printf 'Este instalador só prossegue em Linux; macOS detectado.\n' >&2
    exit 1
    ;;
  *) printf 'Sistema operacional não suportado: %s.\n' "$OS" >&2; exit 1 ;;
esac

if [[ ! -r /etc/os-release ]]; then
  printf 'Não foi possível identificar a distribuição Linux.\n' >&2
  exit 1
fi
# shellcheck disable=SC1091
. /etc/os-release
case "${ID:-}:${ID_LIKE:-}" in
  pop:*|ubuntu:*|debian:*|*:debian*) DISTRO_FAMILY=debian ;;
  fedora:*|*:fedora*) DISTRO_FAMILY=fedora ;;
  arch:*|*:arch*) DISTRO_FAMILY=arch ;;
  *) printf 'Distribuição não mapeada: %s. Nenhum pacote de sistema será alterado.\n' "${PRETTY_NAME:-unknown}" >&2; exit 1 ;;
esac
printf 'Distribuição detectada: %s (%s).\n' "${PRETTY_NAME:-Linux}" "$DISTRO_FAMILY"
(( EUID != 0 )) || { printf 'Execute como usuário normal; não é necessário root/sudo.\n' >&2; exit 1; }

MODE=install
ENGINE=
while (($#)); do
  case "$1" in
    --mode) (($# >= 2)) || { printf 'Falta o valor de --mode.\n' >&2; exit 2; }; ENGINE=$2; shift 2 ;;
    --check) MODE=check; shift ;;
    -h|--help) MODE=help; shift ;;
    *) printf 'Argumento desconhecido: %s\n' "$1" >&2; exit 2 ;;
  esac
done
case "$ENGINE" in
  llamacpp) ENGINE=llama.cpp ;;
  ""|laya-server|llama.cpp) ;;
  *) printf 'Modo inválido: %s. Use laya-server ou llama.cpp.\n' "$ENGINE" >&2; exit 2 ;;
esac
if [[ "$MODE" == help ]]; then
  cat <<'EOF'
Uso: ./laya-install.sh [--mode laya-server|llama.cpp] [--check]

Sem --mode, apresenta um menu interativo:
  laya-server  Laya oficial com Transformers/PyTorch CPU e API protegida local
  llama.cpp    modelo oficial ggml-org/Laya-GGUF:Q8_0 no llama-server CPU

--check verifica o modo escolhido sem alterar arquivos.
EOF
  exit 0
fi
if [[ -z "$ENGINE" ]]; then
  [[ -t 0 ]] || { printf 'Em execução não interativa, informe --mode laya-server ou --mode llama.cpp.\n' >&2; exit 2; }
  printf 'Escolha como executar o Laya:\n  1) Servidor oficial Laya (Transformers/PyTorch CPU)\n  2) llama.cpp com ggml-org/Laya-GGUF:Q8_0 (CPU)\n'
  read -r -p 'Opção [1/2]: ' choice
  case "$choice" in 1) ENGINE=laya-server ;; 2) ENGINE=llama.cpp ;; *) printf 'Opção inválida.\n' >&2; exit 2 ;; esac
fi

for tool in curl python3 systemctl; do
  command -v "$tool" >/dev/null 2>&1 || { printf 'Dependência ausente: %s.\n' "$tool" >&2; exit 1; }
done
systemctl --user show-environment >/dev/null 2>&1 || { printf 'systemd de usuário não está disponível nesta sessão.\n' >&2; exit 1; }

VECTOR_HOME=${VECTORA_HOME:-"$HOME/.vectora-dev"}
DATA_HOME=${XDG_DATA_HOME:-"$HOME/.local/share"}
CONFIG_HOME=${XDG_CONFIG_HOME:-"$HOME/.config"}
UNIT_DIR="$CONFIG_HOME/systemd/user"
LAYA_ROOT="$DATA_HOME/vectora/laya"
LAYA_PORT=18000
LLAMA_PORT=18080
LLAMA_ROOT="$VECTOR_HOME/tools/llama.cpp"
LLAMA_SRC_ROOT="$DATA_HOME/vectora/src"
MODEL_ID=convaiinnovations/laya
if [[ "$ENGINE" == llama.cpp ]]; then
  MODEL_ID=ggml-org/Laya-GGUF:Q8_0
fi

if [[ "$MODE" == check ]]; then
  SERVICE=vectora-laya.service
  if [[ "$ENGINE" == llama.cpp ]]; then SERVICE=vectora-laya-llama.service; fi
  systemctl --user is-active --quiet "$SERVICE" || { printf 'Serviço inativo: %s\n' "$SERVICE" >&2; exit 1; }
  PORT=$LAYA_PORT
  [[ "$ENGINE" != llama.cpp ]] || PORT=$LLAMA_PORT
  HEALTH_ARGS=()
  if [[ "$ENGINE" == laya-server ]]; then
    KEY=$(sed -n 's/^LAYA_API_KEY=//p' "$CONFIG_HOME/vectora/laya.env")
    HEALTH_ARGS=(-H "Authorization: Bearer $KEY")
  fi
  curl --silent --fail --max-time 5 "${HEALTH_ARGS[@]}" "http://127.0.0.1:$PORT/health" >/dev/null || { printf 'Health-check falhou em 127.0.0.1:%s.\n' "$PORT" >&2; exit 1; }
  grep -q "SYSTEMONE_LAYA_MODEL=$MODEL_ID" "$VECTOR_HOME/.env" || { printf 'Modelo não configurado no Vectora.\n' >&2; exit 1; }
  printf '[ok] modo %s ativo e configurado no Vectora.\n' "$ENGINE"
  exit 0
fi

mkdir -p "$UNIT_DIR" "$VECTOR_HOME"
chmod 700 "$UNIT_DIR" "$VECTOR_HOME"
if [[ "$ENGINE" == laya-server ]]; then
  command -v uv >/dev/null 2>&1 || { printf 'Dependência ausente: uv.\n' >&2; exit 1; }
  LAYA_VENV="$LAYA_ROOT/.venv"
  mkdir -p "$LAYA_ROOT"
  if [[ ! -x "$LAYA_VENV/bin/python" ]]; then uv venv --python 3.12 "$LAYA_VENV"; fi
  uv pip install --python "$LAYA_VENV/bin/python" \
    --index-url https://pypi.org/simple \
    --extra-index-url https://download.pytorch.org/whl/cpu \
    --index-strategy unsafe-best-match \
    'torch==2.9.1+cpu' 'laya[serve]==0.4.23'
  LAYA_ENV="$CONFIG_HOME/vectora/laya.env"
  mkdir -p "$(dirname "$LAYA_ENV")"
  if [[ ! -s "$LAYA_ENV" ]]; then
    umask 077
    LAYA_KEY=$(python3 -c 'import secrets; print(secrets.token_hex(32))')
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
  else
    LAYA_KEY=$(sed -n 's/^LAYA_API_KEY=//p' "$LAYA_ENV")
  fi
  chmod 600 "$LAYA_ENV"
  cat > "$UNIT_DIR/vectora-laya.service" <<EOF
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
ReadWritePaths=$LAYA_ROOT

[Install]
WantedBy=default.target
EOF
  SERVICE=vectora-laya.service
  BASE_URL="http://127.0.0.1:$LAYA_PORT"
else
  for tool in git cmake c++ pkg-config; do command -v "$tool" >/dev/null 2>&1 || { printf 'Dependência ausente: %s.\n' "$tool" >&2; exit 1; }; done
  pkg-config --exists libcurl || { printf 'Falta libcurl de desenvolvimento para baixar o modelo Hugging Face.\n' >&2; exit 1; }
  mkdir -p "$LLAMA_SRC_ROOT" "$LLAMA_ROOT/versions"
  if [[ ! -x "$LLAMA_ROOT/active/bin/llama-server" ]]; then
    BUILD_SOURCE=
    while IFS= read -r candidate; do
      if git -C "$candidate/source" rev-parse --verify HEAD >/dev/null 2>&1; then BUILD_SOURCE=$candidate; break; fi
      rm -rf -- "$candidate"
    done < <(find "$LLAMA_SRC_ROOT" -maxdepth 1 -type d -name 'llama.cpp.*' -print)
    if [[ -z "$BUILD_SOURCE" ]]; then
      BUILD_SOURCE=$(mktemp -d "$LLAMA_SRC_ROOT/llama.cpp.XXXXXX")
      git -c http.version=HTTP/1.1 clone --depth 1 https://github.com/ggml-org/llama.cpp.git "$BUILD_SOURCE/source"
    fi
    LLAMA_COMMIT=$(git -C "$BUILD_SOURCE/source" rev-parse HEAD)
    RUNTIME_ID=${LLAMA_COMMIT:0:16}
    VERSION_DIR="$LLAMA_ROOT/versions/$RUNTIME_ID"
    BUILD_DIR="$BUILD_SOURCE/build"
    cmake -S "$BUILD_SOURCE/source" -B "$BUILD_DIR" \
      -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX="$VERSION_DIR" \
      -DGGML_NATIVE=ON -DGGML_CUDA=OFF -DGGML_VULKAN=OFF -DGGML_METAL=OFF \
      -DLLAMA_BUILD_TESTS=OFF -DLLAMA_BUILD_EXAMPLES=OFF \
      -DLLAMA_BUILD_TOOLS=ON -DLLAMA_BUILD_SERVER=ON -DLLAMA_BUILD_APP=OFF \
      -DLLAMA_TESTS_INSTALL=OFF -DLLAMA_BUILD_UI=OFF -DLLAMA_USE_PREBUILT_UI=OFF
    cmake --build "$BUILD_DIR" --target llama-server --parallel "${VECTORA_BUILD_JOBS:-2}"
    cmake --install "$BUILD_DIR"
    "$VERSION_DIR/bin/llama-server" --version >/dev/null
    ln -sfn "versions/$RUNTIME_ID" "$LLAMA_ROOT/.active.tmp"
    mv -Tf "$LLAMA_ROOT/.active.tmp" "$LLAMA_ROOT/active"
    LLAMA_VERSION=$("$VERSION_DIR/bin/llama-server" --version | head -n 1)
    python3 - "$LLAMA_ROOT" "$RUNTIME_ID" "$LLAMA_VERSION" <<'PY'
import hashlib, json, pathlib, sys
from datetime import datetime, timezone
root = pathlib.Path(sys.argv[1]); rid = sys.argv[2]; version = sys.argv[3]
directory = root / "versions" / rid
files = [str(path) for path in directory.rglob("*") if path.is_file()]
digest = hashlib.sha256((directory / "bin" / "llama-server").read_bytes()).hexdigest()
manifest_path = root / "runtime-manifest.json"
try:
    runtimes = json.loads(manifest_path.read_text(encoding="utf-8")).get("runtimes", [])
except (OSError, json.JSONDecodeError): runtimes = []
runtimes = [item for item in runtimes if not isinstance(item, dict) or item.get("id") != rid]
runtimes.append({"id": rid, "asset": "llama.cpp source build", "source": "https://github.com/ggml-org/llama.cpp", "sha256": digest, "files": files, "directory": str(directory), "version": version, "installed_at": datetime.now(timezone.utc).isoformat()})
temporary = manifest_path.with_suffix(".json.tmp")
temporary.write_text(json.dumps({"runtimes": runtimes}, indent=2) + "\n", encoding="utf-8")
temporary.replace(manifest_path)
active = root / "active-runtime"
if not active.exists(): active.write_text(rid + "\n", encoding="utf-8")
PY
    rm -rf -- "$BUILD_SOURCE"
  fi
  LLAMA_EXE="$LLAMA_ROOT/active/bin/llama-server"
  cat > "$UNIT_DIR/vectora-laya-llama.service" <<EOF
[Unit]
Description=Laya GGUF local via llama.cpp para Vectora
After=network.target

[Service]
Type=simple
Environment=LLAMA_CACHE=$DATA_HOME/vectora/llama-cache
ExecStart=$LLAMA_EXE --hf-repo $MODEL_ID --host 127.0.0.1 --port $LLAMA_PORT --threads 4 --ctx-size 512
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=$DATA_HOME/vectora/llama-cache $LLAMA_ROOT

[Install]
WantedBy=default.target
EOF
  SERVICE=vectora-laya-llama.service
  BASE_URL="http://127.0.0.1:$LLAMA_PORT"
fi

systemctl --user daemon-reload
systemctl --user disable --now vectora-laya.service >/dev/null 2>&1 || true
systemctl --user disable --now vectora-laya-llama.service >/dev/null 2>&1 || true
systemctl --user enable --now "$SERVICE"

VECTORA_ENV="$VECTOR_HOME/.env"
python3 - "$VECTORA_ENV" "$ENGINE" "$BASE_URL" "$MODEL_ID" "$LAYA_KEY" <<'PY'
import pathlib, sys
path = pathlib.Path(sys.argv[1]); mode, base, model, key = sys.argv[2:]
updates = {
    "SYSTEMONE_PROVIDER": "laya-local",
    "SYSTEMONE_LAYA_BASE_URL": base,
    "SYSTEMONE_LAYA_MODEL": model,
    "SYSTEMONE_LAYA_API_KEY": key,
}
lines = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
for name, value in updates.items():
    lines = [line for line in lines if not line.startswith(name + "=")]
    if value: lines.append(f"{name}={value}")
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text("\n".join(lines) + "\n", encoding="utf-8")
path.chmod(0o600)
PY

printf 'Aguardando health-check do Laya em %s…\n' "$BASE_URL"
ready=0
for _ in $(seq 1 180); do
  HEALTH_ARGS=()
  if [[ -n "$LAYA_KEY" ]]; then HEALTH_ARGS=(-H "Authorization: Bearer $LAYA_KEY"); fi
  if curl --silent --fail --max-time 3 "${HEALTH_ARGS[@]}" "$BASE_URL/health" >/dev/null; then ready=1; break; fi
  sleep 2
done
if (( ! ready )); then
  systemctl --user --no-pager --full status "$SERVICE" || true
  printf 'Laya não ficou saudável. Consulte: journalctl --user -u %s -f\n' "$SERVICE" >&2
  exit 1
fi
printf '[ok] Laya ativo via %s em %s.\n' "$ENGINE" "$BASE_URL"
printf '[ok] Vectora configurado com SystemOne habilitado e modelo %s.\n' "$MODEL_ID"
printf 'Reinicie o Vectora para carregar a configuração persistida.\n'
printf 'Logs: journalctl --user -u %s -f\n' "$SERVICE"
