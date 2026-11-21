# App nativa de Android (TaxiCentral)

Cascarón nativo (Capacitor) que abre https://agenda-taxi.pages.dev y le agrega lo que una página web no puede:
ubicación del taxista con la pantalla apagada (servicio en primer plano con notificación fija).

- La agenda detecta que corre dentro de la app nativa (`window.Capacitor`) y usa el plugin
  `BackgroundGeolocation` para mandar `pos_taxi` mientras haya un servicio en curso.
- GitHub Actions (`.github/workflows/app-nativa.yml`) compila el APK de prueba y lo publica en Releases.
- Para Play Store: cambiar `appId` al paquete de la app ya publicada y firmar con su llave (secretos de GitHub:
  `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`). Las contraseñas las pone el dueño en GitHub.
