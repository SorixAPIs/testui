// --- STATE & UTILS ---
const state = {
  tabs: [], activeTabId: null, nextTabId: 1, scripts: [], filter: '',
  shSort: 'new', shFilters: { keyless: false, free: false, mobile: false, verified: false, updated_week: false }
};
let editor = null;

function uid() { return `t${state.nextTabId++}`; }
function activeTab() { return state.tabs.find((t) => t.id === state.activeTabId) || null; }
function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function setStatus(t) { const el = document.getElementById('status-text'); if(el) el.textContent = t; }

function log(level, msg) {
  const body = document.getElementById('console-body'); if(!body) return;
  const line = document.createElement('div'); line.className = `console-line ${level}`;
  const ts = new Date().toLocaleTimeString([], {hour12:false});
  line.innerHTML = `<span class="ts">[${ts}]</span>${escapeHtml(msg)}`;
  body.appendChild(line); body.scrollTop = body.scrollHeight;
}

// --- NAVIGATION ---
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// --- EDITOR LOGIC ---
function renderTabs() {
  // Simplified for web preview: just update toolbar name
  const a = activeTab();
  const el = document.getElementById('active-tab-name');
  if(el) el.textContent = a ? a.name : '';
}

function addTab(name='untitled', content='', path=null) {
  const tab = {id:uid(), name, content, dirty:false, path};
  state.tabs.push(tab); activateTab(tab.id); return tab;
}

function activateTab(id) {
  const cur = activeTab(); if(cur && editor) cur.content = editor.getValue();
  state.activeTabId = id; const tab = activeTab();
  if(editor && tab) { editor.setValue(tab.content||''); editor.focus(); }
  renderTabs();
}

function initEditor() {
  require.config({paths:{vs:'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs'}});
  require(['vs/editor/editor.main'], () => {
    if(!monaco.languages.getLanguages().some(l=>l.id==='luau')) {
      monaco.languages.register({id:'luau'});
      monaco.languages.setMonarchTokensProvider('luau', {
        tokenizer:{root:[
          [/--\[\[[\s\S]*?\]\]/,'comment'],[/--.*$/,'comment'],
          [/\b(local|function|end|if|then|else|elseif|for|while|do|return|true|false|nil|and|or|not|in|repeat|until|break)\b/,'keyword'],
          [/\b(print|require|tonumber|tostring|type|pcall|xpcall|table|string|math|game|workspace|script)\b/,'type'],
          [/"([^"\\]|\\.)*"/,'string'],[/'([^'\\]|\\.)*'/,'string'],[/\d+(\.\d+)?/,'number'],
          [/[a-zA-Z_][a-zA-Z0-9_]*/,'identifier'],[/[{}()\[\]]/,'delimiter'],[/[+\-*/%=<>~^#]/,'operator']
        ]}
      });
    }
    editor = monaco.editor.create(document.getElementById('monaco-host'), {
      value:'-- welcome to Lunar\nprint("hello skid works")\n', language:'plaintext', theme:'vs-dark',
      automaticLayout:true, minimap:{enabled:false}, fontSize:13, fontFamily:'Consolas, Menlo, monospace',
      scrollBeyondLastLine:false, renderWhitespace:'selection', tabSize:2
    });
    editor.onDidChangeModelContent(() => {
      const t = activeTab(); if(t && editor.getValue() !== t.content) {
        t.content = editor.getValue(); if(!t.dirty){t.dirty=true; renderTabs();}
      }
    });
    if(state.tabs.length===0) addTab('Start', '-- welcome to Lunar\nprint("hello skid works")\n');
    else { const t=activeTab(); if(t&&editor) editor.setValue(t.content); }
  });
}

// Sidebar Mock
function renderSidebar() {
  const tree = document.getElementById('sidebar-tree'); tree.innerHTML='';
  const mock = [{name:'aimbot.luau'},{name:'esp.luau'},{name:'auto_farm.lua'}];
  mock.forEach(s => {
    const div = document.createElement('div'); div.className='tree-node'; div.textContent=s.name;
    div.onclick = () => { addTab(s.name, `-- loaded ${s.name}\n`); };
    tree.appendChild(div);
  });
}

// --- SCRIPT HUB (Scriptblox API) ---
async function fetchScripts(query='') {
  const grid = document.getElementById('sh-grid');
  grid.innerHTML = '<div class="loading-state">Fetching from Scriptblox...</div>';
  try {
    const res = await fetch(`https://scriptblox.com/api/script/search?q=${encodeURIComponent(query)}&page=1`);
    const data = await res.json();
    const scripts = data.result?.scripts || [];
    grid.innerHTML = '';
    if(scripts.length === 0) {
      grid.innerHTML = '<div class="loading-state">No scripts found.</div>';
      return;
    }
    scripts.forEach(s => {
      const card = document.createElement('div'); card.className='script-card';
      const badges = [];
      if(s.isPatched) badges.push('<span class="badge key">Patched</span>');
      if(s.game?.name) badges.push(`<span class="badge mobile">${s.game.name}</span>`);
      
      card.innerHTML = `
        <div class="card-thumb">
          <img src="${s.thumbnailUrl || 'https://via.placeholder.com/300x140/202023/404040?text=No+Image'}" alt="${s.title}" loading="lazy">
          <div class="card-badges">${badges.join('')}</div>
        </div>
        <div class="card-body">
          <div class="card-title">${s.title}</div>
          <div class="card-meta">
            <div class="card-author">
              <div class="author-avatar"></div>
              <span>${s.owner?.username || 'Unknown'}</span>
            </div>
            <div class="card-stats">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              ${s.views || 0}
            </div>
          </div>
          <div class="card-actions">
            <button class="action-btn execute" onclick="copyScript('${s.rawScriptUrl || ''}')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              Execute
            </button>
            <button class="action-btn" onclick="window.open('${s.url}', '_blank')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
              Open
            </button>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });
  } catch(e) {
    grid.innerHTML = `<div class="loading-state" style="color:var(--error)">Failed to load scripts: ${e.message}</div>`;
  }
}

window.copyScript = async (url) => {
  if(!url) { log('error', 'No raw script URL available'); return; }
  try {
    const res = await fetch(url); const code = await res.text();
    if(editor) { addTab('ScriptHub Script', code); log('success', 'Script copied to new tab'); }
    else log('error', 'Editor not initialized');
  } catch(e) { log('error', 'Failed to fetch script source'); }
};

// Filter Modal Logic
const filterModal = document.getElementById('sh-filter-modal');
document.getElementById('sh-filter-btn').onclick = () => filterModal.classList.remove('hidden');
document.getElementById('close-filter-modal').onclick = () => filterModal.classList.add('hidden');
document.querySelectorAll('.toggle-pill').forEach(pill => {
  pill.onclick = () => { pill.classList.toggle('active'); state.shFilters[pill.dataset.key] = pill.classList.contains('active'); };
});
document.getElementById('apply-filters').onclick = () => { filterModal.classList.add('hidden'); fetchScripts(document.getElementById('sh-search').value); };
document.getElementById('reset-filters').onclick = () => { 
  document.querySelectorAll('.toggle-pill').forEach(p=>p.classList.remove('active')); 
  Object.keys(state.shFilters).forEach(k=>state.shFilters[k]=false); 
};
document.getElementById('sh-search').addEventListener('input', (e) => fetchScripts(e.target.value));

// --- SETTINGS LOGIC ---
document.querySelectorAll('.settings-nav-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.settings-nav-item').forEach(i=>i.classList.remove('active'));
    document.querySelectorAll('.setting-pane').forEach(p=>p.classList.remove('active'));
    item.classList.add('active');
    const target = document.getElementById(`setting-${item.dataset.setting}`);
    if(target) target.classList.add('active');
    else document.getElementById('setting-resources').classList.add('active'); // fallback
  });
});

// --- INIT ---
window.addEventListener('DOMContentLoaded', () => {
  initEditor(); renderSidebar(); fetchScripts();
  log('dim', 'Lunar UI ready'); setStatus('ready');
  
  // Global shortcuts
  window.addEventListener('keydown', (e) => {
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='s') { e.preventDefault(); log('dim','Save triggered (mock)'); }
    if((e.ctrlKey||e.metaKey) && e.key==='Enter') { e.preventDefault(); log('success','Execute triggered (mock)'); }
  });
});
