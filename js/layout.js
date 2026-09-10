/**
 * jmind - Layout Engine
 * 树状布局引擎：计算每个节点的位置和尺寸
 */
const JmindLayout = (function () {
  // ---------- 布局常量 ----------
  const NODE_HEIGHT = 38;
  const NODE_MIN_WIDTH = 60;
  const NODE_MAX_WIDTH = 220;
  const NODE_PADDING_X = 16;
  const NODE_PADDING_Y = 8;
  const H_GAP = 70;
  const V_GAP = 16;

  let ctx = null;
  let nodePositions = new Map();

  function init(canvasCtx) {
    ctx = canvasCtx;
  }

  function getPositions() {
    return nodePositions;
  }

  function getPosition(nodeId) {
    return nodePositions.get(nodeId) || null;
  }

  function clear() {
    nodePositions.clear();
  }

  // ---------- 文本测量（跟随节点字体样式） ----------
  function measureText(text, node) {
    if (!ctx) return { width: NODE_MIN_WIDTH, height: NODE_HEIGHT, lines: [text] };
    const st = JmindCore.getNodeStyle(node);
    ctx.font = (st.italic ? 'italic ' : '') + (st.bold ? '700 ' : '400 ') + st.fontSize + 'px ' + JmindCore.getFontFamilyCss(st.fontFamily);
    const lines = (text || '').split('\n');
    let maxWidth = 0;
    lines.forEach(line => {
      const w = ctx.measureText(line).width;
      if (w > maxWidth) maxWidth = w;
    });
    const widthCap = Math.min(NODE_MAX_WIDTH + Math.max(0, st.fontSize - 14) * 10, 460);
    const width = Math.max(NODE_MIN_WIDTH, Math.min(widthCap, maxWidth + NODE_PADDING_X * 2));
    const lineHeight = Math.max(18, Math.round(st.fontSize * 1.3));
    const height = Math.max(NODE_HEIGHT, lines.length * lineHeight + NODE_PADDING_Y * 2);
    return { width, height, lines };
  }

  // ---------- 子树高度计算 ----------
  function computeSubtreeHeight(node, collapsedSet) {
    if (collapsedSet.has(node.id) || !node.children || node.children.length === 0) {
      return measureText(node.text, node).height;
    }
    let total = 0;
    node.children.forEach(child => {
      total += computeSubtreeHeight(child, collapsedSet) + V_GAP;
    });
    return Math.max(NODE_HEIGHT, total - V_GAP);
  }

  // ---------- 主布局 ----------
  function layoutTree(mindMap, collapsedSet) {
    nodePositions.clear();
    if (!mindMap) return;

    const rootSize = measureText(mindMap.text, mindMap);
    nodePositions.set(mindMap.id, {
      x: -rootSize.width / 2,
      y: -rootSize.height / 2,
      width: rootSize.width,
      height: rootSize.height,
      node: mindMap,
      depth: 0,
      side: 'center'
    });

    if (mindMap.children && mindMap.children.length > 0 && !collapsedSet.has(mindMap.id)) {
      const leftChildren = [];
      const rightChildren = [];
      mindMap.children.forEach((child, i) => {
        if (i % 2 === 0) rightChildren.push(child);
        else leftChildren.push(child);
      });

      // 分别计算左右两侧子树总高度，各自围绕根节点垂直居中
      let rightTotalHeight = 0;
      rightChildren.forEach(child => { rightTotalHeight += computeSubtreeHeight(child, collapsedSet) + V_GAP; });
      if (rightTotalHeight > 0) rightTotalHeight -= V_GAP;
      let leftTotalHeight = 0;
      leftChildren.forEach(child => { leftTotalHeight += computeSubtreeHeight(child, collapsedSet) + V_GAP; });
      if (leftTotalHeight > 0) leftTotalHeight -= V_GAP;

      // 右侧
      let rightY = -rightTotalHeight / 2;
      rightChildren.forEach(child => {
        const childHeight = computeSubtreeHeight(child, collapsedSet);
        const childSize = measureText(child.text, child);
        const cx = rootSize.width / 2 + H_GAP + childSize.width / 2;
        const cy = rightY + childHeight / 2;
        layoutSubtree(child, cx, cy, 1, 'right', collapsedSet);
        rightY += childHeight + V_GAP;
      });

      // 左侧
      let leftY = -leftTotalHeight / 2;
      leftChildren.forEach(child => {
        const childHeight = computeSubtreeHeight(child, collapsedSet);
        const childSize = measureText(child.text, child);
        const cx = -rootSize.width / 2 - H_GAP - childSize.width / 2;
        const cy = leftY + childHeight / 2;
        layoutSubtree(child, cx, cy, 1, 'left', collapsedSet);
        leftY += childHeight + V_GAP;
      });
    }
  }

  function layoutSubtree(node, cx, cy, depth, side, collapsedSet) {
    const size = measureText(node.text, node);
    const x = cx - size.width / 2;
    const y = cy - size.height / 2;
    nodePositions.set(node.id, {
      x, y,
      width: size.width,
      height: size.height,
      node,
      depth,
      side
    });

    if (collapsedSet.has(node.id) || !node.children || node.children.length === 0) return;

    const subtreeHeight = computeSubtreeHeight(node, collapsedSet);
    let childY = cy - subtreeHeight / 2;

    node.children.forEach(child => {
      const childHeight = computeSubtreeHeight(child, collapsedSet);
      const childSize = measureText(child.text, child);
      const childX = side === 'right'
        ? cx + size.width / 2 + H_GAP + childSize.width / 2
        : cx - size.width / 2 - H_GAP - childSize.width / 2;
      const childCy = childY + childHeight / 2;
      layoutSubtree(child, childX, childCy, depth + 1, side, collapsedSet);
      childY += childHeight + V_GAP;
    });
  }

  // ---------- 内容边界（用于适应画布和导出PNG） ----------
  function getContentBounds() {
    const allPos = Array.from(nodePositions.values());
    if (allPos.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    allPos.forEach(pos => {
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + pos.width);
      maxY = Math.max(maxY, pos.y + pos.height);
    });
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }

  return {
    init,
    layoutTree,
    getPositions,
    getPosition,
    getContentBounds,
    clear,
    measureText,
    NODE_HEIGHT,
    H_GAP,
    V_GAP
  };
})();
