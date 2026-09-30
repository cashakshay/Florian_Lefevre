/* ============================================================
   FLORIAN LEFÈVRE — accounts, bag and orders
   Uses Supabase when js/config.js has your keys.
   Without keys it runs in "demo mode" (saved only in this browser)
   so the site never breaks while you're setting up.
   ============================================================ */
(function () {
  const cfg = window.HALOGRAVE_CONFIG || {};
  const LIVE = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  const sb = LIVE ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

  const KEY_CART = "hg_bag";
  const KEY_USERS = "hg_demo_users";
  const KEY_SESSION = "hg_demo_session";
  const KEY_ORDERS = "hg_demo_orders";

  const read = (k, fallback) => {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  const products = window.HALOGRAVE_PRODUCTS || [];
  const byId = (id) => products.find((p) => p.id === id);

  let user = null;             // { id, email }
  let bag = read(KEY_CART, []); // [{ id, size, qty }]
  const listeners = new Set();

  const emit = () => listeners.forEach((fn) => { try { fn({ user, bag }); } catch (e) { console.error(e); } });
  const money = (n) => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 0 });

  async function sha256(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function mergeBags(a, b) {
    const out = a.map((i) => ({ ...i }));
    b.forEach((item) => {
      const hit = out.find((i) => i.id === item.id && i.size === item.size);
      if (hit) hit.qty = Math.min(9, hit.qty + item.qty);
      else out.push({ ...item });
    });
    return out.filter((i) => byId(i.id));
  }

  /* ---------- bag persistence ---------- */
  async function saveBag() {
    write(KEY_CART, bag);
    emit();
    if (LIVE && user) {
      const { error } = await sb.from("carts").upsert({ user_id: user.id, items: bag, updated_at: new Date().toISOString() });
      if (error) console.warn("Could not save bag to Supabase:", error.message);
    }
  }

  async function pullRemoteBag() {
    if (!(LIVE && user)) return;
    const { data, error } = await sb.from("carts").select("items").eq("user_id", user.id).maybeSingle();
    if (error) { console.warn("Could not load bag from Supabase:", error.message); return; }
    const remote = (data && Array.isArray(data.items)) ? data.items : [];
    const merged = mergeBags(remote, bag);
    bag = merged;
    await saveBag();
  }

  /* ---------- auth ---------- */
  const auth = {
    get user() { return user; },

    async signUp(email, password) {
      email = email.trim().toLowerCase();
      if (password.length < 8) throw new Error("Use a password with at least 8 characters.");
      if (LIVE) {
        const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
        if (error) throw error;
        if (!data.session) return { needsConfirmation: true };
        user = { id: data.user.id, email: data.user.email };
        await pullRemoteBag();
        emit();
        return { needsConfirmation: false };
      }
      const users = read(KEY_USERS, {});
      if (users[email]) throw new Error("An account with this email already exists. Sign in instead.");
      users[email] = { id: "demo-" + Date.now().toString(36), hash: await sha256(password) };
      write(KEY_USERS, users);
      user = { id: users[email].id, email };
      write(KEY_SESSION, user);
      emit();
      return { needsConfirmation: false };
    },

    async signIn(email, password) {
      email = email.trim().toLowerCase();
      if (LIVE) {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) {
          if (/confirm/i.test(error.message)) throw new Error("Confirm your email first. Check your inbox for the link from Supabase.");
          if (/invalid/i.test(error.message)) throw new Error("That email and password don't match an account.");
          throw error;
        }
        user = { id: data.user.id, email: data.user.email };
        await pullRemoteBag();
        emit();
        return;
      }
      const users = read(KEY_USERS, {});
      const rec = users[email];
      if (!rec || rec.hash !== (await sha256(password))) throw new Error("That email and password don't match an account.");
      user = { id: rec.id, email };
      write(KEY_SESSION, user);
      emit();
    },

    async signOut() {
      if (LIVE) await sb.auth.signOut();
      else localStorage.removeItem(KEY_SESSION);
      user = null;
      bag = [];
      write(KEY_CART, bag);
      emit();
    },
  };

  /* ---------- bag ---------- */
  const cart = {
    get items() {
      return bag
        .map((i) => ({ ...i, product: byId(i.id) }))
        .filter((i) => i.product);
    },
    get count() { return bag.reduce((n, i) => n + i.qty, 0); },
    get subtotal() { return this.items.reduce((n, i) => n + i.qty * i.product.price, 0); },

    async add(id, size, qty = 1) {
      bag = mergeBags(bag, [{ id, size, qty }]);
      await saveBag();
    },
    async setQty(id, size, qty) {
      bag = bag.map((i) => (i.id === id && i.size === size ? { ...i, qty: Math.max(1, Math.min(9, qty)) } : i));
      await saveBag();
    },
    async remove(id, size) {
      bag = bag.filter((i) => !(i.id === id && i.size === size));
      await saveBag();
    },
  };

  /* ---------- orders ---------- */
  const orders = {
    async place() {
      if (!user) throw new Error("Sign in to place your order.");
      const items = cart.items.map((i) => ({ id: i.id, name: i.product.name, size: i.size, qty: i.qty, price: i.product.price }));
      if (!items.length) throw new Error("Your bag is empty.");
      const total = cart.subtotal;
      let order;
      if (LIVE) {
        const { data, error } = await sb.from("orders").insert({ user_id: user.id, items, total }).select().single();
        if (error) throw new Error("The order could not be saved: " + error.message);
        order = data;
      } else {
        const all = read(KEY_ORDERS, {});
        order = { id: "HG-" + Math.random().toString(36).slice(2, 8).toUpperCase(), items, total, created_at: new Date().toISOString() };
        (all[user.email] = all[user.email] || []).unshift(order);
        write(KEY_ORDERS, all);
      }
      bag = [];
      await saveBag();
      return order;
    },
    async list() {
      if (!user) return [];
      if (LIVE) {
        const { data, error } = await sb.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
        if (error) { console.warn(error.message); return []; }
        return data || [];
      }
      return (read(KEY_ORDERS, {})[user.email]) || [];
    },
  };

  /* ---------- boot ---------- */
  const ready = (async () => {
    if (LIVE) {
      try {
        const { data } = await sb.auth.getSession();
        const s = data && data.session;
        user = s ? { id: s.user.id, email: s.user.email } : null;
        if (user) await pullRemoteBag();
        sb.auth.onAuthStateChange((_event, session) => {
          const next = session ? { id: session.user.id, email: session.user.email } : null;
          if ((next && next.id) !== (user && user.id)) { user = next; emit(); }
        });
      } catch (e) {
        console.warn("Supabase session check failed:", e);
      }
    } else {
      user = read(KEY_SESSION, null);
      if (cfg.SUPABASE_URL || cfg.SUPABASE_ANON_KEY) {
        console.warn("Florian Lefèvre site: Supabase keys are incomplete or the Supabase script didn't load, so accounts are in demo mode.");
      }
    }
    emit();
  })();

  window.HG = {
    live: LIVE,
    ready,
    auth,
    cart,
    orders,
    products,
    byId,
    money,
    onChange(fn) { listeners.add(fn); fn({ user, bag }); return () => listeners.delete(fn); },
  };
})();
