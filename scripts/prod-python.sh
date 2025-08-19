#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="$ROOT_DIR/python"
cd "$APP_DIR"

# venv
if [ ! -d .venv ]; then
	python3 -m venv .venv
fi
source .venv/bin/activate

pip install -U pip
pip install -r requirements.txt

export DJANGO_SETTINGS_MODULE=expensely.settings
export DEBUG=${DEBUG:-0}
export ALLOWED_HOSTS=${ALLOWED_HOSTS:-*}
export APP_VERSION=${APP_VERSION:-prod}

python manage.py migrate --noinput
python manage.py collectstatic --noinput || true

PORT=${PORT:-8000}
WORKERS=${WORKERS:-2}

echo "Starting Gunicorn on :$PORT with $WORKERS workers"
exec gunicorn expensely.asgi:application -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:"$PORT" --workers "$WORKERS" --timeout 120