"""Pick and extract storyboard key frames for every scene of a lyric clip. Needs ffmpeg on PATH.

  python keyframes.py timeline.json clip.mp4 out_dir [--fps 24]

timeline.json: a list of scenes, each {"text": "...", "who": "lead"|"choir",
  "s": scene_start, "e": scene_end, "words": [{"w": "...", "s": word_time}, ...]}
  (times in seconds, as they play in the rendered clip).

Per scene: entrance (first word + 0.25 s), all words in (last word + 0.35 s, or the middle of the scene for
a one-word line), end (0.08 s before the cut), plus one more for scenes longer than 3.2 s.
Writes out_dir/frames/sNN_K.jpg and out_dir/scenes.json for building the storyboard page.
"""
import json, os, subprocess, sys


def main():
    tl_path, clip, out = sys.argv[1], sys.argv[2], sys.argv[3]
    fps = float(sys.argv[sys.argv.index('--fps') + 1]) if '--fps' in sys.argv else 24.0
    os.makedirs(os.path.join(out, 'frames'), exist_ok=True)
    tl = json.load(open(tl_path, encoding='utf-8'))
    scenes = []
    for i, sc in enumerate(tl):
        s, e, ws = sc['s'], sc['e'], sc['words']
        first, last = ws[0]['s'], ws[-1]['s']
        picks = [first + .25, last + .35 if len(ws) > 1 else (first + e) / 2, e - .08]
        if e - s > 3.2:
            picks.insert(2, (picks[1] + picks[2]) / 2)
        times = sorted({round(min(max(t, s + .04), e - .04) * fps) / fps for t in picks})
        frames = []
        for j, t in enumerate(times):
            name = 's%02d_%d.jpg' % (i + 1, j + 1)
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', '%.3f' % t, '-i', clip, '-frames:v', '1',
                            '-vf', 'scale=960:-2', '-q:v', '3', os.path.join(out, 'frames', name)], check=True)
            frames.append({'t': round(t, 3), 'img': 'frames/' + name})
        scenes.append({'n': i + 1, 'text': sc['text'], 'who': sc.get('who', ''), 's': round(s, 3), 'e': round(e, 3), 'frames': frames})
    json.dump(scenes, open(os.path.join(out, 'scenes.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(len(scenes), 'scenes,', sum(len(x['frames']) for x in scenes), 'frames ->', out)


if __name__ == '__main__':
    main()
