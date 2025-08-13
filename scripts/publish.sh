#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   DOCKERHUB_USER=nabeelvira VERSION=v0.1.0 ./scripts/publish.sh
# Requires: docker login (or set DOCKERHUB_TOKEN and it will login non-interactively)

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
DOCKERHUB_USER=${DOCKERHUB_USER:-}
DOCKERHUB_TOKEN=${DOCKERHUB_TOKEN:-}
VERSION=${VERSION:-}

if [[ -z "$DOCKERHUB_USER" ]]; then
  echo "Set DOCKERHUB_USER env var (e.g., export DOCKERHUB_USER=nabeelvira)" >&2
  exit 1
fi

if [[ -n "$DOCKERHUB_TOKEN" ]]; then
  echo "$DOCKERHUB_TOKEN" | docker login -u "$DOCKERHUB_USER" --password-stdin
fi

set -x

TAG_LATEST="latest"
TAG_VERSION="${VERSION:-}"

# Build API image
docker build -t "$DOCKERHUB_USER/expensely-api:$TAG_LATEST" -f "$ROOT_DIR/api/Dockerfile" "$ROOT_DIR/api"
# Build Web image (inject version for UI)
if [[ -n "$TAG_VERSION" ]]; then
  docker build --build-arg APP_VERSION="$TAG_VERSION" -t "$DOCKERHUB_USER/expensely-web:$TAG_LATEST" -t "$DOCKERHUB_USER/expensely-web:$TAG_VERSION" -f "$ROOT_DIR/web/Dockerfile" "$ROOT_DIR/web"
else
  docker build -t "$DOCKERHUB_USER/expensely-web:$TAG_LATEST" -f "$ROOT_DIR/web/Dockerfile" "$ROOT_DIR/web"
fi

# Push
docker push "$DOCKERHUB_USER/expensely-api:$TAG_LATEST"
docker push "$DOCKERHUB_USER/expensely-web:$TAG_LATEST"
if [[ -n "$TAG_VERSION" ]]; then
  docker push "$DOCKERHUB_USER/expensely-web:$TAG_VERSION"
fi

set +x
echo "Published:"
echo "  docker pull $DOCKERHUB_USER/expensely-api:$TAG_LATEST"
echo "  docker pull $DOCKERHUB_USER/expensely-web:$TAG_LATEST"
if [[ -n "$TAG_VERSION" ]]; then
  echo "  docker pull $DOCKERHUB_USER/expensely-web:$TAG_VERSION"
fi

