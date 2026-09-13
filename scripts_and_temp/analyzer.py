import os
import json
import traceback

DATA_DIR = "en/gamedata"
EXCEL_DIR = os.path.join(DATA_DIR, "excel")
LEVELS_DIR = os.path.join(DATA_DIR, "levels")
STORY_DIR = os.path.join(DATA_DIR, "story")
OUTPUT_INDEX = "webapp/data_index.json"
OUTPUT_KEYS = "scripts_and_temp/extracted_data.txt"
OUTPUT_RELATIONS = "scripts_and_temp/relations.txt"

# Tables we want to actively include in the frontend
# We include all 55 from excel
ALLOWED_TABLES = [
    "activity_table", "audio_data", "battle_equip_table", "building_data", "campaign_table",
    "chapter_table", "char_master_table", "character_table", "charm_table", "charword_table",
    "clue_data", "crisis_table", "crisis_v2_table", "cross_table", "display_meta_table",
    "enemy_handbook_table", "favor_table", "gacha_table", "gamedata_const", "handbook_info_table",
    "handbook_team_table", "hotupdate_meta_table", "init_text", "item_table", "main_text",
    "medal_table", "meta_ui_table", "mission_table", "ob_table", "open_server_table",
    "player_avatar_table", "range_table", "replicate_table", "retro_table", "rlv2_table",
    "roguelike_topic_table", "sandbox_table", "sandbox_perm_table", "shop_client_table",
    "skill_table", "skin_table", "stage_table", "story_review_meta_table", "story_review_table",
    "story_table", "tech_buff_table", "tip_table", "token_table", "uniequip_table", "zone_table",
    "activity_perm_table", "checkin_table", "daily_table", "handbook_table", "monthly_squad_table"
]

def get_file_metadata(filepath):
    stat = os.stat(filepath)
    return {
        "file": os.path.basename(filepath),
        "dir": os.path.dirname(filepath).replace(DATA_DIR + "/", ""),
        "size": stat.st_size,
        "mtime": stat.st_mtime
    }

def analyze():
    print("Starting analysis...")
    index_data = {}
    key_inventory = {}
    relations = {}

    stats = {"parsed": 0, "skipped": 0, "failed": 0}

    # Pre-calculate available story files (ignoring [uc]info)
    available_stories = {}
    for root, dirs, files in os.walk(STORY_DIR):
        if "[uc]info" in root:
            continue
        for file in files:
            if file.endswith(".txt"):
                name = file.replace(".txt", "")
                available_stories[name] = os.path.join(root, file).replace(DATA_DIR + "/", "")

    # Iterate exactly over excel tables
    for root, dirs, files in os.walk(EXCEL_DIR):
        for file in files:
            if not file.endswith(".json"): continue

            table_name = file.replace(".json", "")
            filepath = os.path.join(root, file)

            if table_name not in ALLOWED_TABLES:
                # Add to ALLOWED_TABLES dynamically if we missed any, just in case, but keep track
                pass

            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                entities_to_index = []

                # Determine structural shape
                is_dict = isinstance(data, dict)
                if not is_dict:
                    print(f"Skipping {file}: Root is not a dictionary.")
                    stats["skipped"] += 1
                    continue

                keys = list(data.keys())
                if not keys:
                    stats["skipped"] += 1
                    continue

                first_key = keys[0]
                first_val = data[first_key]

                # Shape 3: Section Container Map (e.g. item_table.json has "items", "expItems")
                # Or Shape 4: Nested Array (e.g. stage_table has "stages")
                # Heuristic: If the top level values are dicts, AND the first key is a short alphanumeric word
                # AND the inner keys look like IDs, we might need to dig.
                # Actually, let's explicitly handle the containers based on known structure.

                container_tables = ["item_table", "zone_table", "skin_table", "charword_table", "uniequip_table", "roguelike_table", "stage_table", "activity_table", "retro_table", "sandbox_table"]

                if table_name in container_tables:
                    # Look for the primary inner dict.
                    # stage_table -> stages
                    # item_table -> items
                    # zone_table -> zones
                    # skin_table -> charSkins
                    # charword_table -> charWords
                    # uniequip_table -> equipDict
                    for section_key, section_val in data.items():
                        if isinstance(section_val, dict):
                            for entity_id, entity_data in section_val.items():
                                if isinstance(entity_data, dict):
                                    name = entity_data.get("name", entity_id)
                                    entities_to_index.append({
                                        "id": entity_id,
                                        "name": name,
                                        **get_file_metadata(filepath)
                                    })
                                    # Collect keys
                                    for k, v in entity_data.items():
                                        if k not in key_inventory:
                                            key_inventory[k] = str(v)[:100]
                else:
                    # Shape 1 & 2: Flat Entity Map or Bracketed
                    for entity_id, entity_data in data.items():
                        if isinstance(entity_data, dict):
                            name = entity_data.get("name", entity_id)
                            entities_to_index.append({
                                "id": entity_id,
                                "name": name,
                                **get_file_metadata(filepath)
                            })
                            for k, v in entity_data.items():
                                if k not in key_inventory:
                                    key_inventory[k] = str(v)[:100]
                        else:
                            # Not an entity map, might just be constants. Index the top level.
                            pass

                if entities_to_index:
                    index_data[table_name] = entities_to_index

                stats["parsed"] += 1

            except Exception as e:
                print(f"Failed parsing {file}: {e}")
                # traceback.print_exc()
                stats["failed"] += 1

    # Attach story lookup to index
    index_data["_story_lookup"] = available_stories

    with open(OUTPUT_INDEX, 'w', encoding='utf-8') as f:
        json.dump(index_data, f)

    with open(OUTPUT_KEYS, 'w', encoding='utf-8') as f:
        for k, v in sorted(key_inventory.items()):
            f.write(f"{k}: {v}\n")

    with open(OUTPUT_RELATIONS, 'w', encoding='utf-8') as f:
        f.write("Relations extracted (Placeholder - requires deep matching of IDs across files)\n")
        f.write("character_table.skills[].skillId -> skill_table.json\n")
        f.write("stage_table.stages[].levelId -> levels/...\n")
        f.write("stage_table.stages[].zoneId -> zone_table.json\n")

    print(f"Analysis complete. Parsed: {stats['parsed']}, Skipped: {stats['skipped']}, Failed: {stats['failed']}")
    if stats["failed"] > 0:
        exit(1)

if __name__ == "__main__":
    analyze()
