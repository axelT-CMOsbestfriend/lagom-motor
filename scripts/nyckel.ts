// npm run nyckel -- "Kundnamn" 20
// Skapar en API-nyckel till Lagom HQ MCP. Nyckeln visas bara nu.
import { createKey } from "../lib/agent/keys";

const [name, quotaArg] = process.argv.slice(2);
const quota = Number(quotaArg ?? 20);
if (!name || !Number.isInteger(quota) || quota < 1) {
  console.log('Användning: npm run nyckel -- "Kundnamn" 20');
  process.exit(1);
}

createKey(name, quota).then(({ key, record }) => {
  console.log(`Nyckel för ${record.name} (${record.quota} beställningar):\n\n  ${key}\n`);
  console.log(
    process.env.SUPABASE_URL
      ? "Sparad i Supabase."
      : "Sparad lokalt i data/api_keys/. Sätt SUPABASE_URL för att skapa nycklar till den publicerade servern."
  );
});
