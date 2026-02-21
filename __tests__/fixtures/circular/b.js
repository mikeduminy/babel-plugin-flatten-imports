// File B in circular dependency
export { circular } from "./a";

export function fromB() {
  return "from B";
}
