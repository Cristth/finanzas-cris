/**
 * ========================================================================
 * ARCHIVO: utils.js
 * PROPÓSITO: Este archivo funciona como una caja de herramientas (helpers).
 * Contiene funciones puras que toman un valor, lo procesan y devuelven un 
 * resultado. No interactúa con el HTML (DOM) ni con la base de datos, 
 * lo que hace que estas funciones sean reutilizables en cualquier parte 
 * del proyecto.
 * ========================================================================
 */

/**
 * Función: formatCurrency
 * Descripción: Convierte un número en formato de moneda (ej. $ 1,500.00).
 * @param {number|string} amount - El monto o cantidad a formatear (puede ser número o cadena).
 * @returns {string} - El monto formateado como moneda en formato USD.
 */
function formatCurrency(amount) {
    // Aseguramos que el valor sea un número antes de formatearlo
    const numericValue = Number(amount);
    
    // Si no es un número válido, devolvemos un valor por defecto
    if (isNaN(numericValue)) {
        return '$0.00';
    }

    // Usamos la API nativa Intl.NumberFormat para formatear correctamente la moneda
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(numericValue);
}

/**
 * Función: formatDate
 * Descripción: Toma una fecha (ISO o YYYY-MM-DD) y la convierte en legible.
 * @param {string} dateString - La cadena de texto que representa la fecha.
 * @returns {string} - La fecha formateada de manera amigable.
 */
function formatDate(dateString) {
    if (!dateString) return 'Fecha desconocida';

    let date;
    const str = dateString.trim();

    // Manejar formato "YYYY-MM-DD" estricto para evitar desfases de zona horaria (UTC)
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        const [year, month, day] = str.split('-');
        date = new Date(year, month - 1, day);
    } 
    // Manejar formato "YYYY-MM-DD HH:MM"
    else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(str)) {
        const parts = str.split(' ');
        const [year, month, day] = parts[0].split('-');
        const [hour, minute] = parts[1].split(':');
        date = new Date(year, month - 1, day, hour, minute);
    } 
    else {
        // Fallback para fechas ISO (ej. created_at de Supabase)
        date = new Date(dateString);
    }
    
    // Si la fecha es inválida, devolvemos un texto seguro
    if (isNaN(date.getTime())) {
        return 'Fecha inválida';
    }

    // Formateamos usando la API nativa Intl.DateTimeFormat
    return new Intl.DateTimeFormat('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

/**
 * Función: parseDataExtraidos
 * Descripción: La base de datos puede devolver la columna 'datos_extraidos' como
 * un objeto JSON ya evaluado, o como una cadena de texto (string). Esta función 
 * se asegura de devolver siempre un objeto JavaScript válido.
 * @param {any} rawData - El dato crudo proveniente de la base de datos.
 * @returns {object} - Un objeto de JavaScript garantizado (o un objeto vacío si falla).
 */
function parseDataExtraidos(rawData) {
    // Si no hay datos, devolvemos un objeto vacío para evitar errores de undefined
    if (!rawData) {
        return {};
    }

    // Si ya es un objeto (y no es un array ni null), lo devolvemos tal cual
    if (typeof rawData === 'object') {
        return rawData;
    }

    // Si es un string, intentamos parsearlo
    if (typeof rawData === 'string') {
        try {
            return JSON.parse(rawData);
        } catch (error) {
            console.error('Error al parsear datos_extraidos:', error);
            // Si el parseo falla, devolvemos un objeto con el error como descripción
            return { error: 'Formato JSON inválido', crudo: rawData };
        }
    }

    // En cualquier otro caso extraño, devolvemos objeto vacío
    return {};
}