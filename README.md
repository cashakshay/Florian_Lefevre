# Florian Lefèvre — setup guide

A 5-page site for the designer label **Florian Lefèvre**: **Home** (scroll-driven forge animation), **Collection** (shop), **Contact** (emails you), **Account** (sign up / sign in / order history) and **Bag** (cart + place order).

It already works the moment you open it: accounts and the bag run in *demo mode* (saved in your browser only). Follow the three steps below to make everything real, then publish.

---

## 1. Make the contact form email you (Formspree, ~3 min)

1. Go to https://formspree.io and sign up with **the email you want messages sent to**.
2. Click **+ New Form**, name it "Lefèvre contact", and create it.
3. Copy the endpoint. It looks like `https://formspree.io/f/xyzabcde`.
4. Open `js/config.js` and paste only the ID (the last part):
   ```js
   FORMSPREE_ID: "xyzabcde",
   ```
5. After your site is live (step 3), send yourself a test message. Formspree emails you a confirmation link the first time. Click it, then send another test. It should land in your inbox.

## 2. Turn on real accounts and a saved bag (Supabase, ~8 min)

1. Go to https://supabase.com, sign up, and click **New project** (any name, any region, save the database password somewhere).
2. When it's ready, open **SQL Editor → New query**, paste everything from `supabase-setup.sql`, and click **Run**. You should see "Success".
3. Open **Project Settings → API** (or the **Connect** button). Copy:
   - the **Project URL**
   - the **anon** key (also called the **publishable** key)
4. Paste both into `js/config.js`:
   ```js
   SUPABASE_URL: "https://abcdefghijklm.supabase.co",
   SUPABASE_ANON_KEY: "eyJhbGciOi...",
   ```
   ⚠️ Never paste the **service_role** / secret key. The anon key is meant to be public.
5. **Make testing easy:** go to **Authentication → Sign In / Providers → Email** and turn **off** "Confirm email". (If you leave it on, new users must click a link in their inbox before signing in; the site handles that too.)
6. After you publish (step 3), go to **Authentication → URL Configuration** and set **Site URL** to your live site's address.

**How to prove it works:** create an account, add pieces to your bag, place an order. Then open Supabase → **Table Editor** → `orders` and `carts`. Your data is there. Sign in on a different browser or your phone and your bag and order history follow you.

## 3. Publish it on the web (Netlify, ~2 min)

1. Go to https://app.netlify.com/drop.
2. Drag the whole `florian-lefevre` folder onto the page.
3. You get a live link like `https://something-random.netlify.app`. To rename it: **Site configuration → Change site name** (for example `florian-lefevre.netlify.app`).
4. To update later, drag the folder onto **Deploys** again.

*(GitHub Pages works too: upload the folder contents to a repo, then Settings → Pages → Deploy from branch.)*

## 4. Fill in your footer

Open `index.html` (and the other pages if you want them matching). Search for `EDIT THESE THREE LINES` and replace the `__` with your real time and number of prompts. The footer is the same block on every page.

---

## Checklist for the rubric

| Requirement | Where it is |
|---|---|
| 3+ pages | index, shop, contact, account, cart |
| Working contact form → your email | `contact.html` + Formspree ID in `js/config.js` |
| Signup / login system | `account.html` (Supabase Auth) |
| Cart that proves it works | `cart.html` → orders saved to Supabase, shown on account page |
| Images load | `images/` folder, all local, no outside links |
| Favicon + titles | `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`; every page has its own `<title>` |
| Mobile | Tested at phone width; menu turns into a full-screen overlay |
| Footer build notes | Bottom of every page |

## Where to change things

- **Products, prices, descriptions:** `js/products.js`
- **Colors and fonts:** top of `css/style.css` (`:root`)
- **Animations:** `js/particles.js` is the WebGL particle engine (shapes, including turning a product photo into particles). `js/fx.js` decides what each page shows: the scroll story on Home, the self-assembling collection on Collection, and the ember sphere on Contact. Change a product's photo and its particle version updates automatically.
- **Page text:** the `.html` files

## Troubleshooting

- **Account page says "Demo mode":** the Supabase URL or key in `js/config.js` is empty or has a typo.
- **"Could not save bag" in the browser console:** you haven't run `supabase-setup.sql` yet.
- **Contact form says it isn't connected:** add your Formspree ID.
- **The contact form and real accounts need the live link.** Everything else, including the particle animations, also works when you just double-click `index.html`.
- **Changed a product photo but the particles still show the old one when opened as a file?** When opened as a file, the particles use built-in copies in `js/photo-data.js`. On the live site they always use the real photo.
