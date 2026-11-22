# Instrucciones para agentes (Codex, Claude y otros)

Antes de trabajar, lee la carpeta [`contexto/`](contexto/README.md):
`ESTADO.md` (qué está hecho y qué falta) y `DECISIONES.md` (por qué).

Reglas:
- Todo cambio en `client/`, `server/` o `shared/` actualiza `contexto/ESTADO.md` en el
  mismo PR. El CI falla si no.
- Si tomas una decisión de diseño, añádela arriba en `contexto/DECISIONES.md`.
- No edites `contexto/HISTORIAL.md`: se actualiza solo.
- Antes de subir: `npm run lint && npm run typecheck && npm test`.
- Escribe al usuario en español. La interfaz de la app es en español.
