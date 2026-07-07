/**
 * ========================================================================
 * ARCHIVO: supabase-client.js
 * PROPÓSITO: Este archivo se encarga única y exclusivamente de la conexión
 * con la base de datos Supabase. Aquí inicializamos el cliente y definimos
 * todas las funciones que interactúan con la base de datos (SELECT, INSERT, etc.).
 * No contiene lógica de manipulación del HTML (DOM) para mantener todo modular.
 * ========================================================================
 */

// 1. Configuración de credenciales
// Reemplaza estas variables con tus credenciales reales de Supabase si cambian
const SUPABASE_URL = 'https://wnaztedjpirxtvvalzln.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduYXp0ZWRqcGlyeHR2dmFsemxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NzU5MzQsImV4cCI6MjA5ODE1MTkzNH0.FEtkOYgrTUwcV6agrx6aHf--160FOthrmvKrta3umUk';

// 2. Inicialización del cliente de Supabase
// Asegúrate de haber importado el script de Supabase en index.html antes de este archivo
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Verifica si hay una sesión activa.
 */
async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session;
}

/**
 * Inicia sesión con email y contraseña.
 */
async function signIn(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });
    if (error) throw error;
    return data;
}

/**
 * Cierra sesión.
 */
async function signOut() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
}

/**
 * Función: fetchTransacciones
 * Descripción: Realiza una consulta (SELECT) a la tabla 'transacciones_temporales'
 * para obtener todos los registros ordenados por fecha de creación de forma descendente.
 * @returns {Promise<Array>} - Una promesa que resuelve en un arreglo de transacciones.
 */
async function fetchTransacciones() {
    try {
        const { data, error } = await supabaseClient
            .from('transacciones_temporales')
            .select('*')
            .neq('fuente', 'lock')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error al obtener transacciones de Supabase:', error);
            return []; // Devolvemos un arreglo vacío en caso de error para no romper la UI
        }

        return data || [];
    } catch (err) {
        console.error('Error inesperado en fetchTransacciones:', err);
        return [];
    }
}

/**
 * Función: fetchEstadosDeCuenta
 * Descripción: Realiza una consulta a la tabla 'estados_de_cuenta'
 * para obtener los documentos procesados por Gemini.
 * @returns {Promise<Array>} - Una promesa que resuelve en un arreglo de estados de cuenta.
 */
async function fetchEstadosDeCuenta() {
    try {
        const { data, error } = await supabaseClient
            .from('estados_de_cuenta')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error al obtener estados de cuenta:', error);
            return [];
        }

        return data || [];
    } catch (err) {
        console.error('Error inesperado en fetchEstadosDeCuenta:', err);
        return [];
    }
}



/**
 * Función: fetchCuentasBase
 * Descripción: Obtiene los saldos base registrados por el usuario.
 * @returns {Promise<Array>} - Una promesa que resuelve en un arreglo de cuentas base.
 */
async function fetchCuentasBase() {
    try {
        const { data, error } = await supabaseClient
            .from('cuentas_base')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error al obtener cuentas base:', error);
            return [];
        }

        return data || [];
    } catch (err) {
        console.error('Error inesperado en fetchCuentasBase:', err);
        return [];
    }
}

/**
 * Función: fetchGeminiAdvice
 * Descripción: Realiza la llamada a la Edge Function 'financial-advisor' en Supabase.
 * @param {string} ingresos 
 * @param {string} gastos 
 * @param {string} bancos 
 * @param {string} efectivo 
 * @param {Array} estadosDeCuenta 
 * @returns {Promise<Object>} - El consejo generado por la IA
 */
async function fetchGeminiAdvice(ingresos, gastos, bancos, efectivo, estadosDeCuenta) {
    try {
        const { data, error } = await supabaseClient.functions.invoke('financial-advisor', {
            body: JSON.stringify({ ingresos, gastos, bancos, efectivo, estadosDeCuenta })
        });
        
        if (error) {
            console.error('Error al obtener consejo de Gemini:', error);
            throw error;
        }
        
        return data;
    } catch (err) {
        console.error('Error inesperado en fetchGeminiAdvice:', err);
        throw err;
    }
}

/**
 * Actualiza los datos_extraidos de una transacción temporal.
 */
async function updateTransaccionManual(id, nuevosDatos) {
    try {
        // Obtenemos los datos actuales para no sobrescribir info extra
        const { data: current, error: fetchErr } = await supabaseClient
            .from('transacciones_temporales')
            .select('datos_extraidos')
            .eq('id', id)
            .single();
            
        if (fetchErr) throw fetchErr;

        const updatedDatos = { ...current.datos_extraidos, ...nuevosDatos };

        const { data, error } = await supabaseClient
            .from('transacciones_temporales')
            .update({ datos_extraidos: updatedDatos })
            .eq('id', id)
            .select();

        if (error) {
            console.error('Error updating transaccion:', error);
            throw error;
        }
        return data;
    } catch (error) {
        console.error('Error en updateTransaccionManual:', error);
        return null;
    }
}

/**
 * Elimina una transacción temporal.
 */
async function deleteTransaccionManual(id) {
    try {
        const { error } = await supabaseClient
            .from('transacciones_temporales')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting transaccion:', error);
            throw error;
        }
        return true;
    } catch (error) {
        console.error('Error en deleteTransaccionManual:', error);
        throw error;
    }
}