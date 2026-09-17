#!/usr/bin/env bash
# Cria no GitHub os repositorios de assets e publica o andaime de cada um.
#
# Uso:
#   tools/asset-repos/create-repos.sh [--owner <conta>] [--dry-run]
#
# Idempotente: se o repositorio ja existir, apenas configura o remoto e publica o
# andaime. O payload (os assets em si) nao entra aqui; use publish.sh para isso, que
# faz o commit e o push depois que o download de cada grupo termina.

set -euo pipefail

OWNER="${OWNER:-ThiagoVsky}"
DRY_RUN=0
while [ $# -gt 0 ]; do
  case "$1" in
    --owner) OWNER="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    *) echo "argumento desconhecido: $1"; exit 1 ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
GIT_NAME="github-actions[bot]"
GIT_MAIL="github-actions[bot]@users.noreply.github.com"

# grupo|repositorio|descricao|topicos
SPECS=(
  "voice-jp|arknights-voice-jp|Arknights operator voice lines, Japanese (JP), extracted from the EN game server.|arknights,game-assets,voice-lines,arkprts"
  "voice-cn|arknights-voice-cn|Arknights operator voice lines, Chinese (Mandarin), extracted from the EN game server.|arknights,game-assets,voice-lines,arkprts"
  "voice-en|arknights-voice-en|Arknights operator voice lines, English, extracted from the EN game server.|arknights,game-assets,voice-lines,arkprts"
  "voice-kr|arknights-voice-kr|Arknights operator voice lines, Korean, extracted from the EN game server.|arknights,game-assets,voice-lines,arkprts"
  "voice-custom|arknights-voice-custom|Arknights custom and topolect voice lines, extracted from the EN game server.|arknights,game-assets,voice-lines,arkprts"
  "sound|arknights-sound|Arknights sound effects and music (no voice), extracted from the EN game server.|arknights,game-assets,sound-effects,arkprts"
  "en|arknights-assets-en|Arknights game assets from the EN server, excluding audio and text.|arknights,game-assets,arkprts,unity"
)

run() {
  if [ "$DRY_RUN" = "1" ]; then echo "   [dry-run] $*"; else "$@"; fi
}

for spec in "${SPECS[@]}"; do
  IFS='|' read -r GROUP REPO DESC TOPICS <<< "$spec"
  DIR="$ROOT/assets/$GROUP"
  echo "== $GROUP -> $OWNER/$REPO"

  if [ ! -d "$DIR" ]; then
    echo "   ERRO: $DIR nao existe; rode bootstrap.sh primeiro"
    continue
  fi

  cd "$DIR"

  if [ ! -d .git ]; then
    run git init -q -b main
  fi

  # andaime: so o que nao e payload
  run git add README.md .gitignore tools .github
  if ! git diff --cached --quiet 2>/dev/null; then
    run git -c user.name="$GIT_NAME" -c user.email="$GIT_MAIL" commit -q -m "Initial commit: asset pipeline for $GROUP"
  fi

  if gh repo view "$OWNER/$REPO" >/dev/null 2>&1; then
    echo "   repositorio ja existe"
    run git remote remove origin 2>/dev/null || true
    run git remote add origin "https://github.com/$OWNER/$REPO.git"
    run git push -q -u origin main
  else
    run gh repo create "$OWNER/$REPO" --public --description "$DESC" --source . --remote origin
    run git push -q -u origin main
  fi

  run gh repo edit "$OWNER/$REPO" --add-topic "$TOPICS" >/dev/null
  echo "   ok: https://github.com/$OWNER/$REPO"
done

echo
echo "== repositorios:"
gh repo list "$OWNER" --limit 20 --json name,visibility,url \
  --jq '.[] | select(.name|startswith("arknights")) | "  \(.name)  \(.visibility)  \(.url)"'
