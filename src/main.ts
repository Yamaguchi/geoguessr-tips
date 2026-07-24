import { geoNaturalEarth1, geoPath } from "d3-geo";
import "./style.css";
import worldData from "./data/world-110m.json";
import { CONTINENT_STYLES, continentSlug, resolveContinent } from "./continents";

interface CountryFeature {
  type: "Feature";
  properties: { name: string; iso_a2: string; iso_a3: string; continent: string };
  geometry: unknown;
}

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <main>
    <h1>GeoGuessr Tips</h1>
    <p class="lede">GeoGuessrで役立つTipsをまとめていく。</p>
    <div class="map-card" id="map-card"></div>
    <ul class="legend" id="legend"></ul>
  </main>
`;

const width = 960;
const height = 500;
const svgNS = "http://www.w3.org/2000/svg";

const projection = geoNaturalEarth1().fitSize([width, height], worldData as never);
const path = geoPath(projection);

const svg = document.createElementNS(svgNS, "svg");
svg.setAttribute("id", "world-map");
svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
svg.setAttribute("role", "img");
svg.setAttribute("aria-label", "大陸別に色分けした世界地図");

for (const feature of (worldData as { features: CountryFeature[] }).features) {
  const d = path(feature as never);
  if (!d) continue;

  const continent = resolveContinent(feature.properties.continent);
  const slug = continentSlug(continent);
  const style = CONTINENT_STYLES[continent];

  const pathEl = document.createElementNS(svgNS, "path");
  pathEl.setAttribute("d", d);
  pathEl.setAttribute("class", `continent-path continent-${slug}`);
  pathEl.style.fill = `var(--continent-${slug}, #999)`;

  const title = document.createElementNS(svgNS, "title");
  title.textContent = `${feature.properties.name}（${style?.ja ?? continent}）`;
  pathEl.appendChild(title);

  svg.appendChild(pathEl);
}

document.querySelector<HTMLDivElement>("#map-card")!.appendChild(svg);

const legend = document.querySelector<HTMLUListElement>("#legend")!;
for (const [continent, style] of Object.entries(CONTINENT_STYLES)) {
  const slug = continentSlug(continent);
  const li = document.createElement("li");
  li.innerHTML = `<span class="swatch" style="background: var(--continent-${slug})"></span>${style.ja}`;
  legend.appendChild(li);
}
