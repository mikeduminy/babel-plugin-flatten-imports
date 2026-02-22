// Mixed: some chained, some direct
export { deepFoo as chained } from "./level2";

export function direct() {
  return "direct";
}
