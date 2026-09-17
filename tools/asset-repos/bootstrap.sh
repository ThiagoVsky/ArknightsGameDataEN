#!/usr/bin/env bash
# Prepara uma pasta de assets para virar repositorio proprio.
#
# Uso:
#   tools/asset-repos/bootstrap.sh <grupo> <url-do-remoto> [--init]
#
# Sem --init apenas materializa os arquivos (script, workflow, README, .gitignore) na
# pasta assets/<grupo>/. Com --init tambem roda git init, cria o commit inicial e
# configura o remoto, deixando pronto para um git push.
#
# Os grupos e os nomes de repositorio sugeridos estao em tools/asset-repos/README.md.

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

cp "$ROOT/tools/assets_sync.py" "$DEST/tools/assets_sync.py"
sed "s/__GROUP__/$GROUP/g" "$ROOT/tools/asset-repos/update.yml.template" > "$DEST/.github/workflows/update.yml"

cat > "$DEST/.gitignore" <<'EOF'
.state/
__pycache__/
*.pyc
.venv/
EOF

cat > "$DEST/README.md" <<EOF
# arknights-$GROUP

Assets do grupo \`$GROUP\`, extraidos do servidor EN do Arknights.

- Fonte: bundles do jogo, baixados com o [arkprts](https://github.com/thesadru/arkprts)
  e extraidos com UnityPy (com o decodificador LZ4AK que o arkprts registra).
- Carga: tudo em \`$GROUP/\`.
- Atualizacao: \`.github/workflows/update.yml\`, diaria. O estado incremental fica em
  \`.state/$GROUP.json\` e so bundles novos ou com hash diferente sao reprocessados.
- Atualizacao manual:

\`\`\`bash
python -m pip install "arkprts[all]" lameenc
python tools/assets_sync.py --groups $GROUP --out . --state .state
python tools/assets_sync.py --verify --out .
\`\`\`

Formato do audio: MP3, 96 kbps mono para voz e 160 kbps para estereo (musica). O
UnityPy entrega o audio ja decodificado em WAV PCM, cerca de 10x maior que a origem,
o que inviabiliza o repositorio; use \`--audio-format original\` para manter o WAV.
EOF

echo "materializado: $DEST"
ls -la "$DEST"

if [ "$DO_INIT" = "--init" ]; then
  cd "$DEST"
  if [ ! -d .git ]; then
    git init -q -b main
    git add -A
    git -c user.email=bot@local -c user.name=bot commit -q -m "estrutura inicial do repositorio de assets ($GROUP)"
  fi
  if [ -n "$REMOTE" ]; then
    git remote remove origin 2>/dev/null || true
    git remote add origin "$REMOTE"
    echo "remoto configurado: $REMOTE"
    echo "para publicar: (cd $DEST && git push -u origin main)"
  fi
fi
