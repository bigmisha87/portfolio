"""Contact sheets for checking a rendered clip. Needs ffmpeg on PATH.

  python contact_sheet.py clip.mp4 all                 # whole clip, 2 fps
  python contact_sheet.py clip.mp4 scene 30.3 34.7     # one stretch at 12 fps (motion check)
  python contact_sheet.py clip.mp4 frame 6.125         # one exact frame

Writes JPGs next to the clip and prints their paths.
"""
import os, subprocess, sys


def run(args):
    subprocess.run(['ffmpeg', '-v', 'error', '-y'] + args, check=True)


def main():
    clip, mode = sys.argv[1], sys.argv[2]
    base = os.path.splitext(clip)[0]
    if mode == 'all':
        out = base + '_sheet_all.jpg'
        run(['-i', clip, '-vf', 'fps=2,scale=240:-2,tile=11x8', '-frames:v', '1', '-q:v', '4', out])
    elif mode == 'scene':
        s, e = float(sys.argv[3]), float(sys.argv[4])
        n = int((e - s) * 12) + 1
        cols = 10
        rows = (n + cols - 1) // cols
        out = base + '_sheet_%g-%g.jpg' % (s, e)
        run(['-ss', str(s), '-t', str(e - s), '-i', clip, '-vf', 'fps=12,scale=240:-2,tile=%dx%d' % (cols, rows),
             '-frames:v', '1', '-q:v', '4', out])
    elif mode == 'frame':
        t = float(sys.argv[3])
        out = base + '_frame_%g.jpg' % t
        run(['-ss', str(t), '-i', clip, '-frames:v', '1', '-q:v', '2', out])
    else:
        sys.exit('mode must be all, scene or frame')
    print(out)


if __name__ == '__main__':
    main()
