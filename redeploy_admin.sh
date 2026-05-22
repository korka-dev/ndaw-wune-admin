#!/usr/bin/env bash
# ==============================================================================
#  NDAW WUNE — Script de redéploiement Dashboard Admin Next.js (VPS)
#
#  Usage (à lancer après votre "git pull" manuel dans le dossier admin du VPS) :
#    ./redeploy_admin.sh
# ==============================================================================

set -euo pipefail

# ── Couleurs pour l'affichage ──────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()     { echo -e "${CYAN}▶  $*${NC}"; }
success() { echo -e "${GREEN}✅  $*${NC}"; }
warn()    { echo -e "${YELLOW}⚠️   $*${NC}"; }
error()   { echo -e "${RED}❌  $*${NC}"; exit 1; }
header()  { echo -e "\n${BOLD}${CYAN}══════════════════════════════════════════${NC}"; echo -e "${BOLD}   $*${NC}"; echo -e "${BOLD}${CYAN}══════════════════════════════════════════${NC}"; }

ADMIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ADMIN_DIR"

header "NDAW WUNE — Redéploiement Admin Dashboard VPS"

# ── 1. Installation des dépendances ───────────────────────────────────────────
header "Étape 1/3 — Installation des dépendances Node.js"
log "Exécution de npm install..."
npm install --silent
success "Dépendances installées avec succès."

# ── 2. Compilation de l'application Next.js ────────────────────────────────────
header "Étape 2/3 — Compilation de l'application (Next Build)"
log "Lancement du build de production..."
npm run build
success "Next.js compilé avec succès."

# ── 3. Relance du serveur de production ─────────────────────────────────────────
header "Étape 3/3 — Redémarrage du processus de production"

# Détection de PM2 (le gestionnaire de processus recommandé en production pour Next.js)
if command -v pm2 &>/dev/null; then
  log "PM2 détecté sur le système."
  
  # Essayer de trouver un processus existant lié au dashboard admin
  PM2_APP_NAME=""
  if pm2 list | grep -q "ndawwune-admin"; then
    PM2_APP_NAME="ndawwune-admin"
  elif pm2 list | grep -q "ared-ndawune-plateforme"; then
    PM2_APP_NAME="ared-ndawune-plateforme"
  elif pm2 list | grep -q "admin"; then
    PM2_APP_NAME="admin"
  fi

  if [[ -n "$PM2_APP_NAME" ]]; then
    log "Redémarrage du processus existant PM2 '$PM2_APP_NAME'..."
    pm2 restart "$PM2_APP_NAME"
    success "Dashboard redémarré avec succès par PM2."
  else
    warn "Aucun processus existant trouvé dans PM2 pour le Dashboard."
    log "Lancement d'un nouveau processus PM2 nommé 'ndawwune-admin'..."
    pm2 start npm --name "ndawwune-admin" -- run start
    pm2 save
    success "Dashboard démarré avec succès sous le nom 'ndawwune-admin' !"
  fi
  pm2 status

# Détection alternative si système d'unité systemd
elif systemctl is-active --quiet ndawwune-admin 2>/dev/null; then
  log "Service systemd 'ndawwune-admin' détecté."
  log "Redémarrage du service systemd..."
  sudo systemctl restart ndawwune-admin
  success "Dashboard redémarré via systemd."

# Sinon, guide interactif
else
  warn "Aucun gestionnaire (PM2 ou systemd) n'a été détecté pour Next.js."
  log "Vous pouvez démarrer l'application Next.js en arrière-plan :"
  log "  Option A (Nohup classique) :"
  log "    nohup npm run start > next.log 2>&1 &"
  echo ""
  log "  Option B (PM2 - Recommandé, à installer via 'npm install -g pm2') :"
  log "    pm2 start npm --name \"ndawwune-admin\" -- run start"
  echo ""
fi

header "Redéploiement Terminé !"
success "Le Dashboard Admin a été mis à jour et compilé avec succès."
echo ""
