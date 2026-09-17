#!/usr/bin/env bash
# Prepara a pasta de um grupo de assets para virar repositorio proprio no GitHub.
#
# Uso:
#   tools/asset-repos/bootstrap.sh <grupo> [url-do-remoto] [--init]
#
# Materializa em assets/<grupo>/:
#   README.md                        (ingles, gerado por readme.py)
#   .gitignore
#   tools/assets_sync.py             (copia com o grupo fixado como padrao)
#   .github/workflows/update.yml     (cron diario, estado incremental)
#
# Com --init tambem roda git init, cria o commit inicial e configura o remoto.
# Os grupos, os repositorios e os tamanhos estao em tools/asset-repos/README.md.

set -euo pipefail

GROUP="${1:-}"
REMOTE="${2:-}"
DO_INIT="${3:-}"

if [ -z "$GROUP" ]; then
  echo "uso: $0 <grupo> [url-do-remoto] [--init]"
  echo "grupos disponiveis:"
  sed -n 's/^| `\([a-z-]*\)`.*/  \1/p' "$(dirname "$0")/README.md" 2>/dev/null || true
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEST="$ROOT/assets/$GROUP"
mkdir -p "$DEST/tools" "$DEST/.github/workflows"

if [ ! -f "$ROOT/tools/asset-repos/readme.py" ]; then
  echo "ERRO: tools/asset-repos/readme.py nao encontrado"
  exit 1
fi

# copia do sincronizador com o grupo deste repositorio como padrao
sed "s|^DEFAULT_GROUP = os.environ.get(\"ASSETS_GROUP\", \"all\")|DEFAULT_GROUP = os.environ.get(\"ASSETS_GROUP\", \"$GROUP\")|" \
  "$ROOT/tools/assets_sync.py" > "$DEST/tools/assets_sync.py"
if ! grep -q "ASSETS_GROUP\", \"$GROUP\"" "$DEST/tools/assets_sync.py"; then
  echo "ERRO: nao consegui fixar o grupo $GROUP no script copiado"
  exit 1
fi

sed "s/__GROUP__/$GROUP/g" "$ROOT/tools/asset-repos/update.yml.template" > "$DEST/.github/workflows/update.yml"

cat > "$DEST/.gitignore" <<'EOF'
# .state/ NAO e ignorado de proposito: o estado incremental precisa ser versionado para
# que a execucao seguinte saiba o que ja foi processado.
__pycache__/
*.pyc
*.tmp
.venv/
EOF

python3 "$ROOT/tools/asset-repos/readme.py" "$GROUP" > "$DEST/README.md"

echo "materializado: $DEST"
ls -1 "$DEST"

if [ "$DO_INIT" = "--init" ]; then
  cd "$DEST"
  if [ ! -d .git ]; then
    git init -q -b main
    git add -A
    git -c user.email=bot@local -c user.name=bot commit -q -m "Initial commit: $GROUP asset pipeline"
  fi
  if [ -n "$REMOTE" ]; then
    git remote remove origin 2>/dev/null || true
    git remote add origin "$REMOTE"
    echo "remoto configurado: $REMOTE"
  fi
fi
