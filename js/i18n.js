/**
 * jmind - i18n Module
 * 国际化：中英词典、t() 翻译函数、页面文本应用
 * 依赖 JmindStorage（读取 language 设置）
 */
const JmindI18n = (function () {
  'use strict';

  const DICT = {
    zh: {
      // ---------- 编辑器 ----------
      back: '返回首页',
      save: '保存',
      save_title: '保存 (Ctrl+S)',
      undo: '撤销',
      undo_title: '撤销 (Ctrl+Z)',
      redo: '重做',
      redo_title: '重做 (Ctrl+Y)',
      add_child: '子节点',
      add_child_title: '添加子节点 (Tab)',
      add_sibling: '兄弟',
      add_sibling_title: '添加兄弟节点 (Enter)',
      edit: '编辑',
      edit_title: '编辑节点文本 (F2)',
      delete: '删除',
      delete_title: '删除节点 (Delete)',
      collapse: '折叠',
      collapse_title: '折叠/展开 (Space)',
      search: '搜索',
      search_title: '搜索节点 (Ctrl+F)',
      outline: '大纲',
      outline_title: '大纲视图 (Ctrl+Shift+O)',
      export: '导出',
      export_title: '导出为 JSON 文件',
      export_png: 'PNG',
      export_png_title: '导出为 PNG 图片',
      clear: '清屏',
      clear_title: '清空子节点，保留中心主题',
      saved: '已保存',
      unsaved: '未保存',
      search_placeholder: '搜索节点...',
      search_empty: '无结果',
      menu_add_child: '添加子节点',
      menu_add_sibling: '添加兄弟节点',
      menu_edit_text: '编辑文本',
      menu_change_color: '更改颜色',
      menu_toggle_collapse: '折叠/展开',
      menu_copy: '复制节点',
      menu_paste: '粘贴节点',
      menu_duplicate: '复制为副本',
      menu_delete: '删除节点',
      kbd_child: '子',
      kbd_sibling: '兄弟',
      kbd_delete: '删除',
      kbd_edit: '编辑',
      kbd_fold: '折叠',
      kbd_undo: '撤销',
      kbd_search: '搜索',
      title_suffix: ' - jmind 编辑器',
      untitled: '未命名',
      default_node: '节点',
      new_node: '新节点',
      duplicate_suffix: ' 副本',
      toast_save_success: '保存成功',
      toast_save_empty: '没有内容可保存',
      toast_export_success: '导出成功',
      toast_export_empty: '没有可导出的内容',
      toast_png_success: 'PNG 导出成功',
      toast_png_fail: '导出失败',
      toast_root_no_sibling: '根节点不能添加兄弟节点',
      toast_root_no_delete: '根节点不能删除',
      toast_undo: '已撤销',
      toast_no_undo: '没有可撤销的操作',
      toast_redo: '已重做',
      toast_no_redo: '没有可重做的操作',
      toast_copied: '已复制节点',
      toast_pick_target: '请先选择目标节点',
      toast_pasted: '已粘贴',
      toast_clipboard_empty: '剪贴板为空',
      toast_root_no_duplicate: '根节点不能复制',
      toast_cleared: '已清空，保留中心主题',
      toast_pick_node: '请先选择一个节点',
      toast_pick_nonroot: '请先选择一个非根节点',
      stats_nodes: '节点: {total} (可见 {visible})',
      stats_zoom: '缩放: {scale}%',
      outline_empty: '暂无内容',

      // ---------- 设置页 ----------
      settings_title: '⚙️ 设置',
      settings_doc_title: 'jmind - 设置',
      appearance: '外观模式',
      appearance_desc: '选择浅色或深色界面，可与下方主题色自由搭配',
      light: '浅色',
      dark: '深色',
      accent: '主题色',
      accent_desc: '选择界面的强调颜色',
      language: '语言',
      language_desc: '选择界面显示语言，立即生效',
      data_section: '📦 数据管理',
      data_desc: '所有数据均存储在你的浏览器本地（localStorage），不会上传到任何服务器。',
      export_backup: '📤 导出备份',
      clear_data: '🗑️ 清除所有数据',
      done: '完成',
      confirm_clear_all: '确定清除所有数据吗？此操作将删除所有思维导图和设置，且不可撤销。',
      data_cleared: '所有数据已清除',
      export_success: '数据导出成功',
      lang_zh: '语言已设置为中文',
      lang_en: '语言已设置为英文',

      // ---------- 首页 ----------
      nav_new: '新建',
      nav_settings: '设置',
      index_title: 'jmind — 思维导图',
      hero_title: '思维导图，',
      hero_title_span: '简单而强大',
      hero_sub: '快速构建你的想法，支持本地保存、导入导出、撤销重做、节点搜索，随时随地编辑。',
      new_map: '新建导图',
      import_file: '导入文件',
      f_visual: '可视化编辑',
      f_visual_desc: '拖拽节点、缩放画布、流畅交互',
      f_local: '本地优先',
      f_local_desc: '数据存储在浏览器，隐私安全',
      f_export: '导出 PNG',
      f_export_desc: '高清导出思维导图为图片',
      f_shortcuts: '快捷键',
      f_shortcuts_desc: 'Tab/Enter/Delete 高效操作',
      recent: '最近打开',
      files_count: '{n} 个文件',
      empty_text: '暂无文件，点击上方"新建导图"开始',
      footer: 'jmind · 本地优先的思维导图工具 · 数据仅存储在你的浏览器中',
      nodes_suffix: ' 节点',
      open: '打开',
      delete: '删除',
      just_now: '刚刚',
      minutes_ago: '{n} 分钟前',
      hours_ago: '{n} 小时前',
      days_ago: '{n} 天前',
      invalid_file: '无效文件：缺少 root 节点',
      import_failed: '导入失败',
      read_failed: '文件读取失败',
      confirm_delete_file: '确定删除此文件吗？此操作不可撤销。'
    },

    en: {
      // ---------- Editor ----------
      back: 'Back to Home',
      save: 'Save',
      save_title: 'Save (Ctrl+S)',
      undo: 'Undo',
      undo_title: 'Undo (Ctrl+Z)',
      redo: 'Redo',
      redo_title: 'Redo (Ctrl+Y)',
      add_child: 'Child',
      add_child_title: 'Add child (Tab)',
      add_sibling: 'Sibling',
      add_sibling_title: 'Add sibling (Enter)',
      edit: 'Edit',
      edit_title: 'Edit node text (F2)',
      delete: 'Delete',
      delete_title: 'Delete node (Delete)',
      collapse: 'Fold',
      collapse_title: 'Fold/Expand (Space)',
      search: 'Search',
      search_title: 'Search nodes (Ctrl+F)',
      outline: 'Outline',
      outline_title: 'Outline view (Ctrl+Shift+O)',
      export: 'Export',
      export_title: 'Export as JSON file',
      export_png: 'PNG',
      export_png_title: 'Export as PNG image',
      clear: 'Clear',
      clear_title: 'Clear children, keep root topic',
      saved: 'Saved',
      unsaved: 'Unsaved',
      search_placeholder: 'Search nodes...',
      search_empty: 'No results',
      menu_add_child: 'Add child',
      menu_add_sibling: 'Add sibling',
      menu_edit_text: 'Edit text',
      menu_change_color: 'Change color',
      menu_toggle_collapse: 'Fold/Expand',
      menu_copy: 'Copy node',
      menu_paste: 'Paste node',
      menu_duplicate: 'Duplicate',
      menu_delete: 'Delete node',
      kbd_child: 'child',
      kbd_sibling: 'sibling',
      kbd_delete: 'del',
      kbd_edit: 'edit',
      kbd_fold: 'fold',
      kbd_undo: 'undo',
      kbd_search: 'search',
      title_suffix: ' - jmind Editor',
      untitled: 'Untitled',
      default_node: 'Node',
      new_node: 'New node',
      duplicate_suffix: ' Copy',
      toast_save_success: 'Saved successfully',
      toast_save_empty: 'Nothing to save',
      toast_export_success: 'Export successful',
      toast_export_empty: 'Nothing to export',
      toast_png_success: 'PNG exported',
      toast_png_fail: 'Export failed',
      toast_root_no_sibling: 'Cannot add sibling to root',
      toast_root_no_delete: 'Cannot delete root',
      toast_undo: 'Undone',
      toast_no_undo: 'Nothing to undo',
      toast_redo: 'Redone',
      toast_no_redo: 'Nothing to redo',
      toast_copied: 'Node copied',
      toast_pick_target: 'Select a target node first',
      toast_pasted: 'Pasted',
      toast_clipboard_empty: 'Clipboard is empty',
      toast_root_no_duplicate: 'Cannot duplicate root',
      toast_cleared: 'Cleared, root kept',
      toast_pick_node: 'Select a node first',
      toast_pick_nonroot: 'Select a non-root node first',
      stats_nodes: 'Nodes: {total} ({visible} visible)',
      stats_zoom: 'Zoom: {scale}%',
      outline_empty: 'Nothing here yet',

      // ---------- Settings ----------
      settings_title: '⚙️ Settings',
      settings_doc_title: 'jmind - Settings',
      appearance: 'Appearance',
      appearance_desc: 'Choose light or dark interface, freely combinable with the accent color below',
      light: 'Light',
      dark: 'Dark',
      accent: 'Accent color',
      accent_desc: 'Choose the interface accent color',
      language: 'Language',
      language_desc: 'Choose the interface language, applied immediately',
      data_section: '📦 Data Management',
      data_desc: 'All data is stored locally in your browser (localStorage) and never uploaded to any server.',
      export_backup: '📤 Export Backup',
      clear_data: '🗑️ Clear All Data',
      done: 'Done',
      confirm_clear_all: 'Clear all data? This will delete every mind map and setting, and cannot be undone.',
      data_cleared: 'All data cleared',
      export_success: 'Backup exported',
      lang_zh: 'Language set to Chinese',
      lang_en: 'Language set to English',

      // ---------- Home ----------
      nav_new: 'New',
      nav_settings: 'Settings',
      index_title: 'jmind — Mind Maps',
      hero_title: 'Mind maps, ',
      hero_title_span: 'simple and powerful',
      hero_sub: 'Quickly capture your ideas with local saving, import/export, undo/redo, and node search — edit anywhere, anytime.',
      new_map: 'New Map',
      import_file: 'Import',
      f_visual: 'Visual Editing',
      f_visual_desc: 'Drag nodes, zoom canvas, smooth interaction',
      f_local: 'Local-first',
      f_local_desc: 'Data stored in your browser, private and safe',
      f_export: 'PNG Export',
      f_export_desc: 'Export high-resolution mind map images',
      f_shortcuts: 'Shortcuts',
      f_shortcuts_desc: 'Fast editing with Tab/Enter/Delete',
      recent: 'Recent',
      files_count: '{n} files',
      empty_text: 'No files yet — click "New Map" above to start',
      footer: 'jmind · Local-first mind mapping · Data stays in your browser',
      nodes_suffix: ' nodes',
      open: 'Open',
      delete: 'Delete',
      just_now: 'just now',
      minutes_ago: '{n} min ago',
      hours_ago: '{n} h ago',
      days_ago: '{n} d ago',
      invalid_file: 'Invalid file: missing root node',
      import_failed: 'Import failed',
      read_failed: 'Failed to read file',
      confirm_delete_file: 'Delete this file? This cannot be undone.'
    }
  };

  function getLang() {
    try {
      const lang = JmindStorage.getSettings().language;
      return lang === 'en' ? 'en' : 'zh';
    } catch (e) {
      return 'zh';
    }
  }

  /**
   * 翻译：t('key', { param: value })
   */
  function t(key, params) {
    const lang = getLang();
    let str = (DICT[lang] && DICT[lang][key]) || DICT.zh[key] || key;
    if (params) {
      Object.keys(params).forEach(p => {
        str = str.split('{' + p + '}').join(params[p]);
      });
    }
    return str;
  }

  /**
   * 应用翻译到当前页面：
   * [data-i18n] 替换文本
   * [data-i18n-title] 替换 title
   * [data-i18n-placeholder] 替换 placeholder
   */
  function apply() {
    const lang = getLang();
    document.documentElement.setAttribute('lang', lang === 'en' ? 'en' : 'zh-CN');

    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = t(el.dataset.i18nTitle);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });

    // 静态页面标题（编辑器标题由 updateTitle 动态控制，不受影响）
    const docTitleKey = document.body && document.body.getAttribute('data-i18n-doc-title');
    if (docTitleKey && !window.__jmindDynamicTitle) {
      document.title = t(docTitleKey);
    }
  }

  return { getLang, t, apply, DICT };
})();
