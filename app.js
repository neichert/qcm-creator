(function () {
  "use strict";

  const STORAGE_KEY = "qcm-creator:v1";

  const TYPES = {
    multiple: { label: "Choix multiples", color: "var(--t-multiple)", hex: "#2563eb" },
    single: { label: "Choix unique", color: "var(--t-single)", hex: "#7c3aed" },
    short: { label: "Réponse courte", color: "var(--t-short)", hex: "#0891b2" },
    long: { label: "Réponse longue", color: "var(--t-long)", hex: "#0d9488" },
    list: { label: "Liste à tirets", color: "var(--t-list)", hex: "#d97706" },
  };

  const MIN_DASHES = 1, MAX_DASHES = 20;
  const MIN_LINES = 1, MAX_LINES = 25;
  const IMG_MAX_PX = 1400; // dimension maximale des photos après compression
  const IMG_SIZES = { small: "Petite", medium: "Moyenne", large: "Grande" };

  let state = load() || defaultState();

  // ---------- Utilitaires ----------
  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  function defaultState() {
    return {
      title: "",
      subtitle: "",
      duration: "",
      instructions: "",
      showPoints: true,
      showStudent: true,
      questions: [],
    };
  }

  function newQuestion(type) {
    const q = { id: uid(), type, text: "", image: null };
    if (type === "multiple" || type === "single") {
      q.options = [
        { id: uid(), text: "", correct: false },
        { id: uid(), text: "", correct: false },
        { id: uid(), text: "", correct: false },
        { id: uid(), text: "", correct: false },
      ];
    } else if (type === "short") {
      q.answer = "";
    } else if (type === "long") {
      q.answer = "";
      q.lines = 5;
    } else if (type === "list") {
      q.dashes = 3;
      q.dashAnswers = ["", "", ""];
    }
    return q;
  }

  function clamp(n, min, max) {
    n = parseInt(n, 10);
    if (isNaN(n)) n = min;
    return Math.max(min, Math.min(max, n));
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function letter(i) {
    return String.fromCharCode(65 + i);
  }

  let storageWarned = false;
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      storageWarned = false;
    } catch (e) {
      // Quota dépassé (photos trop nombreuses) : on prévient une fois
      if (!storageWarned) {
        storageWarned = true;
        toast("Stockage du navigateur plein : pensez à exporter votre QCM (.json).", true);
      }
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? sanitizeState(JSON.parse(raw)) : null;
    } catch (e) {
      return null;
    }
  }

  function sanitizeState(s) {
    if (!s || typeof s !== "object" || !Array.isArray(s.questions)) throw new Error("Format invalide");
    const out = Object.assign(defaultState(), {
      title: String(s.title || ""),
      subtitle: String(s.subtitle || ""),
      duration: String(s.duration || ""),
      instructions: String(s.instructions || ""),
      showPoints: s.showPoints !== false,
      showStudent: s.showStudent !== false,
    });
    out.questions = s.questions
      .filter((q) => q && TYPES[q.type])
      .map((q) => {
        const base = newQuestion(q.type);
        base.text = String(q.text || "");
        base.image = sanitizeImage(q.image);
        if (base.options) {
          const opts = Array.isArray(q.options) ? q.options : [];
          base.options = opts.map((o) => ({ id: uid(), text: String(o.text || ""), correct: !!o.correct }));
          if (q.type === "single") {
            let seen = false;
            base.options.forEach((o) => { if (o.correct) { if (seen) o.correct = false; seen = true; } });
          }
        }
        if ("answer" in base) base.answer = String(q.answer || "");
        if ("lines" in base) base.lines = clamp(q.lines, MIN_LINES, MAX_LINES);
        if ("dashes" in base) {
          base.dashes = clamp(q.dashes, MIN_DASHES, MAX_DASHES);
          const ans = Array.isArray(q.dashAnswers) ? q.dashAnswers.map(String) : [];
          base.dashAnswers = Array.from({ length: base.dashes }, (_, i) => ans[i] || "");
        }
        return base;
      });
    return out;
  }

  function sanitizeImage(img) {
    if (!img || typeof img !== "object") return null;
    const data = String(img.data || "");
    const w = +img.w, h = +img.h;
    if (!/^data:image\/(jpeg|png);base64,/.test(data) || !(w > 0) || !(h > 0)) return null;
    return { data, w, h, size: IMG_SIZES[img.size] ? img.size : "medium" };
  }

  // Redimensionne et compresse la photo (JPEG) pour limiter le poids
  function readImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, IMG_MAX_PX / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff"; // fond blanc pour les PNG transparents
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve({ data: canvas.toDataURL("image/jpeg", 0.85), w, h, size: "medium" });
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image illisible")); };
      img.src = url;
    });
  }

  function findQ(id) {
    return state.questions.find((q) => q.id === id);
  }

  // ---------- Toast ----------
  const toastEl = document.getElementById("toast");
  let toastTimer;
  function toast(msg, isError) {
    toastEl.textContent = msg;
    toastEl.classList.toggle("error", !!isError);
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 3200);
  }

  // ---------- Rendu ----------
  const qContainer = document.getElementById("questions");
  const emptyState = document.getElementById("empty-state");

  const ICONS = {
    up: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
    copy: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    image: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
    trash: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
  };

  function stepper(action, value, min, max) {
    return `<span class="stepper">
      <button type="button" data-action="${action}-dec" aria-label="Diminuer">−</button>
      <input type="number" data-field="${action}" value="${value}" min="${min}" max="${max}" />
      <button type="button" data-action="${action}-inc" aria-label="Augmenter">+</button>
    </span>`;
  }

  function renderQuestion(q, index) {
    const t = TYPES[q.type];
    const total = state.questions.length;
    let body = "";

    if (q.image) {
      const sizes = Object.entries(IMG_SIZES)
        .map(([k, label]) => `<button type="button" class="seg${q.image.size === k ? " active" : ""}" data-action="img-size" data-size="${k}">${label}</button>`)
        .join("");
      body += `<div class="q-image">
        <img src="${q.image.data}" alt="Photo de la question ${index + 1}" />
        <div class="q-image-bar">
          <span class="sub-label">Taille dans le PDF</span>
          <span class="segmented">${sizes}</span>
          <span class="q-image-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-action="add-image">Remplacer</button>
            <button type="button" class="btn btn-ghost btn-sm danger" data-action="remove-image">Retirer</button>
          </span>
        </div>
      </div>`;
    } else {
      body += `<button type="button" class="add-photo" data-action="add-image">${ICONS.image}<span>Ajouter une photo</span></button>`;
    }

    if (q.type === "multiple" || q.type === "single") {
      const inputType = q.type === "multiple" ? "checkbox" : "radio";
      const nbCorrect = q.options.filter((o) => o.correct).length;
      body += `<div class="sub-label"><span>Propositions</span><span class="note">${
        q.type === "multiple" ? "Cochez toutes les bonnes réponses" : "Sélectionnez la bonne réponse"
      } · ${nbCorrect} bonne${nbCorrect > 1 ? "s" : ""} réponse${nbCorrect > 1 ? "s" : ""}</span></div>`;
      body += `<div class="options">`;
      q.options.forEach((o, i) => {
        body += `<div class="option${o.correct ? " correct" : ""}" data-opt="${o.id}">
          <input class="mark" type="${inputType}" name="correct-${q.id}" data-action="toggle-correct" ${o.correct ? "checked" : ""} title="Bonne réponse" />
          <span class="opt-letter">${letter(i)}</span>
          <input type="text" data-field="opt-text" value="${escapeHtml(o.text)}" placeholder="Proposition ${letter(i)}" />
          <button type="button" class="icon-btn danger" data-action="remove-opt" title="Supprimer la proposition" ${q.options.length <= 2 ? "disabled" : ""}>${ICONS.x}</button>
        </div>`;
      });
      body += `</div>`;
      if (q.options.length < 26) body += `<button type="button" class="add-option" data-action="add-opt">+ Ajouter une proposition</button>`;
    } else if (q.type === "short") {
      body += `<label class="field answer-field"><span class="sub-label">Réponse attendue (corrigé)</span>
        <input type="text" data-field="answer" value="${escapeHtml(q.answer)}" placeholder="Saisissez la réponse attendue" /></label>`;
    } else if (q.type === "long") {
      body += `<div class="inline-setting"><span>Nombre de lignes de réponse :</span>${stepper("lines", q.lines, MIN_LINES, MAX_LINES)}</div>`;
      body += `<label class="field answer-field"><span class="sub-label">Réponse attendue (corrigé)</span>
        <textarea data-field="answer" rows="4" placeholder="Saisissez la réponse attendue">${escapeHtml(q.answer)}</textarea></label>`;
    } else if (q.type === "list") {
      body += `<div class="inline-setting"><span>Nombre de tirets :</span>${stepper("dashes", q.dashes, MIN_DASHES, MAX_DASHES)}</div>`;
      body += `<div class="sub-label"><span>Réponses attendues (corrigé)</span></div><div class="dash-list answer-field">`;
      for (let i = 0; i < q.dashes; i++) {
        body += `<div class="dash-row"><span class="dash">–</span>
          <input type="text" data-field="dash-answer" data-index="${i}" value="${escapeHtml(q.dashAnswers[i])}" placeholder="Réponse ${i + 1}" /></div>`;
      }
      body += `</div>`;
    }

    return `<article class="q-card" data-id="${q.id}" style="--q-color:${t.color}">
      <div class="q-head">
        <span class="q-num">${index + 1}</span>
        <span class="q-type">${t.label}</span>
        <div class="q-tools">
          <button type="button" class="icon-btn" data-action="up" title="Monter" ${index === 0 ? "disabled" : ""}>${ICONS.up}</button>
          <button type="button" class="icon-btn" data-action="down" title="Descendre" ${index === total - 1 ? "disabled" : ""}>${ICONS.down}</button>
          <button type="button" class="icon-btn" data-action="duplicate" title="Dupliquer">${ICONS.copy}</button>
          <button type="button" class="icon-btn danger" data-action="delete" title="Supprimer">${ICONS.trash}</button>
        </div>
      </div>
      <div class="q-body">
        <textarea class="q-statement" data-field="text" rows="2" placeholder="Intitulé de la question">${escapeHtml(q.text)}</textarea>
        ${body}
      </div>
    </article>`;
  }

  function renderQuestions() {
    qContainer.innerHTML = state.questions.map(renderQuestion).join("");
    emptyState.hidden = state.questions.length > 0;
    renderSummary();
  }

  function renderSummary() {
    document.getElementById("total-count").textContent = state.questions.length;
    const counts = {};
    state.questions.forEach((q) => { counts[q.type] = (counts[q.type] || 0) + 1; });
    const items = Object.keys(TYPES)
      .filter((k) => counts[k])
      .map((k) => `<li><span><span class="dot" style="background:${TYPES[k].hex}"></span>${TYPES[k].label}</span><b>${counts[k]}</b></li>`);
    items.push(`<li><span><span class="dot" style="background:var(--text)"></span><strong>Total des questions</strong></span><b>${state.questions.length}</b></li>`);
    document.getElementById("stats").innerHTML = items.join("");
  }

  function renderInfo() {
    document.getElementById("qcm-title").value = state.title;
    document.getElementById("qcm-subtitle").value = state.subtitle;
    document.getElementById("qcm-duration").value = state.duration;
    document.getElementById("qcm-instructions").value = state.instructions;
    document.getElementById("opt-points").checked = state.showPoints;
    document.getElementById("opt-student").checked = state.showStudent;
  }

  function renderAll() {
    renderInfo();
    renderQuestions();
  }

  // Re-rend une seule question en conservant le focus si possible
  function rerender(q) {
    const idx = state.questions.indexOf(q);
    const el = qContainer.querySelector(`[data-id="${q.id}"]`);
    if (!el || idx < 0) return renderQuestions();
    const tmp = document.createElement("div");
    tmp.innerHTML = renderQuestion(q, idx);
    el.replaceWith(tmp.firstElementChild);
    renderSummary();
  }

  // ---------- Événements : informations ----------
  const infoBindings = {
    "qcm-title": "title",
    "qcm-subtitle": "subtitle",
    "qcm-duration": "duration",
    "qcm-instructions": "instructions",
  };
  Object.entries(infoBindings).forEach(([id, key]) => {
    document.getElementById(id).addEventListener("input", (e) => { state[key] = e.target.value; save(); });
  });
  document.getElementById("opt-points").addEventListener("change", (e) => { state.showPoints = e.target.checked; save(); });
  document.getElementById("opt-student").addEventListener("change", (e) => { state.showStudent = e.target.checked; save(); });

  // ---------- Événements : ajout ----------
  document.querySelectorAll("[data-add]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const q = newQuestion(btn.dataset.add);
      state.questions.push(q);
      save();
      renderQuestions();
      const el = qContainer.querySelector(`[data-id="${q.id}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.querySelector(".q-statement").focus({ preventScroll: true });
      }
    });
  });

  // ---------- Événements : édition des questions ----------
  qContainer.addEventListener("input", (e) => {
    const card = e.target.closest(".q-card");
    if (!card) return;
    const q = findQ(card.dataset.id);
    const field = e.target.dataset.field;
    if (!q || !field) return;

    if (field === "text") q.text = e.target.value;
    else if (field === "answer") q.answer = e.target.value;
    else if (field === "opt-text") {
      const opt = q.options.find((o) => o.id === e.target.closest(".option").dataset.opt);
      if (opt) opt.text = e.target.value;
    } else if (field === "dash-answer") {
      q.dashAnswers[+e.target.dataset.index] = e.target.value;
    }
    save();
  });

  qContainer.addEventListener("change", (e) => {
    const card = e.target.closest(".q-card");
    if (!card) return;
    const q = findQ(card.dataset.id);
    const field = e.target.dataset.field;
    if (!q) return;

    if (e.target.dataset.action === "toggle-correct") {
      const optId = e.target.closest(".option").dataset.opt;
      if (q.type === "single") q.options.forEach((o) => { o.correct = o.id === optId; });
      else {
        const opt = q.options.find((o) => o.id === optId);
        opt.correct = e.target.checked;
      }
      save();
      rerender(q);
      return;
    }
    if (field === "lines") { q.lines = clamp(e.target.value, MIN_LINES, MAX_LINES); save(); rerender(q); }
    if (field === "dashes") { setDashes(q, e.target.value); save(); rerender(q); }
  });

  function setDashes(q, n) {
    q.dashes = clamp(n, MIN_DASHES, MAX_DASHES);
    while (q.dashAnswers.length < q.dashes) q.dashAnswers.push("");
    q.dashAnswers.length = q.dashes;
  }

  qContainer.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const card = btn.closest(".q-card");
    const q = findQ(card.dataset.id);
    if (!q) return;
    const idx = state.questions.indexOf(q);
    const action = btn.dataset.action;

    switch (action) {
      case "up":
      case "down": {
        const j = action === "up" ? idx - 1 : idx + 1;
        if (j < 0 || j >= state.questions.length) return;
        [state.questions[idx], state.questions[j]] = [state.questions[j], state.questions[idx]];
        save();
        renderQuestions();
        const moved = qContainer.querySelector(`[data-id="${q.id}"]`);
        if (moved) moved.scrollIntoView({ behavior: "smooth", block: "nearest" });
        return;
      }
      case "duplicate": {
        const copy = JSON.parse(JSON.stringify(q));
        copy.id = uid();
        if (copy.options) copy.options.forEach((o) => { o.id = uid(); });
        state.questions.splice(idx + 1, 0, copy);
        save();
        renderQuestions();
        toast("Question dupliquée");
        return;
      }
      case "delete": {
        const hasContent = q.text.trim() !== "";
        if (hasContent && !confirm(`Supprimer la question ${idx + 1} ?`)) return;
        state.questions.splice(idx, 1);
        save();
        renderQuestions();
        return;
      }
      case "add-opt":
        q.options.push({ id: uid(), text: "", correct: false });
        save();
        rerender(q);
        {
          const inputs = qContainer.querySelectorAll(`[data-id="${q.id}"] .option input[type="text"]`);
          if (inputs.length) inputs[inputs.length - 1].focus();
        }
        return;
      case "add-image":
        pickImage(q);
        return;
      case "remove-image":
        q.image = null;
        break;
      case "img-size":
        if (q.image && IMG_SIZES[btn.dataset.size]) q.image.size = btn.dataset.size;
        break;
      case "remove-opt": {
        if (q.options.length <= 2) return;
        const optId = btn.closest(".option").dataset.opt;
        q.options = q.options.filter((o) => o.id !== optId);
        save();
        rerender(q);
        return;
      }
      case "lines-dec": q.lines = clamp(q.lines - 1, MIN_LINES, MAX_LINES); break;
      case "lines-inc": q.lines = clamp(q.lines + 1, MIN_LINES, MAX_LINES); break;
      case "dashes-dec": setDashes(q, q.dashes - 1); break;
      case "dashes-inc": setDashes(q, q.dashes + 1); break;
      default: return;
    }
    save();
    rerender(q);
  });

  // ---------- Photos ----------
  const imageInput = document.createElement("input");
  imageInput.type = "file";
  imageInput.accept = "image/*";
  imageInput.hidden = true;
  document.body.appendChild(imageInput);
  let imageTarget = null;

  function pickImage(q) {
    imageTarget = q.id;
    imageInput.value = "";
    imageInput.click();
  }

  imageInput.addEventListener("change", async () => {
    const file = imageInput.files[0];
    const q = findQ(imageTarget);
    imageInput.value = "";
    if (!file || !q) return;
    try {
      const img = await readImage(file);
      if (q.image) img.size = q.image.size;
      q.image = img;
      save();
      rerender(q);
    } catch (err) {
      toast("Impossible de lire cette image.", true);
    }
  });

  // ---------- Import / export / réinitialisation ----------
  function fileBaseName() {
    const base = (state.title || "qcm")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
    return base.slice(0, 60) || "qcm";
  }

  function downloadBlob(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  document.getElementById("btn-export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    downloadBlob(blob, `${fileBaseName()}.json`);
    toast("QCM exporté");
  });

  const fileInput = document.getElementById("file-import");
  document.getElementById("btn-import").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    fileInput.value = "";
    if (!file) return;
    try {
      const data = sanitizeState(JSON.parse(await file.text()));
      if (state.questions.length && !confirm("Remplacer le QCM actuel par le fichier importé ?")) return;
      state = data;
      save();
      renderAll();
      toast("QCM importé");
    } catch (err) {
      toast("Fichier invalide : impossible d'importer ce QCM.", true);
    }
  });

  document.getElementById("btn-reset").addEventListener("click", () => {
    if (!confirm("Effacer tout le QCM ? Cette action est irréversible.")) return;
    state = defaultState();
    save();
    renderAll();
    hideDownloads();
    toast("QCM effacé");
  });

  // ---------- Génération ----------
  function validate() {
    if (!state.title.trim()) return { msg: "Ajoutez un titre au QCM.", focus: document.getElementById("qcm-title") };
    if (!state.questions.length) return { msg: "Ajoutez au moins une question." };
    for (let i = 0; i < state.questions.length; i++) {
      const q = state.questions[i];
      const n = i + 1;
      const card = qContainer.querySelector(`[data-id="${q.id}"]`);
      if (!q.text.trim()) return { msg: `Question ${n} : l'intitulé est vide.`, card };
      if (q.options) {
        const filled = q.options.filter((o) => o.text.trim());
        if (filled.length < 2) return { msg: `Question ${n} : renseignez au moins deux propositions.`, card };
        if (!q.options.some((o) => o.correct && o.text.trim())) return { msg: `Question ${n} : indiquez la bonne réponse.`, card };
      }
    }
    return null;
  }

  const btnGenerate = document.getElementById("btn-generate");
  const downloads = document.getElementById("downloads");
  let urls = [];

  function hideDownloads() {
    downloads.hidden = true;
    urls.forEach((u) => URL.revokeObjectURL(u));
    urls = [];
  }

  btnGenerate.addEventListener("click", () => {
    const err = validate();
    if (err) {
      toast(err.msg, true);
      const target = err.card || err.focus;
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        const input = err.focus || err.card.querySelector(".q-statement");
        if (input) input.focus({ preventScroll: true });
      }
      return;
    }
    if (!window.jspdf) { toast("Bibliothèque PDF introuvable.", true); return; }

    btnGenerate.disabled = true;
    try {
      const { subject, key } = window.QcmPdf.generate(state);
      hideDownloads();
      const base = fileBaseName();
      const names = { qcm: `${base}-sujet.pdf`, key: `${base}-corrige.pdf` };
      const subjectUrl = URL.createObjectURL(subject);
      const keyUrl = URL.createObjectURL(key);
      urls = [subjectUrl, keyUrl];

      const dlQcm = document.getElementById("dl-qcm");
      const dlKey = document.getElementById("dl-key");
      dlQcm.href = subjectUrl; dlQcm.download = names.qcm;
      dlKey.href = keyUrl; dlKey.download = names.key;
      document.getElementById("dl-qcm-name").textContent = names.qcm;
      document.getElementById("dl-key-name").textContent = names.key;
      downloads.hidden = false;

      dlQcm.click();
      setTimeout(() => dlKey.click(), 400);
      toast("PDF générés : sujet et corrigé");
    } catch (e2) {
      console.error(e2);
      toast("Erreur lors de la génération du PDF.", true);
    } finally {
      btnGenerate.disabled = false;
    }
  });

  renderAll();
})();
