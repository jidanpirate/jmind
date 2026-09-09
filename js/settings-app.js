/**
 * jmind - 设置页应用逻辑
 * 外观模式、主题色、语言、数据管理
 */
(function () {
    'use strict';

    const L = (key) => (typeof JmindI18n !== 'undefined' ? JmindI18n.t(key) : key);

    // ---------- Toast ----------
    let toastTimer = null;
    function showToast(msg, type) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = msg;
        toast.className = 'toast show' + (type ? ' ' + type : '');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { toast.className = 'toast'; }, 2200);
    }

    // ---------- 外观模式 ----------
    const currentMode = JmindStorage.getSettings().mode || 'light';
    document.querySelectorAll('.mode-option').forEach(opt => {
        if (opt.dataset.mode === currentMode) opt.classList.add('active');
        opt.addEventListener('click', () => {
            document.querySelectorAll('.mode-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            document.documentElement.setAttribute('data-mode', opt.dataset.mode);
        });
    });

    // ---------- 主题色 ----------
    const currentAccent = JmindStorage.getSettings().accent || 'blue';
    document.querySelectorAll('.accent-swatch').forEach(sw => {
        if (sw.dataset.accent === currentAccent) sw.classList.add('active');
        sw.addEventListener('click', () => {
            document.querySelectorAll('.accent-swatch').forEach(s => s.classList.remove('active'));
            sw.classList.add('active');
            document.documentElement.setAttribute('data-accent', sw.dataset.accent);
        });
    });

    // ---------- 语言 ----------
    const currentLang = JmindStorage.getSettings().lang || 'zh';
    document.querySelectorAll('.language-option').forEach(opt => {
        if (opt.dataset.lang === currentLang) opt.classList.add('active');
        opt.addEventListener('click', () => {
            document.querySelectorAll('.language-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            if (typeof JmindI18n !== 'undefined') {
                JmindI18n.setLang(opt.dataset.lang);
                JmindI18n.apply(document);
            }
        });
    });

    // ---------- 导出备份 ----------
    document.getElementById('btn-export-data').addEventListener('click', () => {
        const data = JmindStorage.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `jmind-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast(L('export_success'), 'success');
    });

    // ---------- 清除所有数据 ----------
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

    // ---------- 完成（保存设置） ----------
    document.getElementById('btn-save').addEventListener('click', () => {
        const mode = document.querySelector('.mode-option.active')?.dataset.mode || 'light';
        const accent = document.querySelector('.accent-swatch.active')?.dataset.accent || 'blue';
        const lang = document.querySelector('.language-option.active')?.dataset.lang || 'zh';
        JmindStorage.saveSettings({ mode, accent, lang });
        showToast(L('settings_saved'), 'success');
        setTimeout(() => { window.location.href = 'index.html'; }, 600);
    });

    // ---------- 版本号 ----------
    document.getElementById('app-version').textContent = 'v1.4.0';

    // ---------- 初始化 ----------
    if (typeof JmindI18n !== 'undefined') {
        JmindI18n.apply(document);
    }
})();
