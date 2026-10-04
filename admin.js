// ═══════════════════════════════════════════════════════
//  Admin Panel — Supabase Integration + Guest Management
//  Jean & Ana Wedding · 2026
// ═══════════════════════════════════════════════════════

const SUPABASE_URL = 'https://qimqrpczkkukncfxmthu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbXFycGN6a2t1a25jZnhtdGh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxMjA3MjUsImV4cCI6MjEwNTY5NjcyNX0.5k7bjR65hyLgmgO_MySDGkv0j6L9M-Wm_3Uii1LADk8';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbXFycGN6a2t1a25jZnhtdGh1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDEyMDcyNSwiZXhwIjoyMTA1Njk2NzI1fQ.lJRWzxUjF1s20aAlu4hpuGcsBIlNzO1lMSXnUbmnVYs';

const { createClient } = supabase;
// Read client (anon key)
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// Write client (service_role key) — bypasses RLS for insert/update/delete
const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

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
let deleteTargetCode = null;

// ═══════════════════════════════════════════════════════
//  FIXED CREDENTIALS AUTHENTICATION
// ═══════════════════════════════════════════════════════

const VALID_USER = 'jean carlos';
const VALID_PASS = 'jeananaforever';

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

document.getElementById('btn-logout').addEventListener('click', () => {
    sessionStorage.removeItem('admin_auth');
    loginScreen.classList.remove('hidden');
    dashboard.classList.add('hidden');
});

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
    const { data, error } = await sbAdmin.from('guests').select('*').order('codigo', { ascending: true });
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
        const eased = 1 - Math.pow(1 - progress, 3);
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

        const linkCol = g.es_acompanante
            ? `<span class="companion-no-link">↳ Incluido en pase</span>`
            : `<button class="btn-copy-link" onclick="copyGuestLink('${g.codigo}', this)">📋 Copiar Link</button>`;

        // Action buttons
        const addCompanionBtn = !g.es_acompanante
            ? `<button class="btn-action btn-action-add" onclick="openAddCompanionModal('${g.codigo}', '${g.nombre.replace(/'/g, "\\'")}')" title="Agregar acompañante">👥+</button>`
            : '';

        const editBtn = `<button class="btn-action btn-action-edit" onclick="openEditGuestModal('${g.codigo}')" title="Editar">✏️</button>`;
        const deleteBtn = `<button class="btn-action btn-action-delete" onclick="openDeleteModal('${g.codigo}')" title="Eliminar">🗑️</button>`;

        return `<tr>
            <td><code>${g.codigo}</code></td>
            <td>${g.nombre}</td>
            <td>${g.grupo || '—'}</td>
            <td>${g.es_acompanante ? '—' : g.cupos}</td>
            <td>${typeLabel}</td>
            <td><span class="badge ${statusClass}">${g.estado}</span></td>
            <td>${g.restricciones || '—'}</td>
            <td>${confirmDate}</td>
            <td>${linkCol}</td>
            <td class="actions-cell">${addCompanionBtn}${editBtn}${deleteBtn}</td>
        </tr>`;
    }).join('');
}

// ── Domain config — update this when custom domain is active ──
const WEDDING_DOMAIN = 'https://jeani-boda.sbs';

// Copy link
window.copyGuestLink = async function (codigo, btnElement) {
    const url = `${WEDDING_DOMAIN}/?codigo=${codigo}`;
    try {
        await navigator.clipboard.writeText(url);
        if (btnElement) {
            const originalText = btnElement.innerHTML;
            btnElement.innerHTML = '¡Link Copiado! ✨';
            btnElement.classList.add('copied');
            setTimeout(() => {
                btnElement.innerHTML = originalText;
                btnElement.classList.remove('copied');
            }, 2000);
        }
    } catch (err) {
        console.error('Error al copiar link:', err);
        prompt('Copia el link manualmente:', url);
    }
};

// ── Filters ──
searchInput.addEventListener('input', renderTable);
filterStatus.addEventListener('change', renderTable);
filterGroup.addEventListener('change', renderTable);

// ═══════════════════════════════════════════════════════
//  GUEST MODAL — ADD / EDIT / ADD COMPANION
// ═══════════════════════════════════════════════════════

const guestModalOverlay = document.getElementById('guest-modal-overlay');
const guestForm = document.getElementById('guest-form');
const modalTitle = document.getElementById('modal-title');
const modalMode = document.getElementById('modal-mode');
const modalOriginalCode = document.getElementById('modal-original-code');
const modalNombre = document.getElementById('modal-nombre');
const modalGrupo = document.getElementById('modal-grupo');
const modalIsCompanion = document.getElementById('modal-is-companion');
const modalCompanionFields = document.getElementById('modal-companion-fields');
const modalCompanionOf = document.getElementById('modal-companion-of');
const modalCuposGroup = document.getElementById('modal-cupos-group');
const modalCupos = document.getElementById('modal-cupos');
const modalEstadoGroup = document.getElementById('modal-estado-group');
const modalEstado = document.getElementById('modal-estado');
const modalCompanionToggleGroup = document.getElementById('modal-companion-toggle-group');

window.openAddGuestModal = function () {
    resetModal();
    modalEstadoGroup.classList.add('hidden');
    modalTitle.textContent = 'Nuevo Invitado';
    modalMode.value = 'add';
    populatePrimaryGuestsDropdown();
    guestModalOverlay.classList.remove('hidden');
    requestAnimationFrame(() => guestModalOverlay.classList.add('visible'));
    modalNombre.focus();
};

window.openEditGuestModal = function (codigo) {
    resetModal();
    const guest = allGuests.find(g => g.codigo === codigo);
    if (!guest) return;

    modalTitle.textContent = 'Editar Invitado';
    modalMode.value = 'edit';
    modalOriginalCode.value = codigo;
    modalEstadoGroup.classList.remove('hidden');

    modalNombre.value = guest.nombre;
    modalGrupo.value = guest.grupo || '';
    modalIsCompanion.checked = guest.es_acompanante;
    modalEstado.value = guest.estado || 'Pendiente';
    modalCupos.value = guest.cupos || 1;

    if (guest.es_acompanante) {
        modalCompanionFields.classList.remove('hidden');
        modalCuposGroup.classList.add('hidden');
        populatePrimaryGuestsDropdown(guest.acompanante_de);
    } else {
        populatePrimaryGuestsDropdown();
    }

    guestModalOverlay.classList.remove('hidden');
    requestAnimationFrame(() => guestModalOverlay.classList.add('visible'));
    modalNombre.focus();
};

window.openAddCompanionModal = function (parentCode, parentName) {
    resetModal();
    modalTitle.textContent = `Agregar Acompañante de ${parentName}`;
    modalMode.value = 'add-companion';
    modalOriginalCode.value = parentCode;

    const parent = allGuests.find(g => g.codigo === parentCode);
    if (parent) modalGrupo.value = parent.grupo || '';

    modalCompanionToggleGroup.classList.add('hidden');
    modalCuposGroup.classList.add('hidden');
    modalCompanionFields.classList.add('hidden');
    modalEstadoGroup.classList.add('hidden');
    modalIsCompanion.checked = true;

    guestModalOverlay.classList.remove('hidden');
    requestAnimationFrame(() => guestModalOverlay.classList.add('visible'));
    modalNombre.focus();
};

window.closeGuestModal = function () {
    guestModalOverlay.classList.remove('visible');
    setTimeout(() => guestModalOverlay.classList.add('hidden'), 300);
};

window.toggleCompanionFields = function () {
    if (modalIsCompanion.checked) {
        modalCompanionFields.classList.remove('hidden');
        modalCuposGroup.classList.add('hidden');
        populatePrimaryGuestsDropdown();
    } else {
        modalCompanionFields.classList.add('hidden');
        modalCuposGroup.classList.remove('hidden');
    }
};

function resetModal() {
    guestForm.reset();
    modalMode.value = 'add';
    modalOriginalCode.value = '';
    modalCompanionFields.classList.add('hidden');
    modalCuposGroup.classList.remove('hidden');
    modalCompanionToggleGroup.classList.remove('hidden');
    modalIsCompanion.checked = false;
    modalCupos.value = 1;
}

function populatePrimaryGuestsDropdown(selectedName) {
    const primaries = allGuests.filter(g => !g.es_acompanante);
    modalCompanionOf.innerHTML = '<option value="">Selecciona al titular</option>';
    primaries.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.nombre;
        opt.textContent = `${g.nombre} (${g.codigo})`;
        if (selectedName && g.nombre === selectedName) opt.selected = true;
        modalCompanionOf.appendChild(opt);
    });
}

// ═══════════════════════════════════════════════════════
//  SAVE GUEST (INSERT / UPDATE) — uses sbAdmin
// ═══════════════════════════════════════════════════════

window.saveGuest = async function (e) {
    e.preventDefault();
    const saveBtn = document.getElementById('btn-save-guest');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';

    const mode = modalMode.value;
    const nombre = modalNombre.value.trim();
    const grupo = modalGrupo.value;
    const isCompanion = modalIsCompanion.checked;
    const cupos = isCompanion ? 0 : parseInt(modalCupos.value) || 1;

    try {
        if (mode === 'edit') {
            const codigo = modalOriginalCode.value;
            const estado = modalEstado.value || 'Pendiente';
            const updateData = { nombre, grupo, es_acompanante: isCompanion, cupos, estado };
            if (isCompanion) {
                updateData.acompanante_de = modalCompanionOf.value;
            } else {
                updateData.acompanante_de = null;
            }

            const { error } = await sbAdmin.from('guests').update(updateData).eq('codigo', codigo);
            if (error) throw error;
            showToast('✅ Invitado actualizado correctamente');

        } else if (mode === 'add-companion') {
            const parentCode = modalOriginalCode.value;
            const parent = allGuests.find(g => g.codigo === parentCode);
            if (!parent) throw new Error('Titular no encontrado');

            const companionCode = await generateCompanionCode(parentCode);
            const newGuest = {
                codigo: companionCode, nombre, grupo, cupos: 0,
                es_acompanante: true, acompanante_de: parent.nombre,
                estado: 'Pendiente', restricciones: null, confirmado_en: null
            };

            const { error: insertError } = await sbAdmin.from('guests').insert(newGuest);
            if (insertError) throw insertError;

            const { error: updateError } = await sbAdmin.from('guests').update({ cupos: parent.cupos + 1 }).eq('codigo', parentCode);
            if (updateError) throw updateError;

            showToast(`✅ ${nombre} agregado como acompañante de ${parent.nombre}`);

        } else {
            if (isCompanion) {
                const companionOfName = modalCompanionOf.value;
                const parent = allGuests.find(g => g.nombre === companionOfName && !g.es_acompanante);
                if (!parent) { alert('Selecciona un titular válido'); saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; return; }

                const companionCode = await generateCompanionCode(parent.codigo);
                const newGuest = {
                    codigo: companionCode, nombre, grupo, cupos: 0,
                    es_acompanante: true, acompanante_de: companionOfName,
                    estado: 'Pendiente', restricciones: null, confirmado_en: null
                };

                const { error: insertError } = await sbAdmin.from('guests').insert(newGuest);
                if (insertError) throw insertError;

                const { error: updateError } = await sbAdmin.from('guests').update({ cupos: parent.cupos + 1 }).eq('codigo', parent.codigo);
                if (updateError) throw updateError;

                showToast(`✅ ${nombre} agregado como acompañante de ${companionOfName}`);
            } else {
                const newCode = await generateNextCode();
                const newGuest = {
                    codigo: newCode, nombre, grupo, cupos,
                    es_acompanante: false, acompanante_de: null,
                    estado: 'Pendiente', restricciones: null, confirmado_en: null
                };

                const { error } = await sbAdmin.from('guests').insert(newGuest);
                if (error) throw error;
                showToast(`✅ ${nombre} agregado con código ${newCode}`);
            }
        }

        closeGuestModal();
        await loadGuests();

    } catch (err) {
        console.error('Error saving guest:', err);
        showToast('❌ Error al guardar: ' + (err.message || err));
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar';
    }
};

// ═══════════════════════════════════════════════════════
//  DELETE GUEST — uses sbAdmin (hard delete)
// ═══════════════════════════════════════════════════════

const deleteModalOverlay = document.getElementById('delete-modal-overlay');
const deleteGuestNameEl = document.getElementById('delete-guest-name');
const deleteWarningEl = document.getElementById('delete-warning');

window.openDeleteModal = function (codigo) {
    const guest = allGuests.find(g => g.codigo === codigo);
    if (!guest) return;

    deleteTargetCode = codigo;
    deleteGuestNameEl.textContent = `"${guest.nombre}" (${guest.codigo})`;

    if (!guest.es_acompanante) {
        const companions = allGuests.filter(g => g.acompanante_de === guest.nombre);
        if (companions.length > 0) {
            deleteWarningEl.textContent = `⚠️ Este titular tiene ${companions.length} acompañante(s) que también serán eliminados.`;
            deleteWarningEl.classList.add('has-warning');
        } else {
            deleteWarningEl.textContent = 'Esta acción no se puede deshacer.';
            deleteWarningEl.classList.remove('has-warning');
        }
    } else {
        deleteWarningEl.textContent = 'Se reducirá el cupo del titular.';
        deleteWarningEl.classList.remove('has-warning');
    }

    deleteModalOverlay.classList.remove('hidden');
    requestAnimationFrame(() => deleteModalOverlay.classList.add('visible'));
};

window.closeDeleteModal = function () {
    deleteModalOverlay.classList.remove('visible');
    setTimeout(() => deleteModalOverlay.classList.add('hidden'), 300);
    deleteTargetCode = null;
};

window.confirmDelete = async function () {
    if (!deleteTargetCode) return;

    const confirmBtn = document.getElementById('btn-confirm-delete');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Eliminando...';

    try {
        const guest = allGuests.find(g => g.codigo === deleteTargetCode);
        if (!guest) throw new Error('Invitado no encontrado');

        if (!guest.es_acompanante) {
            // Delete companions first
            const companions = allGuests.filter(g => g.acompanante_de === guest.nombre);
            for (const comp of companions) {
                const { error } = await sbAdmin.from('guests').delete().eq('codigo', comp.codigo);
                if (error) throw error;
            }
            // Delete the primary guest
            const { error } = await sbAdmin.from('guests').delete().eq('codigo', deleteTargetCode);
            if (error) throw error;

            showToast(`🗑️ ${guest.nombre} ${companions.length > 0 ? `y ${companions.length} acompañante(s) ` : ''}eliminado(s)`);

        } else {
            // Delete the companion
            const { error } = await sbAdmin.from('guests').delete().eq('codigo', deleteTargetCode);
            if (error) throw error;

            // Decrement parent cupos
            const parent = allGuests.find(g => g.nombre === guest.acompanante_de && !g.es_acompanante);
            if (parent && parent.cupos > 1) {
                await sbAdmin.from('guests').update({ cupos: parent.cupos - 1 }).eq('codigo', parent.codigo);
            }

            showToast(`🗑️ ${guest.nombre} eliminado`);
        }

        closeDeleteModal();
        await loadGuests();

    } catch (err) {
        console.error('Error deleting guest:', err);
        showToast('❌ Error al eliminar: ' + (err.message || err));
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Eliminar';
    }
};

// ═══════════════════════════════════════════════════════
//  CODE GENERATION
// ═══════════════════════════════════════════════════════

async function generateNextCode() {
    const primaryCodes = allGuests
        .filter(g => !g.es_acompanante)
        .map(g => g.codigo)
        .filter(c => /^AJ\d+$/.test(c))
        .map(c => parseInt(c.replace('AJ', '')));

    const maxNum = primaryCodes.length > 0 ? Math.max(...primaryCodes) : 0;
    const nextNum = maxNum + 1;
    return `AJ${nextNum.toString().padStart(2, '0')}`;
}

async function generateCompanionCode(parentCode) {
    const existingCompanions = allGuests
        .filter(g => g.codigo.startsWith(parentCode + '-C'))
        .map(g => {
            const match = g.codigo.match(/-C(\d+)$/);
            return match ? parseInt(match[1]) : 0;
        });

    const maxC = existingCompanions.length > 0 ? Math.max(...existingCompanions) : 0;
    return `${parentCode}-C${maxC + 1}`;
}

// ═══════════════════════════════════════════════════════
//  TOAST NOTIFICATION
// ═══════════════════════════════════════════════════════

function showToast(msg) {
    const toast = document.getElementById('admin-toast');
    const toastMsg = document.getElementById('admin-toast-msg');
    toastMsg.textContent = msg;
    toast.classList.remove('hidden');
    toast.classList.add('visible');

    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.classList.add('hidden'), 400);
    }, 3000);
}
