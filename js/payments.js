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
    const loadInvoices = async () => {
        try {
            activeInvoices = await dataService.getActiveInvoices();
        } catch (error) {
            console.error("Payment init error:", error);
        }
    };
    loadInvoices();

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

    // Helper: Compress Image
    const compressImage = async (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800; // Resize to max 800px width
                    const scaleSize = MAX_WIDTH / img.width;
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scaleSize;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                    // Compress to JPEG with 0.6 quality
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                    resolve(dataUrl);
                };
            };
        });
    };

    // File selection logic
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        fileName = file.name;
        filePreview.innerHTML = `<span>⏳ Mengompres gambar...</span>`;

        try {
            base64Image = await compressImage(file);
            filePreview.innerHTML = `<img src="${base64Image}" alt="Preview">`;
            console.log("Image compressed. Size: ", (base64Image.length / 1024).toFixed(2), "KB");
        } catch (err) {
            console.error("Compression failed:", err);
            filePreview.innerHTML = `<span>❌ Gagal memproses gambar</span>`;
        }
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

        const btn = form.querySelector('button[type="submit"]');
        const originalBtnText = btn.innerHTML;

        try {
            btn.innerHTML = "Sedang Mengirim Data...";
            btn.disabled = true;

            const result = await dataService.submitPayment(payload);
            console.log("Upload Result:", result);

            alert("Pembayaran berhasil disimpan!" + (result.url && result.url !== "No Image" ? "\nFoto bukti berhasil diunggah." : ""));
            resetForm();

            // Refresh local data
            await loadInvoices();

        } catch (error) {
            console.error("Submit error:", error);
            alert(`Gagal: ${error.message}`);
        } finally {
            btn.innerHTML = originalBtnText;
            btn.disabled = false;
            if (window.lucide) lucide.createIcons();
        }
    });
};
