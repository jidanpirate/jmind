/**
 * jmind - Homepage Application
 * 首页逻辑：最近文件列表、新建、导入、删除
 */
(function () {
  'use strict';

  const fileListEl = document.getElementById('file-list');
  const fileCountEl = document.getElementById('file-count');
  const btnNew = document.getElementById('btn-new');
  const btnImport = document.getElementById('btn-import');
  const fileInput = document.getElementById('file-input');
  const L = JmindI18n.t;

  // 应用主题（外观模式 × 主题色）
  JmindStorage.applyTheme();
  JmindI18n.apply();

  // ---------- 创建欢迎文件（首次使用时自动创建） ----------
  function createWelcomeFile() {
    const now = Date.now();
    const welcomeData = {
      format: 'jmind',
      version: '1.1',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      root: {
        id: 'node-welcome-' + now,
        text: '欢迎使用 jmind',
        color: '#E8825A',
        collapsed: false,
        fontSize: 18,
        bold: true,
        italic: false,
        underline: false,
        fontFamily: 'default',
        children: [
          {
            id: 'node-welcome-1-' + now,
            text: '快速开始',
            color: '#5B9BD5',
            collapsed: false,
            fontSize: 14,
            bold: false,
            italic: false,
            underline: false,
            fontFamily: 'default',
            children: [
              { id: 'node-welcome-1-1-' + now, text: '双击节点编辑文字', color: '#FFC000', collapsed: false, fontSize: 14, bold: false, italic: false, underline: false, fontFamily: 'default', children: [] },
              { id: 'node-welcome-1-2-' + now, text: 'Tab 添加子节点', color: '#7B68EE', collapsed: false, fontSize: 14, bold: false, italic: false, underline: false, fontFamily: 'default', children: [] },
              { id: 'node-welcome-1-3-' + now, text: 'Enter 添加兄弟节点', color: '#FF6B6B', collapsed: false, fontSize: 14, bold: false, italic: false, underline: false, fontFamily: 'default', children: [] }
            ]
          },
          {
            id: 'node-welcome-2-' + now,
            text: '实用功能',
            color: '#70AD47',
            collapsed: false,
            fontSize: 14,
            bold: false,
            italic: false,
            underline: false,
            fontFamily: 'default',
            children: [
              { id: 'node-welcome-2-1-' + now, text: '拖拽节点调整结构', color: '#4ECDC4', collapsed: false, fontSize: 14, bold: false, italic: false, underline: false, fontFamily: 'default', children: [] },
              { id: 'node-welcome-2-2-' + now, text: '大纲模式快速编辑', color: '#FF9F43', collapsed: false, fontSize: 14, bold: false, italic: false, underline: false, fontFamily: 'default', children: [] },
              { id: 'node-welcome-2-3-' + now, text: '工具栏字体样式', color: '#A29BFE', collapsed: false, fontSize: 14, bold: false, italic: false, underline: false, fontFamily: 'default', children: [] },
              { id: 'node-welcome-2-4-' + now, text: '导出为 PNG 图片', color: '#FD79A8', collapsed: false, fontSize: 14, bold: false, italic: false, underline: false, fontFamily: 'default', children: [] }
            ]
          },
          {
            id: 'node-welcome-3-' + now,
            text: '快捷键',
            color: '#00B894',
            collapsed: false,
            fontSize: 14,
            bold: false,
            italic: false,
            underline: false,
            fontFamily: 'default',
            children: [
              { id: 'node-welcome-3-1-' + now, text: 'Ctrl+B 加粗', color: '#0984E3', collapsed: false, fontSize: 14, bold: false, italic: false, underline: false, fontFamily: 'default', children: [] },
              { id: 'node-welcome-3-2-' + now, text: 'Ctrl+I 斜体', color: '#6C5CE7', collapsed: false, fontSize: 14, bold: false, italic: false, underline: false, fontFamily: 'default', children: [] },
              { id: 'node-welcome-3-3-' + now, text: 'Ctrl+U 下划线', color: '#E17055', collapsed: false, fontSize: 14, bold: false, italic: false, underline: false, fontFamily: 'default', children: [] },
              { id: 'node-welcome-3-4-' + now, text: 'Ctrl+Shift+O 大纲', color: '#00CEC9', collapsed: false, fontSize: 14, bold: false, italic: false, underline: false, fontFamily: 'default', children: [] }
            ]
          }
        ]
      }
    };
    const id = JmindStorage.createFileId();
    JmindStorage.saveFile(id, welcomeData);
    return id;
  }

  // 加载最近文件
  function loadRecentFiles() {
    let files = JmindStorage.getRecentFiles();
    // 首次使用：自动创建欢迎文件
    if (files.length === 0) {
      createWelcomeFile();
      files = JmindStorage.getRecentFiles();
    }
    if (fileCountEl) {
      fileCountEl.textContent = L('files_count', { n: files.length });
    }
    if (files.length === 0) {
      fileListEl.innerHTML = `
        <div class="empty">
          <div class="empty-icon">🗺️</div>
          <div class="empty-text">${L('empty_text')}</div>
          <button class="btn" id="empty-new">${L('new_map')}</button>
        </div>`;
      document.getElementById('empty-new')?.addEventListener('click', createNewFile);
      return;
    }
    fileListEl.innerHTML = '';
    files.forEach(file => {
      const item = document.createElement('div');
      item.className = 'file-item';
      const nodeCount = file.nodeCount ? ` · ${file.nodeCount}${L('nodes_suffix')}` : '';
      item.innerHTML = `
        <div class="file-info">
          <div class="file-name">${escapeHtml(file.name || L('untitled'))}</div>
          <div class="file-meta">${formatDate(file.modifiedAt)}${nodeCount}</div>
        </div>
        <div class="file-actions">
          <button class="icon-btn" data-action="open" title="${L('open')}">📂</button>
          <button class="icon-btn danger" data-action="delete" title="${L('delete')}">🗑️</button>
        </div>`;
      item.addEventListener('click', (e) => {
        const action = e.target.closest('[data-action]')?.dataset.action;
        if (action === 'delete') {
          e.stopPropagation();
          deleteFile(file.id);
        } else {
          openFile(file.id);
        }
      });
      fileListEl.appendChild(item);
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatDate(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return L('just_now');
    if (diff < 3600000) return L('minutes_ago', { n: Math.floor(diff / 60000) });
    if (diff < 86400000) return L('hours_ago', { n: Math.floor(diff / 3600000) });
    if (diff < 604800000) return L('days_ago', { n: Math.floor(diff / 86400000) });
    return d.toLocaleDateString('zh-CN');
  }

  function deleteFile(id) {
    JmindDialog.confirm({
      title: L('delete'),
      message: L('confirm_delete_file'),
      confirmText: L('delete'),
      type: 'danger',
      icon: '🗑️',
      onConfirm: () => {
        JmindStorage.deleteFile(id);
        loadRecentFiles();
      }
    });
  }

  function openFile(id) {
    JmindStorage.setEditId(id);
    window.location.href = 'editor.html';
  }

  function createNewFile() {
    JmindStorage.setEditId('new');
    window.location.href = 'editor.html';
  }

  function importFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.root) throw new Error(L('invalid_file'));
        const id = JmindStorage.createFileId();
        JmindStorage.saveFile(id, data);
        JmindStorage.setEditId(id);
        window.location.href = 'editor.html';
      } catch (err) {
        JmindDialog.alert({
          title: L('import_failed'),
          message: err.message,
          type: 'danger',
          icon: '⚠️'
        });
      }
    };
    reader.onerror = () => JmindDialog.alert({
      title: L('read_failed'),
      type: 'danger',
      icon: '⚠️'
    });
    reader.readAsText(file);
  }

  // 事件绑定
  btnNew.addEventListener('click', createNewFile);
  btnImport.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) importFile(e.target.files[0]);
    e.target.value = '';
  });

  // 初始化
  loadRecentFiles();
})();