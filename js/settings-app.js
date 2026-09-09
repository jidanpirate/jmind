/**
 * jmind - Settings Application
 * 设置页逻辑：主题、语言、数据管理
 */
(function () {
  'use strict';

  const APP_VERSION = '1.3.0';
  const L = JmindI18n.t;

  // 应用当前主题（外观模式 × 主题色）
  function applyTheme() {
    JmindStorage.applyTheme();
  }
  applyTheme();

  // 渲染选中状态
  function renderSelected() {
    const { mode, accent } = JmindStorage.getThemePrefs();
    document.querySelectorAll('.mode-option').forEach(el => {
      el.classList.toggle('selected', mode === el.dataset.mode);
    });
    document.querySelectorAll('.accent-swatch').forEach(el => {
      el.classList.toggle('selected', accent === el.dataset.accent);
    });
    document.querySelectorAll('.language-option').forEach(el => {
      el.classList.toggle('selected', (JmindStorage.getSettings().language || 'zh') === el.dataset.lang);
    });
  }

  // 外观模式选择（浅色/深色）
  document.querySelectorAll('.mode-option').forEach(el => {
    el.addEventListener('click', () => {
      JmindStorage.updateSetting('mode', el.dataset.mode);
      applyTheme();
      renderSelected();
    });
  });

  // 主题色选择
  document.querySelectorAll('.accent-swatch').forEach(el => {
    el.addEventListener('click', () => {
      JmindStorage.updateSetting('accent', el.dataset.accent);
      applyTheme();
      renderSelected();
    });
  });

  // 语言选择（即时生效）
  document.querySelectorAll('.language-option').forEach(el => {
    el.addEventListener('click', () => {
      const lang = el.dataset.lang;
      JmindStorage.updateSetting('language', lang);
      JmindI18n.apply();
      renderSelected();
      showToast(L(lang === 'en' ? 'lang_en' : 'lang_zh'), 'success');
    });
  });

  // 保存并返回
  document.getElementById('btn-save').addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  // 清除所有数据
  document.getElementById('btn-clear-data').addEventListener('click', () => {
    JmindDialog.confirm({
      title: L('clear_data'),
      message: L('confirm_clear_all'),
      confirmText: L('clear_data'),
      type: 'danger',
      icon: '🗑️',
      onConfirm: () => {
        JmindStorage.clearAll();
        showToast(L('data_cleared'), 'success');
        setTimeout(() => { window.location.href = 'index.html'; }, 800);
      }
    });
  });

  // 导出所有数据
  const btnExport = document.getElementById('btn-export-data');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      const data = JmindStorage.exportAll();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'jmind-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(L('export_success'), 'success');
    });
  }

  // 导入数据 - 自定义模态框（不使用浏览器原生文件输入框样式）
  const btnImport = document.getElementById('btn-import-data');
  if (btnImport) {
    btnImport.addEventListener('click', showImportDialog);
  }

  function showImportDialog() {
    // 创建模态框遮罩
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay import-overlay';
    overlay.innerHTML = `
      <div class="dialog-box import-box">
        <div class="dialog-icon dialog-icon-info">📥</div>
        <div class="dialog-title">导入数据</div>
        <div class="import-drop-zone" id="import-drop-zone">
          <div class="import-drop-icon">📁</div>
          <div class="import-drop-text">拖拽 JSON 备份文件到此处</div>
          <div class="import-drop-hint">或点击选择文件</div>
        </div>
        <div class="import-file-info hidden" id="import-file-info">
          <div class="import-file-icon">📄</div>
          <div class="import-file-detail">
            <div class="import-file-name" id="import-file-name"></div>
            <div class="import-file-size" id="import-file-size"></div>
          </div>
          <button class="import-file-remove" id="import-file-remove" title="移除">✕</button>
        </div>
        <div class="dialog-actions">
          <button class="dialog-btn dialog-btn-cancel" id="import-cancel">取消</button>
          <button class="dialog-btn dialog-btn-confirm" id="import-confirm" disabled>确认导入</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // 隐藏的文件输入（仅用于触发系统文件选择，完全不显示原生样式）
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,application/json';
    fileInput.style.display = 'none';
    overlay.appendChild(fileInput);

    const dropZone = overlay.querySelector('#import-drop-zone');
    const fileInfo = overlay.querySelector('#import-file-info');
    const fileNameEl = overlay.querySelector('#import-file-name');
    const fileSizeEl = overlay.querySelector('#import-file-size');
    const removeBtn = overlay.querySelector('#import-file-remove');
    const confirmBtn = overlay.querySelector('#import-confirm');
    const cancelBtn = overlay.querySelector('#import-cancel');

    let selectedFile = null;

    function handleFile(file) {
      if (!file) return;
      const isJson = file.name.endsWith('.json') || file.type === 'application/json' || file.type === 'text/plain';
      if (!isJson) {
        showToast('请选择 JSON 格式的备份文件', 'error');
        return;
      }
      selectedFile = file;
      fileNameEl.textContent = file.name;
      fileSizeEl.textContent = formatFileSize(file.size);
      dropZone.classList.add('hidden');
      fileInfo.classList.remove('hidden');
      confirmBtn.disabled = false;
    }

    function resetSelection() {
      selectedFile = null;
      fileInput.value = '';
      dropZone.classList.remove('hidden');
      fileInfo.classList.add('hidden');
      confirmBtn.disabled = true;
    }

    // 点击拖拽区域触发文件选择
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      if (e.target.files[0]) handleFile(e.target.files[0]);
    });

    // 拖拽上传
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });

    // 移除已选文件
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      resetSelection();
    });

    function close() {
      overlay.classList.remove('show');
      setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 250);
    }

    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    // Esc 关闭
    function onKey(e) {
      if (e.key === 'Escape') {
        close();
        document.removeEventListener('keydown', onKey);
      }
    }
    document.addEventListener('keydown', onKey);

    // 确认导入
    confirmBtn.addEventListener('click', () => {
      if (!selectedFile) return;
      confirmBtn.disabled = true;
      confirmBtn.textContent = '导入中...';
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (typeof data !== 'object' || data === null) {
            throw new Error('无效的备份文件格式');
          }
          // 统计并导入 jmind 数据
          let count = 0;
          Object.keys(data).forEach(key => {
            if (key.startsWith('jmind_')) {
              localStorage.setItem(key, data[key]);
              count++;
            }
          });
          if (count === 0) {
            throw new Error('备份文件中没有找到 jmind 数据');
          }
          close();
          showToast(`成功导入 ${count} 条数据`, 'success');
          setTimeout(() => { window.location.reload(); }, 1200);
        } catch (err) {
          showToast(err.message || '导入失败', 'error');
          confirmBtn.disabled = false;
          confirmBtn.textContent = '确认导入';
        }
      };
      reader.onerror = () => {
        showToast('读取文件失败', 'error');
        confirmBtn.disabled = false;
        confirmBtn.textContent = '确认导入';
      };
      reader.readAsText(selectedFile);
    });

    // 显示模态框
    requestAnimationFrame(() => overlay.classList.add('show'));
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // Toast
  let toastTimer = null;
  function showToast(msg, type = 'info') {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = 'toast ' + type;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  // 版本号
  const versionEl = document.getElementById('app-version');
  if (versionEl) versionEl.textContent = 'v' + APP_VERSION;

  // 初始化
  renderSelected();
})();