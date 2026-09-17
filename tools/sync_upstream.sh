#!/usr/bin/env bash
# Sincroniza incrementalmente os dados do repositorio pai para o branch de dados,
# sem merge e sem conflito, preservando os arquivos que este fork restaurou de proposito.
#
# Por que nao usar merge: o branch EN removeu de proposito os diretorios bili/, cn/,
# jp/, kr/ e tw/, mas o repositorio pai continua alterando esses arquivos. Um merge
# produz conflitos modify/delete em todos eles (medido: 30 conflitos, todos em bili/ e
# cn/) e, pior, aplica em silencio as delecoes que o pai fez dentro de en/ (medido: 33
# arquivos restaurados por "provide some deleted stories"). O sync por caminho trata
# so o que interessa, e o manifesto de preservados torna a retencao explicita.
#
# Etapas:
#   1. busca o branch do pai
#   2. atualiza o branch espelho por fast-forward (o espelho nao tem commits locais)
#   3. copia en/ e fbs_version.txt do pai para o branch de dados
#   4. aplica as delecoes do pai dentro de en/, exceto as do manifesto de preservados
#   5. commita e publica, registrando o commit do pai na mensagem
#
# Variaveis: DRY_RUN=1, UPSTREAM_URL, UPSTREAM_BRANCH, DATA_BRANCH, MIRROR_BRANCH, PRESERVED

set -euo pipefail

UPSTREAM_URL="${UPSTREAM_URL:-https://github.com/ArknightsAssets/ArknightsGamedata.git}"
UPSTREAM_BRANCH="${UPSTREAM_BRANCH:-master}"
DATA_BRANCH="${DATA_BRANCH:-master}"
MIRROR_BRANCH="${MIRROR_BRANCH:-upstream}"
PRESERVED="${PRESERVED:-tools/preserved_files.txt}"
DRY_RUN="${DRY_RUN:-0}"
SYNC_PATHS=(en fbs_version.txt)

say() { printf '%s\n' "$*"; }
run() {
  if [ "$DRY_RUN" = "1" ]; then
    say "   [dry-run] $*"
  else
    "$@"
  fi
}

say "== sync a partir de $UPSTREAM_URL ($UPSTREAM_BRANCH)"

if ! git remote get-url upstream >/dev/null 2>&1; then
  git remote add upstream "$UPSTREAM_URL"
fi
# sempre reafirma a URL, caso o remote ja exista com outro valor. Isto e configuracao
# local idempotente, entao roda tambem em dry-run (sem o remote o fetch abaixo falha).
git remote set-url upstream "$UPSTREAM_URL"
git fetch --no-tags --quiet upstream "$UPSTREAM_BRANCH"
UPSTREAM_SHA="$(git rev-parse FETCH_HEAD)"
UPSTREAM_SHORT="$(git rev-parse --short FETCH_HEAD)"
say "   commit do pai: $UPSTREAM_SHORT"

# 2. espelho por fast-forward
CURRENT="$(git rev-parse --abbrev-ref HEAD)"
if [ "$DRY_RUN" = "1" ] && [ "$CURRENT" != "$DATA_BRANCH" ]; then
  say "   ERRO: dry-run exige estar no branch $DATA_BRANCH (atual: $CURRENT)"
  exit 1
fi
if ! git rev-parse --verify --quiet "$MIRROR_BRANCH" >/dev/null; then
  say "   criando branch espelho $MIRROR_BRANCH"
  run git branch "$MIRROR_BRANCH" "$UPSTREAM_SHA"
else
  BEHIND="$(git rev-list --count "$MIRROR_BRANCH".."$UPSTREAM_SHA" 2>/dev/null || echo 0)"
  AHEAD="$(git rev-list --count "$UPSTREAM_SHA".."$MIRROR_BRANCH" 2>/dev/null || echo 0)"
  if [ "$AHEAD" != "0" ]; then
    say "   AVISO: $MIRROR_BRANCH tem $AHEAD commits que o pai nao tem; espelho nao sera forcado"
  elif [ "$BEHIND" = "0" ]; then
    say "   espelho $MIRROR_BRANCH ja esta atualizado"
  else
    say "   avancando $MIRROR_BRANCH em $BEHIND commits"
    run git branch -f "$MIRROR_BRANCH" "$UPSTREAM_SHA"
    run git push --quiet origin "$MIRROR_BRANCH:$MIRROR_BRANCH"
  fi
fi

# 3. branch de dados
run git checkout --quiet "$DATA_BRANCH"
BEFORE="$(git rev-parse HEAD)"

say "   copiando conteudo de ${SYNC_PATHS[*]}"
run git checkout "$UPSTREAM_SHA" -- "${SYNC_PATHS[@]}"

# 4. delecoes feitas pelo pai dentro de en/, respeitando o manifesto
PRESERVED_TMP="$(mktemp)"
if [ -f "$PRESERVED" ]; then
  grep -v '^[[:space:]]*$' "$PRESERVED" | sort -u > "$PRESERVED_TMP" || true
else
  : > "$PRESERVED_TMP"
fi

DELETED_LIST="$(mktemp)"
while IFS= read -r path; do
  [ -n "$path" ] || continue
  printf '%s\n' "$path" >> "$DELETED_LIST"
done < <(comm -23 <(git ls-tree -r --name-only "$BEFORE" -- en/ | sort) \
                  <(git ls-tree -r --name-only "$UPSTREAM_SHA" -- en/ | sort))

KEPT="$(grep -c -x -F -f "$PRESERVED_TMP" "$DELETED_LIST" 2>/dev/null || echo 0)"
DELETED=$(( $(wc -l < "$DELETED_LIST") - KEPT ))

if [ "$DRY_RUN" = "1" ]; then
  say "   diff bruto entre este fork e o pai nos caminhos sincronizados"
  say "   (inclui os preservados, que o sync NAO remove; a contagem aplicavel esta abaixo):"
  git diff --stat "$BEFORE" "$UPSTREAM_SHA" -- "${SYNC_PATHS[@]}" | tail -1 || true
  say "   delecoes que seriam aplicadas: $DELETED | ausentes no pai mas preservados: $KEPT"
  say "   (dry-run nao altera a arvore de trabalho)"
  rm -f "$PRESERVED_TMP" "$DELETED_LIST"
  exit 0
fi

while IFS= read -r path; do
  [ -n "$path" ] || continue
  if grep -Fxq "$path" "$PRESERVED_TMP"; then
    # o pai deletou, mas o manifesto manda manter: restaura a versao deste fork
    git checkout "$BEFORE" -- "$path"
  else
    git rm -q --ignore-unmatch "$path"
  fi
done < "$DELETED_LIST"
rm -f "$PRESERVED_TMP" "$DELETED_LIST"

say "   preservados mantidos: $KEPT | removidos por delecao do pai: $DELETED"
run git add -A en fbs_version.txt

if git diff --cached --quiet; then
  say "== nada a fazer: o branch $DATA_BRANCH ja reflete $UPSTREAM_SHORT"
  exit 0
fi

STAT="$(git diff --cached --shortstat)"
say "   mudancas: $STAT"
if [ "$DRY_RUN" = "1" ]; then
  say "== dry-run: nenhum commit criado"
  exit 0
fi

git commit --quiet -m "sync en/ from upstream $UPSTREAM_SHORT" -m "Origem: $UPSTREAM_URL $UPSTREAM_BRANCH@$UPSTREAM_SHA
Diff: $STAT
Preservados mantidos por tools/preserved_files.txt: $KEPT"
git push --quiet origin "$DATA_BRANCH:$DATA_BRANCH"
say "== publicado: $DATA_BRANCH atualizado para $UPSTREAM_SHORT"
