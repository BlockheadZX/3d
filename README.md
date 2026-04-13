# Cloudflare Pages Deployment

This project is ready to deploy as a static Cloudflare Pages site.

## Option A: Git Integration

1. Push this folder to GitHub or GitLab.
2. In Cloudflare Dashboard, go to `Workers & Pages` -> `Create application` -> `Pages` -> `Connect to Git`.
3. Select this repository.
4. Use these build settings:
   - Framework preset: `None`
   - Build command: `npm run pages:build`
   - Build output directory: `dist`
   - Root directory: leave empty
5. Click `Save and Deploy`.

## Option B: Direct Upload

1. Run `npm run pages:build` locally.
2. In Cloudflare Dashboard, go to `Workers & Pages` -> `Create application` -> `Pages` -> `Direct Upload`.
3. Upload the `dist` folder.

## Notes

- **`npm run pages:build`** runs esbuild to refresh `file-bundle.js`, then copies assets into `dist`.
- In the browser, **`http(s):`** loads **`file-bundle.js`** by default (including `127.0.0.1`), so Three.js is not loaded as separate `vendor/` modules (avoids `text/html` MIME errors when paths or hosting rules are wrong).
- Add **`?module=1`** to the URL to load **`main-enhanced.js`** as an ES module while you edit that file; your static server must serve `vendor/**/*.js` with a JavaScript MIME type.
- `_headers` is included to keep HTML and the service worker fresh on updates.
