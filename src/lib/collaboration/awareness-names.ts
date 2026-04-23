const ADJECTIVES = [
  "Swift", "Tawny", "Bold", "Misty", "Rusty", "Amber", "Crisp", "Dusty",
  "Frosty", "Giddy", "Hasty", "Inky", "Jolly", "Lanky", "Mossy", "Nifty",
  "Olive", "Peppy", "Quirky", "Ruddy", "Salty", "Tangy", "Upbeat", "Vivid",
  "Wily", "Zesty", "Brisk", "Chilly", "Dapper", "Earthy", "Fluffy", "Glossy",
  "Hearty", "Icy", "Jazzy", "Keen", "Lofty", "Moody", "Noble", "Ornate",
  "Perky", "Quiet", "Rosy", "Snappy", "Toasty", "Urgent", "Velvet", "Wavy",
  "Exact", "Zippy",
];

const ANIMALS = [
  "Badger", "Crane", "Dingo", "Eagle", "Finch", "Gecko", "Heron", "Ibis",
  "Jackal", "Koala", "Lemur", "Mink", "Newt", "Otter", "Panda", "Quail",
  "Raven", "Stoat", "Tapir", "Vole", "Wren", "Yak", "Zebra", "Bison",
  "Capybara", "Dugong", "Ermine", "Ferret", "Gibbon", "Hyena", "Impala",
  "Jaguar", "Kiwi", "Llama", "Marmot", "Narwhal", "Ocelot", "Pelican",
  "Robin", "Serval", "Toucan", "Uakari", "Vicuna", "Walrus", "Axolotl",
  "Bobolink", "Caracal", "Dassie", "Echidna",
];

// Custom user-chosen name — persisted across browser sessions.
const CUSTOM_NAME_KEY = "nexus:collab-user-name";
// Per-tab fallback when the user hasn't chosen a name yet. Scoped to the
// tab so two tabs in the same browser don't both pick up the same default.
const SESSION_NAME_KEY = "nexus:collab-user-name-session";

export function generateAnimalName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adj}${animal}`;
}

/**
 * Resolves the display name for the local user.
 *
 * Priority:
 *   1. A custom name the user has explicitly set (persisted to
 *      `localStorage`, so it survives tab close and new sessions).
 *   2. The tab's existing animal-name fallback (`sessionStorage`, unique
 *      per tab so sibling tabs don't clash).
 *   3. A freshly generated animal name, persisted to `sessionStorage`.
 */
export function getOrCreateUserName(): string {
  if (typeof window === "undefined") return generateAnimalName();

  try {
    const custom = localStorage.getItem(CUSTOM_NAME_KEY);
    if (custom && custom.trim()) return custom;
  } catch {
    /* localStorage unavailable (private mode / quota) — fall through */
  }

  try {
    const stored = sessionStorage.getItem(SESSION_NAME_KEY);
    if (stored) return stored;
  } catch {
    /* sessionStorage unavailable */
  }

  const name = generateAnimalName();
  try {
    sessionStorage.setItem(SESSION_NAME_KEY, name);
  } catch {
    /* ignore quota errors — we just won't persist the fallback */
  }
  return name;
}

/**
 * Persists an explicit user-chosen display name. Writes to both
 * `localStorage` (so it outlives the tab) and `sessionStorage` (so
 * `getOrCreateUserName` returns the same value for the remainder of this
 * tab's lifetime, matching the custom value).
 */
export function saveUserName(name: string): void {
  if (typeof window === "undefined") return;
  const trimmed = name.trim();
  if (!trimmed) return;
  try {
    localStorage.setItem(CUSTOM_NAME_KEY, trimmed);
  } catch {
    /* ignore quota errors */
  }
  try {
    sessionStorage.setItem(SESSION_NAME_KEY, trimmed);
  } catch {
    /* ignore quota errors */
  }
}

// 8 hue slots — deterministic from clientId
const HUE_SLOTS = [
  { color: "#7c3aed", colorLight: "#ede9fe" }, // violet
  { color: "#0284c7", colorLight: "#e0f2fe" }, // sky
  { color: "#d97706", colorLight: "#fef3c7" }, // amber
  { color: "#059669", colorLight: "#d1fae5" }, // emerald
  { color: "#e11d48", colorLight: "#ffe4e6" }, // rose
  { color: "#4f46e5", colorLight: "#e0e7ff" }, // indigo
  { color: "#ea580c", colorLight: "#ffedd5" }, // orange
  { color: "#0d9488", colorLight: "#ccfbf1" }, // teal
];

export function getColorForClientId(clientId: number): { color: string; colorLight: string } {
  return HUE_SLOTS[clientId % HUE_SLOTS.length];
}
