/**
 * jmind - Renderer Module
 * Canvas 渲染器：绘制节点、连线、选中态、搜索高亮、导出PNG
 */
const JmindRenderer = (function () {
  // ---------- 常量 ----------
  const NODE_RADIUS = 10;
  const MIN_SCALE = 0.25;
  const MAX_SCALE = 3.0;

  let canvas = null;
  let ctx = null;
  let container = null;
  let scale = 1.0;
  let offsetX = 0;
  let offsetY = 0;
  let selectedNodeId = null;
  let hoveredNodeId = null;
  let searchResults = [];
  let currentSearchIndex = -1;
  let isDragging = false;

  // 主题强调色（跟随 CSS 变量 --accent-rgb）
  let accentRGB = { r: 10, g: 132, b: 255 };
  function refreshAccent() {
    if (typeof getComputedStyle !== 'function') return;
    const v = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim();
    const parts = v.split(',').map(s => parseInt(s.trim(), 10));
    if (parts.length === 3 && parts.every(n => !Number.isNaN(n))) {
      accentRGB = { r: parts[0], g: parts[1], b: parts[2] };
    }
  }
  function accentRgba(alpha) {
    return `rgba(${accentRGB.r},${accentRGB.g},${accentRGB.b},${alpha})`;
  }

  // ---------- 动画状态 ----------
  let animFrameId = null;
  let lastPositions = null;
  let lastCollapsed = null;
  let selectedPulseStart = 0;
  const appearAnims = new Map(); // nodeId -> 出现动画起始时间
  const hoverScales = new Map(); // nodeId -> 当前 hover 缩放值（平滑趋近）
  const APPEAR_DURATION = 380;

  function easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function triggerAppear(nodeId) {
    appearAnims.set(nodeId, performance.now());
    ensureAnimLoop();
  }

  function ensureAnimLoop() {
    if (animFrameId !== null) return;
    const loop = () => {
      const now = performance.now();
      let needsMore = false;

      if (selectedNodeId) needsMore = true;
      if (hoveredNodeId) needsMore = true;
      for (const [, start] of appearAnims) {
        if (now - start < APPEAR_DURATION) needsMore = true;
      }
      for (const v of hoverScales.values()) {
        if (Math.abs(v - 1) > 0.001 || (hoveredNodeId && Math.abs(v - 1.04) > 0.001)) needsMore = true;
      }

      if (needsMore && lastPositions) {
        drawFrame(lastPositions, lastCollapsed);
        animFrameId = requestAnimationFrame(loop);
      } else {
        animFrameId = null;
        if (lastPositions) drawFrame(lastPositions, lastCollapsed);
      }
    };
    animFrameId = requestAnimationFrame(loop);
  }

  // ---------- 初始化 ----------
  function init(canvasEl, containerEl) {
    canvas = canvasEl;
    container = containerEl;
    ctx = canvas.getContext('2d');
    return ctx;
  }

  // ---------- 视图变换 ----------
  function worldToScreen(wx, wy) {
    return { x: wx * scale + offsetX, y: wy * scale + offsetY };
  }

  function screenToWorld(sx, sy) {
    return { x: (sx - offsetX) / scale, y: (sy - offsetY) / scale };
  }

  function getScale() { return scale; }
  function setScale(s) { scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, s)); }
  function getOffset() { return { x: offsetX, y: offsetY }; }
  function setOffset(x, y) { offsetX = x; offsetY = y; }

  function zoomAt(sx, sy, factor) {
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * factor));
    const worldX = (sx - offsetX) / scale;
    const worldY = (sy - offsetY) / scale;
    scale = newScale;
    offsetX = sx - worldX * scale;
    offsetY = sy - worldY * scale;
  }

  function zoomCenter(factor) {
    const rect = container.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    zoomAt(cx, cy, factor);
  }

  function fitToView(nodePositions) {
    const rect = container.getBoundingClientRect();
    const allPos = Array.from(nodePositions.values());
    if (allPos.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    allPos.forEach(pos => {
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + pos.width);
      maxY = Math.max(maxY, pos.y + pos.height);
    });
    const contentW = maxX - minX + 100;
    const contentH = maxY - minY + 100;
    scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(rect.width / contentW, rect.height / contentH)));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    offsetX = rect.width / 2 - centerX * scale;
    offsetY = rect.height / 2 - centerY * scale;
  }

  function centerOnNode(nodeId, nodePositions) {
    const pos = nodePositions.get(nodeId);
    if (!pos) return;
    const rect = container.getBoundingClientRect();
    const centerX = pos.x + pos.width / 2;
    const centerY = pos.y + pos.height / 2;
    offsetX = rect.width / 2 - centerX * scale;
    offsetY = rect.height / 2 - centerY * scale;
  }

  // ---------- 选中/悬停 ----------
  function setSelected(id) {
    if (id !== selectedNodeId && id) selectedPulseStart = performance.now();
    selectedNodeId = id;
    ensureAnimLoop();
  }
  function getSelected() { return selectedNodeId; }
  function setHovered(id) {
    hoveredNodeId = id;
    ensureAnimLoop();
  }
  function setDragging(v) { isDragging = v; }

  // ---------- 搜索高亮 ----------
  function setSearchResults(ids, index) {
    searchResults = ids || [];
    currentSearchIndex = index;
  }

  // ---------- 工具函数 ----------
  function shadeColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const r = Math.min(255, Math.max(0, (num >> 16) + amt));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt));
    const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
    return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
  }

  function roundRect(c, x, y, w, h, r) {
    if (r > w / 2) r = w / 2;
    if (r > h / 2) r = h / 2;
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  // ---------- 绘制连线 ----------
  function drawConnection(x1, y1, x2, y2, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, 2.5 * scale);
    ctx.lineCap = 'round';
    const dx = x2 - x1;
    const dy = y2 - y1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(x1 + dx * 0.45, y1 + dy * 0.15, x1 + dx * 0.55, y1 + dy * 0.85, x2, y2);
    ctx.stroke();
  }

  // ---------- 绘制节点 ----------
  function drawNode(pos, isSelected, isHovered, isSearchMatch, isCurrentSearch) {
    const now = performance.now();
    const node = pos.node;
    const color = node.color || '#E8825A';

    // 计算出现动画缩放
    let appearScale = 1;
    const appearStart = appearAnims.get(node.id);
    if (appearStart !== undefined) {
      const t = Math.min(1, (now - appearStart) / APPEAR_DURATION);
      appearScale = t < 1 ? Math.max(0.01, easeOutBack(t)) : 1;
      if (t >= 1) appearAnims.delete(node.id);
    }

    // hover 平滑放大
    const targetHover = isHovered && !isDragging ? 1.045 : 1;
    let hv = hoverScales.get(node.id) ?? 1;
    hv += (targetHover - hv) * 0.22;
    if (Math.abs(hv - targetHover) < 0.001) hv = targetHover;
    hoverScales.set(node.id, hv);

    const animScale = appearScale * hv;

    const s = worldToScreen(pos.x, pos.y);
    const w = pos.width * scale;
    const h = pos.height * scale;
    let x = s.x;
    let y = s.y;

    // 以节点中心为原点应用动画缩放
    ctx.save();
    if (animScale !== 1) {
      const cx = x + w / 2;
      const cy = y + h / 2;
      ctx.translate(cx, cy);
      ctx.scale(animScale, animScale);
      ctx.translate(-cx, -cy);
    }

    // 搜索高亮背景
    if (isSearchMatch) {
      ctx.fillStyle = isCurrentSearch ? 'rgba(241, 196, 15, 0.3)' : 'rgba(241, 196, 15, 0.15)';
      ctx.beginPath();
      roundRect(ctx, x - 4, y - 4, w + 8, h + 8, (NODE_RADIUS + 4) * scale);
      ctx.fill();
      if (isCurrentSearch) {
        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        roundRect(ctx, x - 4, y - 4, w + 8, h + 8, (NODE_RADIUS + 4) * scale);
        ctx.stroke();
      }
    }

    // 选中脉冲光环（外圈呼吸光，颜色跟随主题强调色）
    if (isSelected) {
      const pulseT = (now - selectedPulseStart) / 1000;
      const pulse = (Math.sin(pulseT * 3.2) + 1) / 2; // 0..1
      const glowR = (NODE_RADIUS + 3) * scale + pulse * 3 * scale;
      ctx.strokeStyle = accentRgba(0.18 + pulse * 0.22);
      ctx.lineWidth = (3 + pulse * 3) * scale;
      ctx.beginPath();
      roundRect(ctx, x - 3 - pulse * 2, y - 3 - pulse * 2, w + 6 + pulse * 4, h + 6 + pulse * 4, glowR);
      ctx.stroke();
    }

    // 阴影
    ctx.shadowColor = 'rgba(0,0,0,0.12)';
    ctx.shadowBlur = (isHovered ? 16 : 10) * scale;
    ctx.shadowOffsetY = 2 * scale;

    // 渐变填充
    const gradient = ctx.createLinearGradient(x, y, x, y + h);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, shadeColor(color, -15));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    roundRect(ctx, x, y, w, h, NODE_RADIUS * scale);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // 选中/悬停边框
    if (isSelected) {
      ctx.strokeStyle = '#2c3e50';
      ctx.lineWidth = 2.5 * scale;
      ctx.beginPath();
      roundRect(ctx, x + 1, y + 1, w - 2, h - 2, NODE_RADIUS * scale);
      ctx.stroke();
      ctx.strokeStyle = accentRgba(0.55);
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      roundRect(ctx, x - 1, y - 1, w + 2, h + 2, (NODE_RADIUS + 1) * scale);
      ctx.stroke();
    } else if (isHovered) {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, NODE_RADIUS * scale);
      ctx.stroke();
    }

    // 文本（支持节点字体样式：字号/粗体/斜体/下划线/字体）
    const st = JmindCore.getNodeStyle(node);
    ctx.fillStyle = '#fff';
    ctx.font = (st.italic ? 'italic ' : '') + (st.bold ? '700 ' : '500 ') + (st.fontSize * scale) + 'px ' + JmindCore.getFontFamilyCss(st.fontFamily);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = (node.text || '').split('\n');
    const lineHeight = st.fontSize * 1.3 * scale;
    const totalTextHeight = lines.length * lineHeight;
    let textY = y + h / 2 - totalTextHeight / 2 + lineHeight / 2;
    lines.forEach(line => {
      ctx.fillText(line, x + w / 2, textY);
      if (st.underline) {
        const tw = ctx.measureText(line).width;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = Math.max(1, 1.4 * scale);
        ctx.beginPath();
        ctx.moveTo(x + w / 2 - tw / 2, textY + st.fontSize * 0.38 * scale);
        ctx.lineTo(x + w / 2 + tw / 2, textY + st.fontSize * 0.38 * scale);
        ctx.stroke();
      }
      textY += lineHeight;
    });

    // 折叠按钮
    if (node.children && node.children.length > 0) {
      const isCollapsed = pos.node.collapsed;
      const btnR = 6 * scale;
      const btnX = pos.side === 'right' ? x + w + btnR + 4 * scale : x - btnR - 4 * scale;
      const btnY = y + h / 2;
      ctx.beginPath();
      ctx.arc(btnX, btnY, btnR, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5 * scale;
      ctx.stroke();
      ctx.strokeStyle = '#2c3e50';
      ctx.lineWidth = 1.2 * scale;
      const signR = btnR * 0.45;
      ctx.beginPath();
      ctx.moveTo(btnX - signR, btnY);
      ctx.lineTo(btnX + signR, btnY);
      ctx.stroke();
      if (isCollapsed) {
        ctx.beginPath();
        ctx.moveTo(btnX, btnY - signR);
        ctx.lineTo(btnX, btnY + signR);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // ---------- 主渲染 ----------
  function render(nodePositions, collapsedSet) {
    refreshAccent();
    lastPositions = nodePositions;
    lastCollapsed = collapsedSet;
    drawFrame(nodePositions, collapsedSet);
    ensureAnimLoop();
  }

  function drawFrame(nodePositions, collapsedSet) {
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const cssW = rect.width;
    const cssH = rect.height;
    if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const mindMap = JmindCore.getMindMap();
    if (!mindMap) return;

    const nodeIds = Array.from(nodePositions.keys());

    // 绘制连线
    nodeIds.forEach(id => {
      const pos = nodePositions.get(id);
      if (pos.node.children && !collapsedSet.has(id)) {
        pos.node.children.forEach(child => {
          const childPos = nodePositions.get(child.id);
          if (!childPos) return;
          const parentCenter = worldToScreen(pos.x + pos.width / 2, pos.y + pos.height / 2);
          const childCenter = worldToScreen(childPos.x + childPos.width / 2, childPos.y + childPos.height / 2);
          const edgeX = childPos.side === 'right'
            ? childCenter.x - childPos.width * scale / 2
            : childCenter.x + childPos.width * scale / 2;
          const parentEdgeX = childPos.side === 'right'
            ? parentCenter.x + pos.width * scale / 2
            : parentCenter.x - pos.width * scale / 2;
          drawConnection(parentEdgeX, parentCenter.y, edgeX, childCenter.y, child.color || pos.node.color);
        });
      }
    });

    // 绘制节点
    nodeIds.forEach(id => {
      const pos = nodePositions.get(id);
      const isSearchMatch = searchResults.includes(id);
      const isCurrentSearch = searchResults.length > 0 && searchResults[currentSearchIndex] === id;
      drawNode(
        pos,
        id === selectedNodeId,
        id === hoveredNodeId && !isDragging,
        isSearchMatch,
        isCurrentSearch
      );
    });
  }

  // ---------- 命中检测 ----------
  function hitTest(sx, sy, nodePositions) {
    for (const [id, pos] of nodePositions) {
      const s = worldToScreen(pos.x, pos.y);
      const w = pos.width * scale;
      const h = pos.height * scale;
      // 折叠按钮
      if (pos.node.children && pos.node.children.length > 0) {
        const btnR = 6 * scale;
        const btnX = pos.side === 'right' ? s.x + w + btnR + 4 * scale : s.x - btnR - 4 * scale;
        const btnY = s.y + h / 2;
        const dist = Math.sqrt((sx - btnX) ** 2 + (sy - btnY) ** 2);
        if (dist <= btnR + 4 * scale) return { id, type: 'collapse-button' };
      }
      if (sx >= s.x && sx <= s.x + w && sy >= s.y && sy <= s.y + h) {
        return { id, type: 'node' };
      }
    }
    return null;
  }

  function findDropTarget(sx, sy, nodePositions, dragNodeId) {
    let best = null;
    let bestDist = 40 * scale;
    for (const [id, pos] of nodePositions) {
      if (id === dragNodeId) continue;
      const s = worldToScreen(pos.x, pos.y);
      const w = pos.width * scale;
      const h = pos.height * scale;
      const cx = s.x + w / 2;
      const cy = s.y + h / 2;
      const dist = Math.sqrt((sx - cx) ** 2 + (sy - cy) ** 2);
      if (dist < bestDist) {
        bestDist = dist;
        best = { id, s, w, h };
      }
    }
    if (!best) return null;
    const { id, s, w, h } = best;
    const cy = s.y + h / 2;
    if (sx > s.x + w * 0.6) return { id, position: 'child' };
    if (sy < cy - h * 0.15) return { id, position: 'before' };
    if (sy > cy + h * 0.15) return { id, position: 'after' };
    return { id, position: 'child' };
  }

  function getNodeScreenRect(nodeId, nodePositions) {
    const pos = nodePositions.get(nodeId);
    if (!pos) return null;
    const s = worldToScreen(pos.x, pos.y);
    return {
      x: s.x,
      y: s.y,
      width: pos.width * scale,
      height: pos.height * scale,
      worldX: pos.x,
      worldY: pos.y,
      worldWidth: pos.width,
      worldHeight: pos.height
    };
  }

  // ---------- 导出 PNG ----------
  function exportPNG(nodePositions, collapsedSet, filename) {
    const bounds = JmindLayout.getContentBounds();
    if (bounds.width === 0) return false;

    const padding = 60;
    const exportScale = 2; // 2x 高清
    const exportW = (bounds.width + padding * 2) * exportScale;
    const exportH = (bounds.height + padding * 2) * exportScale;

    const offscreen = document.createElement('canvas');
    offscreen.width = exportW;
    offscreen.height = exportH;
    const offCtx = offscreen.getContext('2d');

    // 背景
    offCtx.fillStyle = '#ffffff';
    offCtx.fillRect(0, 0, exportW, exportH);

    // 保存当前状态
    const prevScale = scale;
    const prevOffsetX = offsetX;
    const prevOffsetY = offsetY;
    const prevCtx = ctx;
    const prevCanvas = canvas;

    // 切换到离屏画布
    canvas = offscreen;
    ctx = offCtx;
    scale = exportScale;
    offsetX = (-bounds.minX + padding) * exportScale;
    offsetY = (-bounds.minY + padding) * exportScale;

    // 导出时屏蔽出现/悬停动画
    const savedAppear = new Map(appearAnims);
    const savedHover = new Map(hoverScales);
    appearAnims.clear();
    hoverScales.clear();

    // 绘制
    const nodeIds = Array.from(nodePositions.keys());
    nodeIds.forEach(id => {
      const pos = nodePositions.get(id);
      if (pos.node.children && !collapsedSet.has(id)) {
        pos.node.children.forEach(child => {
          const childPos = nodePositions.get(child.id);
          if (!childPos) return;
          const parentCenter = worldToScreen(pos.x + pos.width / 2, pos.y + pos.height / 2);
          const childCenter = worldToScreen(childPos.x + childPos.width / 2, childPos.y + childPos.height / 2);
          const edgeX = childPos.side === 'right'
            ? childCenter.x - childPos.width * scale / 2
            : childCenter.x + childPos.width * scale / 2;
          const parentEdgeX = childPos.side === 'right'
            ? parentCenter.x + pos.width * scale / 2
            : parentCenter.x - pos.width * scale / 2;
          drawConnection(parentEdgeX, parentCenter.y, edgeX, childCenter.y, child.color || pos.node.color);
        });
      }
    });

    nodeIds.forEach(id => {
      const pos = nodePositions.get(id);
      drawNode(pos, false, false, false, false);
    });

    // 恢复
    canvas = prevCanvas;
    ctx = prevCtx;
    scale = prevScale;
    offsetX = prevOffsetX;
    offsetY = prevOffsetY;
    savedAppear.forEach((v, k) => appearAnims.set(k, v));
    savedHover.forEach((v, k) => hoverScales.set(k, v));

    // 下载
    const link = document.createElement('a');
    link.download = filename || 'jmind-export.png';
    link.href = offscreen.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  }

  return {
    init,
    render,
    worldToScreen,
    screenToWorld,
    getScale,
    setScale,
    getOffset,
    setOffset,
    zoomAt,
    zoomCenter,
    fitToView,
    centerOnNode,
    setSelected,
    getSelected,
    setHovered,
    setDragging,
    setSearchResults,
    hitTest,
    findDropTarget,
    getNodeScreenRect,
    exportPNG,
    triggerAppear,
    MIN_SCALE,
    MAX_SCALE
  };
})();
