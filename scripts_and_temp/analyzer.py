import os
import sys
import json
import logging
from collections import defaultdict
import re

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

data_dir = 'en'
output_dir = 'scripts_and_temp'

def main():
    logging.info("Starting analysis...")
    all_filenames = []
    for root, dirs, files in os.walk(data_dir):
        for file in files:
            all_filenames.append(os.path.join(root, file))

    id_pattern = re.compile(r'^[a-zA-Z0-9_-]{4,80}$')

    webapp_index = {"entity_types": defaultdict(list)}

    logging.info("Building index...")
    for filepath in all_filenames:
        if filepath.endswith('.json'):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                if isinstance(data, dict) and len(data) > 0:
                    entity_type_name = os.path.basename(filepath).replace('.json', '')

                    # Special logic for stage_table.json because it is nested under "stages"
                    if entity_type_name == 'stage_table' and 'stages' in data:
                        for k, v in data['stages'].items():
                            name = v.get('name', v.get('code', k)) if isinstance(v, dict) else k
                            webapp_index["entity_types"][entity_type_name].append({
                                "id": k,
                                "name": name,
                                "file": filepath,
                                "nested_key": "stages"
                            })
                        continue

                    first_key = list(data.keys())[0]
                    if isinstance(data[first_key], dict) and id_pattern.match(first_key):
                        for k, v in data.items():
                            if id_pattern.match(k):
                                name = v.get('name', v.get('appellation', k)) if isinstance(v, dict) else k
                                webapp_index["entity_types"][entity_type_name].append({
                                    "id": k,
                                    "name": name,
                                    "file": filepath
                                })
            except Exception:
                pass

    with open('webapp/data_index.json', 'w', encoding='utf-8') as f:
        json.dump(webapp_index, f, ensure_ascii=False, indent=2)

    logging.info("Analysis complete.")

if __name__ == "__main__":
    main()
