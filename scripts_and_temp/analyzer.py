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

TABLE_REGISTRY = {
    "activity_table": {
        "shape": "container",
        "entitySection": "basicInfo"
    },
    "audio_data": {
        "shape": "flat scalar map",
        "entitySection": None
    },
    "battle_equip_table": {
        "shape": "flat map",
        "entitySection": None
    },
    "building_data": {
        "shape": "flat scalar map",
        "entitySection": None
    },
    "campaign_table": {
        "shape": "container",
        "entitySection": "campaigns"
    },
    "chapter_table": {
        "shape": "flat map",
        "entitySection": None
    },
    "char_master_table": {
        "shape": "flat scalar map",
        "entitySection": None
    },
    "char_meta_table": {
        "shape": "container",
        "entitySection": "spCharMissions"
    },
    "char_patch_table": {
        "shape": "container",
        "entitySection": "infos"
    },
    "character_table": {
        "shape": "flat map",
        "entitySection": None
    },
    "charm_table": {
        "shape": "list root",
        "entitySection": None
    },
    "charword_table": {
        "shape": "container",
        "entitySection": "charWords"
    },
    "checkin_table": {
        "shape": "container",
        "entitySection": "groups"
    },
    "climb_tower_table": {
        "shape": "container",
        "entitySection": "towers"
    },
    "clue_data": {
        "shape": "flat scalar map",
        "entitySection": None
    },
    "crisis_table": {
        "shape": "flat scalar map",
        "entitySection": None
    },
    "crisis_v2_table": {
        "shape": "container",
        "entitySection": "seasonInfoDataMap"
    },
    "display_meta_table": {
        "shape": "container",
        "entitySection": "nameCardV2Data"
    },
    "enemy_handbook_table": {
        "shape": "container",
        "entitySection": "enemyData"
    },
    "favor_table": {
        "shape": "flat scalar map",
        "entitySection": None
    },
    "gacha_table": {
        "shape": "flat scalar map",
        "entitySection": None
    },
    "gamedata_const": {
        "shape": "flat scalar map",
        "entitySection": None
    },
    "handbook_info_table": {
        "shape": "container",
        "entitySection": "handbookDict"
    },
    "handbook_table": {
        "shape": "flat map",
        "entitySection": None
    },
    "handbook_team_table": {
        "shape": "flat map",
        "entitySection": None
    },
    "hotupdate_meta_table": {
        "shape": "flat scalar map",
        "entitySection": None
    },
    "init_text": {
        "shape": "flat scalar map",
        "entitySection": None
    },
        "item_table": {
        "shape": "container",
        "entitySection": "items",
        "groupKey": ["itemType"]
    },
    "main_text": {
        "shape": "flat scalar map",
        "entitySection": None
    },
    "medal_table": {
        "shape": "flat scalar map",
        "entitySection": None
    },
    "meta_ui_table": {
        "shape": "flat scalar map",
        "entitySection": None
    },
    "mission_table": {
        "shape": "container",
        "entitySection": "missions"
    },
    "open_server_table": {
        "shape": "flat scalar map",
        "entitySection": None
    },
    "player_avatar_table": {
        "shape": "flat scalar map",
        "entitySection": None
    },
    "range_table": {
        "shape": "flat map",
        "entitySection": None
    },
    "replicate_table": {
        "shape": "flat map",
        "entitySection": None
    },
    "retro_table": {
        "shape": "container",
        "entitySection": "stageList"
    },
    "roguelike_table": {
        "shape": "container",
        "entitySection": "constTable"
    },
    "roguelike_topic_table": {
        "shape": "container",
        "entitySection": "topics"
    },
    "sandbox_perm_table": {
        "shape": "container",
        "entitySection": "basicInfo"
    },
    "sandbox_table": {
        "shape": "container",
        "entitySection": "sandboxActTables"
    },
    "shop_client_table": {
        "shape": "flat scalar map",
        "entitySection": None
    },
    "skill_table": {
        "shape": "bracketed IDs",
        "entitySection": None
    },
    "skin_table": {
        "shape": "container",
        "entitySection": "charSkins"
    },
    "special_operator_table": {
        "shape": "container",
        "entitySection": "operatorBasicData"
    },
        "stage_table": {
        "shape": "container",
        "entitySection": "stages",
        "groupKey": ["stageType", "zoneId"]
    },
    "story_review_meta_table": {
        "shape": "container",
        "entitySection": "actArchiveResData"
    },
    "story_review_table": {
        "shape": "flat map",
        "entitySection": None
    },
    "story_table": {
        "shape": "flat map",
        "entitySection": None
    },
    "tech_buff_table": {
        "shape": "flat scalar map",
        "entitySection": None
    },
    "tip_table": {
        "shape": "flat scalar map",
        "entitySection": None
    },
    "token_table": {
        "shape": "flat map",
        "entitySection": None
    },
    "uniequip_data": {
        "shape": "container",
        "entitySection": "equipDict"
    },
    "uniequip_table": {
        "shape": "container",
        "entitySection": "equipDict"
    },
        "zone_table": {
        "shape": "container",
        "entitySection": "zones",
        "groupKey": ["type", "zoneID"]
    }
}

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
                relpath = os.path.join(root, file).replace(DATA_DIR + "/", "")
                available_stories[name] = relpath

                # Also index by actual relative path for lookup collision safety
                relname = os.path.relpath(os.path.join(root, file), STORY_DIR).replace(".txt", "")
                available_stories[relname] = relpath

    # Iterate exactly over excel tables
    for root, dirs, files in os.walk(EXCEL_DIR):
        for file in files:
            if not file.endswith(".json"): continue

            table_name = file.replace(".json", "")
            filepath = os.path.join(root, file)

            if table_name not in TABLE_REGISTRY:
                print(f"File {table_name}.json found in excel/ but not in TABLE_REGISTRY. Failing loudly.")
                stats["failed"] += 1
                continue

            registry = TABLE_REGISTRY[table_name]

            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                entities_to_index = []

                if registry["shape"] in ["list root", "flat scalar map"]:
                    print(f"Skipping {file}: shape is {registry['shape']}.")
                    stats["skipped"] += 1
                    continue

                if registry["shape"] == "container":
                    target_data = data.get(registry["entitySection"])
                    if not target_data:
                        print(f"Warning: {file} is container but missing section {registry['entitySection']}")
                        target_data = {}
                else:
                    target_data = data

                # We expect target_data to be a dict of entities
                if isinstance(target_data, dict):
                    if table_name not in key_inventory:
                        key_inventory[table_name] = {}

                    for entity_id, entity_data in target_data.items():
                        if isinstance(entity_data, dict):
                            name = entity_data.get("name", entity_id)
                            entities_to_index.append({
                                "id": entity_id,
                                "name": name,
                                **get_file_metadata(filepath)
                            })
                            # Collect keys
                            for k, v in entity_data.items():
                                # skip numeric keys
                                if str(k).isdigit():
                                    continue
                                if k not in key_inventory[table_name]:
                                    key_inventory[table_name][k] = set()
                                if len(key_inventory[table_name][k]) < 10: # Limit distinct values kept
                                    if not isinstance(v, (dict, list)): # Only scalars
                                        key_inventory[table_name][k].add(str(v)[:100])
                        else:
                            # Might be a scalar entity map where values are not dicts?
                            # The schema didn't fully classify all edge cases of non-dict entities in these shapes.
                            pass

                if entities_to_index:
                    # Sort logic to implement deterministic ordering: count descending, then ID ascending (3.8)
                    # We will output entities directly to chunked payload files
                    index_data[table_name] = entities_to_index

                    if not os.path.exists("webapp/data"):
                        os.makedirs("webapp/data")

                    with open(f"webapp/data/{table_name}.json", "w", encoding="utf-8") as outf:
                        json.dump(target_data, outf)

                stats["parsed"] += 1

            except Exception as e:
                print(f"Failed parsing {file}: {e}")
                import traceback
                traceback.print_exc()
                stats["failed"] += 1

    with open("webapp/data/story_lookup.json", "w", encoding="utf-8") as f:
        json.dump(available_stories, f)

    # Generate Manifest containing just metadata, not entity payloads
    manifest = {}
    search_index = {}

    for table_name, entities in index_data.items():
        if not entities: continue

        metadata = {
            "file": entities[0].get("file"),
            "dir": entities[0].get("dir"),
            "size": entities[0].get("size"),
            "mtime": entities[0].get("mtime")
        }

        # We need to build the search index from the actual payload
        payload_path = f"webapp/data/{table_name}.json"
        try:
            with open(payload_path, 'r', encoding='utf-8') as pf:
                payload_data = json.load(pf)

                # Payload is a dict mapping entity_id to entity object
                for ent_id, ent_obj in payload_data.items():
                    # extract all string values
                    def extract_strings(obj):
                        strings = []
                        if isinstance(obj, dict):
                            for v in obj.values():
                                strings.extend(extract_strings(v))
                        elif isinstance(obj, list):
                            for v in obj:
                                strings.extend(extract_strings(v))
                        elif isinstance(obj, str):
                            strings.append(obj)
                        elif isinstance(obj, (int, float, bool)):
                            strings.append(str(obj))
                        return strings

                    search_index[ent_id] = " ".join(extract_strings(ent_obj)).lower()
        except Exception:
            pass

        clean_entities = []

        # Load registry options if available
        registry = TABLE_REGISTRY.get(table_name, {})
        group_key_def = registry.get("groupKey")

        if group_key_def:
            # We must load the data to group it properly
            groups = {}
            payload_path = f"webapp/data/{table_name}.json"
            try:
                with open(payload_path, 'r', encoding='utf-8') as pf:
                    payload_data = json.load(pf)

                    for e in entities:
                        ent_obj = payload_data.get(e["id"], {})

                        group_val = "Unknown"
                        sub_group_val = "Unknown"

                        if len(group_key_def) >= 1:
                            group_val = ent_obj.get(group_key_def[0], "Unknown")
                            if group_val is None: group_val = "Unknown"

                        if len(group_key_def) >= 2:
                            sub_group_val = ent_obj.get(group_key_def[1], "Unknown")
                            if sub_group_val is None: sub_group_val = "Unknown"

                        if group_val not in groups:
                            groups[group_val] = {}

                        if len(group_key_def) >= 2:
                            if sub_group_val not in groups[group_val]:
                                groups[group_val][sub_group_val] = []
                            groups[group_val][sub_group_val].append({"id": e["id"], "name": e["name"]})
                        else:
                            if "items" not in groups[group_val]:
                                groups[group_val]["items"] = []
                            groups[group_val]["items"].append({"id": e["id"], "name": e["name"]})

                manifest[table_name] = {
                    "metadata": metadata,
                    "groups": groups,
                    "count": len(entities)
                }
            except Exception:
                pass
        else:
            for e in entities:
                clean_entities.append({
                    "id": e["id"],
                    "name": e["name"]
                })

            manifest[table_name] = {
                "metadata": metadata,
                "entities": clean_entities,
                "count": len(clean_entities)
            }

    with open("webapp/manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f)

    with open("webapp/search_index.json", "w", encoding="utf-8") as f:
        json.dump(search_index, f)


    with open(OUTPUT_KEYS, 'w', encoding='utf-8') as f:
        for t_name in sorted(key_inventory.keys()):
            f.write(f"[{t_name}]\n")
            for k in sorted(key_inventory[t_name].keys()):
                v = ", ".join(list(key_inventory[t_name][k]))
                f.write(f"  {k}: {v}\n")
            f.write("\n")

    # Generate Relations dynamically
    relations_log = []
    try:
        # Load tables needed for relation checking
        with open(os.path.join(EXCEL_DIR, "character_table.json")) as f: char = json.load(f)
        with open(os.path.join(EXCEL_DIR, "skill_table.json")) as f: skill = json.load(f)
        with open(os.path.join(EXCEL_DIR, "stage_table.json")) as f: stage = json.load(f)
        with open(os.path.join(EXCEL_DIR, "zone_table.json")) as f: zone = json.load(f)
        with open(os.path.join(EXCEL_DIR, "skin_table.json")) as f: skin = json.load(f)
        with open(os.path.join(EXCEL_DIR, "battle_equip_table.json")) as f: battle = json.load(f)

        # charSkins to charId
        skin_owners = set(v.get('charId') for v in skin.get('charSkins', {}).values() if v.get('charId'))
        char_keys = set(char.keys())
        skin_matched = len(skin_owners.intersection(char_keys))
        pct = (skin_matched/len(skin_owners)*100) if skin_owners else 0
        relations_log.append(f"skin_table.charSkins[].charId -> character_table.json: {skin_matched}/{len(skin_owners)} ({pct:.1f}%)")

        # char skills to skill_table
        skill_ids = set()
        for c in char.values():
            for s in c.get("skills", []):
                if s.get("skillId"): skill_ids.add(s["skillId"])
        skill_matched = len(skill_ids.intersection(set(skill.keys())))
        pct = (skill_matched/len(skill_ids)*100) if skill_ids else 0
        relations_log.append(f"character_table.skills[].skillId -> skill_table.json: {skill_matched}/{len(skill_ids)} ({pct:.1f}%)")

        # stage levelId to levels
        stage_level_ids = set(s.get("levelId").lower() for s in stage.get("stages", {}).values() if s.get("levelId"))
        levels_files = set()
        for root, _, files in os.walk(LEVELS_DIR):
            for f_name in files:
                if f_name.endswith(".json"):
                    levels_files.add(f_name.replace(".json", "").lower())
        matched_levels = len(stage_level_ids.intersection(levels_files))
        pct = (matched_levels/len(stage_level_ids)*100) if stage_level_ids else 0
        relations_log.append(f"stage_table.stages[].levelId -> levels/...: {matched_levels}/{len(stage_level_ids)} ({pct:.1f}%)")

        # stage zoneId to zone_table
        zone_ids = set(s.get("zoneId") for s in stage.get("stages", {}).values() if s.get("zoneId"))
        valid_zones = set(zone.get("zones", {}).keys())
        matched_zones = len(zone_ids.intersection(valid_zones))
        pct = (matched_zones/len(zone_ids)*100) if zone_ids else 0
        relations_log.append(f"stage_table.stages[].zoneId -> zone_table.json: {matched_zones}/{len(zone_ids)} ({pct:.1f}%)")

        # battle_equip to charId via uniequip_table
        with open(os.path.join(EXCEL_DIR, "uniequip_table.json")) as f: uni = json.load(f)
        battle_owners = set()
        for equip_id in battle.keys():
            equip_data = uni.get("equipDict", {}).get(equip_id)
            if equip_data and equip_data.get("charId"):
                battle_owners.add(equip_data["charId"])
        battle_matched = len(battle_owners.intersection(char_keys))
        pct = (battle_matched/len(battle_owners)*100) if battle_owners else 0
        relations_log.append(f"battle_equip_table (via uniequip) -> character_table.json: {battle_matched}/{len(battle_owners)} ({pct:.1f}%)")

        # charword_table owners
        with open(os.path.join(EXCEL_DIR, "charword_table.json")) as f: charword = json.load(f)
        word_owners = set()
        for k in charword.get("charWords", {}).keys():
            # Pattern: char_102_texas_LANG_XXX
            parts = k.split("_")
            if len(parts) >= 3 and parts[0] == "char":
                word_owners.add("_".join(parts[:3]))
            else:
                word_owners.add(k)

        # refine word owners
        refined_word_owners = set()
        for o in word_owners:
            # issue says 413 of 463 resolved. The exact stripping logic can be complex (e.g. #12), but this is a close approximation.
            base_id = o.split("#")[0]
            if base_id.endswith("_CN_TOPOLECT"): base_id = base_id.replace("_CN_TOPOLECT", "")
            if base_id.endswith("_CN"): base_id = base_id[:-3]
            if base_id.endswith("_JP"): base_id = base_id[:-3]
            if base_id.endswith("_EN"): base_id = base_id[:-3]
            if base_id.endswith("_KR"): base_id = base_id[:-3]
            refined_word_owners.add(base_id)
        word_matched = len(refined_word_owners.intersection(char_keys))
        pct = (word_matched/len(refined_word_owners)*100) if refined_word_owners else 0
        relations_log.append(f"charword_table.charWords -> character_table.json: {word_matched}/{len(refined_word_owners)} ({pct:.1f}%)")


        # retro stage mapping
        with open(os.path.join(EXCEL_DIR, "retro_table.json")) as f: retro = json.load(f)
        retro_acts = retro.get("retroActList", {})
        retro_trails = retro.get("retroTrailList", {})
        stages = stage.get("stages", {})
        prefixes = {}
        for act_id, act_data in retro_acts.items():
            linked = act_data.get("linkedActId")
            if isinstance(linked, list) and linked: prefixes[act_id] = linked[0]
            elif isinstance(linked, str) and linked: prefixes[act_id] = linked

        mapped_stages = 0
        for stage_id, stage_data in stages.items():
            matched = False
            for trail_id, trail_data in retro_trails.items():
                if stage_id in trail_data.get("stageList", []):
                    matched = True; break
            if not matched:
                for act_id, prefix in prefixes.items():
                    if stage_id.startswith(prefix):
                        matched = True; break
                if not matched:
                    if stage_data.get("zoneId") in ["act2mainss_zone1", "act3mainss_zone1"]:
                        matched = True
            if matched: mapped_stages += 1
        pct = (mapped_stages/len(stages)*100) if stages else 0
        relations_log.append(f"stage_table.stages -> retro_table (collections): {mapped_stages}/{len(stages)} ({pct:.1f}%)")

    except Exception as e:
        relations_log.append(f"Error calculating relations: {e}")

    with open(OUTPUT_RELATIONS, 'w', encoding='utf-8') as f:
        f.write("Relations extracted:\n")
        for line in relations_log:
            f.write(f"{line}\n")

    print(f"Analysis complete. Parsed: {stats['parsed']}, Skipped: {stats['skipped']}, Failed: {stats['failed']}")
    if stats["failed"] > 0:
        exit(1)

if __name__ == "__main__":
    analyze()
