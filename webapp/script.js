const MANIFEST_URL = 'manifest.json';
const STORY_LOOKUP_URL = 'data/story_lookup.json';
const REPO_ROOT = '../en/gamedata/';

let manifestData = {};
let currentType = '';
let entities = [];
let filesCache = {};
let storyLookup = {};
let loadedTableDataCache = {}; // for chunked payloads

// Ensure safe text node rendering to avoid XSS/HTML Injection
function createTextElement(tag, text) {
    const el = document.createElement(tag);
    el.textContent = text;
    return el;
}

async function init() {
    try {
        const [manRes, storyRes] = await Promise.all([
            fetch(MANIFEST_URL),
            fetch(STORY_LOOKUP_URL)
        ]);
        if (!manRes.ok) throw new Error("Failed to load manifest");
        manifestData = await manRes.json();

        if (storyRes.ok) {
            storyLookup = await storyRes.json();
        }

        const types = Object.keys(manifestData).sort();
        renderTypeList(types);

        document.getElementById('search-entities').addEventListener('input', () => renderEntityList());
        document.getElementById('sort-entities').addEventListener('change', () => renderEntityList());

        // Setup global search
        document.getElementById('global-search').addEventListener('input', async (e) => {
            const term = e.target.value.toLowerCase().trim();
            if (!term) {
                // reset
                renderTypeList(types);
                return;
            }

            try {
                // Fetch search index if not cached yet
                if (!window.searchIndexCache) {
                    const sRes = await fetch('search_index.json');
                    if (sRes.ok) window.searchIndexCache = await sRes.json();
                }

                if (window.searchIndexCache) {
                    const matchedEntities = new Set();
                    for (const [eId, eBlob] of Object.entries(window.searchIndexCache)) {
                        if (eBlob.includes(term)) {
                            matchedEntities.add(eId);
                        }
                    }

                    // Filter types that contain these entities
                    const matchedTypes = [];
                    for (const t of types) {
                        const hasMatch = manifestData[t].entities.some(ent => matchedEntities.has(ent.id));
                        if (hasMatch) matchedTypes.push(t);
                    }
                    renderTypeList(matchedTypes);

                    // If current type is selected, filter its entity list too
                    if (currentType) {
                        window.globalSearchMatchedEntities = matchedEntities;
                        renderEntityList();
                    }
                }
            } catch (err) {
                console.error("Search Error:", err);
            }
        });

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
    entities = manifestData[type] ? manifestData[type].entities : [];
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

    // Apply global search filter if active
    if (window.globalSearchMatchedEntities && document.getElementById('global-search').value.trim() !== '') {
        filtered = filtered.filter(e => window.globalSearchMatchedEntities.has(e.id));
    }

    filtered.sort((a, b) => {
        if (sortBy === 'name') return String(a.name).localeCompare(String(b.name));
        if (sortBy === 'id') return String(a.id).localeCompare(String(b.id));
        return 0;
    });

    const msg = document.getElementById('entity-count-msg');

    msg.textContent = `Showing ${filtered.length} entities.`;

    filtered.forEach(e => {
        const li = document.createElement('li');
        const nameVal = e.name && e.name !== e.id ? e.name : e.id;
        const title = createTextElement('strong', nameVal);
        li.appendChild(title);

        if (e.name && e.name !== e.id) {
            const sub = createTextElement('div', `${e.id}`);
            sub.style.fontSize = '0.8em';
            sub.style.color = 'var(--text-muted)';
            li.appendChild(sub);
        }

        li.onclick = () => loadEntityDetails(e, currentType);
        ul.appendChild(li);
    });
}

async function fetchTableData(tableName) {
    const tablePath = `data/${tableName}.json`;
    if (loadedTableDataCache[tablePath]) return loadedTableDataCache[tablePath];
    try {
        const res = await fetch(tablePath);
        if (!res.ok) return null;
        const data = await res.json();
        loadedTableDataCache[tablePath] = data;
        return data;
    } catch {
        return null;
    }
}

async function loadEntityDetails(entityMeta, tableKey, targetPane = null) {
    let details;
    if (targetPane) {
        details = targetPane;
    } else {
        // If it's the primary selection from the left menu
        details = document.getElementById('details-content');

        // Remove all extra panes from #panel-stack except the first one
        const stack = document.getElementById('panel-stack');
        while (stack.children.length > 1) {
            stack.removeChild(stack.lastChild);
        }
    }

    details.innerHTML = 'Loading...';

    const tableData = await fetchTableData(tableKey);
    if (!tableData) {
        details.innerHTML = '';
        details.appendChild(createTextElement('p', 'Failed to load underlying table payload.'));
        return;
    }

    let entityData = tableData[entityMeta.id];

    if (!entityData) {
        details.innerHTML = '';
        details.appendChild(createTextElement('p', 'Entity data not found inside the table.'));
        return;
    }

    details.innerHTML = ''; // clear

    if (tableKey === 'character_table') {
        renderCharacter(details, entityMeta, entityData);
    } else if (tableKey === 'stage_table') {
        await renderStage(details, entityMeta, entityData);
    } else {
        renderGeneric(details, entityMeta, entityData);
    }

    // Auto-expand global search matches if applicable
    if (window.globalSearchMatchedEntities && window.globalSearchMatchedEntities.has(entityMeta.id) && document.getElementById('global-search').value.trim() !== '') {
        const detailsEls = details.querySelectorAll('details');
        detailsEls.forEach(d => d.open = true);
    }
}

function openInNewPane(entityMeta, tableKey) {
    const stack = document.getElementById('panel-stack');

    const newPane = document.createElement('div');
    newPane.className = 'panel pane-stack-member';

    const closeBtn = document.createElement('div');
    closeBtn.className = 'close-btn';
    closeBtn.textContent = 'Close';
    closeBtn.onclick = () => newPane.remove();
    newPane.appendChild(closeBtn);

    const contentDiv = document.createElement('div');
    newPane.appendChild(contentDiv);

    stack.appendChild(newPane);

    loadEntityDetails(entityMeta, tableKey, contentDiv);
}

function renderCharacter(container, meta, data) {
    container.appendChild(createTextElement('h3', `${data.name || meta.id} (${meta.id})`));
    container.appendChild(createTextElement('p', `Profession: ${data.profession || 'N/A'}`));

    // Convert ba.kw formatting in description if any
    const descP = document.createElement('p');
    descP.innerHTML = `Description: ${(data.description || 'N/A').replace(/<@ba\.kw>(.*?)<\/>/g, '<span class="ba-kw">$1</span>')}`;
    container.appendChild(descP);

    // Asset reference (informational only, no images)
    container.appendChild(createTextElement('p', `Asset conventions: avatar_${meta.id}.png, char_${meta.id}.png`));

    // Links to skills
    if (data.skills && data.skills.length > 0) {
        const skillDiv = document.createElement('div');
        skillDiv.appendChild(createTextElement('h4', 'Skills'));
        const ul = document.createElement('ul');
        data.skills.forEach(s => {
            if(s.skillId) {
                const li = document.createElement('li');
                li.classList.add('navigable-row');
                li.textContent = `Skill ID: ${s.skillId}`;
                li.onclick = () => openInNewPane({id: s.skillId}, 'skill_table');
                ul.appendChild(li);
            }
        });
        skillDiv.appendChild(ul);
        container.appendChild(skillDiv);
    }
}

async function renderStage(container, meta, data) {
    let headerText = `${data.name || meta.id} (${meta.id})`;

    // Try to resolve zone and chapter
    const zoneTable = await fetchTableData('zone_table');
    if (zoneTable && data.zoneId) {
        let zoneData = zoneTable[data.zoneId];
        if (zoneData) {
            let zName = zoneData.zoneNameFirst || zoneData.zoneNameSecond || zoneData.zoneNameThird || data.zoneId;
            let typeStr = zoneData.type ? `[${zoneData.type}] ` : '';

            // Try Chapter via mainlineAdditionInfo
            if (zoneTable.mainlineAdditionInfo && zoneTable.mainlineAdditionInfo[data.zoneId]) {
                const mlInfo = zoneTable.mainlineAdditionInfo[data.zoneId];
                if (mlInfo.chapterId) {
                    zName = `${mlInfo.chapterId} > ` + zName;
                }
            }

            headerText = `${typeStr}${zName} > ` + headerText;
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

function renderValue(container, value, blackboardData = null) {
    if (value === null || value === undefined) {
        container.appendChild(createTextElement('span', 'null'));
    } else if (Array.isArray(value)) {
        if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
            const table = document.createElement('table');
            table.style.borderCollapse = 'collapse';
            table.style.width = '100%';
            table.setAttribute('border', '1');

            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            const keys = new Set();
            value.forEach(v => Object.keys(v).forEach(k => keys.add(k)));

            keys.forEach(k => {
                const th = document.createElement('th');
                th.textContent = k;
                headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            value.forEach(v => {
                const tr = document.createElement('tr');
                keys.forEach(k => {
                    const td = document.createElement('td');
                    td.style.padding = '4px';
                    renderValue(td, v[k]);
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            container.appendChild(table);
        } else {
            const ul = document.createElement('ul');
            ul.style.margin = '0';
            ul.style.paddingLeft = '20px';
            value.forEach(v => {
                const li = document.createElement('li');
                renderValue(li, v);
                ul.appendChild(li);
            });
            container.appendChild(ul);
        }
    } else if (typeof value === 'object') {
        const details = document.createElement('details');
        details.open = false;
        const summary = document.createElement('summary');
        summary.textContent = 'Object Data';
        summary.style.cursor = 'pointer';
        details.appendChild(summary);

        const div = document.createElement('div');
        div.style.paddingLeft = '15px';
        div.style.borderLeft = '2px solid var(--border-color)';

        for (const [k, v] of Object.entries(value)) {
            const kv = document.createElement('div');
            kv.style.marginBottom = '4px';
            const kSpan = document.createElement('strong');
            kSpan.textContent = k + ": ";
            kv.appendChild(kSpan);

            // Pass down blackboard if exists
            let subBb = blackboardData;
            if (k === 'blackboard' || value.blackboard) {
                subBb = value.blackboard || value;

                // Blackboard parsing is tricky since it's typically an array of {key, value}
                if (Array.isArray(subBb)) {
                    const bbDict = {};
                    subBb.forEach(b => {
                        if (b.key && b.value !== undefined) bbDict[b.key] = b.value;
                    });
                    subBb = bbDict;
                }
            }

            renderValue(kv, v, subBb);
            div.appendChild(kv);
        }
        details.appendChild(div);
        container.appendChild(details);
    } else {
        // String or Scalar
        if (typeof value === 'string') {
            let s = value;

            // resolve {key:format} using blackboard
            if (blackboardData) {
                s = s.replace(/{([\w.]+)(?::([\d%]+))?}/g, (match, key, fmt) => {
                    if (blackboardData[key] !== undefined) {
                        return `<span class="ba-vup">${blackboardData[key]}</span>`;
                    }
                    return match;
                });
            }

            s = s.replace(/<@ba\.kw>(.*?)<\/>/g, '<span class="ba-kw">$1</span>');
            s = s.replace(/<@ba\.vup>(.*?)<\/>/g, '<span class="ba-vup">$1</span>');
            s = s.replace(/<@ba\.rem>(.*?)<\/>/g, '<span class="ba-rem">$1</span>');

            const pre = document.createElement('pre');
            pre.innerHTML = s;
            pre.style.margin = '0';
            pre.style.fontFamily = 'inherit';
            container.appendChild(pre);
        } else {
            const span = document.createElement('span');
            span.textContent = value;
            container.appendChild(span);
        }
    }
}

function renderGeneric(container, meta, data) {
    container.appendChild(createTextElement('h3', meta.id));
    renderValue(container, data);
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
            let isOtherTag = false;

            if (cmdBlock.startsWith('Background')) {
                isAssetCommand = true;
                assetDesc = 'Background/Image';
            } else if (cmdBlock.startsWith('Image')) {
                isAssetCommand = true;
                assetDesc = 'Image';
            } else if (cmdBlock.startsWith('Character') || cmdBlock.startsWith('name2')) {
                isAssetCommand = true;
                assetDesc = 'Character Sprite';
            } else if (cmdBlock.startsWith('PlayMusic') || cmdBlock.startsWith('PlaySound')) {
                isAssetCommand = true;
                assetDesc = 'Audio Event';
            } else if (cmdBlock.startsWith('Delay') || cmdBlock.startsWith('Blocker') || cmdBlock.startsWith('ImageTween')) {
                isAssetCommand = true;
                assetDesc = 'Engine Command';
            } else if (cmdBlock.startsWith('StopMusic') || cmdBlock.startsWith('HEADER') || cmdBlock.startsWith('Decision') || cmdBlock.startsWith('Predicate')) {
                isOtherTag = true;
            }

            if (isAssetCommand) {
                // Extract key/value if possible
                let detail = cmdBlock;
                const propMatch = cmdBlock.match(/\((.*?)\)/);
                if (propMatch) detail = propMatch[1];

                const s = createTextElement('span', `[ASSET LOAD] ${assetDesc}: ${detail}`);
                s.className = 'story-asset';
                lineDiv.appendChild(s);
            } else if (cmdBlock.startsWith('name=') || cmdBlock.startsWith('Dialog')) {
                // Dialogue
                let nameStr = cmdBlock;
                if (cmdBlock.startsWith('name=')) {
                    nameStr = cmdBlock.replace('name=', '').replace(/"/g, '');
                }
                const d = document.createElement('div');
                let parsedTrailing = trailingText;
                parsedTrailing = parsedTrailing.replace(/<@ba\.kw>(.*?)<\/>/g, '<span class="ba-kw">$1</span>');
                d.innerHTML = `<strong>${nameStr}:</strong> ${parsedTrailing}`;
                d.className = 'story-dialogue';
                lineDiv.appendChild(d);
            } else if (isOtherTag) {
                const s = createTextElement('span', `[TAG] ${cmdBlock.split('(')[0]}: ${trailingText}`);
                s.className = 'story-asset';
                lineDiv.appendChild(s);
            } else {
                // Generic tag
                const d = createTextElement('div', `[${cmdBlock}] ${trailingText}`);
                d.className = 'story-dialogue';
                lineDiv.appendChild(d);
            }
        } else {
            // Free text (rare, but happens)
            const d = document.createElement('div');
            let parsedLine = line;
            parsedLine = parsedLine.replace(/<@ba\.kw>(.*?)<\/>/g, '<span class="ba-kw">$1</span>');
            d.innerHTML = parsedLine;
            d.className = 'story-dialogue';
            lineDiv.appendChild(d);
        }

        container.appendChild(lineDiv);
    });

    return container;
}

function renderMap(container, mapData, tileTable = null) {
    if (!mapData.mapData || !mapData.mapData.map || !mapData.mapData.tiles) return;

    const layout = mapData.mapData.map;
    const tilesInfoArray = mapData.mapData.tiles;
    const width = layout[0].length;
    const height = layout.length;

    container.appendChild(createTextElement('div', `Dimensions: ${width}x${height}`));

    const grid = document.createElement('div');
    grid.className = 'map-grid';
    grid.style.gridTemplateColumns = `repeat(${width}, 20px)`;

    layout.forEach(row => {
        row.forEach(cellValue => {
            const cellDiv = document.createElement('div');
            cellDiv.className = 'map-cell';

            const tileRef = tilesInfoArray[cellValue];
            if (tileRef && tileRef.tileKey) {
                let infoName = tileRef.tileKey;
                let infoDesc = '';
                if (tileTable && tileTable[tileRef.tileKey]) {
                    infoName = tileTable[tileRef.tileKey].name || infoName;
                    infoDesc = tileTable[tileRef.tileKey].description || '';
                }

                cellDiv.title = `${infoName}\n${infoDesc}`;

                // Color based on passableMask and type
                if (tileRef.passableMask === 0) cellDiv.classList.add('wall');
                else if (tileRef.tileKey.includes('start')) cellDiv.classList.add('start');
                else if (tileRef.tileKey.includes('end')) cellDiv.classList.add('end');
                else cellDiv.style.backgroundColor = '#f4f4f9';
            }

            grid.appendChild(cellDiv);
        });
    });

    container.appendChild(grid);
}

init();
