export function add(a: number, b: number): number {
  return a + b;
}

export function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}
