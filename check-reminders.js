// api/check-reminders.js
// Este endpoint NO lo llama la app: lo llama un servicio externo de
// "cron" (tarea programada) cada pocos minutos — ver README para cómo
// configurarlo gratis. Es el único sitio donde se envían notificaciones
// push de verdad (las que llegan aunque la app esté cerrada).
//
// Qué hace en cada ejecución:
//   1. Busca notas con recordatorio dentro de la próxima hora que aún
//      no se hayan notificado ("alerted = false").
//   2. Por cada una, envía una notificación push a todos los
//      dispositivos suscritos.
//   3. Marca la nota como "alerted = true" para no repetir el aviso.

import { neon } from '@neondatabase/serverless';
import webpush from 'web-push';

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const sql = neon(connectionString);

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  // Protección: solo quien conozca el secreto puede disparar esto.
  // Evita que cualquiera en internet spamee notificaciones a tus usuarios.
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  if (!process.env.REMINDER_CRON_SECRET || secret !== process.env.REMINDER_CRON_SECRET) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  if (!connectionString) {
    return res.status(500).json({ error: 'La base de datos no está conectada.' });
  }
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return res.status(500).json({ error: 'Faltan las claves VAPID en las variables de entorno.' });
  }

  try {
    const now = Date.now();

    // Notas cuyo recordatorio cae dentro de la próxima hora y todavía no se avisaron
    const dueNotes = await sql`
      SELECT * FROM notes
      WHERE alerted = false
        AND reminder IS NOT NULL
        AND reminder > now()
        AND reminder <= now() + interval '1 hour';
    `;

    if (dueNotes.length === 0) {
      return res.status(200).json({ sent: 0, message: 'Nada pendiente de avisar' });
    }

    const subscriptions = await sql`SELECT * FROM push_subscriptions;`;

    let sentCount = 0;

    for (const note of dueNotes) {
      const minutes = Math.max(1, Math.round((new Date(note.reminder).getTime() - now) / 60000));
      const when = minutes >= 60 ? '1 hora' : `${minutes} min`;
      const label = note.title || note.content.slice(0, 60);

      const payload = JSON.stringify({
        title: '⏰ Recordatorio próximo',
        body: `"${label}" vence en aproximadamente ${when}.`,
      });

      await Promise.all(
        subscriptions.map(async (sub) => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            );
          } catch (err) {
            // 404/410 = ese dispositivo ya no existe (desinstaló la app, etc.): lo limpiamos.
            if (err.statusCode === 404 || err.statusCode === 410) {
              await sql`DELETE FROM push_subscriptions WHERE endpoint = ${sub.endpoint};`;
            } else {
              console.error('Error enviando push a un dispositivo:', err);
            }
          }
        })
      );

      await sql`UPDATE notes SET alerted = true WHERE id = ${note.id};`;
      sentCount++;
    }

    return res.status(200).json({ sent: sentCount, subscriptions: subscriptions.length });
  } catch (err) {
    console.error('Error en /api/check-reminders:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
