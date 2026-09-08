/**
 * jmind - Storage Module
 * 本地存储管理：文件 CRUD、设置读写、最近文件列表
 */
const JmindStorage = (function () {
  const PREFIX = 'jmind_';
  const FILES_KEY = PREFIX + 'recent_files';
  const SETTINGS_KEY = PREFIX + 'settings';
  const EDIT_ID_KEY = PREFIX + 'edit_id';

  // ---------- 设置 ----------
  function getSettings() {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function updateSetting(key, value) {
    const settings = getSettings();
    settings[key] = value;
    saveSettings(settings);
    return settings;
  }

  // ---------- 主题（外观模式 × 强调色，两个独立维度） ----------
  const MODES = ['light', 'dark'];
  const ACCENTS = ['blue', 'green', 'pink', 'purple', 'orange'];

  // 归一化主题偏好，并兼容旧版单一 theme 字段
  function getThemePrefs() {
    const s = getSettings();
    let mode = s.mode;
    let accent = s.accent;
    if (!MODES.includes(mode) || !ACCENTS.includes(accent)) {
      // 旧版 theme -> [mode, accent] 迁移映射
      const legacyMap = {
        dark: ['dark', 'blue'],
        green: ['light', 'green'],
        pink: ['light', 'pink'],
        blue: ['light', 'blue'],
        default: ['light', 'blue']
      };
      const [lm, la] = legacyMap[s.theme] || ['light', 'blue'];
      if (!MODES.includes(mode)) mode = lm;
      if (!ACCENTS.includes(accent)) accent = la;
    }
    return { mode, accent };
  }

  // 统一应用主题到根元素：data-mode + data-accent
  function applyTheme(rootEl) {
    const root = rootEl || document.documentElement;
    const prefs = getThemePrefs();
    root.setAttribute('data-mode', prefs.mode);
    root.setAttribute('data-accent', prefs.accent);
    return prefs;
  }

  // ---------- 文件 ----------
  function getRecentFiles() {
    try {
      return JSON.parse(localStorage.getItem(FILES_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function saveRecentFiles(files) {
    localStorage.setItem(FILES_KEY, JSON.stringify(files));
  }

  function getFile(id) {
    const raw = localStorage.getItem(PREFIX + 'file_' + id);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function saveFile(id, data) {
    localStorage.setItem(PREFIX + 'file_' + id, JSON.stringify(data));
    const files = getRecentFiles();
    const name = data.root?.text || '未命名';
    const existing = files.find(f => f.id === id);
    if (existing) {
      existing.name = name;
      existing.modifiedAt = Date.now();
      existing.nodeCount = countNodesInData(data.root);
    } else {
      files.unshift({
        id,
        name,
        modifiedAt: Date.now(),
        nodeCount: countNodesInData(data.root)
      });
    }
    saveRecentFiles(files);
  }

  function deleteFile(id) {
    localStorage.removeItem(PREFIX + 'file_' + id);
    const files = getRecentFiles().filter(f => f.id !== id);
    saveRecentFiles(files);
  }

  function createFileId() {
    return 'file_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  }

  // ---------- 编辑上下文 ----------
  function getEditId() {
    return localStorage.getItem(EDIT_ID_KEY);
  }

  function setEditId(id) {
    localStorage.setItem(EDIT_ID_KEY, id);
  }

  // ---------- 工具 ----------
  function countNodesInData(node) {
    if (!node) return 0;
    let count = 1;
    if (node.children) node.children.forEach(c => count += countNodesInData(c));
    return count;
  }

  function clearAll() {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => localStorage.removeItem(k));
  }

  function exportAll() {
    const data = {};
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => { data[k] = localStorage.getItem(k); });
    return data;
  }

  return {
    getSettings,
    saveSettings,
    updateSetting,
    getThemePrefs,
    applyTheme,
    MODES,
    ACCENTS,
    getRecentFiles,
    getFile,
    saveFile,
    deleteFile,
    createFileId,
    getEditId,
    setEditId,
    clearAll,
    exportAll,
    countNodesInData
  };
})();
