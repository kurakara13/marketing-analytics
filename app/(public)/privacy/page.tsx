import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Marketing Analytics",
  description:
    "Privacy policy untuk Marketing Analytics, dioperasikan oleh PT Ekspansi Bisnis Indonesia (xpnd.co.id).",
};

const LAST_UPDATED = "30 April 2026";

// Privacy policy publik — wajib untuk Google API audit (OAuth consent
// screen + Ads API approval). Konten harus jujur menjelaskan apa yang
// disimpan, bagaimana, untuk apa, dan bagaimana user bisa menghapus.

export default function PrivacyPolicyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <header className="mb-8">
        <h1 className="text-foreground text-3xl font-semibold tracking-tight">
          Privacy Policy
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Terakhir diperbarui: {LAST_UPDATED}
        </p>
      </header>

      <div className="prose prose-sm prose-slate max-w-none space-y-6 text-sm leading-relaxed text-foreground/90">
        <section>
          <h2 className="text-foreground mt-6 text-lg font-semibold">
            Operator
          </h2>
          <p>
            Marketing Analytics dioperasikan oleh{" "}
            <strong>PT Ekspansi Bisnis Indonesia</strong> (selanjutnya
            disebut "kami"), beralamat di Indonesia, dengan website{" "}
            <a
              href="https://xpnd.co.id"
              className="text-primary underline underline-offset-4"
              target="_blank"
              rel="noopener noreferrer"
            >
              xpnd.co.id
            </a>
            . Kontak privacy:{" "}
            <a
              href="mailto:jihad@xpnd.co.id"
              className="text-primary underline underline-offset-4"
            >
              jihad@xpnd.co.id
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-foreground mt-6 text-lg font-semibold">
            Apa itu Marketing Analytics
          </h2>
          <p>
            Marketing Analytics adalah tool internal untuk menganalisis
            performa kampanye marketing dengan mengaggregat data dari
            Google Analytics 4 (GA4), Google Ads, Search Console, dan
            sumber lain yang diizinkan oleh user via OAuth 2.0. Tool ini{" "}
            <strong>read-only</strong> — kami tidak pernah memodifikasi,
            membuat, atau menghapus aset di akun Google user.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mt-6 text-lg font-semibold">
            Data yang kami simpan
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Akun user</strong>: nama, email, password
              ter-hash (bcrypt). Tidak menyimpan password plain text.
            </li>
            <li>
              <strong>OAuth tokens</strong> dari Google (access +
              refresh tokens). Disimpan ter-enkripsi AES-256-GCM di
              database. Encryption key tidak pernah masuk ke source
              control.
            </li>
            <li>
              <strong>Metrik marketing aggregat</strong>: impressions,
              clicks, sessions, conversions, spend, revenue, dan metrik
              raw dari sumber data yang dihubungkan. Data per-hari per-
              kampanye, tidak ada PII end-user.
            </li>
            <li>
              <strong>AI insight history</strong>: ringkasan + observasi
              + rekomendasi yang di-generate oleh AI dari metrik di
              atas. Token + cache yang dikirim ke OpenAI tidak
              mengandung raw API responses Google — hanya summary
              numbers.
            </li>
            <li>
              <strong>Konfigurasi user</strong>: business context
              opsional (industri, target audience, lead event name)
              untuk customize prompt AI.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-foreground mt-6 text-lg font-semibold">
            Apa yang TIDAK kami simpan
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Tidak menyimpan PII end-user dari akun Google user (mis.
              email kontak yang tercatat di GA4 audience, demographic
              detail, atau IP address).
            </li>
            <li>
              Tidak melakukan tracking pengunjung website kami sendiri
              di luar yang dibutuhkan untuk authentication session.
            </li>
            <li>
              Tidak mengirim data marketing user ke pihak ketiga selain
              OpenAI (untuk generate AI insight, lihat bagian
              "Pihak ketiga" di bawah). Tidak menjual atau berbagi data.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-foreground mt-6 text-lg font-semibold">
            Penggunaan API Google
          </h2>
          <p>
            Marketing Analytics' use of information received from Google
            APIs adheres to{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              className="text-primary underline underline-offset-4"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google API Services User Data Policy
            </a>
            , termasuk Limited Use requirements.
          </p>
          <p className="mt-2">
            Scope yang kami minta:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <code className="bg-muted rounded px-1 text-[12px]">
                analytics.readonly
              </code>{" "}
              — read GA4 properties + reports
            </li>
            <li>
              <code className="bg-muted rounded px-1 text-[12px]">
                adwords
              </code>{" "}
              — read-only access ke Google Ads accounts (hanya
              endpoint <code>customers:listAccessibleCustomers</code>{" "}
              dan <code>googleAds:searchStream</code>)
            </li>
            <li>
              <code className="bg-muted rounded px-1 text-[12px]">
                webmasters.readonly
              </code>{" "}
              — read Search Console properties + queries
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-foreground mt-6 text-lg font-semibold">
            Pihak ketiga
          </h2>
          <p>
            Kami menggunakan layanan berikut untuk fungsi internal:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>OpenAI</strong> (GPT-5) untuk generate insight
              text. Kami kirim aggregate summary metrics (totals, deltas,
              top campaign names) — bukan raw API responses Google,
              bukan PII. Data tidak dipakai OpenAI untuk train model
              (per OpenAI's API data usage policy).
            </li>
            <li>
              <strong>Google OAuth</strong> untuk authentication +
              connector sources.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-foreground mt-6 text-lg font-semibold">
            Hak Anda
          </h2>
          <p>Anda berhak untuk:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Disconnect</strong> sumber data kapan saja via
              halaman Data Sources — refresh token akan dihapus
              langsung dari database kami.
            </li>
            <li>
              <strong>Delete account</strong> — kirim email ke{" "}
              <a
                href="mailto:jihad@xpnd.co.id"
                className="text-primary underline underline-offset-4"
              >
                jihad@xpnd.co.id
              </a>
              . Kami akan hapus semua data Anda (akun, tokens, metrik,
              insight) dari database dalam 7 hari kerja dan
              men-confirm via email yang sama.
            </li>
            <li>
              <strong>Revoke OAuth access</strong> dari Google Account
              settings (myaccount.google.com → Security → Third-party
              apps). Setelah revoke, sync akan gagal dan kami otomatis
              tandai connection sebagai error.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-foreground mt-6 text-lg font-semibold">
            Keamanan
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>OAuth tokens ter-enkripsi AES-256-GCM at rest.</li>
            <li>
              Database PostgreSQL diakses hanya dari server kami via
              connection string private — tidak public-facing.
            </li>
            <li>HTTPS / TLS untuk semua traffic di production.</li>
            <li>
              Multi-tenant isolation enforced di query level — tiap
              row scoped ke user_id, tidak bisa cross-user access.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-foreground mt-6 text-lg font-semibold">
            Perubahan kebijakan
          </h2>
          <p>
            Kami akan update halaman ini bila ada perubahan material
            terhadap praktik privasi kami, dengan tanggal
            "Terakhir diperbarui" di atas. Perubahan signifikan akan
            diberitahukan via email ke alamat akun Anda.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mt-6 text-lg font-semibold">
            Kontak
          </h2>
          <p>
            Pertanyaan tentang kebijakan privasi ini bisa dikirim ke{" "}
            <a
              href="mailto:jihad@xpnd.co.id"
              className="text-primary underline underline-offset-4"
            >
              jihad@xpnd.co.id
            </a>
            .
          </p>
        </section>
      </div>
    </article>
  );
}
