/**
 * ========================================================================
 * ARCHIVO: dashboard-ui.js
 * PROPÓSITO: UI Logic para AMOLED Black, Cuadre de Caja y API Gemini
 * ========================================================================
 */

// Referencias a elementos del DOM
const listTransacciones = document.getElementById('transactions-list-container');
const totalIngresosEl = document.getElementById('total-ingresos');
const totalGastosEl = document.getElementById('total-gastos');
const balanceGeneralEl = document.getElementById('balance-general');
const totalDebitoEl = document.getElementById('total-debito');
const totalCreditoEl = document.getElementById('total-credito');
const totalEfectivoEl = document.getElementById('total-efectivo');
// Variable global para almacenar las transacciones procesadas y poder filtrarlas
let allTransaccionesProcesadas = [];
let allEstadosDeCuenta = [];
let currentTransactionFilter = 'Todas';
let currentSortMethod = 'date'; // date, amount, category

/**
 * Función Principal de Renderizado
 */
async function renderDashboard() {
    // 1. Loading state
    if(listTransacciones) {
        listTransacciones.innerHTML = `
            <div class="p-8 text-center text-textMuted text-sm mt-2">
                Cargando transacciones...
            </div>
        `;
    }

    // 2. Fetch Data
    const transacciones = await fetchTransacciones();
    const estados = await fetchEstadosDeCuenta();
    const cuentasBase = await fetchCuentasBase();
    allEstadosDeCuenta = estados;

    // 3. Procesar transacciones con dashboard-logic.js
    const { totales, transaccionesProcesadas } = procesarTransacciones(transacciones, estados, cuentasBase);
    allTransaccionesProcesadas = transaccionesProcesadas;

    // 4. Renderizar lista inicial con el filtro activo
    renderTransactionsList(currentTransactionFilter);

    // 5. Actualizar UI de KPIs
    if(totalIngresosEl) totalIngresosEl.textContent = formatCurrency(totales.sumaIngresos);
    if(totalGastosEl) totalGastosEl.textContent = formatCurrency(totales.sumaGastos);
    if(balanceGeneralEl) balanceGeneralEl.textContent = formatCurrency(totales.patrimonio);
    if(totalDebitoEl) totalDebitoEl.textContent = formatCurrency(totales.debito);
    if(totalCreditoEl) totalCreditoEl.textContent = formatCurrency(totales.credito);
    if(totalEfectivoEl) totalEfectivoEl.textContent = formatCurrency(totales.efectivo);

    // Reinicializar iconos para los elementos inyectados dinámicamente
    lucide.createIcons();
    
    // 6. Actualizar fecha de última actualización
    const lastUpdateEl = document.getElementById('last-update-time');
    if (lastUpdateEl) {
        const now = new Date();
        lastUpdateEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + now.toLocaleDateString();
    }
}

/**
 * Función para renderizar la lista de transacciones aplicando filtros
 */
function renderTransactionsList(filterType) {
    if (!listTransacciones) return;
    listTransacciones.innerHTML = '';
    
    let filtered = allTransaccionesProcesadas;
    if (filterType === 'Bancos') {
        filtered = allTransaccionesProcesadas.filter(tx => tx.badgeFuente === 'Bancario');
    } else if (filterType === 'Efectivo') {
        filtered = allTransaccionesProcesadas.filter(tx => tx.badgeFuente === 'Efectivo');
    }
    
    if (filtered.length === 0) {
        listTransacciones.innerHTML = `<div class="p-8 text-center text-textMuted text-sm mt-2">No hay movimientos.</div>`;
        return;
    }

    // Aplicar ordenamiento
    filtered.sort((a, b) => {
        if (currentSortMethod === 'amount') {
            return b.montoBruto - a.montoBruto; // Mayor a menor
        } else if (currentSortMethod === 'category') {
            return a.categoria.localeCompare(b.categoria); // Alfabético
        }
        // date (por defecto)
        return b.fechaOriginal - a.fechaOriginal; // Más reciente a más antiguo
    });
    
    filtered.forEach((tx) => {
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between p-3 bg-surface rounded-xl border border-borderSubtle select-none cursor-pointer transition active:scale-[0.98]';
        div.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="p-2.5 bg-[#1a1a1a] rounded-lg text-textMuted">
                    <i data-lucide="${tx.iconName}" class="w-5 h-5"></i>
                </div>
                <div class="flex-1 pr-2">
                    <h4 class="text-[11px] font-semibold text-textMain leading-tight line-clamp-2">${tx.descripcion}</h4>
                    <div class="flex items-center gap-2 mt-1">
                        <span class="text-[10px] font-mono text-textMuted uppercase">${tx.badgeFuente}</span>
                        <span class="w-1 h-1 rounded-full bg-borderSubtle"></span>
                        <span class="text-[10px] text-textMuted">${tx.fechaParaMostrar}</span>
                    </div>
                </div>
            </div>
            <div class="text-right shrink-0">
                <p class="text-[13px] font-display font-semibold tabular-nums ${tx.colorClass}">${tx.sign}${tx.montoFormateado}</p>
                <p class="text-[9px] text-textMuted mt-0.5 uppercase tracking-wider">${tx.categoria}</p>
            </div>
        `;
        let pressTimer;
        let isLongPress = false;
        const startPress = (e) => {
            if (tx.fuente !== 'manual') return; 
            isLongPress = false;
            pressTimer = setTimeout(() => {
                isLongPress = true;
                openEditModal(tx.id, tx.datos_extraidos, tx.montoBruto);
                if (navigator.vibrate) navigator.vibrate(50);
            }, 800); // 800ms for long press is better than 2000ms
        };

        const cancelPress = (e) => {
            clearTimeout(pressTimer);
            if (isLongPress && e.type === 'touchend') {
                e.preventDefault();
            }
        };

        div.addEventListener('mousedown', startPress);
        div.addEventListener('touchstart', startPress, { passive: true });
        div.addEventListener('mouseup', cancelPress);
        div.addEventListener('mouseleave', cancelPress);
        div.addEventListener('touchend', cancelPress, { passive: false });
        div.addEventListener('touchmove', cancelPress, { passive: true });
        
        listTransacciones.appendChild(div);
    });
    lucide.createIcons();
}

// ========================================================================
// SECCIÓN: CONSEJOS GEMINI (EDGE FUNCTION)
// ========================================================================
const btnAskGemini = document.getElementById('btn-ask-gemini');
const geminiContainer = document.getElementById('gemini-insights-container');

if (btnAskGemini) {
    btnAskGemini.addEventListener('click', async () => {
        // Loading state
        const originalText = btnAskGemini.innerHTML;
        btnAskGemini.innerHTML = '<i data-lucide="loader" class="w-3.5 h-3.5 text-emerald animate-spin"></i> Pensando...';
        btnAskGemini.disabled = true;
        lucide.createIcons();

        try {
            // Recopilar resumen para Gemini
            const ingresos = document.getElementById('total-ingresos').textContent;
            const gastos = document.getElementById('total-gastos').textContent;
            const debito = document.getElementById('total-debito').textContent;
            const credito = document.getElementById('total-credito').textContent;
            const efectivo = document.getElementById('total-efectivo').textContent;
            
            const bancos = \`Débito: \${debito}, Crédito: \${credito}\`;

            // Llamada a función centralizada en supabase-client.js
            const data = await fetchGeminiAdvice(ingresos, gastos, bancos, efectivo, allEstadosDeCuenta);

            const adviceHtml = (data.advice || 'Sin respuesta.')
                .replace(/^###\s+(.*$)/gim, '<h3 class="text-sm font-bold text-emerald mt-4 mb-1">$1</h3>')
                .replace(/^##\s+(.*$)/gim, '<h2 class="text-base font-bold text-emerald mt-4 mb-2">$1</h2>')
                .replace(/^#\s+(.*$)/gim, '<h1 class="text-lg font-bold text-emerald mt-4 mb-2">$1</h1>')
                .replace(/\*\*(.*?)\*\*/g, '<strong class="text-textMain">$1</strong>')
                .replace(/(?<!^)\*(.*?)\*(?!\s)/g, '<em>$1</em>')
                .replace(/\n/g, '<br>');

            // Renderizar respuesta
            geminiContainer.innerHTML = \`
                <div class="bg-surface p-4 rounded-xl border border-borderSubtle flex gap-3 items-start">
                    <div class="p-2 bg-[#1a1a1a] rounded-lg text-emerald shrink-0 mt-0.5">
                        <i data-lucide="sparkles" class="w-5 h-5"></i>
                    </div>
                    <div class="w-full">
                        <p class="text-sm text-textMuted leading-relaxed">\${adviceHtml}</p>
                    </div>
                </div>
            \`;
        } catch (err) {
            console.error(err);
            geminiContainer.innerHTML = \`
                <div class="bg-surface p-4 rounded-xl border border-coral flex gap-3 items-start">
                    <div class="p-2 bg-[#1a1a1a] rounded-lg text-coral shrink-0 mt-0.5">
                        <i data-lucide="alert-circle" class="w-5 h-5"></i>
                    </div>
                    <div>
                        <p class="text-sm text-coral leading-relaxed">Hubo un error al contactar al asesor. Asegúrate de haber desplegado la función en Supabase.</p>
                    </div>
                </div>
            \`;
        } finally {
            btnAskGemini.innerHTML = originalText;
            btnAskGemini.disabled = false;
            lucide.createIcons();
        }
    });
}

// ========================================================================
// SECCIÓN: INSIGHTS DE ESTADOS DE CUENTA
// ========================================================================
async function renderEstadosDeCuenta() {
    const estadosContainer = document.getElementById('pdf-insights-container');
    const pdfSection = document.getElementById('pdf-insights-section');
    if (!estadosContainer || !pdfSection) return;

    const estados = await fetchEstadosDeCuenta();
    if (estados.length === 0) return; // Si no hay, dejamos oculto

    let hasInsights = false;
    estadosContainer.innerHTML = '';

    estados.forEach((e) => {
        const banco = e.banco || 'Desconocido';
        const detalles = parseDataExtraidos(e.detalles_raw);
        
        // Alerta de Comisiones/Fuga
        const comisiones = Number(detalles.comisiones_cobradas || 0);
        if (comisiones > 0) {
            hasInsights = true;
            estadosContainer.innerHTML += \`
                <div class="bg-surface p-4 rounded-xl border border-coral flex items-start gap-3">
                    <div class="p-2 bg-[#1a1a1a] rounded-lg text-coral shrink-0 mt-0.5">
                        <i data-lucide="alert-triangle" class="w-5 h-5"></i>
                    </div>
                    <div>
                        <h4 class="font-bold text-coral text-sm">Fuga detectada en \${banco}</h4>
                        <p class="text-xs text-textMuted mt-1">Pagaste <strong>\${formatCurrency(comisiones)}</strong> en comisiones.</p>
                    </div>
                </div>
            \`;
        }

        // Info de Crédito
        const pagoNoInt = Number(detalles.pago_no_intereses || 0);
        if (pagoNoInt > 0) {
            hasInsights = true;
            estadosContainer.innerHTML += \`
                <div class="bg-surface p-4 rounded-xl border border-borderSubtle flex items-start gap-3">
                    <div class="p-2 bg-[#1a1a1a] rounded-lg text-blue-400 shrink-0 mt-0.5">
                        <i data-lucide="credit-card" class="w-5 h-5"></i>
                    </div>
                    <div>
                        <h4 class="font-bold text-textMain text-sm">Alerta de Deuda en \${banco}</h4>
                        <p class="text-xs text-textMuted mt-1">Pago ideal: <strong class="text-blue-400">\${formatCurrency(pagoNoInt)}</strong></p>
                    </div>
                </div>
            \`;
        }
    });

    if (hasInsights) {
        pdfSection.classList.remove('hidden');
        lucide.createIcons();
    }
}

// ========================================================================
// SECCIÓN: EDICIÓN DE GASTOS (LONG PRESS)
// ========================================================================
const editModal = document.getElementById('edit-modal');
const btnCloseEdit = document.getElementById('btn-close-edit');
const btnCancelEdit = document.getElementById('btn-cancel-edit');
const formEditTx = document.getElementById('form-edit-tx');

function openEditModal(txId, datos, montoBruto) {
    if (!editModal) return;
    document.getElementById('edit-tx-id').value = txId;
    document.getElementById('edit-tx-desc').value = datos.descripcion || '';
    document.getElementById('edit-tx-monto').value = montoBruto || 0;
    document.getElementById('edit-tx-cat').value = datos.categoria || '';
    document.getElementById('edit-tx-metodo').value = datos.metodo_pago || 'desconocido';
    
    editModal.classList.remove('hidden');
    editModal.classList.add('flex');
}

function closeEditModal() {
    if (!editModal) return;
    editModal.classList.add('hidden');
    editModal.classList.remove('flex');
}

if (btnCloseEdit && btnCancelEdit && formEditTx) {
    btnCloseEdit.addEventListener('click', closeEditModal);
    btnCancelEdit.addEventListener('click', closeEditModal);
    
    formEditTx.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSave = document.getElementById('btn-save-edit');
        const originalText = btnSave.innerHTML;
        btnSave.innerHTML = 'Guardando...';
        btnSave.disabled = true;

        const id = document.getElementById('edit-tx-id').value;
        const nuevosDatos = {
            descripcion: document.getElementById('edit-tx-desc').value,
            monto: parseFloat(document.getElementById('edit-tx-monto').value),
            categoria: document.getElementById('edit-tx-cat').value,
            metodo_pago: document.getElementById('edit-tx-metodo').value
        };

        try {
            await updateTransaccionManual(id, nuevosDatos);
            closeEditModal();
            renderDashboard(); // Recargar todo
        } catch (error) {
            alert('Error al guardar los cambios.');
        } finally {
            btnSave.innerHTML = originalText;
            btnSave.disabled = false;
        }
    });

    const btnDeleteEdit = document.getElementById('btn-delete-edit');
    if (btnDeleteEdit) {
        btnDeleteEdit.addEventListener('click', async () => {
            const id = document.getElementById('edit-tx-id').value;
            if (confirm('¿Estás seguro de que deseas eliminar este registro?')) {
                const originalText = btnDeleteEdit.innerHTML;
                btnDeleteEdit.innerHTML = 'Eliminando...';
                btnDeleteEdit.disabled = true;

                try {
                    await deleteTransaccionManual(id);
                    closeEditModal();
                    renderDashboard();
                } catch (error) {
                    alert('Error al eliminar.');
                } finally {
                    btnDeleteEdit.innerHTML = originalText;
                    btnDeleteEdit.disabled = false;
                }
            }
        });
    }
}

// ========================================================================
// EVENT LISTENERS
// ========================================================================
document.addEventListener('DOMContentLoaded', async () => {
    const loginOverlay = document.getElementById('login-overlay');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');

    // 1. Check Session
    try {
        const session = await checkSession();
        if (session) {
            loginOverlay.classList.add('hidden');
            loginOverlay.classList.remove('flex', 'flex-col');
            renderDashboard();
            renderEstadosDeCuenta();
        } else {
            loginOverlay.classList.remove('hidden');
            loginOverlay.classList.add('flex', 'flex-col');
        }
    } catch (e) {
        console.error("Session check error", e);
    }

    // Escuchar cambios de sesión en tiempo real (ej. al restaurar localStorage)
    if (typeof supabaseClient !== 'undefined') {
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                loginOverlay.classList.add('hidden');
                loginOverlay.classList.remove('flex', 'flex-col');
                renderDashboard();
                renderEstadosDeCuenta();
            } else if (event === 'SIGNED_OUT') {
                loginOverlay.classList.remove('hidden');
                loginOverlay.classList.add('flex', 'flex-col');
            }
        });
    }

    // 2. Handle Login Form
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const btn = loginForm.querySelector('button[type="submit"]');
            
            btn.innerHTML = 'Cargando...';
            btn.disabled = true;
            loginError.classList.add('hidden');

            try {
                await signIn(email, password);
                loginOverlay.classList.add('hidden');
                renderDashboard();
                renderEstadosDeCuenta();
            } catch (error) {
                loginError.textContent = error.message || 'Credenciales inválidas';
                loginError.classList.remove('hidden');
            } finally {
                btn.innerHTML = '<i data-lucide="log-in" class="w-5 h-5"></i> Entrar';
                btn.disabled = false;
                if (window.lucide) lucide.createIcons();
            }
        });
    }

    // 3. Handle Logout
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            try {
                await signOut();
                // Clear UI
                const list = document.getElementById('transactions-list-container');
                if (list) list.innerHTML = '';
                if (document.getElementById('balance-general')) document.getElementById('balance-general').textContent = '$0.00';
                if (document.getElementById('total-debito')) document.getElementById('total-debito').textContent = '$0.00';
                if (document.getElementById('total-credito')) document.getElementById('total-credito').textContent = '$0.00';
                if (document.getElementById('total-efectivo')) document.getElementById('total-efectivo').textContent = '$0.00';
                loginOverlay.classList.remove('hidden');
            } catch (error) {
                console.error("Error al cerrar sesión:", error);
            }
        });
    }

    // Event listeners para filtros de transacciones
    const btnAll = document.getElementById('btn-filter-all');
    const btnBank = document.getElementById('btn-filter-bank');
    const btnCash = document.getElementById('btn-filter-cash');
    
    const filterBtns = [btnAll, btnBank, btnCash];
    
    function setFilterActive(activeBtn) {
        if(!activeBtn) return;
        filterBtns.forEach(btn => {
            if(!btn) return;
            btn.classList.remove('bg-textMain', 'text-background', 'text-black', 'text-[#000000]', 'font-semibold');
            btn.classList.add('bg-surface', 'text-textMuted', 'hover:text-textMain');
            btn.style.color = '';
        });
        activeBtn.classList.remove('bg-surface', 'text-textMuted', 'hover:text-textMain');
        activeBtn.classList.add('bg-textMain', 'text-background', 'font-semibold');
    }

    if (btnAll) btnAll.addEventListener('click', () => { currentTransactionFilter = 'Todas'; setFilterActive(btnAll); renderTransactionsList('Todas'); });
    if (btnBank) btnBank.addEventListener('click', () => { currentTransactionFilter = 'Bancos'; setFilterActive(btnBank); renderTransactionsList('Bancos'); });
    if (btnCash) btnCash.addEventListener('click', () => { currentTransactionFilter = 'Efectivo'; setFilterActive(btnCash); renderTransactionsList('Efectivo'); });

    // Ensure the active filter is visually set on initial load or after edits
    if (currentTransactionFilter === 'Todas' && btnAll) setFilterActive(btnAll);
    else if (currentTransactionFilter === 'Bancos' && btnBank) setFilterActive(btnBank);
    else if (currentTransactionFilter === 'Efectivo' && btnCash) setFilterActive(btnCash);

    // Event listeners para ordenamiento
    const btnSortDate = document.getElementById('btn-sort-date');
    const btnSortAmount = document.getElementById('btn-sort-amount');
    const btnSortCategory = document.getElementById('btn-sort-category');
    
    const sortBtns = [btnSortDate, btnSortAmount, btnSortCategory];

    function setSortActive(activeBtn) {
        if (!activeBtn) return;
        sortBtns.forEach(btn => {
            if(!btn) return;
            btn.classList.remove('text-emerald', 'font-bold');
            btn.classList.add('text-textMuted', 'font-medium');
        });
        activeBtn.classList.remove('text-textMuted', 'font-medium');
        activeBtn.classList.add('text-emerald', 'font-bold');
    }

    if (btnSortDate) btnSortDate.addEventListener('click', () => { currentSortMethod = 'date'; setSortActive(btnSortDate); renderTransactionsList(currentTransactionFilter); });
    if (btnSortAmount) btnSortAmount.addEventListener('click', () => { currentSortMethod = 'amount'; setSortActive(btnSortAmount); renderTransactionsList(currentTransactionFilter); });
    if (btnSortCategory) btnSortCategory.addEventListener('click', () => { currentSortMethod = 'category'; setSortActive(btnSortCategory); renderTransactionsList(currentTransactionFilter); });

});