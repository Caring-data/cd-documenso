# Certificado de firma en el servidor

Para que la firma de documentos funcione en producción solo necesitas:

1. **Un archivo .p12** (certificado + clave privada con contraseña).
2. **La contraseña** en el `.env` como `NEXT_PRIVATE_SIGNING_PASSPHRASE`.
3. **El .p12 accesible** por la app (archivo en el host o contenido en base64 en el `.env`).

---

## Crear el certificado directamente en el servidor (recomendado)

Conectado al servidor, genera el .p12 ya en `/opt/documenso` (la contraseña usada aquí es `documenso123`; si la cambias, pon la misma en el .env):

```bash
sudo mkdir -p /opt/documenso

# Clave y certificado autofirmado (rutas absolutas, puedes ejecutar desde cualquier sitio)
sudo openssl req -x509 -newkey rsa:2048 -days 365 -nodes \
  -keyout /opt/documenso/key.pem -out /opt/documenso/cert.pem \
  -subj "/C=ES/O=CaringData/CN=Documenso Signing"

# Empaquetar en .p12 con contraseña
sudo openssl pkcs12 -export -out /opt/documenso/cert.p12 \
  -inkey /opt/documenso/key.pem -in /opt/documenso/cert.pem \
  -passout pass:documenso123

# Permisos para que el contenedor pueda leerlo
sudo chmod 644 /opt/documenso/cert.p12

# Borrar intermedios (opcional)
sudo rm -f /opt/documenso/key.pem /opt/documenso/cert.pem
```

El certificado queda en `/opt/documenso/cert.p12`. Solo falta configurar la misma contraseña en el .env (paso siguiente).

---

## Crear el certificado en tu máquina (luego copiar)

Si prefieres generarlo en tu PC y después subirlo:

```bash
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes \
  -subj "/C=ES/O=CaringData/CN=Documenso Signing"

openssl pkcs12 -export -out cert.p12 -inkey key.pem -in cert.pem \
  -passout pass:documenso123

rm -f key.pem cert.pem
```

Luego copia `cert.p12` al servidor en `/opt/documenso/cert.p12` (por ejemplo con `scp`) y en el host: `sudo chmod 644 /opt/documenso/cert.p12`.

---

## Configurar el .env (Opción A: archivo en /opt/documenso)

1. **En el .env del entorno** (production/staging/development en `/home/caringdata/${DEPLOY_ENV}/caring_data_documenso/.env`):

   ```bash
   NEXT_PRIVATE_SIGNING_TRANSPORT="local"
   NEXT_PRIVATE_SIGNING_PASSPHRASE="documenso123"
   NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH="/opt/documenso/cert.p12"
   ```

   Si usas exactamente `/opt/documenso/cert.p12`, la app ya toma esa ruta por defecto en producción y no es obligatorio poner `NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH`. Puedes dejarlo igual para que coincida con development y que quede explícito.

El compose ya monta `/opt/documenso/cert.p12` del host en el contenedor.

---

## Opción B: Certificado en el .env (base64)

Si prefieres no usar un archivo en disco:

1. **Generar base64 del .p12** (en el servidor o donde tengas el .p12):

   ```bash
   base64 -w0 cert.p12
   ```

2. **En el .env**:

   ```bash
   NEXT_PRIVATE_SIGNING_TRANSPORT=local
   NEXT_PRIVATE_SIGNING_PASSPHRASE=documenso123
   NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS=<pegamos_aquí_el_base64>
   ```

En este caso no hace falta el volumen del cert en el compose. Protege el .env (permisos, backups, logs).

---

## Comprobar que funciona

Tras el deploy:

- `https://<DOMAIN>:4443/api/certificate-status` debe indicar que el certificado está disponible.
- Si es así, la firma de documentos debería funcionar con normalidad.

---

## Resumen

| Qué             | Dónde / Cómo                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------- |
| Certificado     | Un .p12 creado con el bloque de comandos de arriba                                            |
| En servidor     | Opción A: `/opt/documenso/cert.p12` + compose actual                                          |
| Contraseña      | `NEXT_PRIVATE_SIGNING_PASSPHRASE` en el .env                                                  |
| Transporte      | `NEXT_PRIVATE_SIGNING_TRANSPORT=local` en el .env                                             |
| Ruta (opcional) | `NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH="/opt/documenso/cert.p12"` si quieres dejarla explícita |

---

## Referencias

- `deployment/compose.yml` — volumen del certificado (opción A).
- `packages/signing/transports/local-cert.ts` — uso del .p12 o del contenido base64.
