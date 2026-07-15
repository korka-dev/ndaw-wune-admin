#!/usr/bin/env bash
# ==============================================================================
#  NDAW WUNE — Déploiement Admin Dashboard avec Docker
#
#  Usage (sur le VPS, depuis le dossier admin/) :
#    chmod +x deploy_docker.sh && ./deploy_docker.sh
#
#  Prérequis :
#    - Docker + Docker Compose installés
#    - Fichier .env.production créé (cp .env.production.example .env.production)
#    - Nginx configuré avec nginx-admin.conf
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

header "NDAW WUNE — Déploiement Admin Docker"

# ── Vérifications préalables ──────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  error "Docker n'est pas installé.\n   Installez-le : https://docs.docker.com/engine/install/ubuntu/"
fi

if ! docker compose version &>/dev/null; then
  error "Docker Compose (plugin) n'est pas disponible.\n   Lancez : sudo apt install docker-compose-plugin"
fi

if [ ! -f ".env.production" ]; then
  error ".env.production introuvable !\n\n   Créez-le :\n     cp .env.production.example .env.production\n     nano .env.production\n\n   Renseignez NEXT_PUBLIC_API_URL avec l'URL publique du backend."
fi

# Charger et valider l'env
set -a; source .env.production; set +a

if [ -z "${NEXT_PUBLIC_API_URL:-}" ]; then
  error "NEXT_PUBLIC_API_URL non défini dans .env.production"
fi

if echo "$NEXT_PUBLIC_API_URL" | grep -qE "localhost|127\.0\.0\.1"; then
  warn "NEXT_PUBLIC_API_URL pointe vers localhost : $NEXT_PUBLIC_API_URL"
  warn "Les appels API du navigateur échoueront en production."
  read -rp "Continuer quand même ? (y/N) " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || exit 0
fi

success "Config : NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL"

# ── Build de l'image ──────────────────────────────────────────────────────────
header "Étape 1/2 — Build de l'image Docker"
log "docker compose build (NEXT_PUBLIC_API_URL est injecté dans le bundle) ..."

docker compose --env-file .env.production build --no-cache

success "Image construite."

# ── Démarrage du conteneur ────────────────────────────────────────────────────
header "Étape 2/2 — Démarrage du conteneur"

# Arrêter proprement l'ancien conteneur s'il tourne
if docker ps -q --filter "name=ndawwune-admin" | grep -q .; then
  log "Arrêt de l'ancien conteneur ..."
  docker compose --env-file .env.production down
fi

log "Démarrage du nouveau conteneur ..."
docker compose --env-file .env.production up -d

# Attendre que le healthcheck passe (max 30s)
log "Vérification de la santé du conteneur ..."
for i in $(seq 1 10); do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' ndawwune-admin 2>/dev/null || echo "starting")
  if [ "$STATUS" = "healthy" ]; then
    break
  fi
  sleep 3
done

# ── Rechargement Nginx ────────────────────────────────────────────────────────
if command -v nginx &>/dev/null; then
  if sudo nginx -t 2>/dev/null; then
    sudo systemctl reload nginx
    success "Nginx rechargé."
  else
    warn "Config Nginx invalide — rechargez manuellement après correction."
  fi
fi

echo ""
docker ps --filter "name=ndawwune-admin" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

header "Déploiement terminé !"
success "Dashboard Admin disponible sur https://admin.ndawwune.cloud"
echo ""
log "Commandes utiles :"
echo "  docker logs -f ndawwune-admin          # logs en temps réel"
echo "  docker stats ndawwune-admin            # CPU / mémoire"
echo "  docker compose --env-file .env.production down   # arrêt"
echo "  docker compose --env-file .env.production up -d  # redémarrage"
echo ""
