# Estado del proyecto

_Última actualización: 2026-11-22_

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

## Falta (en orden)

1. **Unir PR #3 y #4** a `master`.
2. **Servidor en Contabo**: Ubuntu 24.04, Node 20, servicio `systemd`, Caddy con HTTPS
   (mismo dominio para app y `/api`), firewall, backup diario de la base SQLite, script de
   deploy. Falta: dominio o subdominio y acceso al VPS.
3. **Prueba piloto** con 2 iPhones: login, contar sin Wi-Fi, reenviar, cerrar conteo,
   reporte.
4. Ajustes que salgan del piloto.

## Ideas no aprobadas todavía

- Escaneo continuo (sin pantalla de cantidad) para productos de 1 en 1.
- Asignar pasillos o zonas a cada contador.
