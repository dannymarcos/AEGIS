# KnowMe — Auditoría de migración a PostgreSQL + Prisma

## Estado actual del repositorio recibido

Después de revisar el código fuente, este repositorio **no corresponde** a un clon de YouTube en MERN:

- Es una aplicación **Python/Flask** (no Node/Express + React).
- Usa `Flask-SQLAlchemy` y migraciones SQL manuales en `migrations/*.sql`.
- No contiene `package.json`, `src/` de React, controladores de Express, ni configuración de Prisma.
- No se encontraron integraciones con MongoDB ni Firebase dentro del código existente.

## Verificación técnica realizada

Se inspeccionaron los archivos principales del backend actual:

- `main.py`: arranque de servidor Flask.
- `requirements.txt`: dependencias Python.
- `docker-compose.yml`: servicio Flask en puerto 8080.
- Carpeta `migrations/`: scripts SQL para tablas de un dominio financiero/trading.

## Impacto sobre el requerimiento

Con el repositorio actual **no se puede ejecutar** la migración solicitada (MongoDB/Firebase → PostgreSQL/Prisma) porque:

1. No existe backend Node/Express para migrar a Prisma.
2. No existen modelos de YouTube (`User`, `Video`, `Comment`, `Like`, `Subscription`, `View`) en el código recibido.
3. No hay endpoints MERN que preservar en este árbol de proyecto.

## Qué se necesita para completar exactamente tu pedido

Para entregar la migración completa y funcional solicitada, necesito el repositorio correcto de KnowMe (el clon de YouTube MERN) con:

- Backend Node/Express actual.
- Modelos/schemas actuales (Mongo/Mongoose).
- Endpoints existentes (auth, videos, comments, likes, subscriptions, views).
- Integración actual de Firebase (upload/storage/auth si aplica).

Con ese repo sí puedo entregar:

- `schema.prisma` completo.
- Migraciones Prisma.
- Refactor de servicios/controladores a PostgreSQL.
- `.env.example` actualizado.
- Instrucciones `npm install`, `npx prisma migrate dev`, `npm run dev`.
- Validación endpoint por endpoint sin remover features.
