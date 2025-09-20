# IMI Service Report (Next.js + Tailwind)

## Run locally
```bash
npm install
npm run dev
```

## Deploy to Vercel
- Import this repo into Vercel and deploy (defaults work).
- This app allows embedding from `https://imicorp.com.sg` (see `next.config.mjs`).

## WordPress `/service` page
Use:
```html
<div style="height:100vh">
  <iframe src="https://<your-vercel-app>.vercel.app/" style="width:100%;height:100%;border:0;" allowfullscreen></iframe>
</div>
```
