// Uji logika suara.js tanpa browser: DOM & Web Speech dipalsukan.
let spoken = [], played = [], existing = new Set();

class FakeAudio {
  constructor(src){ this.src = src || ''; this.currentTime = 0; }
  play(){
    if(!this.src) return Promise.resolve();            // panaskan()
    if(existing.has(this.src)){ played.push(this.src); setTimeout(()=>this.onended&&this.onended(),0); return Promise.resolve(); }
    setTimeout(()=>this.onerror&&this.onerror(),0);
    return Promise.resolve();
  }
}
class FakeUtterance { constructor(t){ this.text = t; } }

global.window = { speechSynthesis: true };
global.Audio = FakeAudio;
global.SpeechSynthesisUtterance = FakeUtterance;
global.speechSynthesis = {
  getVoices: () => [{name:'Damayanti', lang:'id-ID'}, {name:'Samantha', lang:'en-US'}],
  speak: u => spoken.push(u.text),
  cancel: () => {},
};
window.speechSynthesis = global.speechSynthesis;

const { ucapkan, panaskan, pramuat } = await import('../suara.js');

let gagal = 0;
const cek = (nama, dapat, harap) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap);
  if(!ok) gagal++;
  console.log(`${ok?'  ok':'FAIL'}  ${nama}${ok?'':`\n        dapat  ${JSON.stringify(dapat)}\n        harap  ${JSON.stringify(harap)}`}`);
};

// 1. klip belum ada -> fallback ke Web Speech
cek('tanpa klip: pakai TTS perangkat', await ucapkan('Lilis','masuk'), 'tts');
cek('teks TTS benar', spoken.at(-1), 'Lilis sudah absen masuk');

// 2. klip ada -> dipakai, TTS tidak dipanggil
existing.add('./audio/lilis-masuk.wav');
const n = spoken.length;
cek('klip ada: pakai klip', await ucapkan('Lilis','masuk'), 'klip');
cek('klip dipakai, TTS diam', spoken.length, n);
cek('path klip benar', played.at(-1), './audio/lilis-masuk.wav');

// 3. nama dengan spasi/kapital -> slug
existing.add('./audio/junaedi-keluar.wav');
cek('nama kapital jadi slug', await ucapkan('JUNAEDI','keluar'), 'klip');
cek('path slug benar', played.at(-1), './audio/junaedi-keluar.wav');

// 4. aksi gagal -> tidak butuh nama
cek('aksi gagal pakai TTS', await ucapkan('','gagal'), 'tts');
cek('teks gagal benar', spoken.at(-1), 'Absen gagal, silakan coba lagi');

// 5. aksi tak dikenal tidak melempar error
cek('aksi asing tidak crash', await ucapkan('Pipit','entah'), 'tts');

// 6. perangkat tanpa Web Speech & tanpa klip -> 'diam', bukan error
const simpan = global.window.speechSynthesis;
delete global.window.speechSynthesis;
cek('tanpa TTS & tanpa klip: diam', await ucapkan('Wasih','masuk'), 'diam');
global.window.speechSynthesis = simpan;

// 7. panaskan() membuka izin dengan kata nyata, bukan volume 0
const sebelum = spoken.length;
panaskan();
cek('panaskan pakai kata nyata', spoken.at(-1), 'Siap');
cek('panaskan hanya sekali', (panaskan(), spoken.length), sebelum + 1);

// 8. panaskan() & pramuat() aman dipanggil
pramuat(['Ardi','Junaedi','Ilham','Wasih','Lilis','Pipit']);
cek('panaskan/pramuat tidak melempar', true, true);

console.log(gagal ? `\n${gagal} uji GAGAL` : '\nsemua uji lulus');
process.exit(gagal ? 1 : 0);
