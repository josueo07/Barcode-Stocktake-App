# Decisiones

Cada entrada: fecha, decisión y por qué. La más nueva arriba.

- **2026-11-22 — Piloto privado en el Contabo existente.** Se reutiliza Jarvis sin
  comprar otro VPS ni un dominio. Tailscale Serve mantiene el acceso dentro de la
  red privada. Docker Compose separa la aplicación y su SQLite del resto del servidor.
  El piloto usa Node.js 22 LTS y la rama con las funciones de conteo sin conexión.
  Ver [guía del piloto](PILOTO-CONTABO.md).
- **2026-11-22 — Claude sube los cambios directamente.** Josue conectó GitHub a Claude y
  la app de Claude está instalada solo en este repositorio. Ya no se usan paquetes
  `.bundle` ni Codex para subir.
- **2026-11-22 — Crear productos al escanear.** Si un código no está en el archivo del
  cliente, el contador escribe el nombre (y costo opcional) y se crea. Sin Wi-Fi, el nombre
  es opcional para no frenar el conteo.
- **2026-11-22 — Valor contado.** Se usa el costo anotado al escanear; si no hay, el costo
  del archivo del cliente.
- **2026-11-22 — Archivo del cliente flexible.** Acepta Excel y CSV, encabezados en
  español o inglés, separador `;` o `,`. Un UPC repetido se suma. SKU opcional (si falta,
  SKU = código).
- **2026-11-22 — Exportar en Excel y CSV.** Josue pidió las dos opciones. Fechas en hora
  de Puerto Rico (`STORE_TIMEZONE`).
- **2026-11-22 — Costo y lote son opcionales.** El costo es una opción de cada conteo; lote
  y expiración se activan con una casilla en el teléfono.
- **2026-11-22 — Hosting en Contabo.** El Mac mini solo para pruebas.
- **2026-11-22 — Base del proyecto.** Adaptar `Barcode-Stocktake-App` (React/Vite PWA +
  Express/Socket.IO + SQLite), según la auditoría de Josue que comparó 3 repositorios.
- **2026-11-22 — Cierre lo controla el servidor.** Escaneos que llegan después de cerrar
  no se suman solos: quedan como "tardíos" para que el supervisor decida.
