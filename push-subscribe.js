// api/push-subscribe.js
// Guarda (o borra) la "suscripción push" de un dispositivo: el conjunto de
// datos que identifica a ESE navegador/teléfono concreto para poder
// enviarle una notificación aunque la app esté cerrada.

import { neon } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const sql = neon(connectionString);

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      endpoint TEXT PRIMARY KEY,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
}

export default async function handler(req, res) {
  if (!connectionString) {
    return res.status(500).json({ error: 'La base de datos no está conectada.' });
  }

  try {
    await ensureTable();

    if (req.method === 'POST') {
      const { endpoint, keys } = req.body || {};
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({ error: 'Suscripción push inválida' });
      }
      // "upsert": si ese dispositivo ya estaba guardado, actualiza sus claves.
      await sql`
        INSERT INTO push_subscriptions (endpoint, p256dh, auth)
        VALUES (${endpoint}, ${keys.p256dh}, ${keys.auth})
        ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth;
      `;
      return res.status(201).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { endpoint } = req.body || {};
      if (!endpoint) return res.status(400).json({ error: 'Falta el endpoint' });
      await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint};`;
      return res.status(204).end();
    }

    res.setHeader('Allow', ['POST', 'DELETE']);
    return res.status(405).json({ error: `Método ${req.method} no permitido` });
  } catch (err) {
    console.error('Error en /api/push-subscribe:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
