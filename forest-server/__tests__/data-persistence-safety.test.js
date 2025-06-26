// @ts-nocheck
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { DataPersistence } from '../data-persistence.js';

describe('DataPersistence safety mechanisms', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-dp-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('performs atomic JSON writes without leaving temp files', async () => {
    const dp = new DataPersistence(tmpDir);
    const projectId = 'proj1';
    const filename = 'config.json';

    const data = { alpha: 1 };
    await dp.saveProjectData(projectId, filename, data);

    const projectDir = dp.getProjectDir(projectId);
    const filePath = path.join(projectDir, filename);

    const raw = await fs.readFile(filePath, 'utf8');
    expect(JSON.parse(raw)).toEqual(data);

    const dirFiles = await fs.readdir(projectDir);
    const tmpLeftovers = dirFiles.filter(f => f.endsWith('.tmp'));
    expect(tmpLeftovers.length).toBe(0);
  });

  it('serialises concurrent writes using internal locks', async () => {
    const dp = new DataPersistence(tmpDir);
    const projectId = 'proj-concurrent';
    const filename = 'state.json';

    const writes = [
      dp.saveProjectData(projectId, filename, { value: 1 }),
      dp.saveProjectData(projectId, filename, { value: 2 }),
      dp.saveProjectData(projectId, filename, { value: 3 }),
    ];

    await Promise.all(writes);

    const filePath = path.join(dp.getProjectDir(projectId), filename);
    const finalData = JSON.parse(await fs.readFile(filePath, 'utf8'));
    expect(finalData).toEqual({ value: 3 }); // last write wins
  });
}); 