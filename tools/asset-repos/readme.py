#!/usr/bin/env python3
"""Gera o README em ingles de um repositorio de assets.

Uso: readme.py <grupo>

Fica em Python, e nao em heredoc de shell, porque o README tem crases de markdown que
o shell tentaria interpretar como substituicao de comando.
"""

from __future__ import annotations

import sys

REPO_URL = "https://github.com/ThiagoVsky/ArknightsGameDataEN"

INFO: dict[str, dict[str, str]] = {
    "voice-jp": {
        "title": "Arknights operator voice lines, Japanese (JP)",
        "source": "audio/sound_beta_2/voice/** on the EN game server",
        "layout": (
            "One directory per voice pack. Operator packs are `char_<operator_id>/`, holding "
            "that operator's clips as `cn_001.mp3`, `cn_024.mp3` and so on. Non-operator packs "
            "are `extra_<n>/`.\n\n"
            "The clip numbers are the game's own dialogue keys, so `char_002_amiya/cn_004.mp3` "
            "is what `charword_table.json` in ArknightsGameDataEN calls `CN_004`, and the folder "
            "name matches the `charId` used across that repository's tables."
        ),
        "format": "MP3, 96 kbps mono",
        "note": (
            "This is the set the game stores without a language suffix under `voice/`, which is "
            "the Japanese one. The other languages live in the sibling repositories "
            "`arknights-voice-cn`, `arknights-voice-en` and `arknights-voice-kr`."
        ),
    },
    "voice-cn": {
        "title": "Arknights operator voice lines, Chinese (Mandarin)",
        "source": "audio/sound_beta_2/voice_cn/** on the EN game server",
        "layout": (
            "One directory per voice pack. Operator packs are `char_<operator_id>/`, holding "
            "that operator's clips as `cn_001.mp3`, `cn_024.mp3` and so on. Non-operator packs "
            "are `extra_<n>/`.\n\n"
            "The clip numbers are the game's own dialogue keys, matching `charword_table.json` "
            "in ArknightsGameDataEN."
        ),
        "format": "MP3, 96 kbps mono",
        "note": (
            "The game data refers to this set as `CN_MANDARIN` in the `voiceLangDict` field of "
            "`charword_table.json`."
        ),
    },
    "voice-en": {
        "title": "Arknights operator voice lines, English",
        "source": "audio/sound_beta_2/voice_en/** on the EN game server",
        "layout": (
            "One directory per voice pack. Operator packs are `char_<operator_id>/`, holding "
            "that operator's clips as `cn_001.mp3`, `cn_024.mp3` and so on. Non-operator packs "
            "are `extra_<n>/`.\n\n"
            "The clip numbers are the game's own dialogue keys, matching `charword_table.json` "
            "in ArknightsGameDataEN; the `cn_` prefix is an artefact of the original recording "
            "order and does not indicate the Chinese set."
        ),
        "format": "MP3, 96 kbps mono",
        "note": (
            "The EN server ships every voice language, so this set is complete even though the "
            "download source is the EN server."
        ),
    },
    "voice-kr": {
        "title": "Arknights operator voice lines, Korean",
        "source": "audio/sound_beta_2/voice_kr/** on the EN game server",
        "layout": (
            "One directory per voice pack. Operator packs are `char_<operator_id>/`, holding "
            "that operator's clips as `cn_001.mp3`, `cn_024.mp3` and so on. Non-operator packs "
            "are `extra_<n>/`.\n\n"
            "The clip numbers are the game's own dialogue keys, matching `charword_table.json` "
            "in ArknightsGameDataEN."
        ),
        "format": "MP3, 96 kbps mono",
        "note": (
            "The game data refers to this set as `KR` in the `voiceLangDict` field of "
            "`charword_table.json`."
        ),
    },
    "voice-custom": {
        "title": "Arknights custom and topolect voice lines",
        "source": "audio/sound_beta_2/voice_custom/** on the EN game server",
        "layout": (
            "One file per pack rather than a directory per operator: "
            "`char_<operator_id>_<language>_topolect.mp3` for the regional-language tracks, for "
            "example `char_010_chen_cn_topolect.mp3`, and `extra_custom_<n>.mp3` for the rest.\n\n"
            "These are the regional and collaboration voice tracks that the game keeps outside "
            "the four main language sets."
        ),
        "format": "MP3, 96 kbps mono",
        "note": (
            "The corresponding entries appear in `charword_table.json` under keys such as "
            "`char_010_chen_CN_TOPOLECT`."
        ),
    },
    "sound": {
        "title": "Arknights sound effects and music",
        "source": "audio/** on the EN game server, excluding every voice set",
        "layout": (
            "Grouped by the game's own layout:\n\n"
            "- `music/<event>/<track>.mp3`: the soundtrack, including event and battle themes.\n"
            "- `player/`: player character and interface sounds.\n"
            "- `avg_se_<n>/`: story and cutscene effects.\n"
            "- `enmy_snd_<type>_<n>/`: enemy sounds.\n"
            "- `ambience/`, `general_<n>/`, `vox/`, `cnstrct_snd_<n>/`: ambience and assorted "
            "effect banks.\n"
            "- `custom_se/`: effects belonging to specific game modes.\n\n"
            "Each directory holds the individual clips of that bank."
        ),
        "format": "MP3, 96 kbps mono for effects and 160 kbps for stereo music",
        "note": (
            "The split from the voice repositories is by path, not by filename: there are music "
            "tracks with `voice` in the name, such as `m_bat_failed_intro_voice`, which belong "
            "here rather than in a voice repository."
        ),
    },
    "en": {
        "title": "Arknights game assets, EN server",
        "path": "dyn/**",
        "source": "every bundle on the EN game server that is not audio and not already text",
        "layout": (
            "Mirrors the game's own `dyn/` tree, so paths match the container names inside the "
            "bundles:\n\n"
            "- `arts/`: operator art, avatars, map art and character portraits.\n"
            "- `avg/`: story backgrounds, key visuals and animated key art.\n"
            "- `chararts/` and `skinpack/`: operator and skin texture sets.\n"
            "- `spritepack/` and `ui/`: interface sprites and panels.\n"
            "- `charpack/`, `battle/`, `building/`, `cutin/`, `prefabs/`, `retro/`, `activity/`: "
            "mode specific art and prefabs.\n"
            "- `raw/`: video files, kept as the original `.usm` because they are not Unity "
            "bundles.\n\n"
            "Bundles whose only content is meshes, prefabs, shaders or materials are kept as "
            "the raw `.ab` file, so those paths contain `.ab` rather than `.png`."
        ),
        "format": "PNG for textures and sprites, raw `.ab` for bundles with nothing extractable",
        "note": (
            "Text and JSON are excluded on purpose: the gamedata, story and Lua dumps already "
            "live in ArknightsGameDataEN, so this repository holds only what that repository "
            "does not."
        ),
    },
}


def main() -> int:
    if len(sys.argv) < 2 or sys.argv[1] not in INFO:
        print(f"uso: {sys.argv[0]} <{'|'.join(INFO)}>", file=sys.stderr)
        return 1
    group = sys.argv[1]
    info = INFO[group]
    # o caminho de origem vira code span sozinho e o resto vira texto simples
    path = info.get("path") or info["source"].split(" on ")[0]
    origin = info["source"][len(path):].strip() or info["source"]
    print(
        f"""# {info['title']}

Game assets from Arknights, extracted from the **EN** game server. This repository is
generated and refreshed by machine; do not edit its contents by hand.

## What is here

Source: `{path}` {origin}.

{info['layout']}

## Format

{info['format']}

{info['note']}

## Updating

`.github/workflows/update.yml` runs once a day. Incremental state lives in
`.state/{group}.json`, so only bundles that are new or whose hash changed are downloaded
and extracted again; a rerun with nothing new is a no-op.

Run it locally:

```bash
python -m pip install "arkprts[all]" lameenc
python tools/assets_sync.py --out . --flat --state .state
python tools/assets_sync.py --verify --out . --flat
```

`tools/assets_sync.py` in this repository is a self-contained copy whose default group is
`{group}`. The canonical copy lives in [ArknightsGameDataEN]({REPO_URL}) under
`tools/assets_sync.py`; the download uses
[arkprts](https://github.com/thesadru/arkprts) and the extraction uses
[UnityPy](https://github.com/K0lb3/UnityPy) with the LZ4AK decompressor that arkprts
registers in place of the LZHAM that UnityPy does not implement.
"""
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
