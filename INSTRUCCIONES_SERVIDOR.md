# Paquete de servidor listo

Después de ejecutar `npm run build`, Next.js genera un servidor standalone dentro de `.next/standalone`.

Para ejecutarlo desde el código fuente:

```bash
npm start
```

Para usar el ZIP `KUVO-SERVIDOR-LISTO.zip`:

1. Descomprimir.
2. Copiar `.env.example` como `.env` y completar las variables.
3. Ejecutar:

```bash
node start-kuvo.mjs
```

El servidor escucha por defecto en `0.0.0.0:3000`. Podés cambiar el puerto con `PORT` y el host con `KUVO_HOST`.
