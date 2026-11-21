#!/usr/bin/env sh
# ==============================================================================
#  NDAW WUNE Admin — Contrôle du bundle avant mise en service (rapport V2, APP-42)
#
#  NEXT_PUBLIC_API_URL est inscrite dans le JavaScript au moment du build :
#  changer la variable au démarrage ne suffit pas. Ce contrôle échoue si le
#  bundle appelle une autre API que celle attendue (ancien domaine, localhost).
#
#  Usage :  ATTENDUE=https://api.exemple.org/api/v1 ./scripts/verifier-bundle.sh [.next/static]
#  Dans l'image : docker run --rm --entrypoint sh ndawwune-admin:latest -c "$(cat scripts/verifier-bundle.sh)"
# ==============================================================================
set -eu
DOSSIER="${1:-.next/static}"
ATTENDUE="${ATTENDUE:-${NEXT_PUBLIC_API_URL:-}}"
[ -n "$ATTENDUE" ] || { echo "❌ ATTENDUE (ou NEXT_PUBLIC_API_URL) non défini" >&2; exit 2; }
[ -d "$DOSSIER" ] || { echo "❌ $DOSSIER introuvable (lancer le build d'abord)" >&2; exit 2; }

TROUVEES="$(grep -rhoE 'https?://[A-Za-z0-9._:-]+/api/v1' "$DOSSIER" | sort -u)"
echo "URL d'API présentes dans le bundle :"
echo "${TROUVEES:-  (aucune)}" | sed 's/^/  /'
if [ "$TROUVEES" = "$ATTENDUE" ]; then
  echo "✅ Bundle conforme : $ATTENDUE"
else
  echo "❌ Bundle NON conforme : seule $ATTENDUE est attendue" >&2
  exit 1
fi
