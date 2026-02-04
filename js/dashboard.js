import { dataService } from './services.js';
import { formatIDR } from './utils.js';

export const initDashboard = async () => {
    try {
        const stats = await dataService.getDashboardStats();

        document.getElementById('stat-total-piutang').textContent = formatIDR(stats.totalPiutang);
        document.getElementById('stat-tunai-today').textContent = formatIDR(stats.tunaiToday);
        document.getElementById('stat-transfer-today').textContent = formatIDR(stats.transferToday);

        // Trend Chart
        const trendData = await dataService.getTrendData();
        renderTrendChart(trendData);

    } catch (error) {
        console.error("Dashboard init error:", error);
    }
};

let myChart = null;
const renderTrendChart = (data) => {
    const ctx = document.getElementById('trendChart').getContext('2d');

    // Default labels if no data
    const labels = data.length > 0 ? data.map(d => d.date) : ['No Data'];
    const values = data.length > 0 ? data.map(d => d.amount) : [0];

    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Penagihan 7 Hari Terakhir',
                data: values,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });
};
