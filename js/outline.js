/**
 * jmind - Outline Module
 * 大纲视图：以缩进列表展示思维导图树，支持折叠/展开、选中、行内编辑、键盘导航
 * 与 Canvas 视图共享同一份 JmindCore 数据，可来回切换
 */
const JmindOutline = (function () {
  'use strict';

  let panel = null;
  let onChange = null;   // 数据变更回调（由编辑器注入：markDirty + refreshView）
  let editingRow = null; // 当前行内编辑的 row 元素

  function init(el, handlers) {
    panel = el;
    if (handlers) {
      if (handlers.onChange) onChange = handlers.onChange;
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

    const list = document.createElement('ul');
    list.className = 'outline-list';
    list.appendChild(buildRow(mindMap, collapsed, selectedId, 0));
    panel.appendChild(list);
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
    li.appendChild(row);

    if (hasChildren && !isCollapsed) {
      const sub = document.createElement('ul');
      node.children.forEach(child => sub.appendChild(buildRow(child, collapsed, selectedId, depth + 1)));
      li.appendChild(sub);
    }
    return li;
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
      input.remove();
      row.classList.remove('editing');
      // 重新放回文本节点并重渲染选中态
      const newText = document.createElement('span');
      newText.className = 'outline-text';
      newText.textContent = node.text || '';
      input.replaceWith(newText);
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

  // ---------- 事件 ----------
  function bindEvents() {
    if (!panel) return;
    panel.addEventListener('mousedown', (e) => {
      // 行内编辑时点击面板外其他位置：提交当前编辑（不阻止冒泡到 document 的收起逻辑）
      if (editingRow && !e.target.closest('.outline-input')) {
        stopEdit(true);
      }
    });

    panel.addEventListener('click', (e) => {
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
