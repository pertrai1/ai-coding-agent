import { add, average } from "./utils/math.js";

const values = [4, 8, 15, 16, 23, 42];
const sum = values.reduce((acc, value) => add(acc, value), 0);

console.log("Playground sample app");
console.log(`Values: ${values.join(", ")}`);
console.log(`Sum: ${sum}`);
console.log(`Average: ${average(values).toFixed(2)}`);
