# Piloto privado de Inventario J&R en Contabo

Desplegado y verificado el 22 de noviembre de 2026.

## Acceso y alcance

- Usar [Inventario J&R Piloto](https://jarvis-vps.tail81424e.ts.net:9443/) desde Safari con Tailscale conectado. En iPhone se puede agregar a la pantalla de inicio.
- Cuentas de prueba: `supervisor-piloto` y `contador-piloto`. En el Mac, los PIN están en `ACCESO-PILOTO.local.txt`, un archivo local ignorado por Git.
- La supervisora abre y cierra el conteo, administra personas y descarga el reporte. Cada contador usa su propia cuenta.
- Usar datos ficticios durante el piloto. Hay un conteo cerrado de verificación llamado «Piloto — datos ficticios».

## Instalación activa

| Elemento | Configuración |
| --- | --- |
| VPS | Contabo de Jarvis, Ubuntu 24.04, alias SSH `Jarvis` |
| Capacidad medida el 22 de noviembre | 130 GiB de disco disponibles y 6 GiB de RAM disponibles antes de instalar |
| Código desplegado | `farmacia/archivo-y-reporte`, commit `69e02f8574c43d3084a7362abfb8d2303b8a5129` |
| Directorio y proyecto Compose | `/home/jarvis/inventario-jr-piloto`, `inventario-jr-piloto` |
| Contenedores | Node.js 22 para la API y Caddy para la web |
| Entrada | Tailscale Serve termina HTTPS privado en `:9443` hacia Caddy en `127.0.0.1:9400` |
| Rutas | PWA en `/`; Caddy pasa `/api/*` y `/socket.io/*` a la API |
| Base de datos | `data/stocktake.sqlite`, dedicada al piloto |
| Respaldos | Copia SQLite diaria a las 03:00 de Puerto Rico en `backups/`, con retención local de 30 días |

Se reutilizó el VPS y su red privada de Tailscale. El piloto no necesitó comprar un dominio, abrir puertos públicos ni contratar otro servidor. Los archivos de despliegue del piloto están en el directorio del VPS y en el workspace local de Codex bajo `contabo/piloto/`.

## Operación

Desde una sesión SSH en el VPS:

```bash
cd ~/inventario-jr-piloto
sudo docker compose ps
sudo docker compose logs --tail=50 api web
curl -fsS http://127.0.0.1:9400/api/health
tailscale serve status
systemctl list-timers inventario-jr-piloto-backup.timer
sudo systemctl start inventario-jr-piloto-backup.service
sudo journalctl -u inventario-jr-piloto-backup.service -n 20 --no-pager
```

Antes de una actualización, guardar una copia verificada y anotar el commit desplegado. Compilar el cliente con `VITE_API_URL` igual al origen HTTPS del piloto, con `:9443` y sin el sufijo `/api`. Usar el mismo origen para `CLIENT_ORIGIN`. Mantener la base fuera del código de cada versión y aplicar las migraciones al volumen existente.

El respaldo usa la API de copia de SQLite y pasa `PRAGMA integrity_check` antes de guardarse. Para ensayar una restauración, abrir una copia aparte y comprobar la integridad y el contenido. Para sustituir la base activa, detener la API, resguardar la base anterior junto con sus archivos WAL/SHM si existen y restaurar con permisos y versión compatibles. El respaldo actual se guarda en el mismo VPS.

Para retirar el piloto, deshabilitar solo su temporizador y su entrada de Tailscale en `:9443`. Detener su proyecto Compose desde su directorio y conservar `data/` y `backups/` si deben poder recuperarse.

## Verificaciones y pendientes

- Verificado por HTTPS: interfaz, service worker, API y negociación WebSocket.
- Verificado con datos ficticios: acceso con ambos roles, reenvío de un escaneo por lotes sin duplicarlo, cierre por supervisora y exportación Excel.
- Verificado: temporizador habilitado y copia SQLite legible con el conteo ficticio cerrado.
- Pendiente en dos iPhones: instalar la PWA, iniciar sesión con conexión, comprobar cámara, activar modo avión, escanear, cerrar y reabrir la PWA, recuperar la conexión y comprobar que llegan las cantidades una sola vez. Después cerrar el conteo y comparar Excel y CSV.
- La compilación informó dos avisos moderados en el árbol de dependencias de producción después de retirar las dependencias de desarrollo. Revisarlos antes de ampliar el uso.
- Pendiente de producción: integrar PR #3 y #4 a `master`, resolver hallazgos del piloto y definir un destino externo para los respaldos.
