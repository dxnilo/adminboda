// ═══════════════════════════════════════════════════════
//  Admin Panel — Supabase Integration
//  Jean & Ana Wedding · 2026
// ═══════════════════════════════════════════════════════

const SUPABASE_URL = 'https://qimqrpczkkukncfxmthu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbXFycGN6a2t1a25jZnhtdGh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxMjA3MjUsImV4cCI6MjEwNTY5NjcyNX0.5k7bjR65hyLgmgO_MySDGkv0j6L9M-Wm_3Uii1LADk8';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── DOM refs ──
const loginScreen = document.getElementById('login-screen');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const userEmailEl = document.getElementById('user-email');
const tbody = document.getElementById('guests-tbody');
const searchInput = document.getElementById('search-input');
const filterStatus = document.getElementById('filter-status');
const filterGroup = document.getElementById('filter-group');
const noResults = document.getElementById('no-results');

let allGuests = [];

// ═══════════════════════════════════════════════════════
//  FIXED CREDENTIALS AUTHENTICATION
//  User: jean carlos
//  Pass: jeananaforever
// ═══════════════════════════════════════════════════════

const VALID_USER = 'jean carlos';
const VALID_PASS = 'jeananaforever';

// Login submit
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    loginError.textContent = '';
    const username = document.getElementById('login-username').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value.trim();

    if (username === VALID_USER && password === VALID_PASS) {
        sessionStorage.setItem('admin_auth', 'true');
        showDashboard('jean carlos');
    } else {
        loginError.textContent = 'Usuario o contraseña incorrectos.';
    }
});

// Logout
document.getElementById('btn-logout').addEventListener('click', () => {
    sessionStorage.removeItem('admin_auth');
    loginScreen.classList.remove('hidden');
    dashboard.classList.add('hidden');
});

// Session check on load
(function checkSession() {
    if (sessionStorage.getItem('admin_auth') === 'true') {
        showDashboard('jean carlos');
    }
})();

// ═══════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════

async function showDashboard(username) {
    loginScreen.classList.add('hidden');
    dashboard.classList.remove('hidden');
    userEmailEl.textContent = 'Jean Carlos';
    await loadGuests();
}

async function loadGuests() {
    const { data, error } = await sb.from('guests').select('*').order('codigo', { ascending: true });
    if (error) {
        console.error('Error loading guests:', error);
        return;
    }
    allGuests = data || [];
    updateStats();
    renderTable();
}

// ── Stats ──
function updateStats() {
    const total = allGuests.length;
    const confirmed = allGuests.filter(g => g.estado === 'Confirmado').length;
    const declined = allGuests.filter(g => g.estado === 'Declinado').length;
    const pending = allGuests.filter(g => g.estado === 'Pendiente').length;

    animateNumber('stat-total', total);
    animateNumber('stat-confirmed', confirmed);
    animateNumber('stat-declined', declined);
    animateNumber('stat-pending', pending);
}

function animateNumber(id, target) {
    const el = document.getElementById(id);
    const current = parseInt(el.textContent) || 0;
    if (current === target) return;

    const duration = 600;
    const start = performance.now();

    function step(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
        el.textContent = Math.round(current + (target - current) * eased);
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// ── Table rendering ──
function renderTable() {
    const search = searchInput.value.toLowerCase();
    const statusFilter = filterStatus.value;
    const groupFilter = filterGroup.value;

    const filtered = allGuests.filter(g => {
        const matchesSearch = !search ||
            g.nombre.toLowerCase().includes(search) ||
            g.codigo.toLowerCase().includes(search);
        const matchesStatus = statusFilter === 'all' || g.estado === statusFilter;
        const matchesGroup = groupFilter === 'all' || g.grupo === groupFilter;
        return matchesSearch && matchesStatus && matchesGroup;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        noResults.classList.remove('hidden');
        return;
    }

    noResults.classList.add('hidden');

    tbody.innerHTML = filtered.map(g => {
        const statusClass = g.estado === 'Confirmado' ? 'badge-confirmed'
            : g.estado === 'Declinado' ? 'badge-declined'
                : 'badge-pending';

        const typeLabel = g.es_acompanante
            ? `<span class="type-companion">↳ de ${g.acompanante_de}</span>`
            : `<span class="type-primary">Principal</span>`;

        const confirmDate = g.confirmado_en
            ? new Date(g.confirmado_en).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '—';

        return `<tr>
            <td><code>${g.codigo}</code></td>
            <td>${g.nombre}</td>
            <td>${g.grupo || '—'}</td>
            <td>${g.es_acompanante ? '—' : g.cupos}</td>
            <td>${typeLabel}</td>
            <td><span class="badge ${statusClass}">${g.estado}</span></td>
            <td>${g.restricciones || '—'}</td>
            <td>${confirmDate}</td>
        </tr>`;
    }).join('');
}

// ── Filters ──
searchInput.addEventListener('input', renderTable);
filterStatus.addEventListener('change', renderTable);
filterGroup.addEventListener('change', renderTable);
