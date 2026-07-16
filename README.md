# La Pizarra — notas adhesivas (online, con base de datos)

Frontend estático (`index.html`) + una función serverless (`api/notes.js`)
que guarda las notas en una base de datos **Postgres** (Vercel Postgres,
sobre Neon). No hace falta Node, Express ni servidor propio: todo corre
en la infraestructura de Vercel.

## Estructura del proyecto

```
pizarra-notas/
├── index.html        ← Frontend (HTML + CSS + JS, un solo archivo)
├── api/
│   └── notes.js       ← Backend serverless (GET/POST/PUT/DELETE)
├── package.json        ← Dependencia: @vercel/postgres
└── .gitignore
```

## 1. Sube el proyecto a GitHub

```bash
git init
git add .
git commit -m "Pizarra de notas"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/pizarra-notas.git
git push -u origin main
```

## 2. Importa el proyecto en Vercel

1. Entra en [vercel.com](https://vercel.com) e inicia sesión con GitHub.
2. **Add New… → Project** y selecciona el repositorio `pizarra-notas`.
3. Framework Preset: déjalo en **Other** (no hace falta ninguno especial:
   Vercel sirve `index.html` como estático y `api/notes.js` como función
   serverless automáticamente).
4. Pulsa **Deploy**. La primera vez fallará al llamar a la API porque
   aún no hay base de datos conectada — es normal, se arregla en el
   siguiente paso.

## 3. Crea y conecta la base de datos Postgres

1. Dentro del proyecto en Vercel, ve a la pestaña **Storage**.
2. **Create Database → Postgres** (está construido sobre Neon; el plan
   gratuito es suficiente para esta app).
3. Cuando te lo pida, **conecta la base de datos a tu proyecto**. Esto
   añade automáticamente las variables de entorno (`POSTGRES_URL`, etc.)
   que usa `@vercel/postgres` — no tienes que copiarlas a mano.
4. Ve a **Deployments** y haz **Redeploy** del último despliegue para que
   tome las nuevas variables de entorno.

No necesitas ejecutar ningún script SQL: la función `api/notes.js` crea
la tabla `notes` sola la primera vez que se llama (`CREATE TABLE IF NOT
EXISTS`).

## 4. Listo

Abre la URL que te da Vercel (algo como `pizarra-notas.vercel.app`).
Las notas que crees se guardan en Postgres y estarán disponibles desde
cualquier dispositivo que abra esa URL.

⚠️ Ten en cuenta que, tal como está, **el tablero es compartido por
cualquiera que visite la URL** (no hay login de usuarios). Si más
adelante quieres notas privadas por usuario, se puede añadir
autenticación (por ejemplo con NextAuth o Clerk) y una columna
`user_id` en la tabla — dímelo y te ayudo con ese siguiente paso.

## Probarlo en local (opcional)

```bash
npm install -g vercel      # si no lo tienes
vercel link                # vincula esta carpeta a tu proyecto de Vercel
vercel env pull .env.local # descarga las variables de entorno de Postgres
npm install
vercel dev                 # levanta index.html + api/notes.js en localhost
```
