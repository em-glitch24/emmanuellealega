// ============ MOBILE MENU ============
const menuToggle = document.getElementById("menuToggle");
const nav = document.getElementById("nav");
const header = document.querySelector(".header");

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

// ============ BADGES MARQUEE (duplicate for seamless loop) ============
const track = document.getElementById("badgesTrack");
if (track) {
  const items = Array.from(track.children);
  items.forEach((item) => {
    const clone = item.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    track.appendChild(clone);
  });
}

// ============ SPOTLIGHT MOUSE PARALLAX ============
const hero = document.getElementById("home");
const glow = hero && hero.querySelector(".hero__live");
const canHover = window.matchMedia("(hover: hover)").matches;
const reduceMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

if (glow && canHover && !reduceMotion) {
  hero.addEventListener("mousemove", (e) => {
    const rect = hero.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 to 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    glow.style.setProperty("--mx", `${x * 120}px`);
    glow.style.setProperty("--my", `${y * 80}px`);
  });
  hero.addEventListener("mouseleave", () => {
    glow.style.setProperty("--mx", "0px");
    glow.style.setProperty("--my", "0px");
  });
}

// ============ BACKGROUND: VIDEO WITH LIVE-BACKGROUND FALLBACK ============
// The live CSS background is the default. It is only replaced once the video
// file has really loaded, so a missing or broken video never leaves a blank hero.
function initStreaks(canvas) {
  if (!canvas) return { start() {}, stop() {} };

  const ctx = canvas.getContext("2d");
  const rand = (min, max) => min + Math.random() * (max - min);
  let w = 0;
  let h = 0;
  let cols = 8;
  let rafId = null;
  let streaks = [];

  function spawn(s, initial) {
    s.col = 1 + Math.floor(Math.random() * (cols - 1)); // skip the left edge line
    s.len = rand(90, 240);
    s.speed = rand(1.1, 2.8);
    s.alpha = rand(0.35, 0.8);
    s.accent = Math.random() < 0.2; // some streaks use the blue accent
    s.y = initial ? rand(-h, h) : -s.len - rand(0, h * 0.8);
    return s;
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // read the column count from CSS so the streaks sit exactly on the grid lines
    cols =
      parseInt(
        getComputedStyle(canvas.parentElement).getPropertyValue("--cols"),
        10,
      ) || 8;
    streaks = Array.from({ length: Math.round(cols * 1.3) }, () =>
      spawn({}, true),
    );
  }

  function frame() {
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 1.2;
    for (const s of streaks) {
      s.y += s.speed;
      if (s.y - s.len > h) spawn(s, false);

      const x = Math.round((s.col * w) / cols) + 0.5;
      const rgb = s.accent ? "110, 118, 255" : "235, 238, 245";
      const grad = ctx.createLinearGradient(0, s.y - s.len, 0, s.y);
      grad.addColorStop(0, `rgba(${rgb}, 0)`);
      grad.addColorStop(1, `rgba(${rgb}, ${s.alpha})`);
      ctx.strokeStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x, s.y - s.len);
      ctx.lineTo(x, s.y);
      ctx.stroke();
    }
    rafId = requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  resize();

  return {
    start() {
      if (!rafId) rafId = requestAnimationFrame(frame);
    },
    stop() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
  };
}

const heroVideo = document.getElementById("heroVideo");
const streaks = initStreaks(document.getElementById("liveStreaks"));
let heroVisible = true;
let videoReady = false;

function syncBackground() {
  hero.classList.toggle("has-video", videoReady);

  if (heroVideo) {
    if (videoReady && heroVisible) heroVideo.play().catch(() => {});
    else heroVideo.pause();
  }

  // streaks only run while the live background is what the visitor sees
  if (!videoReady && heroVisible && !reduceMotion) streaks.start();
  else streaks.stop();
}

if (heroVideo && !reduceMotion) {
  const markReady = () => {
    videoReady = true;
    syncBackground();
  };
  const markFailed = () => {
    videoReady = false;
    syncBackground();
  };

  if (heroVideo.readyState >= 2) markReady();
  heroVideo.addEventListener("loadeddata", markReady);
  heroVideo.addEventListener("error", markFailed, true); // capture: <source> errors don't bubble
  heroVideo.addEventListener("stalled", () => {
    if (heroVideo.readyState < 2) markFailed();
  });
}

if ("IntersectionObserver" in window) {
  new IntersectionObserver(([entry]) => {
    heroVisible = entry.isIntersecting;
    syncBackground();
  }).observe(hero);
}
document.addEventListener("visibilitychange", () => {
  heroVisible = !document.hidden;
  syncBackground();
});

syncBackground();

// ============ HEADER THEME OVER LIGHT SECTIONS ============
// Any section with data-theme="light" flips the header to dark-on-light while it sits under it.
const lightSections = document.querySelectorAll('[data-theme="light"]');
if ("IntersectionObserver" in window && lightSections.length) {
  const underHeader = new Set();
  const lightObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) underHeader.add(entry.target);
        else underHeader.delete(entry.target);
      });
      header.classList.toggle("is-light", underHeader.size > 0);
    },
    { rootMargin: "0px 0px -92% 0px" }, // only the top strip of the screen, where the header sits
  );
  lightSections.forEach((section) => lightObserver.observe(section));
}

// ============ ACTIVE NAV LINK ON SCROLL ============
const links = document.querySelectorAll(".nav__link");
const sections = Array.from(links)
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean); // sections you haven't built yet are skipped

if ("IntersectionObserver" in window && sections.length) {
  const observer = new IntersectionObserver(
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
  sections.forEach((section) => observer.observe(section));
}

// ============ PROJECTS SECTION ============
// To add a project: copy one object below. Put its screenshot in assets/projects/ (16:10 works best, e.g. 1600x1000).
(() => {
  const projects = [
    {
      title: "HRIS System",
      kind: "Internship project",
      description:
        "Human Resource Information System that centralizes employee management, attendance, payroll, recruitment, performance, and compliance reports. Payroll is computed automatically from attendance, with configurable tax and government contributions.",
      tags: ["ERP module", "Payroll", "Attendance"],
      image: "../images/project1.png",
    },
    {
      title: "Acube Technologies",
      kind: "Company website",
      description:
        "Corporate website for Acube Technologies Inc., a Philippine company offering IoT, AI, and robotics training, industrial automation, and custom software. Covers services, a project showcase album, company background, partner network, and a contact form.",
      tags: ["Company website", "Responsive", "Contact form"],
      image: "../images/project2.png",
    },
    {
      title: "Filipino Inventors Society",
      kind: "Organization website",
      description:
        "Website for the Filipino Inventors Society, the country's oldest organization of patent-holding inventors, founded in 1943. Features a leadership section with video, the society's history, a photo gallery, announcements and events, and a membership sign-up.",
      tags: ["Organization site", "Events", "Gallery"],
      image: "../images/project3.png",
    },
    {
      title: "SCSE 2027",
      kind: "Event landing page",
      description:
        "Landing page for AETECH Innovations Singapore at the Smart City Summit & Expo 2027 in Taipei. Includes a live countdown to opening day, event highlights, the programme, a photo gallery, and visit details with registration links.",
      tags: ["Landing page", "Countdown", "Gallery"],
      image: "../images/project4.png",
    },
  ];

  const section = document.getElementById("projects");
  if (!section) return;

  const nav = document.getElementById("projectsNav");
  const list = document.getElementById("projectsList");
  const info = document.getElementById("projectsInfo");
  const count = document.getElementById("projectsCount");
  const kindEl = document.getElementById("projKind");
  const titleEl = document.getElementById("projTitle");
  const descEl = document.getElementById("projDesc");
  const tagsEl = document.getElementById("projTags");
  const imgs = section.querySelectorAll(".frame__img");
  const screen = document.getElementById("projScreen");
  const urlEl = document.getElementById("projUrl");
  const mobile = window.matchMedia("(max-width: 900px)");
  const pad = (n) => String(n).padStart(2, "0");

  let active = -1;
  let lockUntil = 0; // ignore scroll events while a click-scroll is animating
  let ticking = false;

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

  // ---- screenshot in the frame (crossfades between two images; shows a placeholder if the file is missing) ----

  const frame = section.querySelector(".projects__frame");
  let swapToken = 0;

  // writes the project into the frame (image, ratio, url bar) and the info panel
  function applyProject(p, loaded, probe) {
    urlEl.textContent = p.title;
    setInfo(p);

    const img = imgs[0];
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

  // ---- description ----
  function setInfo(p) {
    kindEl.textContent = p.kind;
    titleEl.textContent = p.title;
    descEl.textContent = p.description;
    tagsEl.innerHTML = "";
    p.tags.forEach((t) => {
      const li = document.createElement("li");
      li.textContent = t;
      tagsEl.appendChild(li);
    });
  }

  function centerItem(i, smooth) {
    const el = items[i];
    const behavior = smooth ? "smooth" : "auto";
    if (mobile.matches) {
      list.scrollTo({
        left: el.offsetLeft - (list.clientWidth - el.offsetWidth) / 2,
        behavior,
      });
    } else {
      list.scrollTo({
        top: el.offsetTop - (list.clientHeight - el.offsetHeight) / 2,
        behavior,
      });
    }
  }

  function select(i, scrollToIt) {
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
  }

  // ---- scrolling the list picks the item nearest the centre ----
  list.addEventListener(
    "scroll",
    () => {
      if (ticking || performance.now() < lockUntil) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const horizontal = mobile.matches;
        const mid = horizontal
          ? list.scrollLeft + list.clientWidth / 2
          : list.scrollTop + list.clientHeight / 2;
        let best = 0;
        let bestDist = Infinity;
        items.forEach((el, idx) => {
          const c = horizontal
            ? el.offsetLeft + el.offsetWidth / 2
            : el.offsetTop + el.offsetHeight / 2;
          const d = Math.abs(c - mid);
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

  // ---- arrows + keyboard ----
  document
    .getElementById("projPrev")
    .addEventListener("click", () => select(active - 1, true));
  document
    .getElementById("projNext")
    .addEventListener("click", () => select(active + 1, true));
  nav.addEventListener("keydown", (e) => {
    const prev = ["ArrowUp", "ArrowLeft"].includes(e.key);
    const next = ["ArrowDown", "ArrowRight"].includes(e.key);
    if (!prev && !next) return;
    e.preventDefault();
    select(active + (next ? 1 : -1), true);
    items[active].focus({ preventScroll: true });
  });

  mobile.addEventListener("change", () => centerItem(active, false));

  // ---- init ----
  select(0, false);
  requestAnimationFrame(() => centerItem(0, false));
  window.addEventListener("load", () => {
    projects.forEach((p) => {
      const img = new Image();
      img.src = p.image;
    }); // warm the cache
  });
})();

// ============ SKILLS: SCROLL REVEAL ============
(() => {
  const section = document.getElementById("skills");
  if (!section) return;
  const items = section.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window) || reduceMotion) return;

  section.classList.add("is-armed"); // hides items only now that JS can reveal them
  items.forEach((el, i) => el.style.setProperty("--d", `${(i % 6) * 70}ms`));

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
})();

// ============ HEADER: HIDE ON SCROLL DOWN, SHOW ON SCROLL UP ============
(() => {
  const THRESHOLD = 6; // px of travel before it reacts, so tiny scrolls don't flicker
  const TOP_ZONE = 80; // always visible near the top of the page
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
    if (Math.abs(delta) < THRESHOLD) return; // wait until enough distance has built up

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

// ============ ABOUT: HEADER BAR + ENTRANCE ============
(() => {
  const section = document.getElementById("about");
  if (!section || !("IntersectionObserver" in window)) return;

  // dark bar behind the header while it sits over this split section
  new IntersectionObserver(
    ([entry]) => header.classList.toggle("is-split", entry.isIntersecting),
    { rootMargin: "0px 0px -92% 0px" },
  ).observe(section);

  if (reduceMotion) return;

  // staggered entrance (armed only now, so nothing is hidden without JS)
  section
    .querySelectorAll(".rise")
    .forEach((el, i) => el.style.setProperty("--d", `${i * 80}ms`));
  section.classList.add("is-armed");

  new IntersectionObserver(
    ([entry], io) => {
      if (!entry.isIntersecting) return;
      section.classList.add("is-in");
      io.disconnect();
    },
    { threshold: 0.15 },
  ).observe(section);
})();

// ============ CONTACT: SCROLL REVEAL ============
(() => {
  const section = document.getElementById("contact");
  if (!section || !("IntersectionObserver" in window) || reduceMotion) return;

  const items = section.querySelectorAll(".reveal");
  items.forEach((el, i) => el.style.setProperty("--d", `${i * 80}ms`));
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
})();
