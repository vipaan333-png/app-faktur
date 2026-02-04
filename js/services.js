import CONFIG from './config.js';

export const dataService = {
    async fetchGAS(action, options = {}) {
        const url = new URL(CONFIG.GAS_URL);
        url.searchParams.append('action', action);

        const response = await fetch(url.toString(), options);
        if (!response.ok) throw new Error("Gagal menghubungi Google Sheets");
        return await response.json();
    },

    async getInvoices() {
        return await this.fetchGAS('getSummary');
    },

    async getDashboardStats() {
        return await this.fetchGAS('getStats');
    },

    async getTrendData() {
        return await this.fetchGAS('getTrend');
    },

    async submitPayment(payment) {
        // Validation check
        const summary = await this.getInvoices();
        const invoice = summary.find(i => i.no_faktur == payment.no_faktur);

        if (!invoice) throw new Error("Faktur tidak ditemukan");
        if (parseFloat(payment.nominal_bayar) > parseFloat(invoice.sisa)) {
            throw new Error(`Nominal melebihi sisa (Sisa: ${invoice.sisa})`);
        }

        const response = await fetch(CONFIG.GAS_URL, {
            method: 'POST',
            body: JSON.stringify(payment)
        });

        const result = await response.json();
        if (result.error) throw new Error(result.error);
        return result;
    },

    async getActiveInvoices() {
        const all = await this.getInvoices();
        return all.filter(i => i.sisa > 0);
    }
};

export default dataService;
