import { geoNaturalEarth1, geoPath } from "d3-geo";
import { marked } from "marked";
import "./style.css";
import worldData from "./data/world-50m.json";
import { CONTINENT_STYLES, continentSlug, resolveContinent } from "./continents";
import { allTags, CATEGORY_ORDER, MAX_STARS, SUBCATEGORY_ORDER, countriesForTagSelection, sortByStars, starsOf, tipsForCountry, type Tip } from "./tips";
import { flagUrlForCountry, tldsForCountry } from "./countryData";

interface CountryFeature {
  type: "Feature";
  properties: { name: string; name_ja: string; iso_a2: string; iso_a3: string; continent: string };
  geometry: unknown;
}

const features = (worldData as { features: CountryFeature[] }).features;

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <div class="page">
    <header class="page-header">
      <h1>GeoGuessr Tips</h1>
      <p class="lede">GeoGuessrで役立つTipsをまとめていく。</p>
    </header>
    <details class="tag-search-panel" id="tag-search-panel">
      <summary class="tag-search-summary">
        <span>タグで検索</span>
        <span class="tag-search-summary-count" id="tag-search-summary-count" hidden></span>
      </summary>
      <div class="tag-search-body">
        <div class="tag-search-groups" id="tag-search-groups"></div>
        <button type="button" id="tag-search-clear" class="tag-search-clear">すべてクリア</button>
      </div>
    </details>
    <div class="layout">
      <main>
        <div class="map-card" id="map-card">
          <button type="button" id="back-button" class="back-button" hidden>&larr; 世界地図に戻る</button>
        </div>
        <ul class="legend" id="legend"></ul>
      </main>
      <section class="country-panel" id="country-panel" hidden>
        <h2 id="country-panel-title"></h2>
        <ul class="country-list" id="country-grid"></ul>
      </section>
      <aside class="tips-panel" id="tips-panel">
        <h2>Tips<span class="tips-count" id="tips-count" hidden></span></h2>
        <div class="tips-country-header" id="tips-country-header" hidden>
          <img class="tips-country-flag" id="tips-country-flag" alt="" />
          <div class="tips-country-meta">
            <span class="tips-country-name" id="tips-country-name"></span>
            <span class="tips-country-tld" id="tips-country-tld"></span>
          </div>
        </div>
        <p class="tips-placeholder" id="tips-placeholder">国名一覧から国を選択するとTipsを表示する。</p>
        <ul class="tips-list" id="tips-list" hidden></ul>
      </aside>
    </div>
  </div>
`;

const width = 960;
const height = 500;
const svgNS = "http://www.w3.org/2000/svg";
const worldViewBox = `0 0 ${width} ${height}`;

const projection = geoNaturalEarth1().fitSize([width, height], worldData as never);
const path = geoPath(projection);

const svg = document.createElementNS(svgNS, "svg");
svg.setAttribute("id", "world-map");
svg.setAttribute("viewBox", worldViewBox);
svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
svg.setAttribute("role", "img");
svg.setAttribute("aria-label", "大陸別に色分けした世界地図。クリックすると大陸にズームする");

const continentGroups = new Map<string, CountryFeature[]>();
const continentBounds = new Map<string, [number, number, number, number]>();
const featureByCountryName = new Map<string, { feature: CountryFeature; idx: number }>();

// ロシア東部やフィジーの日付変更線またぎなど遠隔領域が全体境界を歪めるため、
// ヨーロッパとオセアニアは経緯度矩形で明示的にズーム範囲を指定する
// （はみ出す領域は切れてよい: ロシア東部、フィジー等）。
const ZOOM_LONLAT_OVERRIDES: Record<string, [number, number, number, number]> = {
  Europe: [-25, 33, 45, 72],
  Oceania: [100, -50, 180, 0],
};

function bboxForLonLatRect(
  [lon0, lat0, lon1, lat1]: [number, number, number, number],
  steps = 20,
): [number, number, number, number] {
  const b: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  const extend = (lon: number, lat: number) => {
    const p = projection([lon, lat]);
    if (!p) return;
    b[0] = Math.min(b[0], p[0]);
    b[1] = Math.min(b[1], p[1]);
    b[2] = Math.max(b[2], p[0]);
    b[3] = Math.max(b[3], p[1]);
  };
  for (let i = 0; i <= steps; i++) {
    const t = lon0 + (lon1 - lon0) * (i / steps);
    extend(t, lat0);
    extend(t, lat1);
  }
  for (let i = 0; i <= steps; i++) {
    const t = lat0 + (lat1 - lat0) * (i / steps);
    extend(lon0, t);
    extend(lon1, t);
  }
  return b;
}

features.forEach((feature, idx) => {
  const d = path(feature as never);
  if (!d) return;

  const continent = resolveContinent(feature.properties.continent);
  const slug = continentSlug(continent);
  const style = CONTINENT_STYLES[continent];

  const pathEl = document.createElementNS(svgNS, "path");
  pathEl.setAttribute("d", d);
  pathEl.setAttribute("class", `continent-path continent-${slug}`);
  pathEl.dataset.idx = String(idx);
  pathEl.style.fill = `var(--continent-${slug}, #999)`;
  pathEl.dataset.baseFill = pathEl.style.fill;

  const title = document.createElementNS(svgNS, "title");
  title.textContent = `${feature.properties.name_ja}（${style?.ja ?? continent}）`;
  pathEl.appendChild(title);

  svg.appendChild(pathEl);

  const bounds = path.bounds(feature as never);
  const [[x0, y0], [x1, y1]] = bounds;
  const prev = continentBounds.get(continent);
  continentBounds.set(continent, prev
    ? [Math.min(prev[0], x0), Math.min(prev[1], y0), Math.max(prev[2], x1), Math.max(prev[3], y1)]
    : [x0, y0, x1, y1]);

  const group = continentGroups.get(continent);
  if (group) group.push(feature);
  else continentGroups.set(continent, [feature]);

  featureByCountryName.set(feature.properties.name_ja || feature.properties.name, { feature, idx });
});

document.querySelector<HTMLDivElement>("#map-card")!.appendChild(svg);

const legend = document.querySelector<HTMLUListElement>("#legend")!;
for (const [continent, style] of Object.entries(CONTINENT_STYLES)) {
  const slug = continentSlug(continent);
  const li = document.createElement("li");
  li.innerHTML = `<span class="swatch" style="background: var(--continent-${slug})"></span>${style.ja}`;
  legend.appendChild(li);
}

const backButton = document.querySelector<HTMLButtonElement>("#back-button")!;
const countryPanel = document.querySelector<HTMLElement>("#country-panel")!;
const countryPanelTitle = document.querySelector<HTMLHeadingElement>("#country-panel-title")!;
const countryGrid = document.querySelector<HTMLDivElement>("#country-grid")!;
const tipsCountryHeader = document.querySelector<HTMLDivElement>("#tips-country-header")!;
const tipsCountryFlag = document.querySelector<HTMLImageElement>("#tips-country-flag")!;
const tipsCountryName = document.querySelector<HTMLSpanElement>("#tips-country-name")!;
const tipsCountryTld = document.querySelector<HTMLSpanElement>("#tips-country-tld")!;
const tipsPlaceholder = document.querySelector<HTMLParagraphElement>("#tips-placeholder")!;
const tipsList = document.querySelector<HTMLUListElement>("#tips-list")!;
const tipsCount = document.querySelector<HTMLSpanElement>("#tips-count")!;
const tagSearchPanel = document.querySelector<HTMLDetailsElement>("#tag-search-panel")!;
const tagSearchGroups = document.querySelector<HTMLDivElement>("#tag-search-groups")!;
const tagSearchClearButton = document.querySelector<HTMLButtonElement>("#tag-search-clear")!;
const tagSearchSummaryCount = document.querySelector<HTMLSpanElement>("#tag-search-summary-count")!;

let selectedPathEl: SVGPathElement | null = null;
let selectedCellEl: HTMLElement | null = null;
let tagHighlightedPathEls: SVGPathElement[] = [];

function clearTagHighlights() {
  for (const el of tagHighlightedPathEls) el.style.fill = el.dataset.baseFill ?? el.style.fill;
  tagHighlightedPathEls = [];
}

const HIGHLIGHT_FILL = "var(--highlight)";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tagCategory(tag: string): string {
  return tag.split("/")[0];
}

const usedTagsByCategory = new Map<string, string[]>();
for (const tag of allTags()) {
  const category = tagCategory(tag);
  const list = usedTagsByCategory.get(category) ?? [];
  list.push(tag);
  usedTagsByCategory.set(category, list);
}

// カテゴリにサブカテゴリが定義済みなら、実際に使われているかを問わずその全選択肢を表示する。
// 未定義（従来通りの自由なタグ）のカテゴリは、実際にtipsで使われているタグからのみ表示する。
const tagGroups: { category: string; childTags: string[] }[] = [];
for (const category of CATEGORY_ORDER) {
  const defined = SUBCATEGORY_ORDER[category] ?? [];
  if (defined.length > 0) {
    tagGroups.push({ category, childTags: defined.map((sub) => `${category}/${sub}`) });
    continue;
  }
  const used = usedTagsByCategory.get(category);
  if (!used) continue;
  tagGroups.push({ category, childTags: used.filter((tag) => tag !== category) });
}

tagSearchGroups.innerHTML = tagGroups
  .map(({ category, childTags }) => {
    const children = childTags
      .map(
        (tag) => `
          <label class="tag-checkbox tag-checkbox-child">
            <input type="checkbox" value="${escapeHtml(tag)}" />
            ${escapeHtml(tag.slice(category.length + 1))}
          </label>
        `,
      )
      .join("");
    return `
      <div class="tag-search-group">
        <label class="tag-checkbox tag-checkbox-category">
          <input type="checkbox" value="${escapeHtml(category)}" />
          ${escapeHtml(category)}
        </label>
        <div class="tag-search-children">${children}</div>
      </div>
    `;
  })
  .join("");

function renderTipCard(tip: Tip, options?: { showLocation?: boolean }): string {
  const body = marked.parse(tip.body, { async: false });
  const image = tip.image
    ? `
      <img class="tip-image" src="${import.meta.env.BASE_URL}tips-images/${tip.image}" alt="" loading="lazy" />
      ${tip.imageCredit ? `<p class="tip-image-credit">${escapeHtml(tip.imageCredit)}</p>` : ""}
    `
    : "";
  const streetView =
    tip.streetView && tip.streetView.startsWith("https://www.google.com/maps/embed")
      ? `
      <iframe class="tip-street-view" src="${escapeHtml(tip.streetView)}" style="border:0;" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>
    `
      : "";
  const location = options?.showLocation
    ? `<p class="tip-location">${escapeHtml(tip.locations.map((loc) => loc.country ?? loc.continent).join("・"))}</p>`
    : "";
  const tags = tip.tags?.length
    ? `
      <div class="tip-tags">
        ${tip.tags
          .map(
            (tag) =>
              `<button type="button" class="tip-tag" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`,
          )
          .join("")}
      </div>
    `
    : "";
  const starCount = starsOf(tip);
  const stars = `<span class="tip-stars">${"★".repeat(starCount)}${"☆".repeat(MAX_STARS - starCount)}</span>`;
  return `
    <li class="tip-card">
      ${stars}
      <span class="tip-category">${escapeHtml(tip.category)}</span>
      <h3>${escapeHtml(tip.title)}</h3>
      ${location}
      ${image}
      ${streetView}
      <div class="tip-body">${body}</div>
      ${tags}
    </li>
  `;
}

function setTipsCount(count: number) {
  tipsCount.hidden = count === 0;
  tipsCount.textContent = count > 0 ? `(${count})` : "";
}

function selectCountry(feature: CountryFeature, pathEl: SVGPathElement | null, cellEl: HTMLElement | null) {
  clearTagHighlights();
  if (selectedPathEl) selectedPathEl.style.fill = selectedPathEl.dataset.baseFill ?? selectedPathEl.style.fill;
  if (pathEl) pathEl.style.fill = HIGHLIGHT_FILL;
  selectedPathEl = pathEl;

  selectedCellEl?.classList.remove("selected");
  cellEl?.classList.add("selected");
  selectedCellEl = cellEl;

  const continent = resolveContinent(feature.properties.continent);
  const countryName = feature.properties.name_ja || feature.properties.name;
  const matched = tipsForCountry(continent, countryName);

  const flagUrl = flagUrlForCountry(countryName);
  tipsCountryHeader.hidden = false;
  if (flagUrl) {
    tipsCountryFlag.src = flagUrl;
    tipsCountryFlag.hidden = false;
  } else {
    tipsCountryFlag.hidden = true;
  }
  tipsCountryName.textContent = countryName;
  const tlds = tldsForCountry(countryName);
  tipsCountryTld.textContent = tlds.join(" / ");
  tipsCountryTld.hidden = tlds.length === 0;

  tipsPlaceholder.hidden = true;
  setTipsCount(matched.length);
  if (matched.length === 0) {
    tipsPlaceholder.hidden = false;
    tipsPlaceholder.textContent = "この国のTipsはまだない。";
    tipsList.hidden = true;
    tipsList.innerHTML = "";
  } else {
    tipsList.hidden = false;
    tipsList.innerHTML = matched.map((tip) => renderTipCard(tip)).join("");
  }
}

function clearCountrySelection() {
  if (selectedPathEl) selectedPathEl.style.fill = selectedPathEl.dataset.baseFill ?? selectedPathEl.style.fill;
  selectedPathEl = null;
  selectedCellEl?.classList.remove("selected");
  selectedCellEl = null;
  tipsCountryHeader.hidden = true;
  tipsPlaceholder.hidden = false;
  tipsPlaceholder.textContent = "国名一覧から国を選択するとTipsを表示する。";
  tipsList.hidden = true;
  tipsList.innerHTML = "";
  setTipsCount(0);
}

function zoomToContinent(continent: string) {
  const lonLatOverride = ZOOM_LONLAT_OVERRIDES[continent];
  const bounds = lonLatOverride ? bboxForLonLatRect(lonLatOverride) : continentBounds.get(continent);
  if (!bounds) return;
  const [x0, y0, x1, y1] = bounds;
  const w = x1 - x0;
  const h = y1 - y0;
  const pad = Math.max(w, h, 40) * 0.12;
  svg.setAttribute("viewBox", `${x0 - pad} ${y0 - pad} ${w + pad * 2} ${h + pad * 2}`);
  // 大陸ズームはアフリカ・南アメリカ等、南北に細長い大陸を切らずに収めるため縦を拡張し、
  // 切り取らず全体が収まるようmeetに切り替える
  // meetは全体を収めるだけでトリムしないため、世界全体表示用の500pxに縛られず
  // コンテナ全体（700px）まで拡大して見やすくする
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.style.height = "100%";
  backButton.hidden = false;
}

function resetMapView() {
  svg.setAttribute("viewBox", worldViewBox);
  svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
  svg.style.height = "";
  backButton.hidden = true;
}

function showCountryGrid(continent: string) {
  const style = CONTINENT_STYLES[continent];
  const list = continentGroups.get(continent) ?? [];
  const entries = [...list]
    .map((f) => ({ feature: f, name: f.properties.name_ja || f.properties.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));

  countryPanelTitle.textContent = `${style?.ja ?? continent}の国一覧（${entries.length}）`;
  countryGrid.innerHTML = entries
    .map(({ feature, name }) => {
      const flagUrl = flagUrlForCountry(name);
      const flagImg = flagUrl ? `<img class="country-flag" src="${flagUrl}" alt="" />` : "";
      return `<li><button type="button" class="country-cell" data-idx="${features.indexOf(feature)}">${flagImg}<span class="country-name">${escapeHtml(name)}</span></button></li>`;
    })
    .join("");
  countryPanel.hidden = false;
  clearCountrySelection();
}

function showAllCountriesGrid() {
  const entries = features
    .map((feature, idx) => ({ feature, idx, name: feature.properties.name_ja || feature.properties.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));

  countryPanelTitle.textContent = `すべての国（${entries.length}）`;
  countryGrid.innerHTML = entries
    .map(({ idx, name }) => {
      const flagUrl = flagUrlForCountry(name);
      const flagImg = flagUrl ? `<img class="country-flag" src="${flagUrl}" alt="" />` : "";
      return `<li><button type="button" class="country-cell" data-idx="${idx}">${flagImg}<span class="country-name">${escapeHtml(name)}</span></button></li>`;
    })
    .join("");
  countryPanel.hidden = false;
  clearCountrySelection();
}

function runTagSearch(selectedTags: string[]) {
  const countryMatches = countriesForTagSelection(selectedTags);

  clearCountrySelection();
  clearTagHighlights();
  resetMapView();

  const entries: { feature: CountryFeature; idx: number; name: string; tips: Tip[] }[] = [];
  for (const { country, tips: countryTips } of countryMatches) {
    const found = featureByCountryName.get(country);
    if (!found) continue;
    const pathEl = svg.querySelector<SVGPathElement>(`path.continent-path[data-idx="${found.idx}"]`);
    if (pathEl) {
      pathEl.style.fill = HIGHLIGHT_FILL;
      tagHighlightedPathEls.push(pathEl);
    }
    entries.push({ feature: found.feature, idx: found.idx, name: country, tips: countryTips });
  }
  entries.sort((a, b) => a.name.localeCompare(b.name, "ja"));

  countryPanelTitle.textContent = `選択したタグに一致する国（${entries.length}）`;
  countryGrid.innerHTML = entries
    .map(({ idx, name }) => {
      const flagUrl = flagUrlForCountry(name);
      const flagImg = flagUrl ? `<img class="country-flag" src="${flagUrl}" alt="" />` : "";
      return `<li><button type="button" class="country-cell" data-idx="${idx}">${flagImg}<span class="country-name">${escapeHtml(name)}</span></button></li>`;
    })
    .join("");
  countryPanel.hidden = false;

  tipsCountryHeader.hidden = true;
  const matchedTips = sortByStars(entries.flatMap((entry) => entry.tips));
  setTipsCount(matchedTips.length);
  if (matchedTips.length === 0) {
    tipsPlaceholder.hidden = false;
    tipsPlaceholder.textContent = "一致するTipsはない。";
    tipsList.hidden = true;
    tipsList.innerHTML = "";
  } else {
    tipsPlaceholder.hidden = true;
    tipsList.hidden = false;
    tipsList.innerHTML = matchedTips.map((tip) => renderTipCard(tip, { showLocation: true })).join("");
  }
}

function selectedTagCheckboxes(): HTMLInputElement[] {
  return [...tagSearchGroups.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
}

function updateTagSearch() {
  const selected = selectedTagCheckboxes()
    .filter((el) => el.checked)
    .map((el) => el.value);

  tagSearchSummaryCount.hidden = selected.length === 0;
  tagSearchSummaryCount.textContent = selected.length > 0 ? `(${selected.length})` : "";

  if (selected.length === 0) {
    clearTagHighlights();
    resetMapView();
    showAllCountriesGrid();
    return;
  }
  runTagSearch(selected);
}

function selectOnlyTag(tag: string) {
  for (const checkbox of selectedTagCheckboxes()) checkbox.checked = checkbox.value === tag;
  tagSearchPanel.open = true;
  updateTagSearch();
}

svg.addEventListener("click", (event) => {
  const target = (event.target as Element).closest<SVGPathElement>("path.continent-path");
  if (!target) return;
  const idx = Number(target.dataset.idx);
  const feature = features[idx];
  if (!feature) return;
  const continent = resolveContinent(feature.properties.continent);
  zoomToContinent(continent);
  showCountryGrid(continent);

  const cellEl = countryGrid.querySelector<HTMLElement>(`.country-cell[data-idx="${idx}"]`);
  selectCountry(feature, target, cellEl);
  cellEl?.scrollIntoView({ block: "nearest" });
});

countryGrid.addEventListener("click", (event) => {
  const target = (event.target as Element).closest<HTMLElement>(".country-cell");
  if (!target) return;
  const idx = Number(target.dataset.idx);
  const feature = features[idx];
  if (!feature) return;
  const pathEl = svg.querySelector<SVGPathElement>(`path.continent-path[data-idx="${idx}"]`);
  selectCountry(feature, pathEl, target);
});

tipsList.addEventListener("click", (event) => {
  const target = (event.target as Element).closest<HTMLButtonElement>(".tip-tag");
  if (!target) return;
  const tag = target.dataset.tag;
  if (!tag) return;
  selectOnlyTag(tag);
});

backButton.addEventListener("click", () => {
  resetMapView();
  showAllCountriesGrid();
});

tagSearchGroups.addEventListener("change", () => {
  updateTagSearch();
});

tagSearchClearButton.addEventListener("click", () => {
  for (const checkbox of selectedTagCheckboxes()) checkbox.checked = false;
  updateTagSearch();
});

showAllCountriesGrid();
