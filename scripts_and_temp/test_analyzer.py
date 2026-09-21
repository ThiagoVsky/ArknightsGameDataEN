import json
import os
import unittest
import subprocess

OUTPUT_MANIFEST = "webapp/manifest.json"
STORY_LOOKUP = "webapp/data/story_lookup.json"
DATA_DIR = "en/gamedata"

class TestAnalyzerOutput(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Run analyzer independently to assure tests run on clean checkout
        subprocess.run(["python3", "scripts_and_temp/analyzer.py"], check=True)

    def test_files_exist(self):
        self.assertTrue(os.path.exists(OUTPUT_MANIFEST), "Manifest file missing")
        self.assertTrue(os.path.exists(STORY_LOOKUP), "Story lookup file missing")

    def test_no_level_tables_in_manifest(self):
        with open(OUTPUT_MANIFEST, 'r') as f:
            data = json.load(f)
        for key in data.keys():
            self.assertFalse(key.startswith("level_") and key != "level_table", f"Found level map in index: {key}")

    def test_exact_counts(self):
        with open(OUTPUT_MANIFEST, 'r') as f:
            data = json.load(f)

        self.assertIn("item_table", data)
        self.assertEqual(data["item_table"]["count"], 1414, "item_table count incorrect")

        self.assertIn("zone_table", data)
        self.assertEqual(data["zone_table"]["count"], 438, "zone_table count incorrect")

        self.assertIn("skin_table", data)
        self.assertEqual(data["skin_table"]["count"], 2078, "skin_table count incorrect")

        self.assertIn("skill_table", data)
        self.assertEqual(data["skill_table"]["count"], 1630, "skill_table count incorrect")

        self.assertIn("charword_table", data)
        self.assertEqual(data["charword_table"]["count"], 17299, "charword_table count incorrect")

        self.assertIn("stage_table", data)
        self.assertEqual(data["stage_table"]["count"], 3319, "stage_table count incorrect")

        self.assertIn("retro_table", data)
        self.assertEqual(data["retro_table"]["count"], 1316, "retro_table count incorrect")

    def test_story_lookup(self):
        with open(STORY_LOOKUP, 'r') as f:
            story_lookup = json.load(f)
        with open("webapp/data/stage_table.json", 'r') as f:
            stage_table = json.load(f)

        beg_count = 0
        end_count = 0
        for stage_data in stage_table.values():
            if f"level_{stage_data['stageId']}_beg" in story_lookup:
                beg_count += 1
            if f"level_{stage_data['stageId']}_end" in story_lookup:
                end_count += 1

        self.assertEqual(beg_count, 581, f"Expected 581 stages with _beg scripts, got {beg_count}")
        self.assertEqual(end_count, 587, f"Expected 587 stages with _end scripts, got {end_count}")

        # Verify paths exist
        for key, relpath in story_lookup.items():
            full_path = os.path.join(DATA_DIR, relpath)
            self.assertTrue(os.path.exists(full_path), f"Path does not exist: {full_path}")

if __name__ == "__main__":
    unittest.main()
