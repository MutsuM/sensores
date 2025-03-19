const express = require('express');
require('dotenv').config();
const moment = require('moment-timezone');
const { Pool } = require('pg');
const exceljs = require('exceljs');
const cors = require('cors'); // Importar el paquete cors
const app = express();
const port = process.env.PORT || 4100;

// Configuración de PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
});

app.use(cors()); // Habilitar CORS para todas las rutas
app.use(express.json());

// Ruta para recibir los datos de Home Assistant y guardarlos en PostgreSQL
app.post('/guardarsingle', async (req, res) => {
  try {
    const { sensor_id, valor } = req.body;
    if (!sensor_id || !valor ) {
      return res.status(400).json({ error: 'Faltan datos' });
    }

    const fechaHora = moment().tz('America/Lima').format('YYYY-MM-DD HH:mm:ss');

    // Guardar en la base de datos en el esquema IOT
    const query = 'INSERT INTO "public".sensores (sensor_id, valor, fecha_hora) VALUES ($1, $2, $3)';
    await pool.query(query, [sensor_id, valor, fechaHora]);

    console.log(`Sensor ID: ${sensor_id}, Valor: ${valor}, Fecha y Hora: ${fechaHora}`);
    res.json({ message: 'Datos guardados correctamente' });
  } catch (err) {
    console.error('Error procesando datos:', err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

app.post('/guardar', async (req, res) => {
  try {
    const datos = req.body;
    if (!Array.isArray(datos) || datos.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de datos' });
    }

    const fechaHora = moment().tz('America/Lima').format('YYYY-MM-DD HH:mm:ss');
    const query = 'INSERT INTO "public".sensores (sensor_id, valor, fecha_hora) VALUES ($1, $2, $3)';

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const { sensor_id, valor } of datos) {
        if (!sensor_id || valor === undefined) {
          return res.status(400).json({ error: 'Faltan datos en algunos registros' });
        }
        await client.query(query, [sensor_id, valor, fechaHora]);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    console.log(`Datos guardados correctamente para ${datos.length} registros.`);
    res.json({ message: 'Datos guardados correctamente' });
  } catch (err) {
    console.error('Error procesando datos:', err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});


// ... (resto de tus imports y configuración)

// ... (resto de tus imports y configuración)

app.post('/reporte-temperatura2', async (req, res) => {
  const { horaInicio1, horaFin1, horaInicio2, horaFin2 } = req.body;

  try {
    const query = `
      SELECT 
        DATE(fecha_hora) AS fecha,
        EXTRACT(HOUR FROM fecha_hora) AS hora,
        EXTRACT(MINUTE FROM fecha_hora) AS minuto,
        valor,
        ROW_NUMBER() OVER(ORDER BY fecha_hora) AS rn
      FROM "public".sensores
      WHERE fecha_hora BETWEEN $1 AND $2
      ORDER BY fecha_hora
      LIMIT 1;
    `;
    const values1 = [horaInicio1, horaFin1];
    const values2 = [horaInicio2, horaFin2];

    const result1 = await pool.query(query, values1);
    const result2 = await pool.query(query, values2);
    const data = [...result1.rows, ...result2.rows];

    const workbook = new exceljs.Workbook();
    const worksheet = workbook.addWorksheet('Reporte de Temperatura');

    // Encabezados
    worksheet.addRow(['Fecha', 'Hora', 'Temperatura']);

    // Datos
    data.forEach(row => {
      worksheet.addRow([row.fecha, `Hora: ${row.hora}:${row.minuto}`, row.valor]);
    });

    const excelBuffer = await workbook.xlsx.writeBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=reporte-temperatura.xlsx');
    res.send(excelBuffer);

  } catch (error) {
    console.error('Error al generar el reporte:', error);
    res.status(500).json({ error: 'Error al generar el reporte.' });
  }
});









app.post('/reporte-temperatura', async (req, res) => {
  const { fechaInicio, fechaFin } = req.body;

  try {
    const query = `
      SELECT fecha, turno, hora, valor FROM (
        SELECT 
          DATE(fecha_hora) AS fecha,
          CASE 
            WHEN EXTRACT(HOUR FROM fecha_hora) BETWEEN 8 AND 10 THEN 'M'
            WHEN EXTRACT(HOUR FROM fecha_hora) BETWEEN 15 AND 17 THEN 'T'
          END AS turno,
          TO_CHAR(fecha_hora, 'HH24:MI') AS hora,
          valor,
          ROW_NUMBER() OVER(PARTITION BY DATE(fecha_hora), 
                                       CASE 
                                         WHEN EXTRACT(HOUR FROM fecha_hora) BETWEEN 8 AND 10 THEN 'M' 
                                         ELSE 'T' 
                                       END 
                          ORDER BY fecha_hora) AS rn
        FROM "public".sensores
        WHERE fecha_hora BETWEEN $1 AND $2
      ) t
      WHERE rn = 1
      ORDER BY fecha, turno;
    `;

    const values = [fechaInicio, fechaFin];
    const result = await pool.query(query, values);
    const data = result.rows;

    // Crear archivo Excel
    const workbook = new exceljs.Workbook();
    const worksheet = workbook.addWorksheet('Reporte de Temperatura');

    // Encabezados
    worksheet.addRow(['Fecha', 'Turno', 'Hora', 'Temperatura']);

    // Agregar datos
    data.forEach(row => {
      worksheet.addRow([
        row.fecha,
        row.turno,
        `Hora: ${row.hora}`,
        row.valor
      ]);
    });

    // Enviar archivo
    const excelBuffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=reporte-temperatura.xlsx');
    res.send(excelBuffer);

  } catch (error) {
    console.error('Error al generar el reporte:', error);
    res.status(500).json({ error: 'Error al generar el reporte.' });
  }
});



// ... (resto de tu código)

// ... (resto de tu código)

app.listen(port, () => {
  console.log(`API escuchando en http://localhost:${port}`);
});