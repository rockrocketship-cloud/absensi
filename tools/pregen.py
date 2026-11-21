#!/usr/bin/env python3
"""
pregen.py - Buat semua klip suara notifikasi absensi SEKALI, jadi file .wav.

Kenapa pre-generate, bukan server live?
  Kalimat notifikasi absensi jumlahnya terbatas (6 staf x 4 kejadian = 24 klip).
  Generate sekali, commit ke repo, aplikasi tinggal play <audio>. Tidak perlu
  VPS, tidak ada latensi, tidak ada CORS.

Pakai:
  1. pip install pocket-tts scipy --extra-index-url https://download.pytorch.org/whl/cpu
  2. Rekam suaramu ~20 detik (baca apa saja, jelas, tanpa noise) -> suara.wav
  3. pocket-tts export-voice suara.wav suara.safetensors
  4. python pregen.py
  Hasil: folder ./audio/*.wav

Catatan: skrip ini belum pernah dijalankan di mesin saya (tidak ada akses
jaringan untuk install pocket-tts). Kalau ada error, kirim pesannya.
"""

import os
import re
import unicodedata

VOICE = "suara.safetensors"   # hasil export-voice; atau "alba" / "marius" untuk voice bawaan
OUTDIR = "../audio"

# --- Staf Lokalin Cafe ---------------------------------------------------
# Kiri: nama asli (buat nama file & data aplikasi)
# Kanan: ejaan fonetik ala Inggris, karena model pocket-tts tidak punya
#        bahasa Indonesia. Tanpa ini "Junaedi" dibaca "Joo-nay-dye".
STAF = {
    "ardi":     "Ar-dee",
    "junaedi":  "Joo-nah-eh-dee",
    "ilham":    "Eel-hahm",
    "wasih":    "Wah-seeh",
    "lilis":    "Lee-lees",
    "pipit":    "Pee-peet",
}

# Template kalimat, juga dalam ejaan fonetik.
# {n} diganti nama fonetik di atas.
KALIMAT = {
    "masuk":     "{n}, soo-dah ahb-sen mah-sook.",
    "keluar":    "{n}, soo-dah ahb-sen kuh-loo-ar.",
    "terlambat": "{n}, ter-chah-taht ter-lahm-baht.",
    "gagal":     "Ahb-sen gah-gal. See-lah-kan choh-bah lah-gee.",
}


def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def main():
    from pocket_tts import TTSModel
    import scipy.io.wavfile

    os.makedirs(OUTDIR, exist_ok=True)
    print("memuat model (sekali, agak lambat)...")
    model = TTSModel.load_model()

    # Dibuat ulang tiap klip: voice state menyimpan KV cache, dan memakai
    # ulang objek yang sama untuk beberapa generate bisa bikin hasil melenceng.
    # Loading dari .safetensors cepat, jadi aman dilakukan berulang.
    def state():
        return model.get_state_for_audio_prompt(VOICE)

    jobs = []
    for aksi, tmpl in KALIMAT.items():
        if aksi == "gagal":                  # tidak perlu nama
            jobs.append((f"{aksi}.wav", tmpl))
            continue
        for nama, fonetik in STAF.items():
            jobs.append((f"{slug(nama)}-{aksi}.wav", tmpl.format(n=fonetik)))

    for i, (fname, teks) in enumerate(jobs, 1):
        path = os.path.join(OUTDIR, fname)
        if os.path.exists(path):
            print(f"[{i}/{len(jobs)}] lewati (sudah ada) {fname}")
            continue
        audio = model.generate_audio(state(), teks)
        scipy.io.wavfile.write(path, model.sample_rate, audio.numpy())
        print(f"[{i}/{len(jobs)}] {fname}  <-  {teks!r}")

    print(f"\nselesai. {len(jobs)} klip di ./{OUTDIR}/")
    print("Kecilkan ukuran (opsional, butuh ffmpeg):")
    print(f"  for f in {OUTDIR}/*.wav; do ffmpeg -i \"$f\" -b:a 64k \"${{f%.wav}}.mp3\"; done")


if __name__ == "__main__":
    main()
