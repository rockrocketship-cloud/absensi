#!/usr/bin/env python3
"""
server.py - OPSIONAL. Server TTS live, kalau teksnya tidak bisa ditebak
(misal mau menyebut angka jam: "Lilis absen masuk pukul delapan lewat lima").

Kalau kalimatnya tetap, pakai pregen.py saja — lebih murah dan tanpa server.

Pakai:
  pip install pocket-tts scipy fastapi uvicorn --extra-index-url https://download.pytorch.org/whl/cpu
  python server.py
  curl -X POST localhost:8000/speak -H 'content-type: application/json' \
       -d '{"teks":"Lee-lees soo-dah ahb-sen mah-sook"}' --output test.wav

Catatan: pocket-tts punya `pocket-tts serve` bawaan, tapi skema request
endpoint /tts-nya belum didokumentasikan. Server kecil ini memakai library
Python-nya langsung, jadi kontraknya jelas dan CORS bisa diatur.

Belum diuji di mesin saya (tidak ada akses install). Laporkan kalau error.
"""

import io
import threading

import scipy.io.wavfile
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

VOICE = "suara.safetensors"      # atau "alba", atau path .wav
# Ganti dengan origin aplikasi absensimu. Jangan pakai "*" kalau server
# ini terbuka ke internet.
ORIGINS = [
    "http://localhost:5173",
    "https://rockrocketship-cloud.github.io",
]

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINS,
    allow_methods=["POST"],
    allow_headers=["content-type"],
)

_model = None
_lock = threading.Lock()          # model tidak aman dipanggil paralel


def model():
    global _model
    if _model is None:
        from pocket_tts import TTSModel
        print("memuat model...")
        _model = TTSModel.load_model()
    return _model


class Req(BaseModel):
    teks: str
    voice: str | None = None


@app.post("/speak")
def speak(req: Req):
    teks = req.teks.strip()
    if not teks:
        return Response(status_code=400, content="teks kosong")
    if len(teks) > 300:
        return Response(status_code=400, content="teks terlalu panjang")

    m = model()
    with _lock:
        state = m.get_state_for_audio_prompt(req.voice or VOICE)
        audio = m.generate_audio(state, teks)

    buf = io.BytesIO()
    scipy.io.wavfile.write(buf, m.sample_rate, audio.numpy())
    return Response(
        content=buf.getvalue(),
        media_type="audio/wav",
        headers={"cache-control": "no-store"},
    )


@app.get("/health")
def health():
    return {"ok": True, "model_loaded": _model is not None}


if __name__ == "__main__":
    model()                       # muat di awal, bukan saat request pertama
    uvicorn.run(app, host="127.0.0.1", port=8000)
