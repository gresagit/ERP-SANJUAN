# Guía de Marca — San Juan Servicios de Salud
### Aplicación al sistema ERP-SANJUAN

## 1. Logotipo
- **Símbolo**: cruz médica construida con dos trazos entrelazados (uno en azul `#2B8BB4`, otro en azul marino `#1B3447`), con un pequeño detalle floral en el centro que simboliza cuidado/naturaleza.
- **Variantes de color**: full color (azul + navy), monocromática gris (`#767676`), monocromática negra (`#0D0D0D`), y versión blanca para fondos oscuros/de color.
- **Uso en el sistema**: el símbolo (sin el wordmark) funciona como favicon, ícono de app y avatar por defecto. El logo completo (símbolo + "SAN JUAN / SERVICIOS DE SALUD") va en el header de login y en documentos/reportes exportados.
- **Espacio de protección**: dejar un margen alrededor del ícono equivalente al ancho de uno de sus brazos; no comprimir ni recolorear fuera de las variantes definidas.

## 2. Paleta de color

| Token | Hex | Uso |
|---|---|---|
| `--sj-navy-900` | `#1B3447` | Fondo oscuro principal, texto sobre fondos claros, sidebar del ERP |
| `--sj-blue-500` | `#2B8BB4` | Color de marca/acento — botones primarios, links, estados activos |
| `--sj-blue-600` | `#21708F` | Hover/pressed del azul primario |
| `--sj-slate-400` | `#4A6570` | Texto secundario, subtítulos, placeholders |
| `--sj-gray-500` | `#767676` | Variante monocromática, íconos inactivos |
| `--sj-black` | `#0D0D0D` | Variante monocromática, texto de alto contraste |
| Blanco | `#FFFFFF` | Fondos claros, texto sobre navy/azul |

Colores de estado sugeridos para el ERP (no están en el manual original, propuestos por consistencia): éxito `#2E9E6B`, advertencia `#D9A441`, error `#C24A44`.

## 3. Tipografía
- **Display / títulos de marca** ("SAN JUAN"): serif elegante, tipo *Playfair Display* o *Cormorant Garamond*. Reservar para títulos de página, pantalla de login, encabezados de reportes/PDF.
- **UI / cuerpo** ("SERVICIOS DE SALUD" y textos de interfaz): sans-serif con tracking amplio, tipo *Montserrat* o *Poppins*. Usar para menús, tablas, formularios, botones (en mayúsculas + letter-spacing ~0.12em para labels/eyebrows, como en el manual).

## 4. Tono y mensajes clave (de redes sociales)
- Enfoque en atención inmediata, sin filas de espera, consulta general y control de enfermedades crónicas.
- Frases ancla reutilizables en el sistema (ej. pantallas de agenda/citas): *"Atención inmediata"*, *"Consulta médica general enfocada en tu bienestar"*.
- Ubicación de referencia: Carretera Tezoyuca–Emiliano Zapata 517, Emiliano Zapata, Morelos.

## 5. Aplicación recomendada en ERP-SANJUAN
| Elemento del ERP | Estilo |
|---|---|
| Login / splash | Fondo `--sj-navy-900`, logo completo centrado en blanco/gris claro, botón primario azul |
| Sidebar / nav | Fondo navy o blanco con acentos azules en el ítem activo |
| Botones primarios | `--sj-blue-500`, texto blanco, mayúsculas, `border-radius: 10px` |
| Tarjetas / paneles | Fondo `#F4F6F7`, borde `#E2E6E8`, título en serif navy |
| Tablas de pacientes/citas | Encabezados sans-serif con tracking, filas alternadas blanco/`#F4F6F7` |
| Favicon / ícono app | Símbolo de la cruz solo, en azul sobre fondo blanco o blanco sobre navy |

## 6. Archivos entregados
- `theme-san-juan.css` — variables CSS listas para importar en el frontend.
- Mockup de pantallas (login + dashboard) — enlace de artifact publicado por separado.

---
*Colores extraídos por muestreo directo de píxeles del manual de identidad (`CSJRS_20260608_070525_0000.pdf`); pueden ajustarse levemente si existe una guía de marca oficial con valores Pantone/HEX definidos.*
