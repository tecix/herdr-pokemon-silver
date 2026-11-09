#!/usr/bin/env python3
# Pocket: makes the 8-bit jingles in sounds/ (original tunes, square + triangle
# waves like a handheld's sound chip). Needs ffmpeg for MP3 (Herdr's playSound).
#   python3 mods/pocket/chiptune.py
import math, os, struct, subprocess, tempfile, wave

RATE = 22050
HERE = os.path.dirname(os.path.abspath(__file__))
NOTES = {n: i for i, n in enumerate(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"])}

def freq(note):
    name, octave = note[:-1], int(note[-1])
    return 440.0 * 2 ** ((NOTES[name] + 12 * (octave + 1) - 69) / 12)

def voice(seq, wave_kind="square", duty=0.5, vol=0.22):
    # seq: [(note or None, beats)], 1 beat = 0.09 s.
    out = []
    for note, beats in seq:
        n = int(RATE * 0.09 * beats)
        f = freq(note) if note else 0
        for i in range(n):
            if not f:
                out.append(0.0)
                continue
            ph = (i * f / RATE) % 1.0
            s = (1.0 if ph < duty else -1.0) if wave_kind == "square" else (4 * abs(ph - 0.5) - 1)
            env = min(1.0, i / 60) * (1.0 - 0.55 * i / n)  # click-free attack, gentle decay
            out.append(s * vol * env)
    return out

def mix(*voices):
    n = max(len(v) for v in voices)
    return [sum(v[i] for v in voices if i < len(v)) for i in range(n)]

def save(name, samples):
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, "x.wav")
        with wave.open(wav, "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
            w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, s)) * 32000)) for s in samples))
        os.makedirs(os.path.join(HERE, "sounds"), exist_ok=True)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-b:a", "96k", os.path.join(HERE, "sounds", name)], check=True)

# Evolve: a climbing arpeggio that lands on a held chord.
lead = [("G4", 1), ("C5", 1), ("E5", 1), ("G5", 1), ("A4", 1), ("D5", 1), ("F5", 1), ("A5", 1),
        ("B4", 1), ("E5", 1), ("G#5", 1), ("B5", 1), ("C6", 2), (None, 1), ("C6", 1), ("E6", 6)]
bass = [("C3", 4), ("D3", 4), ("E3", 4), ("A2", 3), ("C3", 7)]
save("evolve.mp3", mix(voice(lead, duty=0.25), voice(bass, "triangle", vol=0.3)))

# Shiny: a quick sparkle up and down.
sparkle = [("E6", 1), ("B6", 1), ("G#6", 1), ("E7", 2), (None, 1), ("B6", 1), ("E7", 4)]
save("shiny.mp3", voice(sparkle, duty=0.125, vol=0.18))
