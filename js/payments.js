import { dataService } from './services.js';
import { formatIDR } from './utils.js';

export const initPaymentForm = async () => {
    const form = document.getElementById('payment-form');
    const searchInput = document.getElementById('invoice-search-input');
    const dropdownList = document.getElementById('invoice-dropdown-list');
    const hiddenSelect = document.getElementById('select-invoice');
    const dropdownContainer = document.querySelector('.dropdown-container');
    const sisaInfo = document.getElementById('sisa-info');

    // Image handling elements
    const fileInput = document.getElementById('payment-file');
    const filePreview = document.getElementById('file-preview');
    let base64Image = "";
    let fileName = "";

    let activeInvoices = [];

    // Load active invoices from Google Sheets
    try {
        activeInvoices = await dataService.getActiveInvoices();
    } catch (error) {
        console.error("Payment init error:", error);
    }

    const renderDropdown = (filter = "") => {
        const query = filter.toLowerCase();
        const filtered = activeInvoices.filter(inv =>
            inv.no_faktur.toLowerCase().includes(query) ||
            inv.nama_outlet.toLowerCase().includes(query)
        );

        dropdownList.innerHTML = '';

        if (filtered.length === 0) {
            dropdownList.innerHTML = '<div class="dropdown-item text-muted">Tidak ada hasil</div>';
            return;
        }

        filtered.forEach(inv => {
            const div = document.createElement('div');
            div.className = 'dropdown-item';
            div.innerHTML = `
                <span class="item-faktur">${inv.no_faktur}</span>
                <span class="item-outlet">${inv.nama_outlet}</span>
                <span class="item-sisa">Sisa: ${formatIDR(inv.sisa)}</span>
            `;

            div.addEventListener('click', () => {
                searchInput.value = `${inv.no_faktur}`;
                hiddenSelect.value = inv.no_faktur;
                sisaInfo.textContent = `Sisa Tagihan: ${formatIDR(inv.sisa)} (Outlet: ${inv.nama_outlet})`;
                closeDropdown();
            });

            dropdownList.appendChild(div);
        });
    };

    const openDropdown = () => {
        dropdownList.classList.add('show');
        dropdownContainer.classList.add('active');
        renderDropdown(searchInput.value);
    };

    const closeDropdown = () => {
        setTimeout(() => {
            dropdownList.classList.remove('show');
            dropdownContainer.classList.remove('active');
        }, 200);
    };

    // File selection logic
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        fileName = file.name;
        const reader = new FileReader();
        reader.onload = (event) => {
            base64Image = event.target.result;
            filePreview.innerHTML = `<img src="${base64Image}" alt="Preview">`;
        };
        reader.readAsDataURL(file);
    });

    const resetForm = () => {
        form.reset();
        hiddenSelect.value = '';
        base64Image = '';
        fileName = '';
        sisaInfo.textContent = '';
        filePreview.innerHTML = `<i data-lucide="image"></i><span>Pilih Foto Bukti</span>`;
        if (window.lucide) lucide.createIcons();
    };

    // Event Listeners
    searchInput.addEventListener('focus', openDropdown);
    searchInput.addEventListener('input', (e) => {
        openDropdown();
        renderDropdown(e.target.value);
    });

    document.addEventListener('click', (e) => {
        if (!dropdownContainer.contains(e.target)) {
            closeDropdown();
        }
    });

    // Form Submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            no_faktur: hiddenSelect.value,
            tanggal_bayar: document.getElementById('payment-date').value,
            tipe: document.getElementById('payment-type').value,
            nominal_bayar: parseFloat(document.getElementById('payment-amount').value),
            keterangan_bank: document.getElementById('payment-note').value,
            image_base64: base64Image,
            image_name: fileName
        };

        if (!payload.no_faktur) {
            alert("Silakan pilih faktur yang valid dari daftar!");
            return;
        }

        try {
            const btn = form.querySelector('button[type="submit"]');
            const originalBtnText = btn.innerHTML;
            btn.innerHTML = "Sedang Menyimpan...";
            btn.disabled = true;

            await dataService.submitPayment(payload);

            alert("Pembayaran dan bukti foto berhasil disimpan!");
            resetForm();

            // Refresh local data
            activeInvoices = await dataService.getActiveInvoices();

            btn.innerHTML = originalBtnText;
            btn.disabled = false;
        } catch (error) {
            alert(`Gagal: ${error.message}`);
            form.querySelector('button[type="submit"]').disabled = false;
            form.querySelector('button[type="submit"]').innerHTML = '<i data-lucide="save"></i> Simpan Pembayaran';
            if (window.lucide) lucide.createIcons();
        }
    });
};
