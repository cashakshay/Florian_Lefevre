/* ============================================================
   FLORIAN LEFÈVRE — page behaviour
   ============================================================ */
(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const page = document.body.dataset.page;
  const HG = window.HG;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- header ---------- */
  const header = $(".site-header");
  const onScroll = () => header && header.classList.toggle("is-solid", window.scrollY > 24);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const menuBtn = $(".menu-btn");
  if (menuBtn) {
    const setOpen = (open) => {
      document.body.classList.toggle("nav-open", open);
      menuBtn.setAttribute("aria-expanded", String(open));
      menuBtn.textContent = open ? "Close" : "Menu";
    };
    menuBtn.addEventListener("click", () => setOpen(!document.body.classList.contains("nav-open")));
    $$(".nav a").forEach((a) => a.addEventListener("click", () => setOpen(false)));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
  }

  /* ---------- bag count + account link on every page ---------- */
  let lastCount = null;
  HG.onChange(({ user }) => {
    const count = HG.cart.count;
    $$("[data-bag-count]").forEach((el) => (el.textContent = count));
    const bagLink = $(".bag");
    if (bagLink) {
      bagLink.setAttribute("aria-label", `Bag, ${count} ${count === 1 ? "item" : "items"}`);
      if (lastCount !== null && count > lastCount) {
        bagLink.classList.remove("bump"); void bagLink.offsetWidth; bagLink.classList.add("bump");
      }
    }
    lastCount = count;
    $$("[data-account-link]").forEach((a) => (a.textContent = user ? "Account" : "Sign in"));
  });

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(html) {
    let el = $(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.innerHTML = html;
    requestAnimationFrame(() => el.classList.add("is-shown"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-shown"), 4200);
  }

  /* ---------- product card markup ---------- */
  function pieceHTML(p, tag = "button", extraClass = "") {
    const attrs = tag === "a" ? `href="shop.html#${p.id}"` : `type="button" data-open="${p.id}"`;
    return `<${tag} class="piece ${extraClass}" ${attrs}>
      <div class="piece-img"><img src="${p.image}" alt="${esc(p.name)}" loading="lazy" width="600" height="750"></div>
      <div class="piece-meta"><span>${esc(p.name)}</span><span class="price">${HG.money(p.price)}</span></div>
      <p class="piece-cat">${esc(p.category)}</p>
    </${tag}>`;
  }

  /* ============================================================
     HOME — featured pieces
     ============================================================ */
  if (page === "home") {
    const grid = $("#featured-grid");
    if (grid) {
      const picks = ["requiem-jacket", "vigil-pendant", "martyr-boot"].map(HG.byId).filter(Boolean);
      grid.innerHTML = picks.map((p) => pieceHTML(p, "a")).join("");
    }
  }

  /* ============================================================
     SHOP
     ============================================================ */
  if (page === "shop") {
    const grid = $("#shop-grid");
    const filterBar = $("#filters");
    const dialog = $("#quick");
    let current = "All";

    const cats = ["All", ...new Set(HG.products.map((p) => p.category))];
    filterBar.innerHTML = cats.map((c) => `<button class="filter" type="button" aria-pressed="${c === current}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");

    function render() {
      const list = HG.products.filter((p) => current === "All" || p.category === current);
      grid.innerHTML = list.length
        ? list.map((p) => pieceHTML(p, "button", current === "All" && p.feature ? "is-feature" : "")).join("")
        : `<p class="empty-note">Nothing in this category yet.</p>`;
    }
    render();

    filterBar.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-cat]");
      if (!btn) return;
      current = btn.dataset.cat;
      $$(".filter", filterBar).forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      render();
    });

    function openProduct(id) {
      const p = HG.byId(id);
      if (!p) return;
      dialog.innerHTML = `
        <div class="quick-inner">
          <img src="${p.image}" alt="${esc(p.name)}" width="600" height="750">
          <form class="quick-body" method="dialog">
            <h2 id="quick-title">${esc(p.name)}</h2>
            <p class="price">${HG.money(p.price)}</p>
            <p class="blurb">${esc(p.blurb)}</p>
            <fieldset class="sizes">
              <legend>${p.sizes.length > 1 ? "Choose a size" : "Size"}</legend>
              <div class="size-options">
                ${p.sizes.map((s, i) => `<label><input type="radio" name="size" value="${esc(s)}" ${p.sizes.length === 1 && i === 0 ? "checked" : ""} required><span>${esc(s)}</span></label>`).join("")}
              </div>
            </fieldset>
            <button class="btn btn--solid btn--block" type="submit" value="add">Add to bag</button>
            <p class="quick-note">Made to order. Ships in 3 to 5 weeks, numbered and signed.</p>
          </form>
        </div>
        <button class="quick-close" type="button" aria-label="Close">×</button>`;
      dialog.setAttribute("aria-labelledby", "quick-title");
      dialog.showModal();
      history.replaceState(null, "", "#" + p.id);

      $(".quick-close", dialog).addEventListener("click", () => dialog.close());
      $("form", dialog).addEventListener("submit", async (e) => {
        e.preventDefault();
        const size = new FormData(e.target).get("size");
        if (!size) return;
        await HG.cart.add(p.id, size, 1);
        dialog.close();
        toast(`${esc(p.name)}, size ${esc(size)}, added to your bag. <a href="cart.html">View bag</a>`);
      });
    }

    const fxCaption = $("#fx-caption");
    if (fxCaption) fxCaption.addEventListener("click", (e) => {
      const b = e.target.closest("[data-open]");
      if (b) openProduct(b.dataset.open);
    });

    grid.addEventListener("click", (e) => {
      const card = e.target.closest("[data-open]");
      if (card) openProduct(card.dataset.open);
    });
    dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener("close", () => history.replaceState(null, "", location.pathname));

    const fromHash = decodeURIComponent(location.hash.slice(1));
    if (fromHash && HG.byId(fromHash)) setTimeout(() => openProduct(fromHash), 250);
  }

  /* ============================================================
     CART
     ============================================================ */
  if (page === "cart") {
    const root = $("#cart-root");
    let placedOrder = null;

    function render({ user }) {
      if (placedOrder) {
        root.innerHTML = `
          <div class="sent" style="max-width:36rem">
            <h2>Received</h2>
            <p>Order ${esc(String(placedOrder.id).slice(0, 8).toUpperCase())} is saved to your account. Total ${HG.money(placedOrder.total)}. You can see it any time on your account page.</p>
            <a class="btn" href="account.html">View your orders</a>
          </div>`;
        return;
      }
      const items = HG.cart.items;
      if (!items.length) {
        root.innerHTML = `
          <div class="empty-state">
            <p>Your bag is empty. Everything in Collection 00 is made to order in small numbers.</p>
            <a class="btn" href="shop.html">Shop the collection</a>
          </div>`;
        return;
      }
      root.innerHTML = `
        <div class="cart-layout">
          <ul class="cart-list">
            ${items.map((i) => `
              <li class="cart-item" data-id="${esc(i.id)}" data-size="${esc(i.size)}">
                <img src="${i.product.image}" alt="" width="600" height="750">
                <div>
                  <h2>${esc(i.product.name)}</h2>
                  <p class="meta">Size ${esc(i.size)}</p>
                  <div class="qty" role="group" aria-label="Quantity for ${esc(i.product.name)}">
                    <button type="button" data-act="dec" aria-label="Remove one">−</button>
                    <output aria-live="polite">${i.qty}</output>
                    <button type="button" data-act="inc" aria-label="Add one">+</button>
                  </div>
                  <button class="remove" type="button" data-act="remove">Remove</button>
                </div>
                <span class="line-total">${HG.money(i.qty * i.product.price)}</span>
              </li>`).join("")}
          </ul>
          <aside class="summary" aria-labelledby="summary-title">
            <h2 id="summary-title">Summary</h2>
            <dl>
              <dt>Subtotal</dt><dd>${HG.money(HG.cart.subtotal)}</dd>
              <dt>Shipping</dt><dd>Free</dd>
              <dt class="total">Total</dt><dd class="total">${HG.money(HG.cart.subtotal)}</dd>
            </dl>
            ${user
              ? `<button class="btn btn--solid btn--block" type="button" id="place">Place order</button>
                 <p class="fine">Signed in as ${esc(user.email)}. This is a demo store, so no payment is taken.</p>`
              : `<a class="btn btn--solid btn--block" href="account.html?next=cart.html">Sign in to place order</a>
                 <p class="fine">Your bag is saved on this device. Sign in and it's saved to your account too.</p>`}
            <p class="status" id="cart-status" role="alert"></p>
          </aside>
        </div>`;
    }

    HG.onChange(render);

    root.addEventListener("click", async (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      if (btn.id === "place") {
        btn.disabled = true; btn.textContent = "Placing order…";
        try {
          placedOrder = await HG.orders.place();
          render({ user: HG.auth.user });
        } catch (err) {
          $("#cart-status").textContent = err.message;
          $("#cart-status").className = "status is-error";
          btn.disabled = false; btn.textContent = "Place order";
        }
        return;
      }
      const row = btn.closest(".cart-item");
      if (!row) return;
      const { id, size } = row.dataset;
      const item = HG.cart.items.find((i) => i.id === id && i.size === size);
      if (!item) return;
      if (btn.dataset.act === "inc") await HG.cart.setQty(id, size, item.qty + 1);
      if (btn.dataset.act === "dec") item.qty > 1 ? await HG.cart.setQty(id, size, item.qty - 1) : await HG.cart.remove(id, size);
      if (btn.dataset.act === "remove") await HG.cart.remove(id, size);
    });
  }

  /* ============================================================
     ACCOUNT
     ============================================================ */
  if (page === "account") {
    const root = $("#account-root");
    const next = new URLSearchParams(location.search).get("next");
    const safeNext = next && /^[a-z]+\.html$/.test(next) ? next : null;
    let mode = "signin";
    let flash = "";

    const demoNote = HG.live ? "" : `<p class="notice">Demo mode: accounts are saved only in this browser. Add your Supabase keys to js/config.js to switch on real accounts.</p>`;

    async function render({ user }) {
      if (user) {
        root.innerHTML = `
          <div class="account-layout">
            <p class="lede" style="margin-top:0">Signed in as <strong style="color:var(--bone);font-weight:500">${esc(user.email)}</strong></p>
            <h2 style="margin:3rem 0 0;font-weight:500;font-size:1.1rem">Your orders</h2>
            <ul class="orders" id="orders"><li><span class="order-items">Loading orders…</span></li></ul>
            <div style="display:flex;flex-wrap:wrap;gap:1rem">
              <a class="btn" href="${safeNext || "shop.html"}">${safeNext === "cart.html" ? "Back to your bag" : "Shop the collection"}</a>
              <button class="btn" type="button" id="signout">Sign out</button>
            </div>
          </div>`;
        $("#signout").addEventListener("click", () => HG.auth.signOut());
        const list = await HG.orders.list();
        const ul = $("#orders");
        if (!ul) return;
        ul.innerHTML = list.length
          ? list.map((o) => `
              <li>
                <div class="order-top"><span>Order ${esc(String(o.id).slice(0, 8).toUpperCase())}</span><span>${HG.money(o.total)}</span></div>
                <span class="order-items">${new Date(o.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. ${o.items.map((i) => `${esc(i.name)} (${esc(i.size)}) × ${i.qty}`).join(", ")}</span>
              </li>`).join("")
          : `<li><span class="order-items">No orders yet. When you place one it shows up here.</span></li>`;
        return;
      }

      const isIn = mode === "signin";
      root.innerHTML = `
        <div class="account-layout">
          ${demoNote}
          <div class="tabs" role="tablist" aria-label="Account">
            <button class="tab" role="tab" type="button" id="tab-in" aria-selected="${isIn}" aria-controls="auth-form">Sign in</button>
            <button class="tab" role="tab" type="button" id="tab-up" aria-selected="${!isIn}" aria-controls="auth-form">Create account</button>
          </div>
          <form class="form" id="auth-form" role="tabpanel" aria-labelledby="${isIn ? "tab-in" : "tab-up"}" novalidate>
            <div class="field">
              <label for="email">Email</label>
              <input id="email" name="email" type="email" autocomplete="email" required>
            </div>
            <div class="field">
              <label for="password">Password</label>
              <input id="password" name="password" type="password" autocomplete="${isIn ? "current-password" : "new-password"}" minlength="8" required>
              ${isIn ? "" : `<span class="hint">At least 8 characters.</span>`}
            </div>
            <button class="btn btn--solid btn--block" type="submit">${isIn ? "Sign in" : "Create account"}</button>
            <p class="status ${flash ? "is-ok" : ""}" id="auth-status" role="alert">${flash}</p>
          </form>
        </div>`;
      flash = "";

      $("#tab-in").addEventListener("click", () => { mode = "signin"; render({ user: null }); });
      $("#tab-up").addEventListener("click", () => { mode = "signup"; render({ user: null }); });

      $("#auth-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const form = e.target;
        const status = $("#auth-status");
        const email = form.email.value.trim();
        const password = form.password.value;
        status.className = "status is-error";
        if (!/^\S+@\S+\.\S+$/.test(email)) { status.textContent = "Enter a valid email address."; form.email.focus(); return; }
        if (!password) { status.textContent = "Enter your password."; form.password.focus(); return; }
        const btn = form.querySelector("button[type=submit]");
        const label = btn.textContent;
        btn.disabled = true; btn.textContent = isIn ? "Signing in…" : "Creating account…";
        try {
          if (isIn) {
            await HG.auth.signIn(email, password);
          } else {
            const res = await HG.auth.signUp(email, password);
            if (res.needsConfirmation) {
              mode = "signin";
              flash = `Account created. Open the confirmation link sent to ${esc(email)}, then sign in here.`;
              render({ user: null });
              return;
            }
          }
          if (safeNext) location.href = safeNext;
        } catch (err) {
          status.textContent = err.message || "Something went wrong. Try again.";
          btn.disabled = false; btn.textContent = label;
        }
      });
    }

    HG.ready.then(() => HG.onChange(render));
  }

  /* ============================================================
     CONTACT — sends to your email through Formspree
     ============================================================ */
  if (page === "contact") {
    const form = $("#contact-form");
    const status = $("#contact-status");
    const id = (window.HALOGRAVE_CONFIG || {}).FORMSPREE_ID;
    if (id) form.action = "https://formspree.io/f/" + id;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      status.className = "status is-error";
      const missing = $$("[required]", form).find((el) => !el.value.trim());
      if (missing) { status.textContent = `Fill in ${missing.dataset.label || "every field"} before sending.`; missing.focus(); return; }
      if (!/^\S+@\S+\.\S+$/.test(form.email.value.trim())) { status.textContent = "Enter a valid email address so we can reply."; form.email.focus(); return; }
      if (!id) { status.textContent = "The form isn't connected yet. Add your Formspree ID to js/config.js."; return; }

      const btn = form.querySelector("button[type=submit]");
      btn.disabled = true; btn.textContent = "Sending…";
      try {
        const res = await fetch(form.action, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data.errors && data.errors.map((x) => x.message).join(", ")) || "The message didn't send.");
        }
        document.dispatchEvent(new CustomEvent("lefevre:sent"));
        const name = form.name.value.trim().split(" ")[0];
        form.outerHTML = `
          <div class="sent" role="status">
            <h2>Sent</h2>
            <p>Thank you, ${esc(name)}. Your message reached the studio and we'll reply to ${esc(form.email.value.trim())} within two working days.</p>
            <a class="btn" href="shop.html">Back to the collection</a>
          </div>`;
      } catch (err) {
        status.textContent = err.message + " Check your connection and send it again.";
        btn.disabled = false; btn.textContent = "Send message";
      }
    });
  }
})();
