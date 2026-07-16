const builtInRecipes = window.RECIPES || [];
const moods = window.MOODS || [];

const recipeGrid = document.querySelector("#recipeGrid");
const moodGrid = document.querySelector("#moodGrid");
const searchForm = document.querySelector("#searchForm");
const searchInput = document.querySelector("#searchInput");
const clearFilters = document.querySelector("#clearFilters");
const resultsTitle = document.querySelector("#resultsTitle");
const resultsEyebrow = document.querySelector("#resultsEyebrow");
const resultsNote = document.querySelector("#resultsNote");
const emptyState = document.querySelector("#emptyState");
const recipePage = document.querySelector("#recipePage");
const homeSections = [...document.querySelectorAll("main > section:not(#recipePage)")];
const quickAddDock = document.querySelector("#quickAddDock");
const recipeDialog = document.querySelector("#recipeDialog");
const dialogContent = document.querySelector("#dialogContent");
const closeDialog = document.querySelector("#closeDialog");
const favoritesButton = document.querySelector("#favoritesButton");
const favoriteCount = document.querySelector("#favoriteCount");
const installButton = document.querySelector("#installButton");
const addRecipeMenuButton = document.querySelector("#addRecipeMenuButton");
const clipboardAddButton = document.querySelector("#clipboardAddButton");
const manualAddButton = document.querySelector("#manualAddButton");
const addRecipeOptionsDialog = document.querySelector("#addRecipeOptionsDialog");
const closeAddOptionsDialog = document.querySelector("#closeAddOptionsDialog");
const addRecipeDialog = document.querySelector("#addRecipeDialog");
const addRecipeForm = document.querySelector("#addRecipeForm");
const recipeText = document.querySelector("#recipeText");
const closeAddDialog = document.querySelector("#closeAddDialog");
const pasteIntoEditorButton = document.querySelector("#pasteIntoEditorButton");
const toast = document.querySelector("#toast");
const transferRecipesButton = document.querySelector("#transferRecipesButton");
const backupDialog = document.querySelector("#backupDialog");
const closeBackupDialog = document.querySelector("#closeBackupDialog");
const backupSummary = document.querySelector("#backupSummary");
const exportBackupButton = document.querySelector("#exportBackupButton");
const importBackupButton = document.querySelector("#importBackupButton");
const backupFileInput = document.querySelector("#backupFileInput");

const USER_RECIPES_KEY = "dobreJedzenieUserRecipes";
let currentQuery = "";
let favoritesOnly = false;
let deferredPrompt = null;
let toastTimer = null;
let lastHomeScrollY = 0;
let favorites = new Set(JSON.parse(localStorage.getItem("dobreJedzenieFavorites") || "[]"));
let userRecipes = loadUserRecipes();
let recipes = [...userRecipes, ...builtInRecipes];

function loadUserRecipes() {
  try {
    const parsed = JSON.parse(localStorage.getItem(USER_RECIPES_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveUserRecipes() {
  localStorage.setItem(USER_RECIPES_KEY, JSON.stringify(userRecipes));
  recipes = [...userRecipes, ...builtInRecipes];
}

function cleanMalformedLocalRecipes() {
  const before = userRecipes.length;
  const removedIds = new Set(userRecipes.filter(isMalformedSavedRecipe).map((recipe) => recipe.id));
  if (!removedIds.size) return 0;

  userRecipes = userRecipes.filter((recipe) => !removedIds.has(recipe.id));
  removedIds.forEach((id) => favorites.delete(id));
  saveFavorites();
  saveUserRecipes();
  return before - userRecipes.length;
}


function updateBackupSummary() {
  const favoriteLabel = favorites.size === 1 ? "1 ulubiony" : `${favorites.size} ulubionych`;
  const recipeLabel = userRecipes.length === 1 ? "1 własny przepis" : `${userRecipes.length} własnych przepisów`;
  backupSummary.textContent = `Do przeniesienia: ${recipeLabel} i ${favoriteLabel}.`;
}

function createBackupPayload() {
  return {
    format: "dobre-jedzenie-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    userRecipes,
    favorites: [...favorites]
  };
}

function getBackupFilename() {
  const date = new Date().toISOString().slice(0, 10);
  return `dobre-jedzenie-kopia-${date}.json`;
}

async function exportBackup() {
  const data = JSON.stringify(createBackupPayload(), null, 2);
  const file = new File([data], getBackupFilename(), { type: "application/json" });

  try {
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "Kopia przepisów Dobre Jedzenie",
        text: "Zapisz ten plik, aby odtworzyć przepisy na nowym telefonie."
      });
      showToast("Kopia jest gotowa. Zapisz ją w bezpiecznym miejscu.");
      return;
    }
  } catch (error) {
    if (error?.name === "AbortError") return;
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("Pobrano kopię przepisów.");
}

function validateBackup(payload) {
  if (!payload || payload.format !== "dobre-jedzenie-backup") {
    throw new Error("To nie jest kopia z aplikacji Dobre Jedzenie.");
  }
  if (!Array.isArray(payload.userRecipes) || !Array.isArray(payload.favorites)) {
    throw new Error("Plik kopii jest uszkodzony albo niepełny.");
  }
  return payload;
}

async function importBackupFile(file) {
  if (!file) return;
  const text = await file.text();
  let payload;
  try {
    payload = validateBackup(JSON.parse(text));
  } catch (error) {
    throw new Error(error.message || "Nie udało się odczytać kopii.");
  }

  if (userRecipes.length || favorites.size) {
    const approved = window.confirm(
      "Wczytanie kopii zastąpi własne przepisy i ulubione zapisane teraz na tym telefonie. Kontynuować?"
    );
    if (!approved) return;
  }

  userRecipes = payload.userRecipes.map((recipe) => ({ ...recipe, isUser: true }));
  favorites = new Set(payload.favorites);
  saveUserRecipes();
  saveFavorites();
  currentQuery = "";
  favoritesOnly = false;
  searchInput.value = "";
  renderRecipes();
  updateBackupSummary();
  backupDialog.close();
  showToast(`Przywrócono ${userRecipes.length} ${userRecipes.length === 1 ? "przepis" : "przepisów"}.`);
  document.querySelector(".results-section").scrollIntoView({ behavior: "smooth", block: "start" });
}

const normalise = (value = "") =>
  String(value)
    .toLocaleLowerCase("pl")
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const PROMPT_MARKERS = [
  "dzialasz jako", "twoim zadaniem", "zadanie:", "zasady nowego designu",
  "ui/ux", "frontend developer", "paleta kolorow", "typografia:",
  "komponenty i uklad", "responsywnosc:", "zachowaj pelna funkcjonalnosc",
  "przeprojektowac wizualnie", "wariant b", "editorial premium"
];

function countPromptMarkers(value = "") {
  const raw = normalise(value);
  return PROMPT_MARKERS.filter((marker) => raw.includes(marker)).length;
}

function hasRecipeSections(value = "") {
  const raw = normalise(value);
  const hasIngredients = /(^|\n)\s*(skladniki|potrzebujesz|produkty)\s*:?/m.test(raw);
  const hasSteps = /(^|\n)\s*(przygotowanie|wykonanie|sposob przygotowania|instrukcja|po kolei)\s*:?/m.test(raw);
  return hasIngredients && hasSteps;
}

function countIngredientLikeLines(value = "") {
  const unitPattern = /\b(\d+[,.]?\d*\s*(g|kg|ml|l|lyzka|lyzeczka|szklanka|szt|opak)|garsc|szczypta)\b/i;
  return String(value).split(/\n/).filter((line) => unitPattern.test(normalise(line))).length;
}

function countStepLikeLines(value = "") {
  return String(value).split(/\n/).filter((line) => /^\s*\d+[.)]\s+/.test(line)).length;
}

function isClearlyNotARecipe(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return true;
  if (countPromptMarkers(raw) >= 2) return true;
  if (hasRecipeSections(raw)) return false;
  return countIngredientLikeLines(raw) < 2 || countStepLikeLines(raw) < 2;
}

function isMalformedSavedRecipe(recipe) {
  if (!recipe?.isUser) return false;
  const original = recipe.originalText || "";
  const hasPlaceholder = Array.isArray(recipe.ingredients) && recipe.ingredients.some((item) =>
    normalise(item).startsWith("skladniki sa zapisane w tresci przepisu")
  );
  return countPromptMarkers(original) >= 2 || (hasPlaceholder && isClearlyNotARecipe(original));
}

function showToast(message, actionLabel = "", action = null) {
  clearTimeout(toastTimer);
  toast.innerHTML = `<span>${escapeHtml(message)}</span>${actionLabel ? `<button type="button">${escapeHtml(actionLabel)}</button>` : ""}`;
  toast.classList.remove("hidden");
  if (actionLabel && action) {
    toast.querySelector("button").addEventListener("click", () => {
      action();
      toast.classList.add("hidden");
    }, { once: true });
  }
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 4600);
}

function stripListPrefix(line) {
  return line
    .replace(/^#{1,6}\s*/, "")
    .replace(/^[-–—•*]\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .trim();
}

function inferCategory(text) {
  const value = normalise(text);
  if (/ciasto|sernik|tort|brownie|drozdz|deser|mus|lody|panna cotta|rafaello|muffin/.test(value)) return "deser";
  if (/sniad|jajeczn|omlet|owsiank/.test(value)) return "śniadanie";
  if (/kolac|salatka|salat|twarozek/.test(value)) return "kolacja";
  return "obiad";
}

function inferEmoji(text, category) {
  const value = normalise(text);
  if (/czekol|brownie|kakao/.test(value)) return "🍫";
  if (/kokos|rafaello/.test(value)) return "🥥";
  if (/truskaw|malin|porzecz/.test(value)) return "🍓";
  if (/sernik|ciasto|drozdz|tort/.test(value)) return "🍰";
  if (/salat/.test(value)) return "🥗";
  if (/kurcz/.test(value)) return "🍗";
  if (/ryb|losos/.test(value)) return "🐟";
  if (/jaj|omlet/.test(value)) return "🍳";
  return category === "deser" ? "🍮" : category === "śniadanie" ? "🥣" : category === "kolacja" ? "🥗" : "🍽️";
}

function inferTags(text, category, time) {
  const value = normalise(text);
  const tags = [category, "własny przepis"];
  if (time <= 15) tags.push("do 15 minut");
  else if (time <= 30) tags.push("do 30 minut");
  if (/bez pieczenia|schlodz|lodowk/.test(value)) tags.push("bez pieczenia");
  if (/piec|piekarnik/.test(value)) tags.push("pieczone");
  if (/czekol|kakao/.test(value)) tags.push("czekoladowe");
  if (/kokos|rafaello/.test(value)) tags.push("kokosowe");
  if (/ciasto|sernik|tort|brownie|drozdz/.test(value)) tags.push("ciasto");
  if (/mascarpone|smietank|krem/.test(value)) tags.push("kremowe");
  return [...new Set(tags)].slice(0, 7);
}

function parseRecipeText(rawText) {
  const raw = String(rawText || "").replace(/\r/g, "").trim();
  if (!raw) throw new Error("Schowek jest pusty.");
  if (isClearlyNotARecipe(raw)) {
    throw new Error("To nie wygląda jak kompletny przepis. Potrzebne są składniki i sposób przygotowania.");
  }

  const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error("To za mało tekstu, żeby utworzyć przepis.");

  const headingPattern = /^(skladniki|składniki|potrzebujesz|produkty)(\s*:)?$/i;
  const stepsPattern = /^(przygotowanie|wykonanie|sposob przygotowania|sposób przygotowania|instrukcja|po kolei)(\s*:)?$/i;
  const ingredientsIndex = lines.findIndex((line) => headingPattern.test(stripListPrefix(line)));
  const stepsIndex = lines.findIndex((line) => stepsPattern.test(stripListPrefix(line)));

  let title = stripListPrefix(lines[0]).replace(/^przepis\s*:\s*/i, "").trim();
  if (headingPattern.test(title) || stepsPattern.test(title)) title = "Mój przepis";

  let ingredients = [];
  let steps = [];

  if (ingredientsIndex >= 0 && stepsIndex > ingredientsIndex) {
    ingredients = lines.slice(ingredientsIndex + 1, stepsIndex).map(stripListPrefix).filter(Boolean);
    steps = lines.slice(stepsIndex + 1).map(stripListPrefix).filter(Boolean);
  } else {
    const numberedStepIndex = lines.findIndex((line, index) => index > 0 && /^\d+[.)]\s+/.test(line));
    if (numberedStepIndex > 1) {
      ingredients = lines.slice(1, numberedStepIndex).map(stripListPrefix).filter(Boolean);
      steps = lines.slice(numberedStepIndex).map(stripListPrefix).filter(Boolean);
    } else {
      const likelyIngredient = /\b(\d+[,.]?\d*\s*(g|kg|ml|l|lyzka|łyżka|lyzeczka|łyżeczka|szklanka|szt|opak)|garść|szczypta)\b/i;
      const rest = lines.slice(1);
      ingredients = rest.filter((line) => likelyIngredient.test(normalise(line))).map(stripListPrefix);
      steps = rest.filter((line) => !likelyIngredient.test(normalise(line))).map(stripListPrefix);
    }
  }

  if (!ingredients.length) ingredients = ["Składniki są zapisane w treści przepisu. Otwórz przepis i popraw później, jeśli trzeba."];
  if (!steps.length) steps = lines.slice(1).map(stripListPrefix).filter(Boolean);

  const timeMatch = normalise(raw).match(/(\d{1,3})\s*(minut|min)/);
  const time = timeMatch ? Math.max(1, Number(timeMatch[1])) : 20;
  const category = inferCategory(`${title} ${raw}`);
  const tags = inferTags(`${title} ${raw}`, category, time);

  return {
    id: `wlasny-${Date.now()}`,
    title: title || "Mój przepis",
    category,
    emoji: inferEmoji(`${title} ${raw}`, category),
    time,
    difficulty: "łatwy",
    tone: category === "deser" ? ["#F2D4C9", "#C9856E"] : category === "kolacja" ? ["#D9E2D4", "#8FA18E"] : ["#EBD7C1", "#C78B64"],
    summary: "Własny przepis dodany jednym kliknięciem.",
    tags,
    ingredients,
    steps,
    tip: "To Twój własny przepis. W razie potrzeby można go usunąć i wkleić ponownie po poprawkach.",
    isUser: true,
    originalText: raw
  };
}

function addRecipeFromText(text) {
  const recipe = parseRecipeText(text);
  userRecipes.unshift(recipe);
  saveUserRecipes();
  currentQuery = "";
  favoritesOnly = false;
  renderRecipes();
  showToast(`Dodano: ${recipe.title}`, "Cofnij", () => deleteUserRecipe(recipe.id, false));
  return recipe;
}

function deleteUserRecipe(id, notify = true) {
  const recipe = userRecipes.find((item) => item.id === id);
  userRecipes = userRecipes.filter((item) => item.id !== id);
  favorites.delete(id);
  saveFavorites();
  saveUserRecipes();
  renderRecipes();
  if (notify && recipe) showToast(`Usunięto: ${recipe.title}`);
}

function recipeSearchCore(recipe) {
  const title = normalise(recipe.title);
  const category = normalise(recipe.category);
  const tags = (recipe.tags || []).map((tag) => normalise(tag));
  const titleWords = new Set(title.split(/[^a-z0-9]+/).filter(Boolean));
  const tagWords = new Set(tags.flatMap((tag) => tag.split(/[^a-z0-9]+/).filter(Boolean)));
  return { title, category, tags, titleWords, tagWords };
}

function normaliseSearchToken(token) {
  if (/^kokos/.test(token)) return "kokosowe";
  if (/^czekol/.test(token) || token === "kakao") return "czekoladowe";
  if (/^chalka/.test(token)) return "chalka";
  if (/^chleb/.test(token) || /^pieczyw/.test(token) || /^bochenk/.test(token)) return "chleb";
  if (/^kurcz/.test(token)) return "kurczak";
  if (/^sernik/.test(token)) return "sernik";
  if (/^drozdz/.test(token)) return "drozdzowe";
  if (/^kolac/.test(token)) return "kolacja";
  if (/^sniad/.test(token)) return "sniadanie";
  if (/^obiad/.test(token)) return "obiad";
  if (/^deser/.test(token)) return "deser";
  if (/^owoc/.test(token)) return "owoce";
  return token;
}

function buildSearchCriteria(query) {
  let value = normalise(query).trim();
  const criteria = [];

  const addTag = (tag) => criteria.push({ type: "tag", value: normalise(tag) });
  const phraseTags = [
    ["bez pieczenia", "bez pieczenia"],
    ["na gosci", "na gosci"],
    ["lekka kolacja", "lekka kolacja"],
    ["jedna patelnia", "jedna patelnia"],
    ["na weekend", "na weekend"]
  ];

  phraseTags.forEach(([phrase, tag]) => {
    if (value.includes(phrase)) {
      addTag(tag);
      value = value.replaceAll(phrase, " ");
    }
  });

  const timeMatch = value.match(/do\s*(\d{1,3})\s*(minut|min)/);
  if (timeMatch) {
    criteria.push({ type: "maxTime", value: Number(timeMatch[1]) });
    value = value.replace(timeMatch[0], " ");
  }

  const stopWords = new Set([
    "cos", "czegos", "chce", "mam", "ochote", "potrzebuje", "prosze", "zrob",
    "danie", "przepis", "jakies", "jakiegos", "dzis", "dzisiaj", "na", "z",
    "i", "albo", "oraz", "mi", "poprosze"
  ]);

  value
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !stopWords.has(token))
    .map(normaliseSearchToken)
    .forEach((token) => {
      if (token === "ciasto" || token === "ciasta" || token === "tort" || token === "brownie" || token === "biszkopt") {
        criteria.push({ type: "cake", value: "ciasto" });
      } else if (token === "deser") {
        criteria.push({ type: "dessert", value: "deser" });
      } else if (["sniadanie", "obiad", "kolacja"].includes(token)) {
        criteria.push({ type: "category", value: token });
      } else if (token === "chalka") {
        criteria.push({ type: "exact", value: "chalka" });
      } else if (token === "chleb") {
        criteria.push({ type: "tag", value: "chleb" });
      } else if (token === "kokosowe" || token === "czekoladowe" || token === "drozdzowe") {
        criteria.push({ type: "tag", value: token });
      } else {
        criteria.push({ type: "term", value: token });
      }
    });

  const unique = new Map();
  criteria.forEach((criterion) => unique.set(`${criterion.type}:${criterion.value}`, criterion));
  return [...unique.values()];
}

function criterionMatches(recipe, criterion) {
  const core = recipeSearchCore(recipe);

  if (criterion.type === "maxTime") return Number(recipe.time) <= criterion.value;
  if (criterion.type === "category") return core.category === criterion.value;
  if (criterion.type === "dessert") {
    const isCake = core.tags.includes("ciasto") || ["sernik", "tort", "brownie", "biszkopt", "chalka", "drozdzowki"].some((word) => core.titleWords.has(word));
    return core.category === "deser" && !isCake;
  }
  if (criterion.type === "tag") return core.tags.includes(criterion.value);

  if (criterion.type === "cake") {
    return core.tags.includes("ciasto") || ["sernik", "tort", "brownie", "biszkopt"].some((word) => core.titleWords.has(word));
  }

  if (criterion.type === "exact") {
    return core.titleWords.has(criterion.value) || core.tags.includes(criterion.value);
  }

  return core.titleWords.has(criterion.value) || core.tagWords.has(criterion.value) || core.tags.includes(criterion.value);
}

function scoreRecipe(recipe, query) {
  if (!query.trim()) return 1;
  const criteria = buildSearchCriteria(query);
  if (!criteria.length) return 0;
  if (!criteria.every((criterion) => criterionMatches(recipe, criterion))) return 0;

  const core = recipeSearchCore(recipe);
  return criteria.reduce((score, criterion) => {
    if (criterion.type === "exact" && core.titleWords.has(criterion.value)) return score + 12;
    if (criterion.type === "tag" && core.tags.includes(criterion.value)) return score + 8;
    if (criterion.type === "term" && core.titleWords.has(criterion.value)) return score + 6;
    if (criterion.type === "category" || criterion.type === "dessert") return score + 4;
    if (criterion.type === "maxTime") return score + 2;
    return score + 3;
  }, 0);
}

function getVisibleRecipes() {
  let list = recipes.map((recipe) => ({ recipe, score: scoreRecipe(recipe, currentQuery) }));
  if (favoritesOnly) list = list.filter(({ recipe }) => favorites.has(recipe.id));
  else if (currentQuery.trim()) list = list.filter(({ score }) => score > 0);
  return list.sort((a, b) => b.score - a.score || a.recipe.time - b.recipe.time).map(({ recipe }) => recipe);
}

function saveFavorites() {
  localStorage.setItem("dobreJedzenieFavorites", JSON.stringify([...favorites]));
  favoriteCount.textContent = favorites.size;
}

function toggleFavorite(id) {
  favorites.has(id) ? favorites.delete(id) : favorites.add(id);
  saveFavorites();
  renderRecipes();
  if (getRecipeIdFromHash() === id) renderRecipePage(id, false);
}

function renderMoods() {
  moodGrid.innerHTML = moods.map((mood, index) => `
    <button class="editorial-pick" type="button" data-query="${escapeHtml(mood.query)}">
      <span class="editorial-index">${String(index + 1).padStart(2, "0")}</span>
      <span class="editorial-copy">
        <span class="editorial-label">Kierunek</span>
        <span class="editorial-title">${escapeHtml(mood.name)}</span>
        <span class="editorial-desc">${escapeHtml(mood.desc)}</span>
      </span>
      <span class="editorial-arrow" aria-hidden="true">↗</span>
    </button>
  `).join("");
}

function renderRecipes() {
  const visible = getVisibleRecipes();
  recipeGrid.innerHTML = visible.map((recipe) => `
    <article class="recipe-card" role="button" tabindex="0" data-open="${escapeHtml(recipe.id)}" aria-label="Otwórz przepis: ${escapeHtml(recipe.title)}" style="--tone-1:${escapeHtml(recipe.tone[0])}; --tone-2:${escapeHtml(recipe.tone[1])}">
      <div class="recipe-visual">
        <span class="recipe-emoji" aria-hidden="true">${escapeHtml(recipe.emoji)}</span>
        <button class="favorite-toggle ${favorites.has(recipe.id) ? "saved" : ""}" type="button" data-favorite="${escapeHtml(recipe.id)}"
          aria-label="${favorites.has(recipe.id) ? "Usuń z ulubionych" : "Dodaj do ulubionych"}">${favorites.has(recipe.id) ? "♥" : "♡"}</button>
      </div>
      <div class="recipe-body">
        <div class="recipe-tags">${recipe.tags.slice(0, 3).map((tag) => `<span class="recipe-tag">${escapeHtml(tag)}</span>`).join("")}</div>
        <h3>${escapeHtml(recipe.title)}</h3>
        <p>${escapeHtml(recipe.summary)}</p>
        <div class="recipe-meta"><span>⏱ ${escapeHtml(recipe.time)} min</span><span>• ${escapeHtml(recipe.difficulty)}</span></div>
        <button class="open-recipe" type="button" data-open="${escapeHtml(recipe.id)}">Pokaż przepis</button>
      </div>
    </article>
  `).join("");

  recipeGrid.classList.toggle("hidden", visible.length === 0);
  emptyState.classList.toggle("hidden", visible.length !== 0);
  clearFilters.classList.toggle("hidden", !currentQuery && !favoritesOnly);
  favoritesButton.classList.toggle("active", favoritesOnly);

  if (favoritesOnly) {
    resultsEyebrow.textContent = "Twoja półka";
    resultsTitle.textContent = "Ulubione przepisy";
    resultsNote.textContent = favorites.size ? "Rzeczy, do których warto wracać." : "Jeszcze nic tu nie ma. Serca na kartach czekają.";
  } else if (currentQuery) {
    resultsEyebrow.textContent = "Wyniki";
    resultsTitle.textContent = `Dla: „${currentQuery}”`;
    resultsNote.textContent = visible.length ? `Znaleziono ${visible.length} ${visible.length === 1 ? "propozycję" : "propozycji"}.` : "Nie znalazłam sensownego dopasowania.";
  } else {
    resultsEyebrow.textContent = "Wybrane dla Ciebie";
    resultsTitle.textContent = userRecipes.length ? "Twoje przepisy i pewniaki" : "Pewniaki na dobry początek";
    resultsNote.textContent = userRecipes.length ? "Najnowsze własne przepisy są zawsze na początku." : "Proste składniki, mało ceremonii, dużo smaku.";
  }
}

function getRecipeIdFromHash() {
  const match = window.location.hash.match(/^#\/recipe\/(.+)$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function renderRecipePage(id, scrollToTop = true) {
  const recipe = recipes.find((item) => item.id === id);
  if (!recipe) {
    window.location.hash = "#/";
    return;
  }

  homeSections.forEach((section) => section.classList.add("hidden"));
  recipePage.classList.remove("hidden");
  quickAddDock.classList.add("hidden");

  recipePage.innerHTML = `
    <div class="recipe-page-toolbar">
      <button class="recipe-back-button" type="button" data-back-home>← Wróć do przepisów</button>
      <button class="recipe-page-favorite ${favorites.has(recipe.id) ? "saved" : ""}" type="button" data-favorite="${escapeHtml(recipe.id)}">
        ${favorites.has(recipe.id) ? "♥ W ulubionych" : "♡ Dodaj do ulubionych"}
      </button>
    </div>

    <article class="recipe-page-article">
      <div class="recipe-page-cover" style="--tone-1:${escapeHtml(recipe.tone[0])}; --tone-2:${escapeHtml(recipe.tone[1])}">
        <span aria-hidden="true">${escapeHtml(recipe.emoji)}</span>
      </div>

      <header class="recipe-page-header">
        <p class="eyebrow">${escapeHtml(recipe.category)} · ${escapeHtml(recipe.time)} min · ${escapeHtml(recipe.difficulty)}</p>
        <h1>${escapeHtml(recipe.title)}</h1>
        <p class="recipe-page-lead">${escapeHtml(recipe.summary)}</p>
        <div class="recipe-page-tags">
          ${recipe.tags.slice(0, 5).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
        </div>
      </header>

      <div class="recipe-page-columns">
        <section class="recipe-page-section ingredients-section">
          <p class="recipe-section-number">01</p>
          <h2>Składniki</h2>
          <ul class="ingredient-list">
            ${recipe.ingredients.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </section>

        <section class="recipe-page-section steps-section">
          <p class="recipe-section-number">02</p>
          <h2>Przygotowanie</h2>
          <ol class="step-list">
            ${recipe.steps.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ol>
        </section>
      </div>

      ${recipe.whyItWorks?.length ? `
        <section class="recipe-insight-section">
          <div class="recipe-insight-heading">
            <p class="recipe-section-number">03</p>
            <h2>Co daje co</h2>
            <p>Krótka technologia przepisu, żeby można było świadomie wybierać warianty zamiast zgadywać.</p>
          </div>
          <div class="recipe-insight-grid">
            ${recipe.whyItWorks.map((item) => `
              <article class="recipe-insight-card">
                <h3>${escapeHtml(item.title)}</h3>
                <p>${escapeHtml(item.text)}</p>
              </article>`).join("")}
          </div>
        </section>` : ""}

      ${recipe.variants?.length ? `
        <section class="recipe-variants-section">
          <div class="recipe-insight-heading">
            <p class="recipe-section-number">04</p>
            <h2>Warianty</h2>
          </div>
          <div class="recipe-variants-list">
            ${recipe.variants.map((item) => `
              <article>
                <h3>${escapeHtml(item.title)}</h3>
                <p>${escapeHtml(item.text)}</p>
              </article>`).join("")}
          </div>
        </section>` : ""}

      <aside class="recipe-page-tip">
        <span>Ważny drobiazg</span>
        <p>${escapeHtml(recipe.tip)}</p>
      </aside>

      ${recipe.sourceNote ? `<aside class="recipe-source-note"><strong>O recepturze</strong><p>${escapeHtml(recipe.sourceNote)}</p>${recipe.sourceUrl ? `<a class="recipe-source-link" href="${escapeHtml(recipe.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(recipe.sourceLabel || "Zobacz źródło")} ↗</a>` : ""}</aside>` : ""}

      ${recipe.isUser ? `<button class="delete-recipe-button" type="button" data-delete="${escapeHtml(recipe.id)}">Usuń ten przepis</button>` : ""}
    </article>`;

  document.title = `${recipe.title} · Dobre Jedzenie`;
  if (scrollToTop) window.scrollTo({ top: 0, behavior: "instant" });
}

function showHomeView(restoreScroll = true) {
  recipePage.classList.add("hidden");
  recipePage.innerHTML = "";
  homeSections.forEach((section) => section.classList.remove("hidden"));
  quickAddDock.classList.remove("hidden");
  document.title = "Dobre Jedzenie";
  if (restoreScroll) requestAnimationFrame(() => window.scrollTo({ top: lastHomeScrollY, behavior: "instant" }));
}

function handleRoute() {
  const recipeId = getRecipeIdFromHash();
  if (recipeId) renderRecipePage(recipeId);
  else showHomeView();
}

function showRecipe(id) {
  const recipe = recipes.find((item) => item.id === id);
  if (!recipe) return;
  lastHomeScrollY = window.scrollY;
  const targetHash = `#/recipe/${encodeURIComponent(id)}`;
  if (window.location.hash === targetHash) renderRecipePage(id);
  else window.location.hash = targetHash;
}

function applyQuery(query) {
  currentQuery = query.trim();
  favoritesOnly = false;
  searchInput.value = currentQuery;
  renderRecipes();
  document.querySelector(".results-section").scrollIntoView({ behavior: "smooth", block: "start" });
}

searchForm.addEventListener("submit", (event) => { event.preventDefault(); applyQuery(searchInput.value); });
document.addEventListener("click", (event) => {
  const favorite = event.target.closest("[data-favorite]");
  if (favorite) {
    event.preventDefault();
    event.stopPropagation();
    toggleFavorite(favorite.dataset.favorite);
    return;
  }

  const deleteButton = event.target.closest("[data-delete]");
  if (deleteButton) {
    event.preventDefault();
    event.stopPropagation();
    const id = deleteButton.dataset.delete;
    if (recipeDialog?.open) recipeDialog.close();
    deleteUserRecipe(id);
    if (getRecipeIdFromHash() === id) window.location.hash = "#/";
    return;
  }

  const backHome = event.target.closest("[data-back-home]");
  if (backHome) {
    event.preventDefault();
    window.location.hash = "#/";
    return;
  }

  const mood = event.target.closest("[data-query]");
  if (mood) { applyQuery(mood.dataset.query); return; }

  const chip = event.target.closest("[data-filter]");
  if (chip) { applyQuery(chip.dataset.filter); return; }

  const open = event.target.closest("[data-open]");
  if (open) showRecipe(open.dataset.open);
});

document.addEventListener("keydown", (event) => {
  const card = event.target.closest?.(".recipe-card[data-open]");
  if (!card || event.target.closest("button")) return;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    showRecipe(card.dataset.open);
  }
});

clearFilters.addEventListener("click", () => { currentQuery = ""; favoritesOnly = false; searchInput.value = ""; renderRecipes(); });
favoritesButton.addEventListener("click", () => {
  favoritesOnly = !favoritesOnly;
  currentQuery = "";
  searchInput.value = "";
  renderRecipes();
  lastHomeScrollY = 0;
  if (window.location.hash !== "#/") window.location.hash = "#/";
  else showHomeView(false);
  requestAnimationFrame(() => document.querySelector(".results-section").scrollIntoView({ behavior: "smooth", block: "start" }));
});
closeDialog.addEventListener("click", () => {
  if (typeof recipeDialog.close === "function" && recipeDialog.open) recipeDialog.close();
  else { recipeDialog.removeAttribute("open"); recipeDialog.classList.remove("dialog-fallback-open"); }
});
recipeDialog.addEventListener("click", (event) => {
  const rect = recipeDialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
    if (typeof recipeDialog.close === "function" && recipeDialog.open) recipeDialog.close();
    else { recipeDialog.removeAttribute("open"); recipeDialog.classList.remove("dialog-fallback-open"); }
  }
});

async function readClipboard() {
  if (!navigator.clipboard?.readText) throw new Error("Przeglądarka nie pozwala odczytać schowka.");
  return navigator.clipboard.readText();
}

addRecipeMenuButton.addEventListener("click", () => {
  addRecipeOptionsDialog.showModal();
});
closeAddOptionsDialog.addEventListener("click", () => addRecipeOptionsDialog.close());
addRecipeOptionsDialog.addEventListener("click", (event) => {
  const rect = addRecipeOptionsDialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) addRecipeOptionsDialog.close();
});

clipboardAddButton.addEventListener("click", async () => {
  clipboardAddButton.disabled = true;
  try {
    const text = await readClipboard();
    addRecipeFromText(text);
    addRecipeOptionsDialog.close();
    document.querySelector(".results-section").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    addRecipeOptionsDialog.close();
    recipeText.value = "";
    addRecipeDialog.showModal();
    showToast(error.message || "Nie udało się odczytać przepisu. Wklej go ręcznie.");
  } finally {
    clipboardAddButton.disabled = false;
  }
});

manualAddButton.addEventListener("click", () => { addRecipeOptionsDialog.close(); recipeText.value = ""; addRecipeDialog.showModal(); recipeText.focus(); });
closeAddDialog.addEventListener("click", () => addRecipeDialog.close());
pasteIntoEditorButton.addEventListener("click", async () => {
  try { recipeText.value = await readClipboard(); recipeText.focus(); }
  catch (error) { showToast(error.message || "Nie udało się odczytać schowka."); }
});
addRecipeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    const recipe = addRecipeFromText(recipeText.value);
    addRecipeDialog.close();
    recipeText.value = "";
    showRecipe(recipe.id);
  } catch (error) {
    showToast(error.message || "Nie udało się utworzyć przepisu.");
  }
});
addRecipeDialog.addEventListener("click", (event) => {
  const rect = addRecipeDialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) addRecipeDialog.close();
});


transferRecipesButton.addEventListener("click", () => {
  updateBackupSummary();
  backupDialog.showModal();
});
closeBackupDialog.addEventListener("click", () => backupDialog.close());
backupDialog.addEventListener("click", (event) => {
  const rect = backupDialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) backupDialog.close();
});
exportBackupButton.addEventListener("click", async () => {
  exportBackupButton.disabled = true;
  try {
    await exportBackup();
  } catch (error) {
    showToast(error.message || "Nie udało się zapisać kopii.");
  } finally {
    exportBackupButton.disabled = false;
  }
});
importBackupButton.addEventListener("click", () => backupFileInput.click());
backupFileInput.addEventListener("change", async () => {
  const file = backupFileInput.files?.[0];
  backupFileInput.value = "";
  try {
    await importBackupFile(file);
  } catch (error) {
    showToast(error.message || "Nie udało się wczytać kopii.");
  }
});

window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); deferredPrompt = event; installButton.classList.remove("hidden"); });
installButton.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installButton.classList.add("hidden");
});
window.addEventListener("appinstalled", () => installButton.classList.add("hidden"));

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("./sw.js?v=17");
      await registration.update();
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (sessionStorage.getItem("dobreJedzenieReloadedV17") === "1") return;
        sessionStorage.setItem("dobreJedzenieReloadedV17", "1");
        window.location.reload();
      });
    } catch (error) {
      console.warn("Nie udało się zarejestrować trybu offline:", error);
    }
  });
}

window.addEventListener("hashchange", handleRoute);

const cleanedRecipeCount = cleanMalformedLocalRecipes();
renderMoods();
saveFavorites();
renderRecipes();
if (cleanedRecipeCount) {
  showToast(`Usunięto ${cleanedRecipeCount} błędne ${cleanedRecipeCount === 1 ? "wpis" : "wpisy"} ze schowka.`);
}
handleRoute();
