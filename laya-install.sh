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
  llama.cpp    baixa o arquivo Laya-Q8_0.gguf oficial e usa o binário CPU do release llama.cpp

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
LAYA_KEY=
LLAMA_ROOT="$VECTOR_HOME/tools/llama.cpp"
LLAMA_MODELS="$DATA_HOME/vectora/models/huggingface/ggml-org/Laya-GGUF"
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
  if [[ "$ENGINE" == llama.cpp ]]; then
    MODEL_FILE="$DATA_HOME/vectora/models/huggingface/ggml-org/Laya-GGUF/Laya-Q8_0.gguf"
    [[ -s "$MODEL_FILE" ]] || { printf 'Arquivo GGUF não encontrado: %s\n' "$MODEL_FILE" >&2; exit 1; }
  fi
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
  for tool in curl tar sha256sum; do command -v "$tool" >/dev/null 2>&1 || { printf 'Dependência ausente: %s.\n' "$tool" >&2; exit 1; }; done
  mkdir -p "$LLAMA_ROOT/versions" "$LLAMA_MODELS"
  ARCH=$(uname -m)
  case "$ARCH" in x86_64|amd64) ASSET_SUFFIX=x64 ;; aarch64|arm64) ASSET_SUFFIX=arm64 ;; *) printf 'Arquitetura sem binário oficial CPU: %s.\n' "$ARCH" >&2; exit 1 ;; esac
  RELEASE_JSON=$(curl --fail --location --silent --show-error --retry 5 --retry-all-errors --max-time 180 -H 'Accept: application/vnd.github+json' 'https://api.github.com/repos/ggml-org/llama.cpp/releases?per_page=10')
  read -r RELEASE_TAG ASSET_NAME ASSET_URL ASSET_SHA < <(python3 -c '
import json,sys
r=json.load(sys.stdin); suffix=sys.argv[1]
for release in r:
 for a in release.get("assets",[]):
  if a["name"].endswith("-bin-ubuntu-"+suffix+".tar.gz") and a.get("digest","").startswith("sha256:"):
   print(release["tag_name"],a["name"],a["browser_download_url"],a["digest"].split(":",1)[1]); raise SystemExit
raise SystemExit("releases recentes sem binário CPU oficial com SHA-256")
' "$ASSET_SUFFIX" <<<"$RELEASE_JSON")
  [[ "$ASSET_URL" == https://github.com/ggml-org/llama.cpp/releases/download/* ]] || { printf 'URL de release inesperada.\n' >&2; exit 1; }
  RUNTIME_ID="${RELEASE_TAG}-${ASSET_SHA:0:16}"
  VERSION_DIR="$LLAMA_ROOT/versions/$RUNTIME_ID"
  if ! find "$VERSION_DIR" -type f -name llama-server -executable -print -quit 2>/dev/null | grep -q .; then
    TMP_DIR=$(mktemp -d "$LLAMA_ROOT/.install.XXXXXX")
    trap 'rm -rf -- "$TMP_DIR"' EXIT
    curl --fail --location --silent --show-error --retry 10 --retry-all-errors --connect-timeout 20 --max-time 1800 -o "$TMP_DIR/$ASSET_NAME" "$ASSET_URL"
    printf '%s  %s\n' "$ASSET_SHA" "$TMP_DIR/$ASSET_NAME" | sha256sum --check --status || { printf 'SHA-256 do runtime não confere.\n' >&2; exit 1; }
    mkdir "$TMP_DIR/unpacked"
    tar -xzf "$TMP_DIR/$ASSET_NAME" -C "$TMP_DIR/unpacked"
    BIN=$(find "$TMP_DIR/unpacked" -type f -name llama-server -print -quit)
    [[ -n "$BIN" ]] || { printf 'O release não contém llama-server.\n' >&2; exit 1; }
    mkdir -p "$VERSION_DIR"
    cp -a "$TMP_DIR/unpacked/." "$VERSION_DIR/"
    SERVER_PATH=$(find "$VERSION_DIR" -type f -name llama-server -print -quit)
    [[ -n "$SERVER_PATH" ]] || { printf 'O executável não foi instalado no runtime.\n' >&2; exit 1; }
    chmod 755 "$SERVER_PATH"
    "$SERVER_PATH" --version >/dev/null
    rm -rf -- "$TMP_DIR"; trap - EXIT
    ln -sfn "versions/$RUNTIME_ID" "$LLAMA_ROOT/.active.tmp"; mv -Tf "$LLAMA_ROOT/.active.tmp" "$LLAMA_ROOT/active"
  else
    ln -sfn "versions/$RUNTIME_ID" "$LLAMA_ROOT/.active.tmp"; mv -Tf "$LLAMA_ROOT/.active.tmp" "$LLAMA_ROOT/active"
  fi
  python3 - "$LLAMA_ROOT" "$RUNTIME_ID" "$RELEASE_TAG" "$ASSET_NAME" "$ASSET_URL" "$ASSET_SHA" <<'PY'
import json, pathlib, sys
from datetime import datetime, timezone
root=pathlib.Path(sys.argv[1]); rid,tag,name,url,digest=sys.argv[2:]
directory=root/'versions'/rid; manifest=root/'runtime-manifest.json'
try: runtimes=json.loads(manifest.read_text()).get('runtimes',[])
except (OSError,json.JSONDecodeError): runtimes=[]
runtimes=[x for x in runtimes if not isinstance(x,dict) or x.get('id')!=rid]
runtimes.append({'id':rid,'asset':name,'source':url,'release':tag,'sha256':digest,'files':[str(p) for p in directory.rglob('*') if p.is_file()],'directory':str(directory),'version':tag,'installed_at':datetime.now(timezone.utc).isoformat()})
tmp=manifest.with_suffix('.json.tmp'); tmp.write_text(json.dumps({'runtimes':runtimes},indent=2)+'\n'); tmp.replace(manifest)
(root/'active-runtime').write_text(rid+'\n')
PY
  LLAMA_RELATIVE=$(find -L "$LLAMA_ROOT/active" -type f -name llama-server -print -quit | sed "s#^$LLAMA_ROOT/active/##")
  [[ -n "$LLAMA_RELATIVE" ]] || { printf 'llama-server ausente no runtime ativado.\n' >&2; exit 1; }
  LLAMA_EXE="$LLAMA_ROOT/active/$LLAMA_RELATIVE"
  MODEL_META=$(curl --fail --location --silent --show-error --retry 5 --retry-all-errors --max-time 90 'https://huggingface.co/api/models/ggml-org/Laya-GGUF?blobs=true')
  read -r MODEL_REV MODEL_SIZE MODEL_SHA < <(python3 -c '
import json,sys
d=json.load(sys.stdin); rev=d["sha"]
for s in d.get("siblings",[]):
 if s["rfilename"]=="Laya-Q8_0.gguf":
  l=s.get("lfs",{}); print(rev,s.get("size") or l.get("size"),l.get("sha256") or s.get("blobId")); break
else: raise SystemExit("Laya-Q8_0.gguf ausente no repositório oficial")
' <<<"$MODEL_META")
  [[ "$MODEL_SIZE" =~ ^[0-9]+$ && "$MODEL_SHA" =~ ^[a-f0-9]{64}$ ]] || { printf 'Metadados inesperados para o GGUF oficial.\n' >&2; exit 1; }
  MODEL_FILE="$LLAMA_MODELS/Laya-Q8_0.gguf"
  if [[ ! -f "$MODEL_FILE" ]] || [[ $(stat -c %s "$MODEL_FILE") != "$MODEL_SIZE" ]] || ! printf '%s  %s\n' "$MODEL_SHA" "$MODEL_FILE" | sha256sum --check --status; then
    PART="$MODEL_FILE.part"
    curl --fail --location --silent --show-error --retry 10 --retry-all-errors --connect-timeout 20 --max-time 7200 -C - -o "$PART" "https://huggingface.co/ggml-org/Laya-GGUF/resolve/$MODEL_REV/Laya-Q8_0.gguf"
    if [[ $(stat -c %s "$PART") != "$MODEL_SIZE" ]] || ! printf '%s  %s\n' "$MODEL_SHA" "$PART" | sha256sum --check --status; then
      printf 'Tamanho ou SHA-256 do GGUF não confere.\n' >&2
      exit 1
    fi
    mv -f -- "$PART" "$MODEL_FILE"
  fi
  python3 - "$LLAMA_MODELS/Laya-Q8_0.gguf.source.json" "$MODEL_REV" "$MODEL_SHA" <<'PY'
import json,pathlib,sys
path=pathlib.Path(sys.argv[1]); path.write_text(json.dumps({'repo_id':'ggml-org/Laya-GGUF','filename':'Laya-Q8_0.gguf','revision':sys.argv[2],'sha256':sys.argv[3]},indent=2)+'\n')
PY
  cat > "$UNIT_DIR/vectora-laya-llama.service" <<EOF
[Unit]
Description=Laya GGUF local via llama.cpp para Vectora
After=network.target

[Service]
Type=simple
Environment=LLAMA_CACHE=$DATA_HOME/vectora/llama-cache
ExecStart=$LLAMA_EXE --model $MODEL_FILE --alias $MODEL_ID --host 127.0.0.1 --port $LLAMA_PORT --threads 4 --ctx-size 512 --ubatch-size 512
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=$DATA_HOME/vectora/llama-cache $LLAMA_ROOT $LLAMA_MODELS

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
printf '[ok] Vectora configurado com o endpoint local e modelo %s. A ativação do SystemOne permanece sob seu controle.\n' "$MODEL_ID"
printf 'Reinicie o Vectora para carregar a configuração persistida.\n'
printf 'Logs: journalctl --user -u %s -f\n' "$SERVICE"
