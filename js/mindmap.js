/**
 * jmind - Mind Map Core Module
 * 数据模型、节点操作、撤销/重做历史、剪贴板、示例数据
 */
const JmindCore = (function () {
  const ROOT_COLOR = '#E8825A';
  const COLOR_PALETTE = ['#5B9BD5', '#70AD47', '#FFC000', '#7B68EE', '#FF6B6B', '#4ECDC4', '#FF9F43', '#A29BFE'];
  const MAX_HISTORY = 50;
  let nodeIdCounter = 0;
  let mindMap = null;
  let collapsedNodes = new Set();
  let historyStack = [];
  let historyIndex = -1;
  let clipboard = null;

  function generateId() { return 'node-' + (++nodeIdCounter) + '-' + Date.now().toString(36); }
  function generateColor(depth, side, index) { if (depth === 0) return ROOT_COLOR; return COLOR_PALETTE[(depth - 1 + index) % COLOR_PALETTE.length]; }
  function getPalette() { return [...COLOR_PALETTE]; }
  function getRootColor() { return ROOT_COLOR; }

  function getNodeById(id, node = mindMap, parent = null) {
    if (!node) return null;
    if (node.id === id) return { node, parent };
    if (node.children) { for (const child of node.children) { const result = getNodeById(id, child, node); if (result) return result; } }
    return null;
  }
  function getNodeParent(id, node = mindMap) {
    if (!node || !node.children) return null;
    for (const child of node.children) { if (child.id === id) return node; const result = getNodeParent(id, child); if (result) return result; }
    return null;
  }
  function getNodeIndex(id, parent) { if (!parent || !parent.children) return -1; return parent.children.findIndex(c => c.id === id); }
  function getNodeDepth(id, node = mindMap, depth = 0) {
    if (!node) return -1; if (node.id === id) return depth;
    if (node.children) { for (const child of node.children) { const result = getNodeDepth(id, child, depth + 1); if (result >= 0) return result; } }
    return -1;
  }
  function countNodes(node = mindMap) { if (!node) return 0; let count = 1; if (node.children) node.children.forEach(c => count += countNodes(c)); return count; }
  function countVisibleNodes(node = mindMap) {
    if (!node) return 0; let count = 1;
    if (!collapsedNodes.has(node.id) && node.children) node.children.forEach(c => count += countVisibleNodes(c));
    return count;
  }
  function searchNodes(query) {
    const results = []; if (!query || !mindMap) return results;
    const lower = query.toLowerCase();
    function walk(node) { if (!node) return; if (node.text && node.text.toLowerCase().includes(lower)) results.push(node.id); if (node.children) node.children.forEach(walk); }
    walk(mindMap); return results;
  }
  function fixNode(node) { if (!node.id) node.id = generateId(); if (!node.text) node.text = '节点'; if (!node.color) node.color = '#5B9BD5'; if (!node.children) node.children = []; node.children.forEach(fixNode); return node; }

  function createSampleMindMap() {
    nodeIdCounter = 0;
    return { id: generateId(), text: '中心主题', color: ROOT_COLOR, collapsed: false, children: [
      { id: generateId(), text: '分支 1', color: COLOR_PALETTE[0], collapsed: false, children: [
        { id: generateId(), text: '子分支 1.1', color: COLOR_PALETTE[2], collapsed: false, children: [] },
        { id: generateId(), text: '子分支 1.2', color: COLOR_PALETTE[3], collapsed: false, children: [] }
      ]},
      { id: generateId(), text: '分支 2', color: COLOR_PALETTE[1], collapsed: false, children: [
        { id: generateId(), text: '子分支 2.1', color: COLOR_PALETTE[4], collapsed: false, children: [] },
        { id: generateId(), text: '子分支 2.2', color: COLOR_PALETTE[5], collapsed: false, children: [
          { id: generateId(), text: '深层节点', color: COLOR_PALETTE[6], collapsed: false, children: [] }
        ]}
      ]},
      { id: generateId(), text: '分支 3', color: COLOR_PALETTE[7], collapsed: false, children: [
        { id: generateId(), text: '子分支 3.1', color: COLOR_PALETTE[0], collapsed: false, children: [] }
      ]}
    ]};
  }

  function pushHistory() {
    if (!mindMap) return;
    const snapshot = JSON.parse(JSON.stringify(mindMap));
    historyStack = historyStack.slice(0, historyIndex + 1);
    historyStack.push(snapshot);
    if (historyStack.length > MAX_HISTORY) historyStack.shift();
    historyIndex = historyStack.length - 1;
  }
  function undo() { if (historyIndex <= 0) return false; historyIndex--; mindMap = JSON.parse(JSON.stringify(historyStack[historyIndex])); rebuildCollapsedSet(); return true; }
  function redo() { if (historyIndex >= historyStack.length - 1) return false; historyIndex++; mindMap = JSON.parse(JSON.stringify(historyStack[historyIndex])); rebuildCollapsedSet(); return true; }
  function canUndo() { return historyIndex > 0; }
  function canRedo() { return historyIndex < historyStack.length - 1; }
  function resetHistory() { historyStack = []; historyIndex = -1; if (mindMap) pushHistory(); }
  function rebuildCollapsedSet() {
    collapsedNodes.clear(); if (!mindMap) return;
    function walk(node) { if (node.collapsed) collapsedNodes.add(node.id); if (node.children) node.children.forEach(walk); }
    walk(mindMap);
  }

  function addChildNode(parentId) {
    if (!mindMap || !parentId) return null;
    const result = getNodeById(parentId); if (!result) return null;
    const parent = result.node; const depth = getNodeDepth(parentId) + 1; const side = getNodeSide(parentId);
    const siblingCount = parent.children ? parent.children.length : 0;
    const newId = generateId();
    const newNode = { id: newId, text: '新节点', color: generateColor(depth, side, siblingCount), collapsed: false, children: [] };
    if (!parent.children) parent.children = []; parent.children.push(newNode);
    if (collapsedNodes.has(parentId)) { collapsedNodes.delete(parentId); parent.collapsed = false; }
    pushHistory(); return newId;
  }
  function addSiblingNode(nodeId) {
    if (!mindMap || !nodeId || nodeId === mindMap.id) return null;
    const parent = getNodeParent(nodeId); if (!parent) return null;
    const index = getNodeIndex(nodeId, parent); if (index < 0) return null;
    const depth = getNodeDepth(nodeId); const side = getNodeSide(nodeId);
    const newId = generateId();
    const newNode = { id: newId, text: '新节点', color: generateColor(depth, side, index + 1), collapsed: false, children: [] };
    parent.children.splice(index + 1, 0, newNode); pushHistory(); return newId;
  }
  function deleteNode(nodeId) {
    if (!mindMap || !nodeId || nodeId === mindMap.id) return false;
    const parent = getNodeParent(nodeId); if (!parent) return false;
    const index = getNodeIndex(nodeId, parent); if (index < 0) return false;
    parent.children.splice(index, 1); pushHistory(); return true;
  }
  function updateNodeText(nodeId, text) { const result = getNodeById(nodeId); if (!result) return false; result.node.text = text; pushHistory(); return true; }
  function updateNodeColor(nodeId, color) { const result = getNodeById(nodeId); if (!result) return false; result.node.color = color; pushHistory(); return true; }
  function toggleCollapse(nodeId) {
    const node = getNodeById(nodeId)?.node; if (!node || !node.children || node.children.length === 0) return;
    if (collapsedNodes.has(nodeId)) { collapsedNodes.delete(nodeId); node.collapsed = false; }
    else { collapsedNodes.add(nodeId); node.collapsed = true; }
    pushHistory();
  }
  function moveNode(nodeId, newParentId, newIndex) {
    if (!mindMap || !nodeId || nodeId === mindMap.id) return false;
    if (nodeId === newParentId) return false;
    let checkNode = newParentId;
    while (checkNode) { if (checkNode === nodeId) return false; const p = getNodeParent(checkNode); checkNode = p ? p.id : null; }
    const oldParent = getNodeParent(nodeId); const oldIndex = getNodeIndex(nodeId, oldParent); if (oldIndex < 0) return false;
    const nodeToMove = oldParent.children[oldIndex]; oldParent.children.splice(oldIndex, 1);
    const newParentResult = getNodeById(newParentId); if (!newParentResult) return false;
    const newParent = newParentResult.node; if (!newParent.children) newParent.children = [];
    const clampedIndex = Math.max(0, Math.min(newIndex, newParent.children.length));
    newParent.children.splice(clampedIndex, 0, nodeToMove);
    if (collapsedNodes.has(newParentId)) { collapsedNodes.delete(newParentId); newParent.collapsed = false; }
    const depth = getNodeDepth(newParentId) + 1; const side = getNodeSide(newParentId);
    nodeToMove.color = generateColor(depth, side, clampedIndex);
    pushHistory(); return true;
  }
  function getNodeSide(id) {
    if (!mindMap || id === mindMap.id) return 'center';
    const parent = getNodeParent(id);
    if (!parent || parent.id === mindMap.id) { const idx = getNodeIndex(id, mindMap); return idx % 2 === 0 ? 'right' : 'left'; }
    return getNodeSide(parent.id);
  }
  function clearAll() {
    nodeIdCounter = 0;
    mindMap = { id: generateId(), text: '中心主题', color: ROOT_COLOR, collapsed: false, children: [] };
    collapsedNodes.clear(); pushHistory();
  }
  function copyNode(nodeId) { const result = getNodeById(nodeId); if (!result) return false; clipboard = JSON.parse(JSON.stringify(result.node)); return true; }
  function pasteNode(targetId) {
    if (!clipboard) return null;
    const result = getNodeById(targetId); if (!result) return null;
    const target = result.node; const newNode = JSON.parse(JSON.stringify(clipboard));
    function regenerateIds(node) { node.id = generateId(); if (node.children) node.children.forEach(regenerateIds); }
    regenerateIds(newNode);
    if (!target.children) target.children = []; target.children.push(newNode);
    if (collapsedNodes.has(targetId)) { collapsedNodes.delete(targetId); target.collapsed = false; }
    pushHistory(); return newNode.id;
  }
  function duplicateNode(nodeId) {
    if (nodeId === mindMap.id) return null;
    const parent = getNodeParent(nodeId); if (!parent) return null;
    const index = getNodeIndex(nodeId, parent); const result = getNodeById(nodeId); if (!result) return null;
    const newNode = JSON.parse(JSON.stringify(result.node));
    function regenerateIds(node) { node.id = generateId(); if (node.children) node.children.forEach(regenerateIds); }
    regenerateIds(newNode); newNode.text = newNode.text + ' 副本';
    parent.children.splice(index + 1, 0, newNode); pushHistory(); return newNode.id;
  }
  function hasClipboard() { return clipboard !== null; }
  function setMindMap(data) { mindMap = fixNode(JSON.parse(JSON.stringify(data))); mindMap.color = mindMap.color || ROOT_COLOR; rebuildCollapsedSet(); resetHistory(); return mindMap; }
  function getMindMap() { return mindMap; }
  function getCollapsedSet() { return collapsedNodes; }
  function toExportData() { return { format: 'jmind', version: '1.1', created: new Date().toISOString(), modified: new Date().toISOString(), root: JSON.parse(JSON.stringify(mindMap)) }; }

  return { ROOT_COLOR, COLOR_PALETTE, getPalette, getRootColor, setMindMap, getMindMap, getCollapsedSet, createSampleMindMap, clearAll, getNodeById, getNodeParent, getNodeIndex, getNodeDepth, getNodeSide, countNodes, countVisibleNodes, searchNodes, addChildNode, addSiblingNode, deleteNode, updateNodeText, updateNodeColor, toggleCollapse, moveNode, generateId, generateColor, pushHistory, undo, redo, canUndo, canRedo, resetHistory, copyNode, pasteNode, duplicateNode, hasClipboard, toExportData };
})();
