// suara.js — pemutar notifikasi suara absensi.
//
// Urutan percobaan:
//   1. klip .wav hasil pregen.py (suara Pocket TTS / suara kloningmu)
//   2. Web Speech API bawaan perangkat (suara id-ID, pelafalan Indonesia benar)
//   3. diam — tidak pernah melempar error ke alur absensi
//
// Pemakaian:
//   import { ucapkan, panaskan } from './suara.js';
//   panaskan();                        // di handler tombol pertama (wajib di iOS)
//   await ucapkan('Lilis', 'masuk');   // setelah absen tersimpan ke Supabase

const BASE = './audio';           // folder hasil pregen.py
const EXT = '.wav';               // ganti '.mp3' kalau sudah dikonversi

const TEKS = {
  masuk:     n => `${n} sudah absen masuk`,
  keluar:    n => `${n} sudah absen keluar`,
  terlambat: n => `${n} tercatat terlambat`,
  gagal:     () => 'Absen gagal, silakan coba lagi',
};

const slug = s => s.normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const cache = new Map();          // path -> HTMLAudioElement siap pakai
let suaraID = null;
let siap = false;

function pilihSuaraID() {
  if (!('speechSynthesis' in window)) return;
  const v = speechSynthesis.getVoices();
  suaraID = v.find(x => x.lang === 'id-ID')
         || v.find(x => x.lang && x.lang.toLowerCase().startsWith('id'))
         || null;
}

if ('speechSynthesis' in window) {
  pilihSuaraID();
  speechSynthesis.onvoiceschanged = pilihSuaraID;
}

/**
 * Panggil sekali dari dalam handler klik/tap pertama.
 * iOS memblokir audio yang tidak dipicu gestur pengguna; ini "membuka" izinnya.
 */
export function panaskan() {
  if (siap) return;
  siap = true;
  try {
    const a = new Audio();
    a.muted = true;
    a.play().catch(() => {});
  } catch (_) {}
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
  } catch (_) {}
}

/** Muat klip lebih awal supaya pemutaran terasa instan. */
export function pramuat(namaList, aksiList = ['masuk', 'keluar']) {
  for (const n of namaList) {
    for (const a of aksiList) {
      const p = `${BASE}/${slug(n)}-${a}${EXT}`;
      if (cache.has(p)) continue;
      const el = new Audio(p);
      el.preload = 'auto';
      cache.set(p, el);
    }
  }
}

function putarKlip(path) {
  return new Promise((resolve, reject) => {
    let el = cache.get(path);
    if (!el) { el = new Audio(path); cache.set(path, el); }
    const bersih = () => {
      el.onended = el.onerror = null;
    };
    el.onended = () => { bersih(); resolve(true); };
    el.onerror = () => { bersih(); reject(new Error('klip tidak ada: ' + path)); };
    el.currentTime = 0;
    el.play().catch(e => { bersih(); reject(e); });
  });
}

function putarTTS(teks) {
  if (!('speechSynthesis' in window)) return false;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(teks);
    u.lang = 'id-ID';
    if (suaraID) u.voice = suaraID;
    speechSynthesis.speak(u);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * @param {string} nama  nama karyawan, mis. 'Lilis'
 * @param {'masuk'|'keluar'|'terlambat'|'gagal'} aksi
 * @returns {Promise<'klip'|'tts'|'diam'>} jalur mana yang dipakai
 */
export async function ucapkan(nama, aksi) {
  const teks = (TEKS[aksi] || TEKS.masuk)(nama);
  const path = aksi === 'gagal'
    ? `${BASE}/gagal${EXT}`
    : `${BASE}/${slug(nama)}-${aksi}${EXT}`;

  try {
    await putarKlip(path);
    return 'klip';
  } catch (_) {
    return putarTTS(teks) ? 'tts' : 'diam';
  }
}
