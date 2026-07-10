#!/usr/bin/env bash
# ==============================================================================
#  NDAW WUNE — Redéploiement Dashboard Admin Next.js via PM2 (VPS)
#
#  Usage (depuis le dossier admin sur le VPS, après git pull) :
#    ./redeploy_admin.sh
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()     { echo -e "${CYAN}▶  $*${NC}"; }
success() { echo -e "${GREEN}✅  $*${NC}"; }
warn()    { echo -e "${YELLOW}⚠️   $*${NC}"; }
error()   { echo -e "${RED}❌  $*${NC}"; exit 1; }
header()  { echo -e "\n${BOLD}${CYAN}══════════════════════════════════════════${NC}"; echo -e "${BOLD}   $*${NC}"; echo -e "${BOLD}${CYAN}══════════════════════════════════════════${NC}"; }

ADMIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ADMIN_DIR"

header "NDAW WUNE — Redéploiement Admin Dashboard (PM2)"

# ── Vérification PM2 ──────────────────────────────────────────────────────────
if ! command -v pm2 &>/dev/null; then
  error "PM2 n'est pas installé. Lancez : npm install -g pm2"
fi

# ── 1. Installation des dépendances ──────────────────────────────────────────
header "Étape 1/4 — Installation des dépendances"
log "npm install --production=false ..."
npm install --silent
success "Dépendances installées."

# ── 2. Build de production ────────────────────────────────────────────────────
header "Étape 2/4 — Build Next.js (standalone)"
log "npm run build ..."
npm run build
success "Build terminé."

# ── 3. Copie des assets statiques dans le répertoire standalone ───────────────
# Nécessaire avec output: "standalone" : Next.js ne les copie pas automatiquement
header "Étape 3/4 — Copie des assets statiques"
log "Copie de public/ et .next/static/ dans .next/standalone/ ..."
cp -r public .next/standalone/public
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
success "Assets copiés."

# ── 4. Démarrage / Rechargement PM2 ──────────────────────────────────────────
header "Étape 4/4 — Gestion du processus PM2"

if pm2 list | grep -q "ndawwune-admin"; then
  log "Processus existant détecté — rechargement sans coupure (reload) ..."
  pm2 reload ecosystem.config.js --env production
  success "Processus rechargé avec succès."
else
  log "Aucun processus existant — démarrage initial ..."
  mkdir -p /var/log/pm2
  pm2 start ecosystem.config.js --env production
  pm2 save
  success "Processus démarré et sauvegardé."
fi

echo ""
pm2 status
echo ""

header "Déploiement terminé !"
success "Dashboard Admin opérationnel sur le port 3000."
echo ""
log "Commandes utiles :"
echo "  pm2 logs ndawwune-admin     # logs en temps réel"
echo "  pm2 status                  # état du processus"
echo "  pm2 stop ndawwune-admin     # arrêt"
echo ""
