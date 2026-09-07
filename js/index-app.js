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

  // 应用主题
  function applyTheme() {
    const settings = JmindStorage.getSettings();
    const theme = settings.theme || 'default';
    document.documentElement.setAttribute('data-theme', theme);
  }
  applyTheme();

  // 加载最近文件
  function loadRecentFiles() {
    const files = JmindStorage.getRecentFiles();
    if (fileCountEl) {
      fileCountEl.textContent = files.length + ' 个文件';
    }
    if (files.length === 0) {
      fileListEl.innerHTML = `
        <div class="empty">
          <div class="empty-icon">🗺️</div>
          <div class="empty-text">暂无文件，点击上方"新建导图"开始</div>
          <button class="btn" id="empty-new">新建导图</button>
        </div>`;
      document.getElementById('empty-new')?.addEventListener('click', createNewFile);
      return;
    }
    fileListEl.innerHTML = '';
    files.forEach(file => {
      const item = document.createElement('div');
      item.className = 'file-item';
      const nodeCount = file.nodeCount ? ` · ${file.nodeCount} 节点` : '';
      item.innerHTML = `
        <div class="file-info">
          <div class="file-name">${escapeHtml(file.name || '未命名')}</div>
          <div class="file-meta">${formatDate(file.modifiedAt)}${nodeCount}</div>
        </div>
        <div class="file-actions">
          <button class="icon-btn" data-action="open" title="打开">📂</button>
          <button class="icon-btn danger" data-action="delete" title="删除">🗑️</button>
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
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
    if (diff < 604800000) return Math.floor(diff / 86400000) + ' 天前';
    return d.toLocaleDateString('zh-CN');
  }

  function deleteFile(id) {
    if (!confirm('确定删除此文件吗？此操作不可撤销。')) return;
    JmindStorage.deleteFile(id);
    loadRecentFiles();
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
        if (!data.root) throw new Error('无效文件：缺少 root 节点');
        const id = JmindStorage.createFileId();
        JmindStorage.saveFile(id, data);
        JmindStorage.setEditId(id);
        window.location.href = 'editor.html';
      } catch (err) {
        alert('导入失败: ' + err.message);
      }
    };
    reader.onerror = () => alert('文件读取失败');
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
