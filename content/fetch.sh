#!/usr/bin/env bash
# Re-downloads every source PDF listed in MANIFEST.md.
#
# The PDFs are NOT in git: ~150 MB of public, re-downloadable material does not
# belong in the history (see MANIFEST.md). Run this after a fresh clone.
#
# Usage: bash content/fetch.sh
set -euo pipefail
cd "$(dirname "$0")"

# altopuntaje.com serves a valid Let's Encrypt cert but omits the intermediate,
# and its root (ISRG Root YE) is newer than most CA bundles. Build the chain
# explicitly rather than reaching for --insecure, which would accept any cert.
chain=$(mktemp)
trap 'rm -f "$chain"' EXIT
curl -sSL --max-time 30 https://letsencrypt.org/certs/gen-y/root-ye.pem >"$chain"
curl -sSL --max-time 30 http://ye1.i.lencr.org/ | openssl x509 -inform DER >>"$chain"

get() { # get <url> <outfile> [extra curl args...]
  local url=$1 out=$2; shift 2
  [ -s "$out" ] && { echo "  ya existe  $out"; return; }
  mkdir -p "$(dirname "$out")"
  curl -sSL --max-time 180 -A "Mozilla/5.0" "$@" -o "$out" "$url"
  head -c 5 "$out" | grep -q '%PDF' || { echo "  ✗ no es PDF  $out"; rm -f "$out"; return 1; }
  printf "  ✓ %-58s %s\n" "$out" "$(du -h "$out" | cut -f1)"
}

echo "ICFES — caja de herramientas (explicadas + práctica)"
for n in 01_EXPLICADAS_LECTURA 02_PRACTICA_LECTURA 03_EXPLICADAS_MATEMATICAS \
         04_PRACTICA_MATEMATICAS 05_EXPLICADAS_SOCIALES 06_PRACTICA_SOCIALES \
         07_EXPLICADAS_CIENCIAS 08_PRACTICA_CIENCIAS 09_EXPLICADAS_INGLES \
         10_PRACTICA_INGLES; do
  get "http://icfes.acendra.com.co/wp-content/uploads/2024/12/$n.pdf" \
      "icfes/$(echo "$n" | tr 'A-Z' 'a-z').pdf"
done

echo "ICFES — cuadernillos oficiales"
get "https://www.icfes.gov.co/wp-content/uploads/2025/12/16-octubre-cuadernillo-ingles-saber-11-2024.pdf" "icfes/16-octubre-cuadernillo-ingles-saber-11-2024.pdf"
get "https://www.icfes.gov.co/wp-content/uploads/2025/12/22-diciembre-cuadernillo-de-preguntas-ciencias-naturales-saber-11-2025.pdf" "icfes/22-diciembre-cuadernillo-de-preguntas-ciencias-naturales-saber-11-2025.pdf"
get "https://www.icfes.gov.co/wp-content/uploads/2026/03/16-feb-cuadernillo-de-preguntas-lectura-critica-saber-11-2026.pdf" "icfes/16-feb-cuadernillo-de-preguntas-lectura-critica-saber-11-2026.pdf"
get "https://www.icfes.gov.co/wp-content/uploads/2026/03/24-feb-cuadernillo-preguntas-ciencias-naturales-saber-11-2026.pdf" "icfes/24-feb-cuadernillo-preguntas-ciencias-naturales-saber-11-2026.pdf"
get "https://www.icfes.gov.co/wp-content/uploads/2026/04/09-Marzo_Cuadernillo-de-Preguntas-Matematicas-Saber-11-2026.pdf" "icfes/09-marzo_cuadernillo-de-preguntas-matematicas-saber-11-2026.pdf"

echo "altopuntaje — cuadernillos por área (formato actual)"
for a in Sociales-y-ciudadanas ciencias-naturales ingles lectura-critica matematicas; do
  get "https://altopuntaje.com/wp-content/uploads/2026/06/Cuadernillo-de-preguntas-Saber-11-$a.pdf" \
      "altopuntaje/cuadernillo-saber11-$a.pdf" --cacert "$chain"
done

echo "altopuntaje — Saber 11 formato viejo (pre-2014, NO ingerir: ver MANIFEST.md)"
while IFS='|' read -r id name; do
  [ -z "${id:-}" ] && continue
  get "https://drive.usercontent.google.com/download?id=$id&export=download&confirm=t" \
      "saber11-formato-viejo/$name.pdf" || true
done < .drive-ids.txt

echo "listo."
