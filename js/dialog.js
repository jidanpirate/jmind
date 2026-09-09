/**
 * jmind - Dialog Module
 * 自定义模态弹窗：替代浏览器原生 confirm/alert
 * 依赖 JmindI18n（可选，用于按钮文本翻译）
 */
const JmindDialog = (function () {
    'use strict';

    let overlay = null;
    let box = null;

    function tr(key, fallback) {
        try {
            if (typeof JmindI18n !== 'undefined' && JmindI18n.t) {
                const v = JmindI18n.t(key);
                if (v && v !== key) return v;
            }
        } catch (e) {}
        return fallback;
    }

    function ensureElements() {
        if (overlay) return;
        overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';
        box = document.createElement('div');
        box.className = 'dialog-box';
        overlay.appendChild(box);
        document.body.appendChild(overlay);
    }

    function show(options) {
        ensureElements();
        const opts = Object.assign({
            title: '',
            message: '',
            confirmText: tr('confirm', '确定'),
            cancelText: tr('cancel', '取消'),
            showCancel: true,
            type: 'info',
            icon: '',
            onConfirm: null,
            onCancel: null
        }, options || {});

        const iconHtml = opts.icon
            ? `<div class="dialog-icon dialog-icon-${opts.type}">${opts.icon}</div>`
            : '';

        box.innerHTML = `
            ${iconHtml}
            ${opts.title ? `<div class="dialog-title">${opts.title}</div>` : ''}
            <div class="dialog-message">${opts.message.replace(/\n/g, '<br>')}</div>
            <div class="dialog-actions">
                ${opts.showCancel ? `<button class="dialog-btn dialog-btn-cancel" type="button">${opts.cancelText}</button>` : ''}
                <button class="dialog-btn dialog-btn-confirm" type="button">${opts.confirmText}</button>
            </div>
        `;

        const confirmBtn = box.querySelector('.dialog-btn-confirm');
        const cancelBtn = box.querySelector('.dialog-btn-cancel');

        let closed = false;
        function close() {
            if (closed) return;
            closed = true;
            overlay.classList.remove('show');
            cleanup();
        }
        function cleanup() {
            confirmBtn.removeEventListener('click', handleConfirm);
            if (cancelBtn) cancelBtn.removeEventListener('click', handleCancel);
            overlay.removeEventListener('click', handleOverlayClick);
            document.removeEventListener('keydown', handleKeydown);
        }
        function handleConfirm() {
            close();
            if (opts.onConfirm) opts.onConfirm();
        }
        function handleCancel() {
            close();
            if (opts.onCancel) opts.onCancel();
        }
        function handleOverlayClick(e) {
            if (e.target === overlay) handleCancel();
        }
        function handleKeydown(e) {
            if (e.key === 'Escape') { e.preventDefault(); handleCancel(); }
            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'INPUT') {
                e.preventDefault(); handleConfirm();
            }
        }

        confirmBtn.addEventListener('click', handleConfirm);
        if (cancelBtn) cancelBtn.addEventListener('click', handleCancel);
        overlay.addEventListener('click', handleOverlayClick);
        document.addEventListener('keydown', handleKeydown);

        requestAnimationFrame(() => {
            overlay.classList.add('show');
            confirmBtn.focus();
        });
    }

    function confirm(options) {
        show(Object.assign({ showCancel: true, type: 'warning' }, options));
    }

    function alert(options) {
        show(Object.assign({ showCancel: false, type: 'info' }, options));
    }

    return { confirm, alert, show };
})();
