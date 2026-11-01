# Agenda Taxi — notas para publicar

- Todo vive en `index.html` (agenda de taxistas/admin + app del cliente en /taxicel/ y demás marcas).
- Al publicar un cambio: copiar a `index-NNN.html` (respaldo numerado) y **subir el número de versión** en dos lugares:
  `window.APPV='NNN'` dentro de `index.html` y `{"v":"NNN"}` en `ver.json`.
  Así los celulares y la app TaxiCentral (que abre https://agenda-taxi.pages.dev) se recargan solos.
- La función `push` de Supabase se publica desde `supabase/functions/push/index.ts` (la función en Supabase solo importa ese archivo de GitHub por commit).
- Cloudflare Pages publica solo al hacer push a `main`.
