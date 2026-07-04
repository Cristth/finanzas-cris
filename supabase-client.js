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