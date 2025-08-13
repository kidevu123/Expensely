#!/usr/bin/env bash
set -euo pipefail

mkdir -p api web

cat > .env.shared <<EOF
# Filled by init.sh
ZOHO_DC_DEFAULT=com
ADMIN_EMAIL=admin@localhost
EOF

echo "Enter admin email for magic-link sign-in (default: admin@localhost):"
read -r ADMIN_EMAIL
if [ -n "$ADMIN_EMAIL" ]; then
  sed -i '' "s#ADMIN_EMAIL=.*#ADMIN_EMAIL=$ADMIN_EMAIL#" .env.shared || true
fi

echo "Configuring up to 4 Zoho Books orgs (you can leave some blank for now)"
ORG_LABELS=("Nirvana" "Summitt Labs" "Haute Brands" "Boomin Brands")
> api/.env
echo "DATABASE_URL=postgres://postgres:postgres@db:5432/expensely" >> api/.env
echo "REDIS_URL=redis://redis:6379" >> api/.env
echo "ADMIN_EMAIL=$ADMIN_EMAIL" >> api/.env
for LABEL in "${ORG_LABELS[@]}"; do
  echo "--- $LABEL ---"
  read -r -p "Zoho DC (com/eu/in) [com]: " DC; DC=${DC:-com}
  read -r -p "client_id (or leave blank): " CID
  read -r -p "client_secret (or leave blank): " CSEC
  read -r -p "refresh_token (or leave blank): " RTOK
  read -r -p "org_id (or leave blank): " ORG
  echo "ZOHO_${LABEL// /_}_DC=$DC" >> api/.env
  [ -n "$CID" ] && echo "ZOHO_${LABEL// /_}_CLIENT_ID=$CID" >> api/.env
  [ -n "$CSEC" ] && echo "ZOHO_${LABEL// /_}_CLIENT_SECRET=$CSEC" >> api/.env
  [ -n "$RTOK" ] && echo "ZOHO_${LABEL// /_}_REFRESH_TOKEN=$RTOK" >> api/.env
  [ -n "$ORG" ] && echo "ZOHO_${LABEL// /_}_ORG_ID=$ORG" >> api/.env
done

echo "Optional WorkDrive (Boomin archive)"
read -r -p "Boomin WorkDrive TEAM_ID (or blank): " WTEAM
read -r -p "Boomin WorkDrive FOLDER_ID (root or target, or blank): " WFLD
[ -n "$WTEAM" ] && echo "WORKDRIVE_TEAM_ID=$WTEAM" >> api/.env
[ -n "$WFLD" ] && echo "WORKDRIVE_FOLDER_ID=$WFLD" >> api/.env

cat > web/.env.local <<EOF
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
EOF

echo "Init complete. Run: docker compose up -d --build"

