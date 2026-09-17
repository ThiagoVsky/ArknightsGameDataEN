# AGENTS.md

Guidance for agents and for anyone working in this repository.

## What this repository is

A dump of Arknights English game data and media assets, plus the tooling that keeps it
fresh. Three things live here and they have different rules:

1. **Game data** under `en/`, refreshed by a workflow. Machine output. Never hand-edit it.
2. **Tooling** under `tools/` and `.github/workflows/`. This is source code, and it is
   where changes belong.
3. **Media assets** under `assets/`, present here only as git submodules pointing at the
   seven repositories below. Their payload is never committed in this repository.

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
| `en` | [arknights-assets-en](https://github.com/ThiagoVsky/arknights-assets-en) | Everything else from the EN server that is not audio or text |

Each of those repositories carries its own copy of `tools/assets_sync.py`, its own daily
workflow and its own `AGENTS.md`, and populates itself from the game CDN.

`assets/<group>` is registered here as a **git submodule**, so GitHub renders the folder
with a link to each repository and this repository records the exact commit each one is
on. Practical consequences:

- A fresh clone needs `git submodule update --init` before `assets/` has content.
- The recorded commit goes stale whenever that repository's workflow publishes.
  `.github/workflows/update-submodules.yml` refreshes the pointers daily, and
  `git submodule update --remote` does the same by hand.
- The checkouts under `assets/` are ordinary clones: work in them and push from them.
  This repository only tracks which commit each one is on.

## Branches

- `master`: the default branch and the data branch. It carries `en/`, the tooling and the
  asset submodule pointers.
- `EN`: holds the same English data. **No workflow writes to it any more**, so it drifts
  from `master` on every update. Retire it or merge from `master`; that decision is open.

The five non-English server directories (`bili/ cn/ jp/ kr/ tw/`) are absent on purpose.
Nothing in this repository should ever bring them back: see the traps below, because both
the data workflow and a merge with the upstream repository can do it by accident.

This branch is **not** a mirror of
[ArknightsAssets/ArknightsGamedata](https://github.com/ArknightsAssets/ArknightsGamedata).
Data arrives from the game servers directly, and upstream is not synced.

## Workflows

| Workflow | Schedule | Purpose |
|---|---|---|
| `.github/workflows/update.yml` | 12:00 UTC | Refreshes the EN gamedata text and JSON from the game servers |
| `.github/workflows/update-submodules.yml` | 05:10 UTC | Bumps the asset submodule pointers |

The asset repositories run their own `update.yml` at 04:23 UTC.

Why 12:00 UTC for the data: updates usually land around 06:00 UTC, and a major one keeps
the game servers closed until about 10:00, with delays possible. Noon leaves room for that
while still being the same day. The asset repositories still update at 04:23, which is
before that window, so on a major update day they pick the new content up a day later.

**Scheduled workflows only run from the default branch**, which is `master`, and this
repository is a fork: GitHub suppresses scheduled workflows in forks until a human enables
them in the Actions tab. As of this writing the repository has zero workflow runs ever.

## How the data update works

`update.yml` calls `python -m arkprts.assets . --server en`. Incremental behaviour comes
from `en/hot_update_list.json` being committed: arkprts compares it against the server's
own manifest and downloads only the bundles whose hash changed. Therefore:

- Do not delete `en/hot_update_list.json`, and do not pass `--force`, which discards the
  mechanism and re-downloads everything.
- The updater only ever writes. It downloads the outdated bundles, extracts them, and
  saves the new manifest. There is no deletion path, which is why the 33 story files listed
  in `tools/preserved_files.txt`, absent upstream but kept here, survive every run.
- Extraction failures are reported in the run summary and fail the job.

## Tools

| Path | Purpose |
|---|---|
| `tools/assets_sync.py` | Downloads and extracts the media assets from the EN game server, grouped per repository. Incremental and resumable, keyed by bundle name and hash. |
| `tools/resume_en_assets.sh` | Finishes the `en` asset group, fetching only what is missing. Single-instance lock, `DRY_RUN=1`, `LIMIT`, `REFRESH`, `CONCURRENCY`. |
| `tools/preserved_files.txt` | The 33 story files this repository keeps and upstream does not have. A record now, not an input, since the upstream sync was removed. |
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
- Do not hand-edit anything under `en/`. If the data is wrong, the problem is upstream at
  the game server or in the extraction, not in the file.
- Never commit asset payload here. The seven repositories own their contents; this one
  records which commit each is on.
- Anything you change in `tools/assets_sync.py` should be propagated to the asset
  repositories through `bootstrap.sh`, since they carry copies.
- A submodule directory with a dirty working tree is normal here, because the checkouts
  hold payload that is not committed. Do not "clean" it with a reset.

## Data freshness

- The fork's Actions have never run, so nothing updates by itself yet. Data arrives when
  the workflows are enabled and run, or by hand.
- Version markers, useful when checking staleness: `en/gamedata/excel/data_version.txt`
  (a `VersionControl` line), `fbs_version.txt` (three flatbuffer schema commit hashes) and
  `en/hot_update_list.json` (the full server manifest with a hash per bundle).
- `en/i18n/string_map.txt` and `en/config/` are part of the dump and are not under
  `en/gamedata/`, despite occasional claims to the contrary.

## Traps worth knowing

Real defects already hit here, in case you touch the extraction, download or repository
layout code:

- **A merge with the upstream repository is not equivalent to a path-based sync for the
  directories that were deleted.** Resolving the 30 `modify/delete` conflicts, 15 in
  `bili/` and 15 in `cn/`, does not cover files upstream added *after* the fork point:
  for git those are additions on their side and they land in the tree anyway. Measured
  when this branch merged upstream: 20 files came back that way. The data workflow never
  has this problem because it writes inside `en/` only.
- `arkprts`'s own extractor handles **only** `TextAsset`, so it never produces images or
  audio by design. The download layer uses arkprts; media extraction uses UnityPy, which
  arkprts itself depends on.
- UnityPy cannot decompress the LZHAM bundles the game ships. arkprts registers an LZ4AK
  decompressor in `CompressionHelper.DECOMPRESSION_MAP`, and that must happen before any
  `UnityPy.load`.
- `obj.container` is a **string** in UnityPy 1.25, not a list.
- `AudioClip.m_AudioData` is usually `None`; audio lives in the bundle's `.resource` and
  is read through `clip.samples`, which returns `{name: bytes}` already decoded to WAV.
- Do not hunt processes with `pgrep -f` using a pattern that appears in the command line
  of the search itself: the match includes the shell running it and kills it. The asset
  scripts use pid files for this reason.
- The `assets_sync.py` progress counters measure extraction events, not distinct files or
  bytes on disk: the log reported 11,220 files and 0.52 GiB where the disk held 7,879
  files and 1.4 GB. Trust `du` and `find` for size questions.
