#!/bin/sh
set -e

echo "Aplicando migrações do banco de dados..."
node dist/db/migrate.js

exec "$@"
