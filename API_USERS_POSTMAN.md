# API de Gestión de Usuarios - Guía para Postman

Esta guía te ayudará a probar los endpoints de gestión de usuarios usando Postman.

## Configuración Inicial

### Variable de Entorno Requerida

Asegúrate de tener configurada la variable de entorno `NEXT_PRIVATE_API_KEY` en tu servidor.

### Header Requerido

Todos los endpoints requieren el siguiente header:

```
X-API-Key: <tu-api-key>
```

## Endpoints Disponibles

### 1. Crear Usuario

**POST** `/api/v1/users`

Crea un nuevo usuario en el sistema.

#### Headers

```
X-API-Key: <tu-api-key>
Content-Type: application/json
```

#### Body (JSON)

```json
{
  "name": "Juan Pérez",
  "email": "juan.perez@example.com",
  "password": "MiPassword123!"
}
```

#### Ejemplo de Request en Postman

1. Método: `POST`
2. URL: `http://localhost:3000/api/v1/users` (ajusta según tu entorno)
3. Headers:
   - `X-API-Key`: `tu-api-key-aqui`
   - `Content-Type`: `application/json`
4. Body (raw JSON):

```json
{
  "name": "Juan Pérez",
  "email": "juan.perez@example.com",
  "password": "MiPassword123!"
}
```

#### Respuesta Exitosa (200)

```json
{
  "id": 1,
  "name": "Juan Pérez",
  "email": "juan.perez@example.com",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

#### Respuesta de Error (400) - Usuario ya existe

```json
{
  "message": "User with this email already exists"
}
```

#### Respuesta de Error (401) - API Key inválida

```json
{
  "message": "Invalid API key"
}
```

---

### 2. Listar Usuarios

**GET** `/api/v1/users`

Obtiene una lista paginada de usuarios.

#### Headers

```
X-API-Key: <tu-api-key>
```

#### Query Parameters (Opcionales)

- `page`: Número de página (default: 1)
- `perPage`: Usuarios por página (default: 10)

#### Ejemplo de Request en Postman

1. Método: `GET`
2. URL: `http://localhost:3000/api/v1/users?page=1&perPage=10`
3. Headers:
   - `X-API-Key`: `tu-api-key-aqui`

#### Respuesta Exitosa (200)

```json
{
  "users": [
    {
      "id": 1,
      "name": "Juan Pérez",
      "email": "juan.perez@example.com",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    },
    {
      "id": 2,
      "name": "María García",
      "email": "maria.garcia@example.com",
      "createdAt": "2024-01-16T11:20:00.000Z",
      "updatedAt": "2024-01-16T11:20:00.000Z"
    }
  ],
  "totalPages": 1
}
```

---

### 3. Obtener Usuario por ID

**GET** `/api/v1/users/:id`

Obtiene la información de un usuario específico.

#### Headers

```
X-API-Key: <tu-api-key>
```

#### Ejemplo de Request en Postman

1. Método: `GET`
2. URL: `http://localhost:3000/api/v1/users/1`
3. Headers:
   - `X-API-Key`: `tu-api-key-aqui`

#### Respuesta Exitosa (200)

```json
{
  "id": 1,
  "name": "Juan Pérez",
  "email": "juan.perez@example.com",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

#### Respuesta de Error (404) - Usuario no encontrado

```json
{
  "message": "User not found"
}
```

---

### 4. Actualizar Usuario

**PUT** `/api/v1/users/:id`

Actualiza la información de un usuario existente.

#### Headers

```
X-API-Key: <tu-api-key>
Content-Type: application/json
```

#### Body (JSON)

Todos los campos son opcionales. Solo incluye los campos que deseas actualizar.

```json
{
  "name": "Juan Pérez Actualizado",
  "email": "juan.perez.nuevo@example.com",
  "password": "NuevoPassword123!"
}
```

#### Ejemplo de Request en Postman

1. Método: `PUT`
2. URL: `http://localhost:3000/api/v1/users/1`
3. Headers:
   - `X-API-Key`: `tu-api-key-aqui`
   - `Content-Type`: `application/json`
4. Body (raw JSON):

```json
{
  "name": "Juan Pérez Actualizado",
  "email": "juan.perez.nuevo@example.com"
}
```

#### Respuesta Exitosa (200)

```json
{
  "id": 1,
  "name": "Juan Pérez Actualizado",
  "email": "juan.perez.nuevo@example.com",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T12:45:00.000Z"
}
```

#### Respuesta de Error (400) - Email ya existe

```json
{
  "message": "User with this email already exists"
}
```

#### Respuesta de Error (404) - Usuario no encontrado

```json
{
  "message": "User not found"
}
```

---

### 5. Eliminar Usuario

**DELETE** `/api/v1/users/:id`

Deshabilita un usuario (no lo elimina físicamente de la base de datos).

#### Headers

```
X-API-Key: <tu-api-key>
```

#### Ejemplo de Request en Postman

1. Método: `DELETE`
2. URL: `http://localhost:3000/api/v1/users/1`
3. Headers:
   - `X-API-Key`: `tu-api-key-aqui`

#### Respuesta Exitosa (200)

```json
{
  "id": 1,
  "name": "Juan Pérez",
  "email": "juan.perez@example.com",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

#### Respuesta de Error (404) - Usuario no encontrado

```json
{
  "message": "User not found"
}
```

---

## Requisitos de Contraseña

La contraseña debe cumplir con los siguientes requisitos:

- Mínimo 8 caracteres
- Máximo 72 caracteres
- Si tiene menos de 25 caracteres, debe incluir:
  - Al menos una letra mayúscula
  - Al menos una letra minúscula
  - Al menos un número
  - Al menos un carácter especial: `` `~<>?,./!@#$%^&*()\-_"'+=|{}[\];:\\ ``

### Ejemplos de Contraseñas Válidas

- `MiPassword123!`
- `SecurePass456@`
- `Test123#Password`

### Ejemplos de Contraseñas Inválidas

- `password` (falta mayúscula, número y carácter especial)
- `PASSWORD123` (falta minúscula y carácter especial)
- `Password` (falta número y carácter especial)

---

## Colección de Postman

Puedes crear una colección en Postman con los siguientes requests:

### Variables de Colección

Crea variables en tu colección de Postman:

- `base_url`: `http://localhost:3000` (ajusta según tu entorno)
- `api_key`: `tu-api-key-aqui`

### Requests Sugeridos

1. **Create User** - POST `{{base_url}}/api/v1/users`
2. **Get Users** - GET `{{base_url}}/api/v1/users?page=1&perPage=10`
3. **Get User** - GET `{{base_url}}/api/v1/users/1`
4. **Update User** - PUT `{{base_url}}/api/v1/users/1`
5. **Delete User** - DELETE `{{base_url}}/api/v1/users/1`

### Headers Pre-configurados

En la configuración de la colección, agrega estos headers:

```
X-API-Key: {{api_key}}
```

---

## Códigos de Estado HTTP

- `200` - Operación exitosa
- `400` - Error en la solicitud (validación, usuario ya existe, etc.)
- `401` - No autorizado (API key inválida o faltante)
- `404` - Recurso no encontrado
- `500` - Error interno del servidor

---

## Notas Importantes

1. **API Key**: Asegúrate de configurar `NEXT_PRIVATE_API_KEY` en tu servidor antes de usar estos endpoints.

2. **Eliminación de Usuarios**: El endpoint DELETE no elimina físicamente al usuario, solo lo deshabilita. Esto incluye:
   - Deshabilitar el usuario (`disabled: true`)
   - Expirar todos los tokens de API
   - Deshabilitar todos los webhooks
   - Eliminar todos los passkeys

3. **Email**: Los emails se almacenan en minúsculas automáticamente.

4. **Contraseñas**: Las contraseñas se hashean antes de almacenarse usando bcrypt.

5. **Creación de Usuario**: Al crear un usuario, se crea automáticamente una organización personal para ese usuario.

---

## Ejemplo de Flujo Completo

1. **Crear un usuario**:

   ```
   POST /api/v1/users
   Body: { "name": "Test User", "email": "test@example.com", "password": "Test123!" }
   ```

2. **Listar usuarios** para obtener el ID:

   ```
   GET /api/v1/users
   ```

3. **Obtener el usuario creado**:

   ```
   GET /api/v1/users/1
   ```

4. **Actualizar el usuario**:

   ```
   PUT /api/v1/users/1
   Body: { "name": "Test User Updated" }
   ```

5. **Eliminar (deshabilitar) el usuario**:
   ```
   DELETE /api/v1/users/1
   ```
