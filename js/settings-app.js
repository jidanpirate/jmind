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
    if (confirm(L('confirm_clear_all'))) {
      JmindStorage.clearAll();
      alert(L('data_cleared'));
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
      showToast(L('export_success'), 'success');
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
