# Self-QA and the review storyboard

## Contact sheets (ffmpeg)

`scripts/contact_sheet.py` wraps these; the raw commands, for any tool:

```bash
# whole clip, 2 frames per second, 11 columns
ffmpeg -v error -y -i clip.mp4 -vf "fps=2,scale=240:-2,tile=11x8" -frames:v 1 sheet_all.jpg

# one scene in motion: 12 fps from 30.3 s for 4.4 s
ffmpeg -v error -y -ss 30.3 -t 4.4 -i clip.mp4 -vf "fps=12,scale=240:-2,tile=10x6" -frames:v 1 sheet_scene.jpg

# one exact frame the director pointed at (timecode 06:03 in a 24 fps clip = 6.125 s)
ffmpeg -v error -y -ss 6.125 -i clip.mp4 -frames:v 1 frame.jpg
```

How to read a 12 fps sheet: track one thing (a word's edge, a letter) across neighbouring tiles. Its
position should change smoothly. A sudden offset between two tiles is a jump; a reversal is a
right-then-left move; a tile where everything is suddenly different is a pop or a flash.

## Machine audits first

```bash
python scripts/audit_clip.py clip.mp4 --scenes scenes.json      # black frames, still holds, one-frame jumps
python scripts/audit_words.py words.json --stem lead=lead.wav --stem choir=choir.wav   # words where nobody sings
```

Look at every hit in the clip: an impact flash or an approved black opener may be intended; a dark
moment in the middle of a scene change, or a hold where nothing moves, is not.

## What to check, in order

1. Every sung word is fully visible and readable at the moment it is sung.
2. The complete phrase stays on screen long enough to read before the cut or move.
3. No camera jumps or reversals (12 fps sheets of every changed scene).
4. No backdrop edges or wall/floor seams anywhere in frame.
5. No text from neighbouring scenes in a held shot.
6. RTL text: right letter order, punctuation on the left, nothing mirrored except on purpose.
7. Colours consistent within each scene; lead/choir code respected.
8. The output file is the version you think it is (a version banner or file date).
9. No black or empty frame anywhere, including the middle of every move between scenes.
10. No hold where nothing moves for more than ~0.75 s.
11. Physical motion looks physical: drops go straight down, nothing passes through the floor or another
    object, debris stays where it lands.
12. Every word against the singing (`audit_words.py`), not only the ones the director flagged.

## The storyboard

Purpose: the director reviews the clip as a page of key frames and writes notes per scene; you read the
notes back without them pasting anything.

Per scene:
- the lyric line, who sings it, the one-line scene idea, start-end timecodes;
- 3 key frames: entrance (first word + ~0.25 s), all words in (last word + ~0.35 s, or the middle for a
  one-word line), end (~0.08 s before the cut); a 4th for scenes over ~3 s;
- a notes box. Clicking a frame enlarges it; clicking a frame's timecode inserts it into the note.

Rules that made it work:
- **Text in a note = fix. Empty = approved.** No status buttons.
- A fresh, empty round after every new render; show last round's note greyed above each box.
- Same link every round; replace the frames, keep the notes store.
- Save notes somewhere you can read back directly (an artifact's shared store, a shared doc, a sheet).
- Key frames come from the timing data (`scripts/keyframes.py`), so every scene's frames are comparable
  across versions.
