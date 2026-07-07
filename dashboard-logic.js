/**
 * ========================================================================
 * ARCHIVO: dashboard-logic.js
 * PROPÓSITO: Este archivo contiene las reglas de negocio y matemáticas del 
 * Cuadre de Caja. Recibe los datos crudos y devuelve la información 
 * procesada y lista para ser pintada por la interfaz de usuario.
 * ========================================================================
 */

/**
 * Procesa un array de transacciones crudas de la base de datos
 * y devuelve los totales calculados y una lista de transacciones decoradas.
 * 
 * @param {Array} transacciones - Array crudo de transacciones de Supabase
 * @param {Array} estadosDeCuenta - Documentos procesados por Gemini
 * @param {Array} cuentasBase - Array de cuentas base (Saldos iniciales declarados)
 * @returns {Object} - Objeto con totales y transaccionesProcesadas
 */
function procesarTransacciones(transacciones, estadosDeCuenta = [], cuentasBase = []) {
    let baseEfectivo = { saldo: 0, fecha: new Date(0) };
    let baseDebito = { saldo: 0, fecha: new Date(0) };
    let baseCredito = { saldo: 0, fecha: new Date(0) };

    // 1. Obtener la última línea base para cada tipo de cuenta
    cuentasBase.forEach(cuenta => {
        const nombre = (cuenta.nombre_cuenta || '').toLowerCase();
        const tipo = (cuenta.tipo || '').toLowerCase();
        const saldo = Number(cuenta.saldo_inicial || 0);
        const fecha = cuenta.created_at ? new Date(cuenta.created_at) : new Date(0);

        if (nombre.includes('crédito') || nombre.includes('credito')) {
            if (fecha >= baseCredito.fecha) baseCredito = { saldo, fecha };
        } else if (nombre.includes('débito') || nombre.includes('debito') || tipo === 'tarjeta' || tipo === 'transferencia') {
            if (fecha >= baseDebito.fecha) baseDebito = { saldo, fecha };
        } else if (tipo === 'efectivo' || nombre.includes('efectivo')) {
            if (fecha >= baseEfectivo.fecha) baseEfectivo = { saldo, fecha };
        } else {
            if (fecha >= baseDebito.fecha) baseDebito = { saldo, fecha };
        }
    });

    let efectivo = baseEfectivo.saldo;
    let debito = baseDebito.saldo;
    let credito = baseCredito.saldo;
    let sumaIngresos = 0;
    let sumaGastos = 0;
    
    const transaccionesProcesadas = [];

    transacciones.forEach((t) => {
        const datos = parseDataExtraidos(t.datos_extraidos);
        let tipo = (datos.tipo || 'desconocido').toLowerCase();
        
        const monto = Number(datos.monto || 0);
        const categoria = datos.categoria || 'Sin categoría';
        const descripcion = datos.descripcion || 'Sin descripción';
        const isBanco = t.fuente === 'estado_cuenta' || datos.metodo_pago === 'tarjeta' || datos.metodo_pago === 'transferencia';
        const metodoPago = (datos.metodo_pago || 'desconocido').toLowerCase();
        let fechaTx = new Date(t.created_at || 0);
        if (datos.fecha) {
            const parsedDate = new Date(datos.fecha);
            if (!isNaN(parsedDate.getTime())) {
                // Adjust for local timezone if it's just a YYYY-MM-DD string
                if (datos.fecha.length === 10) {
                    parsedDate.setMinutes(parsedDate.getMinutes() + parsedDate.getTimezoneOffset());
                }
                fechaTx = parsedDate;
            }
        }

        
        const descLower = descripcion.toLowerCase();
        const catLower = categoria.toLowerCase();

        // ==========================================
        // 1. REGLAS DE CLASIFICACIÓN INTELIGENTE
        // ==========================================
        const isComision = descLower.includes('comision') || descLower.includes('comisión') || descLower.includes('iva ') || catLower.includes('comision');
        const isTraspasoPropio = !isComision && (
            catLower.includes('traspaso') || descLower.includes('traspaso') || descLower.includes('transferencia de saldo') || 
            descLower.includes('pago tarjeta') || descLower.includes('pago de tarjeta') || descLower.includes('pago interbancario a tarjeta') ||
            descLower.includes('su abono...gracias') || (descLower.includes('pago de servicio') && descLower.includes('a tb'))
        );
        const isRetiroEfectivo = !isComision && !isTraspasoPropio && (catLower.includes('retiro') || descLower.includes('cajero') || descLower.includes('atm') || descLower.includes('disposicion en efectivo') || descLower.includes('retiro efectivo'));
        const isDepositoEfectivo = !isComision && !isTraspasoPropio && (descLower.includes('deposito en efectivo') || catLower.includes('deposito en efectivo'));
        const isAjusteEfectivo = tipo === 'saldo_inicial' || descLower.includes('efectivo disponible') || descLower.includes('saldo inicial');

        let tipoFinal = 'gasto';

        // Mapeo inteligente de categorías y nombres amigables
        const smartMap = [
            { key: 'uber', cat: 'Transporte', icon: 'car' },
            { key: 'ubrpagos', cat: 'Transporte', icon: 'car' },
            { key: 'didi', cat: 'Transporte', icon: 'car' },
            { key: 'netflix', cat: 'Entretenimiento', icon: 'tv' },
            { key: 'spotify', cat: 'Entretenimiento', icon: 'music' },
            { key: 'c a mexico', cat: 'Ropa', icon: 'shirt' },
            { key: 'c&a', cat: 'Ropa', icon: 'shirt' },
            { key: 'zara', cat: 'Ropa', icon: 'shirt' },
            { key: 'oxxo', cat: 'Supermercado/Oxxo', icon: 'shopping-cart' },
            { key: 'telcel', cat: 'Servicios', icon: 'smartphone' },
            { key: 'cfe', cat: 'Servicios', icon: 'zap' },
            { key: 'amazon', cat: 'Compras Online', icon: 'shopping-bag' },
            { key: 'mercado libre', cat: 'Compras Online', icon: 'shopping-bag' },
            { key: 'walmart', cat: 'Supermercado', icon: 'shopping-cart' },
            { key: 'soriana', cat: 'Supermercado', icon: 'shopping-cart' },
            { key: 'chedraui', cat: 'Supermercado', icon: 'shopping-cart' },
            { key: 'combi', cat: 'Transporte Público', icon: 'bus' },
            { key: 'metro', cat: 'Transporte Público', icon: 'train' }
        ];

        let mappedCategory = null;
        let mappedIcon = null;

        for (const item of smartMap) {
            if (descLower.includes(item.key) || catLower.includes(item.key)) {
                mappedCategory = item.cat;
                mappedIcon = item.icon;
                break;
            }
        }

        // ==========================================
        // 2. APLICAR MATEMÁTICAS AL TIPO
        // ==========================================
        if (isAjusteEfectivo) tipoFinal = 'ajuste_saldo';
        else if (isTraspasoPropio) tipoFinal = 'traspaso';
        else if (isRetiroEfectivo) tipoFinal = 'transferencia';
        else if (isDepositoEfectivo) tipoFinal = 'transferencia';
        else if (isComision || ['cargo', 'egreso', 'gasto', 'retiro'].includes(tipo) || (tipo === 'transferencia' && !isTraspasoPropio)) {
            tipoFinal = 'gasto';
            sumaGastos += monto;
        } else if (['abono', 'deposito', 'depósito', 'ingreso'].includes(tipo)) {
            tipoFinal = 'ingreso';
            sumaIngresos += monto;
        } else {
            tipoFinal = 'gasto';
            sumaGastos += monto;
        }

        // ==========================================
        // 3. ACTUALIZAR SALDOS BASE SOLO SI SON NUEVOS
        // ==========================================
        // Averiguar a qué cuenta pertenece la transacción
        let targetAccount = 'debito'; // por defecto
        let cutoffDate = baseDebito.fecha;
        
        if (metodoPago === 'efectivo' || !isBanco) {
            targetAccount = 'efectivo';
            cutoffDate = baseEfectivo.fecha;
        } else if (metodoPago === 'tarjeta' && (descLower.includes('crédito') || descLower.includes('credito'))) {
            // Es muy raro que la transacción sepa que es crédito, pero por si acaso.
            targetAccount = 'credito';
            cutoffDate = baseCredito.fecha;
        } else {
            // Asumimos que la tarjeta es débito para los gastos diarios, a menos que sea el pago de la tarjeta de credito.
            targetAccount = 'debito';
            cutoffDate = baseDebito.fecha;
        }

        // Si la transacción ocurrió DESPUÉS de la última vez que declaramos el saldo base, la sumamos/restamos
        if (fechaTx > cutoffDate) {
            if (tipoFinal === 'ingreso' || tipoFinal === 'ajuste_saldo') {
                if (targetAccount === 'efectivo') efectivo += monto;
                else if (targetAccount === 'credito') credito += monto; // Pagar deuda
                else debito += monto;
            } else if (tipoFinal === 'gasto') {
                if (targetAccount === 'efectivo') efectivo -= monto;
                else if (targetAccount === 'credito') credito -= monto; // Aumentar deuda
                else debito -= monto;
            } else if (tipoFinal === 'transferencia') {
                if (isRetiroEfectivo) {
                    if (fechaTx > baseEfectivo.fecha) efectivo += monto;
                    if (fechaTx > baseDebito.fecha) debito -= monto;
                } else if (isDepositoEfectivo) {
                    if (fechaTx > baseEfectivo.fecha) efectivo -= monto;
                    if (fechaTx > baseDebito.fecha) debito += monto;
                }
            }
        }

        // ==========================================
        // 4. PREPARAR METADATA VISUAL (Decoradores)
        // ==========================================
        let iconName = 'shopping-bag';
        if (mappedIcon) {
            iconName = mappedIcon;
        } else if (catLower.includes('transporte') || catLower.includes('gasolin')) {
            iconName = 'fuel';
        } else if (catLower.includes('comida') || catLower.includes('restaurante')) {
            iconName = 'utensils';
        } else if (catLower.includes('super')) {
            iconName = 'shopping-cart';
        } else if (catLower.includes('entretenimiento') || catLower.includes('netflix')) {
            iconName = 'tv';
        } else if (tipoFinal === 'ingreso') {
            iconName = 'arrow-down-to-line';
        } else if (tipoFinal === 'transferencia' || tipoFinal === 'traspaso') {
            iconName = 'arrow-right-left';
        } else if (tipoFinal === 'ajuste_saldo') {
            iconName = 'wallet';
        }

        const isPositive = tipoFinal === 'ingreso' || tipoFinal === 'ajuste_saldo';
        const colorClass = isPositive ? 'text-emerald' : (tipoFinal === 'gasto' ? 'text-textMain' : 'text-textMuted');
        const sign = tipoFinal === 'gasto' ? '-' : (tipoFinal === 'ingreso' ? '+' : '');
        
        const badgeFuente = isBanco ? 'Bancario' : 'Efectivo';
        const fechaParaMostrar = formatDate(datos.fecha || t.created_at);
        const montoFormateado = formatCurrency(monto);
        
        // Final category logic: if mappedCategory exists, use it. Else fall back to original category
        let categoryDisplay = mappedCategory || categoria;

        transaccionesProcesadas.push({
            id: t.id,
            descripcion,
            categoria: categoryDisplay,
            iconName,
            colorClass,
            sign,
            badgeFuente,
            fechaParaMostrar,
            fechaOriginal: fechaTx,
            montoFormateado,
            montoBruto: monto,
            datos_extraidos: datos,
            fuente: t.fuente
        });
    });

    // Patrimonio Total = Débito + Efectivo + Crédito (El crédito ya viene en negativo o se considera deuda)
    // Nos aseguramos de sumar los saldos (si credito es positivo es a favor, si es negativo es en contra).
    const patrimonio = debito + efectivo + credito;

    return {
        totales: {
            credito,
            debito,
            efectivo,
            sumaIngresos,
            sumaGastos,
            patrimonio
        },
        transaccionesProcesadas
    };
}