const state = {
  manifest: null,
  chaptersBySura: new Map(),
  currentSura: 1,
  currentSurahData: null,
  currentCommentaryVerse: null,
  searchQuery: "",
  showTransliteration: readToggle("showTransliteration", true),
  showEnglish: readToggle("showEnglish", true),
};

const elements = {
  chapterList: document.getElementById("chapterList"),
  chapterSearch: document.getElementById("chapterSearch"),
  reader: document.querySelector(".reader"),
  chapterTitle: document.getElementById("chapterTitle"),
  chapterMeta: document.getElementById("chapterMeta"),
  chapterStats: document.getElementById("chapterStats"),
  basmalahCard: document.getElementById("basmalahCard"),
  verseList: document.getElementById("verseList"),
  prevChapter: document.getElementById("prevChapter"),
  nextChapter: document.getElementById("nextChapter"),
  showTransliteration: document.getElementById("showTransliteration"),
  showEnglish: document.getElementById("showEnglish"),
  commentaryOverlay: document.getElementById("commentaryOverlay"),
  closeCommentary: document.getElementById("closeCommentary"),
  commentaryTitle: document.getElementById("commentaryTitle"),
  commentarySubtitle: document.getElementById("commentarySubtitle"),
  commentaryContext: document.getElementById("commentaryContext"),
  commentaryBody: document.getElementById("commentaryBody"),
  copyVerseCommentary: document.getElementById("copyVerseCommentary"),
  commentaryStatus: document.getElementById("commentaryStatus"),
  chapterItemTemplate: document.getElementById("chapterItemTemplate"),
  verseTemplate: document.getElementById("verseTemplate"),
  commentaryEntryTemplate: document.getElementById("commentaryEntryTemplate"),
};

boot().catch((error) => {
  console.error(error);
  elements.chapterTitle.textContent = "Failed to load reader data";
  elements.chapterMeta.textContent = String(error);
});

async function boot() {
  bindEvents();
  applyToggleState();

  const manifestResponse = await fetch("data/manifest.json");
  state.manifest = await manifestResponse.json();
  state.manifest.chapters.forEach((chapter) => {
    state.chaptersBySura.set(chapter.sura, chapter);
  });

  const hashSura = Number.parseInt(window.location.hash.replace("#", ""), 10);
  if (Number.isInteger(hashSura) && state.chaptersBySura.has(hashSura)) {
    state.currentSura = hashSura;
  }

  renderChapterList();
  await loadSurah(state.currentSura, { revealReader: false });
}

function bindEvents() {
  elements.chapterSearch.addEventListener("input", (event) => {
    state.searchQuery = event.target.value.trim().toLowerCase();
    renderChapterList();
  });

  elements.prevChapter.addEventListener("click", () => {
    if (state.currentSura > 1) {
      loadSurah(state.currentSura - 1, { revealReader: false });
    }
  });

  elements.nextChapter.addEventListener("click", () => {
    if (state.currentSura < 114) {
      loadSurah(state.currentSura + 1, { revealReader: false });
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

  elements.copyVerseCommentary.addEventListener("click", async () => {
    if (!state.currentCommentaryVerse || !state.currentSurahData) {
      return;
    }
    const payload = formatVerseCommentaryForCopy(
      state.currentCommentaryVerse,
      state.currentSurahData.chapter,
    );
    await copyText(payload, "Copied commentary for this verse.");
  });

  elements.closeCommentary.addEventListener("click", closeCommentary);
  elements.commentaryOverlay.addEventListener("click", (event) => {
    if (event.target === elements.commentaryOverlay) {
      closeCommentary();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.commentaryOverlay.classList.contains("hidden")) {
      closeCommentary();
    }
  });

  window.addEventListener("hashchange", () => {
    const hashSura = Number.parseInt(window.location.hash.replace("#", ""), 10);
    if (Number.isInteger(hashSura) && state.chaptersBySura.has(hashSura) && hashSura !== state.currentSura) {
      loadSurah(hashSura, { revealReader: true });
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
  window.location.hash = String(sura);
  updateHeader(chapter, null);
  renderChapterList();

  const response = await fetch(chapter.file);
  state.currentSurahData = await response.json();
  updateHeader(chapter, state.currentSurahData);
  renderVerses();

  if (options.revealReader) {
    revealReaderOnCompactLayout();
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
  elements.basmalahCard.textContent = chapter.display_basmalah || "";
  elements.basmalahCard.classList.toggle("hidden", !chapter.display_basmalah);

  const fragment = document.createDocumentFragment();
  for (const verse of verses) {
    const card = elements.verseTemplate.content.firstElementChild.cloneNode(true);
    card.querySelector(".verse-badge").textContent = verse.aya;
    card.querySelector(".verse-arabic").textContent = verse.arabic;

    const transliterationEl = card.querySelector(".verse-transliteration");
    transliterationEl.innerHTML = verse.transliteration_html;
    transliterationEl.classList.toggle("hidden", !state.showTransliteration);

    const englishEl = card.querySelector(".verse-english");
    englishEl.textContent = verse.english;
    englishEl.classList.toggle("hidden", !state.showEnglish);

    const commentaryButton = card.querySelector(".commentary-trigger");
    if (verse.commentary.has_commentary) {
      commentaryButton.textContent = `Commentary (${verse.commentary.entry_count})`;
      commentaryButton.classList.add("has-commentary");
      commentaryButton.addEventListener("click", () => openCommentary(verse));
    } else {
      commentaryButton.textContent = "No commentary";
      commentaryButton.disabled = true;
    }

    fragment.append(card);
  }

  elements.verseList.replaceChildren(fragment);
}

function revealReaderOnCompactLayout() {
  if (!elements.reader || !window.matchMedia("(max-width: 1080px)").matches) {
    return;
  }

  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";

  window.requestAnimationFrame(() => {
    elements.reader.scrollIntoView({
      behavior,
      block: "start",
    });
  });
}

function openCommentary(verse) {
  if (!state.currentSurahData) {
    return;
  }

  state.currentCommentaryVerse = verse;
  const chapter = state.currentSurahData.chapter;
  elements.commentaryTitle.textContent = `${chapter.transliteration} ${verse.aya}`;
  elements.commentarySubtitle.textContent = `${chapter.name_english} - ${chapter.name_arabic}`;
  renderCommentaryContext(verse);
  renderCommentaryEntries(verse);
  setStatusMessage("");

  elements.commentaryOverlay.classList.remove("hidden");
  elements.commentaryOverlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function renderCommentaryContext(verse) {
  const context = document.createElement("div");
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

  elements.commentaryContext.replaceChildren(context);
}

function renderCommentaryEntries(verse) {
  const fragment = document.createDocumentFragment();
  const chapter = state.currentSurahData?.chapter;

  if (!chapter) {
    return;
  }

  if (verse.commentary.entries.length === 0) {
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
        formatVerseCommentaryForCopy(verse, chapter),
        "Copied commentary for this verse.",
      );
    });
    actions.append(copyButton);

    const plain = document.createElement("p");
    plain.className = "commentary-entry-persian";
    plain.textContent = verse.commentary.plain_text;

    fallback.append(actions, plain);
    fragment.append(fallback);
  } else {
    verse.commentary.entries.forEach((entry, index) => {
      const article = createCommentaryEntryArticle(entry, verse, chapter, index);
      fragment.append(article);
    });
  }

  elements.commentaryBody.replaceChildren(fragment);
}

function createCommentaryEntryArticle(entry, verse, chapter, index) {
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
      formatEntryForCopy(entry, verse, chapter),
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

function formatVerseCommentaryForCopy(verse, chapter) {
  const header = [
    `${chapter.transliteration} ${verse.aya} (${chapter.name_english})`,
    `Verse key: ${verse.key}`,
    `Arabic: ${verse.arabic}`,
    `English: ${verse.english}`,
    `Transliteration: ${verse.transliteration_text}`,
  ].join("\n");

  if (!verse.commentary.entries.length) {
    return `${header}\n\nCommentary:\n${verse.commentary.plain_text}`;
  }

  const body = verse.commentary.entries
    .map((entry) => formatEntryForCopy(entry, verse, chapter))
    .join("\n\n--------------------\n\n");

  return `${header}\n\n${body}`;
}

function formatEntryForCopy(entry, verse, chapter) {
  const parts = [
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
  state.currentCommentaryVerse = null;
  elements.commentaryOverlay.classList.add("hidden");
  elements.commentaryOverlay.setAttribute("aria-hidden", "true");
  elements.commentaryBody.replaceChildren();
  elements.commentaryContext.replaceChildren();
  document.body.style.overflow = "";
  setStatusMessage("");
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
