import { randomBytes } from "node:crypto";
import { serviceNameSchema } from "../schemas";

const args = process.argv.slice(2);
const serviceNameIndex = args.indexOf("-s");
const rawInput = serviceNameIndex !== -1 ? args[serviceNameIndex + 1] : null;

const validation = serviceNameSchema.safeParse(rawInput);

if (!validation.success) {
  console.error("\x1b[31m%s\x1b[0m", "\n❌ Invalid Service Name:");
  validation.error.issues.forEach((issue) => {
    console.log(`  - ${issue.message}`);
  });
  console.log("\nUsage: bun gen:service -s <lowercase-kebab-case-name>\n");
  process.exit(1);
}

const serviceName = validation.data;
const rawToken = randomBytes(32).toString("base64");
const envKey = `TOKEN_${rawToken}`;

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
};

console.log(
  `\n${colors.bright}${colors.cyan}🫆  KEVI SERVICE GENERATOR${colors.reset}`
);
console.log(`${colors.yellow}${"=".repeat(40)}${colors.reset}\n`);

console.log(
  `${colors.green}✔ Created successfully for:${colors.reset} ${colors.bright}${serviceName}${colors.reset}\n`
);

console.log(
  `${colors.bright}STEP 1: wrangler.jsonc (Environment Variables)${colors.reset}`
);
console.log(
  `${colors.yellow}------------------------------------------------${colors.reset}`
);
console.log(`"${envKey}": "${serviceName}"\n`);

console.log(
  `${colors.bright}STEP 2: src/config.ts (Service Registry)${colors.reset}`
);
console.log(
  `${colors.yellow}------------------------------------------------${colors.reset}`
);
console.log(`"${serviceName}": {
  storage: "YOUR_KV_BINDING",
  role: "admin",
  prefix: "${serviceName.split("-")[0]}",
  description: "Generated service for ${serviceName}"
},\n`);

console.log(
  `${colors.bright}STEP 3: Client Request (Test with Curl)${colors.reset}`
);
console.log(
  `${colors.yellow}------------------------------------------------${colors.reset}`
);
console.log(`${colors.cyan}Header:${colors.reset} X-Kevi-Token: ${rawToken}\n`);

console.log(`${colors.yellow}${"=".repeat(40)}${colors.reset}\n`);
