# Arknights Data Mapping

This document provides a generic mapping of the relationships between the data and asset files in this repository. The main source of data comes from the JSON files located within the `en/gamedata/excel/` directory. These files define the properties of various entities, and also serve as a linkage to other tables and external binary assets.

## Core Entity Relationships

### 1. Characters (`character_table.json`)
Characters are central entities, usually keyed by a character ID like `char_102_texas` or `char_002_amiya`.
- **Skills**: Each character entity links to their skill data using a `skillId` which is further defined in `skill_table.json`.
- **Voice Lines / Audio**: Characters have voice lines and sound effects, mapped through references that would correspond to audio assets (e.g., `audio/voice/[char_id]/...`).
- **Story / Assets**: Characters appear in the story. They are mapped to visual assets via story text files (e.g., `[Character(name="char_102_texas")]`).
- **Base Skills**: Characters also have skills for the base, linking them to data in `building_data.json`.

### 2. Stages (`stage_table.json`)
Stages are where gameplay happens. They are defined under the `"stages"` key in the table, with keys like `main_00-01` or `sub_01-01`.
- **Level Data**: The field `levelId` refers to a specific map layout. A stage might have a `levelId` of `Levels/obt/main/level_main_00-01`, which maps directly to the file `en/gamedata/levels/obt/main/level_main_00-01.json`. This JSON dictates the map width, height, tile properties, and enemy wave spawn information.
- **Story Data**: Stages often have stories that precede or follow the battle. This is linked by the stage ID to the files in `en/gamedata/story/`. Typically, you'll see a file like `[stageId]_beg.txt` (before battle) and `[stageId]_end.txt` (after battle).
- **Item Rewards**: Stages define item drops using `itemId`s, linking to definitions in `item_table.json`.
- **Enemies**: Stages list enemies that appear on the map, mapping to IDs found in `enemy_database.json` and `enemy_handbook_table.json`.

### 3. Items and Rewards (`item_table.json`)
Items are the resources and materials in the game. They are keyed by a unique numeric or string ID (e.g., `4001`, `30011`).
- **Acquisition**: Stages map back to items by declaring which item IDs can drop upon completion.
- **Crafting**: Items link to other items via crafting recipes, which require base materials (other `itemId`s) to produce a higher-tier `itemId`.

## External Binary Asset Linkage (Generic Map)

This repository contains primarily text and JSON data, but these files form a rigid structure that points to the location and name of external binary files (such as images and audio).

### Story Text Files -> Visual & Audio Assets
The story files located in `en/gamedata/story/` contain command blocks that tell the game engine which assets to load.
- **Character Sprites**: Commands like `[Character(name="char_002_amiya")]` explicitly map the text data to a sprite image file named `char_002_amiya.png` (or similar format) located in the game's sprite asset folder. Additional tags like `name2` or variations define specific expressions or skins.
- **Backgrounds**: Commands like `[Background(image="bg_cher_1")]` map to background image assets (`bg_cher_1.png`).
- **Audio**: Commands like `[PlayMusic(key="m_bat_cher")]` or `[PlaySound(key="ui_click")]` map to `.ogg` or `.wav` files in the external audio asset banks.

### UI and Icons
- **Skill Icons**: `skill_table.json` contains `iconId`s. An `iconId` like `skill_icon_amiya_1` maps to an image file `skill_icon_amiya_1.png` used in the UI.
- **Item Icons**: `item_table.json` contains `iconId`s for items, mapping to their respective icon images (e.g., `item_4001.png`).
- **Character Portraits**: Similar to sprites, character IDs map to portrait and avatar icons used in menus (e.g., `avatar_char_102_texas.png`).

## Summary of Data Flow

1. **JSON Tables (Metadata)**: The absolute source of truth. They define the IDs, stats, properties, and the linkage to other IDs.
2. **Level JSONs (Gameplay Mechanics)**: They dictate the layout and flow of a stage, referencing enemy IDs and map tiles.
3. **Story Text Files (Narrative Scripting)**: They link the gameplay progression (Stages) to the visual and auditory experience (Binary Assets).
4. **Binary Assets (External)**: The images, audio, and video files whose existence and names are dictated by the identifiers in the JSON and text files.
