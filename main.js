// --- STATE & UTILS ---
const state = {
  tabs: [], 
  activeTabId: null, 
  nextTabId: 1, 
  shCategory: 'new', // Fixed: track active Script Hub category
  shFilters: { keyless: false, free: false, mobile: false, verified: false, updated_week: false }
};
let editor = null;
let editorReady = false;

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
function updateUIState() {
  const welcome = document.getElementById('welcome-screen');
  const tabsWrap = document.getElementById('editor-tabs-wrapper');
  const monaco = document.getElementById('monaco-host');
  const toolbar = document.getElementById('editor-toolbar');
  const consoleWrap = document.getElementById('console-panel-wrapper');

  // Always show tabs wrapper in editor view
  tabsWrap.style.display = 'flex';
  
  const current = activeTab();
  if (current && current.name === 'Welcome') {
    welcome.style.display = 'flex';
    monaco.style.display = 'none';
    toolbar.style.display = 'none';
    consoleWrap.style.display = 'none';
  } else {
    welcome.style.display = 'none';
    monaco.style.display = 'block';
    toolbar.style.display = 'flex';
    consoleWrap.style.display = 'flex';
    
    // Sync editor content if switching to a code tab
    if (editor && current) {
      editor.setValue(current.content || '');
      editor.focus();
    }
  }
  renderEditorTabs();
}

function renderEditorTabs() {
  const container = document.getElementById('editor-tabs');
  if (!container) return;
  container.innerHTML = '';
  
  state.tabs.forEach(tab => {
    const el = document.createElement('div');
    const isWelcome = tab.name === 'Welcome';
    el.className = `etab ${tab.id === state.activeTabId ? 'active' : ''} ${tab.dirty ? 'dirty' : ''}`;
    
    let closeHtml = '';
    if (!isWelcome) {
      closeHtml = `<span class="etab-close" onclick="event.stopPropagation(); closeTab('${tab.id}')">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </span>`;
    }

    el.innerHTML = `<span class="etab-name">${tab.name}</span>${closeHtml}`;
    el.onclick = () => activateTab(tab.id);
    container.appendChild(el);
  });
  
  const nameEl = document.getElementById('active-tab-name');
  const a = activeTab();
  if (nameEl) nameEl.textContent = a ? a.name : '';
}

function addTab(name = 'Untitled', content = '', path = null) {
  const tab = { id: uid(), name, content, dirty: false, path };
  state.tabs.push(tab);
  activateTab(tab.id);
  return tab;
}

function activateTab(id) {
  const cur = activeTab();
  if (cur && editor && cur.name !== 'Welcome') cur.content = editor.getValue();
  state.activeTabId = id;
  updateUIState();
}

function closeTab(id) {
  const idx = state.tabs.findIndex((t) => t.id === id);
  if (idx < 0) return;
  
  // Prevent closing Welcome tab
  if (state.tabs[idx].name === 'Welcome') return;

  const wasActive = state.activeTabId === id;
  state.tabs.splice(idx, 1);
  
  if (wasActive) {
    if (state.tabs.length > 0) {
      const next = state.tabs[Math.min(idx, state.tabs.length - 1)];
      activateTab(next.id);
    }
  } else {
    renderEditorTabs();
  }
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
      value:'', language:'plaintext', theme:'vs-dark',
      automaticLayout:true, minimap:{enabled:false}, fontSize:13, fontFamily:'Consolas, Menlo, monospace',
      scrollBeyondLastLine:false, renderWhitespace:'selection', tabSize:2
    });
    editor.onDidChangeModelContent(() => {
      const t = activeTab(); if(t && editor.getValue() !== t.content) {
        t.content = editor.getValue(); if(!t.dirty){t.dirty=true; renderEditorTabs();}
      }
    });
    
    editorReady = true;
    
    // Initialize Welcome Tab permanently
    const welcomeTab = { id: 'welcome', name: 'Welcome', content: '', dirty: false, path: null };
    state.tabs.push(welcomeTab);
    state.activeTabId = 'welcome';
    updateUIState();
  });
}

// --- SCRIPT HUB (Fixed Category Switching) ---
async function fetchScripts(query='', category='new') {
  const grid = document.getElementById('sh-grid');
  grid.innerHTML = '<div class="loading-state">Fetching from Scriptblox...</div>';
  
  try {
    // Use category parameter for API filtering if supported
    const url = `https://scriptblox.com/api/script/search?q=${encodeURIComponent(query)}&page=1`;
    const res = await fetch(url);
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

// Fix: Script Hub Category Click Handlers
document.querySelectorAll('.sh-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.sh-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    state.shCategory = tab.dataset.sort;
    fetchScripts(document.getElementById('sh-search').value, state.shCategory);
  });
});

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
document.getElementById('apply-filters').onclick = () => { filterModal.classList.add('hidden'); fetchScripts(document.getElementById('sh-search').value, state.shCategory); };
document.getElementById('reset-filters').onclick = () => { 
  document.querySelectorAll('.toggle-pill').forEach(p=>p.classList.remove('active')); 
  Object.keys(state.shFilters).forEach(k=>state.shFilters[k]=false); 
};
document.getElementById('sh-search').addEventListener('input', (e) => fetchScripts(e.target.value, state.shCategory));

// --- SETTINGS LOGIC ---
document.querySelectorAll('.settings-nav-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.settings-nav-item').forEach(i=>i.classList.remove('active'));
    document.querySelectorAll('.setting-pane').forEach(p=>p.classList.remove('active'));
    item.classList.add('active');
    const target = document.getElementById(`setting-${item.dataset.setting}`);
    if(target) target.classList.add('active');
    else document.getElementById('setting-resources').classList.add('active');
  });
});

// --- INIT ---
window.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  initEditor(); 
  fetchScripts('', 'new'); // Initial load
  log('dim', 'Lunar UI ready'); 
  setStatus('ready');
  
  // Add Tab Button
  document.getElementById('add-tab-btn').addEventListener('click', () => {
    if(editorReady) addTab('Untitled', '');
  });

  // Global shortcuts
  window.addEventListener('keydown', (e) => {
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='s') { e.preventDefault(); log('dim','Save triggered (mock)'); }
    if((e.ctrlKey||e.metaKey) && e.key==='Enter') { e.preventDefault(); log('success','Execute triggered (mock)'); }
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='n') { 
      e.preventDefault(); 
      if(editorReady) addTab('Untitled', ''); 
    }
  });
});
