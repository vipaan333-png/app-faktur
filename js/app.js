import { initDashboard } from './dashboard.js';
import { initInvoiceList } from './invoices.js';
import { initPaymentForm } from './payments.js';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide Icons
    if (window.lucide) {
        lucide.createIcons();
    }

    // Navigation Logic
    const navLinks = document.querySelectorAll('.nav-links li');
    const sections = document.querySelectorAll('.page-section');

    const loadPage = (page) => {
        if (page === 'dashboard') initDashboard();
        if (page === 'list') initInvoiceList();
        if (page === 'payment') initPaymentForm();
    };

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            const page = link.getAttribute('data-page');

            // UI Update
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Page Switch
            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(`page-${page}`).classList.add('active');

            // Load Page Logic
            loadPage(page);

            // Re-render icons if needed
            if (window.lucide) lucide.createIcons();

            // Header/Scroll Reset
            window.scrollTo(0, 0);
        });
    });

    // Initial Load - Dashboard
    initDashboard();
});
