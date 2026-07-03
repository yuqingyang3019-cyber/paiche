const STORAGE_KEY = "luche-vehicles";
const STORAGE_DATE_KEY = "luche-date";

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

export function todayFilename() {
  const now = new Date();
  return `乌达君正${now.getMonth() + 1}.${now.getDate()}.xlsx`;
}

export function loadVehicles() {
  if (localStorage.getItem(STORAGE_DATE_KEY) !== todayKey()) {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem(STORAGE_DATE_KEY, todayKey());
    return [];
  }
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveVehicles(vehicles) {
  localStorage.setItem(STORAGE_DATE_KEY, todayKey());
  localStorage.setItem(STORAGE_KEY, JSON.stringify(vehicles));
}
