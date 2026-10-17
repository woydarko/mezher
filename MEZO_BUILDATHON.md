# Mezo Buildathon — "Build with MUSD and MEZO: Bitcoin's Economic Layer"

> Dokumen acuan project. Sumber: halaman AKINDO Wave Hacks
> `https://app.akindo.io/wave-hacks/OVOO0gdrVU8379D10` (dibaca 2026-10-17).
> Semua fakta di bagian 0–9 berasal dari halaman itu. Bagian 10 ke bawah = analisa & rencana kita (opini, bisa diubah).
> Item bertanda **[VERIFIKASI]** belum dikonfirmasi dan harus dicek di docs Mezo / Discord sebelum jadi keputusan.

---

## 0. Ringkasan satu layar (TL;DR)

| Item | Isi |
|---|---|
| Nama | Mezo Buildathon (di AKINDO: "Build with MUSD and MEZO : Bitcoin's Economic Layer") |
| Host | Mezo (Thesis: tim di balik tBTC, Fold, Taho) · Supernormal Foundation · dijalankan AKINDO |
| Syarat inti | Project **wajib integrasi MUSD dan/atau MEZO**. Tanpa integrasi = tidak eligible |
| Chain | Mezo (mainnet / testnet), Ethereum, Base, BNB Chain |
| Track | T1 DeFi (borrow/lend/loop/yield) · T2 Access & Distribution (bot, wallet, marketplace, aggregator). Boleh keduanya |
| Pool total | **$7,000 dalam MEZO** (Wave 1 $2,000 · Wave 2 $5,000) |
| Distribusi | Proporsional terhadap poin juri, **bukan top-3 tetap** |
| Deadline Wave 1 | **26 Oktober 2026, 22:00** (zona waktu di halaman tidak ditulis eksplisit — lihat §3) |
| Deadline Wave 2 | 15 November 2026 (build) |
| Pengumuman + demo | 23 November 2026 (online) |
| Biaya ikut | Gratis |
| Syarat bayar | **KYB wajib** untuk penerima reward |
| Kriteria juri | Mezo Integration 30% · Product & Business Viability 30% · Technical 20% · UX 10% · Materials 10% |

---

## 1. Tentang program

- Program 2 Wave, dievaluasi oleh core team Mezo. Wave 1 menghargai shipping awal; Wave 2 pool lebih besar dan menghargai kedalaman.
- Target peserta: developer mid-level / senior (EVM/Solidity, DeFi, Bitcoin-adjacent, payments/wallet/financial infra).
- Diprioritaskan secara eksplisit:
  1. Tim yang sudah punya produk jalan dan menambah integrasi MUSD/MEZO saat hackathon.
  2. Tim baru yang berkomitmen jangka panjang pada project.
  3. Tim baru yang menunjukkan **rencana kredibel setelah hackathon**.
- Akses langsung ke core team Mezo; tanya teknis lewat Discord.
- Top team presentasi di demo session online 23 Nov (di depan tim Mezo + komunitas).

### Apa itu Mezo (konteks)
- "Bitcoin finance app" — pinjam, earn, spend tanpa menjual BTC, permissionless, tanpa bank.
- **MUSD**: stablecoin native Mezo, 100% backed BTC, target 1:1 USD.
- **MEZO**: token native Mezo.
- EVM-compatible → Solidity langsung jalan. Stack mencakup borrowing berkolateral BTC, yield vault, seluruh surface app Mezo.
- Dari komentar peserta: posisi pinjaman disebut **Trove** (model mirip Liquity), dibuka lewat kontrak borrow. **[VERIFIKASI]** nama kontrak & ABI persisnya di docs.

---

## 2. Dua track

### Track 1 — DeFi (Borrowing, Lending, Looping, Yield)
Pertanyaan kunci: *"How might we expand MUSD and MEZO utility as collateral and productive capital across DeFi?"*

Contoh yang disebut penyelenggara:
- Lending protocol yang menerima MUSD/MEZO sebagai kolateral (single-chain / cross-chain)
- Strategi looping MUSD/MEZO (leveraged yield farming)
- Vault yield & auto-compound untuk MUSD/MEZO
- Pool likuiditas & integrasi DEX MUSD/MEZO di chain lain
- Staking derivatives MUSD/MEZO

Syarat: integrasi MUSD/MEZO.

### Track 2 — Access & Distribution
Pertanyaan kunci: *"How might we make MUSD and MEZO easier to discover, access, and use?"*

Contoh:
- Bot Telegram / WhatsApp untuk transaksi & monitoring MUSD/MEZO
- Platform matching & discovery
- Marketplace & aggregator produk ekosistem Mezo
- Wallet / interface lintas platform yang menyederhanakan akses MUSD/MEZO

Syarat: integrasi MUSD **atau** MEZO.

> Boleh submit ke kedua track (multiple choice di form).

---

## 3. Timeline

| Fase | Mulai | Selesai |
|---|---|---|
| Pre-registration | 22 Sep | 15 Okt (registrasi tetap terbuka sepanjang program) |
| Kickoff workshop (Mezo) | 13 Okt | rekaman tersedia (YouTube AKINDO / X) |
| Wave 1 kickoff onboarding (AKINDO) | 16 Okt, 22:00 JST | — |
| **Wave 1 build** | **16 Okt** | **26 Okt** |
| Wave 1 judging | 27 Okt | 1 Nov |
| **Wave 2 build** | **2 Nov** | **15 Nov** |
| Wave 2 judging | 16 Nov | 22 Nov |
| Winner announcement + demo session | 23 Nov (online) | — |

Catatan zona waktu: timeline di halaman menampilkan "10/26 22:00 Deadline" tanpa zona. Sesi workshop ditulis dalam JST (22:00 JST = 20:00 WIB). Countdown di halaman saat dibaca ≈ 8 hari 22 jam. **[VERIFIKASI]** zona deadline di Discord/AKINDO; sampai terkonfirmasi, **anggap deadline = 26 Okt pagi WIB (aman) dan submit minimal 12 jam lebih awal.**

Tanggal hari ini saat dokumen dibuat: 17 Okt 2026 → sisa ± **9 hari** build untuk Wave 1.

---

## 4. Hadiah & pembayaran

- Pool: Wave 1 **$2,000 MEZO**, Wave 2 **$5,000 MEZO**. Total $7,000.
- Mekanisme: core team Mezo mengalokasikan **poin** ke submission eligible tiap Wave. Bagian reward = (poin project ÷ total poin) × pool Wave tsb. Contoh resmi: 20% poin → 20% pool.
- Tidak ada jumlah pemenang tetap, tidak ada cap.
- Dibayar dalam **token MEZO** (bukan stablecoin), langsung dari Mezo. Jumlah MEZO dihitung dari **TWAP 14 hari** harga MEZO pada hari KYB selesai.
- Setelah pengumuman, tim terpilih menerima permintaan **KYB**. Pembayaran dimulai di hari kerja yang sama dengan KYB selesai (atau hari kerja berikutnya).
- KYB dapat meminta: W-9 / W-8BEN, ID pemerintah, bukti alamat, alamat wallet.
- Kontak via email yang diisi saat registrasi. Tidak bisa dihubungi / gagal verifikasi → hadiah hangus, diberikan ke peringkat berikutnya.
- Pajak = tanggung jawab peserta.

**Implikasi:** siapkan identitas & dokumen KYB dari awal; pakai email yang aktif dicek; reward bersifat variabel (harga MEZO + proporsi poin).

---

## 5. Eligibility

- Individu atau tim, global. Tiap anggota tim daftar sendiri di AKINDO.
- Usia minimal 18 tahun saat daftar.
- Satu peserta hanya boleh di **satu tim per Wave**.
- Project baru ATAU produk existing dengan integrasi MUSD/MEZO baru → keduanya boleh.
- **Tidak eligible:**
  - Penduduk / orang yang berada di yurisdiksi terlarang: Korea Utara, DR Kongo, Kuba, Donetsk PR, Iran, Irak, Luhansk PR, Krimea, **Tiongkok (RRC)**, Suriah; plus yurisdiksi mana pun yang dilarang hukum atau terkena sanksi UE / BVI / AS / PBB / lainnya.
  - Karyawan Supernormal & subkontraktor yang terlibat Contest, beserta kerabatnya.
- Indonesia **tidak** ada dalam daftar terlarang → eligible. **[VERIFIKASI]** semua anggota tim juga tidak berada di yurisdiksi terlarang.

### Syarat registrasi
1. Akun AKINDO.
2. Join Discord Mezo (`https://discord.mezo.org`) dan sebut bahwa kita peserta Mezo Hackathon → minta role **Developer** + akses channel yang relevan.
3. Isi pertanyaan registrasi tiap anggota: nama lengkap, email, handle Telegram, Discord, GitHub; level pengalaman (student/beginner, mid, senior); fokus (EVM, Bitcoin, DeFi, lain); sudah punya produk atau dari nol; domisili; rencana lanjut setelah hackathon.
4. Setuju Terms of Participation (tanpa ini registrasi tidak selesai).

---

## 6. Syarat submission

### Hard requirements (gugur jika tidak terpenuhi)
1. Integrasi MUSD dan/atau MEZO.
2. **Deployment berjalan** di Mezo mainnet, Ethereum, Base, atau BNB Chain. **Mezo testnet diterima.**
3. Dikembangkan selama hackathon, **atau** berupa pendekatan baru / ekstensi atas protokol/produk existing.
4. Memperluas utilitas MUSD/MEZO. App standalone yang tidak terkait produk inti Mezo tidak diprioritaskan.

### Materi yang dikumpulkan
- Link live project (testnet atau mainnet)
- Repo GitHub **publik**
- Deck project/produk
- **Video pitch 2 menit**
- Form submission di AKINDO

### Field form AKINDO
| Field | Catatan |
|---|---|
| Project name | — |
| Project category | 3–5 kata (mis. "yield optimization", "borrowing", "payment systems") |
| TL;DR | 1 kalimat: apa itu & apa fungsinya |
| How it works | masalah, cara kerja, **bagaimana MUSD/MEZO dipakai & diposisikan** |
| Target group | siapa pengguna, selaras track, tipe user, level pengalaman, region, mobile/desktop |
| Tech stack | teknologi, tool, framework utama |
| Track | Track 1 / Track 2 / keduanya |
| Chain deployed on | Mezo / Ethereum / Base / BNB Chain |
| Project status | benar-benar baru, atau existing + fitur baru (sertakan link produk existing) |
| Project readiness | mainnet / testnet / demo only |
| Future milestones | 3 milestone berikutnya + timeline (jika lanjut) |
| Team info | anggota, peran, X atau LinkedIn |

Wave 2 resubmission: **wajib eksplisit tulis apa yang berubah sejak Wave 1.**

---

## 7. Proses juri & kriteria

### Stage 1 — Screening (tim DevRel AKINDO)
Cek: integrasi MUSD/MEZO ada · deployment jalan di chain yang didukung · semua materi lengkap. Gagal = tidak diteruskan, tim diberi tahu.

### Stage 2 — Evaluasi (core team Mezo)
Alokasi poin per kriteria:

| Kriteria | Bobot | Arti |
|---|---:|---|
| **Mezo Integration** | **30%** | Pemakaian MUSD/MEZO yang efektif & bermakna. **Kedalaman integrasi > pemakaian permukaan** |
| **Product & Business Viability** | **30%** | Seberapa langsung memperluas utilitas MUSD/MEZO sesuai pertanyaan track; problem-solution fit; kelayakan bisnis; komplementer dengan ekosistem & audiens Mezo |
| **Technical Implementation** | **20%** | Kualitas kode, arsitektur, security, benar-benar composable & deployable (bukan sekadar demo) |
| **User Experience** | **10%** | Desain, usability, aksesibilitas |
| **Submission Materials Quality** | **10%** | Kejelasan demo & efektivitas pitch |

### Prinsip "What Mezo Is Looking For" (memengaruhi skor)
1. **Integration is mandatory.** Tanpa integrasi = tidak eligible.
2. **Extend, don't detour.** Ekstensi produk Mezo > app standalone tak terkait.
3. **Composability wins.** Plug-in ke infrastruktur DeFi existing (lending market, DEX, vote-escrow) skor lebih tinggi dari consumer app terisolasi.
4. **Long-term commitment counts.** Produk jalan + integrasi baru, atau tim baru dengan rencana kredibel pasca-hackathon.
5. Chain fleksibel (Mezo, Ethereum, Base, BNB; testnet Mezo OK).

---

## 8. Aturan (Rules)

- Submit lewat platform AKINDO sebelum deadline Wave.
- Wajib integrasi MUSD/MEZO + deployment berjalan di chain yang didukung.
- Dikembangkan selama hackathon, atau ekstensi baru atas produk existing.
- Wave 2 harus menunjukkan **kemajuan baru yang berarti**.
- Karya harus orisinal atau dikreditkan dengan benar; **kode yang dipakai ulang harus open source dan disitasi**.
- Tidak boleh melanggar IP pihak ketiga.
- Satu peserta = satu tim per Wave. Usia ≥ 18.
- Lisensi: peserta memberi Supernormal lisensi non-eksklusif, royalty-free, worldwide untuk memakai & menampilkan submission untuk keperluan Contest & promosi. **Kepemilikan IP tetap di peserta.**
- Peserta setuju nama, rupa, dan submission dipakai untuk promosi di kanal Mezo.
- Pajak hadiah tanggung jawab peserta. KYB wajib untuk menerima reward.
- Hukum yang berlaku: British Virgin Islands; sengketa di pengadilan BVI.
- Sponsor: Supernormal OpCo BVI Ltd. (Road Town, BVI). Terms lengkap ada di link "Read the full Terms of Participation" di halaman. **[VERIFIKASI]** baca full Terms sebelum submit.

---

## 9. Resources

### Testnet Mezo
| Item | URL |
|---|---|
| Testnet dApp | https://testnet.mezo.org |
| Explorer testnet | https://explorer.test.mezo.org/ |
| RPC testnet | https://rpc.test.mezo.org |
| Faucet (test BTC + MEZO) | https://faucet.test.mezo.org/ |
| Getting started | https://mezo.org/docs/developers/getting-started/ |

Cara dapat **MUSD testnet**: pinjam MUSD terhadap test BTC, atau swap BTC → MUSD di dApp testnet.

### Kode & docs
- GitHub Mezo (kontrak MUSD, audit, dll.): https://github.com/mezo-org/
- Docs (alamat kontrak core, kontrak contoh, cara kerja Mezo Earn, oracle yang didukung, koneksi wallet): https://mezo.org/docs/ · dev: https://mezo.org/docs/developers/

### Kanal
- Website https://mezo.org/ · Mainnet explorer https://explorer.mezo.org/
- Discord https://discord.mezo.org (**wajib** — support teknis + role Developer)
- X https://x.com/mezonetwork · Telegram https://t.me/mezonetwork · Blog https://mezo.org/blog
- AKINDO https://app.akindo.io/ · X https://x.com/akindo_io
- Kickoff workshop (rekaman): https://www.youtube.com/live/eAiaQpzvVE0

### FAQ penting (dari halaman)
- Chain mana? Mezo / Ethereum / Base / BNB; testnet Mezo OK. Yang wajib: integrasi MUSD/MEZO.
- Reward stablecoin? Tidak, MEZO token (TWAP 14 hari saat KYB).
- Boleh submit produk existing? Ya, jika menambah integrasi MUSD/MEZO baru; tulis di submission + link produk existing. Tim yang memperluas produk jalan **diprioritaskan**.
- Boleh submit ke kedua track? Ya.
- Boleh submit project sama di kedua Wave? Ya, dan **disarankan**; Wave 2 harus ada progres baru.
- Jumlah pemenang tetap? Tidak; proporsional.
- Biaya ikut? Tidak ada.

---

# BAGIAN KITA (analisa & rencana — opini, bukan fakta halaman)

## 10. Analisa kriteria: apa artinya untuk strategi

1. **60% skor = "seberapa Mezo-native & seberapa masuk akal sebagai produk."** Integration (30) + Viability (30). Polish UI/video hanya 20% gabungan. Prioritas waktu: integrasi dalam > fitur luas > UI cantik.
2. **"Depth over surface"** — hanya mengambil harga/saldo MUSD atau sekadar "terima pembayaran MUSD" kemungkinan dinilai dangkal. Integrasi yang bagus menyentuh mekanik inti: Trove/borrow, kolateral BTC, rate, liquidation, Mezo Earn/vault, vote-escrow. **[VERIFIKASI]** primitif apa saja yang tersedia di docs.
3. **"Composability wins"** — rancang sebagai kontrak/modul yang bisa dipakai protokol lain (vault, adapter, wrapper), bukan app tertutup.
4. **"Extend, don't detour"** — frame project sebagai *perluasan* produk Mezo (mis. menambah fitur di atas Borrow/MUSD), bukan produk lain yang kebetulan pakai MUSD.
5. **Reward proporsional** → tidak winner-take-all; submission yang eligible dan solid pasti dapat bagian. Tapi share dihitung terhadap total poin semua submission: makin sedikit/lemah kompetitor, makin besar share. (Saat dibaca: 9 submission masuk di Wave 1, 0 submitted product tampil di list.)
6. **Wave 1 pool kecil ($2k), Wave 2 besar ($5k).** Strategi rasional: Wave 1 = ship MVP yang eligible + dapat feedback skor; Wave 2 = perdalam. Resubmit boleh dan didorong. Jangan habiskan seluruh ide di Wave 1.
7. **Hard gate screening:** deployment hidup + repo publik + deck + video 2 menit + form lengkap. Satu saja hilang = tidak diteruskan ke juri Mezo. Ini risiko terbesar yang bisa dicegah murni dengan checklist.
8. **Rencana pasca-hackathon dinilai** (tim baru butuh "credible plan"). Siapkan 3 milestone konkret dengan tanggal.

## 11. Kompetitor / sinyal dari komentar halaman

| Peserta | Ide | Catatan |
|---|---|---|
| dimkox | **Liqvera** — laporan pasar terverifikasi dari order-book Hyperliquid BTC perp, dibayar via **x402** dengan test MUSD di Mezo Testnet (0.01 MUSD/laporan, gas disponsori) | Sudah jadi, repo + demo live, v0.0.5. Integrasi lewat pembayaran → mungkin dinilai "surface"; tapi sudah jalan |
| Annie | **Assumable** — "assumable mortgage" untuk pinjaman BTC di Mezo: jual seluruh loan (NFT yang memiliki akun Trove), pembeli bayar equity & ambil alih BTC + debt + rate | Integrasi dalam ke Trove; konsep orisinal; kandidat kuat di Track 1 |
| moduudefii | "Practical DeFi app" dengan MUSD (belum spesifik) | Tanya soal track/lokasi deploy |

Pelajaran: ada yang sudah **lebih dulu** dengan integrasi dalam (Assumable) dan ada yang sudah **shipping live** (Liqvera). Hindari ide yang berhimpitan langsung dengan keduanya (loan-transfer/NFT-trove; pay-per-report x402).

## 12. Ruang ide (kandidat, belum dipilih)

Setiap ide dinilai kasar terhadap kriteria. Skala 1–5, **tebakan awal** — perlu divalidasi dengan docs setelah baca primitif Mezo.

| # | Ide | Track | Integrasi dalam | Composable | Risiko teknis (9 hari) |
|---|---|---|:-:|:-:|:-:|
| A | **Loop/leverage vault** untuk MUSD (auto-loop posisi + auto-deleverage dekat batas liquidation) | T1 | 5 | 5 | Tinggi |
| B | **Yield vault auto-compound** MUSD/MEZO (ERC-4626 style) di atas Mezo Earn / pool yang ada | T1 | 4 | 5 | Sedang |
| C | **Liquidation-protection / keeper**: monitor Trove, top-up kolateral / repay otomatis sebelum liquidation, bisa dipakai bot & vault | T1+T2 | 5 | 4 | Sedang |
| D | **Bot Telegram**: pantau Trove (LTV, harga BTC, rate), notifikasi risiko, aksi cepat (repay / add collateral) | T2 | 3–4 | 2 | Rendah |
| E | **Aggregator/dashboard ekosistem Mezo**: posisi, yield, Mezo Earn lintas protokol dalam satu tempat | T2 | 3 | 3 | Rendah–Sedang |
| F | **Cross-chain MUSD** (mis. bridge/adapter agar MUSD/MEZO bisa jadi kolateral di Base/Ethereum) | T1 | 4 | 5 | Tinggi |
| G | **Pembayaran / invoice MUSD** untuk merchant (wallet UX) | T2 | 2 | 2 | Rendah (kemungkinan dianggap dangkal) |

Kombinasi realistis untuk 9 hari: **C + D** (monitor + proteksi + bot) atau **B** (vault) sebagai MVP, lalu perdalam di Wave 2. Keputusan final diisi di §13.

## 12b. Referensi ETHGlobal Showcase → twist MUSD/MEZO

Sumber: `https://ethglobal.com/showcase` (search `?q=`), dibaca 2026-10-17. Keyword: stablecoin, CDP, liquidation, leverage, credit, savings, + listing terbaru ETHGlobal Tokyo 2026.

Tren ETHGlobal 2026 (Tokyo/NY/ETHOnline): **AI agent yang bayar sendiri + guardrail** (spending limit, approval manusia, x402), **Uniswap v4 hook**, **intent/solver**, **proteksi pre-sign / circuit breaker**.

| # | Referensi (event) | Inti asli | Twist ke Mezo | Track | Catatan |
|---|---|---|---|---|---|
| R1 | **DeCredit Wallet** (LFGHO — **LFGHO Finalist + Aave Integration Prize**; modul ERC-7579: flashmint GHO → bayar → repay via borrow Aave; `ethglobal.com/showcase/decredit-wallet-0su87`) — wallet ERC-4337 seperti kartu kredit GHO; **InstaCredit** (ETHIndia 2023) — BNPL | Bayar dulu, lunasi nanti | **"Spend BTC without selling"**: smart wallet yang **mint/borrow MUSD just-in-time dari Trove saat checkout**, lalu bayar merchant. User tidak pernah pegang MUSD sebelumnya. Persis tagline Mezo ("live off your Bitcoin") | T2 (+T1) | Extend Mezo Borrow langsung. **[VERIFIKASI]** borrow bisa dipanggil dari smart account/kontrak |
| R2 | **AAVE Liquidation Protection** (MarketMake), **liquidation guard** (Unite DeFi), **Liquidation Ckt Brkr** (ETHGlobal Buenos Aires), **Tripwire** (Tokyo 2026) | Bot/kontrak yang repay / top-up sebelum likuidasi | **Trove Guard**: user set aturan (mis. ICR < 130% → top-up BTC dari vault / repay pakai MUSD cadangan). Keeper permissionless dapat fee; opsional keeper stake MEZO. + **bot Telegram** untuk alert & 1-tap action | T1+T2 | Composable (protokol lain bisa pakai). Risiko: overlap ringan dengan ide C/D |
| R3 | **Leveraged sDAI** (ETHOnline 2023), **AAVE-Leverage / Leverager** (MarketMake) — flashloan + swap untuk leverage 1-klik | Loop leverage satu transaksi | **1-click BTC loop**: BTC → borrow MUSD → swap ke BTC → tambah kolateral, dalam 1 tx; plus 1-click unwind | T1 | Butuh likuiditas MUSD/BTC + flashloan di Mezo. **[VERIFIKASI]** DEX & flashloan tersedia |
| R4 | **Iceberg** (Tokyo 2026) — AMM sebagian aktif, sisa likuiditas idle ditaruh di Morpho | Likuiditas idle tetap produktif | **MUSD pool di mana likuiditas idle masuk ke yield Mezo** (Earn / stability pool) | T1 | Sangat composable & dalam; teknis berat untuk 9 hari |
| R5 | **No-Scroll-Savings** (HackMoney 2026) — prize-linked savings; PoolTogether-style | Tabungan tanpa rugi, yield jadi hadiah | **MUSD no-loss savings**: deposit MUSD, yield dikumpulkan jadi hadiah mingguan; varian: hadiah dalam MEZO | T2 | Butuh sumber yield MUSD. **[VERIFIKASI]** |
| R6 | **DeSavings** (ETHGlobal NY) — auto-split token masuk | Dana masuk otomatis dibagi | **Auto-split pemasukan MUSD**: gaji/remitansi masuk → x% repay Trove, y% tabungan, z% spend. Sudut pasar Indonesia/SEA (remitansi, freelancer) | T2 | Sederhana; risiko dinilai dangkal kalau tidak menyentuh Trove |
| R7 | **DSAP Protocol / Proviso / Izanagi / Axis** (Tokyo 2026) — AI agent dengan spending limit & approval manusia | Agent belanja dengan pagar | **Agent treasury berbasis BTC**: AI agent berbelanja pakai MUSD hasil borrow terhadap BTC, dengan limit on-chain + menjaga health Trove sendiri | T1+T2 | Trendi; Liqvera sudah main x402 → bedakan di sisi *pengelolaan Trove*, bukan pembayaran |
| R8 | **tCDP** (HackMoney) — CDP tokenisasi fungible | Posisi utang jadi token | Trove pooled → token fungible | T1 | **Hindari**: bertabrakan dengan Assumable (Annie) |

Pilihan awal (opini, belum diputuskan):
1. **R1 Borrow-to-Spend wallet** — paling "Extend, don't detour", demo paling mudah dipahami juri, cocok Track 2 + kaitan kuat ke Borrow.
2. **R2 Trove Guard + bot** — integrasi dalam (Trove/ICR), composable, scope MVP jelas.
3. **R3 1-click loop** — skor integrasi tinggi, tapi tergantung infrastruktur DEX/flashloan di Mezo.

## 12c. Hasil verifikasi teknis (2026-10-18) — untuk ide R1 Borrow-to-Spend

Sumber: repo `mezo-org/musd` (branch main), docs `mezo.org/docs/developers/{musd,features/mezo-pools,getting-started}`, `cast call` ke `https://rpc.test.mezo.org`.

| Pertanyaan | Hasil | Bukti |
|---|---|---|
| MUSD punya flashmint / flashloan (ERC-3156)? | **TIDAK.** `MUSD.sol` hanya `mint`/`burn` untuk alamat di mint-list (owner-only). Tidak ada kata "flash" di repo kontrak | grep `flash\|ERC3156` kosong |
| Smart account / kontrak boleh buka & kelola Trove? | **YA.** `BorrowerOperations` tidak cek EOA (`tx.origin`, `code.length` tidak ada). Trove dimiliki `msg.sender` | grep kosong; `withdrawMUSD` memakai `msg.sender` |
| Pinjam MUSD atas nama user, langsung ke penerima lain? | **YA, via `BorrowerOperationsSignatures.withdrawMUSDWithSignature(amount, hints, borrower, recipient, sig, deadline)`**. Relayer siapa pun bisa submit; MUSD dikirim ke `recipient` (mis. merchant). EIP-712, ada nonce + deadline | kode L461–500 |
| Signature support smart account (ERC-1271)? | **TIDAK.** Hanya `ECDSA.recover` → jalur signature hanya untuk Trove milik **EOA** | L620 |
| Minimum utang | `minNetDebt` = **1.800 MUSD** (testnet & default), + gas compensation **200 MUSD** → Trove minimal ~2.000 MUSD debt | on-chain testnet |
| Fee | Borrowing fee **0,1%** per pinjaman (1.000 MUSD → 1 MUSD), + bunga tetap (fixed, refinanceable). Redemption fee 0,75% | on-chain + docs |
| Batas aman | Likuidasi di ICR < **110%**; Recovery Mode jika TCR < 150%. Ada **redemption risk** (Trove ICR terendah di-redeem duluan) | docs MUSD |
| DEX untuk swap MUSD? | **ADA — Mezo Pools** (Aerodrome-style + CL ala Slipstream). Testnet: Router `0x9a1ff7FE3a0F69959A3fBa1F1e5ee18e1A9CD7E9`, MUSD/BTC pool `0xd16A5Df82120ED8D626a1a15232bFcE2366d6AA9`, CLSwapRouter `0x3112908bB72ce9c26a321Eeb22EC8e051F3b6E6a`. Gauge + veBTC juga ada | docs mezo-pools |
| ERC-4337 di Mezo testnet? | **EntryPoint v0.7 (`0x0000000071727De22E5E9d8BAf0edAc6f37da032`) ter-deploy.** v0.6 tidak. Bundler publik **[VERIFIKASI]** (bisa self-submit `handleOps`) | `cast code` |
| Aktivitas testnet | 254 Trove; harga BTC oracle ≈ $81.155 | on-chain |
| Lain | Mezo resmi punya guide **MUSD payments via x402** + **Wormhole MUSD bridge** (MUSD ke chain lain) | sidebar docs |

### Alamat kontrak MUSD — Mezo testnet (matsnet, chainId 31611)
| Kontrak | Alamat |
|---|---|
| BorrowerOperations | `0xCdF7028ceAB81fA0C6971208e83fa7872994beE5` |
| BorrowerOperationsSignatures | `0xD757e3646AF370b15f32EB557F0F8380Df7D639e` |
| MUSD | `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` |
| TroveManager | `0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0` |
| HintHelpers | `0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6` |
| SortedTroves | `0x722E4D24FD6Ff8b0AC679450F3D91294607268fA` |
| PriceFeed | `0x86bCF0841622a5dAC14A313a15f96A95421b9366` |

Sumber: `solidity/artifacts/deployments/matsnet/*.json` di `mezo-org/musd`.

### Dampak ke ide R1
- Mekanik DeCredit asli (flashmint → bayar → borrow untuk lunasi) **tidak bisa disalin**: MUSD tidak punya flashmint.
- Pengganti yang **lebih native**: borrow langsung dari Trove ke merchant.
  - **Jalur A (EOA, gasless):** user tanda tangan EIP-712 `WithdrawMUSD(amount, borrower, recipient=merchant, nonce, deadline)` → relayer/kontrak kita submit `withdrawMUSDWithSignature` → MUSD masuk ke merchant. User tidak bayar gas, tidak pegang MUSD. Pakai fitur resmi Mezo yang jarang dipakai → nilai "Mezo Integration" tinggi.
  - **Jalur B (smart account):** Trove dimiliki smart account (ERC-4337 v0.7 ada) + modul "pay with BTC credit". Lebih fleksibel (limit, rules), lebih berat.
- Hambatan nyata: Trove butuh **≥ 2.000 MUSD debt** → user sudah pegang ±1.800 MUSD di awal. Desain realistis: bayar dari saldo MUSD dulu, **borrow hanya selisihnya** (persis logika DeCredit), dan ada tombol "repay" dari pemasukan.
- Butuh test BTC cukup untuk Trove ~2.000 MUSD di ICR aman (≥150% → ≈0,037 BTC testnet). **[VERIFIKASI]** jumlah faucet per request.

## 12d. Riset docs Mezo (2026-10-18) — fakta teknis untuk build

Sumber: `mezo.org/docs/developers/*` (getting-started, configure-environment, dapp-requirements, faqs, musd, musd-redemptions, musd-payments-x402, mezo-pools, mezo-earn, oracles, integrations-and-partners, passport, wormhole bridge).

### Chain
| | Testnet | Mainnet |
|---|---|---|
| Chain ID | **31611** (CAIP-2 `eip155:31611`) | **31612** (`eip155:31612`) |
| RPC | `https://rpc.test.mezo.org` · WSS `wss://rpc-ws.test.mezo.org` | Boar `https://mezo-mainnet.boar.network`, Imperator, Validation Cloud, dRPC `https://mezo.drpc.org` |
| Explorer | explorer.test.mezo.org | explorer.mezo.org |
| Gas | **BTC native, 18 desimal** (tBTC di balik layar) | sama |

- Arsitektur: Cosmos SDK + CometBFT, fork Evmos (`mezod`). EVM-compatible.
- **Compiler: Solidity 0.8.28, `evmVersion: "london"`** (wajib — jangan pakai opcode pasca-London seperti `PUSH0`/transient storage). Foundry: `evm_version = 'london'`, `chain_id = 31611`.
- Faucet `https://faucet.test.mezo.org/` dilindungi **CAPTCHA** (harus manual oleh manusia).

### MUSD (inti integrasi)
- CDP fork **Threshold USD ← Liquity**. Trove = posisi; buka via `BorrowerOperations.openTrove(debt, upperHint, lowerHint){value: btc}`.
- Hint: `HintHelpers.getApproxHint(nicr, 15, seed)` → `SortedTroves.findInsertPosition(nicr, hint, hint)`. `expectedTotalDebt = debt + getBorrowingFee(debt) + MUSD_GAS_COMPENSATION`.
- Perbedaan dari THUSD: **bunga tetap** (refinance-able), PCV, **EIP-712 signature (gasless)**, tanpa special recovery-mode liquidation.
- Fee: borrow 0,1% · redemption 0,75% · refinancing · bunga sederhana tetap. LTV sampai ~90% (MCR 110%).
- Peg: floor $1 via redemption 1:1 ke BTC (redeem dari Trove ICR terendah > 110%), ceiling $1,10 via MCR 110%.
- Stability Pool awalnya diisi **bootstrap loan protokol** (bukan insentif token).
- **MUSD token = permit2 + EIP-2612**. EIP-712 domain: name `Mezo USD`, version `1`.
- Alamat MUSD: testnet `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` · mainnet `0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186`.
- Mainnet core: TroveManager `0x94AfB503dBca74aC3E4929BACEeDfCe19B93c193`, HintHelpers `0xD267b3bE2514375A075fd03C3D9CBa6b95317DC3`, SortedTroves `0x8C5DB4C62BF29c1C4564390d10c20a47E0b2749f`, BorrowerOperations `0x44b1bac67dDA612a41a58AAf779143B181dEe031`. (Testnet: lihat §12c.)
- Kontrak upgradable (proxy).

### MUSD payments via x402 (resmi)
- Settlement default di Mezo = MUSD. Harga ditulis `"$0.01"`; SDK me-resolve ke MUSD.
- **Facilitator `https://facilitator.vativ.io`** (testnet + mainnet), **gas disponsori** dalam BTC → buyer hanya perlu MUSD + key.
- Settlement proxy `0x402085c248EeA27D92E8b30b2C58ed07f9E20001` (CREATE2, auto-resolve).
- SDK: TS `@x402/evm` ≥ v2.10.0 (testnet) / v2.15.0 (mainnet); Go; Python. Ada quickstart `@x402/express` + `@x402/paywall`.
- Use case yang Mezo sebut: paywall, metered API, pay-per-inference AI, M2M agent, **paid MCP server**, usage-based SaaS.

### Mezo Pools / Mezo Earn (DEX + gauge, repo `mezo-org/tigris`)
- Basic pool Aerodrome-style (volatile 0,30% / stable 0,02%) + CL pool ala Velodrome Slipstream (NFT position, TWAP oracle bawaan).
- ve-tokenomics: **veBTC**, VeBTCVoter, gauge → emisi **MEZO** untuk LP yang di-stake.
- Alamat testnet: lihat §12c (Router, MUSD/BTC pool, CLSwapRouter). Testnet NonfungiblePositionManager `0x9B753e11bFEd0D88F6e1D2777E3c7dac42F96062`, CLGaugeFactory `0x5b0dbAfdcE363d6662F36163D91862B0a3808373`, VeBTC `0xB63fcCd03521Cf21907627bd7fA465C129479231`, VeBTCVoter `0x72F8dd7F44fFa19E45955aa20A5486E8EB255738`.

### Oracle
- Native: **Skip Connect** (harga ditulis ke modul `x/oracle` saat konsensus).
- Third-party: **Pyth** proxy `0x2880aB155794e7179c9eE2e38200202908C17B43` (testnet & mainnet), **Stork** (testnet), **Supra DORA** (testnet).
- MUSD sendiri pakai `PriceFeed` (testnet `0x86bCF0841622a5dAC14A313a15f96A95421b9366`).

### Wallet & infra
- **Mezo Passport** (`@mezo-org/passport`, di atas RainbowKit + wagmi + viem 2.x): user bisa tanda tangan transaksi EVM pakai **wallet Bitcoin (Xverse, Unisat)** + MetaMask. Opsional.
- Indexer **Goldsky** (slug `mezo-testnet`). Multisig **Den / Safe** di `safe.mezo.org`.
- Bridge: Mezo Bridge + **Wormhole NTT** untuk MUSD lintas chain.

### Di luar hackathon (penting untuk "long-term commitment")
- Syarat dApp masuk **Mezo Market**: integrasi MUSD + **audit pihak ketiga** (laporan ke Supernormal Foundation) + jalan di mainnet.
- **Mezo Founder Program** (MVP harus live di testnet): grant, co-marketing, networking, dukungan integrasi.
- **BitcoinFi Accelerator** (Boost VC, Draper Associates, Thesis).
→ Ini bahan untuk "3 future milestones": testnet MVP → Founder Program → audit + mainnet + Mezo Market.

### Implikasi untuk R1 (Borrow-to-Spend)
- Mezo sendiri mendorong **MUSD payments (x402)** dan **gasless EIP-712**. R1 menyambung dua hal itu: *"bayar x402 / merchant dengan kredit BTC"* — pinjam MUSD dari Trove hanya saat saldo kurang, lewat `withdrawMUSDWithSignature`.
- Mezo Passport → user wallet Bitcoin bisa langsung ikut → cocok Track 2 (akses).
- Hati-hati overlap Liqvera (x402 pay-per-report): kita bukan seller x402, kita **sisi pembayar/credit line**.

## 13. KEPUTUSAN PROJECT (isi setelah brainstorming)

- Nama project: _TBD_
- Track: _TBD_
- Chain deploy: _TBD (rekomendasi awal: Mezo testnet — jalur paling cepat & paling "native")_
- Masalah & user: _TBD_
- Cara pakai MUSD/MEZO (kedalaman): _TBD_
- Apa yang composable (kontrak/interface yang bisa dipakai protokol lain): _TBD_
- Scope MVP Wave 1 (maks 3 fitur): _TBD_
- Ditunda ke Wave 2: _TBD_
- 3 milestone pasca-hackathon: _TBD_

## 14. Rencana kerja Wave 1 (17–26 Okt) — kerangka

| Hari | Fokus |
|---|---|
| 17 Okt (H0) | Daftar AKINDO + isi registrasi, join Discord (minta role Developer), tonton rekaman workshop, baca docs Mezo, setup wallet + faucet, dapat MUSD testnet |
| 18 Okt | Baca kontrak MUSD/Borrow di repo `mezo-org`, putuskan ide (§13), tanya validasi ke Discord |
| 19–20 | Kontrak inti + test lokal/fork; deploy pertama ke Mezo testnet |
| 21–22 | Integrasi end-to-end (frontend/bot) di atas kontrak terdeploy |
| 23 | Feature freeze. Security pass (reentrancy, oracle, rounding, access control), perbaiki bug |
| 24 | UX polish, README, deck, rekam video pitch 2 menit |
| 25 | Isi form AKINDO, verifikasi semua link bisa dibuka tanpa login, dry-run submission |
| 26 pagi | **Submit** (buffer ≥ 12 jam dari deadline) |

Aturan kerja: deploy ke testnet **sejak hari ke-3**, bukan menunggu akhir. "Live deployment" adalah gate screening.

## 15. Checklist submission (centang sebelum submit)

**Eligibility**
- [ ] Akun AKINDO + registrasi lengkap tiap anggota
- [ ] Join Discord Mezo + role Developer
- [ ] Agree Terms of Participation (sudah baca full Terms)
- [ ] Semua anggota ≥ 18 th dan bukan di yurisdiksi terlarang
- [ ] Tiap orang hanya 1 tim di Wave ini

**Hard requirements**
- [ ] Integrasi MUSD dan/atau MEZO terbukti (alamat kontrak / tx hash di README)
- [ ] Deployment hidup di chain yang didukung (alamat kontrak + link explorer)
- [ ] Link live app/demo dapat diakses tanpa login
- [ ] Repo GitHub **publik**, README jelas (setup, arsitektur, alamat kontrak, cara uji)
- [ ] Semua kode pihak ketiga open source dan disitasi; tidak ada IP yang dilanggar
- [ ] Jika existing product: jelaskan apa yang baru + link produk lama

**Materi**
- [ ] Deck (masalah → solusi → bagaimana MUSD/MEZO dipakai → traction/rencana)
- [ ] Video pitch **2 menit** (hook 10 dtk · demo nyata · kedalaman integrasi Mezo · rencana lanjut)
- [ ] Semua field form terisi (§6), termasuk 3 future milestones + info tim (X/LinkedIn)

**Kualitas (bobot skor)**
- [ ] Integrasi bukan sekadar baca harga/transfer; menyentuh mekanik inti Mezo
- [ ] Ada interface/kontrak yang bisa dipakai protokol lain (composability)
- [ ] Tes untuk logika kritis; tidak ada secret/private key di repo
- [ ] Alur demo utama berjalan tanpa error di jaringan publik

**Pasca**
- [ ] Email registrasi aktif (untuk KYB)
- [ ] Siapkan ID, bukti alamat, W-8BEN/W-9, alamat wallet penerima

## 16. Risiko & mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Zona waktu deadline salah dibaca | Telat submit = gugur | Anggap deadline paling awal; submit ≥ 12 jam sebelumnya; konfirmasi di Discord |
| Integrasi dangkal | Kehilangan sampai 30% (+ ikut menekan viability 30%) | Pilih ide yang menyentuh Trove/Earn/vault; konsultasi core team di Discord sebelum membangun jauh |
| Deploy telat | Gagal screening | Deploy testnet awal, CI sederhana, alamat kontrak di README |
| Scope kebesaran | Demo setengah jadi | Maks 3 fitur MVP; sisanya Wave 2 |
| Bug security / oracle | Skor teknis turun | Checklist security (reentrancy, oracle staleness, rounding, role); jangan mengaku audited |
| Ide bertabrakan kompetitor | Skor orisinalitas turun | Hindari loan-transfer NFT (Assumable) dan pay-per-report x402 (Liqvera) |
| KYB gagal / tak terjangkau | Reward hangus | Siapkan dokumen dini; satu email aktif |
| Reward kecil & variabel | Ekspektasi | Pool $2k dibagi proporsional; nilai utama = feedback + posisi untuk Wave 2 + relasi dengan core team |
| Info pada dokumen ini kadaluarsa | Salah acuan | Halaman AKINDO + Discord = sumber kebenaran; cek ulang sebelum submit |

## 17. Pertanyaan terbuka (cek di Discord / docs)

1. Zona waktu persis deadline 26 Okt 22:00?
2. Primitif Mezo apa yang diperlakukan sebagai "integrasi dalam" (Borrow/Trove, Mezo Earn, vote-escrow, oracle)? Ada daftar kontrak & ABI resmi yang disarankan?
3. Deploy hanya di Mezo testnet cukup untuk skor penuh, atau mainnet/chain lain memberi nilai tambah?
4. Apakah ada rate limit / batas faucet yang memengaruhi pengujian?
5. Apakah boleh memakai x402 / pembayaran sebagai integrasi (sudah dipakai Liqvera)? Seberapa dalam dianggap cukup?
6. Format penilaian "business viability" — perlu proyeksi/traction, atau cukup rencana milestone?
7. Detail klausul Terms of Participation (lisensi, publikasi, kepemilikan) setelah dibaca penuh.

## 18. Cara menggunakan dokumen ini

- Sebelum menulis kode: baca §10 dan isi §13.
- Setiap hari: update §14 (status) dan §15 (centang).
- Sebelum submit: jalankan §15 dari atas ke bawah, lalu cek ulang halaman AKINDO untuk perubahan aturan.
- Jika halaman berubah, halaman itulah yang menang; perbarui dokumen ini.
