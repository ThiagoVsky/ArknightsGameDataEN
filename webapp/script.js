let state = {
    indexData: null,
    currentType: null,
    entities: [],
    filesCache: {}
};

async function loadIndex() {
    try {
        const response = await fetch('data_index.json');
        state.indexData = await response.json();
        renderTypes();
    } catch (e) {
        console.error("Failed to load index", e);
        document.getElementById('type-list').innerHTML = "<li>Error loading data</li>";
    }
}

function getValidTypes() {
    if (!state.indexData) return [];
    const search = document.getElementById('type-search').value.toLowerCase();

    // Filter out level_ files as there are thousands, just keep main tables
    return Object.keys(state.indexData.entity_types)
        .filter(t => !t.startsWith('level_') || t === 'level_main_01-01')
        .filter(t => t.toLowerCase().includes(search))
        .sort();
}

function renderTypes() {
    const list = document.getElementById('type-list');
    list.innerHTML = '';
    const types = getValidTypes();
    types.forEach(t => {
        const li = document.createElement('li');
        li.textContent = t;
        if (t === state.currentType) li.classList.add('active');
        li.onclick = () => selectType(t);
        list.appendChild(li);
    });
}

function selectType(type) {
    state.currentType = type;
    document.getElementById('current-type-title').textContent = type;
    state.entities = state.indexData.entity_types[type] || [];
    renderTypes(); // Update active class
    renderEntities();
}

function renderEntities() {
    const list = document.getElementById('entity-list');
    list.innerHTML = '';

    const search = document.getElementById('entity-search').value.toLowerCase();
    const sort = document.getElementById('entity-sort').value;

    let filtered = state.entities.filter(e => {
        const nameMatch = e.name && e.name.toLowerCase().includes(search);
        const idMatch = e.id && e.id.toLowerCase().includes(search);
        return nameMatch || idMatch;
    });

    filtered.sort((a, b) => {
        let valA = a[sort] || "";
        let valB = b[sort] || "";
        if (valA < valB) return -1;
        if (valA > valB) return 1;
        return 0;
    });

    // Limit to 200 items so the browser doesn't freeze when searching empty
    filtered.slice(0, 200).forEach(e => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="name">${e.name || 'Unnamed'}</span><span class="id">${e.id}</span>`;
        li.onclick = () => loadEntityDetails(e);
        list.appendChild(li);
    });
}

async function fetchFile(filepath) {
    if (state.filesCache[filepath]) return state.filesCache[filepath];
    try {
        const response = await fetch('../' + filepath);
        if (!response.ok) throw new Error("Network response was not ok");
        const data = await response.json();
        state.filesCache[filepath] = data;
        return data;
    } catch(e) {
        console.error("Fetch file error:", e);
        return null;
    }
}

async function fetchTextFile(filepath) {
    if (state.filesCache[filepath]) return state.filesCache[filepath];
    try {
        const response = await fetch('../' + filepath);
        if (!response.ok) return null;
        const data = await response.text();
        state.filesCache[filepath] = data;
        return data;
    } catch(e) {
        return null;
    }
}

async function loadEntityDetails(entity) {
    const content = document.getElementById('details-content');
    content.innerHTML = '<p>Loading...</p>';

    const fileData = await fetchFile(entity.file);
    if (!fileData) {
        content.innerHTML = '<p>Error loading file.</p>';
        return;
    }

    let entityData = fileData;
    if (entity.nested_key) {
        entityData = fileData[entity.nested_key][entity.id];
    } else {
        entityData = fileData[entity.id] || fileData;
        if (Array.isArray(fileData)) {
            entityData = fileData.find(e => e.id === entity.id) || fileData;
        }
    }

    // Modular parsers
    if (state.currentType === 'character_table') {
        content.innerHTML = await renderCharacter(entityData, entity);
    } else if (state.currentType === 'stage_table') {
        content.innerHTML = await renderStage(entityData, entity);
    } else {
        content.innerHTML = renderGeneric(entityData, entity);
    }
}

async function renderCharacter(data, entity) {
    let html = `<h3>${data.name || 'Unnamed'} (${entity.id})</h3>`;
    html += `<p><strong>Profession:</strong> ${data.profession || 'N/A'}</p>`;
    html += `<p><strong>Description:</strong> ${data.description || data.itemUsage || 'N/A'}</p>`;

    // Skills
    if (data.skills && data.skills.length > 0) {
        html += `<h4>Skills</h4><ul>`;
        data.skills.forEach(skill => {
            html += `<li>Skill ID: ${skill.skillId}</li>`;
        });
        html += `</ul>`;
    }

    // Map assets based on handbook/art tables
    html += `<h4>Related Assets (Inferred)</h4>`;
    html += `<ul>`;
    html += `<li>Avatar: <code>art/avatar/${entity.id}.png</code></li>`;
    html += `<li>Portrait: <code>art/portraits/${entity.id}.png</code></li>`;
    html += `</ul>`;

    html += `<h4>Raw Data</h4><pre>${JSON.stringify(data, null, 2)}</pre>`;
    return html;
}

// Stage Story Parser
function parseStoryText(text) {
    let html = '<ul>';
    const lines = text.split('\n');
    lines.forEach(line => {
        line = line.trim();
        if (line.startsWith('[')) {
            const match = line.match(/^\[(.*?)(?:\((.*?)\))?\]/);
            if (match) {
                const tag = match[1];
                const props = match[2] || '';

                // Track asset loading
                if (tag.toLowerCase() === 'background' || tag.toLowerCase() === 'image') {
                    let imageId = 'unknown';
                    const imgMatch = props.match(/image="([^"]+)"/);
                    if (imgMatch) imageId = imgMatch[1];
                    html += `<li><em>[ASSET LOAD] Background/Image: <code>${imageId}</code></em></li>`;
                } else if (tag.toLowerCase() === 'character') {
                    let charId = 'unknown';
                    const nameMatch = props.match(/name="([^"]+)"/);
                    if (nameMatch) charId = nameMatch[1];
                    html += `<li><em>[ASSET LOAD] Character Sprite: <code>${charId}</code></em></li>`;
                } else if (tag.toLowerCase() === 'name') {
                     // dialogue
                     const nameMatch = props.match(/name="([^"]+)"/);
                     const content = line.split(']').slice(1).join(']').trim();
                     if (nameMatch && content) {
                         html += `<li><strong>${nameMatch[1]}:</strong> ${content}</li>`;
                     }
                }
            }
        }
    });
    html += '</ul>';
    return html;
}


async function renderStage(data, entity) {
    let html = `<h3>${data.name || 'Unnamed'} - ${data.code || 'No Code'} (${entity.id})</h3>`;
    html += `<p><strong>Description:</strong> ${data.description || 'N/A'}</p>`;

    const zoneId = data.zoneId;
    let storyDataFound = false;

    html += `<h4>Chronological Event Flow</h4>`;

    // 1. Before Stage Story
    const beforeStoryPath = `en/gamedata/story/[uc]lua/story/${zoneId}/story_${entity.id}_beg.txt`;
    let beforeText = await fetchTextFile(beforeStoryPath);
    if (!beforeText) {
        const beforeLegacyPath = `en/gamedata/story/obt/main/level_${entity.id}_beg.txt`;
        beforeText = await fetchTextFile(beforeLegacyPath);
    }
    if (!beforeText && entity.id.startsWith("main_")) {
         const altBeforePath = `en/gamedata/story/obt/main/level_${entity.id.replace('main_', '')}_beg.txt`;
         beforeText = await fetchTextFile(altBeforePath);
    }

    if (beforeText) {
        html += `<h5>[1] Before Stage Story loaded</h5>`;
        html += parseStoryText(beforeText);
        storyDataFound = true;
    } else {
        html += `<h5>[1] Before Stage Story loaded</h5>`;
        html += `<p><em>No story text found.</em></p>`;
    }

    // 2. Battle Stage Load
    if (data.levelId) {
        const levelDataId = data.levelId.toLowerCase();
        let levelPath = `en/gamedata/levels/obt/main/${levelDataId.replace('obt/main/','')}.json`;
        if (levelDataId.includes('obt/')) {
            levelPath = `en/gamedata/levels/${levelDataId}.json`;
        } else {
             levelPath = `en/gamedata/levels/${levelDataId}.json`;
        }

        let levelData = await fetchFile(levelPath);
        if (!levelData && levelDataId.includes("level_main_")) {
             levelPath = `en/gamedata/levels/obt/main/${levelDataId.split('obt/main/').pop()}.json`;
             levelData = await fetchFile(levelPath);
        }

        if (levelData) {
            html += `<h5>[2] Battle Stage Map Loaded</h5>`;
            html += `<ul>`;
            html += `<li>Map File: <code>${levelPath}</code></li>`;
            if (levelData.mapData && levelData.mapData.map && levelData.mapData.map.length > 0) {
                 html += `<li>Map Dimensions: Width ${levelData.mapData.map[0].length}, Height ${levelData.mapData.map.length}</li>`;
            }
            if (levelData.bgmEvent) {
                html += `<li>[ASSET LOAD] BGM Event: <code>${levelData.bgmEvent}</code></li>`;
            } else if (levelData.mapData && levelData.mapData.bgmEvent) {
                html += `<li>[ASSET LOAD] BGM Event: <code>${levelData.mapData.bgmEvent}</code></li>`;
            }
            html += `</ul>`;
        } else {
            html += `<h5>[2] Battle Stage Map Loaded</h5>`;
            html += `<ul><li>Map File: <code>${levelDataId}</code> (Not found in known paths)</li></ul>`;
        }
    }

    // 3. After Stage Story
    const afterStoryPath = `en/gamedata/story/[uc]lua/story/${zoneId}/story_${entity.id}_end.txt`;
    let afterText = await fetchTextFile(afterStoryPath);
    if (!afterText) {
        const afterLegacyPath = `en/gamedata/story/obt/main/level_${entity.id}_end.txt`;
        afterText = await fetchTextFile(afterLegacyPath);
    }

    if (afterText) {
        html += `<h5>[3] After Stage Story loaded</h5>`;
        html += parseStoryText(afterText);
        storyDataFound = true;
    } else {
        html += `<h5>[3] After Stage Story loaded</h5>`;
        html += `<p><em>No post-story text found.</em></p>`;
    }

    if (!storyDataFound && !data.levelId) {
        html += `<p><em>No battle or story data found for this stage using standard pathing logic.</em></p>`;
    }

    html += `<h4>Raw Stage Data</h4><pre>${JSON.stringify(data, null, 2)}</pre>`;
    return html;
}

function renderGeneric(data, entity) {
    let html = `<h3>${entity.name || entity.id}</h3>`;
    html += `<p><strong>File:</strong> ${entity.file}</p>`;
    html += `<h4>Raw Data</h4><pre>${JSON.stringify(data, null, 2)}</pre>`;
    return html;
}

document.getElementById('type-search').addEventListener('input', renderTypes);
document.getElementById('entity-search').addEventListener('input', renderEntities);
document.getElementById('entity-sort').addEventListener('change', renderEntities);

loadIndex();
