
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'url';
import * as path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const serverProcess = new StdioClientTransport(
    'node',
    [path.join(__dirname, 'server-modular.js')],
    {
      cwd: __dirname,
    }
  );

  const client = new Client({
    transport: serverProcess,
  });

  try {
    await client.connect();

    const response = await client.tools.runTool('start_performance_timer', { label: 'hta_debug_total' });

    console.log(JSON.stringify(response, null, 2));
  } catch (error) {
    console.error('Error communicating with server:', error);
  } finally {
    if (client.state !== 'closed') {
      await client.close();
    }
  }
}

main();
