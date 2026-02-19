import { initDashboard } from './dashboard.js';
import { initInvoiceList } from './invoices.js';
import { initPaymentForm } from './payments.js';
import { initAdminPage } from './admin.js';

const SESSION_KEY = 'app_faktur_logged_user';
const USER_CREDENTIALS = {
    IRWAN: 'irwan123',
    ARHAM: 'sbkhs1',
    ADMIN: 'admvip3',
    NURDIN: 'klqaq9',
    RUSLAN: 'newqa5',
    SAPRI: 'ukrnd0',
    SHERLY: 'kijii2'
};

document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('global-login-overlay');
    const loginForm = document.getElementById('global-login-form');
    const usernameInput = document.getElementById('global-username');
    const passwordInput = document.getElementById('global-password');
    const loginError = document.getElementById('global-login-error');
    const sidebar = document.getElementById('main-sidebar');
    const app = document.getElementById('app');
    const sessionUserLabel = document.getElementById('session-user-label');
    const logoutBtn = document.getElementById('btn-logout');

    let appBootstrapped = false;

    // Navigation Logic
    const navLinks = document.querySelectorAll('.nav-links li');
    const sections = document.querySelectorAll('.page-section');

    const loadPage = (page) => {
        if (page === 'dashboard') initDashboard();
        if (page === 'list') initInvoiceList();
        if (page === 'payment') initPaymentForm();
        if (page === 'admin') initAdminPage();
    };

    const bootstrapApp = () => {
        if (appBootstrapped) return;
        appBootstrapped = true;

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
    };

    const showAppForUser = (username) => {
        sessionStorage.setItem(SESSION_KEY, username);
        sessionUserLabel.textContent = `User: ${username}`;
        overlay.classList.add('hidden');
        sidebar.classList.remove('hidden');
        app.classList.remove('hidden');
        loginError.classList.add('hidden');

        bootstrapApp();
        if (window.lucide) {
            lucide.createIcons();
        }
    };

    const logout = () => {
        sessionStorage.removeItem(SESSION_KEY);
        overlay.classList.remove('hidden');
        sidebar.classList.add('hidden');
        app.classList.add('hidden');
        usernameInput.value = '';
        passwordInput.value = '';
        usernameInput.focus();
    };

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const username = usernameInput.value.trim().toUpperCase();
        const password = passwordInput.value;

        if (USER_CREDENTIALS[username] && USER_CREDENTIALS[username] === password) {
            showAppForUser(username);
            passwordInput.value = '';
            return;
        }

        loginError.classList.remove('hidden');
    });

    usernameInput.addEventListener('input', () => loginError.classList.add('hidden'));
    passwordInput.addEventListener('input', () => loginError.classList.add('hidden'));

    logoutBtn.addEventListener('click', logout);

    const loggedUser = sessionStorage.getItem(SESSION_KEY);
    if (loggedUser && USER_CREDENTIALS[loggedUser]) {
        showAppForUser(loggedUser);
    } else {
        overlay.classList.remove('hidden');
        sidebar.classList.add('hidden');
        app.classList.add('hidden');
        usernameInput.focus();
        if (window.lucide) {
            lucide.createIcons();
        }
    }
});
