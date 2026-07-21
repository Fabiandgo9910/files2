# Notificaciones push reales (Android, Windows, iOS)

Esto hace que llegue un aviso a la bandeja de notificaciones del sistema
**aunque la app esté cerrada**. Es distinto de las alertas que ya tenía
la app (esas solo funcionan con la pestaña abierta). Requiere 3 cosas
nuevas: unas claves de seguridad (VAPID), una base de datos de
"dispositivos suscritos", y algo que compruebe los recordatorios cada
pocos minutos aunque nadie tenga la app abierta.

## 1. Variables de entorno nuevas en Vercel

Ve a tu proyecto en Vercel → **Settings → Environment Variables** y añade
estas 4 (marca "Production", "Preview" y "Development" en las tres):

| Nombre | Valor |
|---|---|
| `VAPID_PUBLIC_KEY` | `BAIkgAYeg6HZow03b2alZR7mdhYTi7yn89XMPm3aPOKtsUNLPPNMs9_1mdR8jKENBwE9gnzHqdbK6v8qCyPKuWo` |
| `VAPID_PRIVATE_KEY` | `7xm7lFS2g5rOLNkYOc77ev0loyAyLPCoo5uQUV-Q7Oc` |
| `VAPID_SUBJECT` | `mailto:tu-correo@ejemplo.com` (cualquier email tuyo, es solo un dato de contacto que exige el estándar) |
| `REMINDER_CRON_SECRET` | Invéntate una contraseña larga y aleatoria, por ejemplo `p1z4rr4-cron-8f3k2m9x` |

⚠️ La clave **pública** ya está también escrita directamente en
`index.html` (es pública a propósito, no pasa nada). La clave
**privada** solo debe vivir en esta variable de entorno — nunca la
pongas en el código del frontend.

Estas claves ya están generadas y listas para usar. Si en algún momento
quieres generar tu propio par (por ejemplo, si sospechas que se han
filtrado), hazlo con:
```bash
npx web-push generate-vapid-keys
```

Después de añadir las variables, haz **Redeploy** del proyecto para que
las tome.

## 2. Configura el "cron" externo (gratis, sin instalar nada)

Vercel Hobby (el plan gratis) solo permite tareas programadas una vez
al día, lo cual es demasiado lento para recordatorios. La solución
gratuita más simple es un servicio externo que llame a tu API cada
pocos minutos:

1. Entra en **[cron-job.org](https://cron-job.org)** y crea una cuenta gratuita.
2. **Create cronjob**:
   - **URL**: `https://TU-APP.vercel.app/api/check-reminders?secret=TU_REMINDER_CRON_SECRET`
     (usa el mismo valor que pusiste en `REMINDER_CRON_SECRET`)
   - **Schedule**: cada 5 minutos.
3. Guarda. Cron-job.org llamará a tu endpoint cada 5 minutos; si hay
   alguna nota que vence dentro de la próxima hora y no se ha avisado
   todavía, se les envía la notificación a todos los dispositivos
   suscritos.

No hace falta tocar nada del código para esto — es solo configuración
en la web de cron-job.org.

## 3. Actívalo en cada dispositivo

La primera vez que cada persona abra la app, el navegador le pedirá
permiso para enviar notificaciones. Si lo acepta, ese dispositivo queda
suscrito automáticamente (no hay que tocar ningún botón aparte).

## Particularidades por plataforma

- **Android (Chrome) y Windows (Chrome/Edge)**: funciona igual que
  cualquier app — llega la notificación al sistema aunque el
  navegador esté cerrado.
- **iOS (iPhone/iPad)**: Apple solo permite las notificaciones push si
  la web está **añadida a la pantalla de inicio** (Compartir → "Añadir
  a pantalla de inicio") y con iOS 16.4 o superior. Si se abre desde
  Safari normal, sin haberla instalado antes, no pedirá permiso ni
  funcionará — es una restricción de Apple, no de esta app.
- El aviso "en pantalla" (toast/sonido/voz) que ya tenía la app **sigue
  funcionando igual** mientras la tenga abierta; el push es un aviso
  adicional para cuando está cerrada.

## Probarlo rápido

1. Crea una nota con el recordatorio para dentro de 10-15 minutos.
2. Cierra la app por completo (o pon el móvil en modo avión y vuelve a
   activar los datos, para forzar que no esté "abierta" en primer plano).
3. Espera a que pase el cron (cada 5 min) y a que falte 1 hora o
   menos... si quieres probarlo YA sin esperar a que falte 1 hora
   exacta, pon el recordatorio dentro de 5-10 minutos: como está dentro
   de la próxima hora, el primer cron que pase después de crear la nota
   ya la detectará y enviará el push.
4. Si no llega nada, revisa los logs de `api/check-reminders` en el
   dashboard de Vercel — ahí verás si el problema es de VAPID, de la
   base de datos, o de que no hay ningún dispositivo suscrito todavía.
