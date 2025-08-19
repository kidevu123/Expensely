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
export APP_VERSION=${APP_VERSION:-dev}

python manage.py migrate
python manage.py runserver 0.0.0.0:8000