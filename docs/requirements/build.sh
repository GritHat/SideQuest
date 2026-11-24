#!/usr/bin/env bash
# Compila il Documento di Specifica dei Requisiti in PDF.
# Requisiti: pandoc ≥ 3, weasyprint ≥ 60, plantuml (solo se si modificano i diagrammi),
# font Noto Sans installati.
#
#   ./build.sh            rigenera i diagrammi (se plantuml c'è) e il PDF
#   NO_DIAGRAMS=1 ./build.sh   usa gli SVG già versionati
set -euo pipefail
cd "$(dirname "$0")"

GROUP_ID="2627_008"
OUT="build/SWE_${GROUP_ID}.pdf"
mkdir -p build

if [[ -z "${NO_DIAGRAMS:-}" ]] && command -v plantuml >/dev/null; then
  plantuml -tsvg -charset UTF-8 diagrams/uc-*.puml
fi

pandoc srs.md \
  --from markdown \
  --to html5 \
  --standalone \
  --template template.html \
  --toc --toc-depth 2 \
  --number-sections \
  --css style.css \
  --output build/srs.html

weasyprint --base-url . build/srs.html "$OUT"
echo "PDF generato: docs/requirements/$OUT"
