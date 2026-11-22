# Contexto del proyecto: Inventario J&R

Esta carpeta es la memoria compartida del proyecto. La leen y la mantienen al día
**Claude, Codex y cualquier persona** que trabaje en el repositorio, para que todos sepan
qué está hecho, qué falta y por qué se decidió cada cosa.

| Archivo | Qué tiene | Quién lo actualiza |
| --- | --- | --- |
| [ESTADO.md](ESTADO.md) | Qué está construido y qué falta, en orden | Quien haga el cambio, en el mismo PR |
| [DECISIONES.md](DECISIONES.md) | Decisiones tomadas y su razón | Quien tome una decisión nueva |
| [COMO-TRABAJAR.md](COMO-TRABAJAR.md) | Cómo correr, probar y subir cambios | Quien cambie el flujo de trabajo |
| [HISTORIAL.md](HISTORIAL.md) | Lista de cambios que entraron a `master` | **Automático** (GitHub Actions) |

## Reglas

1. Antes de empezar, lee `ESTADO.md` y `DECISIONES.md`.
2. Todo PR que cambie código en `client/`, `server/` o `shared/` **debe** actualizar
   `contexto/ESTADO.md`. La revisión automática de GitHub (CI) falla si no lo hace.
3. `HISTORIAL.md` no se edita a mano: se llena solo cada vez que algo entra a `master`.
4. Escribe en español, frases cortas, sin jerga innecesaria. Josue es quien decide.
