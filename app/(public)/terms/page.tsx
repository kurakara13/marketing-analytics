import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Marketing Analytics",
  description:
    "Syarat & ketentuan penggunaan Marketing Analytics, dioperasikan oleh PT Ekspansi Bisnis Indonesia.",
};

const LAST_UPDATED = "30 April 2026";

// Terms of service publik. Sekaligus syarat untuk Google API audit
// dan basic legal compliance.

export default function TermsOfServicePage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <header className="mb-8">
        <h1 className="text-foreground text-3xl font-semibold tracking-tight">
          Terms of Service
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Terakhir diperbarui: {LAST_UPDATED}
        </p>
      </header>

      <div className="space-y-6 text-sm leading-relaxed text-foreground/90">
        <section>
          <h2 className="text-foreground mt-6 text-lg font-semibold">
            1. Penerimaan
          </h2>
          <p>
            Dengan mendaftar atau menggunakan Marketing Analytics
            (selanjutnya "Platform"), Anda setuju dengan syarat &
            ketentuan ini. Platform dioperasikan oleh{" "}
            <strong>PT Ekspansi Bisnis Indonesia</strong> ("kami"),
            beralamat di Indonesia, dengan website{" "}
            <a
              href="https://xpnd.co.id"
              className="text-primary underline underline-offset-4"
              target="_blank"
              rel="noopener noreferrer"
            >
              xpnd.co.id
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-foreground mt-6 text-lg font-semibold">
            2. Status & Lingkup
          </h2>
          <p>
            Platform saat ini berstatus <strong>private beta</strong>.
            Akses diberikan secara invitation-only kepada user yang
            kami undang. Tidak ada paket berbayar publik. Fitur dapat
            berubah, ditambah, atau dihilangkan tanpa pemberitahuan
            sebelumnya selama periode beta.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mt-6 text-lg font-semibold">
            3. Akun & Akses Data
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Anda bertanggung jawab menjaga kerahasiaan kredensial
              akun Anda.
            </li>
            <li>
              Saat menghubungkan sumber data via OAuth (Google
              Analytics, Google Ads, Search Console), Anda memberikan
              kami izin untuk membaca data sesuai scope yang
              ditampilkan di consent screen Google. Akses bersifat{" "}
              <strong>read-only</strong>.
            </li>
            <li>
              Anda hanya boleh menghubungkan akun yang Anda miliki atau
              yang Anda diberi izin oleh pemiliknya untuk mengakses.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-foreground mt-6 text-lg font-semibold">
            4. AI Insight
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Insight di-generate oleh model AI pihak ketiga (OpenAI
              GPT-5). Output bersifat <strong>indikatif</strong> dan
              tidak menggantikan judgment manusia.
            </li>
            <li>
              Validasi angka dengan source data Anda sebelum mengambil
              keputusan operasional. Kami tidak bertanggung jawab atas
              keputusan bisnis yang diambil semata-mata berdasarkan
              output AI.
            </li>
            <li>
              Quota: 30 generate insight + 60 drill-down per hari
              per-user (rolling 24 jam). Quota dapat berubah.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-foreground mt-6 text-lg font-semibold">
            5. Penggunaan yang Dilarang
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Reverse engineer, decompile, atau menyalin substansial
              kode Platform.
            </li>
            <li>
              Menyalahgunakan API kami atau melakukan brute-force
              terhadap quota system.
            </li>
            <li>
              Menghubungkan data yang Anda peroleh secara ilegal atau
              tanpa izin pemilik data.
            </li>
            <li>
              Re-share atau menjual akses Anda kepada pihak ketiga
              tanpa persetujuan tertulis dari kami.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-foreground mt-6 text-lg font-semibold">
            6. Privasi
          </h2>
          <p>
            Penanganan data pribadi diatur dalam{" "}
            <a
              href="/privacy"
              className="text-primary underline underline-offset-4"
            >
              Privacy Policy
            </a>{" "}
            kami. Anda berhak meminta penghapusan data kapan saja via{" "}
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
            7. Disclaimer
          </h2>
          <p>
            Platform disediakan "sebagaimana adanya" tanpa garansi
            apapun, baik tersurat maupun tersirat. Kami tidak menjamin
            ketersediaan 100% (Platform dapat down sewaktu-waktu untuk
            maintenance atau alasan teknis lainnya), akurasi 100% data
            yang ditampilkan (data berasal dari API pihak ketiga yang
            dapat memiliki keterlambatan atau kesalahan), atau bahwa
            output AI akan bebas dari kesalahan/halusinasi.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mt-6 text-lg font-semibold">
            8. Pembatasan Tanggung Jawab
          </h2>
          <p>
            Sejauh diizinkan oleh hukum yang berlaku, kami tidak
            bertanggung jawab atas kerugian tidak langsung,
            insidental, atau konsekuensial yang timbul dari penggunaan
            Platform.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mt-6 text-lg font-semibold">
            9. Penghentian
          </h2>
          <p>
            Kami berhak menghentikan atau membatasi akses Anda jika
            Anda melanggar Terms ini, atau jika Platform dihentikan
            sebagai produk. Anda dapat menghapus akun Anda kapan saja
            dengan menghubungi kami via email.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mt-6 text-lg font-semibold">
            10. Hukum yang Berlaku
          </h2>
          <p>
            Terms ini tunduk pada hukum Republik Indonesia. Sengketa
            akan diselesaikan terlebih dahulu secara musyawarah; jika
            tidak tercapai, melalui pengadilan yang berwenang di
            Indonesia.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mt-6 text-lg font-semibold">
            11. Kontak
          </h2>
          <p>
            Pertanyaan tentang Terms ini bisa dikirim ke{" "}
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
