# Sistema de Nómina Bancos — Especificación técnica

Documento de handoff para construir en Claude Code / VS Code. Todo lo de acá viene de trabajo ya hecho y verificado en un chat previo con Claude — no son suposiciones nuevas.

## 1. Qué es este sistema

Reemplaza **dos procesos manuales en uno**:
1. La nómina mensual regular (antes: pegar columnas a mano por cada banco).
2. Los finiquitos (antes: Santiago cruzaba a mano contra la data de cada banco).

Ambos procesos usan la misma estructura de fondo: un archivo con gente a pagar (código SAP, cédula, nombre, monto) que hay que cruzar contra los datos bancarios reales de cada persona, y con eso generar 3 archivos `.txt` — uno por banco — en el formato exacto que cada banco exige.

## 2. Roles y usuarios

- **~6 usuarios en total**, Fabián los crea directamente en Supabase Auth (no hace falta flujo de self-signup).
- **Operador** (Santiago y similares): sube el archivo de pago, revisa errores, descarga los .txt, da clic en "Finalizar proceso".
- **Admin / Jefe**: no sube nada. Recibe una notificación cuando el operador finaliza un lote, y puede entrar a ver/descargar los mismos archivos que se generaron.
- El botón **"Finalizar proceso" solo notifica al Admin — no bloquea ni impide que se vuelva a generar el mismo lote.** Confirmado explícitamente por Fabián: no hace falta lógica de bloqueo/lock en esta versión.

## 3. Flujo completo

1. Login (Supabase Auth).
2. El operador sube un archivo (nómina regular o finiquitos — mismo tipo de estructura: código SAP, nombre, cédula, monto, fechas).
3. El sistema, **por cada fila, busca la cédula en Data_madre** (ver sección 4) y saca de ahí: banco, cuenta, tipo de cuenta, celular.
   **Regla de oro: el sistema NUNCA confía en banco/cuenta/tipo/celular si vienen en el archivo subido — siempre los vuelve a sacar de Data_madre.** Así Santiago deja de ser responsable de que esos datos estén al día.
4. Casos de error que el sistema debe manejar (no son hipotéticos, ya aparecieron en los datos reales):
   - Cédula del archivo subido que **no aparece en Data_madre** → bloquear esa fila, mostrar error claro.
   - Cédula que sí está en Data_madre pero **sin banco/cuenta cargado** → bloquear esa fila. Ya hay 4 casos reales así en el Data_madre actual (empleados nuevos sin cuenta registrada todavía).
   - Monto inválido, cuenta vacía, etc. → mismas validaciones que ya construimos en la herramienta anterior (ver sección 5).
5. El sistema categoriza automático por banco y genera los 3 `.txt` (Produbanco, Pichincha, Guayaquil) usando la lógica ya verificada (sección 5 — portar tal cual, no rehacer).
6. Muestra un resumen: fecha, banco, cantidad de registros, total por banco.
7. Si hay errores, se muestra una alerta y se bloquea la descarga hasta corregir (mismo patrón que la herramienta anterior).
8. Una vez validado: botón de descarga por banco.
9. Botón **"Finalizar proceso"** → dispara notificación al perfil Admin (solo aviso, no bloqueo).
10. Cada corrida queda guardada en el historial (tabla en Supabase): fecha, tipo (regular/finiquito), # registros y monto total por banco, quién la generó.

## 4. Data_madre — la fuente de verdad

Vive en **Google Sheets**, no en un Excel que alguien sube. El Jefe/nómina la edita directo ahí, la app la lee en vivo.

- **ID de la hoja:** `1v8gwNNo-4U7nbuHA5uWk3iFue3PFkmyQcIKD3iSq5HE`
- **Acceso:** vía Google Sheets API, con una cuenta de servicio (`lector-nomina-bancos@nomina-bancos-marathon.iam.gserviceaccount.com`). La clave JSON de esa cuenta vive local en el proyecto (variable de entorno / archivo excluido del repo) — **nunca en el código ni en el repositorio**.
- **Columnas reales** (headers en la fila 3 de la hoja "BASE" del archivo original, ojo con eso al leerla):

| Columna | Contenido |
|---|---|
| Soc. | Código de sociedad (ej. E200) |
| Sociedad | Nombre legal (ej. SUPERDEPORTE S.A.) |
| Número ID | **Cédula — clave de cruce principal** |
| Nº pers. | Código de empleado SAP (clave de cruce secundaria) |
| Número de personal | Nombre completo |
| 01-Fecha Ingreso | Fecha de ingreso |
| ZF-Fecha Cese | Fecha de cese (si aplica) |
| Teléfono | Teléfono fijo/otro |
| Clave de banco | Banco: `PRODUBANCO`, `BANCO PICHINCHA`, `BANCO DE GUAYAQUIL` |
| Cuenta bancaria | Número de cuenta |
| CC | Tipo de cuenta: `01` = Corriente, `02` = Ahorros |
| E-Mail Corportativo | Email corporativo |
| E-Mail Personal | Email personal |
| CELULAR_UNO | Celular principal (el que se usa en el archivo de Guayaquil) |
| CELULAR_DOS | Celular secundario |

- **Volumen real:** ~1,700 empleados únicos, sin cédulas duplicadas (verificado). 4 registros conocidos con cédula pero sin banco/cuenta cargado.
- **Validación de campos requeridos — específica por banco, no genérica.** Cada banco usa campos distintos (ver sección 5), así que la alerta de "falta un dato" debe revisar solo lo que ESE banco necesita:

  | Banco | Campos que bloquean si faltan |
  |---|---|
  | Produbanco | cédula, nombre, cuenta, tipo de cuenta |
  | Pichincha | cédula, código de empleado, cuenta, tipo de cuenta |
  | Guayaquil | cuenta, tipo de cuenta, **celular** |

  Verificado con los datos reales: 142 de los 1,700 empleados no tienen celular cargado — pero los 347 empleados de BANCO DE GUAYAQUIL (el único banco que usa ese campo) sí lo tienen completo, 0 casos rotos hoy. No es un problema actual, pero la validación tiene que existir para el día que alguien se cambie a Guayaquil sin ese dato actualizado.
- **Cruce recomendado:** por cédula (Número ID) como clave principal. Cruzar también por código SAP como validación cruzada es un nice-to-have, no bloqueante.

### Archivo que sube el operador (nómina regular o finiquitos)

Mismo tipo de estructura vista en los ejemplos reales:

| Columna | Uso |
|---|---|
| CONT | Referencia de lote (informativo) |
| COD. SAP | Código de empleado — usar para cruce/validación |
| NOMBRE | Nombre (informativo, no se usa para generar los .txt salvo Produbanco) |
| CEDULA | **Clave de cruce contra Data_madre** |
| VALOR FINIQUITO / valor a pagar | Monto — este SÍ se confía del archivo subido, es lo único que Data_madre no tiene |
| NUMERO DE CUENTA, BANCO, TIPO DE CUENTA, NUMERO CELULAR | Pueden venir en el archivo, pero **se ignoran** — siempre se reemplazan por lo que diga Data_madre |
| ALTA, BAJA | Fechas informativas |

## 5. Lógica de generación de archivos — YA VERIFICADA, portar tal cual

Cada banco fue reconstruido y verificado byte a byte contra un archivo real:
- **Produbanco:** 707 registros reales, 706/707 exactos (la única diferencia es una mejora de dato sucio, no un error).
- **Pichincha:** 6 registros reales, encabezado exacto, 4/6 detalle exacto (2 explicadas por un typo confirmado en el archivo original, no en la lógica).
- **Guayaquil:** 47 registros reales, **47/47 exactos, sin ninguna excepción** — la verificación más sólida de las tres.

Este bloque de código es JavaScript puro (sin dependencias de DOM), se puede portar directo a cualquier backend/frontend. `onlyDigits(s)` es un helper que solo deja dígitos de un string — hay que llevarlo también.

```javascript
const BANK_PROFILES = {
  produbanco: {
    label: 'Produbanco',
    fields: { cedula: 'required', nombre: 'required', codigoEmpleado: 'hidden', celular: 'hidden', tipoCuenta: ['AHO','CTE'], tipoId: ['C','R'] },
    lineEnding: 'trailing', // el archivo real terminaba con \r\n después de la última línea
    filename: (ctx) => `PRODUBANCO_FINMES_SPD_${ctx.dd || ''}${ctx.mm}${ctx.yyyy}`,
    buildHeader: null,
    buildRecord: (r, ctx) => {
      const seq = String(ctx.seq).padStart(7,'0');
      const centavos = Math.round(ctx.monto*100);
      const montoStr = String(centavos).padStart(13,'0');
      const pad = ' '.repeat(Math.max(0, 151 - ctx.nombre.length));
      const fields = [
        'PA', ctx.cuentaOrigen, seq, '', ctx.cedula, 'USD', montoStr,
        'CTA', '0036', r.tipoCuenta || 'AHO', ctx.cuenta, r.tipoId || 'C',
        ctx.cedula, ctx.nombre, '', '', '', '', ctx.periodo, pad
      ];
      return fields.join('\t');
    }
  },
  pichincha: {
    label: 'Pichincha',
    // Pichincha no lleva el nombre en el archivo, pero sí un código de empleado (SAP) que
    // Produbanco no pide. tipoCuenta usa sus propios códigos literales (AH/CC, no AHO/CTE).
    fields: { cedula: 'required', nombre: 'optional', codigoEmpleado: 'required', celular: 'hidden', tipoCuenta: ['AH','CC'], tipoId: 'none' },
    lineEnding: 'none', // el archivo real NO tiene \r\n después de la última línea
    filename: (ctx) => `PICHINCHA_${ctx.dd || ''}${ctx.mm}${ctx.yyyy}`,
    // Verificado contra un archivo real: encabezado con texto fijo (incluye el RUC de la
    // empresa) + cantidad de registros (6 dígitos) + monto total en centavos (17 dígitos).
    buildHeader: (rows, ctx) => {
      const fixed = `BPR${ctx.ruc} 0103`;
      const count = String(rows.length).padStart(6,'0');
      const totalCents = rows.reduce((acc,r)=> acc + Math.round(parseFloat(r.monto)*100), 0);
      const amount = String(totalCents).padStart(17,'0');
      return fixed + count + amount;
    },
    buildRecord: (r, ctx) => {
      const empc = onlyDigits(r.codigoEmpleado).padStart(16,'0');
      const bloque1 = empc + ' '.repeat(32) + 'C' + '0000';
      const cents = String(Math.round(ctx.monto*100)).padStart(13,'0') + '0'.repeat(14);
      const bloque2 = ctx.cedula + cents + (r.tipoCuenta || 'AH') + 'USDUSD' + ctx.cuenta.padEnd(10,' ');
      const bloque3 = 'C' + ctx.fecha + ctx.fecha + 'U';
      return bloque1 + bloque2 + bloque3;
    }
  },
  guayaquil: {
    label: 'Guayaquil',
    // Guayaquil no lleva cédula ni nombre en el archivo — usa el CELULAR como identificador
    // del beneficiario. Sin encabezado ni pie de archivo. Verificado 47/47 líneas exactas
    // contra un archivo real (la mejor muestra que he tenido hasta ahora).
    fields: { cedula: 'hidden', nombre: 'optional', codigoEmpleado: 'hidden', celular: 'required', tipoCuenta: ['A00','C00'], tipoId: 'none' },
    lineEnding: 'none',
    filename: (ctx) => `BGY_${ctx.dd || ''}${ctx.mm}${ctx.yyyy}`,
    buildHeader: null,
    buildRecord: (r, ctx) => {
      const tipo = r.tipoCuenta || 'A00';
      const cuenta = ctx.cuenta.padStart(8,'0');
      const centavos = String(Math.round(ctx.monto*100)).padStart(15,'0');
      const celular = ctx.celular.padStart(10,'0');
      return tipo + cuenta + centavos + 'XXY06' + ' '.repeat(38) + 'HGS' + ' '.repeat(30) + celular;
    }
  }
};
```

**Al portar esto:** `ctx` se arma por fila con: `seq` (número secuencial), `cuentaOrigen` (cuenta Marathon en Produbanco), `ruc` (RUC empresa, para el header de Pichincha), `mm`/`dd`/`yyyy` (periodo), `periodo` (string `MES-MM-YYYY`, solo Produbanco), `fecha` (string `YYYY-MM-DD`, solo Pichincha), `cedula`, `cuenta`, `nombre`, `codigoEmpleado`, `celular`, `monto` — todos ya limpios (solo dígitos donde aplica, nombre normalizado en mayúsculas sin tildes salvo Ñ). El armado del archivo final es: `buildHeader` (si existe) + todas las líneas de `buildRecord`, unidas con `\r\n`, y agregar `\r\n` final solo si `lineEnding === 'trailing'`.

## 6. Pendientes reales (no resueltos en este chat, hay que cerrarlos)

- **Registro de la app en Microsoft/Azure AD:** ya no aplica — se decidió ir por Google Sheets en vez de OneDrive, así que este punto queda descartado.
- **Confirmar con el banco (prueba piloto):** el formato de cada banco está verificado contra archivos de ejemplo, pero falta que alguien suba un archivo de prueba (2-3 personas) al sistema real de cada banco para confirmar que lo sigue aceptando hoy. Esto no lo resuelve el código.
- **Nombre de archivo de Guayaquil:** no se pudo confirmar la convención exacta que espera el banco (a diferencia de Produbanco, donde sí hubo un archivo ya nombrado como referencia). El que usa el sistema es razonable pero no confirmado.
- **PIN / autenticación de la versión anterior (HTML estático):** queda obsoleta una vez que este sistema nuevo con Supabase Auth esté en producción — no hace falta migrarla, se reemplaza.

## 7. Stack

- Frontend: React + Vite (consistente con el resto de tus proyectos de People Analytics).
- Backend/datos: Supabase (Auth + tablas: usuarios/roles, historial de corridas, y cache opcional de Data_madre si hace falta rendimiento).
- Data_madre: Google Sheets, leído en vivo vía Google Sheets API + cuenta de servicio.
- Deploy: Vercel.
