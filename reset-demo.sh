#!/usr/bin/env bash
# A clean demo server. Backs up the database and uploads, then DELETES ALL DATA: every user (admins too), course, setting (AI keys,
# mail, sign-in, payments), upload and record. Loads the M.B.B.S Year 2 Pharmacology content and makes 16 demo accounts, two of each
# kind of person, all with the one password you give. Asks you to type DELETE EVERYTHING first.
#   ./reset-demo.sh                      (asks for the password)
#   ./reset-demo.sh --password 'Demo@2026'
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="${VENV:-$ROOT/venv}"
cd "$ROOT"
"$VENV/bin/python" backend/manage.py reset-demo --import content/pharmacology_mbbs_year2.csv "$@"
if command -v pm2 >/dev/null && pm2 describe engtutor >/dev/null 2>&1; then
  pm2 restart engtutor >/dev/null && echo "==> Restarted the app, so nothing from before is kept in memory."
fi
