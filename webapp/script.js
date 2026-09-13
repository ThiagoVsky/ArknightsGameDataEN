const INDEX_URL = 'data_index.json';
const REPO_ROOT = '../en/gamedata/';

let indexData = {};
let currentType = '';
let entities = [];
let filesCache = {};
let storyLookup = {};

// Ensure safe text node rendering to avoid XSS/HTML Injection
function createTextElement(tag, text) {
    const el = document.createElement(tag);
    el.textContent = text;
    return el;
}

async function init() {
    try {
        const res = await fetch(INDEX_URL);
        if (!res.ok) throw new Error("Failed to load index");
        indexData = await res.json();

        storyLookup = indexData['_story_lookup'] || {};
        delete indexData['_story_lookup'];

        const types = Object.keys(indexData).sort();
        renderTypeList(types);

        document.getElementById('search-types').addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            renderTypeList(types.filter(t => t.toLowerCase().includes(term)));
        });

        document.getElementById('search-entities').addEventListener('input', () => renderEntityList());
        document.getElementById('sort-entities').addEventListener('change', () => renderEntityList());

    } catch (err) {
        console.error("Init Error:", err);
        document.getElementById('type-list').appendChild(createTextElement('li', 'Error loading index. Did you run the python script?'));
    }
}

function renderTypeList(types) {
    const ul = document.getElementById('type-list');
    ul.innerHTML = '';
    types.forEach(type => {
        const li = document.createElement('li');
        li.textContent = type;
        li.onclick = () => selectType(type);
        ul.appendChild(li);
    });
}

function selectType(type) {
    currentType = type;
    document.getElementById('current-type').textContent = type;
    entities = indexData[type] || [];
    renderEntityList();
}

function renderEntityList() {
    const ul = document.getElementById('entity-list');
    ul.innerHTML = '';

    const term = document.getElementById('search-entities').value.toLowerCase();
    const sortBy = document.getElementById('sort-entities').value;

    let filtered = entities.filter(e =>
        (e.name && e.name.toLowerCase().includes(term)) ||
        (e.id && String(e.id).toLowerCase().includes(term))
    );

    filtered.sort((a, b) => {
        if (sortBy === 'name') return String(a.name).localeCompare(String(b.name));
        if (sortBy === 'id') return String(a.id).localeCompare(String(b.id));
        if (sortBy === 'mtime') return (b.mtime || 0) - (a.mtime || 0); // descending
        if (sortBy === 'size') return (b.size || 0) - (a.size || 0);   // descending
        return 0;
    });

    const msg = document.getElementById('entity-count-msg');

    // Pagination / Limit indicator
    const limit = 500;
    let displayed = filtered;
    if (filtered.length > limit) {
        displayed = filtered.slice(0, limit);
        msg.textContent = `Showing ${limit} of ${filtered.length} entities.`;
    } else {
        msg.textContent = `Showing ${filtered.length} entities.`;
    }

    displayed.forEach(e => {
        const li = document.createElement('li');
        const title = createTextElement('strong', e.name || e.id);
        const sub = createTextElement('div', `${e.id}`);
        sub.style.fontSize = '0.8em';
        sub.style.color = 'var(--text-muted)';

        li.appendChild(title);
        li.appendChild(sub);
        li.onclick = () => loadEntityDetails(e);
        ul.appendChild(li);
    });
}

async function fetchTableData(tableFile) {
    const tablePath = `excel/${tableFile}`;
    if (filesCache[tablePath]) return filesCache[tablePath];
    try {
        const res = await fetch(REPO_ROOT + tablePath);
        if (!res.ok) return null;
        const data = await res.json();
        filesCache[tablePath] = data;
        return data;
    } catch {
        return null;
    }
}

async function loadEntityDetails(entityMeta) {
    const details = document.getElementById('details-content');
    details.innerHTML = 'Loading...';

    const tableData = await fetchTableData(entityMeta.file);
    if (!tableData) {
        details.innerHTML = '';
        details.appendChild(createTextElement('p', 'Failed to load underlying table file.'));
        return;
    }

    let entityData = null;

    // Search the table. It could be flat, or nested in a container section
    if (tableData[entityMeta.id]) {
        entityData = tableData[entityMeta.id];
    } else {
        // Deep search sections
        for (const val of Object.values(tableData)) {
            if (val && typeof val === 'object' && val[entityMeta.id]) {
                entityData = val[entityMeta.id];
                break;
            }
        }
    }

    if (!entityData) {
        details.innerHTML = '';
        details.appendChild(createTextElement('p', 'Entity data not found inside the table.'));
        return;
    }

    details.innerHTML = ''; // clear

    if (currentType === 'character_table') {
        renderCharacter(details, entityMeta, entityData);
    } else if (currentType === 'stage_table') {
        await renderStage(details, entityMeta, entityData);
    } else {
        renderGeneric(details, entityMeta, entityData);
    }
}

function renderCharacter(container, meta, data) {
    container.appendChild(createTextElement('h3', `${data.name || meta.id} (${meta.id})`));
    container.appendChild(createTextElement('p', `Profession: ${data.profession || 'N/A'}`));
    container.appendChild(createTextElement('p', `Description: ${data.description || 'N/A'}`));

    // Asset reference (informational only, no images)
    container.appendChild(createTextElement('p', `Asset conventions: avatar_${meta.id}.png, char_${meta.id}.png`));

    // Links to skills
    if (data.skills && data.skills.length > 0) {
        const skillDiv = document.createElement('div');
        skillDiv.appendChild(createTextElement('h4', 'Skills'));
        const ul = document.createElement('ul');
        data.skills.forEach(s => {
            if(s.skillId) ul.appendChild(createTextElement('li', `Skill ID: ${s.skillId}`));
        });
        skillDiv.appendChild(ul);
        container.appendChild(skillDiv);
    }
}

async function renderStage(container, meta, data) {
    let headerText = `${data.name || meta.id} (${meta.id})`;

    // Try to resolve zone and chapter
    const zoneTable = await fetchTableData('zone_table.json');
    if (zoneTable && data.zoneId) {
        let zoneData = null;
        for(const z of Object.values(zoneTable)){
            if(z[data.zoneId]) { zoneData = z[data.zoneId]; break; }
        }
        if (zoneData) {
            headerText = `${zoneData.zoneName || data.zoneId} > ` + headerText;

            // Try Chapter
            const chapTable = await fetchTableData('chapter_table.json');
            if (chapTable) {
                for(const c of Object.values(chapTable)) {
                    // chapters are top level dicts, usually don't have startZoneId in all versions but we can check if zoneId matches
                    if(c.startZoneId === data.zoneId) {
                        headerText = `${c.chapterName} > ` + headerText;
                    }
                }
            }
        }
    }

    container.appendChild(createTextElement('h3', headerText));

    if (data.description) {
        container.appendChild(createTextElement('p', `Description: ${data.description}`));
    }

    const flowDiv = document.createElement('div');
    flowDiv.appendChild(createTextElement('h4', 'Chronological Event Flow'));
    container.appendChild(flowDiv);

    // 1. Before Battle Story
    const begKey = `level_${data.stageId}_beg`;
    if (storyLookup[begKey]) {
        const text = await fetchText(REPO_ROOT + storyLookup[begKey]);
        const section = document.createElement('div');
        section.appendChild(createTextElement('strong', '[1] Before Stage Story loaded'));
        section.appendChild(parseStoryText(text));
        flowDiv.appendChild(section);
    } else {
        flowDiv.appendChild(createTextElement('p', '[1] No before-battle story in scripted tree.'));
    }

    // 2. Map
    const mapSection = document.createElement('div');
    mapSection.style.marginTop = '20px';
    mapSection.appendChild(createTextElement('strong', '[2] Battle Stage Map Loaded'));
    if (data.levelId) {
        const mapPath = data.levelId.toLowerCase() + '.json';
        mapSection.appendChild(createTextElement('div', `Map File: levels/${mapPath}`));
        const mapData = await fetchMap(REPO_ROOT + 'levels/' + mapPath);
        if (mapData) {
            renderMap(mapSection, mapData);
        }
    } else {
        mapSection.appendChild(createTextElement('div', 'No levelId defined.'));
    }
    flowDiv.appendChild(mapSection);

    // 3. After Battle Story
    const endKey = `level_${data.stageId}_end`;
    if (storyLookup[endKey]) {
        const text = await fetchText(REPO_ROOT + storyLookup[endKey]);
        const section = document.createElement('div');
        section.style.marginTop = '20px';
        section.appendChild(createTextElement('strong', '[3] After Stage Story loaded'));
        section.appendChild(parseStoryText(text));
        flowDiv.appendChild(section);
    } else {
        const p = createTextElement('p', '[3] No after-battle story in scripted tree.');
        p.style.marginTop = '20px';
        flowDiv.appendChild(p);
    }
}

function renderGeneric(container, meta, data) {
    container.appendChild(createTextElement('h3', meta.id));
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(data, null, 2);
    container.appendChild(pre);
}

async function fetchText(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return await res.text();
    } catch {
        return null;
    }
}

async function fetchMap(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

function parseStoryText(text) {
    const container = document.createElement('div');
    if (!text) {
        container.appendChild(createTextElement('div', 'Failed to load text content.'));
        return container;
    }

    const lines = text.split('\n');

    lines.forEach(line => {
        line = line.trim();
        if (!line) return;

        const lineDiv = document.createElement('div');
        lineDiv.className = 'story-line';

        // Dialogue usually follows: [name="CharacterName"] Dialogue text here
        // Command usually follows: [Command(key="value")] or [Command]

        let match = line.match(/^\[(.*?)\](.*)/);

        if (match) {
            const cmdBlock = match[1]; // e.g. name="Dobermann" or Background(image="bg_cher_1")
            const trailingText = match[2].trim();

            // Check if it's a known non-dialogue command
            let isAssetCommand = false;
            let assetDesc = '';

            if (cmdBlock.startsWith('Background')) {
                isAssetCommand = true;
                assetDesc = 'Background/Image';
            } else if (cmdBlock.startsWith('Character') || cmdBlock.startsWith('name2')) {
                isAssetCommand = true;
                assetDesc = 'Character Sprite';
            } else if (cmdBlock.startsWith('PlayMusic') || cmdBlock.startsWith('PlaySound')) {
                isAssetCommand = true;
                assetDesc = 'Audio Event';
            } else if (cmdBlock.startsWith('Delay') || cmdBlock.startsWith('Blocker') || cmdBlock.startsWith('ImageTween')) {
                isAssetCommand = true;
                assetDesc = 'Engine Command';
            }

            if (isAssetCommand) {
                // Extract key/value if possible
                let detail = cmdBlock;
                const propMatch = cmdBlock.match(/\((.*?)\)/);
                if (propMatch) detail = propMatch[1];

                const s = createTextElement('span', `[ASSET LOAD] ${assetDesc}: ${detail}`);
                s.className = 'story-asset';
                lineDiv.appendChild(s);
            } else if (cmdBlock.startsWith('name=')) {
                // Dialogue
                const nameStr = cmdBlock.replace('name=', '').replace(/"/g, '');
                const d = createTextElement('div', `${nameStr}: ${trailingText}`);
                d.className = 'story-dialogue';
                lineDiv.appendChild(d);
            } else {
                // Generic tag
                const d = createTextElement('div', `[${cmdBlock}] ${trailingText}`);
                d.className = 'story-dialogue';
                lineDiv.appendChild(d);
            }
        } else {
            // Free text (rare, but happens)
            const d = createTextElement('div', line);
            d.className = 'story-dialogue';
            lineDiv.appendChild(d);
        }

        container.appendChild(lineDiv);
    });

    return container;
}

function renderMap(container, mapData) {
    if (!mapData.mapData || !mapData.mapData.map) return;

    const layout = mapData.mapData.map;
    const width = layout[0].length;
    const height = layout.length;

    container.appendChild(createTextElement('div', `Dimensions: ${width}x${height}`));

    const grid = document.createElement('div');
    grid.className = 'map-grid';
    grid.style.gridTemplateColumns = `repeat(${width}, 20px)`;

    layout.forEach(row => {
        row.forEach(cell => {
            const cellDiv = document.createElement('div');
            cellDiv.className = 'map-cell';

            // Tile types (simplified, actual game has many)
            if (cell === 0) cellDiv.classList.add('wall');
            if (cell === 3) cellDiv.classList.add('start'); // Spawn
            if (cell === 4) cellDiv.classList.add('end'); // Base

            grid.appendChild(cellDiv);
        });
    });

    container.appendChild(grid);
}

init();
