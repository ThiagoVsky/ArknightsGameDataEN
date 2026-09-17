#!/usr/bin/env bash
# Publica o payload de um grupo de assets no repositorio dedicado.
#
# Uso:
#   tools/asset-repos/publish.sh <grupo> [--batch-mb 800] [--dry-run] [--no-push]
#
# O andaime (README, tools, .github, .gitignore) ja foi publicado por create-repos.sh.
# Aqui entra so o material baixado, na raiz do repositorio, em lotes: o GitHub recusa
# pushes acima de 2 GB, entao o script vai commitando e enviando por tamanho acumulado.

set -euo pipefail

GROUP="${1:-}"
if [ -z "$GROUP" ]; then
  echo "uso: $0 <grupo> [--batch-mb 800] [--dry-run] [--no-push]"
  exit 1
fi
shift

BATCH_MB=800
DRY_RUN=0
DO_PUSH=1
while [ $# -gt 0 ]; do
  case "$1" in
    --batch-mb) BATCH_MB="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --no-push) DO_PUSH=0; shift ;;
    *) echo "argumento desconhecido: $1"; exit 1 ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DIR="$ROOT/assets/$GROUP"
[ -d "$DIR/.git" ] || { echo "ERRO: $DIR nao e um repositorio git"; exit 1; }

cd "$DIR"
git config http.postBuffer 524288000

echo "== $GROUP em $DIR"
echo "   tamanho do payload: $(du -sh . 2>/dev/null | cut -f1)"
echo "   arquivos nao rastreados: $(git status --porcelain | wc -l)"

if [ "$DRY_RUN" = "1" ]; then
  git status --porcelain | awk '{print "   " $2}' | head -20
  echo "   [dry-run] nada foi commitado"
  exit 0
fi

if [ -z "$(git status --porcelain)" ]; then
  echo "   nada a publicar"
  exit 0
fi

# lotes por tamanho acumulado
BATCH_BYTES=$((BATCH_MB * 1024 * 1024))
acc=0
n=0
while IFS= read -r entry; do
  [ -n "$entry" ] || continue
  path="${entry#\?\? }"
  [ -e "$path" ] || continue
  size=$(du -sb "$path" 2>/dev/null | cut -f1 || echo 0)
  acc=$((acc + size))
  git add -A -- "$path"
  if [ "$acc" -ge "$BATCH_BYTES" ]; then
    n=$((n + 1))
    git -c user.name='github-actions[bot]' -c user.email='github-actions[bot]@users.noreply.github.com' \
      commit -q -m "Add $GROUP assets, batch $n ($(du -sh --exclude=.git . | cut -f1) total)"
    echo "   lote $n commitado ($((acc / 1024 / 1024)) MB neste lote)"
    if [ "$DO_PUSH" = "1" ]; then
      git push -q origin main && echo "   lote $n publicado"
    fi
    acc=0
  fi
done < <(git status --porcelain)

if [ "$acc" -gt 0 ]; then
  n=$((n + 1))
  git -c user.name='github-actions[bot]' -c user.email='github-actions[bot]@users.noreply.github.com' \
    commit -q -m "Add $GROUP assets, batch $n (final)"
  echo "   lote $n ($n final) commitado"
  if [ "$DO_PUSH" = "1" ]; then
    git push -q origin main && echo "   lote $n publicado"
  fi
fi

echo "== fim: $n lote(s)"
git log --oneline -"$((n + 1))" | sed 's/^/   /'
echo "   tamanho final: $(du -sh --exclude=.git . | cut -f1)"
