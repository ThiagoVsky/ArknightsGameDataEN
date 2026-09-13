import json
import os

OUTPUT_INDEX = "webapp/data_index.json"

def test_analyzer_output():
    assert os.path.exists(OUTPUT_INDEX), "Index file missing"

    with open(OUTPUT_INDEX, 'r') as f:
        data = json.load(f)

    # Check that there are no level_* entries
    for key in data.keys():
        assert not key.startswith("level_") or key == "level_table", f"Found level map in index: {key}"

    # Check specific counts
    assert "item_table" in data, "item_table missing"
    # item_table has "items", "expItems" etc. Our script extracts all inner dicts.
    # Let's count just "items" or check if it's > 1000
    assert len(data["item_table"]) > 1000, f"item_table has too few items: {len(data['item_table'])}"

    assert "zone_table" in data, "zone_table missing"
    assert len(data["zone_table"]) >= 438, f"zone_table count incorrect: {len(data['zone_table'])}"

    assert "skin_table" in data, "skin_table missing"
    assert len(data["skin_table"]) >= 2000, f"skin_table count incorrect: {len(data['skin_table'])}"

    assert "skill_table" in data, "skill_table missing"
    assert len(data["skill_table"]) > 0, "skill_table is empty"

    assert "_story_lookup" in data, "Story lookup missing"
    # Check if a known main story resolves correctly via the lookup
    story_lookup = data["_story_lookup"]
    assert "level_main_00-01_beg" in story_lookup, "main_00-01_beg missing from lookup"
    assert story_lookup["level_main_00-01_beg"] == "story/obt/main/level_main_00-01_beg.txt", f"Incorrect path for main_00-01_beg: {story_lookup['level_main_00-01_beg']}"

    print("All tests passed.")

if __name__ == "__main__":
    test_analyzer_output()
