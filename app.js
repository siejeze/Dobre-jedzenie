
const recipes = window.RECIPES || [];
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
const recipeDialog = document.querySelector("#recipeDialog");
const dialogContent = document.querySelector("#dialogContent");
const closeDialog = document.querySelector("#closeDialog");
const favoritesButton = document.querySelector("#favoritesButton");
const favoriteCount = document.querySelector("#favoriteCount");
const installButton = document.querySelector("#installButton");

let currentQuery = "";
let favoritesOnly = false;
let deferredPrompt = null;
let favorites = new Set(JSON.parse(localStorage.getItem("dobreJedzenieFavorites") || "[]"));

const normalise = (value) =>
  value
    .toLocaleLowerCase("pl")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

function recipeSearchText(recipe) {
  return normalise([
    recipe.title,
    recipe.category,
    recipe.summary,
    ...recipe.tags,
    ...recipe.ingredients
  ].join(" "));
}

function tokenise(query) {
  const stopWords = new Set([
    "cos", "chce", "mam", "ochote", "potrzebuje", "prosze", "zrob", "danie",
    "przepis", "jakies", "jakiegos", "dzis", "dzisiaj", "na", "z", "i", "albo"
  ]);
  return normalise(query)
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

function scoreRecipe(recipe, query) {
  if (!query.trim()) return 1;
  const text = recipeSearchText(recipe);
  const tokens = tokenise(query);
  let score = 0;

  tokens.forEach((token) => {
    if (text.includes(token)) score += 2;
    if (normalise(recipe.title).includes(token)) score += 3;
    if (recipe.tags.some((tag) => normalise(tag).includes(token))) score += 2;
  });

  const minuteMatch = normalise(query).match(/do\s*(\d+)\s*min/);
  if (minuteMatch && recipe.time <= Number(minuteMatch[1])) score += 6;

  if (normalise(query).includes("szybk") && recipe.time <= 20) score += 4;
  if (normalise(query).includes("lekka") && recipe.tags.includes("lekka kolacja")) score += 5;
  if (normalise(query).includes("bez pieczenia") && recipe.tags.includes("bez pieczenia")) score += 6;
  if (normalise(query).includes("na gosci") && recipe.tags.includes("na gości")) score += 5;

  return score;
}

function getVisibleRecipes() {
  let list = recipes.map((recipe) => ({
    recipe,
    score: scoreRecipe(recipe, currentQuery)
  }));

  if (favoritesOnly) {
    list = list.filter(({ recipe }) => favorites.has(recipe.id));
  } else if (currentQuery.trim()) {
    list = list.filter(({ score }) => score > 0);
  }

  return list
    .sort((a, b) => b.score - a.score || a.recipe.time - b.recipe.time)
    .map(({ recipe }) => recipe);
}

function saveFavorites() {
  localStorage.setItem("dobreJedzenieFavorites", JSON.stringify([...favorites]));
  favoriteCount.textContent = favorites.size;
}

function toggleFavorite(id) {
  favorites.has(id) ? favorites.delete(id) : favorites.add(id);
  saveFavorites();
  renderRecipes();
}

function renderMoods() {
  moodGrid.innerHTML = moods.map((mood) => `
    <button class="mood-card" type="button" data-query="${mood.query}">
      <span class="mood-icon" aria-hidden="true">${mood.icon}</span>
      <span class="mood-name">${mood.name}</span>
      <span class="mood-desc">${mood.desc}</span>
    </button>
  `).join("");
}

function renderRecipes() {
  const visible = getVisibleRecipes();

  recipeGrid.innerHTML = visible.map((recipe) => `
    <article class="recipe-card" style="--tone-1:${recipe.tone[0]}; --tone-2:${recipe.tone[1]}">
      <div class="recipe-visual">
        <span class="recipe-emoji" aria-hidden="true">${recipe.emoji}</span>
        <button
          class="favorite-toggle ${favorites.has(recipe.id) ? "saved" : ""}"
          type="button"
          data-favorite="${recipe.id}"
          aria-label="${favorites.has(recipe.id) ? "Usuń z ulubionych" : "Dodaj do ulubionych"}"
        >${favorites.has(recipe.id) ? "♥" : "♡"}</button>
      </div>
      <div class="recipe-body">
        <div class="recipe-tags">
          ${recipe.tags.slice(0, 3).map((tag) => `<span class="recipe-tag">${tag}</span>`).join("")}
        </div>
        <h3>${recipe.title}</h3>
        <p>${recipe.summary}</p>
        <div class="recipe-meta">
          <span>⏱ ${recipe.time} min</span>
          <span>• ${recipe.difficulty}</span>
        </div>
        <button class="open-recipe" type="button" data-open="${recipe.id}">Pokaż przepis</button>
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
    resultsNote.textContent = favorites.size
      ? "Rzeczy, do których warto wracać."
      : "Jeszcze nic tu nie ma. Serca na kartach czekają.";
  } else if (currentQuery) {
    resultsEyebrow.textContent = "Wyniki";
    resultsTitle.textContent = `Dla: „${currentQuery}”`;
    resultsNote.textContent = visible.length
      ? `Znaleziono ${visible.length} ${visible.length === 1 ? "propozycję" : "propozycji"}.`
      : "Nie znalazłam sensownego dopasowania.";
  } else {
    resultsEyebrow.textContent = "Wybrane dla Ciebie";
    resultsTitle.textContent = "Pewniaki na dobry początek";
    resultsNote.textContent = "Proste składniki, mało ceremonii, dużo smaku.";
  }
}

function showRecipe(id) {
  const recipe = recipes.find((item) => item.id === id);
  if (!recipe) return;

  dialogContent.innerHTML = `
    <div class="dialog-hero" style="--tone-1:${recipe.tone[0]}; --tone-2:${recipe.tone[1]}">${recipe.emoji}</div>
    <div class="dialog-body">
      <p class="eyebrow">${recipe.category} · ${recipe.time} min · ${recipe.difficulty}</p>
      <h2>${recipe.title}</h2>
      <p class="dialog-lead">${recipe.summary}</p>
      <div class="dialog-columns">
        <section>
          <h3>Składniki</h3>
          <ul class="ingredient-list">
            ${recipe.ingredients.map((item) => `<li>${item}</li>`).join("")}
          </ul>
        </section>
        <section>
          <h3>Po kolei</h3>
          <ol class="step-list">
            ${recipe.steps.map((item) => `<li>${item}</li>`).join("")}
          </ol>
        </section>
      </div>
      <div class="recipe-tip"><strong>Ważny drobiazg:</strong> ${recipe.tip}</div>
    </div>
  `;
  recipeDialog.showModal();
}

function applyQuery(query) {
  currentQuery = query.trim();
  favoritesOnly = false;
  searchInput.value = currentQuery;
  renderRecipes();
  document.querySelector(".results-section").scrollIntoView({ behavior: "smooth", block: "start" });
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  applyQuery(searchInput.value);
});

document.addEventListener("click", (event) => {
  const mood = event.target.closest("[data-query]");
  const chip = event.target.closest("[data-filter]");
  const open = event.target.closest("[data-open]");
  const favorite = event.target.closest("[data-favorite]");

  if (mood) applyQuery(mood.dataset.query);
  if (chip) applyQuery(chip.dataset.filter);
  if (open) showRecipe(open.dataset.open);
  if (favorite) {
    event.stopPropagation();
    toggleFavorite(favorite.dataset.favorite);
  }
});

clearFilters.addEventListener("click", () => {
  currentQuery = "";
  favoritesOnly = false;
  searchInput.value = "";
  renderRecipes();
});

favoritesButton.addEventListener("click", () => {
  favoritesOnly = !favoritesOnly;
  currentQuery = "";
  searchInput.value = "";
  renderRecipes();
  document.querySelector(".results-section").scrollIntoView({ behavior: "smooth", block: "start" });
});

closeDialog.addEventListener("click", () => recipeDialog.close());
recipeDialog.addEventListener("click", (event) => {
  const rect = recipeDialog.getBoundingClientRect();
  const outside =
    event.clientX < rect.left || event.clientX > rect.right ||
    event.clientY < rect.top || event.clientY > rect.bottom;
  if (outside) recipeDialog.close();
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;
  installButton.classList.remove("hidden");
});

installButton.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installButton.classList.add("hidden");
});

window.addEventListener("appinstalled", () => {
  installButton.classList.add("hidden");
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.warn("Nie udało się zarejestrować trybu offline:", error);
    });
  });
}

renderMoods();
saveFavorites();
renderRecipes();
