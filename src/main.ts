import { geoNaturalEarth1, geoPath } from "d3-geo";
import { marked } from "marked";
import "./style.css";
import worldData from "./data/world-110m.json";
import { CONTINENT_STYLES, continentSlug, resolveContinent } from "./continents";
import { tipsForCountry, type Tip } from "./tips";
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
        <h2>Tips</h2>
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

let selectedPathEl: SVGPathElement | null = null;
let selectedCellEl: HTMLElement | null = null;

function parseRgb(value: string): [number, number, number] | null {
  const match = value.match(/rgba?\(([^)]+)\)/);
  if (!match) return null;
  const [r, g, b] = match[1].split(",").map((v) => parseFloat(v));
  return [r, g, b];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  switch (max) {
    case r:
      h = ((g - b) / d) % 6;
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
  }
  h *= 60;
  if (h < 0) h += 360;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function complementaryFill(pathEl: SVGPathElement): string | null {
  const rgb = parseRgb(getComputedStyle(pathEl).fill);
  if (!rgb) return null;
  const [h, s, l] = rgbToHsl(...rgb);
  const brighterL = l + (1 - l) * 0.4;
  const [r2, g2, b2] = hslToRgb((h + 180) % 360, s, brighterL);
  return `rgb(${r2}, ${g2}, ${b2})`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderTipCard(tip: Tip): string {
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
  return `
    <li class="tip-card">
      <span class="tip-category">${escapeHtml(tip.category)}</span>
      <h3>${escapeHtml(tip.title)}</h3>
      ${image}
      ${streetView}
      <div class="tip-body">${body}</div>
    </li>
  `;
}

function selectCountry(feature: CountryFeature, pathEl: SVGPathElement | null, cellEl: HTMLElement | null) {
  if (selectedPathEl) selectedPathEl.style.fill = selectedPathEl.dataset.baseFill ?? selectedPathEl.style.fill;
  if (pathEl) {
    const complement = complementaryFill(pathEl);
    if (complement) pathEl.style.fill = complement;
  }
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
  if (matched.length === 0) {
    tipsPlaceholder.hidden = false;
    tipsPlaceholder.textContent = "この国のTipsはまだない。";
    tipsList.hidden = true;
    tipsList.innerHTML = "";
  } else {
    tipsList.hidden = false;
    tipsList.innerHTML = matched.map(renderTipCard).join("");
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
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.style.height = "800px";
  backButton.hidden = false;
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

backButton.addEventListener("click", () => {
  svg.setAttribute("viewBox", worldViewBox);
  svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
  svg.style.height = "";
  backButton.hidden = true;
  countryPanel.hidden = true;
  clearCountrySelection();
});
