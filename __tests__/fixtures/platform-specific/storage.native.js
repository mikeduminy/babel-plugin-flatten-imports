// React Native storage module (using AsyncStorage)
export async function setItem(key, value) {
  return AsyncStorage.setItem(key, value);
}

export async function getItem(key) {
  return AsyncStorage.getItem(key);
}
