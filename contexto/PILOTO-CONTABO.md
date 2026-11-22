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

## Importación y apertura automática del reporte

Activa el 22 de noviembre de 2026 sobre la base `17e32e9`, con las imágenes
`inventario-jr-piloto-api:importacion-csv-reporte` e
`inventario-jr-piloto-web:importacion-csv-reporte`. Reconoce
`cantidad_sistema` como cantidad esperada y `costo_unitario_usd` como costo.
Admite coma, punto y coma y tabulación. Cuando hace falta elegir la columna
de cantidad, la primera solicitud no escribe en el catálogo. Si la importación
guarda cantidades sin errores de filas, abre el reporte del mismo conteo.

Pasaron 102 pruebas automatizadas. Se verificó la página y la salud de la API
por HTTPS. La base sigue en el mismo volumen, sin migraciones adicionales.
Copia verificada previa al cambio: `stocktake-20261122T182316Z.sqlite`.
El Compose anterior está en `compose.override.anterior.yaml` dentro del
directorio de código apuntado por el Compose activo.
El código está en la rama local `codex/importacion-csv-reporte`.

## Reiniciar el escáner

La web activa ofrece «Reiniciar cámara» cuando está esperando una lectura y
«Escanear de nuevo» después de detectar un código. El segundo botón descarta
la lectura pendiente sin guardarla. Ambos reabren la cámara después de que
se libera el flujo anterior.

El piloto sirve la imagen `inventario-jr-piloto-web:reiniciar-escaner`.
Pasaron 38 pruebas del cliente, incluida la espera al cerrar la cámara antes
de reiniciar. Se verificaron por HTTPS la nueva web y la API, que sigue
ejecutándose en su contenedor anterior.

## Borrado confirmado desde Conteos

Activo en la API y web con la etiqueta `borrar-confirmado` sobre la base
`17e32e9`. Los supervisores pueden borrar borradores, conteos en curso y
cerrados. La pantalla muestra una confirmación por nombre y advierte que
se eliminan el reporte, las cantidades esperadas y los escaneos. El
catálogo se conserva. La API requiere `?confirm=true` para los conteos
iniciados o cerrados.

Pasaron 104 pruebas automatizadas en entornos desechables. Se verificaron
la web y la API por HTTPS. Antes del despliegue se verificó la copia SQLite
`stocktake-20261122T200350Z.sqlite`. No se borraron conteos del piloto
durante la actualización. La configuración anterior de Compose se guardó
en el directorio de la versión como `compose.override.anterior.yaml`.

## Verificaciones y pendientes

- Verificado por HTTPS: interfaz, service worker, API y negociación WebSocket.
- Verificado con datos ficticios: acceso con ambos roles, reenvío de un escaneo por lotes sin duplicarlo, cierre por supervisora y exportación Excel.
- Verificado: temporizador habilitado y copia SQLite legible con el conteo ficticio cerrado.
- Pendiente en dos iPhones: instalar la PWA, iniciar sesión con conexión, comprobar cámara, activar modo avión, escanear, cerrar y reabrir la PWA, recuperar la conexión y comprobar que llegan las cantidades una sola vez. Después cerrar el conteo y comparar Excel y CSV.
- La compilación informó dos avisos moderados en el árbol de dependencias de producción después de retirar las dependencias de desarrollo. Revisarlos antes de ampliar el uso.
- Pendiente de producción: integrar PR #3 y #4 a `master`, resolver hallazgos del piloto y definir un destino externo para los respaldos.
