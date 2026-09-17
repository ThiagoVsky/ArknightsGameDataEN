# AGENTS.md

Guidance for agents and for anyone working in this repository.

## What this repository is

A dump of Arknights game data and assets, plus the tooling that keeps it fresh. Three
things live here and they have different rules:

1. **Game data** under `en/`. Machine output, refreshed from the game servers. Never
   hand-edit it.
2. **Tooling** under `tools/` and `.github/workflows/`. This is source code, and it is
   where changes belong.
3. **Media assets** under `assets/`, which are *not* meant to be committed here. See the
   next section.

## The seven asset repositories

The media assets are far too large for one repository, so each group lives in its own:

| Group | Repository | Contents |
|---|---|---|
| `voice-jp` | [arknights-voice-jp](https://github.com/ThiagoVsky/arknights-voice-jp) | Japanese operator voice lines |
| `voice-cn` | [arknights-voice-cn](https://github.com/ThiagoVsky/arknights-voice-cn) | Mandarin voice lines |
| `voice-en` | [arknights-voice-en](https://github.com/ThiagoVsky/arknights-voice-en) | English voice lines |
| `voice-kr` | [arknights-voice-kr](https://github.com/ThiagoVsky/arknights-voice-kr) | Korean voice lines |
| `voice-custom` | [arknights-voice-custom](https://github.com/ThiagoVsky/arknights-voice-custom) | Regional and topolect voice tracks |
| `sound` | [arknights-sound](https://github.com/ThiagoVsky/arknights-sound) | Music, effects, ambience, enemy sounds |
| `en` | [arknights-assets-en](https://github.com/ThiagoVsky/arknights-assets-en) | Everything else from the EN server |

Each of those repositories carries its own copy of `tools/assets_sync.py`, its own daily
workflow and its own `AGENTS.md`. They populate themselves from the game CDN, so this
repository does not need to push their contents. `assets/` here is a working copy used
for inspection and analysis, and is kept out of git by `.gitignore`.

## Branches

- `EN`: the curated English data branch. This is where the data that matters lives, and
  the base for data-side changes.
- `master`: a pure mirror of the upstream repository, `ArknightsAssets/ArknightsGamedata`.
  It carries all six server dumps. It has no local commits, so it can always be
  fast-forwarded.
- The five non-English server directories (`bili/ cn/ jp/ kr/ tw/`) exist on `master`
  only. `EN` deliberately removed them.

## Workflows, all on a 24 hour cron

| Workflow | Schedule | Purpose |
|---|---|---|
| `.github/workflows/update.yml` | 03:17 UTC | Refreshes the gamedata text and JSON from the game servers |
| `.github/workflows/sync-upstream.yml` | 02:42 UTC | Brings the upstream parent repository into `EN`, without merging |

The asset repositories run their own `update.yml` at 04:23 UTC.

### Why the upstream sync does not merge

`tools/sync_upstream.sh` copies `en/` and `fbs_version.txt` from upstream instead of
merging, because a merge is both conflict-ridden and destructive here. Measured
behaviour, worth not rediscovering:

- A merge of `upstream/master` into `EN` produces 30 `modify/delete` conflicts, all in
  `bili/` and `cn/`, because `EN` removed those directories while upstream keeps changing
  them. None of the conflicts are in `en/`.
- Upstream **deletes files inside `en/`**, and a merge applies those deletions silently.
  This repository restored 33 such files, listed in `tools/preserved_files.txt`. A plain
  merge would delete them again.
- A GitHub "Sync fork" is not possible either, because `EN` has local commits.

The script therefore keeps the 33 preserved files, records the upstream commit in the
commit message, and is idempotent: a second run with nothing new does nothing.

## Tools

| Path | Purpose |
|---|---|
| `tools/sync_upstream.sh` | Incremental upstream sync into `EN`, with the preserved-file manifest. Supports `DRY_RUN=1`. |
| `tools/preserved_files.txt` | Files upstream no longer has but this repository keeps on purpose. Add to it when restoring anything from upstream. |
| `tools/assets_sync.py` | Downloads and extracts media assets from the EN game server, grouped per repository. Incremental and resumable. |
| `tools/asset-repos/README.md` | The asset group split, sizes and how to publish a group. |
| `tools/asset-repos/bootstrap.sh` | Materialises a group folder with its README, AGENTS.md, script and workflow. |
| `tools/asset-repos/readme.py`, `agents.py` | Generate the per-repository README and AGENTS.md from one description per group. |
| `tools/asset-repos/create-repos.sh` | Creates the seven GitHub repositories and publishes their scaffolding. Idempotent, has `--dry-run`. |
| `tools/asset-repos/publish.sh` | Publishes a group payload in batches under GitHub's push limit. Usually unnecessary, since the per-repository workflows do it. |

## Conventions

- **All code comments, docstrings, commit messages and documentation must be written in
  English.** This applies to this repository and to all seven asset repositories.
  Portuguese text that already exists is legacy: do not rewrite it as part of an
  unrelated change, and do not translate it opportunistically.
- Do not hand-edit anything under `en/`. If the data is wrong, the fix is upstream or in
  the sync, not in the file.
- Do not commit `assets/`. Its contents belong in the seven repositories above.
- Anything you change in `tools/assets_sync.py` should be propagated to the asset
  repositories through `bootstrap.sh`, since they carry copies.
- Run `DRY_RUN=1 bash tools/sync_upstream.sh` before trusting a sync change.

## Data freshness

- This fork's own Actions have never run upstream's updater, so nothing here updates by
  itself. Data arrives when `sync-upstream.yml` runs, or by hand.
- Upstream is [ArknightsAssets/ArknightsGamedata](https://github.com/ArknightsAssets/ArknightsGamedata),
  which regenerates the dump continuously and authored the `update.yml` this repository
  inherited.
- Version markers, useful when checking staleness: `en/gamedata/excel/data_version.txt`
  (a `VersionControl` line), `fbs_version.txt` (three flatbuffer schema commit hashes) and
  `en/hot_update_list.json` (the full server manifest with a hash per bundle).
- `en/i18n/string_map.txt` and `en/config/` are part of the dump and are not under
  `en/gamedata/`, despite occasional claims to the contrary.

## Traps worth knowing

Real defects already hit here, in case you touch the extraction or download code:

- `arkprts`'s own extractor handles **only** `TextAsset`, so it never produces images or
  audio by design. The download layer uses arkprts; media extraction uses UnityPy, which
  arkprts itself depends on.
- UnityPy cannot decompress the LZHAM bundles the game ships. arkprts registers an LZ4AK
  decompressor in `CompressionHelper.DECOMPRESSION_MAP`, and that must happen before any
  `UnityPy.load`.
- `obj.container` is a **string** in UnityPy 1.25, not a list.
- `AudioClip.m_AudioData` is usually `None`; audio lives in the bundle's `.resource` and
  is read through `clip.samples`, which returns `{name: bytes}` already decoded to WAV.
- The incremental behaviour of the inherited updater was disabled by `--force`, and the
  mechanism depends on `hot_update_list.json` being committed.
