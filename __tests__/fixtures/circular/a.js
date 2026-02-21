// File A in circular dependency
export { circular } from "./b";

export function fromA() {
  return "from A";
}
