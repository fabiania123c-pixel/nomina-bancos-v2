# Sistema de Nómina Bancos — Marathon / Superdeporte

Ver `ESPECIFICACION_sistema_nomina_bancos.md` (en la raíz del proyecto, agrégalo tú) para el
detalle completo: flujo, roles, estructura de Data_madre, y por qué cada decisión de diseño
se tomó así.

## Estado actual

✅ **Hecho y verificado:**
- Proyecto Vite + React + React Router + Supabase client, instalado y corriendo.
- Motor de generación de los 3 bancos (`src/lib/bankProfiles.js`) — portado del prototipo
  HTML, sin dependencias de navegador (funciones puras).
- Suite de pruebas automáticas (`src/lib/bankProfiles.test.js`) que verifica el motor contra
  los 3 archivos reales de cada banco (incluidos como fixtures en `src/lib/__fixtures__/`).
  Correr con `npm test` — debe dar 4/4 en verde.

🔲 **Falta construir:**
- Login con Supabase Auth (roles: operador / admin).
- Tablas en Supabase: usuarios/roles, historial de corridas.
- Lectura de Data_madre desde Google Sheets (API + cuenta de servicio).
- Lógica de cruce: cada fila del archivo subido → buscar cédula en Data_madre → resolver
  banco/cuenta/tipo/celular (nunca confiar en esos campos si vienen en el archivo subido).
- Pantalla de carga de archivo (operador).
- Pantalla de resumen + alertas de error + descarga.
- Botón "Finalizar proceso" → notificación al Admin.
- Pantalla del Admin (ver/descargar lo que ya se generó).

## Cómo correr el proyecto

```bash
npm install
npm test        # confirma que el motor de bancos sigue funcionando
npm run dev      # levanta el proyecto en local
```

## Antes de tocar credenciales reales

1. Copia `.env.example` como `.env` (no subir nunca `.env` al repo — ya está en `.gitignore`).
2. La clave privada de Google (`GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`) va ahí, no en ningún
   archivo del código ni en ningún mensaje de chat.
3. Si en algún momento una clave quedó expuesta (pegada en un chat, por ejemplo), rótala en
   Google Cloud Console antes de usarla en producción — no cuesta nada hacerlo.

## Estructura

```
src/
  lib/
    bankProfiles.js         # motor de generación (Produbanco, Pichincha, Guayaquil)
    bankProfiles.test.js    # pruebas contra archivos reales
    __fixtures__/           # los 3 archivos reales usados para verificar
```
