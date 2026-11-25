# Product Requirements Document (PRD) — Todo App v2 Frontend

- **Versi Dokumen**: 1.0.0
- **Target Platform**: Web Application (Desktop-first responsive, Mobile-ready)
- **Frontend Stack**: Next.js 16 (App Router, React 19.2, TypeScript)
- **Backend Engine**: Rust Todo App v2 (Salvo 1.1 + SeaORM 2.0 + PostgreSQL 16)
- **Base API**: `/api/v1` (20 Modul, 88+ REST Endpoints, SSE & WebSocket)

---

## 1. Visi & Tujuan Produk

Membangun aplikasi manajemen tugas (*task management*) kelas profesional yang cepat, tenang secara visual (*calm software*), dan mampu mengekspos seluruh kekuatan backend Rust—mulai dari manajemen task hierarkis, kolaborasi berbasis peran, pengingat & perulangan otomatis, hingga notifikasi *real-time*—tanpa terasa penuh atau membingungkan.

### Prinsip Produk
1. **Speed Over Ceremony**: Membuat, memfilter, dan memperbarui task harus bisa dilakukan dalam $\le 2$ interaksi (mendukung *keyboard shortcut* & *optimistic UI*).
2. **Progressive Disclosure**: Backend memiliki 20 modul kaya fitur. Tampilan utama tetap minimalis dan mudah dipindai; fitur lanjutan (Audit History, Locations, External Integrations, Note History) muncul secara kontekstual di *Task Inspector* tanpa mengotori daftar utama.
3. **Real-Time by Default**: Perubahan kolaborasi (share, komentar) dan hasil *background worker* (pengingat & task berulang) langsung tercermin di antarmuka tanpa *manual refresh*.

---

## 2. Persona & Matriks Hak Akses

### 2.1 Persona Utama
- **Solo Power User**: Mengelola pekerjaan harian, catatan riset, task berulang, dan pengingat dengan struktur tag/kategori/label yang rapi.
- **Team Collaborator**: Berbagi task dengan rekan kerja, berdiskusi di komentar, melakukan voting prioritas, dan memantau riwayat perubahan (*audit trail*).

### 2.2 Matriks Hak Akses Task (Sesuai Kontrak Backend)
UI **wajib** menyesuaikan kontrol interaktif (menyembunyikan atau menonaktifkan tombol) berdasarkan peran user terhadap task:

| Kapabilitas UI | Owner (`tasks.user_id`) | Shared `edit` | Shared `comment` | Shared `view` |
| :--- | :---: | :---: | :---: | :---: |
| Melihat detail, subtasks, notes, attachments, history | ✅ | ✅ | ✅ | ✅ |
| Voting (`up` / `down`) | ✅ | ✅ | ✅ | ✅ |
| Menulis komentar (`POST /comments`) | ✅ | ✅ | ✅ | ❌ |
| Edit/Hapus komentar milik sendiri | ✅ | ✅ | ✅ | ❌ |
| Hapus komentar orang lain | ✅ | ❌ | ❌ | ❌ |
| Ubah status, prioritas, due date, progress, subtasks, notes | ✅ | ✅ | ❌ | ❌ |
| Arsipkan / Batalkan Arsip (`archive` / `unarchive`) | ✅ | ❌ | ❌ | ❌ |
| Kelola Sharing (`PUT/DELETE /shares`) | ✅ | ❌ | ❌ | ❌ |
| Hapus Task permanen (`DELETE /tasks/{id}`) | ✅ | ❌ | ❌ | ❌ |

---

## 3. Ruang Lingkup Fitur (Pemetaan 20 Modul Backend)

### 3.1 Autentikasi & Keamanan Akun (Modul: `Auth`, `Users`, `Profiles`, `Settings`)
- **Registrasi**: Formulir lengkap sesuai validasi backend (`username`, `email`, `password` min 8 karakter, `first_name`, `last_name`, `phone_number`, opsional `avatar_url`).
- **Login & Demo Quick-Fill**: Login dengan email/password. Pada mode development/demo, sediakan tombol *one-click demo login* (`demo@todoapp.local` / `Password123!`) serta opsi pemicu `POST /api/v1/seed/demo` bila database kosong.
- **Session Lifecycle**: Refresh token otomatis (*silent rotation*) sebelum access token 1 jam kedaluwarsa, serta logout yang mencabut token di server (`POST /auth/logout`).
- **Profil & Pengaturan**:
  - Edit akun (`username`, `email`), ganti password (`POST /auth/change-password`), dan hapus akun permanen dengan dialog konfirmasi ketik ulang username (`DELETE /users/me`).
  - Edit profil (`PUT /users/me/profile`).
  - Preferensi key-value (`GET/PUT/DELETE /users/me/settings/{key}`) untuk `theme` (`light`/`dark`/`system`), `language` (`id`/`en`), `email_notifications`, dan `default_view` (`list`/`board`).

### 3.2 Workspace Task Utama (Modul: `Tasks`, `Lookups`)
- **Smart Views di Sidebar**:
  - **Inbox / All Tasks** (`scope=all&archived=false`)
  - **My Tasks** (`scope=owned&archived=false`)
  - **Shared with Me** (`scope=shared&archived=false`)
  - **Upcoming / Due Soon** (filter `due_after` & `due_before`)
  - **Archived** (`archived=true`)
- **Filter, Search & Sort**:
  - Pencarian *debounced* (`search`), filter `status_id`, `priority_id`, `tag_id`, rentang `due_date`, dan sorting (`due_date`, `created_at`, `priority` ascending/descending).
  - Paginasi menggunakan metadata `meta.page`, `meta.per_page`, `meta.total`, `meta.total_pages`.
- **Tampilan Ganda**:
  - **List View** (Default): Baris berdensitas tinggi dengan checkbox status, judul, badge prioritas, progress bar mini, tag, dan tanggal jatuh tempo.
  - **Kanban Board View**: Kolom dinamis berdasarkan `GET /statuses` (`pending`, `in_progress`, `completed`, `cancelled`) dengan *drag-and-drop* yang memanggil `PATCH /tasks/{id}`.
- **Quick Capture (`C` atau tombol `+ New Task`)**: Modal ringkas untuk membuat task baru lengkap dengan `title`, `description`, `status_id`, `priority_id`, `due_date`, dan multi-select `tag_ids`.

### 3.3 Task Inspector & Detail Mendalam
Mengklik sebuah task membuka panel *Inspector* (slide-over drawer atau split-pane) yang terorganisir rapi:

1. **Overview & Metadata**:
   - Edit inline `title`, `description`, `status_id`, `priority_id`, `due_date`.
   - **Progress Slider** (`0–100%`) terhubung ke `PUT /tasks/{id}/progress`.
   - **Voting Bar** (`GET/PUT/DELETE /tasks/{id}/vote`): Menampilkan jumlah `up`, `down`, dan status `my_vote`.
   - **Quick Actions**: Archive/Unarchive & Delete (khusus owner).
2. **Subtasks** (`Subtasks` Module):
   - Tambah subtask inline, toggle status (`pending` ↔ `completed`), ubah judul, dan hapus.
3. **Notes & Version History** (`Notes` Module):
   - Catatan internal task dengan tampilan *markdown-friendly* atau *clean plain text*.
   - Tombol **"View History"** pada setiap note yang memanggil `GET /notes/{note_id}/history` untuk melihat versi teks sebelumnya (tampilan *diff/timeline*).
4. **Comments** (`Comments` Module):
   - Thread diskusi kronologis dengan *edit* (penulis) dan *delete* (penulis/owner).
5. **Attachments** (`Attachments` Module):
   - *Drag-and-drop* unggah file fisik (`multipart/form-data`) maupun tautkan URL eksternal (`application/json`).
   - Preview gambar inline untuk file berformat image (`/uploads/{filename}`), dan tombol download untuk PDF/dokumen.
6. **Scheduling: Reminders & Recurrence** (`Reminders`, `Recurring Tasks` Modules):
   - Daftar pengingat waktu (`reminder_time`) dengan indikator status `notification_sent`.
   - Pengaturan perulangan 1:1 (`daily`, `weekly`, `monthly`, `yearly` + `next_due_date`) lengkap dengan keterangan bahwa server akan men-spawn task baru secara otomatis.
7. **Context: Locations & Integrations** (`Locations`, `External Integrations` Modules):
   - Menautkan lokasi dari master lokasi (`GET /locations`) atau membuat lokasi baru (nama + koordinat lat/long) serta menautkannya ke task.
   - Menautkan ID task eksternal (Trello, Jira, GitHub, Slack dari `GET /external-apps`).
8. **Collaboration & Sharing** (`Sharing`, `Users` Modules):
   - Pencarian user (`GET /users?search=...`) untuk mengundang kolaborator dan mengatur izin (`view`, `comment`, `edit`) atau mencabut akses.
9. **Audit Trail** (`Audit History` Module — Read-only):
   - Tab kronologis gabungan atau terpisah untuk riwayat perubahan **Status**, **Priority**, dan **Labels** (`GET /tasks/{id}/history/{status|priority|labels}`).

### 3.4 Klasifikasi & Taksonomi (Modul: `Tags`, `Categories`, `Labels`)
- Halaman manajemen khusus `/classifications` (atau sub-navigasi di sidebar) untuk CRUD **Tags**, **Categories** (dengan deskripsi), dan **Labels**.
- Penanganan penghapusan yang aman: jika item masih tertaut ke task, tampilkan dialog konfirmasi sebelum mengirim `?force=true`.
- *Tag/Category/Label picker* langsung di dalam *Task Inspector*.

### 3.5 Koneksi Sosial (Modul: `User Connections`)
- Halaman `/connections` dengan 3 tab sesuai enum backend: **Accepted**, **Pending**, **Blocked**.
- Cari pengguna (`GET /users?search=`) dan kirim permintaan koneksi (`POST /connections`).
- Terima atau blokir permintaan masuk (`PATCH /connections/{id}`), serta hapus koneksi.

### 3.6 Notifikasi Real-Time & Log Aktivitas (Modul: `Notifications`, `Activity Logs`)
- **Notification Center (Popover + Halaman `/notifications`)**:
  - Badge *unread count* real-time di header/sidebar (`GET /notifications/unread-count` + pembaruan langsung via WebSocket/SSE).
  - Filter `All` / `Unread`, aksi *Mark as read* (via WS `mark_read` atau REST `PATCH`), *Mark all read* (`POST /notifications/read-all`), dan hapus notifikasi.
  - Toast notification halus (non-intrusif) saat event `notification.created` masuk.
- **Activity Logs (`/activity`)**:
  - Tabel audit kronologis aktivitas user (`GET /activity-logs`) dengan filter `entity_type`, `action`, rentang waktu (`from`/`to`), dan paginasi.

### 3.7 System Health Indicator (Opsional / Footer Status)
- Indikator koneksi real-time (Connected / Reconnecting) yang halus di pojok bawah sidebar.
- Halaman status opsional untuk admin/developer yang menampilkan data `GET /api/v1/health/ready` dan `GET /api/v1/metrics`.

---

## 4. Non-Functional Requirements (NFR)

1. **Performa**:
   - First Contentful Paint (FCP) $< 1.2\text{s}$; interaksi klik task ke pembukaan Inspector $< 100\text{ms}$ (data list sudah ter-prefetch, sub-resource di-fetch paralel).
   - Memanfaatkan header `ETag` / `304 Not Modified` pada lookup endpoints (`/statuses`, `/priorities`, `/external-apps`, `/enums`).
2. **Keandalan Rate Limit**:
   - Menghormati batas backend (`20 req/menit` untuk Auth, `120 req/menit` untuk API umum). Debounce seluruh input pencarian minimal `300ms` dan hindari *polling* berlebih karena sudah ada WebSocket/SSE.
3. **Aksesibilitas (a11y)**:
   - Kontras teks minimal WCAG AA ($4.5:1$), navigasi penuh menggunakan keyboard (`Tab`, `Esc`, `⌘K`, panah atas/bawah), serta `aria-label` pada seluruh tombol ikon.
4. **Error Handling**:
   - Memetakan `error.details` (`[{ field, issue }]`) dari backend langsung ke pesan error per-field pada form (inline validation), bukan hanya toast generik.

---

## 5. Roadmap Implementasi (Phased Delivery)

| Fase | Fokus Utama | Modul Backend yang Terintegrasi |
| :--- | :--- | :--- |
| **Phase 1 — Foundation & Core Tasks** | Auth BFF, App Shell, Design System, Lookups, Task List/Board, Quick Create, Filter & Pagination | `Auth`, `Users/Me`, `Settings`, `Lookups`, `Tasks` |
| **Phase 2 — Deep Task Execution** | Task Inspector, Subtasks, Notes + History, Attachments (Upload & URL), Tags/Categories/Labels | `Subtasks`, `Notes`, `Attachments`, `Tags`, `Categories`, `Labels` |
| **Phase 3 — Collaboration & Real-Time** | WebSocket/SSE Notification Hub, Comments, Sharing RBAC, Votes, User Connections | `Notifications (WS/SSE)`, `Comments`, `Sharing`, `Votes`, `Connections` |
| **Phase 4 — Automation, Context & Audit** | Reminders, Recurring Tasks, Locations, External Integrations, Task Audit History, Activity Logs | `Reminders`, `Recurring`, `Locations`, `Integrations`, `Audit History`, `Activity Logs` |