# Guía de Subida de Archivos a S3 y Configuración CDN

Esta guía documenta cómo el Backend de LIVEX maneja la subida de imágenes a AWS S3 y cómo configurar dominios personalizados (CDN).

## 1. Configuración de Variables de Entorno

El sistema utiliza las siguientes variables en `.env`:

| Variable | Requerido | Descripción | Ejemplo |
| :--- | :--- | :--- | :--- |
| `AWS_ACCESS_KEY_ID` | Sí | Tu Access Key de AWS IAM. | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | Sí | Tu Secret Key de AWS IAM. | `wJalr...` |
| `AWS_REGION` | Sí | Región donde se creó el bucket. **Debe coincidir exactamente.** | `us-east-2`, `sa-east-1` |
| `AWS_S3_BUCKET_NAME` | Sí | Nombre del bucket S3. | `livex-media` |
| `AWS_S3_CUSTOM_DOMAIN` | No | Dominio personalizado o CDN (CloudFront) para servir archivos. | `https://cdn.livex.com.co` |

### Importante: `AWS_REGION`
Si configuras una región incorrecta (ej. `us-east-1` cuando el bucket está en `us-east-2`), AWS retornará un error `PermanentRedirect` indicando que el bucket no existe en ese endpoint.

### Importante: `AWS_S3_CUSTOM_DOMAIN`
Si esta variable está definida, todas las URLs de imágenes generadas y guardadas en la base de datos usarán este dominio en lugar del dominio por defecto de S3.

- **Sin configurar:** `https://livex-media.s3.us-east-2.amazonaws.com/experiences/...`
- **Configurado (`https://media.livex.com.co`):** `https://media.livex.com.co/experiences/...`

Esta configuración es ideal para usar **CloudFront** o cualquier otro CDN, o para entornos de desarrollo con proxies (como Azurite con ngrok).

## 2. Flujo de Subida de Imágenes

El sistema soporta principalmente la subida directa al backend, el cual luego actúa como proxy hacia S3.

### Endpoint: `POST /api/v1/experiences/:id/images/upload`

Este endpoint recibe el archivo y lo sube inmediatamente a S3.

**Headers:**
- `Content-Type`: `multipart/form-data`

**Body (Form-Data):**
- `file`: (Binario) El archivo de imagen.
- `image_type`: `hero` (portada) o `gallery` (galería).
- `sort_order`: (Opcional) Número entero para ordenar (0, 1, 2...).

### Lógica Interna

1.  **Validación:** Se verifica que el archivo sea una imagen válida.
2.  **Generación de Path:** Se crea una estructura de carpetas organizada:
    `experiences/{resort_slug}/{experience_slug}/{type}-{uuid}.{ext}`
3.  **Subida a S3:**
    - El `ExperiencesService` llama a `UploadService.uploadFile`.
    - `UploadService` lee el bucket desde el `.env`.
    - Sube el buffer del archivo usando `PutObjectCommand`.
4.  **Generación de URL:**
    - Si existe `AWS_S3_CUSTOM_DOMAIN`, se concatena: `CUSTOM_DOMAIN + / + KEY`.
    - Si no, se usa formato estándar S3: `https://{bucket}.s3.{region}.amazonaws.com/{key}`.
5.  **Persistencia:** La URL final se guarda en la tabla `experience_images`.

## 3. Manejo de Errores Comunes

### Error: `PermanentRedirect`
**Causa:** La variable `AWS_REGION` no coincide con la región real del bucket en AWS.
**Solución:** Verificar la consola de AWS y corregir el `.env`.

### Error: `File not found in request`
**Causa:** El cliente (Postman/Frontend) está enviando el archivo con una clave incorrecta (ej. `filename` o `image`).
**Solución:** Asegurarse de que el campo del formulario (Key) se llame `file`.

## 4. Obtención y Reordenamiento

- **GET**: Las imágenes se obtienen al consultar la experiencia con `?include_images=true`.
- **Reordenar**: Endpoint `PATCH /api/v1/experiences/:id/images/reorder` permite cambiar el orden visual sin resubir archivos.
- **Borrar**: `DELETE /api/v1/experiences/:id/images/:imageId` elimina el registro y el objeto en S3 (si es posible).

---

## 5. Subida de Documentos de Resorts

Además de imágenes de experiencias, el sistema permite subir documentos legales de resorts (cámara de comercio, RUT, RNT, etc.).

### Endpoint: `POST /api/v1/resorts/:id/documents/upload`

**Autenticación:** Bearer Token (roles: `resort`, `admin`)

**Headers:**
- `Content-Type`: `multipart/form-data`
- `Authorization`: `Bearer {token}`

**Body (Form-Data):**

| Key | Type | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `file` | File | Sí | El archivo (imagen o PDF) |
| `doc_type` | Text | Sí | Tipo de documento (ver tabla abajo) |

**Tipos de documento (`doc_type`):**

| Valor | Descripción |
| :--- | :--- |
| `camara_comercio` | Certificado de Cámara de Comercio |
| `rut_nit` | RUT o NIT del negocio |
| `rnt` | Registro Nacional de Turismo |
| `other` | Otros documentos |

**Tipos de archivo permitidos:**
- Imágenes: `image/jpeg`, `image/png`, `image/webp`, `image/gif`
- Documentos: `application/pdf`

### Respuesta Exitosa (201)

```json
{
  "document_url": "https://bucket.s3.region.amazonaws.com/docs/resort-slug/rut_nit/2026-01-13-uuid.pdf",
  "document": {
    "id": "uuid",
    "doc_type": "rut_nit",
    "file_url": "https://...",
    "status": "uploaded",
    "rejection_reason": null,
    "reviewed_at": null,
    "uploaded_at": "2026-01-13T20:00:00.000Z",
    "created_at": "2026-01-13T20:00:00.000Z",
    "updated_at": "2026-01-13T20:00:00.000Z"
  }
}
```

### Estructura de Carpetas en S3

Los documentos se organizan bajo la carpeta `docs/`:

```
docs/
├── resort-slug-1/
│   ├── camara_comercio/
│   │   └── 2026-01-13-uuid.pdf
│   ├── rut_nit/
│   │   └── 2026-01-13-uuid.pdf
│   └── rnt/
│       └── 2026-01-13-uuid.jpg
└── resort-slug-2/
    └── ...
```

### Ejemplo con cURL

```bash
curl -X POST "http://localhost:3000/api/v1/resorts/{resortId}/documents/upload" \
  -H "Authorization: Bearer {token}" \
  -F "file=@./documento.pdf" \
  -F "doc_type=rut_nit"
```

### Ejemplo con JavaScript

```javascript
const uploadDocument = async (resortId, file, docType, token) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('doc_type', docType);

  const response = await fetch(`/api/v1/resorts/${resortId}/documents/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  return response.json();
};
```

---

## 6. Eliminación de Documentos de Resorts

### Endpoint: `DELETE /api/v1/resorts/:id/documents/:docId`

**Autenticación:** Bearer Token (roles: `resort`, `admin`)

Este endpoint:
1. Verifica permisos (solo el dueño del resort o admin)
2. Elimina el archivo de S3
3. Elimina el registro de la base de datos

**Respuesta Exitosa:** `204 No Content`

### Ejemplo con cURL

```bash
curl -X DELETE "http://localhost:3000/api/v1/resorts/{resortId}/documents/{docId}" \
  -H "Authorization: Bearer {token}"
```

---

## 7. Estados de Documentos

Los documentos tienen un flujo de revisión:

| Estado | Descripción |
| :--- | :--- |
| `uploaded` | Documento recién subido, pendiente de revisión |
| `under_review` | En proceso de revisión por admin |
| `approved` | Documento aprobado |
| `rejected` | Documento rechazado (ver `rejection_reason`) |

Los administradores pueden aprobar o rechazar documentos desde el panel de administración.

