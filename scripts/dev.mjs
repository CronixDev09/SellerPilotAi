import { createServer } from 'vite';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

async function startDev() {
  console.log('[Dev] Starting Vite dev server...');
  const server = await createServer({
    configFile: path.resolve(root, 'vite.config.ts'),
    server: { port: 5173 },
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 5173;
  console.log(`[Dev] Vite dev server running at http://localhost:${port}`);

  console.log('[Dev] Compiling Electron main and preload...');
  const tsc = spawn('npx', ['tsc', '-p', 'tsconfig.electron.json'], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  });

  tsc.on('close', (code) => {
    if (code !== 0) {
      console.error(`[Dev] TypeScript electron compilation failed with code ${code}`);
      return;
    }

    console.log('[Dev] Launching Electron app...');
    const electron = spawn('npx', ['electron', '.'], {
      cwd: root,
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        VITE_DEV_SERVER_URL: `http://localhost:${port}`,
        NODE_ENV: 'development',
      },
    });

    electron.on('close', () => {
      console.log('[Dev] Electron closed. Exiting dev server...');
      server.close();
      process.exit(0);
    });
  });
}

startDev().catch((err) => {
  console.error('[Dev] Error starting dev environment:', err);
  process.exit(1);
});
