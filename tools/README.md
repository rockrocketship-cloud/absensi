# Notifikasi Suara Absensi — Pocket TTS + voice cloning

Suara notifikasi untuk aplikasi absensi Lokalin Cafe, dengan suara kloningan
(suaramu sendiri) lewat [Pocket TTS](https://github.com/kyutai-labs/pocket-tts).

## Isi

| File | Guna |
|---|---|
| `pregen.py` | Generate 24 klip `.wav` sekali jalan. **Ini jalur utama.** |
| `server.py` | Opsional: server TTS live untuk teks yang berubah-ubah. |
| `suara.js` | Modul klien: putar klip, fallback ke suara bawaan perangkat. |

## Keterbatasan yang perlu kamu tahu dulu

Pocket TTS **tidak punya model Bahasa Indonesia**. Bahasa yang ada: Inggris,
Prancis, Jerman, Portugis, Italia, Spanyol, Belanda.

Artinya teks Indonesia akan dilafalkan dengan fonetik Inggris. Solusinya ada di
`pregen.py`: kalimatnya ditulis **fonetik** — `"soo-dah ahb-sen mah-sook"`
bukan `"sudah absen masuk"`. Hasilnya mendekati, tidak sempurna. Kamu perlu
mengutak-atik ejaan itu sambil mendengarkan hasilnya.

Kloning suara memindahkan *warna suara*, bukan kemampuan berbahasa. Suaramu
tetap akan berbicara dengan aksen model.

Kalau yang kamu mau cuma pelafalan Indonesia yang benar, Web Speech API
(`suara.js` jalur fallback) lebih baik dan nol biaya. Pocket TTS menang kalau
yang penting adalah **suaranya harus suaramu**.

## Langkah

### 1. Install

```bash
# Linux, hindari paket CUDA berukuran gigabyte:
pip install pocket-tts scipy --extra-index-url https://download.pytorch.org/whl/cpu

# macOS / Windows cukup:
pip install pocket-tts scipy
```

Butuh Python 3.10–3.14 dan PyTorch 2.5+. Tidak perlu GPU.
Ada juga binary standalone di halaman Releases yang tidak butuh Python sama sekali.

Mau coba tanpa install:

```bash
uvx pocket-tts generate --text "testing satu dua tiga"
```

### 2. Rekam suaramu

Rekam **20–30 detik** (lebih dari 30 detik diabaikan). Baca apa saja, yang
penting: jelas, tempo normal, tanpa musik, tanpa bising cafe. Simpan sebagai
`suara.wav` atau `suara.mp3`.

Rekam pakai HP juga boleh — voice memo `.m4a` lalu konversi:

```bash
ffmpeg -i rekaman.m4a suara.wav
```

### 3. Export jadi embedding

```bash
pocket-tts export-voice suara.wav suara.safetensors
```

File `.safetensors` ini jauh lebih cepat dimuat daripada memproses audio ulang
setiap kali generate.

### 4. Generate klipnya

```bash
python pregen.py
```

Hasil: `./audio/ardi-masuk.wav`, `./audio/lilis-keluar.wav`, dan seterusnya —
24 file. Dengarkan beberapa. Kalau pelafalan nama ada yang aneh, ubah ejaan
fonetik di dict `STAF` / `KALIMAT` dalam `pregen.py`, hapus file yang
bersangkutan, jalankan lagi (file yang sudah ada dilewati).

Perkecil ukuran sebelum commit:

```bash
for f in audio/*.wav; do ffmpeg -i "$f" -b:a 64k "${f%.wav}.mp3"; done
rm audio/*.wav
```
Lalu ubah `EXT` di `suara.js` menjadi `'.mp3'`.

### 5. Pasang ke aplikasi

Copy folder `audio/` dan `suara.js` ke repo aplikasi absensi, lalu:

```js
import { ucapkan, panaskan, pramuat } from './suara.js';

const STAF = ['Ardi','Junaedi','Ilham','Wasih','Lilis','Pipit'];

// saat halaman absensi dibuka
pramuat(STAF);

btnAbsen.addEventListener('click', async () => {
  panaskan();                               // wajib: iOS butuh gestur pengguna
  const { error } = await supabase.from('absensi').insert({ ... });
  if (error) { await ucapkan('', 'gagal'); return; }
  await ucapkan(nama, terlambat ? 'terlambat' : 'masuk');
});
```

`ucapkan()` mengembalikan `'klip'`, `'tts'`, atau `'diam'` — berguna untuk
memastikan jalur mana yang aktif saat debugging. Fungsi ini tidak pernah
melempar error, jadi suara yang gagal tidak akan menggagalkan pencatatan absen.

### Opsional: server live

Hanya kalau teksnya tidak bisa ditebak (misal menyebut jam).

```bash
pip install fastapi uvicorn
python server.py
```

Edit `ORIGINS` di `server.py` dengan domain aplikasimu sebelum dibuka ke
internet. Pocket TTS punya `pocket-tts serve` bawaan dengan web UI di
`localhost:8000`, tapi skema request endpoint `/tts`-nya belum
didokumentasikan — karena itu `server.py` memakai library Python-nya langsung.

## Catatan

Skrip di folder ini belum pernah dijalankan: sesi tempat ini dibuat tidak punya
akses jaringan untuk memasang `pocket-tts`, jadi hanya syntax-nya yang
diverifikasi. Kirim pesan error-nya kalau ada yang gagal.

Lisensi kode Pocket TTS: MIT. Lisensi tiap voice bawaan berbeda-beda, tercantum
di voice card-nya — tapi kalau kamu memakai suaramu sendiri, itu tidak relevan.
