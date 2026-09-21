# Arknights Data Mapping

This document details the structure and generic relationships between the data files in this repository. All data resides within `en/gamedata/` and consists entirely of text and JSON files. **There are no binary files (images, audio, etc.) in this repository.** Asset paths discovered in the data represent conventions used by the game engine to locate external assets.

## Directory Structure and Contents

The `en/gamedata/` directory contains 1 loose file (`buff_table.json`, 127KB) and 8 subdirectories:

1. **`excel/`** (56 files, 168M): The primary relational metadata tables defining core game entities (Characters, Items, Stages, Zones, etc.).
2. **`levels/`** (3,154 files, 265M): Contains the individual JSON map layouts and wave spawn data for every stage. It also contains the `enemydata/enemy_database.json` (15M) which defines enemy stats.
3. **`story/`** (5,128 files, 76M): Text scripts that dictate narrative events, dialogue, and asset loading instructions. This is split into distinct subtrees:
    * `obt/` (1,485 files): Full scripted dialogue for main line stages.
    * `activities/` (1,761 files): Full scripted dialogue for event/activity stages.
    * `[uc]info/` (1,881 files): Contains condensed prose synopses of stories. This is a distinct synopsis tree (constituting 36.7% of story files) and is out-of-scope for the web application's story view.
    * 1 loose file: `story_variables.json`.
4. **`[uc]lua/`** (429 files, 2.6M): Contains the Lua runtime and scripts.
5. **`battle/`** (7 files, 31M): Core battle configuration files.
6. **`art/`** (5 files, 504K): Contains handbook/art related table files (e.g. `handbookcard_table.json`). Some of these tables are duplicated elsewhere; `excel/` is generally authoritative.
7. **`building/`** (2 files, 1.3M): Base/infrastructure data files.
8. **`levelscripts/`** (3 files, 56K): Small scripting files for level-specific behavior.

## JSON Structural Shapes (`excel/` tables)

The JSON tables driving the game's metadata generally follow four distinct structural shapes. Understanding these is crucial for accurately parsing and extracting entities.

1. **Flat Entity Map (Keyed by ID):**
   * The top-level object directly contains the entities, where the key is the entity ID (e.g., `char_102_texas`).
   * *Examples:* `character_table.json`, `chapter_table.json`, `handbook_table.json`.
2. **Flat Entity Map (Bracketed IDs):**
   * Similar to the flat map, but the top-level keys include brackets (e.g., `skcom_charge_cost[1]`).
   * *Examples:* `skill_table.json`.
3. **Section Container Map:**
   * The top-level object contains organizational sections (e.g., `"items"`, `"zones"`). The actual entities are nested inside these section dictionaries.
   * *Examples:* `item_table.json`, `zone_table.json`, `skin_table.json`, `charword_table.json`, `uniequip_table.json`, `roguelike_table.json`.
4. **Pre-specialcased/Nested Arrays:**
   * Custom structures where entities might be in an array or deeply nested under specific keys (e.g., the `"stages"` dictionary inside `stage_table.json`).

## Core Entity Link Graph

The tables form a highly interconnected graph. Here are the verified primary edges:

* **Characters (`character_table.json`)**
  * `skills[].skillId` links to `skill_table.json`.
* **Stages (`stage_table.json`)**
  * `stages[].levelId` links directly to a map file in the `levels/` directory. (e.g., `levelId` "Obt/Main/level_main_00-01" maps to `en/gamedata/levels/obt/main/level_main_00-01.json`).
  * `stages[].zoneId` links to `zone_table.json`.
  * `stages[].stageId` dictates the narrative story filename. The naming convention for a story file is `level_[stageId]_beg.txt` or `_end.txt` (e.g., stage `main_00-01` links to `level_main_00-01_beg.txt`).
* **Zones and Chapters (`zone_table.json`, `chapter_table.json`)**
  * Entries in `zone_table.json` map back to `chapter_table.json` via the `startZoneId` and `endZoneId` fields within a chapter definition.

## Asset Linkage (External Conventions)

As noted, this repository contains zero image or audio files. However, the `story/` text files contain script commands in brackets that imply the loading of specific assets. These are external naming conventions:

* **Character Sprites:** `[Character(name="char_002_amiya")]` implies a convention like `char_002_amiya.png`.
* **Backgrounds:** `[Background(image="bg_cher_1")]` implies a convention like `bg_cher_1.png`.
* **Audio:** `[PlayMusic(key="m_bat_cher")]` implies an audio file convention.
