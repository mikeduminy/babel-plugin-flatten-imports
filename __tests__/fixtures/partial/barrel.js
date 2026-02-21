// Barrel with one resolvable and one that will stay put
export { foo } from "./resolvable";

// This is a declaration in the barrel itself
export function unresolvable() {
  return "unresolvable";
}
