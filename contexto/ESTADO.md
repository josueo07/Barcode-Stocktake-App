# Estado del proyecto

_Última actualización: 2026-11-22 (estilo iPhone y perfil)_

## Objetivo

App para el **inventario físico anual de la farmacia J&R**. Varias personas cuentan a la
vez con iPhone (Safari, como app instalada), de noche y a veces sin Wi-Fi. Si la farmacia
ya tiene inventario, el cliente entrega un archivo (UPC, nombre, cantidad, costo); se sube,
se cuenta y sale un reporte de diferencias. Si no hay archivo, solo se cuenta.

Base: fork de `ColterPan/Barcode-Stocktake-App` (MIT) en `josueo07/Barcode-Stocktake-App`.

## Construido

| Qué | Dónde | PR |
| --- | --- | --- |
| Dependencias al día, sin alertas de seguridad (multer 2, zod 4, exceljs, etc.) | todo | #1 ✅ |
| Login por persona con PIN; roles **supervisor** y **contador**; bloqueo tras 5 intentos | `server/src/services/auth.service.ts`, `client/src/auth/` | #1 ✅ |
| Usuarios: el supervisor los crea y desactiva; comando `user:create` | `server/src/routes/users.routes.ts` | #1 ✅ |
| El servidor controla el cierre: borrador → en curso → cerrado; escaneos tardíos quedan aparte para que el supervisor los acepte | `server/src/services/scan.service.ts` | #2 ✅ |
| Reabrir la app sin Wi-Fi; cola de escaneos en el teléfono; cada escaneo se envía con el login de quien lo hizo | `client/src/db/offlineQueue.ts`, `client/src/hooks/useOfflineSync.ts` | #3 (abierto) |
| App en español y diseño para teléfono | `client/` | #4 (abierto) |
| Al escanear: cantidad; costo (opción por conteo); lote y expiración (casilla opcional) | `client/src/components/scanner/ScanEntryPanel.tsx` | #4 |
| Importar el archivo del cliente en Excel o CSV (UPC, nombre, cantidad, costo; SKU opcional; encabezados en español o inglés) | `server/src/services/csvImport.service.ts` | #4 |
| Crear producto al momento si no está en el archivo | `ScanEntryPanel.tsx`, `scan.service.ts` | #4 |
| Códigos cuadran aunque cambien los ceros al inicio (UPC-A / EAN-13) | `findProductByBarcode` en `scan.service.ts` | #4 |
| Reporte de diferencias en unidades y dinero, resumen de faltantes/sobrantes, filtro "solo diferencias" | `server/src/services/varianceReport.service.ts`, `client/src/components/report/` | #4 |
| Descargar reporte en Excel (hojas Diferencias y Detalle) o CSV | mismo | #4 |
| Carpeta `contexto/` con actualización automática del historial | `contexto/`, `.github/workflows/` | #4 |
| Diseño estilo iPhone con toque **Liquid Glass**: vidrio translúcido con desenfoque y brillo, barra superior flotante, botones en cápsula, control segmentado, modo oscuro; vuelve a sólido si el iPhone pide menos transparencia | `client/src/styles/index.css`, `client/src/AppShell.tsx` | #5 |
| **Un solo supervisor** y varios contadores (el servidor rechaza un segundo supervisor) | `assertNoOtherSupervisor` en `auth.service.ts` | #5 |
| Perfil de cada persona: nombre, rol, actividad (escaneos, unidades, conteos), cambiar su PIN, cerrar sesión | `client/src/pages/ProfilePage.tsx`, `/api/auth/me*` | #5 |
| Pantalla Personas: supervisor arriba, lista de contadores, añadir contador | `client/src/pages/UsersPage.tsx` | #5 |

## Piloto activo en Contabo

El piloto privado usa el VPS existente de Jarvis, Node.js 22 en Docker Compose,
Caddy, HTTPS por Tailscale y copias diarias de SQLite. Se desplegó el commit
`69e02f8` de `farmacia/archivo-y-reporte`. La guía recoge el acceso,
la operación, la recuperación y las pruebas pendientes en [PILOTO-CONTABO.md](PILOTO-CONTABO.md).

El ajuste de importación está activo en el piloto sobre la base `17e32e9`.
Reconoce los encabezados de la farmacia, admite CSV con
coma, punto y coma o tabulación, y abre Reporte si guardó cantidades sin
errores. Si falta una columna de cantidad clara, pide elegirla.

El escáner permite reiniciar la cámara y repetir una lectura descartando
el código pendiente sin guardarlo.

En Conteos, el supervisor puede borrar borradores, conteos en curso y cerrados.
La confirmación muestra el nombre y avisa que se eliminarán sus datos y reporte.

## Falta (en orden)

1. **Prueba con dos iPhones**. Cámara, modo avión, reapertura de la app, sincronización,
   cierre y reportes. Usar datos ficticios.
2. **Actualizar el piloto en Contabo** a `master` (PR #3, #4 y #5 ya unidos el 2026-11-22;
   trae la migración `0004_expected_cost`). Luego resolver los ajustes detectados en el piloto.
3. **Preparar producción**. Revisar dependencias, definir acceso del equipo y configurar
   un destino externo para los respaldos.

## Ideas no aprobadas todavía

- Escaneo continuo (sin pantalla de cantidad) para productos de 1 en 1.
- Asignar pasillos o zonas a cada contador.
