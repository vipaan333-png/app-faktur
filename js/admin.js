import { dataService } from './services.js';
import { formatIDR } from './utils.js';

const ADMIN_USERNAME = 'SPV';
const ADMIN_PASSWORD = 'spv333vip';

let adminPageBound = false;
let adminAuthenticated = false;
let adminInvoices = [];
const selectedInvoiceNos = new Set();
const rowDrafts = {};

const formatDateInput = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const parseInputAmount = (value) => {
    if (value === null || value === undefined) return 0;
    const text = String(value).replace(/[^\d]/g, '');
    if (!text) return 0;
    return Number(text);
};

export const initAdminPage = async () => {
    const loginCard = document.getElementById('admin-login-card');
    const loginForm = document.getElementById('admin-login-form');
    const panel = document.getElementById('admin-panel');
    const dateInput = document.getElementById('admin-date');
    const collectorInput = document.getElementById('admin-collector');
    const searchInput = document.getElementById('admin-invoice-search');
    const optionsList = document.getElementById('admin-invoice-options');
    const selectedBody = document.getElementById('admin-selected-body');
    const refreshBtn = document.getElementById('admin-refresh');
    const exportBtn = document.getElementById('admin-export-btn');

    const refreshInvoices = async () => {
        try {
            adminInvoices = await dataService.getActiveInvoices();
            const activeNos = new Set(adminInvoices.map((inv) => String(inv.no_faktur || '').trim()));
            Array.from(selectedInvoiceNos).forEach((noFaktur) => {
                if (!activeNos.has(noFaktur)) {
                    selectedInvoiceNos.delete(noFaktur);
                    delete rowDrafts[noFaktur];
                }
            });
            renderOptions(searchInput.value || '');
            renderSelectedRows();
        } catch (error) {
            console.error('Admin invoice load error:', error);
            alert(`Gagal memuat data faktur: ${error.message}`);
        }
    };

    const updateAuthView = () => {
        loginCard.classList.toggle('hidden', adminAuthenticated);
        panel.classList.toggle('hidden', !adminAuthenticated);
    };

    const renderOptions = (query = '') => {
        const keyword = query.toLowerCase();
        const filtered = adminInvoices.filter((inv) =>
            String(inv.no_faktur || '').toLowerCase().includes(keyword) ||
            String(inv.nama_outlet || '').toLowerCase().includes(keyword)
        );

        optionsList.innerHTML = '';
        if (filtered.length === 0) {
            optionsList.innerHTML = '<div class="admin-option-empty">Tidak ada faktur aktif</div>';
            return;
        }

        filtered.forEach((inv) => {
            const noFaktur = String(inv.no_faktur || '').trim();
            const wrapper = document.createElement('label');
            wrapper.className = 'admin-option-item';
            wrapper.innerHTML = `
                <input type="checkbox" class="admin-option-check" data-no-faktur="${noFaktur}">
                <div class="admin-option-meta">
                    <strong>${String(inv.no_faktur || '-')}</strong>
                    <span>${String(inv.nama_outlet || '-')}</span>
                    <small>Sisa: ${formatIDR(inv.sisa)}</small>
                </div>
            `;

            const check = wrapper.querySelector('.admin-option-check');
            check.checked = selectedInvoiceNos.has(noFaktur);
            check.addEventListener('change', (e) => {
                if (e.target.checked) {
                    selectedInvoiceNos.add(noFaktur);
                    if (!rowDrafts[noFaktur]) {
                        rowDrafts[noFaktur] = { tunai: '', transfer: '', keterangan: '' };
                    }
                } else {
                    selectedInvoiceNos.delete(noFaktur);
                    delete rowDrafts[noFaktur];
                }
                renderSelectedRows();
            });

            optionsList.appendChild(wrapper);
        });
    };

    const renderSelectedRows = () => {
        selectedBody.innerHTML = '';
        if (selectedInvoiceNos.size === 0) {
            selectedBody.innerHTML = '<tr><td colspan="6" class="admin-empty-row">Belum ada faktur dipilih</td></tr>';
            return;
        }

        Array.from(selectedInvoiceNos).forEach((noFaktur) => {
            const inv = adminInvoices.find((item) => String(item.no_faktur || '').trim() === noFaktur);
            if (!inv) return;

            if (!rowDrafts[noFaktur]) {
                rowDrafts[noFaktur] = { tunai: '', transfer: '', keterangan: '' };
            }
            const draft = rowDrafts[noFaktur];

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${inv.no_faktur}</strong></td>
                <td>${inv.nama_outlet}</td>
                <td>${formatIDR(inv.sisa)}</td>
                <td><input type="number" min="0" class="admin-cell-input" data-field="tunai" data-no-faktur="${inv.no_faktur}" value="${draft.tunai}"></td>
                <td><input type="number" min="0" class="admin-cell-input" data-field="transfer" data-no-faktur="${inv.no_faktur}" value="${draft.transfer}"></td>
                <td><input type="text" class="admin-cell-input" data-field="keterangan" data-no-faktur="${inv.no_faktur}" value="${draft.keterangan}"></td>
            `;
            selectedBody.appendChild(tr);
        });
    };

    if (!dateInput.value) {
        dateInput.value = formatDateInput(new Date());
    }

    updateAuthView();
    if (adminAuthenticated) {
        await refreshInvoices();
    }

    if (adminPageBound) {
        return;
    }
    adminPageBound = true;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('admin-username').value.trim();
        const password = document.getElementById('admin-password').value;

        if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
            alert('Username atau password admin salah.');
            return;
        }

        adminAuthenticated = true;
        updateAuthView();
        await refreshInvoices();
        if (window.lucide) lucide.createIcons();
    });

    searchInput.addEventListener('input', (e) => {
        renderOptions(e.target.value);
    });

    selectedBody.addEventListener('input', (e) => {
        const target = e.target;
        if (!target.classList.contains('admin-cell-input')) return;

        const noFaktur = target.getAttribute('data-no-faktur');
        const field = target.getAttribute('data-field');
        if (!rowDrafts[noFaktur]) {
            rowDrafts[noFaktur] = { tunai: '', transfer: '', keterangan: '' };
        }
        rowDrafts[noFaktur][field] = target.value;
    });

    refreshBtn.addEventListener('click', async () => {
        await refreshInvoices();
    });

    exportBtn.addEventListener('click', async () => {
        if (!adminAuthenticated) {
            alert('Silakan login admin terlebih dahulu.');
            return;
        }

        const tanggal = dateInput.value;
        const namaKolektor = collectorInput.value.trim();
        if (!tanggal) {
            alert('Tanggal wajib diisi.');
            return;
        }
        if (!namaKolektor) {
            alert('Nama kolektor wajib diisi.');
            return;
        }
        if (selectedInvoiceNos.size === 0) {
            alert('Pilih minimal satu faktur.');
            return;
        }

        const items = Array.from(selectedInvoiceNos).map((noFaktur) => {
            const inv = adminInvoices.find((item) => String(item.no_faktur || '').trim() === noFaktur);
            const draft = rowDrafts[noFaktur] || {};
            return {
                no_faktur: noFaktur,
                nama_outlet: inv ? inv.nama_outlet : '',
                sisa_piutang: inv ? Number(inv.sisa || 0) : 0,
                tunai: parseInputAmount(draft.tunai),
                transfer: parseInputAmount(draft.transfer),
                keterangan: String(draft.keterangan || '').trim()
            };
        });

        try {
            const result = await dataService.saveTagihanBatch({
                tanggal,
                nama_kolektor: namaKolektor,
                items
            });

            alert(`Export berhasil. ${result.saved_rows || 0} baris masuk ke sheet tagihan.`);
            selectedInvoiceNos.clear();
            Object.keys(rowDrafts).forEach((k) => delete rowDrafts[k]);
            renderSelectedRows();
            renderOptions(searchInput.value || '');
        } catch (error) {
            console.error('Export tagihan error:', error);
            alert(`Export gagal: ${error.message}`);
        }
    });
};
