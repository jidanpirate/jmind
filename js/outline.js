/**
 * jmind - Outline Module
 * 大纲视图：以缩进列表展示思维导图树，支持折叠/展开、选中、行内编辑、键盘导航、拖拽排序
 * 与 Canvas 视图共享同一份 JmindCore 数据，可来回切换
 */
const JmindOutline = (function () {
  'use strict';

  let panel = null;
  let onChange = null;   // 数据变更回调（由编辑器注入：markDirty + refreshView）
  let onIndent = null;   // 缩进回调（添加子节点）
  let onOutdent = null;  // 后退回调（提升层级）
  let editingRow = null; // 当前行内编辑的 row 元素

  // ---------- 拖拽排序状态 ----------
  const DRAG_THRESHOLD = 6;
  let dragState = null;   // { nodeId, startX, startY, row, active }
  let dragTarget = null;  // { nodeId, position: 'before'|'after'|'child' }
  let justDragged = false;
  let dropLine = null;
  let dropBox = null;

  function init(el, handlers) {
    panel = el;
    if (handlers) {
      if (handlers.onChange) onChange = handlers.onChange;
      if (handlers.onIndent) onIndent = handlers.onIndent;
      if (handlers.onOutdent) onOutdent = handlers.onOutdent;
    }
    bindEvents();
  }

  // ---------- 渲染 ----------
  function render(selectedId) {
    if (!panel) return;
    const mindMap = JmindCore.getMindMap();
    const collapsed = JmindCore.getCollapsedSet();
    panel.innerHTML = '';
    if (!mindMap) return;

    // 渲染大纲工具栏（缩进/后退按钮）
    renderToolbar();

    const list = document.createElement('ul');
    list.className = 'outline-list';
    list.appendChild(buildRow(mindMap, collapsed, selectedId, 0));
    panel.appendChild(list);
  }

  // ---------- 大纲工具栏（缩进/后退按钮） ----------
  function renderToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'outline-toolbar';
    toolbar.innerHTML =
      '<button type="button" class="outline-tool-btn" data-outline-action="indent" title="缩进 (Tab)">⇥ 缩进</button>' +
      '<button type="button" class="outline-tool-btn" data-outline-action="outdent" title="后退 (Shift+Tab)">⇤ 后退</button>';
    toolbar.addEventListener('mousedown', (e) => e.stopPropagation());
    toolbar.addEventListener('click', (e) => {
      const btn = e.target.closest('.outline-tool-btn');
      if (!btn) return;
      const action = btn.dataset.outlineAction;
      const selected = JmindRenderer.getSelected();
      if (!selected) return;
      if (action === 'indent' && onIndent) onIndent(selected);
      else if (action === 'outdent' && onOutdent) onOutdent(selected);
    });
    panel.appendChild(toolbar);
  }

  function buildRow(node, collapsed, selectedId, depth) {
    const li = document.createElement('li');
    li.className = 'outline-item';
    li.dataset.id = node.id;

    const hasChildren = node.children && node.children.length > 0;
    const isCollapsed = collapsed.has(node.id);

    const row = document.createElement('div');
    row.className = 'outline-row' + (selectedId === node.id ? ' selected' : '');
    row.style.setProperty('--depth', depth);

    const arrow = document.createElement('span');
    arrow.className = 'outline-arrow' + (hasChildren ? '' : ' leaf');
    arrow.textContent = hasChildren ? (isCollapsed ? '▸' : '▾') : '';
    if (hasChildren) arrow.title = JmindI18n.t('menu_toggle_collapse');

    const dot = document.createElement('span');
    dot.className = 'outline-dot';
    dot.style.background = node.color || '#5B9BD5';

    const text = document.createElement('span');
    text.className = 'outline-text';
    text.textContent = node.text || '';

    row.appendChild(arrow);
    row.appendChild(dot);
    row.appendChild(text);
    applyRowStyle(row, node);
    li.appendChild(row);

    if (hasChildren && !isCollapsed) {
      const sub = document.createElement('ul');
      node.children.forEach(child => sub.appendChild(buildRow(child, collapsed, selectedId, depth + 1)));
      li.appendChild(sub);
    }
    return li;
  }

  // ---------- 行文本应用节点字体样式 ----------
  function applyRowStyle(row, node) {
    const textEl = row.querySelector('.outline-text');
    if (!textEl) return;
    const st = JmindCore.getNodeStyle(node);
    textEl.style.fontSize = st.fontSize + 'px';
    textEl.style.fontWeight = st.bold ? '700' : '400';
    textEl.style.fontStyle = st.italic ? 'italic' : 'normal';
    textEl.style.textDecoration = st.underline ? 'underline' : 'none';
    textEl.style.fontFamily = JmindCore.getFontFamilyCss(st.fontFamily);
  }

  function applyInputStyle(input, node) {
    const st = JmindCore.getNodeStyle(node);
    input.style.fontSize = st.fontSize + 'px';
    input.style.fontWeight = st.bold ? '700' : '400';
    input.style.fontStyle = st.italic ? 'italic' : 'normal';
    input.style.textDecoration = st.underline ? 'underline' : 'none';
    input.style.fontFamily = JmindCore.getFontFamilyCss(st.fontFamily);
  }

  // ---------- 可见节点顺序（用于键盘导航） ----------
  function getVisibleIds() {
    const mindMap = JmindCore.getMindMap();
    const collapsed = JmindCore.getCollapsedSet();
    const ids = [];
    if (!mindMap) return ids;
    (function walk(node) {
      ids.push(node.id);
      if (node.children && !collapsed.has(node.id)) node.children.forEach(walk);
    })(mindMap);
    return ids;
  }

  // ---------- 选中（只更新样式类，不重建 DOM，保证双击可用） ----------
  function selectOnly(nodeId) {
    if (!panel) return;
    panel.querySelectorAll('.outline-row.selected').forEach(r => r.classList.remove('selected'));
    if (!nodeId) return;
    const item = panel.querySelector('.outline-item[data-id="' + CSS.escape(nodeId) + '"]');
    if (item) item.querySelector('.outline-row').classList.add('selected');
  }

  // ---------- 行内编辑 ----------
  function startEdit(nodeId) {
    if (!panel || !nodeId) return;
    stopEdit(false);
    const item = panel.querySelector('.outline-item[data-id="' + CSS.escape(nodeId) + '"]');
    if (!item) return;
    const row = item.querySelector('.outline-row');
    const textEl = row.querySelector('.outline-text');
    if (!textEl) return;

    const node = JmindCore.getNodeById(nodeId)?.node;
    if (!node) return;

    editingRow = row;
    row.classList.add('editing');
    const input = document.createElement('input');
    input.className = 'outline-input';
    input.value = node.text || '';
    applyInputStyle(input, node);
    textEl.replaceWith(input);
    input.focus();
    input.select();

    let finished = false;
    const finish = (save) => {
      if (finished) return;
      finished = true;
      const value = save ? input.value.trim() : '';
      if (save && value && value !== node.text) {
        JmindCore.updateNodeText(nodeId, value);
        if (onChange) onChange();
      }
      row.classList.remove('editing');
      // 直接用 replaceWith 替换回文本节点（不要先 remove 再 replaceWith）
      const newText = document.createElement('span');
      newText.className = 'outline-text';
      newText.textContent = node.text || '';
      input.replaceWith(newText);
      applyRowStyle(row, node);
      editingRow = null;
    };

    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
    input.addEventListener('blur', () => finish(true));
  }

  function stopEdit(save) {
    if (!editingRow) return;
    const input = editingRow.querySelector('.outline-input');
    if (input) {
      const nodeId = editingRow.closest('.outline-item')?.dataset.id;
      const node = nodeId ? JmindCore.getNodeById(nodeId)?.node : null;
      const value = save && input.value.trim() ? input.value.trim() : null;
      if (value && node && value !== node.text) {
        JmindCore.updateNodeText(nodeId, value);
        if (onChange) onChange();
      }
      const textEl = document.createElement('span');
      textEl.className = 'outline-text';
      textEl.textContent = (node && node.text) || '';
      input.replaceWith(textEl);
      applyRowStyle(editingRow, node);
      editingRow.classList.remove('editing');
    }
    editingRow = null;
  }

  function isEditing() { return editingRow !== null; }

  // ---------- 选中滚动 ----------
  function reveal(nodeId) {
    if (!panel || !nodeId) return;
    const item = panel.querySelector('.outline-item[data-id="' + CSS.escape(nodeId) + '"]');
    if (item) item.scrollIntoView({ block: 'nearest' });
  }

  // ---------- 键盘导航（方向键） ----------
  function navigate(key) {
    const selected = JmindRenderer.getSelected();
    const ids = getVisibleIds();
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      let idx = ids.indexOf(selected);
      if (idx < 0) idx = 0;
      idx += (key === 'ArrowUp' ? -1 : 1);
      idx = Math.max(0, Math.min(ids.length - 1, idx));
      const target = ids[idx];
      if (target) {
        JmindRenderer.setSelected(target);
        selectOnly(target);
        reveal(target);
      }
      return;
    }
    // Left / Right
    if (!selected) return;
    const info = JmindCore.getNodeById(selected);
    if (!info) return;
    const node = info.node;
    const collapsed = JmindCore.getCollapsedSet();
    const hasChildren = node.children && node.children.length > 0;

    if (key === 'ArrowRight') {
      if (hasChildren && collapsed.has(selected)) {
        JmindCore.toggleCollapse(selected);
        if (onChange) onChange();
      } else if (hasChildren) {
        const first = node.children[0];
        JmindRenderer.setSelected(first.id);
        selectOnly(first.id);
        reveal(first.id);
      }
    } else if (key === 'ArrowLeft') {
      if (hasChildren && !collapsed.has(selected)) {
        JmindCore.toggleCollapse(selected);
        if (onChange) onChange();
      } else {
        const parent = JmindCore.getNodeParent(selected);
        if (parent) {
          JmindRenderer.setSelected(parent.id);
          selectOnly(parent.id);
          reveal(parent.id);
        }
      }
    }
  }

  // ---------- 拖拽排序 ----------
  function isDescendant(ancestorId, nodeId) {
    let cur = nodeId;
    while (cur) {
      if (cur === ancestorId) return true;
      const p = JmindCore.getNodeParent(cur);
      cur = p ? p.id : null;
    }
    return false;
  }

  function ensureIndicators() {
    if (dropLine) return;
    dropLine = document.createElement('div');
    dropLine.className = 'outline-drop-line';
    dropBox = document.createElement('div');
    dropBox.className = 'outline-drop-box';
    panel.appendChild(dropLine);
    panel.appendChild(dropBox);
  }

  function hideDropIndicators() {
    if (dropLine) dropLine.style.display = 'none';
    if (dropBox) dropBox.style.display = 'none';
    dragTarget = null;
  }

  function updateDropIndicator(e) {
    const mindMap = JmindCore.getMindMap();
    if (!mindMap || !dragState) return;
    const hitItem = e.target.closest('.outline-item');
    const targetId = hitItem ? hitItem.dataset.id : null;
    if (!targetId || targetId === dragState.nodeId || isDescendant(dragState.nodeId, targetId)) {
      hideDropIndicators();
      return;
    }
    const row = hitItem.querySelector('.outline-row');
    if (!row) { hideDropIndicators(); return; }
    const r = row.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    const top = r.top - p.top + panel.scrollTop;
    const h = r.height;
    let position;
    if (e.clientY < r.top + h * 0.3) position = 'before';
    else if (e.clientY > r.bottom - h * 0.3) position = 'after';
    else position = 'child';
    if (targetId === mindMap.id && position !== 'child') position = 'child'; // 根节点只能作为子节点目标
    dragTarget = { nodeId: targetId, position };

    ensureIndicators();
    if (position === 'child') {
      dropLine.style.display = 'none';
      dropBox.style.display = 'block';
      dropBox.style.top = (top + 2) + 'px';
      dropBox.style.height = (h - 4) + 'px';
    } else {
      dropBox.style.display = 'none';
      dropLine.style.display = 'block';
      dropLine.style.top = (position === 'before' ? top : top + h) + 'px';
    }
  }

  function doDrop() {
    if (!dragTarget || !dragState) return;
    const dragId = dragState.nodeId;
    const targetId = dragTarget.nodeId;
    const position = dragTarget.position;
    let ok = false;
    if (position === 'child') {
      const t = JmindCore.getNodeById(targetId);
      const cnt = t && t.node.children ? t.node.children.length : 0;
      ok = JmindCore.moveNode(dragId, targetId, cnt);
    } else {
      const tp = JmindCore.getNodeParent(targetId);
      if (tp) {
        let ni = position === 'before' ? JmindCore.getNodeIndex(targetId, tp) : JmindCore.getNodeIndex(targetId, tp) + 1;
        const dp = JmindCore.getNodeParent(dragId);
        if (dp && dp.id === tp.id) {
          const oi = JmindCore.getNodeIndex(dragId, tp);
          if (oi < ni) ni--;
        }
        ok = JmindCore.moveNode(dragId, tp.id, ni);
      }
    }
    if (ok) {
      JmindRenderer.setSelected(dragId);
      if (onChange) onChange();
    }
  }

  function cleanupDrag() {
    if (dragState && dragState.row) dragState.row.classList.remove('dragging');
    dragState = null;
    hideDropIndicators();
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  function onDragMove(e) {
    if (!dragState) return;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    if (!dragState.active && Math.abs(dx) + Math.abs(dy) >= DRAG_THRESHOLD) {
      dragState.active = true;
      dragState.row.classList.add('dragging');
      document.body.style.cursor = 'move';
      document.body.style.userSelect = 'none';
      ensureIndicators();
    }
    if (dragState.active) updateDropIndicator(e);
  }

  function onDragUp(e) {
    if (!dragState) return;
    const wasActive = dragState.active;
    if (wasActive) {
      updateDropIndicator(e);
      doDrop();
      justDragged = true;
      setTimeout(() => { justDragged = false; }, 0);
    }
    cleanupDrag();
  }

  // ---------- 事件 ----------
  function bindEvents() {
    if (!panel) return;
    panel.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      // 行内编辑时点击面板外其他位置：提交当前编辑（不阻止冒泡到 document 的收起逻辑）
      if (editingRow && !e.target.closest('.outline-input')) {
        stopEdit(true);
      }
      // 开始拖拽候选：点击行（非箭头、非输入框、非根节点、非工具栏）
      if (e.target.closest('.outline-toolbar')) return;
      const row = e.target.closest('.outline-row');
      if (!row || e.target.closest('.outline-arrow') || e.target.closest('.outline-input')) return;
      const item = row.closest('.outline-item');
      if (!item) return;
      const nodeId = item.dataset.id;
      if (!nodeId || nodeId === JmindCore.getMindMap()?.id) return;
      dragState = { nodeId, startX: e.clientX, startY: e.clientY, row, active: false };
      // 注意：不在 mousedown 中调用 e.preventDefault()，
      // 否则会阻止 dblclick 事件触发，导致双击编辑失效。
      // 文本选择在拖拽真正开始时通过 userSelect 临时阻止（见 onDragMove）。
      document.addEventListener('mousemove', onDragMove);
      document.addEventListener('mouseup', onDragUp);
    });

    panel.addEventListener('click', (e) => {
      if (justDragged) { justDragged = false; return; }
      // 点击工具栏不处理选中
      if (e.target.closest('.outline-toolbar')) return;
      const item = e.target.closest('.outline-item');
      if (!item) {
        // 点击空白区域：取消选中
        if (JmindRenderer.getSelected()) {
          JmindRenderer.setSelected(null);
          selectOnly(null);
        }
        return;
      }
      const nodeId = item.dataset.id;
      if (!nodeId) return;

      // 点击折叠箭头
      const arrow = e.target.closest('.outline-arrow');
      if (arrow && !arrow.classList.contains('leaf')) {
        JmindCore.toggleCollapse(nodeId);
        if (onChange) onChange();
        return;
      }

      // 点击行：选中（不重建 DOM）
      JmindRenderer.setSelected(nodeId);
      selectOnly(nodeId);
      reveal(nodeId);
    });

    panel.addEventListener('dblclick', (e) => {
      if (e.target.closest('.outline-toolbar')) return;
      const row = e.target.closest('.outline-row');
      if (!row) return;
      const item = row.closest('.outline-item');
      if (!item) return;
      JmindRenderer.setSelected(item.dataset.id);
      startEdit(item.dataset.id);
    });
  }

  return {
    init,
    render,
    startEdit,
    stopEdit,
    isEditing,
    navigate,
    reveal
  };
})();