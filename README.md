# vishaltk.dev, v3

Same site, same words, new bones.

- Next.js (App Router), React 19, TypeScript
- Tailwind v4 with shadcn/ui primitives (button, dialog, tooltip, accordion)
- Motion for the small movements
- Dark only. Three looks to choose from: prism, graphite, ember. Preview one with `?look=graphite` in the url (it sticks in that browser).

## run it

```bash
npm install
npm run dev
```

## where things live

- `lib/data.ts` is every word on the site. Edit copy there.
- `lib/palette.ts` holds the looks, their hue ranges, and the script that sets the look before first paint.
- `app/globals.css` maps each look to the shadcn tokens. Add a look by adding an `html[data-look="..."]` block and an entry in `lib/palette.ts`.
- `components/shell/` is the frame: nav, socials rail, gift button, look picker, backdrop.

## locking in one look

Open `/?look=prism`, `/?look=graphite` and `/?look=ember` to compare. Once you've picked, set `DEFAULT_LOOK` in `lib/palette.ts`. The other two `html[data-look]` blocks in `globals.css` and their fonts in `app/layout.tsx` can go too.
