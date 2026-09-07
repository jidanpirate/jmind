/**
 * jmind - Settings Application
 * 设置页逻辑：主题、语言、数据管理
 */
(function () {
  'use strict';

  const APP_VERSION = '1.1.0';

  // 应用当前主题
  function applyTheme() {
    const settings = JmindStorage.getSettings();
    const theme = settings.theme || 'default';
    document.documentElement.setAttribute('data-theme', theme);
  }
  applyTheme();

  // 渲染选中状态
  function renderSelected() {
    const settings = JmindStorage.getSettings();
    document.querySelectorAll('.theme-option').forEach(el => {
      el.classList.toggle('selected', settings.theme === el.dataset.theme);
    });
    document.querySelectorAll('.language-option').forEach(el => {
      el.classList.toggle('selected', (settings.language || 'zh') === el.dataset.lang);
    });
  }

  // 主题选择
  document.querySelectorAll('.theme-option').forEach(el => {
    el.addEventListener('click', () => {
      const theme = el.dataset.theme;
      JmindStorage.updateSetting('theme', theme);
      applyTheme();
      renderSelected();
    });
  });

  // 语言选择
  document.querySelectorAll('.language-option').forEach(el => {
    el.addEventListener('click', () => {
      const lang = el.dataset.lang;
      JmindStorage.updateSetting('language', lang);
      renderSelected();
      // 语言切换提示（当前为即时生效预留）
      if (lang === 'en') {
        showToast('Language set to English (UI localization coming soon)', 'info');
      } else {
        showToast('语言已设置为中文', 'success');
      }
    });
  });

  // 保存并返回
  document.getElementById('btn-save').addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  // 清除所有数据
  document.getElementById('btn-clear-data').addEventListener('click', () => {
    if (confirm('确定清除所有数据吗？此操作将删除所有思维导图和设置，且不可撤销。')) {
      JmindStorage.clearAll();
      alert('所有数据已清除');
      window.location.href = 'index.html';
    }
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
      showToast('数据导出成功', 'success');
    });
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
