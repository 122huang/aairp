import { loadApiConfig, startServer } from './app.js';

async function main() {
  const config = loadApiConfig();
  await startServer(config);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
