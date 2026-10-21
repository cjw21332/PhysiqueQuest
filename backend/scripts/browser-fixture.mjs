import { startIsolatedApp } from './isolated-app.mjs';
const fixture = await startIsolatedApp(4311);
const close = async () => { await fixture.close(); process.exit(0); };
process.on('SIGINT', close); process.on('SIGTERM', close);
console.log('Isolated browser fixture ready on 4311');
