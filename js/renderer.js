/**
 * jmind - Renderer Module
 * Canvas 渲染器：绘制节点、连线、选中态、搜索高亮、导出PNG
 */
const JmindRenderer = (function () {
  const NODE_RADIUS = 10; const MIN_SCALE = 0.25; const MAX_SCALE = 3.0;
  let canvas = null, ctx = null, container = null;
  let scale = 1.0, offsetX = 0, offsetY = 0;
  let selectedNodeId = null, hoveredNodeId = null;
  let searchResults = [], currentSearchIndex = -1, isDragging = false;

  function init(canvasEl, containerEl) { canvas = canvasEl; container = containerEl; ctx = canvas.getContext('2d'); return ctx; }
  function worldToScreen(wx, wy) { return { x: wx * scale + offsetX, y: wy * scale + offsetY }; }
  function screenToWorld(sx, sy) { return { x: (sx - offsetX) / scale, y: (sy - offsetY) / scale }; }
  function getScale() { return scale; }
  function setScale(s) { scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, s)); }
  function getOffset() { return { x: offsetX, y: offsetY }; }
  function setOffset(x, y) { offsetX = x; offsetY = y; }
  function zoomAt(sx, sy, factor) { const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * factor)); const worldX = (sx - offsetX) / scale; const worldY = (sy - offsetY) / scale; scale = newScale; offsetX = sx - worldX * scale; offsetY = sy - worldY * scale; }
  function zoomCenter(factor) { const rect = container.getBoundingClientRect(); zoomAt(rect.width / 2, rect.height / 2, factor); }
  function fitToView(nodePositions) {
    const rect = container.getBoundingClientRect(); const allPos = Array.from(nodePositions.values()); if (allPos.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    allPos.forEach(pos => { minX = Math.min(minX, pos.x); minY = Math.min(minY, pos.y); maxX = Math.max(maxX, pos.x + pos.width); maxY = Math.max(maxY, pos.y + pos.height); });
    scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(rect.width / (maxX - minX + 100), rect.height / (maxY - minY + 100))));
    offsetX = rect.width / 2 - ((minX + maxX) / 2) * scale; offsetY = rect.height / 2 - ((minY + maxY) / 2) * scale;
  }
  function centerOnNode(nodeId, nodePositions) { const pos = nodePositions.get(nodeId); if (!pos) return; const rect = container.getBoundingClientRect(); offsetX = rect.width / 2 - (pos.x + pos.width / 2) * scale; offsetY = rect.height / 2 - (pos.y + pos.height / 2) * scale; }
  function setSelected(id) { selectedNodeId = id; }
  function getSelected() { return selectedNodeId; }
  function setHovered(id) { hoveredNodeId = id; }
  function setDragging(v) { isDragging = v; }
  function setSearchResults(ids, index) { searchResults = ids || []; currentSearchIndex = index; }
  function shadeColor(color, percent) { const num = parseInt(color.replace('#', ''), 16); const amt = Math.round(2.55 * percent); const r = Math.min(255, Math.max(0, (num >> 16) + amt)); const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt)); const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amt)); return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1); }
  function roundRect(c, x, y, w, h, r) { if (r > w / 2) r = w / 2; if (r > h / 2) r = h / 2; c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath(); }
  function drawConnection(x1, y1, x2, y2, color) { ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.5, 2.5 * scale); ctx.lineCap = 'round'; const dx = x2 - x1, dy = y2 - y1; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.bezierCurveTo(x1 + dx * 0.45, y1 + dy * 0.15, x1 + dx * 0.55, y1 + dy * 0.85, x2, y2); ctx.stroke(); }

  function drawNode(pos, isSelected, isHovered, isSearchMatch, isCurrentSearch) {
    const s = worldToScreen(pos.x, pos.y); const w = pos.width * scale, h = pos.height * scale, x = s.x, y = s.y;
    const node = pos.node, color = node.color || '#E8825A';
    if (isSearchMatch) {
      ctx.fillStyle = isCurrentSearch ? 'rgba(241,196,15,0.3)' : 'rgba(241,196,15,0.15)';
      ctx.beginPath(); roundRect(ctx, x - 4, y - 4, w + 8, h + 8, (NODE_RADIUS + 4) * scale); ctx.fill();
      if (isCurrentSearch) { ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 2 * scale; ctx.beginPath(); roundRect(ctx, x - 4, y - 4, w + 8, h + 8, (NODE_RADIUS + 4) * scale); ctx.stroke(); }
    }
    ctx.shadowColor = 'rgba(0,0,0,0.12)'; ctx.shadowBlur = 10 * scale; ctx.shadowOffsetY = 2 * scale;
    const gradient = ctx.createLinearGradient(x, y, x, y + h); gradient.addColorStop(0, color); gradient.addColorStop(1, shadeColor(color, -15));
    ctx.fillStyle = gradient; ctx.beginPath(); roundRect(ctx, x, y, w, h, NODE_RADIUS * scale); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    if (isSelected) {
      ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 2.5 * scale; ctx.beginPath(); roundRect(ctx, x + 1, y + 1, w - 2, h - 2, NODE_RADIUS * scale); ctx.stroke();
      ctx.strokeStyle = 'rgba(74,144,217,0.5)'; ctx.lineWidth = 5 * scale; ctx.beginPath(); roundRect(ctx, x - 2, y - 2, w + 4, h + 4, (NODE_RADIUS + 2) * scale); ctx.stroke();
    } else if (isHovered) { ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2 * scale; ctx.beginPath(); roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, NODE_RADIUS * scale); ctx.stroke(); }
    ctx.fillStyle = '#fff'; ctx.font = '500 ' + (14 * scale) + 'px "Segoe UI","PingFang SC","Microsoft YaHei",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lines = (node.text || '').split('\n'); const lineHeight = 18 * scale; let textY = y + h / 2 - (lines.length * lineHeight) / 2 + lineHeight / 2;
    lines.forEach(line => { ctx.fillText(line, x + w / 2, textY); textY += lineHeight; });
    if (node.children && node.children.length > 0) {
      const btnR = 6 * scale; const btnX = pos.side === 'right' ? x + w + btnR + 4 * scale : x - btnR - 4 * scale; const btnY = y + h / 2;
      ctx.beginPath(); ctx.arc(btnX, btnY, btnR, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 1.5 * scale; ctx.stroke();
      ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 1.2 * scale; const signR = btnR * 0.45;
      ctx.beginPath(); ctx.moveTo(btnX - signR, btnY); ctx.lineTo(btnX + signR, btnY); ctx.stroke();
      if (pos.node.collapsed) { ctx.beginPath(); ctx.moveTo(btnX, btnY - signR); ctx.lineTo(btnX, btnY + signR); ctx.stroke(); }
    }
  }

  function render(nodePositions, collapsedSet) {
    const dpr = window.devicePixelRatio || 1; const rect = container.getBoundingClientRect(); const cssW = rect.width, cssH = rect.height;
    if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) { canvas.width = cssW * dpr; canvas.height = cssH * dpr; canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px'; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, cssW, cssH);
    const mindMap = JmindCore.getMindMap(); if (!mindMap) return;
    const nodeIds = Array.from(nodePositions.keys());
    nodeIds.forEach(id => { const pos = nodePositions.get(id); if (pos.node.children && !collapsedSet.has(id)) { pos.node.children.forEach(child => { const childPos = nodePositions.get(child.id); if (!childPos) return; const pc = worldToScreen(pos.x + pos.width / 2, pos.y + pos.height / 2); const cc = worldToScreen(childPos.x + childPos.width / 2, childPos.y + childPos.height / 2); const ex = childPos.side === 'right' ? cc.x - childPos.width * scale / 2 : cc.x + childPos.width * scale / 2; const px = childPos.side === 'right' ? pc.x + pos.width * scale / 2 : pc.x - pos.width * scale / 2; drawConnection(px, pc.y, ex, cc.y, child.color || pos.node.color); }); } });
    nodeIds.forEach(id => { const pos = nodePositions.get(id); drawNode(pos, id === selectedNodeId, id === hoveredNodeId && !isDragging, searchResults.includes(id), searchResults.length > 0 && searchResults[currentSearchIndex] === id); });
  }

  function hitTest(sx, sy, nodePositions) {
    for (const [id, pos] of nodePositions) { const s = worldToScreen(pos.x, pos.y); const w = pos.width * scale, h = pos.height * scale;
      if (pos.node.children && pos.node.children.length > 0) { const btnR = 6 * scale; const btnX = pos.side === 'right' ? s.x + w + btnR + 4 * scale : s.x - btnR - 4 * scale; const btnY = s.y + h / 2; if (Math.sqrt((sx - btnX) ** 2 + (sy - btnY) ** 2) <= btnR + 4 * scale) return { id, type: 'collapse-button' }; }
      if (sx >= s.x && sx <= s.x + w && sy >= s.y && sy <= s.y + h) return { id, type: 'node' }; }
    return null;
  }
  function findDropTarget(sx, sy, nodePositions, dragNodeId) {
    let best = null, bestDist = 40 * scale;
    for (const [id, pos] of nodePositions) { if (id === dragNodeId) continue; const s = worldToScreen(pos.x, pos.y); const w = pos.width * scale, h = pos.height * scale; const cx = s.x + w / 2, cy = s.y + h / 2; const dist = Math.sqrt((sx - cx) ** 2 + (sy - cy) ** 2); if (dist < bestDist) { bestDist = dist; best = { id, s, w, h }; } }
    if (!best) return null; const { id, s, w, h } = best; const cy = s.y + h / 2;
    if (sx > s.x + w * 0.6) return { id, position: 'child' };
    if (sy < cy - h * 0.15) return { id, position: 'before' };
    if (sy > cy + h * 0.15) return { id, position: 'after' };
    return { id, position: 'child' };
  }
  function getNodeScreenRect(nodeId, nodePositions) { const pos = nodePositions.get(nodeId); if (!pos) return null; const s = worldToScreen(pos.x, pos.y); return { x: s.x, y: s.y, width: pos.width * scale, height: pos.height * scale, worldX: pos.x, worldY: pos.y, worldWidth: pos.width, worldHeight: pos.height }; }

  function exportPNG(nodePositions, collapsedSet, filename) {
    const bounds = JmindLayout.getContentBounds(); if (bounds.width === 0) return false;
    const padding = 60, exportScale = 2;
    const exportW = (bounds.width + padding * 2) * exportScale, exportH = (bounds.height + padding * 2) * exportScale;
    const offscreen = document.createElement('canvas'); offscreen.width = exportW; offscreen.height = exportH; const offCtx = offscreen.getContext('2d');
    offCtx.fillStyle = '#ffffff'; offCtx.fillRect(0, 0, exportW, exportH);
    const ps = scale, pox = offsetX, poy = offsetY, pc = ctx, pcn = canvas;
    canvas = offscreen; ctx = offCtx; scale = exportScale; offsetX = (-bounds.minX + padding) * exportScale; offsetY = (-bounds.minY + padding) * exportScale;
    const nodeIds = Array.from(nodePositions.keys());
    nodeIds.forEach(id => { const pos = nodePositions.get(id); if (pos.node.children && !collapsedSet.has(id)) { pos.node.children.forEach(child => { const childPos = nodePositions.get(child.id); if (!childPos) return; const pc = worldToScreen(pos.x + pos.width / 2, pos.y + pos.height / 2); const cc = worldToScreen(childPos.x + childPos.width / 2, childPos.y + childPos.height / 2); const ex = childPos.side === 'right' ? cc.x - childPos.width * scale / 2 : cc.x + childPos.width * scale / 2; const px = childPos.side === 'right' ? pc.x + pos.width * scale / 2 : pc.x - pos.width * scale / 2; drawConnection(px, pc.y, ex, cc.y, child.color || pos.node.color); }); } });
    nodeIds.forEach(id => { const pos = nodePositions.get(id); drawNode(pos, false, false, false, false); });
    canvas = pcn; ctx = pc; scale = ps; offsetX = pox; offsetY = poy;
    const link = document.createElement('a'); link.download = filename || 'jmind-export.png'; link.href = offscreen.toDataURL('image/png'); document.body.appendChild(link); link.click(); document.body.removeChild(link); return true;
  }

  return { init, render, worldToScreen, screenToWorld, getScale, setScale, getOffset, setOffset, zoomAt, zoomCenter, fitToView, centerOnNode, setSelected, getSelected, setHovered, setDragging, setSearchResults, hitTest, findDropTarget, getNodeScreenRect, exportPNG, MIN_SCALE, MAX_SCALE };
})();
