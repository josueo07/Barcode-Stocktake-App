# Cómo trabajar en el proyecto

## Requisitos

Node 20 y npm. Todo se instala desde la raíz con `npm install`.

## Comandos

| Para | Comando (desde la raíz) |
| --- | --- |
| Correr en desarrollo | `npm run dev` |
| Revisar estilo | `npm run lint` |
| Revisar tipos | `npm run typecheck` |
| Pruebas | `npm test` |
| Compilar | `npm run build` |
| Crear la base en producción | `npm run db:migrate:prod -w server` |
| Crear un usuario | `STOCKTAKE_PIN=… npm run user:create:prod -w server -- --username ana --name "Ana Rivera" --role supervisor` |

Variables del servidor: ver `.env.example` (`PORT`, `DATABASE_PATH`, `CLIENT_ORIGIN`,
`STORE_TIMEZONE`).

## Cómo subir cambios

1. Crea una rama desde la última (`master` o la rama del PR abierto en el que se apila).
2. Haz el cambio con pruebas.
3. **Actualiza `contexto/ESTADO.md`** (y `DECISIONES.md` si decidiste algo).
4. Corre `npm run lint && npm run typecheck && npm test`.
5. Abre un PR. El CI revisa todo, incluido que `contexto/` esté al día.

## Estructura

- `client/`: app web (React + Vite), la que se usa en el iPhone.
- `server/`: API (Express + Socket.IO + SQLite con Drizzle).
- `shared/`: tipos que usan los dos.
- `contexto/`: esta carpeta.
- `docs/`: documentación técnica original del proyecto base (en inglés).
