# FROM NOTHING — fromnothing.pl

Official site for the band **FROM NOTHING**. Static site — deployed on Cloudflare Pages.

## Stack
- Plain HTML/CSS/JS (no framework, no build step)
- Google Fonts: Anton, Teko, Space Mono
- i18n: PL / EN (localStorage-persisted)
- Form: mailto fallback (ready to swap for Cloudflare Worker / Formspree)

## Dev
Any static file server will do, e.g.:

```bash
python3 -m http.server 5173
# or
npx serve .
```

Then open http://localhost:5173.

## Deploy — Cloudflare Pages
1. Push to GitHub: `d44b/fromnothing`
2. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git
3. Framework preset: **None**
4. Build command: (leave empty)
5. Build output directory: `/`
6. Add custom domain `fromnothing.pl` once DNS is moved to Cloudflare

## Structure
```
/
├── index.html
├── assets/
│   ├── css/style.css
│   ├── js/app.js
│   └── img/          ← logo variants, og-image, favicon
└── README.md
```
