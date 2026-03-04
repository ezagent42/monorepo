import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse as parseYaml } from 'yaml';

const ROOT = resolve(__dirname, '..', '..');

function loadYaml(filename: string): Record<string, unknown> {
  const raw = readFileSync(resolve(ROOT, filename), 'utf-8');
  return parseYaml(raw) as Record<string, unknown>;
}

function loadJson(filename: string): Record<string, unknown> {
  const raw = readFileSync(resolve(ROOT, filename), 'utf-8');
  return JSON.parse(raw) as Record<string, unknown>;
}

describe('electron-builder.yml', () => {
  const config = loadYaml('electron-builder.yml');

  it('sets appId to dev.ezagent.app', () => {
    expect(config.appId).toBe('dev.ezagent.app');
  });

  it('sets productName to EZAgent', () => {
    expect(config.productName).toBe('EZAgent');
  });

  it('enables asar packaging', () => {
    expect(config.asar).toBe(true);
  });

  it('registers the ezagent protocol scheme', () => {
    const protocols = config.protocols as
      | { name: string; schemes: string[] }[]
      | { name: string; schemes: string[] }
      | undefined;

    // protocols can be an array or a single object
    const protocolList = Array.isArray(protocols) ? protocols : [protocols];

    const schemes = protocolList.flatMap((p) => p?.schemes ?? []);
    expect(schemes).toContain('ezagent');
  });

  it('includes out/ and dist-electron/ in files', () => {
    const files = config.files as string[];
    expect(files).toBeDefined();

    const filesStr = JSON.stringify(files);
    expect(filesStr).toContain('out/');
    expect(filesStr).toContain('dist-electron/');
  });

  it('includes runtime/ in extraResources', () => {
    const extra = config.extraResources as
      | Array<string | { from: string }>
      | undefined;
    expect(extra).toBeDefined();

    const resourcePaths = extra!.map((r) =>
      typeof r === 'string' ? r : r.from,
    );
    const hasRuntime = resourcePaths.some((p) => p.includes('runtime'));
    expect(hasRuntime).toBe(true);
  });

  describe('platform targets', () => {
    it('configures macOS target', () => {
      expect(config.mac).toBeDefined();
      const mac = config.mac as Record<string, unknown>;
      expect(mac.target).toBeDefined();
    });

    it('configures Windows target', () => {
      expect(config.win).toBeDefined();
      const win = config.win as Record<string, unknown>;
      expect(win.target).toBeDefined();
    });

    it('configures Linux target', () => {
      expect(config.linux).toBeDefined();
      const linux = config.linux as Record<string, unknown>;
      expect(linux.target).toBeDefined();
    });
  });
});

describe('package.json build scripts', () => {
  const pkg = loadJson('package.json');
  const scripts = pkg.scripts as Record<string, string>;

  it('has a "package" script', () => {
    expect(scripts.package).toBeDefined();
  });

  it('"package" script invokes electron-builder', () => {
    expect(scripts.package).toContain('electron-builder');
  });

  it('"package" script builds before packaging', () => {
    // The package script should include a build step before electron-builder
    expect(scripts.package).toContain('build');
  });
});
