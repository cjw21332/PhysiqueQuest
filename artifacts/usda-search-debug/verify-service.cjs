const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { parseEnv } = require('node:util');
const backend = path.resolve(__dirname, '../../backend');
const env = parseEnv(fs.readFileSync(path.join(backend, '.env'), 'utf8'));
(async () => {
  const { UsdaService } = await import(pathToFileURL(path.join(backend, 'dist/foodscan/services/usda.service.js')));
  const { HttpService } = await import(pathToFileURL(path.join(backend, 'dist/common/foodscan/http.service.js')));
  const config = { value: { upstreamTimeoutMs: 15000, usda: { configured: true, apiKey: env.USDA_API_KEY, base: env.USDA_BASE || 'https://api.nal.usda.gov/fdc/v1' } } };
  const service = new UsdaService(config, new HttpService(config));
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const candidates = await service.searchCandidates('chicken breast');
      console.log(JSON.stringify({ attempt, candidates: candidates.length, hasChicken: candidates.some(food => /chicken/i.test(food.description)) }));
      if (!candidates.length) process.exitCode = 1;
    } catch (error) { console.log(JSON.stringify({ attempt, code: error.code || error.name, status: error.status })); process.exitCode = 1; }
  }
})();
