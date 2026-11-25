# Frontend System Architecture — Todo App v2 (Next.js 16)

Dokumen ini menjabarkan arsitektur teknis frontend menggunakan **Next.js 16** (App Router + React 19.2 + TypeScript) yang terintegrasi secara presisi dengan backend **Rust Salvo 1.1 + SeaORM 2.0**.

---

## 1. Tech Stack & Keputusan Teknis

| Layer | Teknologi | Alasan Pemilihan |
| :--- | :--- | :--- |
| **Framework** | **Next.js 16** (App Router, Turbopack) | Server Components, Route Handlers (BFF), Cache Components (`"use cache"`), dan performa build tinggi. |
| **UI & Styling** | **Tailwind CSS v4** + **Radix UI Primitives** | Kontrol penuh atas desain *Swiss-Utilitarian* tanpa gaya generik; aksesibilitas dialog, popover, dropdown, dan tabs terjamin. |
| **Server State** | **TanStack Query v5** | Caching per-modul, *optimistic updates* (checkbox, drag-and-drop Kanban, progress, vote), pagination, dan sinkronisasi dengan WebSocket. |
| **Client UI State** | **Zustand** (minimal) | State lokal non-server: `activeTaskId` (inspector), `sidebarCollapsed`, `commandPaletteOpen`, `viewMode` (`list`/`board`). |
| **Forms & Validation** | **React Hook Form** + **Zod** | Validasi client-side yang selaras 1:1 dengan aturan Scrutiny backend, plus pemetaan error `details[{ field, issue }]`. |
| **Drag & Drop** | **@dnd-kit/core** | Ringan, aksesibel via keyboard, untuk Kanban Board (`PATCH /tasks/{id}`). |
| **Date Handling** | **date-fns** | Parsing & formatting ISO 8601 UTC dari backend ke zona waktu lokal browser. |
| **Icons** | **lucide-react** | Ikon monoline presisi (`strokeWidth={1.75}`). |

---

## 2. Arsitektur Keamanan & Autentikasi (BFF Cookie Pattern)

Backend Rust menggunakan **Dual-Token JWT** (`access_token` 1 jam, `refresh_token` 30 hari dengan *Refresh Token Rotation* & *Instant Revocation*). Menyimpan `refresh_token` di `localStorage` rentan terhadap serangan XSS.

Oleh karena itu, Next.js 16 berperan sebagai **Backend-for-Frontend (BFF)** tipis khusus untuk manajemen sesi:

```text
Browser (Client)
  │
  ├─► POST /api/auth/login (Next.js Route Handler)
  │     ├─► POST {RUST_API}/api/v1/auth/login
  │     └─◄ Set-Cookie: refresh_token (HttpOnly, Secure, SameSite=Lax, Path=/api/auth)
  │         Set-Cookie: access_token  (HttpOnly, Secure, SameSite=Lax, Path=/)
  │
  ├─► Request API Biasa: /api/proxy/[...path] (Next.js Route Handler)
  │     ├─► Baca `access_token` dari HttpOnly Cookie
  │     ├─► Jika 401 UNAUTHORIZED → otomatis tukar `refresh_token` ke `/auth/refresh`
  │     │   (Single-flight lock agar tidak terjadi race condition rotation!)
  │     ├─► Update kedua cookie dengan token baru hasil rotation
  │     └─► Forward request ke Rust Backend & teruskan status/body/ETag
  │
  └─► Koneksi Real-Time (WS / SSE):
        ├─► GET /api/auth/ws-token (Route Handler mengembalikan `access_token` short-lived ke memory JS)
        └─► Connect langsung ke `ws://{RUST_HOST}/api/v1/notifications/ws?token=<access_token>`
```

### Mengapa Pola Ini Krusial untuk Backend Rust Ini?
1. **Proteksi Refresh Token Rotation**: Karena backend langsung mencabut `refresh_token` lama begitu `/auth/refresh` dipanggil, proxy server-side (dengan mekanisme *in-flight deduplication* per sesi) mencegah dua request paralel mengirim refresh token yang sama dan memicu error `401 Token telah dicabut`.
2. **Kompatibilitas Real-Time**: Browser `WebSocket` dan `EventSource` tidak bisa mengirim custom header `Authorization` dan tidak selalu bisa di-proxy secara efisien lewat serverless route. Endpoint `/api/auth/ws-token` memberikan `access_token` secara *in-memory only* (tidak pernah ditulis ke `localStorage`) agar klien bisa membuka koneksi langsung ke Rust `NotificationHub` via `?token=`.
3. **Route Protection (`proxy.ts`)**: Menggunakan file `proxy.ts` (konvensi Next.js 16) untuk memeriksa keberadaan cookie sesi pada rute privat (`/tasks`, `/classifications`, `/connections`, `/activity`, `/settings`) dan mengarahkan user yang belum login ke `/login`.

---

## 3. Normalisasi Kontrak API & Penanganan *Quirks* Backend

Berdasarkan audit `API_DOC.md`, terdapat beberapa detail spesifik pada backend yang **wajib** ditangani secara terpusat di lapisan `lib/api/client.ts`:

### 3.1 Perbedaan Envelope Response
- **Mayoritas Endpoint**: Membungkus payload dalam `{ "data": T }` atau `{ "data": T[], "meta": PaginationMeta }`.
- **Endpoint Root-Level (Tanpa Wrapper `data`)**:
  - `POST /auth/register` → mengembalikan `{ user_id, username, email, ... }` langsung di root.
  - `POST /auth/login` & `POST /auth/refresh` → mengembalikan `{ access_token, refresh_token, expires_in, user }` langsung di root.
  - `POST /tasks` (`201 CREATED`) → mengembalikan objek Task langsung di root (`{ task_id, user_id, title, ... }`), sedangkan `GET /tasks/{id}` dan `PATCH /tasks/{id}` membungkusnya di `{ "data": { ... } }`.

**Solusi di `apiClient`**:
```ts
// Helper unwrapping yang aman terhadap envelope { data } maupun root object
export function unwrapData<T>(payload: { data?: T } | T): T {
  if (payload && typeof payload === 'object' && 'data' in payload && !('meta' in payload)) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}
```

### 3.2 Error Handling Terstruktur
Setiap error backend mengikuti skema:
```ts
export interface ApiErrorResponse {
  error: {
    code:
      | 'VALIDATION_ERROR'
      | 'UNAUTHORIZED'
      | 'FORBIDDEN'
      | 'NOT_FOUND'
      | 'METHOD_NOT_ALLOWED'
      | 'CONFLICT'
      | 'RATE_LIMITED'
      | 'REQUEST_TIMEOUT'
      | 'INTERNAL_ERROR';
    message: string;
    details: Array<{ field: string; issue: string }> | null;
  };
}
```
- `VALIDATION_ERROR` (`400`): Dipetakan otomatis ke `form.setError(detail.field, { message: detail.issue })`.
- `RATE_LIMITED` (`429`): Menampilkan banner/toast cooldown berbasis header `X-RateLimit-Reset` dan menonaktifkan retry otomatis TanStack Query.
- `FORBIDDEN` (`403`): Menampilkan pesan hak akses yang jelas dan memicu sinkronisasi ulang detail task.

### 3.3 Multipart Upload vs JSON pada Attachments
`POST /api/v1/tasks/{task_id}/attachments` mendukung dua `Content-Type`:
- Unggah file fisik: `FormData` dengan key `file` (jangan set header `Content-Type` manual agar browser menambahkan boundary).
- Tautan eksternal: `application/json` dengan `{ file_url, file_type }`.
- Asset yang dikembalikan berupa path relatif (`/uploads/{uuid}.{ext}`) di-resolve dengan helper `resolveAssetUrl(path)` agar mengarah ke `NEXT_PUBLIC_API_ORIGIN` (atau lewat proxy `/api/uploads/[...path]`).

---

## 4. Arsitektur Real-Time (Dual-Transport: WebSocket Primary + SSE Fallback)

Backend menyediakan dua transport:
1. **WebSocket** (`GET /api/v1/notifications/ws?token=...`): Full-duplex, mendukung client command `{"type": "ping"}` dan `{"type": "mark_read", "notification_id": 42}`.
2. **SSE** (`GET /api/v1/notifications/stream?token=...`): Unidirectional dengan keep-alive 15 detik.

### Strategi Klien (`RealtimeProvider`)
- **Primary**: Membuka koneksi WebSocket saat user terautentikasi.
- **Heartbeat & Reconnect**: Memanfaatkan ping-pong 30 detik dan *exponential backoff* (`1s → 2s → 4s → 8s → max 30s`) jika koneksi terputus. Jika token kedaluwarsa saat reconnect, panggil `/api/auth/ws-token` ulang.
- **Fallback**: Jika lingkungan jaringan memblokir WebSocket (gagal upgrade 2 kali berturut-turut), otomatis turun ke `EventSource` (SSE).
- **Integrasi TanStack Query Cache**:
  - Saat menerima `notification.created`:
    1. Tambahkan item ke cache `['notifications']` secara instan.
    2. Increment cache `['notifications', 'unread-count']`.
    3. Jika `notification_type === 'Share'` atau `'Comment'`, lakukan `queryClient.invalidateQueries({ queryKey: ['tasks'] })` agar task baru/komentar langsung sinkron.
    4. Tampilkan toast notifikasi.
  - Saat user mengklik *Mark as Read* di UI: kirim `{"type": "mark_read", "notification_id": id}` via WebSocket (fallback ke `PATCH /notifications/{id}` jika sedang dalam mode SSE).

---

## 5. Strategi Caching (Next.js 16 + TanStack Query + Rust Moka/ETag)

| Jenis Data | Endpoint | Strategi Cache | Invalidasi |
| :--- | :--- | :--- | :--- |
| **Master Lookups** | `/statuses`, `/priorities`, `/external-apps`, `/enums` | Server-side Next.js `"use cache"` (`cacheLife('hours')`) + TanStack `staleTime: Infinity` + hormati `ETag / 304`. | Hampir statis; revalidate berkala. |
| **Taksonomi** | `/tags`, `/categories`, `/labels` | TanStack `staleTime: 5 min` (selaras dengan `AppDataCache` TTL 300s di Rust). | Invalidate langsung saat mutasi `POST`/`PATCH`/`DELETE`. |
| **Task List** | `/tasks?...` | TanStack `staleTime: 30s`, `placeholderData: keepPreviousData` (transisi halaman & filter mulus tanpa kedip). | Optimistic update + invalidate pada mutasi & event WS. |
| **Task Detail & Sub-resources** | `/tasks/{id}`, `/subtasks`, `/notes`, `/comments`, `/votes`, `/shares`, `/history/*` | Fetch paralel per tab aktif di *Task Inspector* (`enabled: activeTab === '...'`). | Optimistic untuk subtask toggle, progress, dan vote. |
| **User Profile & Settings** | `/users/me`, `/users/me/settings` | Hydrate awal dari Server Component layout, simpan di TanStack `staleTime: 5 min`. | Optimistic saat toggle tema/bahasa. |

---

## 6. Struktur Direktori Proyek (Feature-Sliced Next.js 16)

```text
src/
├── proxy.ts                          # Next.js 16 route guard (cek sesi cookie)
├── app/
│   ├── layout.tsx                    # Root layout (Fonts, Theme, QueryProvider)
│   ├── (auth)/                       # Route group publik
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (workspace)/                  # Route group terproteksi (App Shell)
│   │   ├── layout.tsx                # Sidebar, RealtimeProvider, CommandPalette
│   │   ├── tasks/page.tsx            # List / Kanban Workspace + Task Inspector
│   │   ├── classifications/page.tsx  # CRUD Tags, Categories, Labels
│   │   ├── connections/page.tsx      # Accepted / Pending / Blocked Users
│   │   ├── notifications/page.tsx    # Full Notification Center
│   │   ├── activity/page.tsx         # Audit Activity Logs
│   │   └── settings/page.tsx         # Account, Profile, Password, Preferences
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts        # Set HttpOnly cookies
│       │   ├── register/route.ts
│       │   ├── logout/route.ts       # Revoke di Rust + clear cookies
│       │   └── ws-token/route.ts     # Return short-lived access_token utk WS/SSE
│       └── proxy/[...path]/route.ts  # Authenticated proxy + auto refresh rotation
├── components/
│   ├── ui/                           # Primitif Radix + Tailwind (Button, Dialog, Drawer, Input, Badge)
│   ├── layout/                       # Sidebar, Topbar, CommandPalette, ConnectionStatus
│   └── shared/                       # EmptyState, ErrorBoundary, ConfirmDialog
├── features/                         # Domain modules (1:1 dengan modul backend)
│   ├── auth/                         # Schemas, LoginForm, RegisterForm
│   ├── tasks/                        # TaskList, KanbanBoard, TaskRow, TaskInspector, QuickCreateModal
│   ├── subtasks/                     # SubtaskList, SubtaskItem
│   ├── notes/                        # NoteList, NoteEditor, NoteHistoryDrawer
│   ├── comments/                     # CommentThread, CommentComposer
│   ├── attachments/                  # AttachmentDropzone, AttachmentCard
│   ├── scheduling/                   # ReminderPanel, RecurrenceForm
│   ├── context/                      # LocationPicker, ExternalIntegrationList
│   ├── collaboration/                # ShareTaskDialog, VoteControl
│   ├── classifications/              # TagManager, CategoryManager, LabelManager
│   ├── audit/                        # TaskAuditTimeline, ActivityLogTable
│   ├── connections/                  # ConnectionTabs, UserSearchDialog
│   └── notifications/                # NotificationPopover, RealtimeProvider
├── lib/
│   ├── api/
│   │   ├── client.ts                 # Fetch wrapper, unwrapData, ApiError parser
│   │   ├── endpoints.ts              # Typed route builders untuk seluruh 20 modul
│   │   └── types.ts                  # TypeScript interfaces (snake_case DTOs)
│   ├── utils/                        # cn(), formatDate(), resolveAssetUrl(), permissions.ts
│   └── query-client.ts               # Konfigurasi default TanStack Query
└── stores/
    └── workspace-store.ts            # Zustand (activeTaskId, viewMode, filters)
```

---

## 7. Konfigurasi Environment & Deployment

### `.env.local` (Frontend)
```bash
# URL internal server-to-server (digunakan oleh Next.js Route Handlers & Server Components)
RUST_API_BASE_URL=http://localhost:8080

# URL publik khusus untuk WebSocket/SSE dan akses aset statis /uploads
NEXT_PUBLIC_WS_BASE_URL=ws://localhost:8080
NEXT_PUBLIC_ASSET_BASE_URL=http://localhost:8080

# Mengaktifkan tombol Quick Demo Login & Demo Seeder di halaman login (matikan di production)
NEXT_PUBLIC_ENABLE_DEMO_MODE=true
```

### Kualitas & Testing Frontend
1. **Type Safety**: Seluruh DTO `snake_case` dapat di-generate otomatis dari OpenAPI 3.1 backend (`http://localhost:8080/api-doc/openapi.json`) menggunakan `openapi-typescript` agar kontrak frontend–backend selalu sinkron 100%.
2. **Unit & Component Tests**: Vitest + React Testing Library untuk helper hak akses (`permissions.ts`), `unwrapData`, dan form validasi Zod.
3. **E2E Tests**: Playwright menjalankan skenario inti terhadap backend Docker Compose (`--seed`): Login → Create Task → Drag Kanban → Add Subtask & Note → Share ke `collab_user` → Verifikasi notifikasi real-time masuk.