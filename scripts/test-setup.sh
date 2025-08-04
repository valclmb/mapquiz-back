#!/bin/bash

# Script pour démarrer la base de données de test et lancer les tests

set -e

# Fonction de nettoyage
cleanup() {
  echo "🧹 Nettoyage..."
  docker-compose -f docker-compose.test.yml down
  echo "✅ Tests terminés !"
  exit 0
}

# Capturer Ctrl+C pour nettoyer en mode watch
trap cleanup SIGINT SIGTERM

echo "🐳 Démarrage de la base de données de test..."

# Démarrer PostgreSQL de test
docker-compose -f docker-compose.test.yml up -d postgres-test

# Attendre que PostgreSQL soit prêt
echo "⏳ Attente que PostgreSQL soit prêt..."
until docker-compose -f docker-compose.test.yml exec -T postgres-test pg_isready -U postgres; do
  echo "PostgreSQL n'est pas encore prêt, attente..."
  sleep 2
done

echo "✅ PostgreSQL de test est prêt !"

# Configurer les variables d'environnement pour les tests
export TEST_DATABASE_URL="postgresql://postgres:test_password@localhost:5433/test_db"
export DATABASE_URL="$TEST_DATABASE_URL"
export NODE_ENV="test"

echo "🔧 Configuration des variables d'environnement..."
echo "DATABASE_URL=$DATABASE_URL"

# Générer le client Prisma
echo "🔨 Génération du client Prisma..."
npm run db:generate

# Appliquer les migrations
echo "📦 Application des migrations..."
npm run db:push

# Analyser les arguments
JEST_ARGS=""
WATCH_MODE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --watch)
      JEST_ARGS="$JEST_ARGS --watch"
      WATCH_MODE=true
      shift
      ;;
    --coverage)
      JEST_ARGS="$JEST_ARGS --coverage"
      shift
      ;;
    --unit)
      JEST_ARGS="$JEST_ARGS --testPathPatterns=unit"
      shift
      ;;
    --integration)
      JEST_ARGS="$JEST_ARGS --testPathPatterns=integration"
      shift
      ;;
    --e2e)
      JEST_ARGS="$JEST_ARGS --testPathPatterns=e2e"
      shift
      ;;
    --performance)
      JEST_ARGS="$JEST_ARGS --testPathPatterns=performance"
      shift
      ;;
    --debug)
      JEST_ARGS="$JEST_ARGS --detectOpenHandles --forceExit"
      shift
      ;;
    *)
      echo "Argument inconnu: $1"
      exit 1
      ;;
  esac
done

echo "🚀 Lancement des tests avec Jest..."
npx jest $JEST_ARGS

# Nettoyer seulement si pas en mode watch
if [ "$WATCH_MODE" = false ]; then
  echo "🧹 Nettoyage..."
  docker-compose -f docker-compose.test.yml down
  echo "✅ Tests terminés !"
else
  echo "👀 Mode watch actif - Appuyez sur Ctrl+C pour arrêter"
  echo "🧹 Nettoyage automatique à la fermeture..."
fi 