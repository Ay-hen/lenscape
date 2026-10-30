import { environment } from './environment';
import { loadRuntimeConfig } from './runtime-config';

const reply = (body: unknown, type = 'application/json', ok = true) => (() => Promise.resolve({ ok, headers: new Headers({ 'content-type': type }), json: () => Promise.resolve(body) } as Response)) as unknown as typeof fetch;

describe('runtime config', () => {
  it('applies valid overrides and strips trailing slashes', async () => {
    const env = await loadRuntimeConfig(environment, reply({ apiBaseUrl: 'https://api.example.org/', geocoder: { provider: 'local' } }));
    expect(env.apiBaseUrl).toBe('https://api.example.org'); expect(env.geocoder.provider).toBe('local');
    expect(env.map.tileUrl).toBe(environment.map.tileUrl);
  });
  it('rejects unsafe values', async () => {
    const env = await loadRuntimeConfig(environment, reply({ apiBaseUrl: 'javascript:alert(1)', map: { tileUrl: 'http://insecure/{z}/{x}/{y}.png' } }));
    expect(env.apiBaseUrl).toBe(environment.apiBaseUrl); expect(env.map.tileUrl).toBe(environment.map.tileUrl);
  });
  it('falls back when the file is missing or is the SPA index.html', async () => {
    expect(await loadRuntimeConfig(environment, reply({}, 'text/html'))).toBe(environment);
    expect(await loadRuntimeConfig(environment, reply({}, 'application/json', false))).toBe(environment);
    expect(await loadRuntimeConfig(environment, (() => Promise.reject(new Error('offline'))) as unknown as typeof fetch)).toBe(environment);
  });
});
