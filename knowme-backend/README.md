# KnowMe Backend (PostgreSQL + Prisma)

Backend modular con:
- Auth JWT unificada
- Video platform (videos largos + shorts)
- Ads + revenue tracking
- Social feed independiente (posts/stories/follows/timeline)
- Real-time chat + calls (Socket.io + WebRTC + PostgreSQL)
- End-to-end encryption para mensajería y signaling de llamadas

## Setup

```bash
cd knowme-backend
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

## Variables de entorno

- `DATABASE_URL`: conexión PostgreSQL
- `JWT_SECRET`: secreto JWT
- `JWT_EXPIRES_IN`: expiración del token
- `CREATOR_SHARE_PERCENT`: reparto para creador (default 40)
- `ICE_SERVERS_JSON`: JSON array para configuración ICE/STUN/TURN
- `SOCKET_ALLOWED_ORIGIN`: origin permitido para Socket.io

Ejemplo ICE:
```json
[{"urls":["stun:stun.l.google.com:19302"]}]
```

## STEP 6 — End-to-End Encryption

### Implementación
- Par de claves pública/privada por usuario generado en cliente (WebCrypto RSA-OAEP).
- Public key publicada en backend (`UserCryptoKey`), private key queda en cliente.
- Intercambio seguro de clave de chat vía envelopes (`ChatKeyEnvelope`) por usuario.
- Mensajes cifrados client-side (AES-GCM), DB guarda solo:
  - `encryptedPayload`
  - `encryptionIv`
  - metadatos de cifrado
- No se persiste texto plano en `ChatMessage` para mensajes cifrados.
- Signaling WebRTC cifrado end-to-end (offer/answer/ICE cifrados con clave de chat).

### Crypto endpoints
- `PUT /api/crypto/keys/public`
- `GET /api/crypto/keys/public/:userId`
- `POST /api/crypto/chats/envelopes`
- `GET /api/crypto/chats/:chatId/envelopes/me?keyVersion=1`

### Chat/Calls endpoints
- `GET /api/chat`
- `POST /api/chat/direct`
- `POST /api/chat/group`
- `GET /api/chat/:chatId/messages`
- `POST /api/chat/:chatId/read`
- `POST /api/chat/messages/:messageId/reactions`
- `DELETE /api/chat/messages/:messageId/reactions`
- `POST /api/chat/messages/:messageId/delete-for-everyone`
- `GET /api/calls/ice-config`
- `GET /api/calls/history`
- `POST /api/calls`
- `POST /api/calls/:callId/end`

### Socket events
- Chat realtime: `chat:*`
- Calls signaling cifrado: `call:initiate`, `call:accept`, `call:reject`, `call:ice-candidate`, `call:end`


## STEP 7 — Monetization System

### Incluye
- Tabla de configuración de monetización (`MonetizationConfig`) para porcentaje de creador configurable por admin.
- Dashboard de creador con métricas de ingresos, breakdown por fuente y timeline diario.
- Registro de revenue events para unificar lógica de reparto (`RevenueLedger`).

### Endpoints
- `GET /api/monetization/config`
- `PUT /api/monetization/config` (ADMIN)
- `GET /api/monetization/dashboard/me`
- `GET /api/monetization/dashboard/:userId` (ADMIN)
- `POST /api/monetization/revenue/events` (ADMIN)

### Notas
- `User.role` soporta `USER` y `ADMIN`.
- El primer usuario que se registra queda como `ADMIN` automáticamente.
- También puedes forzar admins con `ADMIN_EMAILS` en entorno.
- UI de dashboard disponible en `/creator-dashboard`.

## Auth UI + Matrix onboarding

- Pantalla principal `/` con login/registro unificado.
- Efecto visual estilo Matrix (lluvia de letras/números) en onboarding.
- Al autenticarse, redirección automática a `/admin` (admin) o `/chat` (usuario).

## CloudBot con memoria (chat & calls helper)

- Memoria persistente por usuario en PostgreSQL (`AssistantMemory`, `AssistantMessage`).
- Endpoints:
  - `GET /api/assistant/memory`
  - `POST /api/assistant/message`
- Integrado en `/chat` para asistir en gestión de mensajes/llamadas y recordar contexto.


## STEP 8 — Admin Panel

### Incluye
- Analytics globales (`/api/admin/analytics`).
- Cola de moderación y reportes (`/api/admin/moderation/*`).
- Gestión de usuarios (`/api/admin/users`, suspensión y cambio de rol).
- Revenue tracking administrativo (`/api/admin/revenue/tracking`).
- Panel web inicial en `/admin`.

## STEP 9 — UI Premium

- Tema oscuro con paleta neutra elegante (`src/public/premium.css`).
- Layout moderno por tarjetas y KPIs.
- Responsive para dashboard/admin/chat/social/shorts.
- Sin colores estilo YouTube.

## STEP 10 — Security & Scale

- Rate limiting por API y auth (`express-rate-limit`).
- RBAC con roles `USER`/`ADMIN` + middleware admin.
- Bloqueo de cuentas suspendidas en HTTP y Socket.
- Redis-ready cache bootstrap (`REDIS_URL`).
- Docker + compose para despliegue con PostgreSQL + Redis.
- Entorno de producción: `.env.production.example`.

## Política de anuncios (YouTube/Social)

- Intervalos soportados: **15 min** o **30 min** (`Advertisement.intervalMin`).
- Duración fija de anuncio: **60 segundos** (`Advertisement.durationSec=60`).
- Inserción en:
  - feed tipo YouTube (`GET /api/videos`, `GET /api/shorts/feed`)
  - feed tipo Facebook (`GET /api/social/timeline`)
- Búsqueda con anuncios en social timeline mediante `q` (`/api/social/timeline?q=...`).
- Filtro básico anti contenido no permitido en creación de anuncios (términos adultos/apuestas).

## Dónde probar

1. Local dev:
```bash
cd knowme-backend
cp .env.example .env
npm install
npx prisma migrate dev --name step8_10
npm run dev
```
2. URLs:
- Admin panel: `http://localhost:5000/admin`
- Auth/registro: `http://localhost:5000/`
- Creator dashboard: `http://localhost:5000/creator-dashboard`
- Social: `http://localhost:5000/social`
- Shorts: `http://localhost:5000/shorts`
- Chat/Calls: `http://localhost:5000/chat`

3. Docker (prod-like):
```bash
cd knowme-backend
docker compose up --build
```
