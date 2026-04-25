#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.local"
DEFAULT_BRAIN_DIR="$ROOT_DIR/.nexus-brain"
DEFAULT_COLLAB_DIR="$ROOT_DIR/.nexus-collab"

log() {
  printf '[start] %s\n' "$*"
}

fail() {
  printf '[start] %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

random_hex() {
  od -An -N24 -tx1 /dev/urandom | tr -d ' \n'
}

ensure_env_value() {
  local key="$1"
  local value="$2"

  touch "$ENV_FILE"
  if ! grep -q "^${key}=" "$ENV_FILE"; then
    printf '%s=%s\n' "$key" "$value" >>"$ENV_FILE"
    log "Added ${key} to .env.local"
  fi
}

start_docker() {
  require_command docker
  log "Starting Nexus with Docker Compose"
  cd "$ROOT_DIR"
  docker compose up --build
}

start_local() {
  require_command bun

  if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
  fi

  local brain_dir="${NEXUS_BRAIN_DATA_DIR:-$DEFAULT_BRAIN_DIR}"
  local brain_secret="${NEXUS_BRAIN_TOKEN_SECRET:-}"
  local collab_dir="${NEXUS_COLLAB_DATA_DIR:-$DEFAULT_COLLAB_DIR}"
  local collab_port="${NEXUS_COLLAB_SERVER_PORT:-1234}"
  local collab_url="${NEXT_PUBLIC_COLLAB_SERVER_URL:-ws://localhost:${collab_port}}"

  mkdir -p "$brain_dir"
  mkdir -p "$collab_dir"
  log "Using Brain data directory: $brain_dir"
  log "Using collaboration data directory: $collab_dir"

  if [[ -z "$brain_secret" ]]; then
    brain_secret="$(random_hex)"
  fi

  ensure_env_value "NEXUS_BRAIN_DATA_DIR" "$brain_dir"
  ensure_env_value "NEXUS_BRAIN_TOKEN_SECRET" "$brain_secret"
  ensure_env_value "NEXUS_COLLAB_DATA_DIR" "$collab_dir"
  ensure_env_value "NEXUS_COLLAB_SERVER_PORT" "$collab_port"
  ensure_env_value "NEXT_PUBLIC_COLLAB_SERVER_URL" "$collab_url"

  export NEXUS_BRAIN_DATA_DIR="$brain_dir"
  export NEXUS_BRAIN_TOKEN_SECRET="$brain_secret"
  export NEXUS_COLLAB_DATA_DIR="$collab_dir"
  export NEXUS_COLLAB_SERVER_PORT="$collab_port"
  export NEXT_PUBLIC_COLLAB_SERVER_URL="$collab_url"

  cd "$ROOT_DIR"

  if [[ ! -d node_modules ]]; then
    log "Installing dependencies"
    bun install
  fi

  log "Starting collaboration server on port $collab_port"
  bun scripts/collab-server.ts &
  local collab_pid=$!
  trap 'kill "$collab_pid" 2>/dev/null || true' EXIT INT TERM

  log "Starting development server"
  bun run dev
}

usage() {
  cat <<'EOF'
Usage:
  ./scripts/start.sh           Start the app locally in development mode
  ./scripts/start.sh --docker  Start the app with Docker Compose
EOF
}

case "${1:-}" in
  "")
    start_local
    ;;
  --docker)
    start_docker
    ;;
  -h|--help)
    usage
    ;;
  *)
    fail "Unknown argument: $1"
    ;;
esac
