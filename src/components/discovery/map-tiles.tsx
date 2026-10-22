import { TileLayer } from 'react-leaflet';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">openstreetmap</a>';

const MapTiles = () => (
  <TileLayer url={TILE_URL} attribution={ATTRIBUTION} maxZoom={19} />
);

export default MapTiles;
