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
