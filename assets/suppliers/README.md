# Supplier image folders

Each supplier should have its own folder. Example:

```text
assets/suppliers/
  justshootme-photobooth/
    cover.jpg
    logo.png
    gallery-01.jpg
    gallery-02.jpg
```

The folder name must match the supplier's **Business Folder** in Admin.
The database stores only the folder name / image filenames; the actual files stay in GitHub.

Recommended names:
- `cover.jpg` — public supplier card image
- `logo.png` — optional logo
- `gallery-01.jpg`, `gallery-02.jpg`, ... — gallery

Important: the browser Admin page cannot create or upload files into a GitHub repository. Add/replace the actual image files in GitHub (web upload, GitHub Desktop, or git commit), then use the filenames in Admin.
