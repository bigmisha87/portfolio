# Misha Graphics — portfolio site

A dark, full-width, mobile-first portfolio. Plain HTML/CSS/JavaScript —
**no build step, no install.** Open it and it works.

## Pages

| File | What it is |
|---|---|
| `index.html` | Home — the 8-discipline grid (2 rows of 4) |
| `category.html` | A discipline's gallery + the video/image lightbox, with a "By client" view |
| `brand.html` | A client case-study page (intro + every piece for that client) |
| `about.html` | Your bio, stats and "What I do" |
| `blog.html` | The journal, with tag filter + search |
| `studio.html` | **The editor** — see below |

The header and footer are built automatically on every page, so you define
them once. A piece can be an **image, a video, or both** — image-only
categories simply have no video.

## ✦ Editing everything: the Studio (recommended)

You don't touch code. **Double-click `Start-Studio.bat`** — it opens the
**Studio** in your browser. There you can, with simple visual forms:

- add / edit the 8 disciplines and **upload a cover image** for each,
- add work to any discipline and mark it as **image, video, or both**
  (upload the file, or paste a YouTube/Vimeo link),
- create **brand case studies** (a client name → its own page),
- write **blog posts** with a full content editor — add headings, text,
  images and **videos** (paste a YouTube/Vimeo link or upload a file),
  reorder any block, and **drag posts by the ⠿ handle** to set their order,
- edit your bio, stats, photo and links.

Then press **Save** — it writes straight back into this folder. Refresh the
site (`Ctrl+F5`) to see the changes.

**First time:** click **Connect folder** and choose this `site` folder (this
lets the editor save and store your uploads). After that it remembers it.

> The Studio needs **Chrome or Edge on a computer**. Keep the small server
> window open while you edit; close it when you're done. No Python or install
> needed — the launcher uses PowerShell, which is built into Windows.

## Click a brand → case study

In any discipline, switch to **"By client"**. Each client name is now a link
to its case-study page (`brand.html`), which shows that client's intro and
**all** their work across every discipline. You manage brands in the Studio's
**Brands** tab; a brand's *Name* must match the *Client* you type on the work.

## Preview the site

Double-click `index.html`, or (if media doesn't show that way) use the same
local server the Studio uses and visit `http://localhost:8080`.

## Re-color the whole site

Open `assets/css/styles.css`, change the first line under `:root`:

```css
--accent: #9b7bff;   /* the purple — change to any color */
```

## Publish it

It's just files. Upload the **contents of this `site` folder** to any web host
(Netlify, Vercel, GitHub Pages, or classic FTP). `index.html` must sit at the
top level. *(Later, when you buy a domain, we can swap the local Studio for an
online editor — the content format is the same, so nothing is wasted.)*

## Advanced: editing the content file by hand

Everything the Studio saves lives in `assets/js/data.js` (`window.SITE`). You
can edit it in any text editor instead of the Studio if you prefer — it mirrors
exactly what the Studio shows.

## Images & video

The Studio drops uploads into `assets/img/` for you. If adding by hand:
- Vertical reels: real `.mp4`, 1080×1920, or a YouTube/Vimeo link.
- Covers / posters: JPG or WebP, ~1200px on the long side.
