#!/usr/bin/env node
// Simple demo to test the new upload_pdf tool end-to-end without touching the running server
// Run with: node scripts/demo-upload-pdf.js

import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

// Enable the feature flag before anything else
process.env.ENABLE_PDF_UPLOAD = '1';

// Resolve project root and demo file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');
const demoPdfPath = path.join(projectRoot, 'transcripts', 'demo.pdf');

async function main() {
  // Dynamically import the server
  const serverModuleUrl = pathToFileURL(path.join(projectRoot, 'forest-server', 'server-modular.js')).href;
  const { CleanForestServer } = await import(serverModuleUrl);

  const server = new CleanForestServer();
  await server.initialize();

  console.log('\n🚀 Server initialised. Invoking upload_pdf...');
  const result = await server.toolRouter.dispatchTool('upload_pdf', { path: demoPdfPath });

  console.log('\n✅ upload_pdf result:\n');
  console.log(JSON.stringify(result, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error('Demo failed:', err);
  process.exit(1);
}); 