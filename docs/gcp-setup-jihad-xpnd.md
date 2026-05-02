# GCP Setup — `jihad@xpnd.co.id`

Step-by-step setup Google Cloud Platform untuk Marketing Analytics
sebagai aplikasi yang dimiliki oleh **PT Ekspansi Bisnis Indonesia**
dengan email applicant `jihad@xpnd.co.id`.

Ikuti urutan ini. Tiap step ditulis sebagai checklist sehingga bisa
ditandai sambil dikerjakan.

---

## Prereq sebelum mulai

- [ ] Akses email `jihad@xpnd.co.id` aktif (bisa login Google Workspace
      / Gmail dengan email itu).
- [ ] Domain `xpnd.co.id` sudah ada dan mengarah ke web server yang
      Anda kontrol (untuk verifikasi domain di step 3 + 6).
- [ ] App Marketing Analytics sudah di-deploy ke production URL — mis.
      `https://app.xpnd.co.id`. Google audit akan akses URL ini, jadi
      harus reachable saat re-apply. Kalau belum deploy, deploy dulu
      sebelum lanjut ke step 5+.
- [ ] Halaman `/privacy` dan `/terms` (commit `07aaab6`) accessible di
      production — buka `https://app.xpnd.co.id/privacy` dan
      `https://app.xpnd.co.id/terms` di incognito untuk verify.

---

## 1. Login + Buat Project Baru

1. Buka https://console.cloud.google.com login pakai
   `jihad@xpnd.co.id`.
2. Di top-bar dropdown project, klik **"New Project"**.
3. Isi:
   - **Project name**: `Marketing Analytics XPND`
   - **Project ID**: auto-generated (atau set manual `marketing-analytics-xpnd`)
   - **Organization**: kalau xpnd.co.id sudah punya Google Workspace
     organization, pilih organization itu. Kalau belum, biarkan
     "No organization".
   - **Billing account**: link billing account xpnd. Required untuk
     enable beberapa API. (Tidak ada cost untuk dev token apply,
     tapi GCP project butuh billing terhubung.)
4. Klik **Create**. Tunggu ~30 detik.
5. Pastikan project barunya sudah selected (cek dropdown top-bar).

---

## 2. Enable APIs yang dibutuhkan

Buka https://console.cloud.google.com/apis/library

Search dan **Enable** tiap API berikut satu per satu:

- [ ] **Google Analytics Admin API** (untuk list GA4 properties user)
- [ ] **Google Analytics Data API** (untuk fetch GA4 reports)
- [ ] **Google Ads API** (untuk fetch Ads campaigns)
- [ ] **Search Console API** (untuk fetch Search Console queries)
- [ ] **Google+ API** atau **People API** (untuk OAuth profile —
      biasanya enabled by default; cek)

Tiap API: klik title → klik **Enable** → tunggu enable selesai → back.

---

## 3. Verifikasi domain `xpnd.co.id` (Required untuk Sensitive Scopes)

`analytics.readonly` adalah _sensitive scope_ — Google butuh
verifikasi bahwa Anda mengontrol domain yang link di consent screen.

1. Buka https://search.google.com/search-console
2. Login `jihad@xpnd.co.id`.
3. Add property → pilih **Domain** → masukkan `xpnd.co.id`.
4. Search Console kasih TXT record yang harus Anda tambahkan ke DNS:
   ```
   Type: TXT
   Name: @ (atau xpnd.co.id)
   Value: google-site-verification=XXXXXXX
   ```
5. Tambahkan TXT record itu di DNS provider Anda (Cloudflare,
   domainesia, dll). Tunggu propagasi (5–30 menit).
6. Klik **Verify** di Search Console. Kalau gagal, tunggu 10 menit
   lagi dan retry — DNS butuh waktu propagate.
7. Setelah verified, domain `xpnd.co.id` sekarang bisa dipakai sebagai
   "verified domain" di OAuth consent screen.

> Bonus: ini juga ngasih xpnd akses ke Search Console data, yang nanti
> bisa dipakai sebagai data source di app.

---

## 4. OAuth Consent Screen

Buka https://console.cloud.google.com/apis/credentials/consent

1. **User Type**: pilih **External** (kecuali xpnd punya Google
   Workspace dan Anda mau internal-only — internal lebih simpel tapi
   cuma bisa dipakai user di Workspace yang sama).
2. Klik **Create**. Lanjut ke OAuth consent screen form.

### Step 1 — App information

- [ ] **App name**: `Marketing Analytics`
- [ ] **User support email**: `jihad@xpnd.co.id`
- [ ] **App logo**: optional. Kalau ada logo xpnd 120×120 PNG,
      upload (akan muncul di consent screen — bikin lebih
      trustworthy untuk Google reviewer).

### Step 2 — App domain

- [ ] **Application home page**: `https://app.xpnd.co.id`
      (atau apapun production URL Anda)
- [ ] **Application privacy policy link**: `https://app.xpnd.co.id/privacy`
- [ ] **Application terms of service link**: `https://app.xpnd.co.id/terms`
- [ ] **Authorized domains**: tambahkan `xpnd.co.id`. (Kalau Anda
      deploy ke subdomain lain, tambah subdomain itu juga.)

### Step 3 — Developer contact

- [ ] **Email addresses**: `jihad@xpnd.co.id`

### Step 4 — Scopes

Klik **Add or Remove Scopes** → centang:

- [ ] `https://www.googleapis.com/auth/analytics.readonly`
- [ ] `https://www.googleapis.com/auth/adwords`
- [ ] `https://www.googleapis.com/auth/webmasters.readonly`

Klik **Update**. Anda akan diminta justifikasi tiap sensitive scope:

> **`analytics.readonly`** justification:  
> "Application reads GA4 properties and time-series reports of the
> authenticated user's own analytics accounts to display unified
> marketing dashboards. Read-only — no data is modified or shared."

> **`adwords`** justification:  
> "Application reads Google Ads campaign performance metrics
> (impressions, clicks, cost, conversions) of the authenticated
> user's own accounts via two endpoints:
> `customers:listAccessibleCustomers` and `googleAds:searchStream`.
> Read-only — no mutate / no campaign management."

> **`webmasters.readonly`** justification:  
> "Application reads Search Console properties and queries data of
> the authenticated user's own verified properties to display
> organic search performance alongside paid metrics. Read-only."

### Step 5 — Test users (sementara, sebelum publish)

- [ ] Tambahkan `jihad@xpnd.co.id` sebagai test user (selama
      "Testing" status, hanya test users yang bisa OAuth).
- [ ] Tambahkan email lain yang akan jadi tester juga.

### Step 6 — Submit untuk verification

- [ ] Saat status "Testing": Anda bisa pakai app untuk diri Anda + test
      users sambil prepare submission.
- [ ] Klik **Publish App** → status berubah ke "In production". Form
      verification akan terbuka.
- [ ] Submit untuk **Brand verification** (logo + app info review,
      ~1–3 hari) dan **Restricted/Sensitive scope verification**
      (~2–6 minggu untuk sensitive scope, full security assessment
      kalau ada restricted scope).
- [ ] Selama verification pending, app **masih jalan** untuk test
      users tapi consent screen akan ada warning "App not verified"
      buat user lain. Setelah approved, warning hilang.

---

## 5. OAuth 2.0 Client ID

Buka https://console.cloud.google.com/apis/credentials

1. Klik **Create Credentials → OAuth Client ID**.
2. **Application type**: `Web application`.
3. **Name**: `Marketing Analytics — Web Client`.
4. **Authorized JavaScript origins**:
   - `https://app.xpnd.co.id`
   - (Optional dev) `http://localhost:3000`
5. **Authorized redirect URIs**:
   - `https://app.xpnd.co.id/api/connectors/google/callback`
   - (Optional dev) `http://localhost:3000/api/connectors/google/callback`
6. Klik **Create**.
7. Catat **Client ID** dan **Client Secret** — Anda akan paste ke
   `.env.local` di step 8.

---

## 6. Google Ads Developer Token (Re-application)

Buka https://ads.google.com/aw/apicenter (login `jihad@xpnd.co.id`).

> Note: Anda harus punya akses ke akun Google Ads xpnd. Kalau bukan
> manager / admin, request akses dari pemilik akun Ads xpnd dulu.

1. Tab **API Center**.
2. Kalau sebelumnya sudah pernah ada developer token (Test access),
   token itu sudah ter-attach ke akun ini — bisa dipakai sebagai-is
   untuk Test mode dengan test customer ID.
3. Untuk production data: klik **Apply for Basic access**.
4. Form fields:
   - **Email**: `jihad@xpnd.co.id` (terisi otomatis)
   - **Company name**: `PT Ekspansi Bisnis Indonesia` (sesuai akta)
   - **Company website**: `https://xpnd.co.id`
   - **Use case description**:
     > Marketing Analytics is an internal tool operated by PT Ekspansi
     > Bisnis Indonesia (xpnd.co.id) to analyze our own Google Ads
     > campaign performance alongside Google Analytics 4 and Search
     > Console data. The tool is **read-only** — it uses exactly two
     > Google Ads API endpoints: `customers:listAccessibleCustomers`
     > to enumerate accessible accounts, and `googleAds:searchStream`
     > with GAQL queries to fetch daily campaign metrics
     > (impressions, clicks, cost_micros, conversions, ctr, average_cpc).
     > It does not call any mutate endpoints. It does not create,
     > modify, pause, or delete campaigns, ad groups, ads, keywords,
     > budgets, or bidding strategies. It does not use App Conversion
     > Tracking or Remarketing API endpoints. Privacy policy:
     > https://app.xpnd.co.id/privacy
   - **Link to a screencast/video**: optional tapi sangat membantu
     review. Record 30–60 detik tampilan halaman dashboard +
     /data-sources + sekilas /insights, dengan voice-over: "this is
     our internal marketing dashboard, here we connect our own Google
     Ads account, here we see read-only metrics displayed". Upload ke
     YouTube (unlisted) dan paste link.
   - **API access tier**: `Basic`
5. Submit. Wait email konfirmasi (1–7 hari kerja biasanya).
6. Kalau approved → Anda dapat developer token Basic access. Catat.

---

## 7. Domain verification untuk Google Ads (kalau diminta)

Beberapa kasus, Google Ads compliance team minta verifikasi tambahan
bahwa Anda kontrol `xpnd.co.id`. Step ini hanya kalau diminta dalam
balasan email mereka:

- Mereka akan minta TXT record khusus atau file verification di
  `xpnd.co.id/.well-known/...`. Ikuti instruksi di email mereka.

---

## 8. Update `.env.local` di app

Setelah dapat OAuth Client + Dev Token:

```env
# Database (existing — tidak berubah)
DATABASE_URL=postgresql://...

# NextAuth (existing)
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://app.xpnd.co.id

# Google OAuth — NEW (dari step 5)
GOOGLE_CLIENT_ID=<paste Client ID>
GOOGLE_CLIENT_SECRET=<paste Client Secret>
GOOGLE_OAUTH_REDIRECT_URI=https://app.xpnd.co.id/api/connectors/google/callback

# Google Ads developer token — NEW (dari step 6)
GOOGLE_ADS_DEVELOPER_TOKEN=<paste Dev Token>
# Optional MCC — biarkan kosong kalau akun Ads xpnd direct (bukan via
# manager account). Set kalau xpnd Ads di-bawah MCC.
GOOGLE_ADS_LOGIN_CUSTOMER_ID=

# Encryption key (existing — tidak berubah)
ENCRYPTION_KEY=...

# OpenAI (existing)
OPENAI_API_KEY=...
```

Restart app:

```bash
pnpm dev    # atau pm2 restart kalau di production
```

---

## 9. Test alur OAuth

1. Logout app.
2. Login pakai `jihad@xpnd.co.id`.
3. Buka `/data-sources`.
4. Klik **Connect** di card Google Analytics.
5. Akan redirect ke Google OAuth consent screen — pilih akun
   `jihad@xpnd.co.id`, approve scope.
6. Redirect kembali ke app. Connection card seharusnya berubah jadi
   "Active" dengan property GA4 yang ke-list.
7. Repeat untuk Google Ads + Search Console.
8. Klik **Sync now** di tiap koneksi. Buka `/data-sources/history`
   untuk konfirmasi sync `success` (bukan error lagi seperti "Dev
   token Test access").

---

## 10. Re-deploy + final smoke test

- [ ] Deploy commit terbaru ke production (`pm2 restart` atau Vercel
      redeploy etc).
- [ ] Buka `https://app.xpnd.co.id/privacy` dan `/terms` di
      incognito — pastikan render publik tanpa login.
- [ ] Login → buka `/dashboard` → cek sync health summary
      menunjukkan "X koneksi sehat" (bukan error lagi).
- [ ] Buka `/insights` → klik **Generate insight** → konfirmasi data
      dari Google Ads sekarang masuk ke totals (sebelumnya 0).

---

## Troubleshooting

**OAuth callback redirect_uri_mismatch error**  
Cek bahwa redirect URI di .env.local sama persis dengan yang Anda set
di OAuth Client (step 5). Termasuk `http://` vs `https://`, port,
trailing slash. Tambahkan kedua-duanya (dev + prod) di Authorized
redirect URIs kalau perlu.

**Sync error: "Token expired"**  
Refresh token sometimes expires kalau user revoke. Disconnect +
re-connect connection.

**Sync error: "User does not have access to customer"**  
Akun OAuth yang Anda pakai untuk connect Ads tidak punya akses ke
customer ID yang xpnd target. Cek xpnd.co.id Google Ads admin —
add `jihad@xpnd.co.id` sebagai user di Ads UI dulu.

**Dev token still Test access setelah Basic approval**  
Token Basic access menggantikan Test token. Update `.env.local` dengan
token baru dari email approval. Restart app. Token lama jadi invalid.
