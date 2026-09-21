Arknights resources downloaded using [arkprts](https://github.com/thesadru/arkprts) through Github actions.

Check out [ArknightsGameData](https://github.com/Kengxxiao/ArknightsGameData) and [ArknightsGameResource](https://github.com/yuanyan3060/ArknightsGameResource) for alternative repositories.

My thanks goes out to [Kengxxiao](https://github.com/Kengxxiao), [VaDiM](https://github.com/aelurum) and all the other Arknights-related devs.

## Data Mapper Tool

This repository includes a data mapper tool to explore the JSON game data.
To use it:
1. Run the analyzer script: `python3 scripts_and_temp/analyzer.py`
2. Start a local server in the repository root: `python3 -m http.server 8000`
3. Open your browser and navigate to `http://localhost:8000/webapp/index.html`
*(Note: opening the HTML file directly via file:// will not work due to CORS restrictions on fetching JSON files).*
