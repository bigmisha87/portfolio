# Lyric timing: getting text to land on the sung word

## 1. Stems

Split the song into lead vocal and backing/choir (any stem separator: Demucs, UVR, the DAW project's own
stems if the musician can send them). Export short mono 16 kHz WAVs of the section you are animating;
Whisper works on 16 kHz mono anyway and short files are faster to iterate.

## 2. Lead vocal: transcription with word timestamps

Transcribe (do not force-align) the lead stem with word timestamps and VAD on. With `stable-ts`:

```python
import json, stable_whisper
model = stable_whisper.load_model('large-v3', device='cuda')        # 'cpu' works, just slower
res = model.transcribe('lead.wav', language='he', word_timestamps=True, vad=True)
words = [{'w': w.word.strip(), 's': round(w.start, 3), 'e': round(w.end, 3), 'p': round(w.probability, 3)}
         for seg in res.segments for w in seg.words]
json.dump(words, open('lead_words.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
```

Set `language` to the song's language. Low `p` (probability) words are the ones to double-check by ear.
Sung words get stretched ("כלללללל"): use the word **start**, and note where the held note ends if a
scene should last as long as the note.

## 3. Choir / backing: energy and onsets

Transcription fails on polyphonic choir. Instead:
- **Phrases:** RMS energy of the choir stem, smoothed (~50 ms), thresholded; each region above the
  threshold is a phrase.
- **Words inside a phrase:** onset detection on the choir stem (e.g. `librosa.onset.onset_detect` with
  backtracking). Map the phrase's known words to the strongest onsets in order.

## 4. Forced alignment: only with exact per-stem text

Aligning known lyrics to audio (`model.align(audio, text)`) drifts badly when the text assigned to a stem
is wrong (e.g. a line you thought was lead is actually choir). Use it only when you know exactly which
words each stem sings.

## 5. Verify every word (do this even when the pipeline looks right)

The pipeline's numbers are guesses until checked against the singing. In the source project, after
five review rounds, a verse was still 2 s early (a stray sound before it was taken as its onset), a choir
hook was 3 s late, and the closing phrase was sung twice at times nobody had marked.

- `scripts/audit_words.py words.json --stem lead=lead.wav --stem choir=choir.wav` lists every word placed
  where its singer is silent, and hints whether it is probably late or early.
- For a doubtful word, print the stem loudness every 0.05 s around it: phrase starts, dips between
  syllables and held notes are plain to see.
- Transcribe that single phrase alone (a short window starting at a silence). To find where a word
  starts, transcribe windows that start later and later: the latest start that still hears the whole
  word is where it is sung.
- A "word" that is three times longer than the same word elsewhere in the song usually swallowed a held
  previous word or an ad-lib; split it.
- When the director names a time and the words they hear there, trust it and look at the stems there.

## 6. Build the timeline

One entry per sung line: who sings it (lead/choir), its words with start times, and the line's start/end.
Then apply the lead-in:

- shift every word start ~0.2 s earlier,
- start each word's letter animation ~0.25 s before its (shifted) time, so the entrance **finishes**
  on the sung word,
- start each scene ~0.2 s before its first word (and at least ~0.3 s after the previous scene's first
  word, so no scene is a flash),
- each scene ends where the next starts.

If the director says text is late, the entrance is ending after the word. If a phrase "disappears too
fast", count how long the complete phrase is on screen before the cut; under ~1 s is too short. Merge
lines or move the cut, don't just speed everything up.
