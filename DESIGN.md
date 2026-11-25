# Design System & UX Specification — Todo App v2

Dokumen ini mendefinisikan bahasa visual, prinsip tata letak, tipografi, warna, dan pola interaksi aplikasi. Arah desain yang dipilih adalah **Swiss-Utilitarian Craft**—terinspirasi dari kejernihan alat produktivitas profesional (seperti Linear, Things 3, dan Dieter Rams' industrial design).

---

## 1. Anti-AI-Slop Manifesto

Untuk memastikan antarmuka terlihat seperti produk perangkat lunak kelas profesional dan **tidak generik seperti hasil template AI**, seluruh komponen wajib mematuhi aturan berikut:

| ❌ Pola "AI Slop" (Dilarang) | ✅ Standar Desain Aplikasi Ini (Wajib) |
| :--- | :--- |
| Gradien ungu-biru/cyan neon pada tombol, banner, atau teks judul. | Warna permukaan solid monokromatik dengan satu aksen hangat yang terkendali (*Vermilion*). |
| Kartu serba `rounded-3xl` dengan *glassmorphism* (`backdrop-blur-xl`) berlebihan dan *drop shadow* besar. | Radius geometris ketat (`6px–10px`), batas tipis `1px` (*hairline borders*), elevasi melalui kontras warna permukaan. |
| Dashboard penuh *fake KPI cards*, grafik donat besar, dan emoji di setiap judul menu. | Langsung masuk ke ruang kerja (*workspace-first*). Data tampil padat, tenang, dan fungsional tanpa dekorasi kosong. |
| Teks abu-abu pucat sulit dibaca di atas latar abu-abu. | Hierarki kontras tegas (WCAG AA+), pemisahan jelas antara teks primer, sekunder, dan metadata. |
| Animasi memantul (*bouncy spring*) lambat dan efek *glow* saat hover. | Transisi cepat dan presisi (`120ms–180ms cubic-bezier(0.2, 0, 0, 1)`), feedback hover berupa perubahan *tint* latar halus. |

---

## 2. Sistem Warna (Semantic Color Tokens)

Aplikasi mendukung **Light Mode (Warm Paper)** dan **Dark Mode (Obsidian Ink)** yang tersinkronisasi dengan `PUT /api/v1/users/me/settings/theme`.

### 2.1 Surface & Ink Tokens

| Token | Light Mode (Warm Alabaster) | Dark Mode (Obsidian Graphite) | Penggunaan |
| :--- | :--- | :--- | :--- |
| `--bg-canvas` | `#F7F6F3` | `#0F1012` | Latar belakang utama / sidebar rail |
| `--bg-surface` | `#FFFFFF` | `#16171A` | Area konten utama, panel inspector, modal |
| `--bg-subtle` | `#F1EFEA` | `#1E2024` | Input background, hover state, badge netral |
| `--border-hairline` | `rgba(24, 24, 27, 0.08)` | `rgba(255, 255, 255, 0.08)` | Garis pemisah list, panel, dan tabel |
| `--border-strong` | `rgba(24, 24, 27, 0.16)` | `rgba(255, 255, 255, 0.16)` | Input focus, tombol sekunder |
| `--ink-primary` | `#141416` | `#F4F4F5` | Judul task, teks utama |
| `--ink-secondary` | `#52525B` | `#A1A1AA` | Deskripsi, label navigasi |
| `--ink-muted` | `#8A8A93` | `#71717A` | Timestamp, placeholder, shortcut hints |

### 2.2 Brand Accent (Single Disciplined Accent)
- **Primary Accent (Swiss Vermilion)**:
  - Light: `#D9481F` (Hover: `#BF3B16`, Subtle Tint: `rgba(217, 72, 31, 0.08)`)
  - Dark: `#EA5E36` (Hover: `#F2744E`, Subtle Tint: `rgba(234, 94, 54, 0.14)`)
- **Penggunaan**: Hanya untuk tombol aksi utama (*Primary CTA*), indikator item aktif di sidebar, focus ring, dan badge notifikasi belum dibaca.

### 2.3 Semantic Tokens (Pemetaan Langsung ke Backend Lookups)

#### Priority (`GET /priorities`)
Gunakan ikon bar vertikal (1–4 bar) atau dot kecil—**bukan** pill warna mencolok penuh:
- `urgent` (rank 4): `#DC2626` (Crimson) + ikon tanda seru terkurung
- `high` (rank 3): `#D97706` (Amber) + 3 bar terisi
- `medium` (rank 2): `#2563EB` (Cobalt) + 2 bar terisi
- `low` (rank 1): `#71717A` (Slate) + 1 bar terisi

#### Status (`GET /statuses`)
- `pending`: Lingkaran putus-putus / outline abu-abu (`#71717A`)
- `in_progress`: Lingkaran terisi sebagian / *half-ring* Cobalt (`#2563EB`)
- `completed`: Lingkaran terisi centang Emerald (`#16A34A`)
- `cancelled`: Lingkaran silang redup (`#A1A1AA`) + teks *strikethrough*

---

## 3. Tipografi

Menggunakan kombinasi sans-serif geometris modern dan monospace teknis (keduanya di-load via `next/font/google` tanpa *layout shift*):

- **UI & Display Font**: `Plus Jakarta Sans` atau `Geist` (Bobot: 400, 500, 600).
- **Technical / Mono Font**: `Geist Mono` atau `JetBrains Mono` (Bobot: 400, 500).
  - Wajib menerapkan `font-variant-numeric: tabular-nums` pada: Task ID (`#42`), tanggal jatuh tempo (`20 Nov 2026`), persentase progress (`75%`), jumlah vote, koordinat lokasi, dan *keyboard shortcuts* (`⌘K`).

### Skala Tipografi
| Role | Ukuran / Line Height | Weight | Tracking | Contoh Penggunaan |
| :--- | :--- | :--- | :--- | :--- |
| **Page Title** | `20px / 28px` | 600 | `-0.02em` | "My Tasks", "Activity Logs" |
| **Inspector Title** | `18px / 26px` | 600 | `-0.015em` | Judul task (editable inline) |
| **Section Header** | `12px / 16px` | 600 | `+0.04em` (Uppercase) | "SUBTASKS", "REMINDERS" |
| **Body / Task Row** | `14px / 20px` | 500 (Row) / 400 (Desc) | `0` | Judul baris task, komentar, catatan |
| **Metadata / Micro** | `12px / 16px` | 400 / 500 | `0` | Tanggal, nama tag, role badge |

---

## 4. Arsitektur Tata Letak (Workspace Shell)

Menggunakan struktur **3-Pane Adaptive Workspace** dengan garis pemisah `1px` bersih:

```text
┌──────────────┬─────────────────────────────────────┬────────────────────────────┐
│ Sidebar Rail │ Main Workspace (List / Kanban)      │ Task Inspector (Slide-over)│
│ (240px)      │ (Fluid, min 480px)                  │ (440px - 520px, Contextual)│
├──────────────┼─────────────────────────────────────┼────────────────────────────┤
│ Workspace    │ [Header: View Title + Filter Bar]   │ #42  [Share] [Archive] [×] │
│ [⌘K Search]  │ ─────────────────────────────────── │ ────────────────────────── │
│              │ ○  Siapkan laporan bulanan    High  │ Title (Inline Editable)    │
│ • All Tasks  │    Q3 sales data  #finance  20 Nov  │ Description...             │
│ • My Tasks   │ ─────────────────────────────────── │ ────────────────────────── │
│ • Shared     │ ◐  Audit API Endpoints      Urgent  │ Status | Priority | Due    │
│ • Upcoming   │    Salvo middleware check   22 Nov  │ Progress ████████░░ 75%    │
│ • Archived   │ ─────────────────────────────────── │ ▲ 4  ▼ 0   [+ Tag]         │
│              │                                     │ ────────────────────────── │
│ ───────────  │                                     │ Tabs:                      │
│ Taxonomy     │                                     │ [Work] [Discuss] [Meta]    │
│ • Tags       │                                     │ [Audit]                    │
│ • Categories │                                     │                            │
│ • Labels     │                                     │ • Subtasks (3/5)           │
│              │                                     │ • Notes (+ History)        │
│ ───────────  │                                     │ • Attachments              │
│ Social       │                                     │                            │
│ • Connections│                                     │                            │
│ • Activity   │                                     │                            │
│              │                                     │                            │
│ [● Live] [⚙] │                                     │                            │
└──────────────┴─────────────────────────────────────┴────────────────────────────┘
```

### Pengelompokan Tab di Task Inspector (Mencegah Overcrowding)
Alih-alih menumpuk 12 bagian vertikal yang panjang, detail task dikelompokkan ke dalam **4 tab kontekstual**:
1. **Work** *(Default)*: Subtasks, Notes (dengan drawer mini untuk `Note History`), dan Attachments (drag-and-drop upload + URL link).
2. **Discuss**: Comments thread + Votes bar + Sharing & Collaborators management.
3. **Schedule & Context**: Reminders (dengan status terkirim), Recurrence rule (`daily`/`weekly`/`monthly`/`yearly`), Locations (nama & koordinat), dan External Integrations (Trello/Jira/GitHub/Slack).
4. **History**: Read-only timeline terpadu dari `history/status`, `history/priority`, dan `history/labels`.

---

## 5. Pola Komponen & Interaksi Kunci

### 5.1 Task Row (List View)
- Tinggi baris kompak: `44px–52px` (single line pada desktop, wrap rapi di mobile).
- Urutan kolom dari kiri ke kanan: `[Status Icon Button]` → `[Task ID mono]` → `[Title]` → `[Tag Dots (maks 2 + "+N")]` → `[Progress Ring mini jika > 0%]` → `[Priority Indicator]` → `[Due Date mono]` (berubah merah hanya jika melewati waktu saat ini dan belum `completed`).
- Klik ikon status langsung memicu dropdown cepat atau toggle `completed` secara *optimistic*.

### 5.2 Command Palette (`⌘K` / `Ctrl+K`)
- Akses instan ke:
  - Cari task (`GET /tasks?search=...`).
  - Aksi cepat: *Create New Task*, *Switch to Kanban*, *Toggle Theme*, *Mark All Notifications Read*.
  - Navigasi antar halaman (`Connections`, `Classifications`, `Activity Logs`, `Settings`).

### 5.3 Keyboard Shortcuts (Desktop Power User)
- `C`: Buka modal *Quick Create Task*.
- `⌘K` / `Ctrl+K`: Buka *Command Palette*.
- `J` / `K` atau `↓` / `↑`: Pindah seleksi baris task.
- `Enter`: Buka *Task Inspector* untuk task terpilih.
- `Esc`: Tutup *Inspector* atau modal.

### 5.4 Empty States, Loading & Feedback
- **Skeletons**: Gunakan *structural skeleton* dengan tinggi baris yang persis sama (`44px`) tanpa animasi *shimmer* yang terlalu terang—cukup pulse opacity halus (`0.4 → 0.7`).
- **Empty States**: Ilustrasi vektor garis tipis (*monoline*) berukuran kecil atau ikon tunggal + 1 kalimat jelas + 1 tombol CTA (contoh: *"Belum ada task di filter ini. Tekan `C` untuk membuat task baru."*).
- **Toast Notifications**: Posisi kanan bawah, lebar maks `360px`, border `1px`, latar solid `--bg-surface`, durasi `4s`, mendukung tombol aksi cepat (misal: *"Undo"* atau *"Open Task"* saat menerima notifikasi real-time).

---

## 6. Ikonografi & Aset

- **Library Ikon**: `lucide-react` dengan ketebalan garis seragam `strokeWidth={1.75}` dan ukuran konsisten (`16px` untuk inline/navigasi, `14px` untuk metadata, `20px` untuk header).
- **Avatar Pengguna**: Bentuk lingkaran (`rounded-full`) dengan fallback inisial 2 huruf (`first_name` + `last_name`) di atas warna netral lembut yang deterministik berdasarkan `user_id`.
- **File Uploads**: Preview gambar dari `/uploads/{filename}` menggunakan `object-cover` dengan border `1px` dan lightbox sederhana saat diklik.