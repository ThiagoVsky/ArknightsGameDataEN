# Repositorios de assets

As pastas de `assets/` sao o material dos repositorios separados de midia. Cada uma
vira um repositorio proprio, para nao estourar o limite de tamanho do repositorio
principal (o GitHub recomenda ate 1 GB por repositorio, com teto de 2 GB).

O texto e o JSON do jogo (gamedata, story, lua) **nao** entram aqui: isso ja vive no
repositorio principal, e o sincronizador descarta TextAsset por definicao.

## Grupos

| grupo | repositorio sugerido | conteudo | download |
|---|---|---|---|
| `voice-jp` | `arknights-voice-jp` | voz japonesa, por personagem | 1.158 GiB |
| `voice-cn` | `arknights-voice-cn` | voz em mandarim | 0.868 GiB |
| `voice-en` | `arknights-voice-en` | voz inglesa | 1.014 GiB |
| `voice-kr` | `arknights-voice-kr` | voz coreana | 1.148 GiB |
| `voice-custom` | `arknights-voice-custom` | vozes customizadas e topolectos por personagem | 0.148 GiB |
| `sound` | `arknights-sound` | musica, efeitos, ambiencia e sons de inimigo (sem voz) | 1.492 GiB |
| `en` | `arknights-assets-en` | todos os dados do servidor EN que nao sao audio | 10.189 GiB |

Total: 14.233 bundles, 16.017 GiB de download. Os tamanhos sao do manifesto do servidor
(`totalSize`) e valem para o download; o material extraido e maior, e no `en` a
diferenca e grande porque texturas comprimidas viram PNG.

### Sobre o `en`

O grupo `en` e o unico grande o bastante para provavelmente nao caber em um repositorio
so, e o unico cujo tamanho extraido e bem maior que o baixado. Se ele passar de ~1 GB, o
caminho natural e dividi-lo em um repositorio por categoria do manifesto, reaproveitando
o mesmo mecanismo: basta desdobrar o grupo em `en-arts`, `en-avg`, `en-spritepack`,
`en-scenes`, `en-ui`, `en-battle`, `en-building`, `en-charpack` e assim por diante,
usando o prefixo do nome do bundle como `match`. O `tools/assets_sync.py` ja aceita
qualquer grupo definido no dicionario `GROUPS`.

## Por que a divisao e assim

- **Voz por idioma**: em `audio/sound_beta_2/` existem as subarvores `voice/` (o conjunto
  japones, o unico sem sufixo), `voice_cn/`, `voice_en/`, `voice_kr/` e `voice_custom/`.
  Cada uma e um conjunto independente e grande o bastante para justificar um repositorio.
  O servidor EN serve todos os idiomas, entao baixar so do EN ja cobre o pedido de "todos
  os idiomas de voz".
- **Som separado da voz**: tudo o mais em `audio/` (musica 502 bundles, `player/` 33,
  efeitos `avg_se_*`, `enmy_snd_*`, ambiencia) nao e voz e forma o grupo `sound`.
  O criterio e o prefixo do caminho, nao a presenca da palavra "voice" no nome: existem
  arquivos de musica com "voice" no nome, como `m_bat_failed_intro_voice.ab`.
- **Resto dos dados do servidor EN**: um grupo que espelha a arvore `dyn/...` do jogo,
  como no repositorio [ArknightsAssets2](https://github.com/ArknightsAssets/ArknightsAssets2)
  faz no branch `en`.

## Publicar cada repositorio

```bash
# materializa script, workflow, README e .gitignore dentro de assets/<grupo>/
tools/asset-repos/bootstrap.sh voice-en

# ou ja deixando pronto para publicar, com o remoto configurado
tools/asset-repos/bootstrap.sh voice-en git@github.com:ThiagoVsky/arknights-voice-en.git --init
cd assets/voice-en && git push -u origin main
```

Cada repositorio gerado traz o proprio `.github/workflows/update.yml`, com cron diario e
estado incremental em `.state/<grupo>.json`. O workflow roda o mesmo
`tools/assets_sync.py`, entao a logica de download e extracao tem um lugar so.

## Estado do download

O download e retomavel: o estado fica em `.state/<grupo>.json` e bundles ja processados
com o mesmo hash sao pulados. Para inspecionar:

```bash
python tools/assets_sync.py --verify --out assets
```
