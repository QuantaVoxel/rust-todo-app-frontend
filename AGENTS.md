<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENT.md — AI Coding Agent Guidelines (Todo App v2 Frontend)

Dokumen ini adalah panduan operasional wajib bagi setiap AI coding agent yang bekerja pada repositori frontend **Todo App v2** (**Next.js 16**). Selalu rujuk [PRD](PRD.md), [DESIGN](DESIGN.md), dan [ARCHITECTURE](ARCHITECTURE.md) sebagai *source of truth* sebelum menulis atau mengubah kode.

---

## 1. Konteks Proyek & Tech Stack

- **Framework**: Next.js 16 (App Router, React 19.2, TypeScript strict mode, Turbopack).
- **Styling & UI**: Tailwind CSS v4 + Radix UI Primitives + `lucide-react` (`strokeWidth={1.75}`).
- **Data Fetching & State**:
    - **TanStack Query v5** untuk semua server state & *optimistic updates*.
    - **Zustand** hanya untuk UI state lokal (`activeTaskId`, `viewMode`, `sidebarCollapsed`, `commandPaletteOpen`).
- **Forms & Validation**: React Hook Form + Zod (selaras 1:1 dengan validasi Scrutiny backend).
- **Drag & Drop**: `@dnd-kit/core` (Kanban Board).
- **Backend**: Rust Todo App v2 (Salvo 1.1 + SeaORM 2.0 + PostgreSQL 16) pada base path `/api/v1` (20 modul, 88+ endpoints, dual-transport WebSocket & SSE).

---

## 2. Aturan Desain Keras (Anti-AI-Slop Mandate)

Arah visual adalah **Swiss-Utilitarian Craft**. Kamu **DILARANG KERAS** menghasilkan UI bergaya template AI generik.

### ❌ Dilarang (Hard Reject)
- **TIDAK ADA** gradien ungu/biru/cyan neon pada tombol, teks, atau banner.
- **TIDAK ADA** kartu `rounded-3xl`, *glassmorphism* berlebihan (`backdrop-blur-xl`), atau *drop shadow* besar.
- **TIDAK ADA** *fake KPI cards*, grafik donat dekoratif, atau emoji di judul menu/header.
- **TIDAK ADA** animasi memantul (*bouncy spring*) atau efek *glow* saat hover.

### ✅ Wajib Diterapkan
- **Surface & Border**: Warna solid dengan garis pemisah tipis `1px` (`--border-hairline`), radius geometris ketat (`6px–10px`).
- **Warna**:
    - Light Mode (Warm Paper): Canvas `#F7F6F3`, Surface `#FFFFFF`, Subtle `#F1EFEA`, Ink `#141416`.
    - Dark Mode (Obsidian Ink): Canvas `#0F1012`, Surface `#16171A`, Subtle `#1E2024`, Ink `#F4F4F5`.
    - **Single Accent**: Swiss Vermilion (`#D9481F` light / `#EA5E36` dark) — hanya untuk Primary CTA, active indicator, focus ring, dan unread badge.
- **Tipografi**: `Plus Jakarta Sans` / `Geist` untuk UI, `Geist Mono` / `JetBrains Mono` dengan `tabular-nums` untuk Task ID (`#42`), tanggal, persentase progress, vote count, koordinat, dan shortcut (`⌘K`).
- **Transisi**: Cepat dan presisi (`120ms–180ms cubic-bezier(0.2, 0, 0, 1)`).
- **Layout**: 3-Pane Adaptive Workspace (Sidebar `240px`, Main Fluid, Contextual Task Inspector `440px–520px` dengan 4 tab: `Work`, `Discuss`, `Schedule & Context`, `History`).

---

## 3. Aturan Arsitektur Next.js 16 & Keamanan

1. **Route Guard Next.js 16**: Gunakan `src/proxy.ts` (bukan `middleware.ts` legacy) untuk mengecek cookie sesi pada rute `(workspace)`.
2. **BFF Auth Cookie Pattern**:
    - **JANGAN PERNAH** menyimpan `refresh_token` atau `access_token` di `localStorage` atau `sessionStorage`.
    - Login, Register, dan Logout wajib melalui Next.js Route Handlers (`/api/auth/*`) yang menyetel `HttpOnly`, `Secure`, `SameSite=Lax` cookies.
    - Seluruh request REST API dari browser wajib melalui `/api/proxy/[...path]` agar Next.js server menyisipkan header `Authorization: Bearer` dan menangani *silent refresh rotation* dengan *single-flight lock*.
3. **Real-Time (WebSocket + SSE)**:
    - Klien mengambil short-lived `access_token` ke memori JS via `GET /api/auth/ws-token`.
    - Prioritaskan WebSocket (`ws://.../api/v1/notifications/ws?token=...`) dengan command `{"type":"ping"}` dan `{"type":"mark_read","notification_id":id}`.
    - Sediakan fallback otomatis ke SSE (`GET /api/v1/notifications/stream?token=...`) jika WS gagal upgrade 2 kali.
4. **Caching**:
    - Gunakan `"use cache"` di Next.js 16 + `staleTime: Infinity` untuk master lookups (`/statuses`, `/priorities`, `/external-apps`, `/enums`).
    - Hormati rate limit backend (`20 req/min` Auth, `120 req/min` API): selalu *debounce* input pencarian minimal `300ms` dan jangan gunakan polling untuk notifikasi.

---

## 4. Kontrak & *Quirks* Backend Rust (Wajib Diperhatikan)

Jangan mengasumsikan format API secara sembarangan. Patuhi detail aktual backend berikut:

1. **Penamaan Field**: Semua payload request & response menggunakan `snake_case`. Pertahankan `snake_case` pada DTO di `src/lib/api/types.ts`.
2. **Envelope Response Tidak Seragam**:
    - Mayoritas endpoint membungkus hasil di `{ "data": T }` atau `{ "data": T[], "meta": { page, per_page, total, total_pages } }`.
    - **Pengecualian Root-Level (TANPA wrapper `data`)**:
        - `POST /auth/register` (`201`)
        - `POST /auth/login` (`200`)
        - `POST /auth/refresh` (`200`)
        - `POST /tasks` (`201`) — *perhatikan bahwa `GET /tasks/{id}` dan `PATCH /tasks/{id}` tetap dibungkus `{ "data": ... }`*.
    - Selalu gunakan helper `unwrapData<T>()` di `src/lib/api/client.ts`.
3. **Format Error & Validasi Form**:
    - Semua error backend berbentuk `{ "error": { "code": "...", "message": "...", "details": [{ "field": "...", "issue": "..." }] | null } }`.
    - Saat menerima `400 VALIDATION_ERROR` dengan `details`, petakan langsung ke `form.setError(field, { message: issue })` di React Hook Form.
    - Saat menerima `429 RATE_LIMITED`, nonaktifkan retry TanStack Query dan tampilkan pesan cooldown.
4. **Attachments**:
    - `POST /tasks/{id}/attachments` menerima `multipart/form-data` (key `file`, jangan set header `Content-Type` manual) ATAU `application/json` (`{ file_url, file_type }`).
    - Path file lokal berbentuk relatif (`/uploads/{uuid}.{ext}`) — selalu bungkus dengan helper `resolveAssetUrl()`.
5. **Force Delete Taksonomi**:
    - `DELETE /tags/{id}`, `DELETE /categories/{id}`, dan `DELETE /labels/{id}` memerlukan dialog konfirmasi dan query `?force=true` jika masih tertaut ke task.
6. **Hak Akses Task (RBAC UI)**:
    - Selalu cek izin user melalui `src/lib/utils/permissions.ts` (`owner`, `edit`, `comment`, `view`):
        - `view`: read-only + vote.
        - `comment`: + komentar.
        - `edit`: + ubah status, prioritas, due date, progress, subtasks, notes.
        - `owner`: akses penuh termasuk archive/unarchive, sharing, dan delete task.

---

## 5. Struktur Direktori & Konvensi Kode

Ikuti struktur *Feature-Sliced* sesuai [ARCHITECTURE](ARCHITECTURE.md):

- `src/app/(auth)/*` — Halaman publik (`login`, `register`).
- `src/app/(workspace)/*` — Halaman privat (`tasks`, `classifications`, `connections`, `notifications`, `activity`, `settings`).
- `src/app/api/*` — BFF Route Handlers (`auth/*`, `proxy/[...path]`).
- `src/components/ui/*` — Primitif UI reusable (tanpa business logic).
- `src/features/<domain>/*` — Komponen, hooks TanStack Query, dan Zod schema per modul domain.
- `src/lib/api/*` — `client.ts`, `endpoints.ts`, `types.ts`.
- `src/stores/*` — Zustand stores.

### Standar Penulisan Kode
- Gunakan **TypeScript strict**; dilarang menggunakan `any` (gunakan `unknown` + type guard).
- Gunakan **Server Components** secara default; tambahkan `"use client"` hanya di leaf component yang butuh interaktivitas, hooks, atau browser API.
- Pisahkan query keys di setiap modul fitur (misal `taskKeys.all`, `taskKeys.list(filters)`, `taskKeys.detail(id)`).
- Setiap tombol ikon wajib memiliki `aria-label` dan dukungan fokus keyboard.

---

## 6. Alur Kerja & Verifikasi Agent

Sebelum menyatakan sebuah tugas selesai, agent wajib memastikan:

1. **Kontrak API**: Endpoint, method, query params, dan field `snake_case` sudah 100% cocok dengan [API_DOC](API_DOC.md).
2. **Desain**: Tidak ada pelanggaran *Anti-AI-Slop Manifesto* (cek warna, radius, tipografi `tabular-nums`, dan kontras light/dark mode).
3. **RBAC & Edge Cases**: Loading skeleton (`44px` row height), empty state, error state, dan pembatasan hak akses (`owner`/`edit`/`comment`/`view`) sudah ditangani.
4. **Typecheck & Lint**: Jalankan verifikasi proyek tanpa error:
   ```bash
   npm run typecheck
   npm run lint
   npm run test
   ```
5. **Scope Discipline**: Jangan melakukan refactor di luar cakupan tugas yang diminta user dan jangan menambahkan library baru tanpa alasan kuat yang selaras dengan `ARCHITECTURE.md`.