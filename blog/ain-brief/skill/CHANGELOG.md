# Changelog

This folder is the one master copy of the skill (in Dropbox, linked into `~/.claude/skills`). It is improved
a little after every project. The share file `lyric-motion-director.skill` sits inside this folder.

How to update (end of every project, see SKILL.md step 6):
1. Add the new lessons where they belong (SKILL.md, references, scripts). Keep rules general, with the reason.
2. Add a version entry below: date (DD.MM.YYYY), project, what changed.
3. Repackage `lyric-motion-director.skill` in this folder: a zip with the folder `lyric-motion-director/` at its
   root, leaving out the .skill file itself.

## v2, 27.10.2026, "רחמים" full clip (4:12)
- Timing: verify every word against the singing; trust the director's ear on choir lines; `scripts/audit_words.py`.
- Real objects that act on the words; keep a working set alive; show only what is sung.
- Never a static or black frame; scene-change rules for a camera journey; endings.
- Physical motion (straight drops, nothing through the floor); type always whole in frame; no plates behind text.
- Machine audits: `scripts/audit_clip.py` (black, still, jumps), `scripts/audit_words.py`.
- New rows in the failure-mode table.

## v1, 27.10.2026, "רחמים" first 44 s
- The method and taste from the first review rounds: timing to the sung word, one idea per line, smooth camera,
  no gimmicks, tight type, never-cut backdrops, RTL Hebrew, self-QA, storyboard notes (text = fix, empty = approved).
