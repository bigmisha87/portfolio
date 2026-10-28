"""Is every word shown where its singer actually sings? For each word: the singer's stem loudness in the 0.3 s from the
word's time, against the loudest moment within 2 s around it. A word put in silence (usually just after the line was
sung, or long before it) gets a low ratio and is listed, with the loudness just before it as a hint of the direction.
It caught four timing errors in a clip that had been through five review rounds.

  python audit_words.py words.json --stem lead=lead.wav --stem choir=choir.wav [--ratio .25]
words.json: [{"w": "word", "s": 45.8, "who": "lead"}, ...]   (times in seconds, as sung; "who" names a stem)
Then check each listed word: print the stem loudness every 0.05 s around it, or transcribe that single phrase.
Needs ffmpeg and numpy."""
import argparse, json, subprocess, numpy as np
ap = argparse.ArgumentParser(); ap.add_argument('words'); ap.add_argument('--stem', action='append', required=True); ap.add_argument('--ratio', type=float, default=.25)
a = ap.parse_args(); SR = 16000
def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)
stems = {k: load(v) for k, v in (x.split('=', 1) for x in a.stem)}
rms = lambda y, s, e: float(np.sqrt(np.mean(y[max(0, int(s * SR)):max(int(s * SR) + 1, int(e * SR))] ** 2) + 1e-12))
n = 0
for w in json.load(open(a.words, encoding='utf-8')):
    if not w.get('w') or w.get('who', 'lead') not in stems: continue
    y = stems[w.get('who', 'lead')]; at = rms(y, w['s'], w['s'] + .3)
    peak = max(rms(y, t, t + .3) for t in np.arange(w['s'] - 2, w['s'] + 2, .1)); before = rms(y, w['s'] - .5, w['s'] - .05)
    if at < a.ratio * peak:
        n += 1; hint = 'probably late (singing just before it)' if before > .5 * peak else 'probably early or misplaced'
        print('%-14s %7.2f  %-6s at %.3f  peak %.3f  before %.3f  %s' % (w['w'], w['s'], w.get('who', 'lead'), at, peak, before, hint))
print('%d word(s) to check' % n)
