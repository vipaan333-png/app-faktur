import { dataService } from './services.js';
import { formatIDR } from './utils.js';

export const initInvoiceList = async () => {
    const tbody = document.getElementById('invoice-list-body');
    const searchInput = document.getElementById('invoice-search');

    let allInvoices = [];

    const renderTable = (data) => {
        tbody.innerHTML = '';
        data.forEach(inv => {
            const tr = document.createElement('tr');

            // Conditional Formatting for Lunas
            if (parseFloat(inv.sisa) === 0) {
                tr.classList.add('status-lunas');
            }

            tr.innerHTML = `
                <td>${inv.tanggal}</td>
                <td><strong>${inv.no_faktur}</strong></td>
                <td>${inv.nama_outlet}</td>
                <td>${formatIDR(inv.total_nilai)}</td>
                <td>${formatIDR(inv.terbayar)}</td>
                <td class="${inv.sisa > 0 ? 'text-danger' : ''}">${formatIDR(inv.sisa)}</td>
            `;
            tbody.appendChild(tr);
        });
    };

    try {
        allInvoices = await dataService.getInvoices();
        renderTable(allInvoices);
    } catch (error) {
        console.error("List load error:", error);
    }

    // Search Logic
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = allInvoices.filter(inv =>
            inv.no_faktur.toLowerCase().includes(query) ||
            inv.nama_outlet.toLowerCase().includes(query)
        );
        renderTable(filtered);
    });
};
