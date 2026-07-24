import { geoNaturalEarth1, geoPath } from "d3-geo";
import "./style.css";
import worldData from "./data/world-110m.json";
import { CONTINENT_STYLES, continentSlug, resolveContinent } from "./continents";

interface CountryFeature {
  type: "Feature";
  properties: { name: string; name_ja: string; iso_a2: string; iso_a3: string; continent: string };
  geometry: unknown;
}

const features = (worldData as { features: CountryFeature[] }).features;

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <main>
    <h1>GeoGuessr Tips</h1>
    <p class="lede">GeoGuessrで役立つTipsをまとめていく。</p>
    <div class="map-card" id="map-card">
      <button type="button" id="back-button" class="back-button" hidden>&larr; 世界地図に戻る</button>
    </div>
    <section class="country-panel" id="country-panel" hidden>
      <h2 id="country-panel-title"></h2>
      <div class="country-grid" id="country-grid"></div>
    </section>
    <ul class="legend" id="legend"></ul>
  </main>
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
svg.setAttribute("role", "img");
svg.setAttribute("aria-label", "大陸別に色分けした世界地図。クリックすると大陸にズームする");

const continentGroups = new Map<string, CountryFeature[]>();
const continentBounds = new Map<string, [number, number, number, number]>();

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

function zoomToContinent(continent: string) {
  const bounds = continentBounds.get(continent);
  if (!bounds) return;
  const [x0, y0, x1, y1] = bounds;
  const w = x1 - x0;
  const h = y1 - y0;
  const pad = Math.max(w, h, 40) * 0.12;
  svg.setAttribute("viewBox", `${x0 - pad} ${y0 - pad} ${w + pad * 2} ${h + pad * 2}`);
  backButton.hidden = false;
}

function showCountryGrid(continent: string) {
  const style = CONTINENT_STYLES[continent];
  const list = continentGroups.get(continent) ?? [];
  const names = [...list]
    .map((f) => f.properties.name_ja || f.properties.name)
    .sort((a, b) => a.localeCompare(b, "ja"));

  countryPanelTitle.textContent = `${style?.ja ?? continent}の国一覧（${names.length}）`;
  countryGrid.innerHTML = names.map((name) => `<div class="country-cell">${name}</div>`).join("");
  countryPanel.hidden = false;
}

svg.addEventListener("click", (event) => {
  const target = (event.target as Element).closest("path.continent-path");
  if (!target) return;
  const idx = Number((target as HTMLElement).dataset.idx);
  const feature = features[idx];
  if (!feature) return;
  const continent = resolveContinent(feature.properties.continent);
  zoomToContinent(continent);
  showCountryGrid(continent);
});

backButton.addEventListener("click", () => {
  svg.setAttribute("viewBox", worldViewBox);
  backButton.hidden = true;
  countryPanel.hidden = true;
});
