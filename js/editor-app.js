/**
 * jmind - Editor Application
 * 编辑器主逻辑：事件处理、快捷键、工具栏、右键菜单、搜索、自动保存
 */
(function () {
  'use strict';

  // ---------- DOM 引用 ----------
  const container = document.getElementById('canvas-container');
  const canvas = document.getElementById('canvas');
  const contextMenu = document.getElementById('context-menu');
  const colorPicker = document.getElementById('color-picker');
  const dropIndicator = document.getElementById('drop-indicator');
  const toastEl = document.getElementById('toast');
  const statsEl = document.getElementById('stats');
  const saveStatusEl = document.getElementById('save-status');
  const searchBar = document.getElementById('search-bar');
  const searchInput = document.getElementById('search-input');
  const searchCount = document.getElementById('search-count');
  const searchPrevBtn = document.getElementById('search-prev');
  const searchNextBtn = document.getElementById('search-next');
  const searchClose = document.getElementById('search-close');
  const nodePopup = document.getElementById('node-popup');
  const outlinePanel = document.getElementById('outline-panel');
  const outlineBtn = document.getElementById('btn-outline');
  const fontPanel = document.getElementById('font-panel');
  const fontSizeSelect = document.getElementById('font-size-select');
  const fontFamilySelect = document.getElementById('font-family-select');
  // 浮动字体面板
  const fontToolbar = document.getElementById('font-toolbar');
  const fontToolSize = document.getElementById('font-tool-size');
  const fontToolFamily = document.getElementById('font-tool-family');
  const fontToolColorBtn = document.getElementById('font-tool-color-btn');
  const fontToolColorPicker = document.getElementById('font-tool-color-picker');
  const fontToolColorBar = document.getElementById('font-tool-color-bar');

  // 翻译函数
  const L = JmindI18n.t;

  // ---------- 状态 ----------
  let currentFileId = null;
  let isDirty = false;
  let autoSaveTimer = null;
  let editingNodeId = null;
  let editorInput = null;
  let dragMode = null;
  let dragStartX = 0, dragStartY = 0;
  let dragStartOffsetX = 0, dragStartOffsetY = 0;
  let dragNodeId = null;
  let dragOverNodeId = null;
  let dragOverPosition = null;
  let isDragging = false;
  const DRAG_THRESHOLD = 8;
  let searchResultIds = [];
  let searchIndex = -1;
  let outlineMode = false;
  let fontToolbarVisible = false;

  // ---------- 初始化模块 ----------
  const ctx = JmindRenderer.init(canvas, container);
  JmindLayout.init(ctx);

  // ---------- 主题应用（外观模式 × 主题色） ----------
  JmindStorage.applyTheme();
  JmindI18n.apply();

  // ---------- 大纲视图初始化 ----------
  if (outlinePanel) {
    JmindOutline.init(outlinePanel, {
      onChange: () => { markDirty(); refreshView(); },
      onIndent: (nodeId) => doAddChild(nodeId),
      onOutdent: (nodeId) => doOutdent(nodeId)
    });
  }

  // ---------- Toast ----------
  let toastTimer = null;
  function showToast(msg, type = 'info') {
    toastEl.textContent = msg;
    toastEl.className = 'toast ' + type;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  // ---------- 保存状态 ----------
  function markDirty() {
    isDirty = true;
    updateSaveStatus();
    scheduleAutoSave();
    updateTitle();
  }

  function markClean() {
    isDirty = false;
    updateSaveStatus();
    updateTitle();
  }

  function updateSaveStatus() {
    if (!saveStatusEl) return;
    saveStatusEl.className = 'save-status ' + (isDirty ? 'dirty' : 'saved');
    const dot = saveStatusEl.querySelector('.dot');
    const text = saveStatusEl.querySelector('.text');
    if (text) text.textContent = isDirty ? L('unsaved') : L('saved');
  }

  function updateTitle() {
    const mindMap = JmindCore.getMindMap();
    const name = mindMap?.text || L('untitled');
    document.title = (isDirty ? '\u25cf ' : '') + name + L('title_suffix');
  }

  function scheduleAutoSave() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      if (isDirty) saveToLocalStorage(true);
    }, 2000);
  }

  // ---------- 文件操作 ----------
  function saveToLocalStorage(silent = false) {
    const mindMap = JmindCore.getMindMap();
    if (!mindMap) { showToast(L('toast_save_empty'), 'error'); return; }
    const data = JmindCore.toExportData();
    if (!currentFileId || currentFileId === 'new') {
      currentFileId = JmindStorage.createFileId();
    }
    JmindStorage.saveFile(currentFileId, data);
    markClean();
    if (!silent) showToast(L('toast_save_success'), 'success');
  }

  function exportToJmind() {
    const mindMap = JmindCore.getMindMap();
    if (!mindMap) { showToast(L('toast_export_empty'), 'error'); return; }
    const data = JmindCore.toExportData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (mindMap.text || L('untitled')) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(L('toast_export_success'), 'success');
  }

  function exportPNG() {
    const mindMap = JmindCore.getMindMap();
    if (!mindMap) { showToast(L('toast_export_empty'), 'error'); return; }
    const positions = JmindLayout.getPositions();
    const collapsed = JmindCore.getCollapsedSet();
    const filename = (mindMap.text || L('untitled')) + '.png';
    const ok = JmindRenderer.exportPNG(positions, collapsed, filename);
    if (ok) showToast(L('toast_png_success'), 'success');
    else showToast(L('toast_png_fail'), 'error');
  }

  function loadFile() {
    const editId = JmindStorage.getEditId();
    if (!editId || editId === 'new') {
      JmindCore.setMindMap(JmindCore.createSampleMindMap());
      currentFileId = 'new';
    } else {
      const fileData = JmindStorage.getFile(editId);
      if (fileData && fileData.root) {
        JmindCore.setMindMap(fileData.root);
        currentFileId = editId;
      } else {
        JmindCore.setMindMap(JmindCore.createSampleMindMap());
        currentFileId = 'new';
      }
    }
    refreshView();
    markClean();
  }

  // ---------- 视图刷新 ----------
  function refreshView() {
    const mindMap = JmindCore.getMindMap();
    const collapsed = JmindCore.getCollapsedSet();
    JmindLayout.layoutTree(mindMap, collapsed);
    JmindRenderer.render(JmindLayout.getPositions(), collapsed);
    if (outlineMode && outlinePanel) {
      JmindOutline.render(JmindRenderer.getSelected());
    }
    updateStats();
    updateNodePopup();
    if (fontToolbarVisible) syncFontToolbar();
  }

  // ---------- 浮动字体面板 ----------
  function showFontToolbar() {
    if (!fontToolbar) return;
    const selected = JmindRenderer.getSelected();
    if (!selected) {
      showToast(L('toast_pick_node'), 'warning');
      return;
    }
    fontToolbarVisible = true;
    fontToolbar.classList.add('active');
    syncFontToolbar();
    // 字体工具栏使用 position:fixed，直接基于视口坐标定位（按钮在画布容器外的工具栏中）
    const fontBtn = document.getElementById('btn-font');
    if (fontBtn) {
      const rect = fontBtn.getBoundingClientRect();
      let left = rect.left;
      let top = rect.bottom + 6;
      const toolbarW = fontToolbar.offsetWidth;
      if (toolbarW > 0) {
        if (left + toolbarW > window.innerWidth - 8) left = window.innerWidth - toolbarW - 8;
        left = Math.max(8, left);
      }
      fontToolbar.style.left = left + 'px';
      fontToolbar.style.top = top + 'px';
    }
  }

  function hideFontToolbar() {
    fontToolbarVisible = false;
    if (fontToolbar) fontToolbar.classList.remove('active');
    if (fontToolColorPicker) fontToolColorPicker.classList.remove('active');
  }

  function toggleFontToolbar() {
    if (fontToolbarVisible) hideFontToolbar();
    else showFontToolbar();
  }

  function syncFontToolbar() {
    if (!fontToolbar) return;
    const node = getSelectedNode();
    if (!node) return;
    const st = JmindCore.getNodeStyle(node);
    fontToolbar.querySelectorAll('.font-tool-btn').forEach(btn => {
      btn.classList.toggle('active', !!st[btn.dataset.fontProp]);
    });
    if (fontToolSize) fontToolSize.value = String(st.fontSize);
    if (fontToolFamily) fontToolFamily.value = st.fontFamily;
    if (fontToolColorBar) fontToolColorBar.style.background = node.color || '#5B9BD5';
  }

  function applyFontToolbarStyle(patch) {
    const selected = JmindRenderer.getSelected();
    if (!selected) return;
    JmindCore.updateNodeStyle(selected, patch);
    refreshView();
    markDirty();
    syncFontToolbar();
  }

  function buildFontToolbar() {
    if (!fontToolbar) return;
    // 加粗/斜体/下划线按钮
    fontToolbar.querySelectorAll('.font-tool-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const node = getSelectedNode();
        if (!node) return;
        const prop = btn.dataset.fontProp;
        const st = JmindCore.getNodeStyle(node);
        applyFontToolbarStyle({ [prop]: !st[prop] });
      });
    });
    // 字号
    if (fontToolSize) {
      fontToolSize.addEventListener('change', () => applyFontToolbarStyle({ fontSize: Number(fontToolSize.value) }));
      fontToolSize.addEventListener('click', (e) => e.stopPropagation());
    }
    // 字体家族
    if (fontToolFamily) {
      fontToolFamily.addEventListener('change', () => applyFontToolbarStyle({ fontFamily: fontToolFamily.value }));
      fontToolFamily.addEventListener('click', (e) => e.stopPropagation());
    }
    // 文字颜色
    if (fontToolColorBtn && fontToolColorPicker) {
      buildFontToolColorPicker();
      fontToolColorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fontToolColorPicker.classList.toggle('active');
      });
    }
  }

  function buildFontToolColorPicker() {
    if (!fontToolColorPicker) return;
    fontToolColorPicker.innerHTML = '';
    const colors = [...JmindCore.getPalette(), JmindCore.getRootColor(), '#34495e', '#e67e22', '#1abc9c', '#2c3e50', '#8e44ad', '#16a085'];
    colors.forEach(color => {
      const swatch = document.createElement('div');
      swatch.className = 'font-tool-color-swatch';
      swatch.style.background = color;
      swatch.dataset.color = color;
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        const selected = JmindRenderer.getSelected();
        if (selected) {
          JmindCore.updateNodeColor(selected, color);
          refreshView();
          markDirty();
          syncFontToolbar();
        }
        fontToolColorPicker.classList.remove('active');
      });
      fontToolColorPicker.appendChild(swatch);
    });
  }

  // ---------- 大纲视图切换 ----------
  function toggleOutlineMode() {
    if (editingNodeId) stopEditing(true);
    if (JmindOutline.isEditing()) JmindOutline.stopEdit(true);
    hideFontToolbar();
    outlineMode = !outlineMode;
    container.classList.toggle('outline-mode', outlineMode);
    if (outlineBtn) outlineBtn.classList.toggle('active', outlineMode);
    if (outlineMode) {
      JmindRenderer.setHovered(null);
      hideNodePopup();
      JmindOutline.render(JmindRenderer.getSelected());
      JmindOutline.reveal(JmindRenderer.getSelected());
    } else {
      refreshView();
    }
  }

  // ---------- 节点浮动快捷菜单 ----------
  function hideNodePopup() {
    nodePopup.classList.remove('active');
  }

  function updateNodePopup() {
    const selectedId = JmindRenderer.getSelected();
    // 编辑中、拖拽中、无选中时隐藏
    if (!selectedId || editingNodeId || (dragMode === 'node' && isDragging)) {
      hideNodePopup();
      return;
    }
    const rect = JmindRenderer.getNodeScreenRect(selectedId, JmindLayout.getPositions());
    if (!rect) { hideNodePopup(); return; }
    const info = JmindCore.getNodeById(selectedId);
    if (!info) { hideNodePopup(); return; }
    const node = info.node;
    const rootId = JmindCore.getMindMap()?.id;
    const isRoot = selectedId === rootId;
    const hasChildren = node.children && node.children.length > 0;

    // 按钮可见性
    nodePopup.querySelector('[data-popup-action="add-sibling"]').classList.toggle('hidden-btn', isRoot);
    nodePopup.querySelector('[data-popup-action="delete"]').classList.toggle('hidden-btn', isRoot);
    const collapseBtn = nodePopup.querySelector('[data-popup-action="toggle-collapse"]');
    collapseBtn.classList.toggle('hidden-btn', !hasChildren);
    // 折叠/展开箭头方向
    collapseBtn.style.transform = node.collapsed ? 'rotate(180deg)' : '';

    // 先显示以获取尺寸
    nodePopup.classList.add('active');
    const popupW = nodePopup.offsetWidth;
    const popupH = nodePopup.offsetHeight;
    const containerRect = container.getBoundingClientRect();

    let left = rect.x + rect.width / 2 - popupW / 2;
    // 水平方向不超出容器
    left = Math.max(6, Math.min(left, containerRect.width - popupW - 6));

    const gap = 8;
    let top = rect.y + rect.height + gap;
    const placeAbove = top + popupH > containerRect.height - 10;
    if (placeAbove) top = rect.y - popupH - gap;
    nodePopup.classList.toggle('popup-above', placeAbove);

    nodePopup.style.left = left + 'px';
    nodePopup.style.top = Math.max(6, top) + 'px';
  }

  function updateStats() {
    const total = JmindCore.countNodes();
    const visible = JmindCore.countVisibleNodes();
    const scale = JmindRenderer.getScale();
    statsEl.textContent = L('stats_nodes', { total, visible }) + ' | ' + L('stats_zoom', { scale: Math.round(scale * 100) });
  }

  // ---------- 节点编辑 ----------
  function startEditing(nodeId) {
    // 大纲模式下使用大纲行内编辑
    if (outlineMode) {
      JmindOutline.startEdit(nodeId);
      return;
    }
    const pos = JmindRenderer.getNodeScreenRect(nodeId, JmindLayout.getPositions());
    if (!pos) return;
    const node = JmindCore.getNodeById(nodeId)?.node;
    if (!node) return;
    editingNodeId = nodeId;
    hideNodePopup();
    hideFontToolbar();
    if (editorInput) editorInput.remove();
    editorInput = document.createElement('textarea');
    editorInput.className = 'node-editor';
    editorInput.value = node.text;
    editorInput.style.left = pos.x + 'px';
    editorInput.style.top = pos.y + 'px';
    editorInput.style.width = Math.max(pos.width, 60) + 'px';
    editorInput.style.height = Math.max(pos.height, 36) + 'px';
    const scale = JmindRenderer.getScale();
    const editStyle = JmindCore.getNodeStyle(node);
    editorInput.style.fontSize = (editStyle.fontSize * scale) + 'px';
    container.appendChild(editorInput);
    editorInput.focus();
    editorInput.select();

    const onFinish = (save) => {
      if (save && editorInput) {
        const newText = editorInput.value.trim() || L('new_node');
        if (newText !== node.text) {
          JmindCore.updateNodeText(nodeId, newText);
          refreshView();
          markDirty();
        }
      }
      if (editorInput) { editorInput.remove(); editorInput = null; }
      editingNodeId = null;
      document.removeEventListener('mousedown', onDocMouseDown);
    };

    const onDocMouseDown = (e) => {
      if (editorInput && !editorInput.contains(e.target)) onFinish(true);
    };

    editorInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onFinish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); onFinish(false); }
    });

    setTimeout(() => document.addEventListener('mousedown', onDocMouseDown), 50);
  }

  function stopEditing(save = true) {
    if (editingNodeId && editorInput) {
      const node = JmindCore.getNodeById(editingNodeId)?.node;
      if (save && node && editorInput.value.trim()) {
        const newText = editorInput.value.trim();
        if (newText !== node.text) {
          JmindCore.updateNodeText(editingNodeId, newText);
          refreshView();
          markDirty();
        }
      }
      editorInput.remove();
      editorInput = null;
      editingNodeId = null;
    }
  }

  // ---------- 操作封装（带脏标记） ----------
  function doAddChild(parentId) {
    const id = JmindCore.addChildNode(parentId);
    if (id) {
      JmindRenderer.setSelected(id);
      refreshView();
      JmindRenderer.triggerAppear(id);
      markDirty();
      startEditing(id);
    }
    return id;
  }

  function doAddSibling(nodeId) {
    if (nodeId === JmindCore.getMindMap()?.id) {
      showToast(L('toast_root_no_sibling'), 'error');
      return null;
    }
    const id = JmindCore.addSiblingNode(nodeId);
    if (id) {
      JmindRenderer.setSelected(id);
      refreshView();
      JmindRenderer.triggerAppear(id);
      markDirty();
      startEditing(id);
    }
    return id;
  }

  function doDelete(nodeId) {
    if (nodeId === JmindCore.getMindMap()?.id) {
      showToast(L('toast_root_no_delete'), 'error');
      return false;
    }
    const ok = JmindCore.deleteNode(nodeId);
    if (ok) {
      JmindRenderer.setSelected(null);
      refreshView();
      markDirty();
    }
    return ok;
  }

  function doToggleCollapse(nodeId) {
    JmindCore.toggleCollapse(nodeId);
    refreshView();
    markDirty();
  }

  function doMove(nodeId, newParentId, newIndex) {
    const ok = JmindCore.moveNode(nodeId, newParentId, newIndex);
    if (ok) {
      refreshView();
      markDirty();
    }
    return ok;
  }

  // 大纲模式：提升层级（Shift+Tab，减少缩进）
  function doOutdent(nodeId) {
    const root = JmindCore.getMindMap();
    if (!nodeId || nodeId === root?.id) {
      showToast(L('toast_root_no_outdent'), 'warning');
      return;
    }
    const parent = JmindCore.getNodeParent(nodeId);
    if (!parent || parent.id === root?.id) {
      showToast(L('toast_outdent_top'), 'warning');
      return;
    }
    const grand = JmindCore.getNodeParent(parent.id);
    if (!grand) return;
    const idx = JmindCore.getNodeIndex(parent.id, grand) + 1;
    if (JmindCore.moveNode(nodeId, grand.id, idx)) {
      JmindRenderer.setSelected(nodeId);
      refreshView();
      markDirty();
      if (outlineMode) JmindOutline.reveal(nodeId);
    }
  }

  function doUndo() {
    if (JmindCore.undo()) {
      refreshView();
      markDirty();
      showToast(L('toast_undo'), 'info');
    } else {
      showToast(L('toast_no_undo'), 'warning');
    }
  }

  function doRedo() {
    if (JmindCore.redo()) {
      refreshView();
      markDirty();
      showToast(L('toast_redo'), 'info');
    } else {
      showToast(L('toast_no_redo'), 'warning');
    }
  }

  function doCopy() {
    const selected = JmindRenderer.getSelected();
    if (selected && JmindCore.copyNode(selected)) {
      showToast(L('toast_copied'), 'success');
    }
  }

  function doPaste() {
    const selected = JmindRenderer.getSelected();
    if (!selected) { showToast(L('toast_pick_target'), 'warning'); return; }
    const id = JmindCore.pasteNode(selected);
    if (id) {
      JmindRenderer.setSelected(id);
      refreshView();
      JmindRenderer.triggerAppear(id);
      markDirty();
      showToast(L('toast_pasted'), 'success');
    } else {
      showToast(L('toast_clipboard_empty'), 'warning');
    }
  }

  function doDuplicate() {
    const selected = JmindRenderer.getSelected();
    if (!selected) return;
    const id = JmindCore.duplicateNode(selected);
    if (id) {
      JmindRenderer.setSelected(id);
      refreshView();
      JmindRenderer.triggerAppear(id);
      markDirty();
      showToast(L('toast_copied'), 'success');
    } else {
      showToast(L('toast_root_no_duplicate'), 'warning');
    }
  }

  function doClearAll() {
    stopEditing(false);
    JmindCore.clearAll();
    JmindRenderer.setSelected(null);
    JmindRenderer.setHovered(null);
    refreshView();
    JmindRenderer.fitToView(JmindLayout.getPositions());
    refreshView();
    markDirty();
    showToast(L('toast_cleared'), 'success');
  }

  // ---------- 搜索 ----------
  function openSearch() {
    searchBar.classList.add('active');
    searchInput.value = '';
    searchResultIds = [];
    searchIndex = -1;
    updateSearchUI();
    setTimeout(() => searchInput.focus(), 50);
  }

  function closeSearch() {
    searchBar.classList.remove('active');
    searchResultIds = [];
    searchIndex = -1;
    JmindRenderer.setSearchResults([], -1);
    refreshView();
  }

  function performSearch(query) {
    if (!query.trim()) {
      searchResultIds = [];
      searchIndex = -1;
    } else {
      searchResultIds = JmindCore.searchNodes(query);
      searchIndex = searchResultIds.length > 0 ? 0 : -1;
    }
    updateSearchUI();
    if (searchIndex >= 0) highlightSearchResult();
  }

  function updateSearchUI() {
    if (searchResultIds.length === 0) {
      searchCount.textContent = searchInput.value ? L('search_empty') : '';
    } else {
      searchCount.textContent = `${searchIndex + 1} / ${searchResultIds.length}`;
    }
    JmindRenderer.setSearchResults(searchResultIds, searchIndex);
    refreshView();
  }

  function highlightSearchResult() {
    if (searchIndex < 0 || searchIndex >= searchResultIds.length) return;
    const id = searchResultIds[searchIndex];
    JmindRenderer.setSelected(id);
    if (outlineMode) {
      JmindOutline.reveal(id);
    } else {
      JmindRenderer.centerOnNode(id, JmindLayout.getPositions());
    }
    refreshView();
  }

  function searchNext() {
    if (searchResultIds.length === 0) return;
    searchIndex = (searchIndex + 1) % searchResultIds.length;
    updateSearchUI();
    highlightSearchResult();
  }

  function searchPrev() {
    if (searchResultIds.length === 0) return;
    searchIndex = (searchIndex - 1 + searchResultIds.length) % searchResultIds.length;
    updateSearchUI();
    highlightSearchResult();
  }

  // ---------- 颜色选择 ----------
  function buildColorPicker() {
    if (!colorPicker) return;
    colorPicker.innerHTML = '';
    const colors = [...JmindCore.getPalette(), JmindCore.getRootColor(), '#34495e', '#e67e22', '#1abc9c'];
    colors.forEach(color => {
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch';
      swatch.style.background = color;
      swatch.dataset.color = color;
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        const selected = JmindRenderer.getSelected();
        if (selected) {
          JmindCore.updateNodeColor(selected, color);
          refreshView();
          markDirty();
        }
        contextMenu.classList.remove('active');
        colorPicker.classList.remove('active');
      });
      colorPicker.appendChild(swatch);
    });
  }

  // ---------- 字体样式 ----------
  function getSelectedNode() {
    const selected = JmindRenderer.getSelected();
    if (!selected) return null;
    return JmindCore.getNodeById(selected)?.node || null;
  }

  function syncFontPanel() {
    if (!fontPanel) return;
    const node = getSelectedNode();
    if (!node) return;
    const st = JmindCore.getNodeStyle(node);
    fontPanel.querySelectorAll('.font-btn').forEach(btn => {
      btn.classList.toggle('active', !!st[btn.dataset.fontProp]);
    });
    if (fontSizeSelect) fontSizeSelect.value = String(st.fontSize);
    if (fontFamilySelect) fontFamilySelect.value = st.fontFamily;
  }

  function applyFontStyle(patch) {
    const selected = JmindRenderer.getSelected();
    if (!selected) return;
    JmindCore.updateNodeStyle(selected, patch);
    refreshView();
    markDirty();
    syncFontPanel();
  }

  function buildFontPanel() {
    if (!fontPanel) return;
    fontPanel.querySelectorAll('.font-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const node = getSelectedNode();
        if (!node) return;
        const prop = btn.dataset.fontProp;
        const st = JmindCore.getNodeStyle(node);
        applyFontStyle({ [prop]: !st[prop] });
      });
    });
    if (fontSizeSelect) {
      fontSizeSelect.addEventListener('change', () => applyFontStyle({ fontSize: Number(fontSizeSelect.value) }));
    }
    if (fontFamilySelect) {
      fontFamilySelect.addEventListener('change', () => applyFontStyle({ fontFamily: fontFamilySelect.value }));
    }
  }

  // ---------- 鼠标事件 ----------
  function getMousePos(e) {
    const rect = container.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, clientX: e.clientX, clientY: e.clientY };
  }

  function onMouseDown(e) {
    if (e.button === 2) return;
    if (editingNodeId && editorInput) {
      if (!editorInput.contains(e.target)) { stopEditing(true); return; }
      else return;
    }
    const pos = getMousePos(e);
    const hit = JmindRenderer.hitTest(pos.x, pos.y, JmindLayout.getPositions());
    if (hit && hit.type === 'collapse-button') {
      doToggleCollapse(hit.id);
      return;
    }
    if (hit && hit.type === 'node') {
      JmindRenderer.setSelected(hit.id);
      dragMode = 'node';
      dragNodeId = hit.id;
      dragStartX = pos.x;
      dragStartY = pos.y;
      isDragging = false;
      container.classList.add('dragging-node');
      refreshView();
    } else {
      JmindRenderer.setSelected(null);
      dragMode = 'pan';
      dragStartX = pos.x;
      dragStartY = pos.y;
      const offset = JmindRenderer.getOffset();
      dragStartOffsetX = offset.x;
      dragStartOffsetY = offset.y;
      isDragging = false;
      refreshView();
    }
  }

  function onMouseMove(e) {
    if (editingNodeId && editorInput) return;
    const pos = getMousePos(e);

    // 悬停检测
    if (!dragMode) {
      const hit = JmindRenderer.hitTest(pos.x, pos.y, JmindLayout.getPositions());
      JmindRenderer.setHovered(hit?.id || null);
      refreshView();
      return;
    }

    if (dragMode === 'pan') {
      const dx = pos.x - dragStartX;
      const dy = pos.y - dragStartY;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) isDragging = true;
      if (isDragging) {
        JmindRenderer.setOffset(dragStartOffsetX + dx, dragStartOffsetY + dy);
        refreshView();
      }
    } else if (dragMode === 'node') {
      const dx = pos.x - dragStartX;
      const dy = pos.y - dragStartY;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        isDragging = true;
        JmindRenderer.setDragging(true);
      }
      if (isDragging && dragNodeId) {
        const target = JmindRenderer.findDropTarget(pos.x, pos.y, JmindLayout.getPositions(), dragNodeId);
        if (target && target.id !== dragNodeId) {
          dragOverNodeId = target.id;
          dragOverPosition = target.position;
        } else {
          dragOverNodeId = null;
          dragOverPosition = null;
        }
        updateDropIndicator();
        refreshView();
      }
    }
  }

  function onMouseUp() {
    if (dragMode === 'node' && isDragging && dragNodeId) {
      if (dragOverNodeId && dragOverPosition) {
        const targetId = dragOverNodeId;
        const position = dragOverPosition;
        if (targetId !== dragNodeId) {
          if (position === 'child') {
            const tr = JmindCore.getNodeById(targetId);
            if (tr) doMove(dragNodeId, targetId, tr.node.children ? tr.node.children.length : 0);
          } else {
            const tp = JmindCore.getNodeParent(targetId);
            if (tp) {
              let ni = position === 'before'
                ? JmindCore.getNodeIndex(targetId, tp)
                : JmindCore.getNodeIndex(targetId, tp) + 1;
              if (JmindCore.getNodeParent(dragNodeId) === tp) {
                const oi = JmindCore.getNodeIndex(dragNodeId, tp);
                if (oi < ni) ni--;
              }
              doMove(dragNodeId, tp.id, ni);
            }
          }
        }
      }
      dragOverNodeId = null;
      dragOverPosition = null;
      container.classList.remove('dragging-node');
    }
    dragMode = null;
    dragNodeId = null;
    isDragging = false;
    JmindRenderer.setDragging(false);
    dragOverNodeId = null;
    dragOverPosition = null;
    hideDropIndicator();
    refreshView();
  }

  function onWheel(e) {
    e.preventDefault();
    const pos = getMousePos(e);
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    JmindRenderer.zoomAt(pos.x, pos.y, delta);
    refreshView();
  }

  function onDoubleClick(e) {
    const pos = getMousePos(e);
    const hit = JmindRenderer.hitTest(pos.x, pos.y, JmindLayout.getPositions());
    if (hit && hit.type === 'node') {
      startEditing(hit.id);
    } else {
      // 后备：如果双击位置没命中节点，但有选中的节点，编辑选中节点
      const selected = JmindRenderer.getSelected();
      if (selected) startEditing(selected);
    }
  }

  function onContextMenu(e) {
    e.preventDefault();
    const pos = getMousePos(e);
    const hit = JmindRenderer.hitTest(pos.x, pos.y, JmindLayout.getPositions());
    if (hit && hit.type === 'node') {
      JmindRenderer.setSelected(hit.id);
      refreshView();
      contextMenu.classList.add('active');
      contextMenu.style.left = pos.clientX + 'px';
      contextMenu.style.top = pos.clientY + 'px';
      if (colorPicker) colorPicker.classList.remove('active');
      if (fontPanel) fontPanel.classList.remove('active');
      const mr = contextMenu.getBoundingClientRect();
      if (mr.right > window.innerWidth) contextMenu.style.left = (pos.clientX - mr.width) + 'px';
      if (mr.bottom > window.innerHeight) contextMenu.style.top = (pos.clientY - mr.height) + 'px';
    } else {
      contextMenu.classList.remove('active');
    }
  }

  function updateDropIndicator() {
    if (!dragOverNodeId || !dragOverPosition) { hideDropIndicator(); return; }
    const targetPos = JmindLayout.getPosition(dragOverNodeId);
    if (!targetPos) { hideDropIndicator(); return; }
    const s = JmindRenderer.worldToScreen(targetPos.x, targetPos.y);
    const scale = JmindRenderer.getScale();
    const w = targetPos.width * scale;
    const h = targetPos.height * scale;
    let ix = s.x, iy = s.y, iw = w, ih = h;
    if (dragOverPosition === 'child') {
      const inset = 6 * scale;
      ix = s.x - inset; iy = s.y - inset; iw = w + inset * 2; ih = h + inset * 2;
    } else if (dragOverPosition === 'before') {
      iy = s.y - 6 * scale; ih = 12 * scale;
    } else if (dragOverPosition === 'after') {
      iy = s.y + h - 6 * scale; ih = 12 * scale;
    }
    dropIndicator.style.display = 'block';
    dropIndicator.style.left = ix + 'px';
    dropIndicator.style.top = iy + 'px';
    dropIndicator.style.width = iw + 'px';
    dropIndicator.style.height = ih + 'px';
  }

  function hideDropIndicator() {
    dropIndicator.style.display = 'none';
  }

  // ---------- 键盘快捷键 ----------
  function onKeyDown(e) {
    if (e.target === editorInput || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
      if (e.key === 'Escape' && e.target === searchInput) {
        closeSearch();
      }
      return;
    }
    const key = e.key;
    const ctrl = e.ctrlKey || e.metaKey;
    const selected = JmindRenderer.getSelected();
    const mindMap = JmindCore.getMindMap();

    if (ctrl && e.shiftKey && (key === 'O' || key === 'o')) { e.preventDefault(); toggleOutlineMode(); return; }
    if (ctrl && key === 's') { e.preventDefault(); saveToLocalStorage(); return; }
    if (ctrl && key === 'z' && !e.shiftKey) { e.preventDefault(); doUndo(); return; }
    if (ctrl && (key === 'y' || (key === 'z' && e.shiftKey))) { e.preventDefault(); doRedo(); return; }
    if (ctrl && key === 'f') { e.preventDefault(); openSearch(); return; }
    if (ctrl && key === 'c') { e.preventDefault(); doCopy(); return; }
    if (ctrl && key === 'v') { e.preventDefault(); doPaste(); return; }
    if (ctrl && key === 'd') { e.preventDefault(); doDuplicate(); return; }
    // 字体快捷键
    if (ctrl && (key === 'b' || key === 'B')) { e.preventDefault(); if (selected) { const st = JmindCore.getNodeStyle(getSelectedNode()); applyFontToolbarStyle({ bold: !st.bold }); } return; }
    if (ctrl && (key === 'i' || key === 'I')) { e.preventDefault(); if (selected) { const st = JmindCore.getNodeStyle(getSelectedNode()); applyFontToolbarStyle({ italic: !st.italic }); } return; }
    if (ctrl && (key === 'u' || key === 'U')) { e.preventDefault(); if (selected) { const st = JmindCore.getNodeStyle(getSelectedNode()); applyFontToolbarStyle({ underline: !st.underline }); } return; }

    // 大纲模式方向键导航
    if (outlineMode && (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight')) {
      e.preventDefault();
      JmindOutline.navigate(key);
      return;
    }

    // 大纲模式：Shift+Tab 提升层级
    if (outlineMode && e.shiftKey && key === 'Tab') {
      e.preventDefault();
      if (selected) doOutdent(selected);
      return;
    }

    if (key === 'Tab') {
      e.preventDefault();
      if (selected) doAddChild(selected);
      else if (mindMap) { JmindRenderer.setSelected(mindMap.id); doAddChild(mindMap.id); }
    } else if (key === 'Enter') {
      e.preventDefault();
      if (selected && selected !== mindMap?.id) doAddSibling(selected);
    } else if (key === 'Delete' || key === 'Backspace') {
      e.preventDefault();
      if (selected) doDelete(selected);
    } else if (key === ' ') {
      e.preventDefault();
      if (selected) doToggleCollapse(selected);
    } else if (key === 'F2') {
      e.preventDefault();
      if (selected) startEditing(selected);
    } else if (key === 'Escape') {
      contextMenu.classList.remove('active');
      if (searchBar.classList.contains('active')) closeSearch();
      hideFontToolbar();
      stopEditing(false);
      refreshView();
    } else if (key === '+' || key === '=') {
      e.preventDefault();
      JmindRenderer.zoomCenter(1.15);
      refreshView();
    } else if (key === '-') {
      e.preventDefault();
      JmindRenderer.zoomCenter(0.87);
      refreshView();
    } else if (key === '0') {
      e.preventDefault();
      JmindRenderer.fitToView(JmindLayout.getPositions());
      refreshView();
    }
  }

  // ---------- 触摸支持 ----------
  let touchStartX = 0, touchStartY = 0, touchStartDist = 0, touchStartScale = 1;

  // 检查触摸目标是否在 UI 元素上（浮动菜单、字体面板、搜索栏等）
  function isTouchOnUI(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return false;
    return !!(el.closest('.node-popup') || el.closest('.font-toolbar') || el.closest('.search-bar') || el.closest('.context-menu') || el.closest('.node-editor') || el.closest('.outline-toolbar') || el.closest('.outline-panel') || el.closest('.drop-indicator'));
  }

  function initTouch() {
    container.addEventListener('touchstart', (e) => {
      // 大纲模式下不处理画布触摸，避免干扰大纲面板的点击/选中
      if (outlineMode) return;
      if (editingNodeId && editorInput) {
        const touch = e.touches[0];
        if (!editorInput.contains(document.elementFromPoint(touch.clientX, touch.clientY))) stopEditing(true);
        return;
      }
      // 如果触摸目标在 UI 元素上（浮动菜单、字体面板等），跳过节点检测
      if (e.touches.length === 1 && isTouchOnUI(e.touches[0].clientX, e.touches[0].clientY)) {
        return;
      }
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const rect = container.getBoundingClientRect();
        touchStartX = touch.clientX - rect.left;
        touchStartY = touch.clientY - rect.top;
        const hit = JmindRenderer.hitTest(touchStartX, touchStartY, JmindLayout.getPositions());
        if (hit && hit.type === 'node') {
          JmindRenderer.setSelected(hit.id);
          dragMode = 'node';
          dragNodeId = hit.id;
          isDragging = false;
          refreshView();
        } else {
          dragMode = 'pan';
          const offset = JmindRenderer.getOffset();
          dragStartOffsetX = offset.x;
          dragStartOffsetY = offset.y;
          isDragging = false;
        }
      } else if (e.touches.length === 2) {
        touchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        touchStartScale = JmindRenderer.getScale();
        dragMode = 'pinch';
      }
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
      // 大纲模式下不处理画布触摸，保证大纲列表可滚动、点击可正常合成
      if (outlineMode) return;
      if (editingNodeId && editorInput) return;
      if (e.touches.length === 1 && dragMode === 'pan') {
        const touch = e.touches[0];
        const rect = container.getBoundingClientRect();
        const dx = touch.clientX - rect.left - touchStartX;
        const dy = touch.clientY - rect.top - touchStartY;
        if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) isDragging = true;
        if (isDragging) {
          JmindRenderer.setOffset(dragStartOffsetX + dx, dragStartOffsetY + dy);
          refreshView();
        }
      } else if (e.touches.length === 1 && dragMode === 'node') {
        const touch = e.touches[0];
        const rect = container.getBoundingClientRect();
        const dx = touch.clientX - rect.left - touchStartX;
        const dy = touch.clientY - rect.top - touchStartY;
        if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
          isDragging = true;
          JmindRenderer.setDragging(true);
        }
        if (isDragging && dragNodeId) {
          const tx = touch.clientX - rect.left;
          const ty = touch.clientY - rect.top;
          const target = JmindRenderer.findDropTarget(tx, ty, JmindLayout.getPositions(), dragNodeId);
          if (target && target.id !== dragNodeId) {
            dragOverNodeId = target.id;
            dragOverPosition = target.position;
          } else {
            dragOverNodeId = null;
            dragOverPosition = null;
          }
          updateDropIndicator();
          refreshView();
        }
      } else if (e.touches.length === 2 && dragMode === 'pinch') {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        JmindRenderer.setScale(touchStartScale * (dist / touchStartDist));
        refreshView();
      }
    }, { passive: true });

    container.addEventListener('touchend', () => {
      // 大纲模式下不处理画布触摸，避免 refreshView 重建大纲 DOM 导致点击选中失效
      if (outlineMode) return;
      if (dragMode === 'node' && isDragging && dragNodeId && dragOverNodeId) {
        const targetId = dragOverNodeId;
        const position = dragOverPosition;
        if (targetId !== dragNodeId) {
          if (position === 'child') {
            const tr = JmindCore.getNodeById(targetId);
            if (tr) doMove(dragNodeId, targetId, tr.node.children ? tr.node.children.length : 0);
          } else {
            const tp = JmindCore.getNodeParent(targetId);
            if (tp) {
              let ni = position === 'before'
                ? JmindCore.getNodeIndex(targetId, tp)
                : JmindCore.getNodeIndex(targetId, tp) + 1;
              if (JmindCore.getNodeParent(dragNodeId) === tp) {
                const oi = JmindCore.getNodeIndex(dragNodeId, tp);
                if (oi < ni) ni--;
              }
              doMove(dragNodeId, tp.id, ni);
            }
          }
        }
      }
      dragMode = null;
      dragNodeId = null;
      isDragging = false;
      JmindRenderer.setDragging(false);
      dragOverNodeId = null;
      dragOverPosition = null;
      container.classList.remove('dragging-node');
      hideDropIndicator();
      refreshView();
    }, { passive: true });
  }

  // ---------- 离开页面前保存 ----------
  function onBeforeUnload(e) {
    if (isDirty) {
      saveToLocalStorage(true);
    }
  }

  // ---------- 工具栏绑定 ----------
  function bindToolbar() {
    document.getElementById('btn-back').addEventListener('click', () => {
      if (isDirty) saveToLocalStorage(true);
      window.location.href = 'index.html';
    });
    document.getElementById('btn-save').addEventListener('click', () => saveToLocalStorage());
    document.getElementById('btn-export').addEventListener('click', exportToJmind);
    document.getElementById('btn-export-png').addEventListener('click', exportPNG);
    document.getElementById('btn-undo').addEventListener('click', doUndo);
    document.getElementById('btn-redo').addEventListener('click', doRedo);
    document.getElementById('btn-add-child').addEventListener('click', () => {
      const selected = JmindRenderer.getSelected();
      if (selected) doAddChild(selected);
      else if (JmindCore.getMindMap()) {
        const root = JmindCore.getMindMap();
        JmindRenderer.setSelected(root.id);
        doAddChild(root.id);
      }
    });
    document.getElementById('btn-add-sibling').addEventListener('click', () => {
      const selected = JmindRenderer.getSelected();
      const root = JmindCore.getMindMap();
      if (selected && selected !== root?.id) doAddSibling(selected);
      else showToast(L('toast_pick_nonroot'), 'error');
    });
    document.getElementById('btn-edit').addEventListener('click', () => {
      const selected = JmindRenderer.getSelected();
      if (selected) startEditing(selected);
      else showToast(L('toast_pick_node'), 'warning');
    });
    // 字体按钮
    const fontBtn = document.getElementById('btn-font');
    if (fontBtn) fontBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFontToolbar();
    });
    document.getElementById('btn-delete').addEventListener('click', () => {
      const selected = JmindRenderer.getSelected();
      if (selected) doDelete(selected);
    });
    document.getElementById('btn-collapse').addEventListener('click', () => {
      const selected = JmindRenderer.getSelected();
      if (selected) doToggleCollapse(selected);
    });
    document.getElementById('btn-search').addEventListener('click', openSearch);
    if (outlineBtn) outlineBtn.addEventListener('click', toggleOutlineMode);
    document.getElementById('btn-zoom-in').addEventListener('click', () => {
      JmindRenderer.zoomCenter(1.15);
      refreshView();
    });
    document.getElementById('btn-zoom-out').addEventListener('click', () => {
      JmindRenderer.zoomCenter(0.87);
      refreshView();
    });
    document.getElementById('btn-fit').addEventListener('click', () => {
      JmindRenderer.fitToView(JmindLayout.getPositions());
      refreshView();
    });
    document.getElementById('btn-clear').addEventListener('click', doClearAll);

    // 右键菜单
    contextMenu.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        // 子菜单类操作（颜色/字体）保持菜单打开，其余操作收起菜单
        if (action !== 'change-color' && action !== 'font-style') {
          contextMenu.classList.remove('active');
        }
        if (colorPicker) colorPicker.classList.remove('active');
        if (fontPanel) fontPanel.classList.remove('active');
        const selected = JmindRenderer.getSelected();
        if (!selected && action !== 'clear') return;
        switch (action) {
          case 'add-child': doAddChild(selected); break;
          case 'add-sibling': doAddSibling(selected); break;
          case 'toggle-collapse': doToggleCollapse(selected); break;
          case 'edit': startEditing(selected); break;
          case 'copy': doCopy(); break;
          case 'paste': doPaste(); break;
          case 'duplicate': doDuplicate(); break;
          case 'change-color':
            if (colorPicker) colorPicker.classList.toggle('active');
            break;
          case 'font-style':
            if (fontPanel) {
              fontPanel.classList.toggle('active');
              if (fontPanel.classList.contains('active')) syncFontPanel();
            }
            break;
          case 'delete': doDelete(selected); break;
          case 'clear': doClearAll(); break;
        }
      });
    });

    // 搜索栏
    searchInput.addEventListener('input', (e) => performSearch(e.target.value));
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? searchPrev() : searchNext(); }
      else if (e.key === 'Escape') { e.preventDefault(); closeSearch(); }
    });
    searchNextBtn.addEventListener('click', searchNext);
    searchPrevBtn.addEventListener('click', searchPrev);
    searchClose.addEventListener('click', closeSearch);

    // 节点浮动快捷菜单
    nodePopup.addEventListener('mousedown', (e) => e.stopPropagation());
    nodePopup.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    nodePopup.querySelectorAll('.popup-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.popupAction;
        const selected = JmindRenderer.getSelected();
        if (!selected) return;
        switch (action) {
          case 'add-child': doAddChild(selected); break;
          case 'add-sibling': doAddSibling(selected); break;
          case 'edit': startEditing(selected); break;
          case 'font': toggleFontToolbar(); break;
          case 'toggle-collapse': doToggleCollapse(selected); break;
          case 'duplicate': doDuplicate(); break;
          case 'delete': doDelete(selected); break;
        }
      });
    });

    // 画布鼠标事件
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);
    canvas.addEventListener('dblclick', onDoubleClick);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);

    // 大纲面板右键菜单
    if (outlinePanel) {
      outlinePanel.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const item = e.target.closest('.outline-item');
        if (!item) return;
        const nodeId = item.dataset.id;
        JmindRenderer.setSelected(nodeId);
        JmindOutline.render(nodeId);
        contextMenu.classList.add('active');
        contextMenu.style.left = e.clientX + 'px';
        contextMenu.style.top = e.clientY + 'px';
        if (colorPicker) colorPicker.classList.remove('active');
        if (fontPanel) fontPanel.classList.remove('active');
        const mr = contextMenu.getBoundingClientRect();
        if (mr.right > window.innerWidth) contextMenu.style.left = (e.clientX - mr.width) + 'px';
        if (mr.bottom > window.innerHeight) contextMenu.style.top = (e.clientY - mr.height) + 'px';
      });
    }

    // 全局
    document.addEventListener('mousedown', (e) => {
      if (!contextMenu.contains(e.target)) {
        contextMenu.classList.remove('active');
        if (colorPicker) colorPicker.classList.remove('active');
        if (fontPanel) fontPanel.classList.remove('active');
      }
      // 点击浮动字体面板外部关闭
      if (fontToolbar && !fontToolbar.contains(e.target) && !e.target.closest('#btn-font')) {
        hideFontToolbar();
      }
    });
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', () => refreshView());
    window.addEventListener('beforeunload', onBeforeUnload);
  }

  // ---------- 启动 ----------
  function init() {
    buildColorPicker();
    buildFontPanel();
    buildFontToolbar();
    loadFile();
    bindToolbar();
    initTouch();
    JmindRenderer.fitToView(JmindLayout.getPositions());
    refreshView();
    updateSaveStatus();
  }

  init();
})();
