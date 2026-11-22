#!/usr/bin/env bash
# Falla si el PR cambia código de la app sin actualizar contexto/ESTADO.md.
set -euo pipefail
base="${1:?uso: check-contexto.sh <commit-base>}"
changed=$(git diff --name-only "$base"...HEAD)
if echo "$changed" | grep -qE '^(client|server|shared)/'; then
  if ! echo "$changed" | grep -qx 'contexto/ESTADO.md'; then
    echo "::error::Este PR cambia código en client/, server/ o shared/ pero no actualiza contexto/ESTADO.md."
    echo "Añade lo que se construyó o lo que cambió en contexto/ESTADO.md (ver AGENTS.md)."
    exit 1
  fi
fi
echo "contexto/ESTADO.md al día."
