/**
 * jmind - Editor Application
 * 编辑器主逻辑：事件处理、快捷键、工具栏、右键菜单、搜索、自动保存
 */
(function () {
  'use strict';

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

  let currentFileId = null, isDirty = false, autoSaveTimer = null;
  let editingNodeId = null, editorInput = null;
  let dragMode = null, dragStartX = 0, dragStartY = 0, dragStartOffsetX = 0, dragStartOffsetY = 0;
  let dragNodeId = null, dragOverNodeId = null, dragOverPosition = null, isDragging = false;
  const DRAG_THRESHOLD = 5;
  let searchResultIds = [], searchIndex = -1;

  const ctx = JmindRenderer.init(canvas, container);
  JmindLayout.init(ctx);

  function applyTheme() { const settings = JmindStorage.getSettings(); document.documentElement.setAttribute('data-theme', settings.theme || 'default'); }
  applyTheme();

  let toastTimer = null;
  function showToast(msg, type = 'info') { toastEl.textContent = msg; toastEl.className = 'toast ' + type; toastEl.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200); }

  function markDirty() { isDirty = true; updateSaveStatus(); scheduleAutoSave(); updateTitle(); }
  function markClean() { isDirty = false; updateSaveStatus(); updateTitle(); }
  function updateSaveStatus() { if (!saveStatusEl) return; saveStatusEl.className = 'save-status ' + (isDirty ? 'dirty' : 'saved'); const t = saveStatusEl.querySelector('.text'); if (t) t.textContent = isDirty ? '未保存' : '已保存'; }
  function updateTitle() { const m = JmindCore.getMindMap(); document.title = (isDirty ? '● ' : '') + (m?.text || '未命名') + ' - jmind 编辑器'; }
  function scheduleAutoSave() { clearTimeout(autoSaveTimer); autoSaveTimer = setTimeout(() => { if (isDirty) saveToLocalStorage(true); }, 2000); }

  function saveToLocalStorage(silent = false) {
    const mindMap = JmindCore.getMindMap(); if (!mindMap) { showToast('没有内容可保存', 'error'); return; }
    if (!currentFileId || currentFileId === 'new') currentFileId = JmindStorage.createFileId();
    JmindStorage.saveFile(currentFileId, JmindCore.toExportData());
    markClean(); if (!silent) showToast('保存成功', 'success');
  }
  function exportToJmind() {
    const mindMap = JmindCore.getMindMap(); if (!mindMap) { showToast('没有可导出的内容', 'error'); return; }
    const json = JSON.stringify(JmindCore.toExportData(), null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = (mindMap.text || '思维导图') + '.jmind'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    showToast('导出成功', 'success');
  }
  function exportPNG() {
    const mindMap = JmindCore.getMindMap(); if (!mindMap) { showToast('没有可导出的内容', 'error'); return; }
    const ok = JmindRenderer.exportPNG(JmindLayout.getPositions(), JmindCore.getCollapsedSet(), (mindMap.text || '思维导图') + '.png');
    showToast(ok ? 'PNG 导出成功' : '导出失败', ok ? 'success' : 'error');
  }
  function loadFile() {
    const editId = JmindStorage.getEditId();
    if (!editId || editId === 'new') { JmindCore.setMindMap(JmindCore.createSampleMindMap()); currentFileId = 'new'; }
    else { const fd = JmindStorage.getFile(editId); if (fd && fd.root) { JmindCore.setMindMap(fd.root); currentFileId = editId; } else { JmindCore.setMindMap(JmindCore.createSampleMindMap()); currentFileId = 'new'; } }
    refreshView(); markClean();
  }
  function refreshView() { const m = JmindCore.getMindMap(); const c = JmindCore.getCollapsedSet(); JmindLayout.layoutTree(m, c); JmindRenderer.render(JmindLayout.getPositions(), c); updateStats(); }
  function updateStats() { statsEl.textContent = `节点: ${JmindCore.countNodes()} (可见 ${JmindCore.countVisibleNodes()}) | 缩放: ${Math.round(JmindRenderer.getScale() * 100)}%`; }

  function startEditing(nodeId) {
    const pos = JmindRenderer.getNodeScreenRect(nodeId, JmindLayout.getPositions()); if (!pos) return;
    const node = JmindCore.getNodeById(nodeId)?.node; if (!node) return;
    editingNodeId = nodeId; if (editorInput) editorInput.remove();
    editorInput = document.createElement('textarea'); editorInput.className = 'node-editor'; editorInput.value = node.text;
    editorInput.style.left = pos.x + 'px'; editorInput.style.top = pos.y + 'px'; editorInput.style.width = Math.max(pos.width, 60) + 'px'; editorInput.style.height = Math.max(pos.height, 36) + 'px'; editorInput.style.fontSize = (14 * JmindRenderer.getScale()) + 'px';
    container.appendChild(editorInput); editorInput.focus(); editorInput.select();
    const onFinish = (save) => { if (save && editorInput) { const nt = editorInput.value.trim() || '新节点'; if (nt !== node.text) { JmindCore.updateNodeText(nodeId, nt); refreshView(); markDirty(); } } if (editorInput) { editorInput.remove(); editorInput = null; } editingNodeId = null; document.removeEventListener('mousedown', onDocMouseDown); };
    const onDocMouseDown = (e) => { if (editorInput && !editorInput.contains(e.target)) onFinish(true); };
    editorInput.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onFinish(true); } else if (e.key === 'Escape') { e.preventDefault(); onFinish(false); } });
    setTimeout(() => document.addEventListener('mousedown', onDocMouseDown), 50);
  }
  function stopEditing(save = true) {
    if (editingNodeId && editorInput) { const node = JmindCore.getNodeById(editingNodeId)?.node; if (save && node && editorInput.value.trim()) { const nt = editorInput.value.trim(); if (nt !== node.text) { JmindCore.updateNodeText(editingNodeId, nt); refreshView(); markDirty(); } } editorInput.remove(); editorInput = null; editingNodeId = null; }
  }

  function doAddChild(parentId) { const id = JmindCore.addChildNode(parentId); if (id) { JmindRenderer.setSelected(id); refreshView(); markDirty(); startEditing(id); } return id; }
  function doAddSibling(nodeId) { if (nodeId === JmindCore.getMindMap()?.id) { showToast('根节点不能添加兄弟节点', 'error'); return null; } const id = JmindCore.addSiblingNode(nodeId); if (id) { JmindRenderer.setSelected(id); refreshView(); markDirty(); startEditing(id); } return id; }
  function doDelete(nodeId) { if (nodeId === JmindCore.getMindMap()?.id) { showToast('根节点不能删除', 'error'); return false; } const ok = JmindCore.deleteNode(nodeId); if (ok) { JmindRenderer.setSelected(null); refreshView(); markDirty(); } return ok; }
  function doToggleCollapse(nodeId) { JmindCore.toggleCollapse(nodeId); refreshView(); markDirty(); }
  function doMove(nodeId, newParentId, newIndex) { const ok = JmindCore.moveNode(nodeId, newParentId, newIndex); if (ok) { refreshView(); markDirty(); } return ok; }
  function doUndo() { if (JmindCore.undo()) { refreshView(); markDirty(); showToast('已撤销', 'info'); } else showToast('没有可撤销的操作', 'warning'); }
  function doRedo() { if (JmindCore.redo()) { refreshView(); markDirty(); showToast('已重做', 'info'); } else showToast('没有可重做的操作', 'warning'); }
  function doCopy() { const s = JmindRenderer.getSelected(); if (s && JmindCore.copyNode(s)) showToast('已复制节点', 'success'); }
  function doPaste() { const s = JmindRenderer.getSelected(); if (!s) { showToast('请先选择目标节点', 'warning'); return; } const id = JmindCore.pasteNode(s); if (id) { JmindRenderer.setSelected(id); refreshView(); markDirty(); showToast('已粘贴', 'success'); } else showToast('剪贴板为空', 'warning'); }
  function doDuplicate() { const s = JmindRenderer.getSelected(); if (!s) return; const id = JmindCore.duplicateNode(s); if (id) { JmindRenderer.setSelected(id); refreshView(); markDirty(); showToast('已复制节点', 'success'); } else showToast('根节点不能复制', 'warning'); }
  function doClearAll() { stopEditing(false); JmindCore.clearAll(); JmindRenderer.setSelected(null); JmindRenderer.setHovered(null); refreshView(); JmindRenderer.fitToView(JmindLayout.getPositions()); refreshView(); markDirty(); showToast('已清空，保留中心主题', 'success'); }

  function openSearch() { searchBar.classList.add('active'); searchInput.value = ''; searchResultIds = []; searchIndex = -1; updateSearchUI(); setTimeout(() => searchInput.focus(), 50); }
  function closeSearch() { searchBar.classList.remove('active'); searchResultIds = []; searchIndex = -1; JmindRenderer.setSearchResults([], -1); refreshView(); }
  function performSearch(query) { if (!query.trim()) { searchResultIds = []; searchIndex = -1; } else { searchResultIds = JmindCore.searchNodes(query); searchIndex = searchResultIds.length > 0 ? 0 : -1; } updateSearchUI(); if (searchIndex >= 0) highlightSearchResult(); }
  function updateSearchUI() { searchCount.textContent = searchResultIds.length === 0 ? (searchInput.value ? '无结果' : '') : `${searchIndex + 1} / ${searchResultIds.length}`; JmindRenderer.setSearchResults(searchResultIds, searchIndex); refreshView(); }
  function highlightSearchResult() { if (searchIndex < 0 || searchIndex >= searchResultIds.length) return; const id = searchResultIds[searchIndex]; JmindRenderer.setSelected(id); JmindRenderer.centerOnNode(id, JmindLayout.getPositions()); refreshView(); }
  function searchNext() { if (searchResultIds.length === 0) return; searchIndex = (searchIndex + 1) % searchResultIds.length; updateSearchUI(); highlightSearchResult(); }
  function searchPrev() { if (searchResultIds.length === 0) return; searchIndex = (searchIndex - 1 + searchResultIds.length) % searchResultIds.length; updateSearchUI(); highlightSearchResult(); }

  function buildColorPicker() {
    if (!colorPicker) return; colorPicker.innerHTML = '';
    [...JmindCore.getPalette(), JmindCore.getRootColor(), '#34495e', '#e67e22', '#1abc9c'].forEach(color => {
      const sw = document.createElement('div'); sw.className = 'color-swatch'; sw.style.background = color; sw.dataset.color = color;
      sw.addEventListener('click', (e) => { e.stopPropagation(); const s = JmindRenderer.getSelected(); if (s) { JmindCore.updateNodeColor(s, color); refreshView(); markDirty(); } contextMenu.classList.remove('active'); colorPicker.classList.remove('active'); });
      colorPicker.appendChild(sw);
    });
  }

  function getMousePos(e) { const rect = container.getBoundingClientRect(); return { x: e.clientX - rect.left, y: e.clientY - rect.top, clientX: e.clientX, clientY: e.clientY }; }
  function onMouseDown(e) {
    if (e.button === 2) return;
    if (editingNodeId && editorInput) { if (!editorInput.contains(e.target)) { stopEditing(true); return; } else return; }
    const pos = getMousePos(e); const hit = JmindRenderer.hitTest(pos.x, pos.y, JmindLayout.getPositions());
    if (hit && hit.type === 'collapse-button') { doToggleCollapse(hit.id); return; }
    if (hit && hit.type === 'node') { JmindRenderer.setSelected(hit.id); dragMode = 'node'; dragNodeId = hit.id; dragStartX = pos.x; dragStartY = pos.y; isDragging = false; container.classList.add('dragging-node'); refreshView(); }
    else { JmindRenderer.setSelected(null); dragMode = 'pan'; dragStartX = pos.x; dragStartY = pos.y; const o = JmindRenderer.getOffset(); dragStartOffsetX = o.x; dragStartOffsetY = o.y; isDragging = false; refreshView(); }
  }
  function onMouseMove(e) {
    if (editingNodeId && editorInput) return; const pos = getMousePos(e);
    if (!dragMode) { const hit = JmindRenderer.hitTest(pos.x, pos.y, JmindLayout.getPositions()); JmindRenderer.setHovered(hit?.id || null); refreshView(); return; }
    if (dragMode === 'pan') { const dx = pos.x - dragStartX, dy = pos.y - dragStartY; if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) isDragging = true; if (isDragging) { JmindRenderer.setOffset(dragStartOffsetX + dx, dragStartOffsetY + dy); refreshView(); } }
    else if (dragMode === 'node') { const dx = pos.x - dragStartX, dy = pos.y - dragStartY; if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) { isDragging = true; JmindRenderer.setDragging(true); } if (isDragging && dragNodeId) { const t = JmindRenderer.findDropTarget(pos.x, pos.y, JmindLayout.getPositions(), dragNodeId); if (t && t.id !== dragNodeId) { dragOverNodeId = t.id; dragOverPosition = t.position; } else { dragOverNodeId = null; dragOverPosition = null; } updateDropIndicator(); refreshView(); } }
  }
  function onMouseUp() {
    if (dragMode === 'node' && isDragging && dragNodeId && dragOverNodeId && dragOverPosition && dragOverNodeId !== dragNodeId) {
      if (dragOverPosition === 'child') { const tr = JmindCore.getNodeById(dragOverNodeId); if (tr) doMove(dragNodeId, dragOverNodeId, tr.node.children ? tr.node.children.length : 0); }
      else { const tp = JmindCore.getNodeParent(dragOverNodeId); if (tp) { let ni = dragOverPosition === 'before' ? JmindCore.getNodeIndex(dragOverNodeId, tp) : JmindCore.getNodeIndex(dragOverNodeId, tp) + 1; if (JmindCore.getNodeParent(dragNodeId) === tp) { const oi = JmindCore.getNodeIndex(dragNodeId, tp); if (oi < ni) ni--; } doMove(dragNodeId, tp.id, ni); } }
    }
    dragMode = null; dragNodeId = null; isDragging = false; JmindRenderer.setDragging(false); dragOverNodeId = null; dragOverPosition = null; container.classList.remove('dragging-node'); hideDropIndicator(); refreshView();
  }
  function onWheel(e) { e.preventDefault(); const pos = getMousePos(e); JmindRenderer.zoomAt(pos.x, pos.y, e.deltaY > 0 ? 0.9 : 1.1); refreshView(); }
  function onDoubleClick(e) { const pos = getMousePos(e); const hit = JmindRenderer.hitTest(pos.x, pos.y, JmindLayout.getPositions()); if (hit && hit.type === 'node') startEditing(hit.id); }
  function onContextMenu(e) {
    e.preventDefault(); const pos = getMousePos(e); const hit = JmindRenderer.hitTest(pos.x, pos.y, JmindLayout.getPositions());
    if (hit && hit.type === 'node') { JmindRenderer.setSelected(hit.id); refreshView(); contextMenu.classList.add('active'); contextMenu.style.left = pos.clientX + 'px'; contextMenu.style.top = pos.clientY + 'px'; if (colorPicker) colorPicker.classList.remove('active'); const mr = contextMenu.getBoundingClientRect(); if (mr.right > window.innerWidth) contextMenu.style.left = (pos.clientX - mr.width) + 'px'; if (mr.bottom > window.innerHeight) contextMenu.style.top = (pos.clientY - mr.height) + 'px'; }
    else contextMenu.classList.remove('active');
  }
  function updateDropIndicator() {
    if (!dragOverNodeId || !dragOverPosition) { hideDropIndicator(); return; }
    const tp = JmindLayout.getPosition(dragOverNodeId); if (!tp) { hideDropIndicator(); return; }
    const s = JmindRenderer.worldToScreen(tp.x, tp.y); const sc = JmindRenderer.getScale(); const w = tp.width * sc, h = tp.height * sc;
    let ix = s.x, iy = s.y, iw = w, ih = h;
    if (dragOverPosition === 'child') { const ins = 6 * sc; ix = s.x - ins; iy = s.y - ins; iw = w + ins * 2; ih = h + ins * 2; }
    else if (dragOverPosition === 'before') { iy = s.y - 6 * sc; ih = 12 * sc; }
    else if (dragOverPosition === 'after') { iy = s.y + h - 6 * sc; ih = 12 * sc; }
    dropIndicator.style.display = 'block'; dropIndicator.style.left = ix + 'px'; dropIndicator.style.top = iy + 'px'; dropIndicator.style.width = iw + 'px'; dropIndicator.style.height = ih + 'px';
  }
  function hideDropIndicator() { dropIndicator.style.display = 'none'; }

  function onKeyDown(e) {
    if (e.target === editorInput || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') { if (e.key === 'Escape' && e.target === searchInput) closeSearch(); return; }
    const key = e.key, ctrl = e.ctrlKey || e.metaKey, selected = JmindRenderer.getSelected(), mindMap = JmindCore.getMindMap();
    if (ctrl && key === 's') { e.preventDefault(); saveToLocalStorage(); return; }
    if (ctrl && key === 'z' && !e.shiftKey) { e.preventDefault(); doUndo(); return; }
    if (ctrl && (key === 'y' || (key === 'z' && e.shiftKey))) { e.preventDefault(); doRedo(); return; }
    if (ctrl && key === 'f') { e.preventDefault(); openSearch(); return; }
    if (ctrl && key === 'c') { e.preventDefault(); doCopy(); return; }
    if (ctrl && key === 'v') { e.preventDefault(); doPaste(); return; }
    if (ctrl && key === 'd') { e.preventDefault(); doDuplicate(); return; }
    if (key === 'Tab') { e.preventDefault(); if (selected) doAddChild(selected); else if (mindMap) { JmindRenderer.setSelected(mindMap.id); doAddChild(mindMap.id); } }
    else if (key === 'Enter') { e.preventDefault(); if (selected && selected !== mindMap?.id) doAddSibling(selected); }
    else if (key === 'Delete' || key === 'Backspace') { e.preventDefault(); if (selected) doDelete(selected); }
    else if (key === ' ') { e.preventDefault(); if (selected) doToggleCollapse(selected); }
    else if (key === 'F2') { e.preventDefault(); if (selected) startEditing(selected); }
    else if (key === 'Escape') { contextMenu.classList.remove('active'); if (searchBar.classList.contains('active')) closeSearch(); stopEditing(false); refreshView(); }
    else if (key === '+' || key === '=') { e.preventDefault(); JmindRenderer.zoomCenter(1.15); refreshView(); }
    else if (key === '-') { e.preventDefault(); JmindRenderer.zoomCenter(0.87); refreshView(); }
    else if (key === '0') { e.preventDefault(); JmindRenderer.fitToView(JmindLayout.getPositions()); refreshView(); }
  }

  let touchStartX = 0, touchStartY = 0, touchStartDist = 0, touchStartScale = 1;
  function initTouch() {
    container.addEventListener('touchstart', (e) => {
      if (editingNodeId && editorInput) { const t = e.touches[0]; if (!editorInput.contains(document.elementFromPoint(t.clientX, t.clientY))) stopEditing(true); return; }
      if (e.touches.length === 1) { const t = e.touches[0]; const rect = container.getBoundingClientRect(); touchStartX = t.clientX - rect.left; touchStartY = t.clientY - rect.top; const hit = JmindRenderer.hitTest(touchStartX, touchStartY, JmindLayout.getPositions()); if (hit && hit.type === 'node') { JmindRenderer.setSelected(hit.id); dragMode = 'node'; dragNodeId = hit.id; isDragging = false; refreshView(); } else { dragMode = 'pan'; const o = JmindRenderer.getOffset(); dragStartOffsetX = o.x; dragStartOffsetY = o.y; isDragging = false; } }
      else if (e.touches.length === 2) { touchStartDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); touchStartScale = JmindRenderer.getScale(); dragMode = 'pinch'; }
    }, { passive: true });
    container.addEventListener('touchmove', (e) => {
      if (editingNodeId && editorInput) return;
      if (e.touches.length === 1 && dragMode === 'pan') { const t = e.touches[0]; const rect = container.getBoundingClientRect(); const dx = t.clientX - rect.left - touchStartX, dy = t.clientY - rect.top - touchStartY; if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) isDragging = true; if (isDragging) { JmindRenderer.setOffset(dragStartOffsetX + dx, dragStartOffsetY + dy); refreshView(); } }
      else if (e.touches.length === 2 && dragMode === 'pinch') { const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); JmindRenderer.setScale(touchStartScale * (dist / touchStartDist)); refreshView(); }
    }, { passive: true });
    container.addEventListener('touchend', () => {
      if (dragMode === 'node' && isDragging && dragNodeId && dragOverNodeId && dragOverPosition && dragOverNodeId !== dragNodeId) {
        if (dragOverPosition === 'child') { const tr = JmindCore.getNodeById(dragOverNodeId); if (tr) doMove(dragNodeId, dragOverNodeId, tr.node.children ? tr.node.children.length : 0); }
        else { const tp = JmindCore.getNodeParent(dragOverNodeId); if (tp) { let ni = dragOverPosition === 'before' ? JmindCore.getNodeIndex(dragOverNodeId, tp) : JmindCore.getNodeIndex(dragOverNodeId, tp) + 1; if (JmindCore.getNodeParent(dragNodeId) === tp) { const oi = JmindCore.getNodeIndex(dragNodeId, tp); if (oi < ni) ni--; } doMove(dragNodeId, tp.id, ni); } }
      }
      dragMode = null; dragNodeId = null; isDragging = false; dragOverNodeId = null; dragOverPosition = null; container.classList.remove('dragging-node'); hideDropIndicator(); refreshView();
    }, { passive: true });
  }

  function onBeforeUnload() { if (isDirty) saveToLocalStorage(true); }

  function bindToolbar() {
    document.getElementById('btn-back').addEventListener('click', () => { if (isDirty) saveToLocalStorage(true); window.location.href = 'index.html'; });
    document.getElementById('btn-save').addEventListener('click', () => saveToLocalStorage());
    document.getElementById('btn-export').addEventListener('click', exportToJmind);
    document.getElementById('btn-export-png').addEventListener('click', exportPNG);
    document.getElementById('btn-undo').addEventListener('click', doUndo);
    document.getElementById('btn-redo').addEventListener('click', doRedo);
    document.getElementById('btn-add-child').addEventListener('click', () => { const s = JmindRenderer.getSelected(); if (s) doAddChild(s); else if (JmindCore.getMindMap()) { const r = JmindCore.getMindMap(); JmindRenderer.setSelected(r.id); doAddChild(r.id); } });
    document.getElementById('btn-add-sibling').addEventListener('click', () => { const s = JmindRenderer.getSelected(); const r = JmindCore.getMindMap(); if (s && s !== r?.id) doAddSibling(s); else showToast('请先选择一个非根节点', 'error'); });
    document.getElementById('btn-delete').addEventListener('click', () => { const s = JmindRenderer.getSelected(); if (s) doDelete(s); });
    document.getElementById('btn-collapse').addEventListener('click', () => { const s = JmindRenderer.getSelected(); if (s) doToggleCollapse(s); });
    document.getElementById('btn-search').addEventListener('click', openSearch);
    document.getElementById('btn-zoom-in').addEventListener('click', () => { JmindRenderer.zoomCenter(1.15); refreshView(); });
    document.getElementById('btn-zoom-out').addEventListener('click', () => { JmindRenderer.zoomCenter(0.87); refreshView(); });
    document.getElementById('btn-fit').addEventListener('click', () => { JmindRenderer.fitToView(JmindLayout.getPositions()); refreshView(); });
    document.getElementById('btn-clear').addEventListener('click', doClearAll);
    contextMenu.querySelectorAll('.menu-item').forEach(item => { item.addEventListener('click', () => { const action = item.dataset.action; contextMenu.classList.remove('active'); if (colorPicker) colorPicker.classList.remove('active'); const s = JmindRenderer.getSelected(); if (!s && action !== 'clear') return; switch (action) { case 'add-child': doAddChild(s); break; case 'add-sibling': doAddSibling(s); break; case 'toggle-collapse': doToggleCollapse(s); break; case 'edit': startEditing(s); break; case 'copy': doCopy(); break; case 'paste': doPaste(); break; case 'duplicate': doDuplicate(); break; case 'change-color': if (colorPicker) colorPicker.classList.toggle('active'); break; case 'delete': doDelete(s); break; case 'clear': doClearAll(); break; } }); });
    searchInput.addEventListener('input', (e) => performSearch(e.target.value));
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? searchPrev() : searchNext(); } else if (e.key === 'Escape') { e.preventDefault(); closeSearch(); } });
    searchNextBtn.addEventListener('click', searchNext);
    searchPrevBtn.addEventListener('click', searchPrev);
    searchClose.addEventListener('click', closeSearch);
    document.addEventListener('mousedown', (e) => { if (!contextMenu.contains(e.target)) { contextMenu.classList.remove('active'); if (colorPicker) colorPicker.classList.remove('active'); } });
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', () => refreshView());
    window.addEventListener('beforeunload', onBeforeUnload);
  }

  function init() { buildColorPicker(); loadFile(); bindToolbar(); initTouch(); JmindRenderer.fitToView(JmindLayout.getPositions()); refreshView(); updateSaveStatus(); }
  init();
})();
