import * as L from 'leaflet';
import { S } from './settings';

/* Both styles use OpenStreetMap's free, keyless tile server; "dark" is the same
   tiles inverted with a CSS filter (CARTO's dark tiles now watermark without an API key). */
const OSM = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attr: '&copy; OpenStreetMap contributors',
  max: 19,
};

export function addTiles(map: L.Map, el: HTMLElement | null): L.TileLayer {
  if (el) {
    el.classList.remove('map-dark', 'map-street');
    el.classList.add(S.mapStyle === 'street' ? 'map-street' : 'map-dark');
  }
  return L.tileLayer(OSM.url, { attribution: OSM.attr, maxZoom: OSM.max, detectRetina: true }).addTo(map);
}
