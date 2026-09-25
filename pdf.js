/* Génération des PDF (sujet + corrigé) avec jsPDF */
(function () {
  "use strict";

  const PAGE_W = 210;
  const PAGE_H = 297;
  const M = 18; // marge latérale
  const TOP = 16; // haut de page (après le bandeau)
  const BOTTOM = PAGE_H - 20; // limite basse du contenu
  const CW = PAGE_W - 2 * M; // largeur utile
  const WRITE_LH = 8; // interligne des lignes d'écriture

  const C = {
    navy: [30, 58, 138],
    navyDark: [15, 31, 77],
    text: [15, 23, 42],
    muted: [100, 116, 139],
    line: [203, 213, 225],
    soft: [238, 242, 251],
    softBorder: [214, 223, 244],
    green: [21, 128, 61],
    greenSoft: [231, 246, 236],
    white: [255, 255, 255],
  };

  const HINTS = {
    multiple: "Plusieurs réponses possibles",
    single: "Une seule réponse possible",
    short: "Réponse courte",
    long: "Réponse rédigée",
    list: "Complétez la liste",
  };

  // Les polices standard de jsPDF ne couvrent que le jeu WinAnsi :
  // on remplace les caractères typographiques courants.
  function clean(s) {
    return String(s ?? "")
      .replace(/[‘’‚′]/g, "'")
      .replace(/[“”„″]/g, '"')
      .replace(/[–—−]/g, "-")
      .replace(/…/g, "...")
      .replace(/œ/g, "oe").replace(/Œ/g, "OE")
      .replace(/€/g, "EUR")
      .replace(/[    ]/g, " ")
      .replace(/\t/g, "    ")
      .replace(/\r\n?/g, "\n")
      .normalize("NFC")
      .replace(/[^\n\x20-\x7E -ÿ]/g, "?");
  }

  function lh(size, factor) {
    return size * 0.3528 * (factor || 1.35);
  }

  function build(state, isKey) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
    const total = state.questions.length;
    const title = clean(state.title.trim());
    let y = TOP;
    let dry = false; // mode mesure : on calcule la hauteur sans dessiner

    doc.setProperties({
      title: `${title} - ${isKey ? "Corrigé" : "Sujet"}`,
      subject: isKey ? "Corrigé du QCM" : "QCM",
      creator: "Créateur de QCM",
    });

    // ---------- Primitives ----------
    const color = (c) => doc.setTextColor(c[0], c[1], c[2]);
    const draw = (c) => doc.setDrawColor(c[0], c[1], c[2]);
    const fill = (c) => doc.setFillColor(c[0], c[1], c[2]);
    const font = (style, size) => { doc.setFont("helvetica", style); doc.setFontSize(size); };

    function decoratePage() {
      fill(C.navyDark);
      doc.rect(0, 0, PAGE_W, 3.2, "F");
      fill(C.navy);
      doc.rect(0, 3.2, PAGE_W, 1, "F");
    }

    function newPage() {
      doc.addPage();
      decoratePage();
      y = TOP;
    }

    // S'assure qu'il reste h mm sur la page ; sinon, saut de page
    function ensure(h) {
      if (dry) return;
      if (y + h > BOTTOM) newPage();
    }

    function text(str, x, yy, opts) {
      if (!dry) doc.text(str, x, yy, opts);
    }

    function hLine(x1, x2, yy, c, width, dash) {
      if (dry) return;
      draw(c);
      doc.setLineWidth(width || 0.25);
      if (dash) doc.setLineDashPattern(dash, 0);
      doc.line(x1, yy, x2, yy);
      if (dash) doc.setLineDashPattern([], 0);
    }

    function checkMark(cx, cy, s) {
      draw(C.white);
      doc.setLineWidth(0.55);
      doc.setLineCap("round");
      doc.setLineJoin("round");
      doc.lines([[s * 0.28, s * 0.28], [s * 0.5, -s * 0.6]], cx - s * 0.36, cy + s * 0.02, [1, 1], "S", false);
      doc.setLineCap("butt");
    }

    // ---------- En-tête ----------
    function header() {
      decoratePage();
      const boxW = 42, boxH = 25;
      const boxX = PAGE_W - M - boxW, boxY = 12;
      const titleW = CW - boxW - 8;

      // Pastille Sujet / Corrigé
      font("bold", 7.5);
      const tag = isKey ? "CORRIGÉ" : "SUJET";
      const tagW = doc.getTextWidth(tag) + 6;
      fill(isKey ? C.green : C.navy);
      doc.roundedRect(M, 12, tagW, 5.2, 1.2, 1.2, "F");
      color(C.white);
      doc.text(tag, M + 3, 15.6);

      // Titre
      font("bold", 19);
      color(C.navyDark);
      let ty = 25;
      const tLines = doc.splitTextToSize(title, titleW);
      tLines.forEach((l) => { doc.text(l, M, ty); ty += lh(19, 1.2); });
      ty -= lh(19, 1.2) - 5.5;

      // Sous-titre + informations
      if (state.subtitle.trim()) {
        font("normal", 11.5);
        color(C.text);
        doc.splitTextToSize(clean(state.subtitle.trim()), titleW).forEach((l) => { doc.text(l, M, ty); ty += lh(11.5); });
        ty += 0.5;
      }
      const meta = [];
      if (state.duration.trim()) meta.push(`Durée : ${clean(state.duration.trim())}`);
      meta.push(`${total} question${total > 1 ? "s" : ""}`);
      if (state.showPoints) meta.push("1 point par question");
      font("normal", 9);
      color(C.muted);
      doc.text(meta.join("   |   "), M, ty);
      ty += 2;

      // Cadre de note
      fill(isKey ? C.greenSoft : C.soft);
      draw(isKey ? C.green : C.navy);
      doc.setLineWidth(0.5);
      doc.roundedRect(boxX, boxY, boxW, boxH, 2.5, 2.5, "FD");
      font("bold", 7.5);
      color(isKey ? C.green : C.navy);
      doc.text(isKey ? "BARÈME" : "NOTE", boxX + 4, boxY + 5.5);
      if (isKey) {
        font("bold", 18);
        doc.text(`${total} pt${total > 1 ? "s" : ""}`, boxX + boxW / 2, boxY + 17.5, { align: "center" });
      } else {
        font("bold", 18);
        const lbl = `/ ${total}`;
        const lw = doc.getTextWidth(lbl);
        doc.text(lbl, boxX + boxW - 4, boxY + 18, { align: "right" });
        draw(C.muted);
        doc.setLineWidth(0.3);
        doc.setLineDashPattern([0.6, 0.8], 0);
        doc.line(boxX + 5, boxY + 18.5, boxX + boxW - 6 - lw, boxY + 18.5);
        doc.setLineDashPattern([], 0);
      }

      y = Math.max(ty, boxY + boxH) + 6;

      // Cadre élève
      if (state.showStudent && !isKey) {
        const h = 19;
        draw(C.line);
        doc.setLineWidth(0.3);
        doc.roundedRect(M, y, CW, h, 2, 2, "S");
        const colW = CW / 2;
        const rows = [["Nom", "Prénom"], ["Classe", "Date"]];
        rows.forEach((row, r) => {
          row.forEach((label, c) => {
            const x = M + 5 + c * colW;
            const yy = y + 7.5 + r * 7.5;
            font("bold", 9.5);
            color(C.navy);
            doc.text(`${label} :`, x, yy);
            const w = doc.getTextWidth(`${label} :`);
            hLine(x + w + 2, M + (c + 1) * colW - 5, yy + 0.6, C.muted, 0.25, [0.6, 0.9]);
          });
        });
        y += h + 5;
      }

      // Consignes
      if (state.instructions.trim()) {
        font("normal", 9.8);
        const iLines = doc.splitTextToSize(clean(state.instructions.trim()), CW - 12);
        const h = 9 + iLines.length * lh(9.8) + 2.5;
        fill(C.soft);
        doc.roundedRect(M, y, CW, h, 2, 2, "F");
        fill(C.navy);
        doc.rect(M, y, 1.3, h, "F");
        font("bold", 7.5);
        color(C.navy);
        doc.text("CONSIGNES", M + 6, y + 6);
        font("normal", 9.8);
        color(C.text);
        let iy = y + 11.2;
        iLines.forEach((l) => { doc.text(l, M + 6, iy); iy += lh(9.8); });
        y += h + 6;
      }

      y += 2;
    }

    // ---------- Questions ----------
    function questionHeader(q, i) {
      const n = String(i + 1);
      font("bold", 9.5);
      const bw = Math.max(7, doc.getTextWidth(n) + 4);
      if (!dry) {
        fill(C.navy);
        doc.roundedRect(M, y - 4.4, bw, 6, 1.3, 1.3, "F");
        color(C.white);
        doc.text(n, M + bw / 2, y, { align: "center" });
      }
      font("bold", 8);
      color(C.muted);
      text(HINTS[q.type].toUpperCase(), M + bw + 3, y - 0.2);

      if (state.showPoints) {
        if (isKey) {
          font("bold", 9);
          color(C.green);
          text("1 pt", PAGE_W - M, y, { align: "right" });
        } else if (!dry) {
          const w = 16, h = 6;
          draw(C.line);
          doc.setLineWidth(0.3);
          doc.roundedRect(PAGE_W - M - w, y - 4.4, w, h, 1.2, 1.2, "S");
          font("bold", 9);
          color(C.navy);
          doc.text("/ 1", PAGE_W - M - 2, y, { align: "right" });
        }
      }
      y += 6.5;

      // Intitulé
      font("bold", 11);
      color(C.text);
      const lines = doc.splitTextToSize(clean(q.text.trim()), CW - 2);
      lines.forEach((l) => { ensure(lh(11)); text(l, M, y); y += lh(11); });
      y += 2.2;
    }

    function choices(q) {
      const indent = M + 4;
      const markSize = 4.2;
      const textX = indent + markSize + 9;
      const textW = PAGE_W - M - textX;
      let idx = 0;
      q.options.forEach((o) => {
        if (!o.text.trim()) return;
        const correct = isKey && o.correct;
        font(correct ? "bold" : "normal", 10.5);
        const lines = doc.splitTextToSize(clean(o.text.trim()), textW);
        const rowH = Math.max(lines.length * lh(10.5), markSize) + 2.6;
        ensure(rowH);

        const my = y - 3.4; // haut de la case
        if (!dry) {
          doc.setLineWidth(0.4);
          if (correct) { fill(C.green); draw(C.green); } else { draw(C.muted); }
          if (q.type === "multiple") {
            doc.roundedRect(indent, my, markSize, markSize, 0.7, 0.7, correct ? "FD" : "S");
          } else {
            doc.circle(indent + markSize / 2, my + markSize / 2, markSize / 2, correct ? "FD" : "S");
          }
          if (correct) checkMark(indent + markSize / 2, my + markSize / 2, markSize);
        }
        font("bold", 10.5);
        color(correct ? C.green : C.navy);
        text(String.fromCharCode(65 + idx) + ".", indent + markSize + 3, y);
        font(correct ? "bold" : "normal", 10.5);
        color(correct ? C.green : C.text);
        let ly = y;
        lines.forEach((l) => { text(l, textX, ly); ly += lh(10.5); });
        y += rowH;
        idx++;
      });
    }

    // Lignes d'écriture ; dans le corrigé, la réponse est écrite dessus
    function writingLines(nLines, answer, x) {
      x = x ?? M;
      let lines = [];
      if (isKey && answer && answer.trim()) {
        font("normal", 11);
        lines = doc.splitTextToSize(clean(answer.trim()), PAGE_W - M - x - 2);
      }
      const count = Math.max(nLines, lines.length);
      y += 1;
      for (let i = 0; i < count; i++) {
        ensure(WRITE_LH);
        y += WRITE_LH;
        hLine(x, PAGE_W - M, y, C.line, 0.25, isKey ? null : [0.8, 0.9]);
        if (lines[i]) {
          font("normal", 11);
          color(C.green);
          text(lines[i], x + 1, y - 1.6);
        }
      }
      y += 1.5;
    }

    function dashList(q) {
      for (let i = 0; i < q.dashes; i++) {
        const answer = isKey ? (q.dashAnswers[i] || "") : "";
        let lines = [""];
        if (answer.trim()) {
          font("normal", 11);
          lines = doc.splitTextToSize(clean(answer.trim()), PAGE_W - M - (M + 11) - 2);
        }
        lines.forEach((l, j) => {
          ensure(WRITE_LH);
          y += WRITE_LH;
          if (j === 0 && !dry) {
            draw(C.navy);
            doc.setLineWidth(0.6);
            doc.line(M + 4, y - 1.8, M + 7.5, y - 1.8);
          }
          hLine(M + 10, PAGE_W - M, y, C.line, 0.25, isKey ? null : [0.8, 0.9]);
          if (l) {
            font("normal", 11);
            color(C.green);
            text(l, M + 11, y - 1.6);
          }
        });
      }
      y += 2.5;
    }

    function question(q, i) {
      questionHeader(q, i);
      if (q.type === "multiple" || q.type === "single") choices(q);
      else if (q.type === "short") writingLines(1, q.answer);
      else if (q.type === "long") writingLines(q.lines, q.answer);
      else if (q.type === "list") dashList(q);
    }

    function measure(q, i) {
      const saveY = y;
      dry = true;
      y = 0;
      question(q, i);
      const h = y;
      dry = false;
      y = saveY;
      return h;
    }

    // ---------- Assemblage ----------
    header();
    state.questions.forEach((q, i) => {
      const h = measure(q, i);
      // Garde la question entière sur une page quand c'est possible
      if (y + h > BOTTOM && h <= BOTTOM - TOP) newPage();
      else if (y + 20 > BOTTOM) newPage();
      question(q, i);
      if (i < total - 1) {
        y += 3;
        if (y < BOTTOM - 10) hLine(M, PAGE_W - M, y, C.softBorder, 0.3);
        y += 8;
      }
    });

    // Fin du corrigé
    if (isKey) {
      if (y + 16 > BOTTOM) newPage();
      y += 4;
      fill(C.greenSoft);
      doc.roundedRect(M, y, CW, 11, 2, 2, "F");
      font("bold", 10);
      color(C.green);
      doc.text(`Total : ${total} point${total > 1 ? "s" : ""}  -  1 point par bonne réponse`, PAGE_W / 2, y + 7, { align: "center" });
    }

    // ---------- Pied de page ----------
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      hLine(M, PAGE_W - M, PAGE_H - 13, C.line, 0.3);
      font("normal", 8);
      color(C.muted);
      const left = doc.splitTextToSize(`${title}  |  ${isKey ? "Corrigé" : "Sujet"}`, CW - 30)[0];
      doc.text(left, M, PAGE_H - 8.5);
      doc.text(`Page ${p} / ${pages}`, PAGE_W - M, PAGE_H - 8.5, { align: "right" });
    }

    return doc.output("blob");
  }

  window.QcmPdf = {
    generate(state) {
      return { subject: build(state, false), key: build(state, true) };
    },
  };
})();
