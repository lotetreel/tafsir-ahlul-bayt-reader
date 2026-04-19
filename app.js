const ARABIC_SIZES = {
  sm: "clamp(1.5rem, 3vw, 2.2rem)",
  md: "clamp(2.1rem, 4vw, 3rem)",
  lg: "clamp(2.7rem, 5vw, 3.8rem)",
  xl: "clamp(3.4rem, 6.5vw, 4.8rem)",
};

const ENGLISH_SIZES = {
  sm: "0.88rem",
  md: "1rem",
  lg: "1.2rem",
};

const INTRO_SCOPE_PATTERN = /\bintro\b|\u0645\u0642\u062f\u0645[\u0647\u0629]/i;

const state = {
  manifest: null,
  chaptersBySura: new Map(),
  currentSura: 1,
  currentSurahData: null,
  currentCommentarySelection: null,
  searchQuery: "",
  showTransliteration: readToggle("showTransliteration", true),
  showEnglish: readToggle("showEnglish", true),
  compactView: "list",
  theme: readSetting("theme", "sepia"),
  arabicFont: readSetting("arabicFont", "Scheherazade New"),
  arabicSize: readSetting("arabicSize", "md"),
  englishFont: readSetting("englishFont", "Manrope"),
  englishSize: readSetting("englishSize", "md"),
  verseNavSelectedSura: null,
  verseNavSelectedAya: null,
  verseNavSurahQuery: "",
};

const elements = {
  sidebar: document.getElementById("sidebar"),
  chapterList: document.getElementById("chapterList"),
  chapterSearch: document.getElementById("chapterSearch"),
  reader: document.querySelector(".reader"),
  chapterTitle: document.getElementById("chapterTitle"),
  chapterMeta: document.getElementById("chapterMeta"),
  chapterStats: document.getElementById("chapterStats"),
  surahIntroButton: document.getElementById("surahIntroButton"),
  basmalahCard: document.getElementById("basmalahCard"),
  verseList: document.getElementById("verseList"),
  showChapterList: document.getElementById("showChapterList"),
  prevChapter: document.getElementById("prevChapter"),
  nextChapter: document.getElementById("nextChapter"),
  showTransliteration: document.getElementById("showTransliteration"),
  showEnglish: document.getElementById("showEnglish"),
  commentaryOverlay: document.getElementById("commentaryOverlay"),
  commentaryPanel: document.querySelector(".commentary-panel"),
  closeCommentary: document.getElementById("closeCommentary"),
  commentaryEyebrow: document.getElementById("commentaryEyebrow"),
  commentaryTitle: document.getElementById("commentaryTitle"),
  commentarySubtitle: document.getElementById("commentarySubtitle"),
  commentaryContext: document.getElementById("commentaryContext"),
  commentaryBody: document.getElementById("commentaryBody"),
  copyVerseCommentary: document.getElementById("copyVerseCommentary"),
  commentaryStatus: document.getElementById("commentaryStatus"),
  chapterItemTemplate: document.getElementById("chapterItemTemplate"),
  verseTemplate: document.getElementById("verseTemplate"),
  commentaryEntryTemplate: document.getElementById("commentaryEntryTemplate"),
  heroPanel: document.querySelector(".hero-panel"),
  openSettings: document.getElementById("openSettings"),
  settingsFab: document.getElementById("settingsFab"),
  closeSettings: document.getElementById("closeSettings"),
  settingsOverlay: document.getElementById("settingsOverlay"),
  themeOptions: document.getElementById("themeOptions"),
  arabicFontOptions: document.getElementById("arabicFontOptions"),
  arabicSizeOptions: document.getElementById("arabicSizeOptions"),
  englishFontOptions: document.getElementById("englishFontOptions"),
  englishSizeOptions: document.getElementById("englishSizeOptions"),
  openVerseNav: document.getElementById("openVerseNav"),
  verseNavOverlay: document.getElementById("verseNavOverlay"),
  closeVerseNav: document.getElementById("closeVerseNav"),
  verseNavSearch: document.getElementById("verseNavSearch"),
  verseNavSurahList: document.getElementById("verseNavSurahList"),
  verseNavAyahList: document.getElementById("verseNavAyahList"),
  verseNavGo: document.getElementById("verseNavGo"),
};

boot().catch((error) => {
  console.error(error);
  elements.chapterTitle.textContent = "Failed to load reader data";
  elements.chapterMeta.textContent = String(error);
});

async function boot() {
  bindEvents();
  applyToggleState();
  applySettings();
  applyTheme();

  const manifestResponse = await fetch("data/manifest.json");
  state.manifest = await manifestResponse.json();
  state.manifest.chapters.forEach((chapter) => {
    state.chaptersBySura.set(chapter.sura, chapter);
  });

  const hashSura = Number.parseInt(window.location.hash.replace("#", ""), 10);
  const hasInitialHash = Number.isInteger(hashSura) && state.chaptersBySura.has(hashSura);
  if (Number.isInteger(hashSura) && state.chaptersBySura.has(hashSura)) {
    state.currentSura = hashSura;
  }

  state.compactView = hasInitialHash ? "reader" : "list";
  applyCompactViewState();
  renderChapterList();
  await loadSurah(state.currentSura, { revealReader: hasInitialHash });
}

function bindEvents() {
  elements.showChapterList.addEventListener("click", () => {
    if (window.location.hash !== "") {
      history.pushState(null, "", window.location.pathname + window.location.search);
    }
    showCompactListView();
  });

  elements.chapterSearch.addEventListener("input", (event) => {
    state.searchQuery = event.target.value.trim().toLowerCase();
    renderChapterList();
  });

  elements.prevChapter.addEventListener("click", () => {
    if (state.currentSura > 1) {
      loadSurah(state.currentSura - 1, { revealReader: true });
    }
  });

  elements.nextChapter.addEventListener("click", () => {
    if (state.currentSura < 114) {
      loadSurah(state.currentSura + 1, { revealReader: true });
    }
  });

  elements.showTransliteration.addEventListener("change", () => {
    state.showTransliteration = elements.showTransliteration.checked;
    persistToggle("showTransliteration", state.showTransliteration);
    renderVerses();
  });

  elements.showEnglish.addEventListener("change", () => {
    state.showEnglish = elements.showEnglish.checked;
    persistToggle("showEnglish", state.showEnglish);
    renderVerses();
  });

  elements.surahIntroButton.addEventListener("click", openSurahIntroCommentary);

  elements.copyVerseCommentary.addEventListener("click", async () => {
    if (!state.currentCommentarySelection) {
      return;
    }
    const payload = formatCommentarySelectionForCopy(state.currentCommentarySelection);
    const successMessage = state.currentCommentarySelection.kind === "surah-intro"
      ? "Copied surah introduction commentary."
      : "Copied commentary for this verse.";
    await copyText(payload, successMessage);
  });

  elements.closeCommentary.addEventListener("click", closeCommentary);
  elements.commentaryOverlay.addEventListener("click", (event) => {
    if (event.target === elements.commentaryOverlay) {
      closeCommentary();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!elements.settingsOverlay.classList.contains("hidden")) {
        closeSettings();
      } else if (!elements.verseNavOverlay.classList.contains("hidden")) {
        closeVerseNav();
      } else if (!elements.commentaryOverlay.classList.contains("hidden")) {
        closeCommentary();
      }
    }
  });

  window.addEventListener("hashchange", () => {
    const raw = window.location.hash.replace("#", "");
    if (raw === "") {
      showCompactListView();
      return;
    }
    const hashSura = Number.parseInt(raw, 10);
    if (Number.isInteger(hashSura) && state.chaptersBySura.has(hashSura)) {
      if (hashSura !== state.currentSura) {
        loadSurah(hashSura, { revealReader: true });
      } else {
        showCompactReaderView();
      }
    }
  });

  window.addEventListener("resize", applyCompactViewState);

  elements.openSettings.addEventListener("click", openSettings);
  elements.settingsFab.addEventListener("click", openSettings);
  elements.closeSettings.addEventListener("click", closeSettings);

  new IntersectionObserver(([entry]) => {
    elements.settingsFab.classList.toggle("visible", !entry.isIntersecting);
  }).observe(elements.heroPanel);
  elements.settingsOverlay.addEventListener("click", (event) => {
    if (event.target === elements.settingsOverlay) {
      closeSettings();
    }
  });

  bindSegment(elements.themeOptions, (value) => {
    state.theme = value;
    persistSetting("theme", value);
    applyTheme();
  });

  bindSegment(elements.arabicFontOptions, (value) => {
    state.arabicFont = value;
    persistSetting("arabicFont", value);
    applySettings();
  });

  bindSegment(elements.arabicSizeOptions, (value) => {
    state.arabicSize = value;
    persistSetting("arabicSize", value);
    applySettings();
  });

  bindSegment(elements.englishFontOptions, (value) => {
    state.englishFont = value;
    persistSetting("englishFont", value);
    applySettings();
  });

  bindSegment(elements.englishSizeOptions, (value) => {
    state.englishSize = value;
    persistSetting("englishSize", value);
    applySettings();
  });

  elements.openVerseNav.addEventListener("click", openVerseNav);
  elements.closeVerseNav.addEventListener("click", closeVerseNav);
  elements.verseNavOverlay.addEventListener("click", (event) => {
    if (event.target === elements.verseNavOverlay) closeVerseNav();
  });
  elements.verseNavSearch.addEventListener("input", (event) => {
    state.verseNavSurahQuery = event.target.value.trim().toLowerCase();
    renderVerseNavSurahList();
  });
  elements.verseNavGo.addEventListener("click", () => {
    if (state.verseNavSelectedSura !== null && state.verseNavSelectedAya !== null) {
      navigateToVerse(state.verseNavSelectedSura, state.verseNavSelectedAya);
    }
  });
}

async function loadSurah(sura, options = {}) {
  const chapter = state.chaptersBySura.get(sura);
  if (!chapter) {
    return;
  }

  closeCommentary();
  state.currentSura = sura;
  state.currentSurahData = null;
  window.location.hash = String(sura);
  updateHeader(chapter, null);
  renderSurahIntroButton();
  renderChapterList();

  const response = await fetch(chapter.file);
  state.currentSurahData = await response.json();
  updateHeader(chapter, state.currentSurahData);
  renderVerses();

  if (options.revealReader) {
    showCompactReaderView();
  }
}

function updateHeader(chapter, surahData) {
  const commentaryCount = surahData?.chapter?.commentary_verses ?? chapter.commentary_verses;
  elements.chapterTitle.textContent = `${chapter.sura}. ${chapter.transliteration}`;
  elements.chapterMeta.textContent = `${chapter.name_english} - ${chapter.name_arabic} - ${chapter.origin} - Juz ${chapter.juz}`;
  elements.chapterStats.textContent = `${chapter.verse_count} verses - ${commentaryCount} with commentary`;
  elements.prevChapter.disabled = chapter.sura === 1;
  elements.nextChapter.disabled = chapter.sura === 114;
}

function renderChapterList() {
  const fragment = document.createDocumentFragment();
  const chapters = state.manifest?.chapters ?? [];
  const filtered = chapters.filter((chapter) => matchesChapterSearch(chapter, state.searchQuery));

  for (const chapter of filtered) {
    const button = elements.chapterItemTemplate.content.firstElementChild.cloneNode(true);
    button.querySelector(".chapter-number").textContent = chapter.sura;
    button.querySelector(".chapter-english").textContent = chapter.name_english;
    button.querySelector(".chapter-transliteration").textContent = chapter.transliteration;
    button.querySelector(".chapter-arabic").textContent = chapter.name_arabic;
    if (chapter.sura === state.currentSura) {
      button.classList.add("active");
    }
    button.addEventListener("click", () => loadSurah(chapter.sura, { revealReader: true }));
    fragment.append(button);
  }

  elements.chapterList.replaceChildren(fragment);
}

function matchesChapterSearch(chapter, query) {
  if (!query) {
    return true;
  }
  const haystack = [
    chapter.sura,
    chapter.name_english,
    chapter.transliteration,
    chapter.name_arabic,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function renderVerses() {
  const surahData = state.currentSurahData;
  if (!surahData) {
    return;
  }

  const { chapter, verses } = surahData;
  const surahIntroEntries = getSurahIntroEntries(surahData);
  elements.basmalahCard.textContent = chapter.display_basmalah || "";
  elements.basmalahCard.classList.toggle("hidden", !chapter.display_basmalah);
  renderSurahIntroButton();

  const fragment = document.createDocumentFragment();
  for (const verse of verses) {
    const card = elements.verseTemplate.content.firstElementChild.cloneNode(true);
    card.dataset.aya = verse.aya;
    card.querySelector(".verse-badge").textContent = verse.aya;
    card.querySelector(".verse-arabic").textContent = verse.arabic;

    const transliterationEl = card.querySelector(".verse-transliteration");
    transliterationEl.innerHTML = verse.transliteration_html;
    transliterationEl.classList.toggle("hidden", !state.showTransliteration);

    const englishEl = card.querySelector(".verse-english");
    englishEl.textContent = verse.english;
    englishEl.classList.toggle("hidden", !state.showEnglish);

    const commentaryButton = card.querySelector(".commentary-trigger");
    const verseEntries = getVerseCommentaryEntries(verse);
    if (verseEntries.length > 0) {
      commentaryButton.textContent = `Commentary (${verseEntries.length})`;
      commentaryButton.classList.add("has-commentary");
      commentaryButton.addEventListener("click", () => openCommentary(verse));
    } else {
      commentaryButton.textContent = verse.aya === 1 && surahIntroEntries.length > 0
        ? "No verse commentary"
        : "No commentary";
      commentaryButton.disabled = true;
    }

    fragment.append(card);
  }

  elements.verseList.replaceChildren(fragment);
}

function renderSurahIntroButton() {
  const introEntries = getSurahIntroEntries(state.currentSurahData);
  if (!introEntries.length) {
    elements.surahIntroButton.innerHTML = "";
    elements.surahIntroButton.classList.add("hidden");
    return;
  }

  const count = introEntries.length;
  elements.surahIntroButton.innerHTML = `
    <div class="shamseh-star-wrap" aria-hidden="true">
      <svg viewBox="0 0 100 100" class="shamseh-svg" aria-hidden="true">
        <defs>
          <linearGradient id="si-gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FFF4D2"/>
            <stop offset="30%" stop-color="#D4AF37"/>
            <stop offset="70%" stop-color="#B38914"/>
            <stop offset="100%" stop-color="#7A5C05"/>
          </linearGradient>
          <linearGradient id="si-gold-inner" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#F9E79F"/>
            <stop offset="50%" stop-color="#D4AF37"/>
            <stop offset="100%" stop-color="#9C7206"/>
          </linearGradient>
          <linearGradient id="si-emerald" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#117A43"/>
            <stop offset="100%" stop-color="#041E13"/>
          </linearGradient>
          <filter id="si-glow">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <g class="shamseh-spin">
          <rect x="20" y="20" width="60" height="60" fill="url(#si-gold-grad)" transform="rotate(0 50 50)" rx="1.5"/>
          <rect x="20" y="20" width="60" height="60" fill="url(#si-gold-grad)" transform="rotate(30 50 50)" rx="1.5"/>
          <rect x="20" y="20" width="60" height="60" fill="url(#si-gold-grad)" transform="rotate(60 50 50)" rx="1.5"/>
        </g>
        <circle cx="50" cy="50" r="23" fill="url(#si-emerald)" stroke="#021810" stroke-width="1"/>
        <circle cx="50" cy="50" r="21" fill="none" stroke="url(#si-gold-inner)" stroke-width="1.5"/>
        <circle cx="50" cy="50" r="18" fill="none" stroke="url(#si-gold-inner)" stroke-width="0.5" stroke-dasharray="1 2" opacity="0.6"/>
        <g filter="url(#si-glow)">
          <path d="M50,56 L50,40 C46,38 39,39 34,43 L34,59 C39,55 46,54 50,56 Z" fill="url(#si-gold-inner)"/>
          <path d="M50,56 L50,40 C54,38 61,39 66,43 L66,59 C61,55 54,54 50,56 Z" fill="url(#si-gold-inner)"/>
          <path d="M50,40 L50,56" stroke="#041E13" stroke-width="1.2" stroke-linecap="round"/>
        </g>
      </svg>
    </div>
    <div class="shamseh-pill">
      <div class="shamseh-sweep" aria-hidden="true"></div>
      <div class="shamseh-text" aria-hidden="true">
        <span class="shamseh-label">Introductory</span>
        <span class="shamseh-title">HADITH</span>
      </div>
      <div class="shamseh-badge" aria-hidden="true">
        <div class="shamseh-badge-ring"></div>
        <span class="shamseh-count">${count}</span>
      </div>
    </div>
    <span class="sr-only">Introductory Hadith, ${count} entries</span>
  `;
  elements.surahIntroButton.classList.remove("hidden");
}

function getSurahIntroEntries(surahData) {
  return surahData?.verses?.[0]?.commentary?.entries?.filter(isSurahIntroEntry) ?? [];
}

function getVerseCommentaryEntries(verse) {
  return verse.commentary.entries.filter((entry) => !isSurahIntroEntry(entry));
}

function isSurahIntroEntry(entry) {
  return INTRO_SCOPE_PATTERN.test(normalizeCommentaryScope(entry?.scope));
}

function isIntroCommentaryEntry(entry) {
  const scope = normalizeCommentaryScope(entry?.scope);
  return scope.includes("intro") || scope.includes("مقدمه") || scope.includes("مقدمة");
}

function normalizeCommentaryScope(scope) {
  return String(scope || "")
    .replace(/[\u200c\u200e\u200f]/g, "")
    .trim()
    .toLowerCase();
}

function isCompactLayout() {
  return window.matchMedia("(max-width: 1080px)").matches;
}

function applyCompactViewState() {
  const compact = isCompactLayout();
  document.body.classList.toggle("compact-layout", compact);
  document.body.classList.toggle("compact-list-view", compact && state.compactView === "list");
  document.body.classList.toggle("compact-reader-view", compact && state.compactView === "reader");
}

function showCompactReaderView() {
  if (!elements.reader || !isCompactLayout()) {
    return;
  }

  state.compactView = "reader";
  applyCompactViewState();
  scrollCompactViewportToTop();
}

function showCompactListView() {
  if (!elements.sidebar || !isCompactLayout()) {
    return;
  }

  state.compactView = "list";
  applyCompactViewState();
  scrollCompactViewportToTop();
}

function scrollCompactViewportToTop() {
  if (!isCompactLayout()) {
    return;
  }

  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";

  window.requestAnimationFrame(() => {
    window.scrollTo({
      top: 0,
      behavior,
    });
  });
}

function openCommentary(verse) {
  if (!state.currentSurahData) {
    return;
  }

  const selection = buildVerseCommentarySelection(verse, state.currentSurahData.chapter);
  if (!selection) {
    return;
  }

  openCommentarySelection(selection);
}

function openSurahIntroCommentary() {
  if (!state.currentSurahData) {
    return;
  }

  const selection = buildSurahIntroCommentarySelection(state.currentSurahData);
  if (!selection) {
    return;
  }

  openCommentarySelection(selection);
}

function buildVerseCommentarySelection(verse, chapter) {
  const entries = getVerseCommentaryEntries(verse);
  if (!entries.length) {
    return null;
  }

  return {
    kind: "verse",
    eyebrow: "Verse Commentary",
    title: `${chapter.transliteration} ${verse.aya}`,
    subtitle: `${chapter.name_english} - ${chapter.name_arabic}`,
    chapter,
    verse,
    entries,
    plainText: verse.commentary.plain_text,
  };
}

function buildSurahIntroCommentarySelection(surahData) {
  const entries = getSurahIntroEntries(surahData);
  if (!entries.length) {
    return null;
  }

  const { chapter } = surahData;
  return {
    kind: "surah-intro",
    eyebrow: "Surah Introduction",
    title: `${chapter.transliteration} Introduction`,
    subtitle: `${chapter.name_english} - ${chapter.name_arabic}`,
    chapter,
    entries,
    plainText: "",
  };
}

function openCommentarySelection(selection) {
  state.currentCommentarySelection = selection;
  elements.commentaryEyebrow.textContent = selection.eyebrow;
  elements.commentaryTitle.textContent = selection.title;
  elements.commentarySubtitle.textContent = selection.subtitle;
  renderCommentaryContext(selection);
  renderCommentaryEntries(selection);
  setStatusMessage("");

  elements.commentaryOverlay.classList.remove("hidden");
  elements.commentaryOverlay.setAttribute("aria-hidden", "false");
  resetCommentaryScroll();
  window.requestAnimationFrame(resetCommentaryScroll);
  document.body.style.overflow = "hidden";
}

function renderCommentaryContext(selection) {
  const context = document.createElement("div");
  if (selection.kind === "surah-intro") {
    const note = document.createElement("p");
    note.className = "commentary-context-note";
    note.textContent = `Introductory hadith linked to ${selection.chapter.transliteration} as a whole rather than a single ayah.`;
    context.append(note);
  } else {
    const { verse } = selection;
    const arabic = document.createElement("p");
    arabic.className = "verse-arabic";
    arabic.textContent = verse.arabic;
    context.append(arabic);

    if (state.showTransliteration) {
      const transliteration = document.createElement("p");
      transliteration.className = "verse-transliteration";
      transliteration.innerHTML = verse.transliteration_html;
      context.append(transliteration);
    }

    if (state.showEnglish) {
      const english = document.createElement("p");
      english.className = "verse-english";
      english.textContent = verse.english;
      context.append(english);
    }
  }

  elements.commentaryContext.replaceChildren(context);
}

function renderCommentaryEntries(selection) {
  const fragment = document.createDocumentFragment();
  const chapter = selection.chapter;

  if (!chapter) {
    return;
  }

  if (selection.entries.length === 0) {
    const fallback = document.createElement("article");
    fallback.className = "commentary-entry";

    const actions = document.createElement("div");
    actions.className = "commentary-entry-actions";

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "secondary-button";
    copyButton.textContent = "Copy";
    copyButton.addEventListener("click", async () => {
      await copyText(
        formatCommentarySelectionForCopy(selection),
        selection.kind === "surah-intro"
          ? "Copied surah introduction commentary."
          : "Copied commentary for this verse.",
      );
    });
    actions.append(copyButton);

    const plain = document.createElement("p");
    plain.className = "commentary-entry-persian";
    plain.textContent = selection.plainText;

    fallback.append(actions, plain);
    fragment.append(fallback);
  } else {
    selection.entries.forEach((entry, index) => {
      const article = createCommentaryEntryArticle(entry, selection, index);
      fragment.append(article);
    });
  }

  elements.commentaryBody.replaceChildren(fragment);
}

function createCommentaryEntryArticle(entry, selection, index) {
  const article = elements.commentaryEntryTemplate.content.firstElementChild.cloneNode(true);
  article.querySelector(".commentary-entry-number").textContent = entry.number || `Entry ${index + 1}`;
  article.querySelector(".commentary-entry-scope").textContent = entry.scope || "";
  setText(article.querySelector(".commentary-entry-arabic-attribution"), entry.arabic_attribution);
  setText(article.querySelector(".commentary-entry-arabic"), entry.arabic);
  setText(article.querySelector(".commentary-entry-persian-attribution"), entry.persian_attribution);
  setText(article.querySelector(".commentary-entry-persian"), entry.persian);
  setText(article.querySelector(".commentary-entry-book"), entry.book);
  setText(article.querySelector(".commentary-entry-references"), entry.references);
  renderSavedTranslation(article, entry.english_translation || "");

  const copyButton = article.querySelector(".entry-copy-button");
  copyButton.addEventListener("click", async () => {
    await copyText(
      formatEntryForCopy(entry, selection),
      "Copied commentary entry.",
    );
  });

  return article;
}

function renderSavedTranslation(article, savedTranslation) {
  const container = article.querySelector(".commentary-entry-saved-translation");
  const text = article.querySelector(".commentary-entry-saved-translation-text");
  if (savedTranslation) {
    text.textContent = savedTranslation;
  } else {
    text.textContent = "No saved English translation yet.";
  }
  container.classList.remove("hidden");
}

function formatCommentarySelectionForCopy(selection) {
  const { chapter, verse } = selection;
  const header = selection.kind === "surah-intro"
    ? [
        `${chapter.transliteration} Introduction (${chapter.name_english})`,
        `Surah: ${chapter.sura}`,
      ].join("\n")
    : [
        `${chapter.transliteration} ${verse.aya} (${chapter.name_english})`,
        `Verse key: ${verse.key}`,
        `Arabic: ${verse.arabic}`,
        `English: ${verse.english}`,
        `Transliteration: ${verse.transliteration_text}`,
      ].join("\n");

  if (!selection.entries.length) {
    return `${header}\n\nCommentary:\n${selection.plain_text || ""}`;
  }

  const body = selection.entries
    .map((entry) => formatEntryForCopy(entry, selection))
    .join("\n\n--------------------\n\n");

  return `${header}\n\n${body}`;
}

function formatEntryForCopy(entry, selection) {
  const { chapter, verse } = selection;
  const parts = selection.kind === "surah-intro"
    ? [
        `${chapter.transliteration} Introduction (${chapter.name_english})`,
        `Surah: ${chapter.sura}`,
      ]
    : [
        `${chapter.transliteration} ${verse.aya} (${chapter.name_english})`,
        `Verse key: ${verse.key}`,
      ];

  if (entry.number) {
    parts.push(`Entry: ${entry.number}`);
  }
  if (entry.scope) {
    parts.push(`Scope: ${entry.scope}`);
  }
  if (entry.arabic_attribution) {
    parts.push(`Arabic attribution: ${entry.arabic_attribution}`);
  }
  if (entry.arabic) {
    parts.push(`Arabic: ${entry.arabic}`);
  }
  if (entry.persian_attribution) {
    parts.push(`Persian attribution: ${entry.persian_attribution}`);
  }
  if (entry.persian) {
    parts.push(`Persian: ${entry.persian}`);
  }
  if (entry.book) {
    parts.push(`Book: ${entry.book}`);
  }
  if (entry.references) {
    parts.push(`References: ${entry.references}`);
  }
  if (entry.english_translation) {
    parts.push(`Saved English translation:\n${entry.english_translation}`);
  }

  return parts.join("\n");
}

async function copyText(text, successMessage) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "absolute";
      textarea.style.left = "-9999px";
      document.body.append(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setStatusMessage(successMessage);
  } catch (error) {
    console.error(error);
    setStatusMessage("Copy failed. Your browser blocked clipboard access.", true);
  }
}

function closeCommentary() {
  state.currentCommentarySelection = null;
  elements.commentaryOverlay.classList.add("hidden");
  elements.commentaryOverlay.setAttribute("aria-hidden", "true");
  elements.commentaryBody.replaceChildren();
  elements.commentaryContext.replaceChildren();
  resetCommentaryScroll();
  document.body.style.overflow = "";
  setStatusMessage("");
}

function resetCommentaryScroll() {
  if (!elements.commentaryPanel) {
    return;
  }
  elements.commentaryPanel.scrollTop = 0;
}

function setText(element, value) {
  element.textContent = value || "";
  element.classList.toggle("hidden", !value);
}

function setStatusMessage(message, isError = false) {
  elements.commentaryStatus.textContent = message;
  elements.commentaryStatus.classList.toggle("hidden", !message);
  elements.commentaryStatus.classList.toggle("error", Boolean(message) && isError);
}

function openSettings() {
  elements.settingsOverlay.classList.remove("hidden");
  elements.settingsOverlay.setAttribute("aria-hidden", "false");
  syncSettingsUI();
  document.body.style.overflow = "hidden";
}

function closeSettings() {
  elements.settingsOverlay.classList.add("hidden");
  elements.settingsOverlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
}

function applySettings() {
  const root = document.documentElement;
  root.style.setProperty("--arabic-font", `"${state.arabicFont}", serif`);
  root.style.setProperty("--arabic-size", ARABIC_SIZES[state.arabicSize]);
  root.style.setProperty("--english-font", `"${state.englishFont}", sans-serif`);
  root.style.setProperty("--english-size", ENGLISH_SIZES[state.englishSize]);
}

function syncSettingsUI() {
  syncSegment(elements.themeOptions, state.theme);
  syncSegment(elements.arabicFontOptions, state.arabicFont);
  syncSegment(elements.arabicSizeOptions, state.arabicSize);
  syncSegment(elements.englishFontOptions, state.englishFont);
  syncSegment(elements.englishSizeOptions, state.englishSize);
}

function bindSegment(container, onChange) {
  container.addEventListener("click", (event) => {
    const button = event.target.closest(".settings-option");
    if (!button) {
      return;
    }
    syncSegment(container, button.dataset.value);
    onChange(button.dataset.value);
  });
}

function syncSegment(container, activeValue) {
  for (const button of container.querySelectorAll(".settings-option")) {
    button.classList.toggle("active", button.dataset.value === activeValue);
  }
}

function readSetting(key, fallback) {
  return window.localStorage.getItem(key) ?? fallback;
}

function persistSetting(key, value) {
  window.localStorage.setItem(key, value);
}

function readToggle(key, fallback) {
  const saved = window.localStorage.getItem(key);
  if (saved === null) {
    return fallback;
  }
  return saved === "true";
}

function persistToggle(key, value) {
  window.localStorage.setItem(key, String(value));
}

function applyToggleState() {
  elements.showTransliteration.checked = state.showTransliteration;
  elements.showEnglish.checked = state.showEnglish;
}

function openVerseNav() {
  closeSettings();
  state.verseNavSelectedSura = state.currentSura;
  state.verseNavSelectedAya = 1;
  state.verseNavSurahQuery = "";
  elements.verseNavSearch.value = "";
  renderVerseNavSurahList(true);
  renderVerseNavAyahList();
  elements.verseNavOverlay.classList.remove("hidden");
  elements.verseNavOverlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  elements.verseNavSearch.focus();
}

function closeVerseNav() {
  elements.verseNavOverlay.classList.add("hidden");
  elements.verseNavOverlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function renderVerseNavSurahList(scrollToActive = false) {
  const chapters = state.manifest?.chapters ?? [];
  const filtered = chapters.filter((c) => matchesChapterSearch(c, state.verseNavSurahQuery));
  const fragment = document.createDocumentFragment();

  for (const chapter of filtered) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "vernav-item";
    if (chapter.sura === state.verseNavSelectedSura) {
      btn.classList.add("active");
    }

    const num = document.createElement("span");
    num.className = "vernav-item-num";
    num.textContent = chapter.sura;

    const main = document.createElement("span");
    main.className = "vernav-item-main";
    main.textContent = chapter.transliteration;

    const sub = document.createElement("span");
    sub.className = "vernav-item-sub";
    sub.textContent = chapter.name_english;
    main.append(sub);

    const arabic = document.createElement("span");
    arabic.className = "vernav-item-arabic";
    arabic.textContent = chapter.name_arabic;

    btn.append(num, main, arabic);
    btn.addEventListener("click", () => {
      state.verseNavSelectedSura = chapter.sura;
      state.verseNavSelectedAya = 1;
      renderVerseNavSurahList();
      renderVerseNavAyahList();
    });
    fragment.append(btn);
  }

  elements.verseNavSurahList.replaceChildren(fragment);

  if (scrollToActive) {
    requestAnimationFrame(() => {
      elements.verseNavSurahList.querySelector(".vernav-item.active")?.scrollIntoView({ block: "nearest" });
    });
  }
}

function renderVerseNavAyahList() {
  if (state.verseNavSelectedSura === null) {
    const p = document.createElement("p");
    p.className = "vernav-empty";
    p.textContent = "Select a surah first";
    elements.verseNavAyahList.replaceChildren(p);
    elements.verseNavGo.disabled = true;
    return;
  }

  const chapter = state.chaptersBySura.get(state.verseNavSelectedSura);
  if (!chapter) return;

  const fragment = document.createDocumentFragment();
  for (let i = 1; i <= chapter.verse_count; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "vernav-ayah-btn";
    if (i === state.verseNavSelectedAya) {
      btn.classList.add("active");
    }
    btn.textContent = i;
    const aya = i;
    btn.addEventListener("click", () => {
      state.verseNavSelectedAya = aya;
      for (const b of elements.verseNavAyahList.querySelectorAll(".vernav-ayah-btn")) {
        b.classList.toggle("active", Number(b.textContent) === aya);
      }
    });
    fragment.append(btn);
  }

  elements.verseNavAyahList.replaceChildren(fragment);
  elements.verseNavGo.disabled = false;

  requestAnimationFrame(() => {
    elements.verseNavAyahList.querySelector(".vernav-ayah-btn.active")?.scrollIntoView({ block: "nearest" });
  });
}

async function navigateToVerse(sura, aya) {
  closeVerseNav();
  if (sura !== state.currentSura) {
    await loadSurah(sura, { revealReader: true });
  } else {
    showCompactReaderView();
  }
  requestAnimationFrame(() => {
    elements.verseList.querySelector(`[data-aya="${aya}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
