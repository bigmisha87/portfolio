Put downloadable files here (ZIPs, PDFs, scripts, templates, etc.).

These are the files that sit behind "Download" buttons on your blog posts.
Wix hides their real links from scripts, so the easiest way to bring them
over is:

  1. On your old site, click each Download button (it saves the file).
  2. Drop the downloaded files into THIS folder (site/assets/files/).
  3. Tell me which file belongs to which post — or just the filenames —
     and I'll add a proper Download button to that post.

Example of what I'll wire into a post (in data.js, inside that post's "body"):
  { "type": "file", "text": "Modeling practice.zip", "href": "assets/files/modeling-practice.zip" }

Tip: keep filenames simple (lowercase, no spaces), e.g. modeling-practice.zip
