/**
 * jmind - 首页应用逻辑
 * 最近文件列表、新建、导入、删除
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

    // ---------- 新建导图 ----------
    document.getElementById('btn-new').addEventListener('click', () => {
        const id = JmindStorage.createFileId();
        JmindStorage.setEditId(id);
        window.location.href = 'editor.html';
    });

    // ---------- 导入文件 ----------
    const fileInput = document.getElementById('file-input');
    document.getElementById('btn-import').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) importFile(file);
        fileInput.value = '';
    });

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

    // ---------- 最近文件列表 ----------
    function loadRecentFiles() {
        const list = document.getElementById('file-list');
        const countEl = document.getElementById('file-count');
        const files = JmindStorage.getRecentFiles();

        countEl.textContent = files.length + ' ' + L('files');

        if (files.length === 0) {
            list.innerHTML = `<div class="empty">${L('no_files')}</div>`;
            return;
        }

        list.innerHTML = files.map(f => {
            const name = f.name || L('untitled');
            const time = f.updatedAt ? new Date(f.updatedAt).toLocaleString() : '';
            return `
                <div class="file-card" data-id="${f.id}">
                    <div class="file-info">
                        <div class="file-name">${escapeHtml(name)}</div>
                        <div class="file-time">${time}</div>
                    </div>
                    <div class="file-actions">
                        <button class="file-btn file-btn-open" data-id="${f.id}" data-i18n="open">打开</button>
                        <button class="file-btn file-btn-delete" data-id="${f.id}" data-i18n="delete">删除</button>
                    </div>
                </div>
            `;
        }).join('');

        // 绑定事件
        list.querySelectorAll('.file-btn-open').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                JmindStorage.setEditId(id);
                window.location.href = 'editor.html';
            });
        });

        list.querySelectorAll('.file-btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteFile(btn.dataset.id);
            });
        });

        // 点击卡片打开
        list.querySelectorAll('.file-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.id;
                JmindStorage.setEditId(id);
                window.location.href = 'editor.html';
            });
        });
    }

    function deleteFile(id) {
        const files = JmindStorage.getRecentFiles();
        const file = files.find(f => f.id === id);
        const name = file?.name || L('untitled');
        JmindDialog.confirm({
            title: L('delete'),
            message: L('confirm_delete_file') + (name ? `\n「${name}」` : ''),
            confirmText: L('delete'),
            type: 'danger',
            icon: '🗑️',
            onConfirm: () => {
                JmindStorage.deleteFile(id);
                loadRecentFiles();
            }
        });
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ---------- 初始化 ----------
    if (typeof JmindI18n !== 'undefined') {
        JmindI18n.apply(document);
    }
    loadRecentFiles();
})();
