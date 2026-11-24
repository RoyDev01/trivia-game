(function () {
  "use strict";

  const DATA = window.TRIVIA;
  const ROUND = DATA.roundSize || 10;
  const app = document.getElementById("app");
  const WIKI = "https://en.wikipedia.org/w/api.php";
  const FILE_PAGE = "https://en.wikipedia.org/wiki/File:";
  const KEYS = ["א", "ב", "ג", "ד"];
  const PLAY_SIZE = 960;
  const GALLERY_SIZE = 330;
  const IMG_TIMEOUT = 15000;

  const thumbs = new Map();  // "size|title" -> { src, file } | null
  const photos = new Map();  // "topic/id" -> Promise<url | null>
  let state = null;
  let stamp = 0;             // bumps on every screen change, so late network answers are ignored

  const ICONS = {
    actors: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="9" width="36" height="30" rx="3" fill="none" stroke="currentColor" stroke-width="3"/><path d="M15 9v30M33 9v30M6 17h9M6 24h9M6 31h9M33 17h9M33 24h9M33 31h9" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
    flowers: '<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="currentColor"><ellipse cx="24" cy="11" rx="6.5" ry="9"/><ellipse cx="24" cy="11" rx="6.5" ry="9" transform="rotate(60 24 24)"/><ellipse cx="24" cy="11" rx="6.5" ry="9" transform="rotate(120 24 24)"/><ellipse cx="24" cy="11" rx="6.5" ry="9" transform="rotate(180 24 24)"/><ellipse cx="24" cy="11" rx="6.5" ry="9" transform="rotate(240 24 24)"/><ellipse cx="24" cy="11" rx="6.5" ry="9" transform="rotate(300 24 24)"/></g><circle cx="24" cy="24" r="6" fill="#F1EFE8"/></svg>',
    pm: '<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="currentColor"><circle cx="24" cy="12" r="7"/><path d="M9 25h30l-3 8H12z"/><path d="M17 33h14v10H17z"/></g></svg>',
    capitals: '<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="currentColor"><path d="M24 5 5 17h38z"/><path d="M10 21h6v15h-6zM21 21h6v15h-6zM32 21h6v15h-6z"/><path d="M5 38h38v5H5z"/></g></svg>',
    ww2: '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="currentColor" d="M24 3c2.2 0 3.5 3 3.5 6.5V18L45 27.5V33l-17.5-4.5V37l5.5 4.2V44L24 41.8 15 44v-2.800L20.500 37v-8.500L3 33v-5.500L20.500 18V9.500C20.500 6 21.800 3 24 3z"/></svg>',
    history: '<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="currentColor"><path d="M8 20h32v20a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3z" opacity=".4"/><path d="M8 11a3 3 0 0 1 3-3h26a3 3 0 0 1 3 3v9H8z"/><rect x="13" y="3" width="5" height="11" rx="2.5"/><rect x="30" y="3" width="5" height="11" rx="2.5"/><path d="M14 25h7v6h-7zM27 25h7v6h-7zM14 34h7v6h-7z"/></g></svg>',
    mix: '<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="currentColor"><rect x="7" y="7" width="15" height="15" rx="3"/><rect x="26" y="26" width="15" height="15" rx="3"/><rect x="26" y="7" width="15" height="15" rx="3" opacity=".5"/><rect x="7" y="26" width="15" height="15" rx="3" opacity=".5"/></g></svg>'
  };

  /* ---------- helpers ---------- */

  const topicById = (id) => DATA.topics.find((t) => t.id === id);

  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function readBest() {
    try { return JSON.parse(localStorage.getItem("trivia-best") || "{}") || {}; } catch (e) { return {}; }
  }

  function saveBest(id, score, total) {
    try {
      const best = readBest();
      if (!best[id] || score > best[id].score) {
        best[id] = { score: score, total: total };
        localStorage.setItem("trivia-best", JSON.stringify(best));
      }
    } catch (e) { /* the game works without saved scores */ }
  }

  function loadImage(src, ms) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error("timeout"));
      }, ms || IMG_TIMEOUT);
      img.onload = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(img);
      };
      img.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error("load failed"));
      };
      img.src = src;
    });
  }

  /* Ask Wikipedia for the lead image of each article, in one request per 40 titles. */
  async function fetchThumbs(titles, size) {
    const wanted = Array.from(new Set(titles)).filter((t) => !thumbs.has(size + "|" + t));
    for (let i = 0; i < wanted.length; i += 40) {
      const chunk = wanted.slice(i, i + 40);
      const url = WIKI +
        "?action=query&format=json&formatversion=2&origin=*&redirects=1" +
        "&prop=pageimages&piprop=thumbnail%7Cname&pilimit=50&pithumbsize=" + size +
        "&titles=" + encodeURIComponent(chunk.join("|"));
      const res = await fetch(url);
      if (!res.ok) throw new Error("wikipedia " + res.status);
      const query = (await res.json()).query || {};
      const forward = {};
      (query.normalized || []).forEach((n) => { forward[n.from] = n.to; });
      (query.redirects || []).forEach((r) => { forward[r.from] = r.to; });
      const pages = {};
      (query.pages || []).forEach((p) => { pages[p.title] = p; });
      chunk.forEach((title) => {
        let key = title;
        for (let hop = 0; forward[key] && hop < 5; hop++) key = forward[key];
        const page = pages[key];
        thumbs.set(size + "|" + title, page && page.thumbnail ? { src: page.thumbnail.source, file: page.pageimage } : null);
      });
    }
  }

  /* Items with a `file` use that Wikimedia Commons file, not the article's lead image. */
  function pinFiles(list, size) {
    list.forEach((it) => {
      if (it.title && it.file) {
        thumbs.set(size + "|" + it.title, {
          src: "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(it.file) + "?width=" + size,
          file: it.file
        });
      }
    });
  }

  /* A photo the owner added themselves: images/<topic>/<id>.jpg. Resolves to its URL, or null. */
  function ownPhoto(topicId, itemId) {
    const key = topicId + "/" + itemId;
    if (!photos.has(key)) {
      const url = "images/" + key + ".jpg";
      photos.set(key, loadImage(url, 7000).then(() => url, () => null));
    }
    return photos.get(key);
  }

  function promptFor(t, it) {
    if (it.q) return it.q;
    if (it.title) return t.prompt;
    if (t.id === "pm") return "מי ראש הממשלה?";
    if (it.g === "film") return "איזה סרט זה?";
    return it.g === "f" ? "מי השחקנית?" : "מי השחקן?";
  }

  function clueHtml(t, it) {
    const c = it.clue;
    if (c.big) {
      return '<div class="clue clue--history"><p class="clue-big' + (String(c.big).length > 5 ? " clue-big--long" : "") + '">' + esc(c.big) + "</p>" +
        (c.small ? '<p class="clue-small">' + esc(c.small) + "</p>" : "") + "</div>";
    }
    if (c.fact) {
      return '<div class="clue clue--pm">' + (c.years ? '<p class="clue-years">' + esc(c.years) + "</p>" : "") +
        '<p class="clue-fact' + (c.years ? "" : " clue-fact--solo") + '">' + esc(c.fact) + "</p></div>";
    }
    if (c.plot) {
      return '<div class="clue clue--film">' + (c.year ? '<p class="clue-year">' + esc(c.year) + "</p>" : "") +
        '<p class="clue-plot">' + esc(c.plot) + "</p></div>";
    }
    return '<div class="clue clue--film"><p class="clue-role">' + esc(c.role) + '</p><p class="clue-title" dir="auto">' + esc(c.film) +
      '</p><p class="clue-orig" dir="ltr">' + (c.orig ? esc(c.orig) + ", " : "") + esc(c.year) + "</p></div>";
  }

  /* ---------- screens ---------- */

  function renderHome() {
    stamp++;
    state = null;
    const best = readBest();
    const line = (id, fallback) => best[id] ? "השיא שלך: " + best[id].score + " מתוך " + best[id].total : fallback;
    app.innerHTML =
      '<section class="home">' +
        '<header class="home-head"><h1>מי זה? מה זה?</h1>' +
        "<p>בחרו נושא. בכל סיבוב " + ROUND + " תמונות, ולכל תמונה ארבע תשובות.</p></header>" +
        '<ul class="topics">' +
        DATA.topics.map((t) =>
          '<li><button type="button" class="topic" data-topic="' + t.id + '" style="--tc:' + t.color + '">' +
          '<span class="topic-window">' + ICONS[t.id] + "</span>" +
          '<span class="topic-text"><strong>' + esc(t.name) + "</strong><small>" + line(t.id, ROUND + " שאלות בסיבוב") + "</small></span>" +
          "</button></li>").join("") +
        '<li><button type="button" class="topic topic--mix" data-topic="mix">' +
          '<span class="topic-window">' + ICONS.mix + "</span>" +
          '<span class="topic-text"><strong>מכל הנושאים</strong><small>' + line("mix", "שאלות מעורבות מכל הנושאים") + "</small></span>" +
        "</button></li>" +
        "</ul>" +
        '<p class="home-foot">התמונות נטענות מוויקיפדיה. <a href="#gallery">כל התמונות והמקורות</a></p>' +
      "</section>";
    window.scrollTo(0, 0);
  }

  function renderMessage(title, text, retryTopic) {
    stamp++;
    app.innerHTML =
      '<section class="message"><h2>' + esc(title) + "</h2><p>" + esc(text) + "</p>" +
      (retryTopic ? '<button type="button" class="primary" data-again="' + esc(retryTopic) + '">לנסות שוב</button>' : "") +
      '<button type="button" class="secondary" data-home>לבחירת נושא</button></section>';
  }

  function takeSpare(like) {
    const s = state;
    let i = s.spares.findIndex((q) => q.t.id === like.t.id);
    if (i < 0) i = s.spares.length ? 0 : -1;
    return i < 0 ? null : s.spares.splice(i, 1)[0];
  }

  async function startRound(topicId) {
    const mine = ++stamp;
    let picks = [];
    let spares = [];
    let name, short, color;

    if (topicId === "mix") {
      DATA.topics.forEach((t) => {
        const mixed = shuffle(t.items);
        mixed.slice(0, 2).forEach((it) => picks.push({ t: t, it: it }));
        mixed.slice(2, 4).forEach((it) => spares.push({ t: t, it: it }));
      });
      picks = shuffle(picks);
      spares = picks.slice(ROUND).concat(spares);
      picks = picks.slice(0, ROUND);
      name = short = "מכל הנושאים";
      color = "var(--lamp)";
    } else {
      const t = topicById(topicId);
      if (!t) return renderHome();
      const mixed = shuffle(t.items);
      picks = mixed.slice(0, ROUND).map((it) => ({ t: t, it: it }));
      spares = mixed.slice(ROUND, ROUND + 6).map((it) => ({ t: t, it: it }));
      name = t.name;
      short = t.short;
      color = t.color;
    }

    state = { topicId: topicId, name: name, short: short, color: color, queue: picks, spares: spares, idx: 0, score: 0, log: [] };

    const titles = picks.concat(spares).filter((q) => q.it.title).map((q) => q.it.title);
    if (titles.length) {
      app.innerHTML = '<section class="message message--wait"><p>טוען תמונות</p></section>';
      pinFiles(picks.concat(spares).map((q) => q.it), PLAY_SIZE);
      try {
        await fetchThumbs(titles, PLAY_SIZE);
      } catch (e) {
        if (mine !== stamp) return;
        return renderMessage("התמונות לא נטענו", "בדקו את החיבור לאינטרנט ונסו שוב.", topicId);
      }
      if (mine !== stamp) return;
      const usable = (q) => !q.it.title || thumbs.get(PLAY_SIZE + "|" + q.it.title);
      state.spares = state.spares.filter(usable);
      state.queue = state.queue.map((q) => (usable(q) ? q : takeSpare(q))).filter(Boolean);
      if (!state.queue.length) {
        return renderMessage("התמונות לא נטענו", "ויקיפדיה לא החזירה תמונות. נסו שוב בעוד רגע.", topicId);
      }
    }
    showQuestion();
  }

  function showQuestion() {
    const mine = ++stamp;
    const s = state;
    const q = s.queue[s.idx];
    const t = q.t;
    const it = q.it;
    const total = s.queue.length;
    const options = shuffle([it.a].concat(it.w));

    let dots = "";
    for (let i = 0; i < total; i++) {
      const done = s.log[i];
      dots += '<span class="dot' + (done ? (done.ok ? " is-right" : " is-wrong") : i === s.idx ? " is-now" : "") + '"></span>';
    }

    app.innerHTML =
      '<section class="quiz" style="--tc:' + t.color + '">' +
        '<header class="bar">' +
          '<button type="button" class="back" aria-label="חזרה לבחירת נושא">✕</button>' +
          '<div class="dots" role="img" aria-label="שאלה ' + (s.idx + 1) + " מתוך " + total + '">' + dots + "</div>" +
          '<div class="score">נקודות <b id="score">' + s.score + "</b></div>" +
        "</header>" +
        '<figure class="slide">' +
          '<div class="slide-window" id="win"><div class="loading">טוען תמונה</div></div>' +
          '<figcaption class="slide-label"><span class="tname">' + esc(t.short) + "</span><span>" + (s.idx + 1) + " מתוך " + total + "</span></figcaption>" +
        "</figure>" +
        '<h2 class="prompt">' + esc(promptFor(t, it)) + "</h2>" +
        '<div class="options">' +
        options.map((o, i) =>
          '<button type="button" class="opt is-waiting" disabled data-answer="' + esc(o) + '">' +
          '<span class="opt-key">' + KEYS[i] + "</span><span>" + esc(o) + "</span></button>").join("") +
        "</div>" +
        '<div class="after" aria-live="polite"></div>' +
      "</section>";
    window.scrollTo(0, 0);

    const win = document.getElementById("win");
    const ready = () => {
      app.querySelectorAll(".opt").forEach((b) => { b.disabled = false; b.classList.remove("is-waiting"); });
      preloadNext();
    };

    if (it.title) {
      const th = thumbs.get(PLAY_SIZE + "|" + it.title);
      loadImage(th.src).then(() => {
        if (mine !== stamp) return;
        win.innerHTML = '<div class="pic-blur"></div><img class="pic" alt="התמונה לשאלה">';
        win.firstChild.style.backgroundImage = 'url("' + th.src.replace(/"/g, "%22") + '")';
        win.lastChild.src = th.src;
        ready();
      }, () => {
        if (mine !== stamp) return;
        replaceBroken();
      });
    } else {
      (t.kind === "people" ? ownPhoto(t.id, it.p || it.id) : Promise.resolve(null)).then((url) => {
        if (mine !== stamp) return;
        if (url) {
          win.innerHTML = '<img class="pic pic--cover" alt="התמונה לשאלה"><button type="button" class="hint-btn" data-hint>רמז</button>';
          win.firstChild.src = url;
        } else {
          win.innerHTML = clueHtml(t, it);
        }
        ready();
      });
    }
  }

  /* The picture did not load: swap in another question, or shorten the round. */
  function replaceBroken() {
    const s = state;
    const spare = takeSpare(s.queue[s.idx]);
    if (spare) {
      s.queue[s.idx] = spare;
      return showQuestion();
    }
    s.queue.splice(s.idx, 1);
    if (!s.queue.length) return renderMessage("התמונות לא נטענו", "בדקו את החיבור לאינטרנט ונסו שוב.", s.topicId);
    if (s.idx >= s.queue.length) return finish();
    showQuestion();
  }

  function preloadNext() {
    const next = state && state.queue[state.idx + 1];
    if (!next) return;
    if (next.it.title) {
      const th = thumbs.get(PLAY_SIZE + "|" + next.it.title);
      if (th) new Image().src = th.src;
    } else if (next.t.kind === "people") {
      ownPhoto(next.t.id, next.it.p || next.it.id);
    }
  }

  function toggleHint(btn) {
    const win = document.getElementById("win");
    const q = state.queue[state.idx];
    const open = win.querySelector(".clue");
    if (open) {
      open.remove();
      btn.textContent = "רמז";
    } else {
      btn.insertAdjacentHTML("beforebegin", clueHtml(q.t, q.it));
      btn.textContent = "לתמונה";
    }
  }

  function answer(btn) {
    const s = state;
    const q = s.queue[s.idx];
    if (s.log[s.idx]) return;
    const picked = btn.dataset.answer;
    const ok = picked === q.it.a;

    app.querySelectorAll(".opt").forEach((b) => {
      b.disabled = true;
      if (b.dataset.answer === q.it.a) b.classList.add("is-right");
      else if (b === btn) b.classList.add("is-wrong");
      else b.classList.add("is-dim");
    });

    if (ok) s.score++;
    s.log[s.idx] = { ok: ok, answer: q.it.a, picked: picked };
    document.getElementById("score").textContent = s.score;
    const dot = app.querySelectorAll(".dot")[s.idx];
    if (dot) dot.className = "dot " + (ok ? "is-right" : "is-wrong");

    let source = "";
    if (q.it.title) {
      const th = thumbs.get(PLAY_SIZE + "|" + q.it.title);
      if (th && th.file) {
        source = '<p class="source">מקור התמונה: <a href="' + FILE_PAGE + encodeURIComponent(th.file) + '" target="_blank" rel="noopener">ויקיפדיה</a></p>';
      }
    }
    const last = s.idx === s.queue.length - 1;
    const after = app.querySelector(".after");
    after.innerHTML =
      '<p class="verdict ' + (ok ? "is-right" : "is-wrong") + '">' + (ok ? "נכון!" : "לא נכון. התשובה: " + esc(q.it.a)) + "</p>" +
      '<button type="button" class="primary" data-next>' + (last ? "לתוצאות" : "לשאלה הבאה") + "</button>" + source;
    const next = after.querySelector("[data-next]");
    try { next.focus({ preventScroll: true }); } catch (e) { /* older browsers */ }
    if (next.scrollIntoView) next.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function nextQuestion() {
    const s = state;
    if (!s || !s.log[s.idx]) return;
    s.idx++;
    if (s.idx >= s.queue.length) finish();
    else showQuestion();
  }

  function finish() {
    stamp++;
    const s = state;
    const total = s.queue.length;
    saveBest(s.topicId, s.score, total);
    const ratio = total ? s.score / total : 0;
    const title = ratio === 1 ? "מושלם. כל התשובות נכונות!"
      : ratio >= 0.8 ? "כמעט מושלם!"
      : ratio >= 0.5 ? "לא רע בכלל."
      : "הסיבוב הבא יהיה טוב יותר.";
    const misses = s.log.filter((l) => l && !l.ok);

    app.innerHTML =
      '<section class="result" style="--tc:' + s.color + '">' +
        '<figure class="slide">' +
          '<div class="slide-window result-window"><div class="result-score">' + s.score +
            "<small>תשובות נכונות מתוך " + total + "</small></div></div>" +
          '<figcaption class="slide-label"><span class="tname">' + esc(s.short) + "</span><span>סוף הסיבוב</span></figcaption>" +
        "</figure>" +
        "<h2>" + title + "</h2>" +
        (misses.length
          ? '<ul class="misses">' + misses.map((m) =>
              '<li><span class="m-q">עניתם: ' + esc(m.picked) + '</span><span class="m-a">התשובה: ' + esc(m.answer) + "</span></li>").join("") + "</ul>"
          : "") +
        '<div class="actions">' +
          '<button type="button" class="primary" data-again="' + esc(s.topicId) + '">סיבוב נוסף</button>' +
          '<button type="button" class="secondary" data-home>לבחירת נושא</button>' +
        "</div>" +
      "</section>";
    window.scrollTo(0, 0);
  }

  async function renderGallery() {
    const mine = ++stamp;
    state = null;
    const imageTopics = DATA.topics
      .map((t) => ({ name: t.name, items: t.items.filter((it) => it.title) }))
      .filter((t) => t.items.length);
    app.innerHTML =
      '<section class="gallery">' +
        '<button type="button" class="secondary" data-home>חזרה למשחק</button>' +
        "<h1>כל התמונות והמקורות</h1>" +
        "<p>שימו לב, כאן רואים את התשובות. כל תמונה היא התמונה הראשית של הערך בוויקיפדיה באנגלית, והקישור מוביל לדף הקובץ עם שם היוצר והרישיון.</p>" +
        '<div id="g"><p>טוען תמונות</p></div>' +
      "</section>";
    window.scrollTo(0, 0);
    const titles = [];
    imageTopics.forEach((t) => t.items.forEach((it) => titles.push(it.title)));
    imageTopics.forEach((t) => pinFiles(t.items, GALLERY_SIZE));
    try {
      await fetchThumbs(titles, GALLERY_SIZE);
    } catch (e) {
      if (mine === stamp) document.getElementById("g").innerHTML = "<p>התמונות לא נטענו. בדקו את החיבור לאינטרנט ונסו שוב.</p>";
      return;
    }
    if (mine !== stamp) return;
    document.getElementById("g").innerHTML = imageTopics.map((t) =>
      "<h2>" + esc(t.name) + '</h2><div class="g-grid">' +
      t.items.map((it) => {
        const th = thumbs.get(GALLERY_SIZE + "|" + it.title);
        return '<figure class="g-card">' +
          (th ? '<img loading="lazy" src="' + esc(th.src) + '" alt="">' : '<div class="g-missing">אין תמונה לערך הזה</div>') +
          "<figcaption>" + esc(it.a) + "</figcaption>" +
          (th && th.file ? '<a href="' + FILE_PAGE + encodeURIComponent(th.file) + '" target="_blank" rel="noopener">מקור התמונה</a>' : "") +
          "</figure>";
      }).join("") + "</div>").join("");
  }

  /* ---------- wiring ---------- */

  function goHome() {
    if (location.hash) {
      try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { location.hash = ""; }
    }
    renderHome();
  }

  app.addEventListener("click", (e) => {
    const el = e.target.closest("button");
    if (!el) return;
    if (el.classList.contains("topic")) startRound(el.dataset.topic);
    else if (el.classList.contains("opt")) answer(el);
    else if (el.hasAttribute("data-next")) nextQuestion();
    else if (el.hasAttribute("data-hint")) toggleHint(el);
    else if (el.hasAttribute("data-again")) startRound(el.dataset.again);
    else if (el.classList.contains("back") || el.hasAttribute("data-home")) goHome();
  });

  document.addEventListener("keydown", (e) => {
    if (!state || e.metaKey || e.ctrlKey || e.altKey) return;
    const n = "1234".indexOf(e.key);
    if (n < 0) return;
    const opt = app.querySelectorAll(".opt")[n];
    if (opt && !opt.disabled) opt.click();
  });

  function route() {
    if (location.hash === "#gallery") renderGallery();
    else renderHome();
  }

  window.addEventListener("hashchange", route);
  route();
})();
