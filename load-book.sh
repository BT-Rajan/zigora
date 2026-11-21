#!/usr/bin/env bash
# A student brings her own textbook: its PDFs are read, cleaned (no cover, preface, index, page numbers or watermarks) and filed under
# M.B.B.S > Year 2 > Pharmacology as her private notes, with the figures, tables and equations as pictures, exactly as "Bring your own
# notes" stores them, so she can see and change the filing in the app. Running it again replaces her notes.
#   ./load-book.sh part1.pdf part2.pdf                          (for student1@example.com, the demo student)
#   ./load-book.sh --student meena@college.edu part1.pdf part2.pdf
#   ./load-book.sh --prepare part1.pdf part2.pdf                 (also writes her gist and steps for every topic now, with the AI,
#                                                                 so they open at once in a demo; a few hundred AI requests)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="${VENV:-$ROOT/venv}"
STUDENT="student1@example.com"; MAP="$ROOT/content/archive/pharmacology-v1/dales_pharmacology_map.json"; PREPARE=""; PDFS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --student) STUDENT="$2"; shift 2 ;;
    --map) MAP="$2"; shift 2 ;;
    --prepare) PREPARE=1; shift ;;
    *) PDFS+=("$(realpath "$1")"); shift ;;
  esac
done
[ ${#PDFS[@]} -gt 0 ] || { echo "Give the book's PDF files, in order: ./load-book.sh part1.pdf part2.pdf"; exit 1; }
cd "$ROOT"
"$VENV/bin/pip" install -q -r backend/requirements.txt
"$VENV/bin/python" backend/manage.py load-book --student "$STUDENT" --map "$MAP" "${PDFS[@]}"
if [ -n "$PREPARE" ]; then "$VENV/bin/python" backend/manage.py prepare-steps --student "$STUDENT"; fi
