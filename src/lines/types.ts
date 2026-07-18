/**
 * Line type registry. Adding a new kind of line to the game is a single
 * registerLineType() call — physics, rendering, toolbar and persistence all
 * pick it up from here.
 */
export interface LineTypeDef {
  id: string;
  label: string;
  /** Ink color used for both rendering and the toolbar chip. */
  color: string;
  /** Non-collidable types are decoration only (scenery). */
  collidable: boolean;
  /** Multiplies the friction of the touching physics point. */
  frictionMult: number;
  /** Friction applied to every contact regardless of the point (sand-like drag). */
  baseFriction: number;
  /** Acceleration (world units / step) along the drawn direction on contact. */
  accel: number;
  /** Render little direction chevrons on the line (used by boost lines). */
  chevrons?: boolean;
  hotkey?: string;
}

const registry = new Map<string, LineTypeDef>();
const order: string[] = [];

export function registerLineType(def: LineTypeDef): void {
  if (!registry.has(def.id)) order.push(def.id);
  registry.set(def.id, def);
}

export function getLineType(id: string): LineTypeDef {
  const def = registry.get(id);
  return def ?? registry.get('normal')!;
}

export function allLineTypes(): LineTypeDef[] {
  return order.map((id) => registry.get(id)!);
}

// ---- built-in line types -------------------------------------------------

registerLineType({
  id: 'normal',
  label: 'Line',
  color: '#333b4a',
  collidable: true,
  frictionMult: 1,
  baseFriction: 0,
  accel: 0,
  hotkey: '1',
});

registerLineType({
  id: 'speed',
  label: 'Speed',
  color: '#c8402f',
  collidable: true,
  frictionMult: 0.3,
  baseFriction: 0,
  accel: 0.55,
  chevrons: true,
  hotkey: '2',
});

registerLineType({
  id: 'turbo',
  label: 'Turbo',
  color: '#8b2fc0',
  collidable: true,
  frictionMult: 0.15,
  baseFriction: 0,
  accel: 0.85,
  chevrons: true,
  hotkey: '3',
});

registerLineType({
  id: 'slow',
  label: 'Slow',
  color: '#c8892b',
  collidable: true,
  frictionMult: 4,
  baseFriction: 0.22,
  accel: 0,
  hotkey: '4',
});

registerLineType({
  id: 'scenery',
  label: 'Scenery',
  color: '#679a54',
  collidable: false,
  frictionMult: 0,
  baseFriction: 0,
  accel: 0,
  hotkey: '5',
});
