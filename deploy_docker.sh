#!/usr/bin/env bash
# ==============================================================================
#  NDAW WUNE — Déploiement Admin Dashboard avec Docker
#
#  Première installation sur le VPS (après l'API, qui installe Docker et Caddy) :
#    git clone https://github.com/korka-dev/ndaw-wune-admin.git /opt/ndawwune/admin
#    cd /opt/ndawwune/admin
#    sudo bash deploy_docker.sh
#
#  Le même script sert aux mises à jour (git pull + rebuild).
#
#  - .env.production est créé depuis .env.production.example s'il manque
#    (domaines *.ndawwune.cloud par défaut).
#  - Si Caddy est installé, le site est publié en HTTPS via
#    /etc/caddy/sites/ndawwune-admin.caddy ; sinon, si Nginx est présent,
#    il est simplement rechargé (config : nginx-admin.conf).
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
  # API_DOMAIN / ADMIN_DOMAIN (optionnels) remplacent les domaines *.ndawwune.cloud
  # de l'exemple : API_DOMAIN=api.exemple.com ADMIN_DOMAIN=admin.exemple.com bash deploy_docker.sh
  sed -e "s#api\.ndawwune\.cloud#${API_DOMAIN:-api.ndawwune.cloud}#g" \
      -e "s#admin\.ndawwune\.cloud#${ADMIN_DOMAIN:-admin.ndawwune.cloud}#g" \
      .env.production.example > .env.production
  warn ".env.production créé — vérifiez les domaines : $(grep -v '^#' .env.production | xargs)"
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

# ── Récupération du code le plus récent ───────────────────────────────────────
header "Étape 0/2 — Mise à jour du code (git pull)"

if git rev-parse --git-dir &>/dev/null; then
  BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
  log "Branche : $BRANCH — récupération des dernières modifications..."
  git fetch origin "$BRANCH"
  LOCAL=$(git rev-parse HEAD)
  REMOTE=$(git rev-parse "origin/$BRANCH")
  if [ "$LOCAL" = "$REMOTE" ]; then
    success "Code déjà à jour ($(git log -1 --format='%h %s'))."
  else
    git reset --hard "origin/$BRANCH"
    success "Code mis à jour : $(git log -1 --format='%h %s')"
  fi
else
  warn "Pas de dépôt git détecté — le code actuel sera utilisé tel quel."
fi

# ── Build de l'image ──────────────────────────────────────────────────────────
header "Étape 1/2 — Build de l'image Docker"
log "docker compose build --no-cache (NEXT_PUBLIC_API_URL injecté dans le bundle) ..."

docker compose --env-file .env.production build --no-cache

success "Image construite."

# ── Démarrage du conteneur ────────────────────────────────────────────────────
header "Étape 2/2 — Démarrage du conteneur"

# Libérer le port 3000 si PM2 tourne encore
if command -v pm2 &>/dev/null && pm2 list 2>/dev/null | grep -q "online"; then
  warn "PM2 occupe le port 3000 — arrêt en cours ..."
  pm2 stop all 2>/dev/null || true
  pm2 delete all 2>/dev/null || true
  success "PM2 arrêté."
fi

# Arrêter l'ancien conteneur Docker (libère le port 3000 automatiquement)
log "Arrêt de l'ancien conteneur..."
docker compose --env-file .env.production down 2>/dev/null || true

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

# ── Reverse proxy HTTPS ───────────────────────────────────────────────────────
SUDO=""; [ "$EUID" -eq 0 ] || SUDO="sudo"
ADMIN_DOMAIN="${NEXT_PUBLIC_APP_ORIGIN:-admin.ndawwune.cloud}"

if command -v caddy &>/dev/null; then
  # Même organisation que l'API (backend/deploy_vps.sh) : le Caddyfile
  # principal importe /etc/caddy/sites/*.caddy.
  $SUDO mkdir -p /etc/caddy/sites
  if [ ! -f /etc/caddy/Caddyfile ] || grep -q "/usr/share/caddy" /etc/caddy/Caddyfile; then
    echo "import /etc/caddy/sites/*.caddy" | $SUDO tee /etc/caddy/Caddyfile >/dev/null
  elif ! grep -q "import /etc/caddy/sites/\*.caddy" /etc/caddy/Caddyfile; then
    echo -e "\nimport /etc/caddy/sites/*.caddy" | $SUDO tee -a /etc/caddy/Caddyfile >/dev/null
  fi

  sed "s/admin\.ndawwune\.cloud/${ADMIN_DOMAIN}/g" Caddyfile.admin | $SUDO tee /etc/caddy/sites/ndawwune-admin.caddy >/dev/null

  if $SUDO caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then
    $SUDO systemctl reload caddy
    success "Caddy configuré pour https://${ADMIN_DOMAIN}"
  else
    $SUDO caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile || true
    warn "Config Caddy invalide (${ADMIN_DOMAIN} est peut-être déjà défini dans /etc/caddy/Caddyfile) — Caddy non rechargé."
  fi
elif command -v nginx &>/dev/null; then
  if $SUDO nginx -t 2>/dev/null; then
    $SUDO systemctl reload nginx
    success "Nginx rechargé."
  else
    warn "Config Nginx invalide — rechargez manuellement après correction."
  fi
else
  warn "Ni Caddy ni Nginx trouvés : le dashboard n'est accessible que sur 127.0.0.1:3000."
  warn "Lancez d'abord deploy_vps.sh de l'API (il installe Caddy), puis relancez ce script."
fi

echo ""
docker ps --filter "name=ndawwune-admin" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

header "Déploiement terminé !"
success "Dashboard Admin disponible sur https://${ADMIN_DOMAIN}"
echo ""
log "Commandes utiles :"
echo "  docker logs -f ndawwune-admin          # logs en temps réel"
echo "  docker stats ndawwune-admin            # CPU / mémoire"
echo "  docker compose --env-file .env.production down   # arrêt"
echo "  docker compose --env-file .env.production up -d  # redémarrage"
echo ""
