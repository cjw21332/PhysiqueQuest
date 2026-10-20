const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const envFile = path.resolve(__dirname, '../../backend/.env');
const env = fs.existsSync(envFile) ? parseEnv(fs.readFileSync(envFile, 'utf8')) : {};
const key = env.USDA_API_KEY || 'DEMO_KEY';
(async () => {
  for (const mode of ['post']) for (const query of ['chicken breast', 'chicken breast', 'rice', 'egg']) {
    const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
    url.search = new URLSearchParams({ api_key: key });
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000), method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({query,pageSize:25,dataType:['Foundation','SR Legacy','Survey (FNDDS)','Branded']}) });
      const text = await response.text();
      let body; try { body = JSON.parse(text); } catch { body = {}; }
      console.log(JSON.stringify({ mode, query, status: response.status, foods: body.foods?.length, error: response.ok ? undefined : text.replaceAll(key, '[redacted]').slice(0, 300) }));
    } catch (error) { console.log(JSON.stringify({ query, failure: error.name })); }
  }
})();
