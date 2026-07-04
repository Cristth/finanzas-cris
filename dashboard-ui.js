/**
 * ========================================================================
 * ARCHIVO: dashboard-ui.js
 * PROPÓSITO: Este archivo es el "pegamento" entre los datos (Supabase) y
 * la interfaz de usuario (HTML). Se encarga de obtener los datos llamando a
 * supabase-client.js, parsearlos usando utils.js y finalmente inyectarlos
 * dinámicamente en el DOM (en la tabla y en las tarjetas de resumen).
 * ========================================================================
 */

// Referencias a elementos del DOM
const tbodyTransacciones = document.getElementById('transactions-table-body');
const totalIngresosEl = document.getElementById('total-ingresos');
const totalGastosEl = document.getElementById('total-gastos');
const balanceGeneralEl = document.getElementById('balance-general');
const btnRefresh = document.getElementById('btn-refresh');

/**
 * Función: renderDashboard
 * Descripción: Es la función principal que orquesta la actualización de la UI.
 * Obtiene los datos, calcula los totales y renderiza las filas en la tabla.
 * @returns {Promise<void>}
 */
async function renderDashboard() {
    // 1. Mostrar estado de carga en la tabla
    tbodyTransacciones.innerHTML = `
        <tr>
            <td colspan="6" class="p-8 text-center text-textMuted">Cargando transacciones...</td>
        </tr>
    `;

    // 2. Obtener datos desde Supabase (usando la función de supabase-client.js)
    const transacciones = await fetchTransacciones();

    // 3. Variables para acumular los totales
    let sumaIngresos = 0;
    let sumaGastos = 0;

    // Limpiamos el cuerpo de la tabla antes de inyectar las filas nuevas
    tbodyTransacciones.innerHTML = '';

    // Si no hay transacciones, mostramos un mensaje vacío
    if (transacciones.length === 0) {
        tbodyTransacciones.innerHTML = `
            <tr>
                <td colspan="6" class="p-8 text-center text-textMuted">No hay transacciones registradas.</td>
            </tr>
        `;
    }

    // 4. Recorrer las transacciones y construir el HTML
    transacciones.forEach((t) => {
        // Parseamos los datos extraídos (regla estricta del requerimiento) usando utils.js
        const datosExtraidos = parseDataExtraidos(t.datos_extraidos);
        
        // Extraemos valores específicos con valores por defecto por seguridad
        const tipo = (datosExtraidos.tipo || 'desconocido').toLowerCase(); // 'gasto' o 'ingreso'
        const monto = Number(datosExtraidos.monto || 0);
        const categoria = datosExtraidos.categoria || 'Sin categoría';
        const descripcion = datosExtraidos.descripcion || 'Sin descripción';
        
        // Calculamos sumatorias
        if (tipo === 'ingreso') {
            sumaIngresos += monto;
        } else if (tipo === 'gasto') {
            sumaGastos += monto;
        }

        // Lógica de Fuente de Datos
        let badgeEstado = '';
        if (t.fuente === 'estado_cuenta') {
            badgeEstado = '<span class="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-xs font-semibold">Bancario</span>';
        } else if (t.fuente === 'manual') {
            badgeEstado = '<span class="px-2 py-1 bg-sky-50 text-sky-700 border border-sky-200 rounded-md text-xs font-semibold">Telegram</span>';
        } else if (t.fuente === 'whatsapp') {
            badgeEstado = '<span class="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-xs font-semibold">WhatsApp</span>';
        } else {
            badgeEstado = `<span class="px-2 py-1 bg-gray-50 text-gray-700 border border-gray-200 rounded-md text-xs font-semibold capitalize">${t.fuente}</span>`;
        }

        // Determinamos colores y estilos según el tipo (ingreso = verde, gasto = rojo)
        const tipoColor = tipo === 'ingreso' ? 'text-green-600 bg-green-50' : (tipo === 'gasto' ? 'text-red-600 bg-red-50' : 'text-gray-600 bg-gray-50');
        const montoColor = tipo === 'ingreso' ? 'text-green-600' : 'text-textMain';
        const signo = tipo === 'gasto' ? '-' : (tipo === 'ingreso' ? '+' : '');

        // Preferir la fecha extraída del PDF/chat, usar fecha de registro como respaldo
        const fechaParaMostrar = datosExtraidos.fecha || t.created_at;

        // Creamos la fila de la tabla
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0';
        tr.innerHTML = `
            <td class="p-4">${badgeEstado}</td>
            <td class="p-4 whitespace-nowrap text-textMuted">${formatDate(fechaParaMostrar)}</td>
            <td class="p-4 font-medium text-textMain">${descripcion}</td>
            <td class="p-4"><span class="px-2 py-1 bg-gray-100 text-textMuted rounded-md text-xs font-medium">${categoria}</span></td>
            <td class="p-4">
                <span class="px-2 py-1 rounded-md text-xs font-semibold uppercase tracking-wide ${tipoColor}">
                    ${tipo}
                </span>
            </td>
            <td class="p-4 text-right font-semibold tabular-nums ${montoColor}">
                ${signo}${formatCurrency(monto)}
            </td>
        `;
        
        tbodyTransacciones.appendChild(tr);
    });

    // 5. Actualizar las tarjetas de resumen usando la función formatCurrency de utils.js
    const balance = sumaIngresos - sumaGastos;
    
    totalIngresosEl.textContent = formatCurrency(sumaIngresos);
    totalGastosEl.textContent = formatCurrency(sumaGastos);
    balanceGeneralEl.textContent = formatCurrency(balance);
}

// ========================================================================
// SECCIÓN: ESTADOS DE CUENTA
// ========================================================================
const tbodyEstados = document.getElementById('estados-table-body');
const btnRefreshEstados = document.getElementById('btn-refresh-estados');

/**
 * Función: renderEstadosDeCuenta
 * Descripción: Obtiene los documentos procesados por Gemini y los renderiza en su respectiva tabla.
 * @returns {Promise<void>}
 */
async function renderEstadosDeCuenta() {
    if (!tbodyEstados) return;

    // 1. Mostrar estado de carga
    tbodyEstados.innerHTML = `
        <tr>
            <td colspan="6" class="p-8 text-center text-textMuted">Cargando estados de cuenta...</td>
        </tr>
    `;

    // 2. Obtener datos
    const estados = await fetchEstadosDeCuenta();

    const recContainer = document.getElementById('recomendaciones-container');
    if (recContainer) recContainer.innerHTML = '';
    let recomendacionesHtml = '';

    // 3. Limpiar tabla
    tbodyEstados.innerHTML = '';

    // Si no hay documentos
    if (estados.length === 0) {
        tbodyEstados.innerHTML = `
            <tr>
                <td colspan="6" class="p-8 text-center text-textMuted">No hay estados de cuenta registrados.</td>
            </tr>
        `;
        if (recContainer) {
            recContainer.innerHTML = '<p class="text-sm text-gray-400 italic px-2">Sube un estado de cuenta para recibir recomendaciones automáticas.</p>';
        }
        return;
    }

    // 4. Construir HTML
    estados.forEach((e) => {
        const banco = e.banco || 'Desconocido';
        const tipo = e.tipo_tarjeta || 'Desconocido';
        const periodo = e.periodo || 'N/A';
        const saldoFinal = Number(e.saldo_final || 0);
        
        // Extraer los detalles de la IA para generar los Insights
        const detalles = parseDataExtraidos(e.detalles_raw);
        let insightsHtml = '';
        
        // Alerta de Comisiones/Fuga
        const comisiones = Number(detalles.comisiones_cobradas || 0);
        if (comisiones > 0) {
            insightsHtml += `<div class="mb-1"><span class="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-md text-[10px] font-bold tracking-wide">⚠️ FUGA: ${formatCurrency(comisiones)}</span></div>`;
            
            // Agregar a recomendaciones globales
            recomendacionesHtml += `
                <div class="bg-red-50 border border-red-100 p-4 rounded-xl shadow-sm flex items-start gap-3">
                    <span class="text-red-500 text-xl">⚠️</span>
                    <div>
                        <h4 class="font-bold text-red-800 text-sm">Fuga de dinero detectada en ${banco}</h4>
                        <p class="text-xs text-red-600 mt-1">Pagaste <strong>${formatCurrency(comisiones)}</strong> en comisiones o penalizaciones. Sugerencia: Revisa tu contrato para conocer el saldo promedio mínimo o condiciones para evitar este cobro.</p>
                    </div>
                </div>
            `;
        }

        // Info de Crédito
        const limite = Number(detalles.limite_credito || 0);
        const disponible = Number(detalles.credito_disponible || 0);
        const pagoNoInt = Number(detalles.pago_no_intereses || 0);
        
        if (limite > 0) {
            insightsHtml += `<div class="flex flex-col gap-0.5 text-[11px] leading-tight mt-1">
                <span class="text-textMuted">Límite: <span class="font-medium text-textMain">${formatCurrency(limite)}</span></span>
                <span class="text-textMuted">Disp.: <span class="font-bold text-blue-600">${formatCurrency(disponible)}</span></span>
                ${pagoNoInt > 0 ? `<span class="text-textMuted mt-0.5 border-t border-gray-100 pt-0.5">Pagar: <span class="font-bold text-emerald-600">${formatCurrency(pagoNoInt)}</span></span>` : ''}
            </div>`;
            
            if (pagoNoInt > 0) {
                // Agregar a recomendaciones globales
                recomendacionesHtml += `
                    <div class="bg-blue-50 border border-blue-100 p-4 rounded-xl shadow-sm flex items-start gap-3">
                        <span class="text-blue-500 text-xl">💳</span>
                        <div>
                            <h4 class="font-bold text-blue-800 text-sm">Alerta de Deuda en ${banco} (${tipo})</h4>
                            <p class="text-xs text-blue-600 mt-1">Tienes un pago ideal de <strong>${formatCurrency(pagoNoInt)}</strong>. Intenta liquidarlo antes de tu fecha límite para no regalarle intereses al banco.</p>
                        </div>
                    </div>
                `;
            }
        }

        if (!insightsHtml) {
            insightsHtml = '<span class="text-[11px] text-gray-400 italic">Todo en orden</span>';
        }

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0';
        tr.innerHTML = `
            <td class="p-4 whitespace-nowrap text-textMuted">${formatDate(e.created_at)}</td>
            <td class="p-4 font-medium text-textMain">${banco}</td>
            <td class="p-4"><span class="px-2 py-1 bg-gray-100 text-textMuted rounded-md text-xs font-medium">${tipo}</span></td>
            <td class="p-4 text-textMain">${periodo}</td>
            <td class="p-4 align-top">${insightsHtml}</td>
            <td class="p-4 text-right font-semibold tabular-nums text-textMain">
                ${formatCurrency(saldoFinal)}
            </td>
        `;
        
        tbodyEstados.appendChild(tr);
    });

    if (recContainer) {
        if (recomendacionesHtml === '') {
            recomendacionesHtml = `
                <div class="bg-emerald-50 border border-emerald-100 p-4 rounded-xl shadow-sm flex items-start gap-3">
                    <span class="text-emerald-500 text-xl">✨</span>
                    <div>
                        <h4 class="font-bold text-emerald-800 text-sm">¡Finanzas Sanas!</h4>
                        <p class="text-xs text-emerald-600 mt-1">No se detectaron fugas de dinero ni deudas críticas en tus estados de cuenta recientes.</p>
                    </div>
                </div>
            `;
        }
        recContainer.innerHTML = recomendacionesHtml;
    }
}

// ========================================================================
// EVENT LISTENERS
// ========================================================================

// Cuando el documento HTML se carga completamente, renderizamos el dashboard por primera vez
document.addEventListener('DOMContentLoaded', () => {
    renderDashboard();
    renderEstadosDeCuenta();
});

// Cuando el usuario hace clic en el botón "Actualizar", volvems a renderizar
if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
        renderDashboard();
    });
}

if (btnRefreshEstados) {
    btnRefreshEstados.addEventListener('click', () => {
        renderEstadosDeCuenta();
    });
}