/* ==========================================================================
   SHARED REFERENCES
   ========================================================================== */
const header = document.querySelector(".header");
const hero = document.getElementById("home");
const reduceMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;
const canHover = window.matchMedia("(hover: hover)").matches;
const hasObserver = "IntersectionObserver" in window;

// Same query as the CSS that removes the portrait dim on mobile / touch
const flatPortrait = window.matchMedia("(max-width: 900px), (hover: none)");

let heroVisible = true; // shared with the spotlight loop below

/* ==========================================================================
   MOBILE MENU
   ========================================================================== */
const menuToggle = document.getElementById("menuToggle");
const nav = document.getElementById("nav");

function setMenu(open) {
  nav.classList.toggle("is-open", open);
  header.classList.toggle("menu-open", open);
  menuToggle.classList.toggle("is-open", open);
  menuToggle.setAttribute("aria-expanded", String(open));
  document.body.style.overflow = open ? "hidden" : "";
}

menuToggle.addEventListener("click", () => {
  setMenu(!nav.classList.contains("is-open"));
});
nav.querySelectorAll(".nav__link").forEach((link) => {
  link.addEventListener("click", () => setMenu(false));
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") setMenu(false);
});

/* ==========================================================================
   BADGES: ENDLESS MARQUEE
   The group of badges is repeated until it is wider than the screen, then
   cloned once. The CSS slides the track by exactly -50%, so the clone ends up
   where the original started and the loop has no gap or jump.
   ========================================================================== */
(() => {
  const track = document.getElementById("badgesTrack");
  const group = document.getElementById("badgesGroup");
  if (!track || !group) return;

  const originals = Array.from(group.children).map((li) => li.cloneNode(true));
  const SPEED = 55; // pixels per second

  function build() {
    // reset to a single group with one set of badges
    track.querySelectorAll(".badges__group--clone").forEach((g) => g.remove());
    group.replaceChildren(...originals.map((li) => li.cloneNode(true)));

    const setWidth = group.offsetWidth;
    if (!setWidth) return;

    // repeat the set until one group covers the whole viewport
    const repeats = Math.ceil(window.innerWidth / setWidth);
    for (let i = 1; i < repeats; i++) {
      originals.forEach((li) => group.appendChild(li.cloneNode(true)));
    }

    // identical second group = the seamless half of the loop
    const clone = group.cloneNode(true);
    clone.removeAttribute("id");
    clone.classList.add("badges__group--clone");
    clone.setAttribute("aria-hidden", "true");
    track.appendChild(clone);

    // constant speed no matter how many badges there are
    track.style.setProperty(
      "--marquee-duration",
      `${(group.offsetWidth / SPEED).toFixed(1)}s`,
    );
  }

  // wait for the web fonts so the badge widths are measured correctly
  const ready = document.fonts && document.fonts.ready;
  (ready || Promise.resolve()).then(build);

  let resizeTimer;
  let lastWidth = window.innerWidth;
  window.addEventListener("resize", () => {
    if (window.innerWidth === lastWidth) return; // ignore mobile address-bar resizes
    lastWidth = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(build, 200);
  });
})();

/* ==========================================================================
   HERO: RADAR PARALLAX + OPTIONAL VIDEO BACKGROUND
   ========================================================================== */
const heroLive = hero && hero.querySelector(".hero__live");

if (heroLive && canHover && !reduceMotion) {
  hero.addEventListener("mousemove", (e) => {
    const rect = hero.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 to 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    heroLive.style.setProperty("--mx", `${x * 120}px`);
    heroLive.style.setProperty("--my", `${y * 80}px`);
  });
  hero.addEventListener("mouseleave", () => {
    heroLive.style.setProperty("--mx", "0px");
    heroLive.style.setProperty("--my", "0px");
  });
}

// HERO BACKGROUND: plan A video, plan B image, plan C the live CSS radar.
// Waves are the default. Each plan only takes over once its file has really
// loaded, and the page falls back to the next plan if it fails or stalls,
// so a missing file never leaves a blank hero.
(() => {
  const video = document.getElementById("heroVideo");
  const image = document.getElementById("heroImage");
  const IMAGE_URL = image && image.dataset.src;

  const useVideo = !!video && !reduceMotion;
  let videoFailed = !useVideo; // true = skip the video, use image or silk
  let imageReady = false;

  // floating dust: a handful of tiny specks over the image. Kept minimal
  // on purpose (fewer on phones) and skipped for reduced motion.
  let dust = null;
  if (!reduceMotion) {
    dust = document.createElement("div");
    dust.className = "hero__dust";
    dust.setAttribute("aria-hidden", "true");
    hero.querySelector(".hero__overlay").after(dust);

    const small = window.matchMedia("(max-width: 900px)");
    const rand = (a, b) => a + Math.random() * (b - a);
    const buildDust = () => {
      const count = small.matches ? 14 : 28;
      dust.replaceChildren(
        ...Array.from({ length: count }, () => {
          const el = document.createElement("i");
          el.style.cssText = [
            `--x:${rand(4, 96).toFixed(1)}%`,
            `--y:${rand(35, 100).toFixed(1)}%`,
            `--s:${rand(1, 2.2).toFixed(1)}px`,
            `--o:${rand(0.2, 0.5).toFixed(2)}`,
            `--t:${rand(18, 32).toFixed(1)}s`,
            `--d:-${rand(0, 30).toFixed(1)}s`,
            `--dx:${rand(-30, 30).toFixed(0)}px`,
          ].join(";");
          return el;
        }),
      );
    };
    buildDust();
    small.addEventListener("change", buildDust);
  }

  function sync() {
    const bg = !videoFailed ? "video" : imageReady ? "image" : "live";
    hero.dataset.bg = bg;
    if (dust) dust.classList.toggle("is-paused", !heroVisible);
    if (!video) return;
    if (bg === "video" && heroVisible) video.play().catch(() => {});
    else video.pause();
  }
  // plan A: video. Stay in video mode while it loads; only give up on an
  // error, or if nothing has loaded after 6 seconds.
  if (useVideo) {
    const fail = () => {
      videoFailed = true;
      sync();
    };
    video.addEventListener("error", fail, true);
    setTimeout(() => {
      if (video.readyState < 2) fail();
    }, 6000);
  }

  // plan B: image (probed first, so a missing file never shows a broken box)
  if (image && IMAGE_URL) {
    const probe = new Image();
    probe.onload = () => {
      image.style.backgroundImage = `url("${IMAGE_URL}")`;
      imageReady = true;
      sync();
    };
    probe.onerror = () => {
      imageReady = false;
      sync();
    };
    probe.src = IMAGE_URL;
  }

  if (hasObserver) {
    new IntersectionObserver(([entry]) => {
      heroVisible = entry.isIntersecting;
      sync();
    }).observe(hero);
  }
  document.addEventListener("visibilitychange", () => {
    heroVisible = !document.hidden;
    sync();
  });

  sync();
})();

/* ==========================================================================
   HERO PORTRAIT: SPOTLIGHT (DESKTOP ONLY)
   - Desktop: the portrait is dim; move the mouse over the hero and the light
     follows the cursor, then fades out when the cursor leaves.
   - Mobile / touch: no dim and no spotlight. The CSS shows the portrait at
     normal brightness and this loop simply does nothing.
   ========================================================================== */
(() => {
  const stack = document.getElementById("photoStack");
  if (!stack || !hero) return;

  // reduced motion: show the portrait fully lit, no animation
  if (reduceMotion) {
    stack.classList.add("is-lit");
    return;
  }

  let W = 0;
  let H = 0;
  const measure = () => {
    W = stack.clientWidth;
    H = stack.clientHeight;
  };
  new ResizeObserver(measure).observe(stack);
  measure();

  const FULL_RADIUS = 0.36; // spotlight size as a fraction of the portrait height

  // pointer position as a fraction of the portrait (0 to 1)
  const ptr = { x: 0.5, y: 0.4 };
  // what is currently drawn
  const cur = { x: 0.5, y: 0.4, r: 0 };
  let active = false; // is the mouse steering the light right now?

  hero.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const r = stack.getBoundingClientRect();
    ptr.x = (e.clientX - r.left) / r.width;
    ptr.y = (e.clientY - r.top) / r.height;
    active = true;
  });
  hero.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "mouse") active = false;
  });

  function frame() {
    requestAnimationFrame(frame);
    if (flatPortrait.matches) return; // mobile / touch: effect is off
    if (!heroVisible || document.hidden || !H) return;

    // ease toward the target (position a little quicker than size)
    const tx = active ? ptr.x : cur.x;
    const ty = active ? ptr.y : cur.y;
    const tr = active ? H * FULL_RADIUS : 0; // idle: lights off

    cur.x += (tx - cur.x) * 0.14;
    cur.y += (ty - cur.y) * 0.14;
    cur.r += (tr - cur.r) * 0.1;

    stack.style.setProperty("--sx", `${(cur.x * W).toFixed(1)}px`);
    stack.style.setProperty("--sy", `${(cur.y * H).toFixed(1)}px`);
    stack.style.setProperty("--r", `${Math.max(cur.r, 1).toFixed(0)}px`);
  }
  requestAnimationFrame(frame);
})();

/* ==========================================================================
   HERO PORTRAIT: CODE HALF
   The right half of the face dissolves into code. CSS does the animation;
   this only (1) writes the code lines, (2) sizes the font to the portrait and
   (3) throws bits of code off the face. Nothing here runs per frame.
   ========================================================================== */
(() => {
  const stack = document.getElementById("photoStack");
  const code = document.getElementById("photoCode");
  const bits = document.getElementById("photoBits");
  if (!stack || !code) return;

  const SNIPPETS = [
    "const express = require('express');",
    "const router = express.Router();",
    "app.use(express.json());",
    "app.use(cors({ origin: true }));",
    "app.listen(PORT, () => log('up'));",
    "function validate(data) {",
    "  if (!data) return null;",
    "  const { id, email } = data;",
    "  return { success: true };",
    "}",
    "async function getEmployee(id) {",
    "  const [rows] = await db.query(",
    "    'SELECT * FROM employees WHERE id = ?',",
    "    [id],",
    "  );",
    "  return rows[0] ?? null;",
    "}",
    "router.post('/payroll', async (req, res) => {",
    "  const net = gross - tax - sss;",
    "  res.json({ net, status: 'ok' });",
    "});",
    "module.exports = { validate, handleError };",
    "export default function App() {",
    "  const [data, setData] = useState([]);",
    "  useEffect(() => { load(); }, []);",
    "  return <Dashboard rows={data} />;",
    "}",
    "try { await connect(); } catch (err) {",
    "  handleError(err);",
    "}",
    "SELECT name, SUM(hours) FROM attendance",
    "GROUP BY employee_id ORDER BY 2 DESC;",
    "git commit -m 'fix: payroll rounding'",
    "npm run build && npm run deploy",
    "if (status === 200) return res.json(rows);",
    "const token = jwt.sign({ id }, SECRET);",
    "for (let i = 0; i < n; i++) sum += a[i];",
    "ping 192.168.1.1 -c 4 // ok",
    "digitalWrite(PIN_LED, HIGH); delay(250);",
    "const hydration = readSensor(A0) / 1023;",
    "return res.status(404).json({ error });",
    "import { useState, useEffect } from 'react';",
  ];
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const hex = () =>
    "0x" +
    Math.floor(Math.random() * 65535)
      .toString(16)
      .padStart(4, "0");
  const bin = () =>
    Array.from({ length: 4 }, () =>
      Math.floor(Math.random() * 256)
        .toString(2)
        .padStart(8, "0"),
    ).join(" ");

  function makeLine() {
    const row = document.createElement("div");
    row.className = "cl";
    // one stream = a few snippets in a row, written twice so the slide loops
    let text = "";
    while (text.length < 80) {
      const r = Math.random();
      text +=
        (r < 0.1 ? bin() : r < 0.2 ? `${hex()}  ${hex()}` : pick(SNIPPETS)) +
        "     ";
    }
    const flow = document.createElement("span");
    flow.className = "cf";
    flow.append(
      Object.assign(document.createElement("span"), { textContent: text }),
      Object.assign(document.createElement("span"), { textContent: text }),
    );
    row.appendChild(flow);
    row.style.setProperty("--o", rand(0.6, 1).toFixed(2));
    if (!reduceMotion) {
      row.style.setProperty("--pt", `${rand(3, 7).toFixed(1)}s`); // fade out / in
      row.style.setProperty("--pd", `-${rand(0, 7).toFixed(1)}s`);
      row.style.setProperty("--ft", `${rand(7, 15).toFixed(1)}s`); // slide speed
      row.style.setProperty("--fd", `-${rand(0, 15).toFixed(1)}s`);
    }
    const k = Math.random();
    if (k < 0.12) row.classList.add("is-hi");
    else if (k < 0.4) row.classList.add("is-ind");
    return row;
  }

  // one column that starts just left of the face; its rows stream to the right
  const LINES = 52; // face + shoulders
  const col = document.createElement("div");
  col.className = "code__col";
  col.append(...Array.from({ length: LINES }, makeLine));
  code.replaceChildren(col);

  // font + spray distances follow the portrait height
  const fit = () => {
    const h = stack.clientHeight;
    if (!h) return;
    code.style.setProperty(
      "--fs",
      `${Math.min(13, Math.max(6, h / 56)).toFixed(2)}px`,
    );
    if (bits) bits.style.setProperty("--k", (h / 707).toFixed(3));
  };
  new ResizeObserver(fit).observe(stack);
  fit();

  // THE SPRAY: bits of code break away from the face and spread out to the sides.
  // Start points are sampled from the code mask itself, so they always begin on
  // the code half of the face (biased to its outer edge) and never on the suit.
  if (bits && !reduceMotion) {
    const GLYPHS = [
      "0",
      "1",
      "{",
      "}",
      "<",
      "/>",
      "=>",
      ";",
      "()",
      "[]",
      "01",
      "fn",
      "&&",
      "const",
      "0x",
    ];
    const small = window.matchMedia("(max-width: 900px)");
    const maskSrc = getComputedStyle(document.documentElement)
      .getPropertyValue("--hero-code")
      .trim()
      .replace(/^url\(["']?/, "")
      .replace(/["']?\)$/, "");

    const spawn = (cells) => {
      // spread the starting points evenly from the forehead to the shoulders:
      // pick a horizontal band first, then a point in it (favouring its outer edge)
      const BANDS = 28;
      const bands = Array.from({ length: BANDS }, () => []);
      for (const c of cells)
        bands[Math.min(BANDS - 1, Math.floor(c[1] * BANDS))].push(c);
      const filled = bands.filter((b) => b.length);
      const at = () => {
        const band = pick(filled);
        const a = pick(band);
        const b = pick(band);
        return a[0] > b[0] ? a : b;
      };
      const common = (el, x, y, dist, o, t) => {
        // fan out: the further it travels, the more it spreads up or down
        const dx = dist * rand(0.85, 1.15);
        const dy = rand(-1, 1) * dist * 0.42;
        el.style.cssText = [
          `--x:${(x * 100).toFixed(2)}%`,
          `--y:${(y * 100).toFixed(2)}%`,
          `--dx:${dx.toFixed(0)}`,
          `--dy:${dy.toFixed(0)}`,
          `--o:${o.toFixed(2)}`,
          `--t:${t.toFixed(1)}s`,
          `--d:-${rand(0, t).toFixed(1)}s`,
        ].join(";");
      };
      const n = small.matches ? 1 : 2;
      const nodes = [];
      for (let i = 0; i < 46 * n; i++) {
        const [x, y] = at();
        const el = document.createElement("i");
        el.textContent = pick(GLYPHS);
        common(el, x, y, rand(50, 300), rand(0.5, 0.95), rand(3, 6.5));
        el.style.setProperty("--s", rand(8, 14).toFixed(0));
        el.style.setProperty("--sc", rand(0.9, 1.5).toFixed(2));
        nodes.push(el);
      }
      for (let i = 0; i < 18 * n; i++) {
        const [x, y] = at();
        const el = document.createElement("b");
        common(el, x, y, rand(90, 320), rand(0.35, 0.8), rand(2.4, 5));
        el.style.setProperty("--w", rand(26, 110).toFixed(0));
        nodes.push(el);
      }
      bits.replaceChildren(...nodes);
    };

    const img = new Image();
    img.onload = () => {
      const w = Math.round(img.naturalWidth / 5);
      const h = Math.round(img.naturalHeight / 5);
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      const ctx = cv.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);
      const px = ctx.getImageData(0, 0, w, h).data;
      const cells = [];
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
          if (px[(y * w + x) * 4 + 3] > 24)
            cells.push([(x + 0.5) / w, (y + 0.5) / h]);
      if (cells.length) {
        spawn(cells);
        small.addEventListener("change", () => spawn(cells));
      }
    };
    img.src = maskSrc;
  }

  // stop the animations while the hero is off-screen
  if (hasObserver) {
    new IntersectionObserver(([e]) =>
      stack.classList.toggle("is-paused", !e.isIntersecting),
    ).observe(hero);
  }
})();

/* ==========================================================================
   HEADER: LIGHT THEME OVER LIGHT SECTIONS
   Any section with data-theme="light" flips the header to dark-on-light.
   ========================================================================== */
(() => {
  const lightSections = document.querySelectorAll('[data-theme="light"]');
  if (!hasObserver || !lightSections.length) return;

  const underHeader = new Set();
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) underHeader.add(entry.target);
        else underHeader.delete(entry.target);
      });
      header.classList.toggle("is-light", underHeader.size > 0);
    },
    { rootMargin: "0px 0px -92% 0px" }, // only the top strip, where the header sits
  );
  lightSections.forEach((section) => io.observe(section));
})();

/* ==========================================================================
   HEADER: HIDE ON SCROLL DOWN, SHOW ON SCROLL UP
   ========================================================================== */
(() => {
  const THRESHOLD = 6; // px of travel before it reacts
  const TOP_ZONE = 80; // always visible near the top
  let lastY = window.scrollY;
  let ticking = false;

  function update() {
    ticking = false;
    const y = Math.max(0, window.scrollY); // ignore iOS rubber-band overscroll

    if (y < TOP_ZONE || header.classList.contains("menu-open")) {
      header.classList.remove("is-hidden");
      lastY = y;
      return;
    }

    const delta = y - lastY;
    if (Math.abs(delta) < THRESHOLD) return;

    header.classList.toggle("is-hidden", delta > 0);
    lastY = y;
  }

  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    },
    { passive: true },
  );
})();

/* ==========================================================================
   ACTIVE NAV LINK ON SCROLL
   ========================================================================== */
(() => {
  const links = document.querySelectorAll(".nav__link");
  const sections = Array.from(links)
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);
  if (!hasObserver || !sections.length) return;

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((link) => {
          link.classList.toggle(
            "is-active",
            link.getAttribute("href") === `#${entry.target.id}`,
          );
        });
      });
    },
    { rootMargin: "-45% 0px -45% 0px" },
  );
  sections.forEach((section) => io.observe(section));
})();

/* ==========================================================================
   PROJECTS
   To add a project: copy one object below and put its screenshot in images/.
   Navigation: click a card, use the arrows (desktop), scroll/swipe the pill
   list, or swipe left/right on the screenshot or description (mobile).
   ========================================================================== */
(() => {
  const projects = [
    {
      title: "HRIS System",
      kind: "Internship project",
      description:
        "Human Resource Information System that centralizes employee management, attendance, payroll, recruitment, performance, and compliance reports. Payroll is computed automatically from attendance, with configurable tax and government contributions.",
      tags: ["ERP module", "Payroll", "Attendance"],
      image: "images/project1.png",
    },
    {
      title: "Acube Technologies",
      kind: "Company website",
      description:
        "Corporate website for Acube Technologies Inc., a Philippine company offering IoT, AI, and robotics training, industrial automation, and custom software. Covers services, a project showcase album, company background, partner network, and a contact form.",
      tags: ["Company website", "Responsive", "Contact form"],
      image: "images/project2.png",
    },
    {
      title: "Filipino Inventors Society",
      kind: "Organization website",
      description:
        "Website for the Filipino Inventors Society, the country's oldest organization of patent-holding inventors, founded in 1943. Features a leadership section with video, the society's history, a photo gallery, announcements and events, and a membership sign-up.",
      tags: ["Organization site", "Events", "Gallery"],
      image: "images/project3.png",
    },
    {
      title: "SCSE 2027",
      kind: "Event landing page",
      description:
        "Landing page for AETECH Innovations Singapore at the Smart City Summit & Expo 2027 in Taipei. Includes a live countdown to opening day, event highlights, the programme, a photo gallery, and visit details with registration links.",
      tags: ["Landing page", "Countdown", "Gallery"],
      image: "images/project4.png",
    },
  ];

  const section = document.getElementById("projects");
  if (!section) return;

  const projNav = document.getElementById("projectsNav");
  const list = document.getElementById("projectsList");
  const info = document.getElementById("projectsInfo");
  const count = document.getElementById("projectsCount");
  const kindEl = document.getElementById("projKind");
  const titleEl = document.getElementById("projTitle");
  const descEl = document.getElementById("projDesc");
  const tagsEl = document.getElementById("projTags");
  const img = section.querySelector(".frame__img");
  const screen = document.getElementById("projScreen");
  const urlEl = document.getElementById("projUrl");
  const frame = section.querySelector(".projects__frame");
  const mobile = window.matchMedia("(max-width: 900px)");
  const pad = (n) => String(n).padStart(2, "0");

  let active = -1;
  let lockUntil = 0; // ignore scroll events while a click-scroll is animating
  let ticking = false;
  let swapToken = 0;

  // ---- build the list ----
  const items = projects.map((p, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "project-item";
    btn.innerHTML = `
      <span class="project-item__num">${pad(i + 1)}</span>
      <span class="project-item__title"></span>
      <span class="project-item__sub"></span>`;
    btn.querySelector(".project-item__title").textContent = p.title;
    btn.querySelector(".project-item__sub").textContent = p.kind;
    btn.addEventListener("click", () => select(i, true));
    list.appendChild(btn);
    return btn;
  });

  // ---- mobile: vertical screenshot stack (next project peeks from below) ----
  const PEEK = 88;
  const stack = document.createElement("div");
  stack.className = "projects__stack";
  stack.setAttribute("aria-label", "Project screenshots: swipe up or down");

  const slides = projects.map((p, i) => {
    const slide = document.createElement("figure");
    slide.className = "stack__slide";
    slide.innerHTML = `
      <div class="frame__bar" aria-hidden="true">
        <span></span><span></span><span></span><em class="frame__url"></em>
      </div>
      <div class="frame__screen is-empty"><img class="frame__img" alt="" /></div>`;
    slide.querySelector(".frame__url").textContent = p.title;

    const shot = slide.querySelector(".frame__img");
    const shotScreen = slide.querySelector(".frame__screen");
    shot.addEventListener("load", () => {
      shot.classList.add("is-on");
      shotScreen.classList.remove("is-empty");
      if (i === 0) {
        // every slide uses the first screenshot's ratio, so they all match
        stack.style.setProperty(
          "--slide-ar",
          `${shot.naturalWidth} / ${shot.naturalHeight}`,
        );
        sizeStack();
      }
    });
    shot.alt = `${p.title} screenshot`;
    shot.src = p.image;

    stack.appendChild(slide);
    return slide;
  });
  frame.before(stack);

  // container height = one slide + the peek of the next
  function sizeStack() {
    stack.style.height = mobile.matches
      ? `${slides[0].offsetHeight + PEEK}px`
      : "";
  }
  new ResizeObserver(() => {
    if (!mobile.matches) return;
    sizeStack();
    stackFx();
    centerItem(active, false);
  }).observe(slides[0]);
  const stackStep = () =>
    slides.length > 1 ? slides[1].offsetTop - slides[0].offsetTop : 1;
  let stackLock = 0; // ignore scroll events while we scroll it ourselves

  function stackTo(i, smooth) {
    stackLock = performance.now() + (smooth ? 800 : 100);
    stack.scrollTo({
      top: i * stackStep(),
      behavior: smooth ? "smooth" : "auto",
    });
  }

  let stackTick = false;
  stack.addEventListener(
    "scroll",
    () => {
      if (stackTick || performance.now() < stackLock) return;
      stackTick = true;
      requestAnimationFrame(() => {
        stackTick = false;
        const i = Math.max(
          0,
          Math.min(
            projects.length - 1,
            Math.round(stack.scrollTop / stackStep()),
          ),
        );
        if (i === active) return;
        select(i, false, "stack");
        lockUntil = performance.now() + 700; // keep the pill list from fighting back
        centerItem(i, true);
      });
    },
    { passive: true },
  );

  // the neighbouring screenshots are zoomed out and dim, and grow as they near the top
  const FX_SCALE = 0.8; // size of the neighbouring screenshots (1 = full size)
  const FX_OPACITY = 0.55;
  let fxTick = false;

  function stackFx() {
    fxTick = false;
    if (!mobile.matches) {
      slides.forEach((s) => {
        s.style.transform = "";
        s.style.opacity = "";
      });
      return;
    }
    const step = stackStep();
    slides.forEach((s, i) => {
      const d = i - stack.scrollTop / step; // 0 = current, 1 = next, -1 = previous
      const t = Math.min(Math.abs(d), 1);
      s.style.transformOrigin = d > 0 ? "50% 0" : "50% 100%";
      s.style.transform = `scale(${(1 - (1 - FX_SCALE) * t).toFixed(3)})`;
      s.style.opacity = (1 - (1 - FX_OPACITY) * t).toFixed(3);
    });
  }
  stack.addEventListener(
    "scroll",
    () => {
      if (fxTick) return;
      fxTick = true;
      requestAnimationFrame(stackFx);
    },
    { passive: true },
  );
  mobile.addEventListener("change", stackFx);
  stackFx();

  // ---- description ----
  function setInfo(p) {
    kindEl.textContent = p.kind;
    titleEl.textContent = p.title;
    descEl.textContent = p.description;
    tagsEl.replaceChildren(
      ...p.tags.map((t) => {
        const li = document.createElement("li");
        li.textContent = t;
        return li;
      }),
    );
  }

  // writes the project into the frame (image, ratio, url bar) and the info panel
  function applyProject(p, loaded, probe) {
    urlEl.textContent = p.title;
    setInfo(p);

    if (loaded) {
      screen.style.setProperty(
        "--ar",
        `${probe.naturalWidth} / ${probe.naturalHeight}`,
      );
      img.src = p.image;
      img.alt = `${p.title} screenshot`;
      img.classList.add("is-on");
      screen.classList.remove("is-empty");
    } else {
      img.classList.remove("is-on");
      screen.style.removeProperty("--ar");
      screen.classList.add("is-empty");
    }
  }

  // whole frame + info slide out, content swaps while hidden, both slide back in
  function swapProject(i, dir, animate) {
    const t = ++swapToken;
    const p = projects[i];
    section.style.setProperty("--dir", dir);

    const probe = new Image();
    const loaded = new Promise((res) => {
      probe.onload = () => res(true);
      probe.onerror = () => res(false);
    });
    probe.src = p.image;

    if (!animate) {
      loaded.then((ok) => t === swapToken && applyProject(p, ok, probe));
      return;
    }

    const els = [frame, info];
    els.forEach((el) => el.classList.add("is-out"));
    const wait = new Promise((r) => setTimeout(r, 220));

    Promise.all([loaded, wait]).then(([ok]) => {
      if (t !== swapToken) return; // a newer click took over
      applyProject(p, ok, probe);
      els.forEach((el) => {
        el.classList.remove("is-out");
        el.classList.add("is-in");
      });
      void frame.offsetWidth; // commit the start state
      els.forEach((el) => el.classList.remove("is-in")); // release, animates to rest
    });
  }

  function centerItem(i, smooth) {
    if (mobile.matches) {
      // vertical roller: slide the pills so pill i sits in the middle
      const h = items[0].offsetHeight;
      const step =
        items.length > 1 ? items[1].offsetTop - items[0].offsetTop : h;
      list.style.setProperty(
        "--shift",
        `${list.clientHeight / 2 - h / 2 - i * step}px`,
      );
      return;
    }
    list.scrollTo({
      top: items[i].offsetTop - (list.clientHeight - items[i].offsetHeight) / 2,
      behavior: smooth ? "smooth" : "auto",
    });
  }

  function select(i, scrollToIt, from) {
    i = Math.max(0, Math.min(projects.length - 1, i));
    if (i === active) return;
    const first = active === -1;
    const dir = first || i > active ? 1 : -1;
    active = i;

    items.forEach((el, idx) => {
      const d = Math.abs(idx - i);
      el.dataset.dist = Math.min(d, 2);
      el.classList.toggle("is-active", d === 0);
      el.setAttribute("aria-current", d === 0 ? "true" : "false");
    });
    count.textContent = `${pad(i + 1)} / ${pad(projects.length)}`;

    swapProject(i, dir, !first);

    if (scrollToIt) {
      lockUntil = performance.now() + 700;
      centerItem(i, true);
    }
    if (mobile.matches && from !== "stack") stackTo(i, !first);
  }

  // ---- scrolling / swiping the list picks the item nearest the centre ----
  list.addEventListener(
    "scroll",
    () => {
      if (mobile.matches || ticking || performance.now() < lockUntil) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const mid = list.scrollTop + list.clientHeight / 2;
        let best = 0;
        let bestDist = Infinity;
        items.forEach((el, idx) => {
          const d = Math.abs(el.offsetTop + el.offsetHeight / 2 - mid);
          if (d < bestDist) {
            bestDist = d;
            best = idx;
          }
        });
        select(best, false);
      });
    },
    { passive: true },
  );

  // ---- swipe left / right on the screenshot or the description ----
  // Next project on swipe left, previous on swipe right. Mostly-vertical
  // drags are ignored so the page still scrolls normally.
  const SWIPE_MIN = 45; // px of horizontal travel
  const SWIPE_RATIO = 1.3; // horizontal must beat vertical by this factor
  let touch = null;

  function onTouchStart(e) {
    if (e.touches.length !== 1) {
      touch = null;
      return;
    }
    touch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  function onTouchEnd(e) {
    if (!touch) return;
    const dx = e.changedTouches[0].clientX - touch.x;
    const dy = e.changedTouches[0].clientY - touch.y;
    touch = null;
    if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy) * SWIPE_RATIO)
      return;
    select(active + (dx < 0 ? 1 : -1), true);
  }
  [frame, info].forEach((el) => {
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", () => (touch = null), { passive: true });
  });

  // ---- arrows + keyboard ----
  document
    .getElementById("projPrev")
    .addEventListener("click", () => select(active - 1, true));
  document
    .getElementById("projNext")
    .addEventListener("click", () => select(active + 1, true));
  projNav.addEventListener("keydown", (e) => {
    const prev = ["ArrowUp", "ArrowLeft"].includes(e.key);
    const next = ["ArrowDown", "ArrowRight"].includes(e.key);
    if (!prev && !next) return;
    e.preventDefault();
    select(active + (next ? 1 : -1), true);
    items[active].focus({ preventScroll: true });
  });

  mobile.addEventListener("change", () => {
    centerItem(active, false);
    sizeStack();
    if (mobile.matches) stackTo(active, false);
  });
  // ---- entrance animation (.is-entered, not .is-in: the frame swap uses that) ----
  if (hasObserver && !reduceMotion) {
    section.classList.add("is-armed");
    new IntersectionObserver(
      ([entry], io) => {
        if (!entry.isIntersecting) return;
        section.classList.add("is-entered");
        io.disconnect();
      },
      { threshold: 0.25 },
    ).observe(section);
  }

  // ---- init ----
  select(0, false);
  requestAnimationFrame(() => centerItem(0, false));
  window.addEventListener("load", () => {
    projects.forEach((p) => {
      new Image().src = p.image; // warm the cache
    });
  });
  window.addEventListener("load", () => centerItem(active, false));
})();

/* ==========================================================================
   SCROLL REVEAL (skills + contact)
   Items are only hidden once JS has armed the section, so nothing stays
   invisible if scripts fail.
   ========================================================================== */
function armReveal(sectionId, stagger) {
  const section = document.getElementById(sectionId);
  if (!section || !hasObserver || reduceMotion) return;

  const items = section.querySelectorAll(".reveal");
  items.forEach((el, i) => el.style.setProperty("--d", `${stagger(i)}ms`));
  section.classList.add("is-armed");

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.15 },
  );
  items.forEach((el) => io.observe(el));
}
armReveal("skills", (i) => (i % 6) * 70);
armReveal("contact", (i) => i * 80);

/* ==========================================================================
   ABOUT: STAGGERED ENTRANCE
   ========================================================================== */
(() => {
  const section = document.getElementById("about");
  if (!section || !hasObserver || reduceMotion) return;

  section
    .querySelectorAll(".rise")
    .forEach((el, i) => el.style.setProperty("--d", `${i * 80}ms`));
  // right side runs on its own timeline: arch, then portrait, then badge, then chips
  const setDelay = (sel, ms) =>
    section.querySelector(sel)?.style.setProperty("--d", `${ms}ms`);
  setDelay(".about__arch", 100);
  setDelay(".about__photo", 400);
  setDelay(".about__badge", 800);
  setDelay(".about__chip--1", 950);
  setDelay(".about__chip--2", 1100);
  section.classList.add("is-armed");

  new IntersectionObserver(
    ([entry], io) => {
      if (!entry.isIntersecting) return;
      section.classList.add("is-in");
      io.disconnect();
    },
    // low threshold: the stacked mobile layout is much taller than the screen
    { threshold: 0.08 },
  ).observe(section);
})();

/* ==========================================================================
   INTRO: PLAY ON EVERY PAGE LOAD
   ========================================================================== */
(() => {
  const root = document.documentElement;
  if (!root.classList.contains("intro")) return;

  setTimeout(() => root.classList.remove("intro"), 3200);
})();

/* ==========================================================================
   HERO MOTION
   Name letters, tagline words, mouse depth. The slow code start is
   pure CSS (see "hero motion, built around the portrait" in style.css).
   ========================================================================== */
(() => {
  const root = document.documentElement;
  const title = document.querySelector(".hero__title");
  const text = document.querySelector(".hero__text");
  const stack = document.getElementById("photoStack");
  const playing = root.classList.contains("intro") && !reduceMotion;

  // ---- tagline: wrap words so each one can blur in on its own ----
  if (playing && text) {
    const words = text.textContent.trim().split(/\s+/);
    text.replaceChildren(
      ...words.flatMap((word, i) => {
        const w = document.createElement("span");
        w.className = "w";
        w.style.setProperty("--i", i);
        w.textContent = word;
        return i < words.length - 1 ? [w, document.createTextNode(" ")] : [w];
      }),
    );
  }

  // ---- name: letters rise and sharpen one by one, from the middle outward ----
  if (playing && title) {
    const spans = [...title.querySelectorAll("span")];
    title.setAttribute("aria-label", spans.map((s) => s.textContent).join(" "));
    const letters = [];
    spans.forEach((span) => {
      span.setAttribute("aria-hidden", "true");
      span.replaceChildren(
        ...[...span.textContent].map((ch) => {
          const el = document.createElement("i");
          el.textContent = ch;
          letters.push(el);
          return el;
        }),
      );
    });
    const mid = (letters.length - 1) / 2;
    letters.forEach((el, i) =>
      el.style.setProperty("--d", Math.abs(i - mid).toFixed(1)),
    );
    title.classList.add("is-split");
  }

  // ---- depth: title, portrait and code shift against each other with the mouse ----
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
  if (!reduceMotion && fine.matches && hero && title && stack) {
    let tx = 0,
      ty = 0,
      cx = 0,
      cy = 0,
      raf = 0;
    const set = () => {
      for (const el of [title, stack]) {
        el.style.setProperty("--px", cx.toFixed(3));
        el.style.setProperty("--py", cy.toFixed(3));
      }
    };
    const step = () => {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      set();
      raf =
        Math.abs(tx - cx) > 0.002 || Math.abs(ty - cy) > 0.002
          ? requestAnimationFrame(step)
          : 0;
    };
    const go = () => {
      if (!raf) raf = requestAnimationFrame(step);
    };
    hero.addEventListener(
      "pointermove",
      (e) => {
        const r = hero.getBoundingClientRect();
        tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
        ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
        go();
      },
      { passive: true },
    );
    hero.addEventListener("pointerleave", () => {
      tx = ty = 0;
      go();
    });
  }
})();

/* SILK: stop the SVG sheen for reduced motion and while the hero is off-screen */
(() => {
  const svgs = document.querySelectorAll(".silk__layer");
  if (!svgs.length) return;
  if (reduceMotion) {
    svgs.forEach((s) => s.pauseAnimations && s.pauseAnimations());
    return;
  }
  if (hasObserver) {
    new IntersectionObserver(([e]) =>
      svgs.forEach((s) =>
        e.isIntersecting ? s.unpauseAnimations() : s.pauseAnimations(),
      ),
    ).observe(hero);
  }
})();
