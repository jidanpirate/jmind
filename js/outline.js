/**
 * jmind - 大纲视图模块
 * 树形列表展示、折叠、行内编辑、拖拽排序、键盘导航
 * 依赖：JmindCore, JmindRenderer, JmindLayout
 */
const JmindOutline = (function () {
    'use strict';

    const L = (key) => (typeof JmindI18n !== 'undefined' ? JmindI18n.t(key) : key);

    let panel = null;
    let searchInput = null;
    let collapsed = new Set();
    let dragState = null;
    let justDragged = false;
    let editingRow = null;
    let onSelectCallback = null;

    // ============================================================
    //  初始化
    // ============================================================
    function init(container, onSelect) {
        panel = container;
        onSelectCallback = onSelect;
        panel.innerHTML = `
            <div class="outline-header">
                <span class="outline-title" data-i18n="outline">大纲</span>
                <input type="text" class="outline-search" id="outline-search" data-i18n-placeholder="search_placeholder" placeholder="搜索节点...">
            </div>
            <div class="outline-body" id="outline-body"></div>
        `;
        searchInput = panel.querySelector('#outline-search');
        bindEvents();
    }

    // ============================================================
    //  渲染
    // ============================================================
    function render() {
        const body = panel.querySelector('#outline-body');
        const mind = JmindCore.getMindMap();
        if (!mind) { body.innerHTML = ''; return; }

        const query = searchInput.value.trim().toLowerCase();
        const matches = query ? findMatches(mind.root, query) : null;

        let html = '';
        html += renderNode(mind.root, 0, query, matches);
        body.innerHTML = html;

        // 高亮选中
        const selectedId = JmindRenderer.getSelected();
        if (selectedId) {
            const row = body.querySelector(`.outline-item[data-id="${selectedId}"] .outline-row`);
            if (row) row.classList.add('selected');
        }

        // 搜索高亮
        if (query) {
            body.querySelectorAll('.outline-text').forEach(el => {
                const text = el.textContent;
                const idx = text.toLowerCase().indexOf(query);
                if (idx >= 0) {
                    el.innerHTML = escapeHtml(text.slice(0, idx))
                        + `<mark>${escapeHtml(text.slice(idx, idx + query.length))}</mark>`
                        + escapeHtml(text.slice(idx + query.length));
                }
            });
        }
    }

    function renderNode(node, depth, query, matches) {
        const hasChildren = node.children && node.children.length > 0;
        const isCollapsed = collapsed.has(node.id);
        const isRoot = node.id === JmindCore.getMindMap()?.root.id;

        // 搜索过滤
        if (query && matches && !matches.has(node.id)) {
            // 如果子节点有匹配，仍显示当前节点
            if (!hasChildren || !node.children.some(c => matches.has(c.id) || hasDescendantMatch(c, matches))) {
                return '';
            }
        }

        let html = `<div class="outline-item" data-id="${node.id}" data-depth="${depth}">`;
        html += `<div class="outline-row" style="padding-left:${depth * 18 + 8}px">`;

        // 折叠箭头
        if (hasChildren) {
            html += `<span class="outline-arrow ${isCollapsed ? 'collapsed' : ''}">▶</span>`;
        } else {
            html += `<span class="outline-arrow placeholder"></span>`;
        }

        // 节点文本
        const text = node.text || '';
        html += `<span class="outline-text">${escapeHtml(text)}</span>`;

        html += `</div>`;

        // 子节点
        if (hasChildren && !isCollapsed) {
            node.children.forEach(child => {
                html += renderNode(child, depth + 1, query, matches);
            });
        }

        html += `</div>`;
        return html;
    }

    function hasDescendantMatch(node, matches) {
        if (matches.has(node.id)) return true;
        if (node.children) {
            return node.children.some(c => hasDescendantMatch(c, matches));
        }
        return false;
    }

    function findMatches(node, query) {
        const set = new Set();
        function walk(n) {
            if ((n.text || '').toLowerCase().includes(query)) set.add(n.id);
            if (n.children) n.children.forEach(walk);
        }
        walk(node);
        return set;
    }

    // ============================================================
    //  事件绑定
    // ============================================================
    function bindEvents() {
        const body = panel.querySelector('#outline-body');

        // 搜索
        searchInput.addEventListener('input', () => render());
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { searchInput.value = ''; render(); searchInput.blur(); }
        });

        // 折叠箭头
        body.addEventListener('click', (e) => {
            if (justDragged) { justDragged = false; return; }
            const arrow = e.target.closest('.outline-arrow');
            if (arrow && !arrow.classList.contains('placeholder')) {
                e.stopPropagation();
                const item = arrow.closest('.outline-item');
                const id = item.dataset.id;
                if (collapsed.has(id)) collapsed.delete(id);
                else collapsed.add(id);
                render();
                return;
            }
            const row = e.target.closest('.outline-row');
            if (!row || e.target.closest('.outline-input')) return;
            const item = row.closest('.outline-item');
            if (!item) return;
            const nodeId = item.dataset.id;
            JmindRenderer.setSelected(nodeId);
            selectOnly(nodeId);
            reveal(nodeId);
            if (onSelectCallback) onSelectCallback(nodeId);
        });

        // 双击编辑（根节点也可编辑）
        body.addEventListener('dblclick', (e) => {
            const row = e.target.closest('.outline-row');
            if (!row || e.target.closest('.outline-arrow')) return;
            const item = row.closest('.outline-item');
            if (!item) return;
            startEdit(item.dataset.id);
        });

        // 拖拽排序
        body.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            // 点击其他区域时结束编辑
            if (editingRow && !e.target.closest('.outline-input')) {
                stopEdit(true);
            }
            const row = e.target.closest('.outline-row');
            if (!row || e.target.closest('.outline-arrow') || e.target.closest('.outline-input')) return;
            const item = row.closest('.outline-item');
            if (!item) return;
            const nodeId = item.dataset.id;
            // 根节点不参与拖拽排序
            if (!nodeId || nodeId === JmindCore.getMindMap()?.id) return;

            dragState = {
                nodeId,
                startX: e.clientX,
                startY: e.clientY,
                row,
                active: false,
                placeholder: null,
                originalNext: null
            };
            // 注意：不在 mousedown 中调用 e.preventDefault()，
            // 否则会阻止 dblclick 事件触发，导致双击编辑失效。
            // 文本选择在拖拽真正开始时通过 userSelect 临时阻止。
            document.addEventListener('mousemove', onDragMove);
            document.addEventListener('mouseup', onDragUp);
        });
    }

    function onDragMove(e) {
        if (!dragState) return;
        const dx = e.clientX - dragState.startX;
        const dy = e.clientY - dragState.startY;

        if (!dragState.active) {
            if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
            // 拖拽真正开始：临时阻止文本选择
            dragState.active = true;
            document.body.style.userSelect = 'none';
            dragState.row.classList.add('dragging');
            // 创建占位符
            const placeholder = document.createElement('div');
            placeholder.className = 'outline-placeholder';
            placeholder.style.height = dragState.row.offsetHeight + 'px';
            dragState.placeholder = placeholder;
            dragState.originalNext = dragState.row.nextSibling;
            dragState.row.parentNode.insertBefore(placeholder, dragState.row);
            dragState.row.style.position = 'fixed';
            dragState.row.style.zIndex = '100';
            dragState.row.style.pointerEvents = 'none';
            dragState.row.style.opacity = '0.9';
        }

        // 跟随鼠标
        const rect = dragState.placeholder.getBoundingClientRect();
        dragState.row.style.left = (rect.left + dx) + 'px';
        dragState.row.style.top = (rect.top + dy) + 'px';
        dragState.row.style.width = rect.width + 'px';

        // 计算放置位置
        updateDropTarget(e.clientY);
    }

    function updateDropTarget(y) {
        const body = panel.querySelector('#outline-body');
        const items = body.querySelectorAll('.outline-item:not(.dragging)');
        let closest = null;
        let closestDist = Infinity;
        let before = true;

        items.forEach(item => {
            const row = item.querySelector('.outline-row');
            if (!row) return;
            const rect = row.getBoundingClientRect();
            const center = rect.top + rect.height / 2;
            const dist = Math.abs(y - center);
            if (dist < closestDist) {
                closestDist = dist;
                closest = item;
                before = y < center;
            }
        });

        // 清除旧的指示
        body.querySelectorAll('.outline-drop-before, .outline-drop-after').forEach(el => {
            el.classList.remove('outline-drop-before', 'outline-drop-after');
        });

        if (closest) {
            const row = closest.querySelector('.outline-row');
            if (row) row.classList.add(before ? 'outline-drop-before' : 'outline-drop-after');
            dragState.dropTarget = { item: closest, before };
        } else {
            dragState.dropTarget = null;
        }
    }

    function onDragUp(e) {
        if (!dragState) return;
        const wasActive = dragState.active;
        const dropTarget = dragState.dropTarget;
        const nodeId = dragState.nodeId;

        cleanupDrag();

        if (wasActive && dropTarget) {
            justDragged = true;
            // 执行移动
            const targetId = dropTarget.item.dataset.id;
            const before = dropTarget.before;
            moveNode(nodeId, targetId, before);
        }
    }

    function cleanupDrag() {
        if (!dragState) return;
        // 恢复文本选择
        document.body.style.userSelect = '';
        if (dragState.row) {
            dragState.row.classList.remove('dragging');
            dragState.row.style.position = '';
            dragState.row.style.zIndex = '';
            dragState.row.style.pointerEvents = '';
            dragState.row.style.opacity = '';
            dragState.row.style.left = '';
            dragState.row.style.top = '';
            dragState.row.style.width = '';
        }
        if (dragState.placeholder && dragState.placeholder.parentNode) {
            dragState.placeholder.parentNode.removeChild(dragState.placeholder);
        }
        const body = panel.querySelector('#outline-body');
        if (body) {
            body.querySelectorAll('.outline-drop-before, .outline-drop-after').forEach(el => {
                el.classList.remove('outline-drop-before', 'outline-drop-after');
            });
        }
        document.removeEventListener('mousemove', onDragMove);
        document.removeEventListener('mouseup', onDragUp);
        dragState = null;
    }

    function moveNode(sourceId, targetId, before) {
        const mind = JmindCore.getMindMap();
        if (!mind) return;

        // 找到源节点及其父节点
        let sourceParent = null;
        let sourceIndex = -1;
        function findSource(node, parent) {
            if (!node.children) return;
            node.children.forEach((child, i) => {
                if (child.id === sourceId) { sourceParent = node; sourceIndex = i; }
                findSource(child, node);
            });
        }
        findSource(mind.root, null);

        if (sourceIndex < 0) return;

        // 不能移动到自己的子节点下
        const sourceNode = sourceParent.children[sourceIndex];
        if (isDescendant(sourceNode, targetId)) return;

        // 移除源节点
        sourceParent.children.splice(sourceIndex, 1);

        // 找到目标节点及其父节点
        let targetParent = null;
        let targetIndex = -1;
        function findTarget(node, parent) {
            if (node.id === targetId) { targetParent = parent; return; }
            if (!node.children) return;
            node.children.forEach((child, i) => {
                if (child.id === targetId) { targetParent = node; targetIndex = i; }
                findTarget(child, node);
            });
        }
        findTarget(mind.root, null);

        if (!targetParent) {
            // 目标是根节点，作为子节点插入
            if (!mind.root.children) mind.root.children = [];
            mind.root.children.push(sourceNode);
        } else {
            if (before) {
                targetParent.children.splice(targetIndex, 0, sourceNode);
            } else {
                targetParent.children.splice(targetIndex + 1, 0, sourceNode);
            }
        }

        JmindCore.markDirty();
        JmindRenderer.render();
        render();
        JmindRenderer.setSelected(sourceId);
        selectOnly(sourceId);
    }

    function isDescendant(node, id) {
        if (node.id === id) return true;
        if (node.children) {
            return node.children.some(c => isDescendant(c, id));
        }
        return false;
    }

    // ============================================================
    //  行内编辑
    // ============================================================
    function startEdit(nodeId) {
        if (editingRow) stopEdit(true);
        const item = panel.querySelector(`.outline-item[data-id="${nodeId}"]`);
        if (!item) return;
        const row = item.querySelector('.outline-row');
        const textEl = row.querySelector('.outline-text');
        if (!textEl) return;

        const currentText = textEl.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'outline-input';
        input.value = currentText;
        input.style.width = Math.max(120, textEl.offsetWidth + 40) + 'px';

        textEl.replaceWith(input);
        input.focus();
        input.select();
        editingRow = { nodeId, input, textEl, row };

        const finish = (save) => {
            if (!editingRow || editingRow.input !== input) return;
            const newText = input.value.trim();
            if (save && newText && newText !== currentText) {
                JmindCore.updateNodeText(nodeId, newText);
                JmindRenderer.render();
            }
            // 先替换回文本，再清理状态（不要先 remove 再 replaceWith）
            const span = document.createElement('span');
            span.className = 'outline-text';
            span.textContent = save && newText ? newText : currentText;
            input.replaceWith(span);
            editingRow = null;
            render();
            selectOnly(nodeId);
        };

        input.addEventListener('blur', () => finish(true));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); finish(true); }
            else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
            else if (e.key === 'Tab') {
                e.preventDefault();
                finish(true);
                // 添加子节点
                setTimeout(() => {
                    JmindCore.addChild(nodeId);
                    JmindRenderer.render();
                    render();
                    const newChild = JmindCore.getNodeById(nodeId)?.children?.slice(-1)[0];
                    if (newChild) {
                        JmindRenderer.setSelected(newChild.id);
                        selectOnly(newChild.id);
                        startEdit(newChild.id);
                    }
                }, 0);
            }
        });
    }

    function stopEdit(save) {
        if (!editingRow) return;
        const { input } = editingRow;
        if (save) input.blur();
        else {
            // 直接取消
            const currentText = editingRow.textEl.textContent;
            const span = document.createElement('span');
            span.className = 'outline-text';
            span.textContent = currentText;
            input.replaceWith(span);
            editingRow = null;
            render();
        }
    }

    // ============================================================
    //  辅助方法
    // ============================================================
    function selectOnly(nodeId) {
        panel.querySelectorAll('.outline-row.selected').forEach(r => r.classList.remove('selected'));
        const item = panel.querySelector(`.outline-item[data-id="${nodeId}"]`);
        if (item) {
            const row = item.querySelector('.outline-row');
            if (row) row.classList.add('selected');
        }
    }

    function reveal(nodeId) {
        const item = panel.querySelector(`.outline-item[data-id="${nodeId}"]`);
        if (item) {
            item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    function expandToNode(nodeId) {
        // 展开所有祖先节点
        const mind = JmindCore.getMindMap();
        if (!mind) return;
        function findPath(node, path) {
            if (node.id === nodeId) return path;
            if (node.children) {
                for (const child of node.children) {
                    const result = findPath(child, [...path, node.id]);
                    if (result) return result;
                }
            }
            return null;
        }
        const path = findPath(mind.root, []);
        if (path) {
            path.forEach(id => collapsed.delete(id));
        }
    }

    function focusSearch() {
        searchInput.focus();
        searchInput.select();
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ============================================================
    //  对外接口
    // ============================================================
    return {
        init,
        render,
        startEdit,
        stopEdit,
        selectOnly,
        reveal,
        expandToNode,
        focusSearch,
        get editing() { return !!editingRow; }
    };
})();
