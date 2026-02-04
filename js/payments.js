import { dataService } from './services.js';
import { formatIDR } from './utils.js';

export const initPaymentForm = async () => {
    const form = document.getElementById('payment-form');
    const searchInput = document.getElementById('invoice-search-input');
    const dropdownList = document.getElementById('invoice-dropdown-list');
    const hiddenSelect = document.getElementById('select-invoice');
    const dropdownContainer = document.querySelector('.dropdown-container');
    const sisaInfo = document.getElementById('sisa-info');

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
                // Set visible value and hidden select value
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
        // Use a small timeout to allow the 'click' event on the item to fire
        setTimeout(() => {
            dropdownList.classList.remove('show');
            dropdownContainer.classList.remove('active');
        }, 200);
    };

    // Event Listeners
    searchInput.addEventListener('focus', openDropdown);
    searchInput.addEventListener('input', (e) => {
        openDropdown();
        renderDropdown(e.target.value);
    });

    // Toggle dropdown on arrow icon click (optional enhancement)
    const arrow = document.querySelector('.dropdown-icon');
    if (arrow) {
        arrow.style.pointerEvents = 'auto';
        arrow.style.cursor = 'pointer';
        arrow.addEventListener('click', (e) => {
            e.stopPropagation();
            if (dropdownList.classList.contains('show')) {
                closeDropdown();
            } else {
                openDropdown();
            }
        });
    }

    // Close dropdown when clicking outside
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
            keterangan_bank: document.getElementById('payment-note').value
        };

        if (!payload.no_faktur) {
            alert("Silakan pilih faktur yang valid dari daftar!");
            return;
        }

        try {
            await dataService.submitPayment(payload);
            alert("Pembayaran berhasil disimpan!");
            form.reset();
            hiddenSelect.value = '';
            sisaInfo.textContent = '';
            // Refresh data from source
            activeInvoices = await dataService.getActiveInvoices();
        } catch (error) {
            alert(`Gagal: ${error.message}`);
        }
    });
};
