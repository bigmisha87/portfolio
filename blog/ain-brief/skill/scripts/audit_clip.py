"""Machine audit of a rendered clip, before anyone watches it. Lists, with times:
  DARK   moments where (almost) nothing in the frame is lit      -> "never a black frame"
  STILL  stretches where nothing moves                           -> "never a static frame"
  JUMPS  single frames that change far more than their neighbours -> camera jumps, pops, flashes
Then look at each hit yourself: a flash on an impact may be intended, a held black opener may be approved.

  python audit_clip.py clip.mp4 [--scenes scenes.json]
scenes.json (optional): [{"name": "s17", "start": 43.3, "end": 53.4}, ...] to label each hit with its scene.
Needs ffmpeg and numpy."""
import argparse, json, subprocess, numpy as np
ap = argparse.ArgumentParser(); ap.add_argument('video'); ap.add_argument('--scenes'); ap.add_argument('--fps', type=int, default=12)
ap.add_argument('--dark', type=float, default=.004, help='share of lit pixels under which a frame counts as dark')
ap.add_argument('--still', type=float, default=.12, help='mean frame-to-frame change under which a frame counts as still')
a = ap.parse_args(); W, H = 96, 54
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', a.video, '-vf', 'fps=%d,scale=%d:%d,format=gray' % (a.fps, W, H), '-f', 'rawvideo', '-'], capture_output=True, check=True).stdout
fr = np.frombuffer(raw, dtype=np.uint8).reshape(-1, H, W).astype(np.float32)
sc = json.load(open(a.scenes, encoding='utf-8')) if a.scenes else []
name = lambda t: next((s['name'] for s in sc if s['start'] <= t < s['end']), '')
lit = (fr > 40).mean(axis=(1, 2)); diff = np.r_[0, np.abs(np.diff(fr, axis=0)).mean(axis=(1, 2))]
def runs(mask, minlen):
    out, i = [], 0
    while i < len(mask):
        if mask[i]:
            j = i
            while j < len(mask) and mask[j]: j += 1
            if j - i >= minlen: out.append((i / a.fps, j / a.fps))
            i = j
        else: i += 1
    return out
print('%d frames, %.1f s' % (len(fr), len(fr) / a.fps))
print('\nDARK (1/6 s or longer):')
for s, e in runs(lit < a.dark, max(2, a.fps // 6)): print('  %7.2f-%7.2f  %.2fs  %s' % (s, e, e - s, name(s)))
print('\nSTILL (0.75 s or longer):')
for s, e in runs(diff < a.still, int(a.fps * .75)): print('  %7.2f-%7.2f  %.2fs  %s' % (s, e, e - s, name(s)))
print('\nJUMPS:')
loc = np.convolve(diff, np.ones(13) / 13, mode='same')
for i in np.where((diff > 9) & (diff > 3.2 * loc))[0]: print('  %7.2f  change %.1f (around it %.1f)  %s' % (i / a.fps, diff[i], loc[i], name(i / a.fps)))
