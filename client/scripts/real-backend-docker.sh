#!/usr/bin/env bash
# Run the REAL FUTUREPRINT backend locally in Docker, for frontend integration testing.
#
#   client/scripts/real-backend-docker.sh            # start (API on http://localhost:5055)
#   client/scripts/real-backend-docker.sh down       # stop and remove the containers
#
# - futureprint-db : PostgreSQL 16 on a private Docker network (no host port published)
# - futureprint-api: Flask API from server/ (mounted read-only and copied inside the container,
#                    so nothing is written to the repo), migrations applied, seed data loaded,
#                    real scenario engine (app.services.scenario_engine.plugin).
# Then run the client against it:
#   VITE_USE_MOCKS=false VITE_API_BASE_URL=http://localhost:5055 npx vite --port 6174
# Passwords and SECRET_KEY are random per run and never printed.
set -euo pipefail
API_PORT=${API_PORT:-5055}
WEB_ORIGINS=${WEB_ORIGINS:-"http://localhost:6174,http://127.0.0.1:6174"}
REPO=$(cd "$(dirname "$0")/../.." && pwd)

if [[ "${1:-}" == "down" ]]; then
  docker rm -f futureprint-api futureprint-db >/dev/null 2>&1 || true
  docker network rm futureprint-net >/dev/null 2>&1 || true
  echo "stopped"; exit 0
fi

if ss -ltnH "sport = :$API_PORT" | grep -q .; then echo "port $API_PORT is busy (set API_PORT=...)"; exit 1; fi
docker network inspect futureprint-net >/dev/null 2>&1 || docker network create futureprint-net >/dev/null
docker rm -f futureprint-api futureprint-db >/dev/null 2>&1 || true

DB_PASS=$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)
SECRET=$(head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 48)

echo "== starting postgres:16-alpine"
docker run -d --name futureprint-db --network futureprint-net \
  -e POSTGRES_USER=futureprint -e POSTGRES_PASSWORD="$DB_PASS" -e POSTGRES_DB=futureprint \
  postgres:16-alpine >/dev/null
for _ in $(seq 1 60); do
  docker exec futureprint-db pg_isready -U futureprint -d futureprint >/dev/null 2>&1 && break; sleep 1
done
docker exec futureprint-db pg_isready -U futureprint -d futureprint

echo "== starting python:3.12-slim API on :$API_PORT"
docker run -d --name futureprint-api --network futureprint-net -p "$API_PORT:5000" \
  -v "$REPO/server:/src:ro" \
  -e APP_ENV=development \
  -e DATABASE_URL="postgresql://futureprint:${DB_PASS}@futureprint-db:5432/futureprint" \
  -e SECRET_KEY="$SECRET" \
  -e CORS_ORIGINS="$WEB_ORIGINS" \
  -e SCENARIO_ENGINE_MODULE=app.services.scenario_engine.plugin \
  -e AI_INSIGHTS_ENABLED=false \
  -e FLASK_APP=app:create_app \
  -e PIP_DISABLE_PIP_VERSION_CHECK=1 \
  python:3.12-slim bash -c '
    set -e
    cp -r /src /app && cd /app
    pip install -q -r requirements.txt
    flask db upgrade
    flask seed load
    exec flask run --host 0.0.0.0 --port 5000' >/dev/null

echo "== waiting for /api/v1/health/ready"
for _ in $(seq 1 240); do
  if curl -fsS "http://localhost:$API_PORT/api/v1/health/ready"; then echo; exit 0; fi
  if ! docker ps --format '{{.Names}}' | grep -q '^futureprint-api$'; then
    echo "API container exited:"; docker logs --tail 40 futureprint-api; exit 1
  fi
  sleep 2
done
echo "API not ready in time"; docker logs --tail 40 futureprint-api; exit 1
