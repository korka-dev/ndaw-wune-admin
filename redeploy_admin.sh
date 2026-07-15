#!/usr/bin/env bash
# ==============================================================================
#  NDAW WUNE — Redéploiement Dashboard Admin Next.js via PM2 (VPS Ubuntu)
#
#  Prérequis sur le VPS :
#    1. Node.js 20+ et npm installés
#    2. PM2 installé : npm install -g pm2
#    3. Fichier .env.production créé (cp .env.production.example .env.production)
#    4. Nginx configuré avec nginx-admin.conf (voir ce fichier)
#
#  Usage (depuis le dossier admin/ sur le VPS, après git pull) :
#    chmod +x redeploy_admin.sh && ./redeploy_admin.sh
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

header "NDAW WUNE — Redéploiement Admin Dashboard"

# ── Vérification PM2 ──────────────────────────────────────────────────────────
if ! command -v pm2 &>/dev/null; then
  error "PM2 n'est pas installé. Lancez : npm install -g pm2"
fi

# ── Vérification .env.local (dangereux sur le VPS) ───────────────────────────
if [ -f ".env.local" ]; then
  warn ".env.local détecté — ce fichier écrase .env.production et contient"
  warn "probablement des URLs localhost. Renommage en .env.local.bak ..."
  mv .env.local .env.local.bak
  success ".env.local renommé en .env.local.bak (supprimez-le manuellement)."
fi

# ── Vérification .env.production ─────────────────────────────────────────────
header "Étape 0/4 — Vérification de la configuration"

if [ ! -f ".env.production" ]; then
  error ".env.production introuvable !\n\n   Créez-le depuis l'exemple :\n     cp .env.production.example .env.production\n     nano .env.production\n\n   Puis relancez ce script."
fi

# Charger les variables pour validation et pour le build
set -a
# shellcheck disable=SC1091
source .env.production
set +a

if [ -z "${NEXT_PUBLIC_API_URL:-}" ]; then
  error "NEXT_PUBLIC_API_URL n'est pas défini dans .env.production"
fi

if echo "$NEXT_PUBLIC_API_URL" | grep -qE "localhost|127\.0\.0\.1"; then
  warn "NEXT_PUBLIC_API_URL pointe vers localhost : $NEXT_PUBLIC_API_URL"
  warn "Les appels API depuis le navigateur échoueront en production."
  warn "Modifiez .env.production avec l'IP ou le domaine réel du VPS."
  read -rp "Continuer quand même ? (y/N) " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || exit 0
fi

success "Config OK : NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL"

# ── 1. Dépendances ────────────────────────────────────────────────────────────
header "Étape 1/4 — Installation des dépendances"
npm ci --silent
success "Dépendances installées."

# ── 2. Build ──────────────────────────────────────────────────────────────────
# Les variables NEXT_PUBLIC_* sont injectées dans le bundle ici (pas au runtime).
# .env.production est sourcé ci-dessus donc Next.js le lit automatiquement.
header "Étape 2/4 — Build Next.js (standalone)"
log "next build avec NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL ..."
NODE_ENV=production npm run build
success "Build terminé."

# ── 3. Copie des assets statiques ─────────────────────────────────────────────
# OBLIGATOIRE avec output:"standalone" — Next.js ne les copie pas automatiquement.
# Nginx les servira DIRECTEMENT depuis .next/standalone/.next/static/ (voir nginx-admin.conf).
header "Étape 3/4 — Copie des assets statiques vers standalone/"

# Public/
if [ -d "public" ] && [ "$(ls -A public 2>/dev/null)" ]; then
  rm -rf .next/standalone/public
  cp -r public .next/standalone/public
  success "public/ copié."
else
  log "Dossier public/ vide ou absent — ignoré."
fi

# _next/static/
mkdir -p .next/standalone/.next
rm -rf .next/standalone/.next/static
cp -r .next/static .next/standalone/.next/static
success ".next/static/ copié → .next/standalone/.next/static/"

# Vérification rapide
CHUNK_COUNT=$(find .next/standalone/.next/static -name "*.js" 2>/dev/null | wc -l)
log "$CHUNK_COUNT fichiers JS statiques présents dans standalone."

# ── 4. PM2 ────────────────────────────────────────────────────────────────────
header "Étape 4/4 — Redémarrage PM2"

if pm2 list | grep -q "ndawwune-admin"; then
  pm2 reload ecosystem.config.js --env production
  success "Processus rechargé (zero-downtime)."
else
  pm2 start ecosystem.config.js --env production
  pm2 save
  success "Processus démarré et sauvegardé."
fi

# ── Rechargement Nginx (si disponible) ────────────────────────────────────────
if command -v nginx &>/dev/null; then
  if sudo nginx -t 2>/dev/null; then
    sudo systemctl reload nginx
    success "Nginx rechargé."
  else
    warn "Config Nginx invalide — rechargement ignoré. Lancez : sudo nginx -t"
  fi
fi

echo ""
pm2 status ndawwune-admin
echo ""
header "Déploiement terminé !"
success "Dashboard Admin disponible sur https://admin.ndawwune.cloud"
echo ""
log "Commandes utiles :"
echo "  pm2 logs ndawwune-admin     # logs en temps réel"
echo "  pm2 monit                   # monitoring"
echo "  sudo nginx -t               # vérifier la config Nginx"
echo ""
