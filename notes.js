// api/notes.js
// Endpoint serverless de Vercel para la Pizarra de notas.
// Usa Vercel Postgres (@vercel/postgres). Las credenciales se inyectan
// automáticamente como variables de entorno cuando conectas la base
// de datos a tu proyecto desde el dashboard de Vercel (Storage → Postgres).

import { sql } from '@vercel/postgres';
import { randomUUID } from 'crypto';

// Crea la tabla si aún no existe. Es barato gracias a "IF NOT EXISTS",
// así que la llamamos al inicio de cada petición y nos olvidamos de
// tener que ejecutar migraciones a mano.
async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      reminder TIMESTAMPTZ,
      color TEXT DEFAULT 'y',
      alerted BOOLEAN DEFAULT false
    );
  `;
}

// Convierte una fila de Postgres (snake_case) al formato que espera el frontend.
function rowToNote(row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
    reminder: row.reminder,
    color: row.color,
    alerted: row.alerted,
  };
}

export default async function handler(req, res) {
  try {
    await ensureTable();
    const { method, query, body } = req;
    const id = query.id;

    // --- LISTAR TODAS LAS NOTAS ---------------------------------------
    if (method === 'GET') {
      const { rows } = await sql`SELECT * FROM notes ORDER BY created_at DESC`;
      return res.status(200).json(rows.map(rowToNote));
    }

    // --- CREAR NOTA ------------------------------------------------------
    if (method === 'POST') {
      const { title, content, reminder, color } = body || {};
      if (!content || !content.trim()) {
        return res.status(400).json({ error: 'El contenido es obligatorio' });
      }
      const newId = randomUUID();
      const { rows } = await sql`
        INSERT INTO notes (id, title, content, reminder, color, alerted)
        VALUES (${newId}, ${title || null}, ${content}, ${reminder || null}, ${color || 'y'}, false)
        RETURNING *;
      `;
      return res.status(201).json(rowToNote(rows[0]));
    }

    // --- ACTUALIZAR NOTA (edición completa o solo el flag "alerted") -----
    if (method === 'PUT') {
      if (!id) return res.status(400).json({ error: 'Falta el id de la nota' });

      // Actualización ligera: el bucle de recordatorios solo necesita
      // marcar la nota como "ya notificada", sin reenviar todo el resto.
      const keys = Object.keys(body || {});
      if (keys.length === 1 && keys[0] === 'alerted') {
        const { rows } = await sql`
          UPDATE notes SET alerted = ${body.alerted} WHERE id = ${id} RETURNING *;
        `;
        if (rows.length === 0) return res.status(404).json({ error: 'Nota no encontrada' });
        return res.status(200).json(rowToNote(rows[0]));
      }

      // Actualización completa: la que dispara el formulario de edición.
      const { title, content, reminder, color, alerted } = body || {};
      if (!content || !content.trim()) {
        return res.status(400).json({ error: 'El contenido es obligatorio' });
      }
      const { rows } = await sql`
        UPDATE notes SET
          title = ${title || null},
          content = ${content},
          reminder = ${reminder || null},
          color = ${color || 'y'},
          alerted = ${alerted ?? false}
        WHERE id = ${id}
        RETURNING *;
      `;
      if (rows.length === 0) return res.status(404).json({ error: 'Nota no encontrada' });
      return res.status(200).json(rowToNote(rows[0]));
    }

    // --- ELIMINAR NOTA -----------------------------------------------
    if (method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'Falta el id de la nota' });
      await sql`DELETE FROM notes WHERE id = ${id};`;
      return res.status(204).end();
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    return res.status(405).json({ error: `Método ${method} no permitido` });
  } catch (err) {
    console.error('Error en /api/notes:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
