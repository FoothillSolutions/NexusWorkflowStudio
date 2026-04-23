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

const COLLAB_NAME_KEY = "nexus:collab-user-name";

export function generateAnimalName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adj}${animal}`;
}

export function getOrCreateUserName(): string {
  if (typeof window === "undefined") return generateAnimalName();
  // Use sessionStorage — scoped per tab, so two tabs in the same browser
  // get distinct names instead of both reading the same localStorage key.
  const stored = sessionStorage.getItem(COLLAB_NAME_KEY);
  if (stored) return stored;
  const name = generateAnimalName();
  sessionStorage.setItem(COLLAB_NAME_KEY, name);
  return name;
}

export function saveUserName(name: string): void {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(COLLAB_NAME_KEY, name);
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
