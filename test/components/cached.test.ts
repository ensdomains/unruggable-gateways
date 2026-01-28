import { test, describe, expect } from 'bun:test';
import { CachedMap, CachedValue, LRU } from '../../src/cached.js';

function wait(t: number) {
  return new Promise((f) => setTimeout(f, t));
}

describe('LRU', () => {
  test('0 element: no values should be cached', async () => {
    const c = new LRU<number, number>(0);
    c.setValue(1, 1);
    expect(c.size).toStrictEqual(0);
    c.setPending(1, Promise.resolve(1));
    expect(c.size).toStrictEqual(0);
    await c.cache(1, async () => 1);
    expect(c.size).toStrictEqual(0);
  });

  test('1 element: latest value should be cached', async () => {
    const c = new LRU<number, number>(1);
    c.setValue(1, 1);
    c.setValue(2, 2);
    expect(c.size).toStrictEqual(1);
    expect(c.peek(1)).toBeUndefined();
    expect(c.peek(2)).resolves.toStrictEqual(2);
    await c.cache(3, async () => 3);
    expect(c.peek(2)).toBeUndefined();
    expect(c.peek(3)).resolves.toStrictEqual(3);
  });

  test('n element: last n elements should be cached', async () => {
    const n = 3;
    const c = new LRU<number, number>(n);
    for (let i = 0; i < 100; i++) {
      c.setValue(i, 0);
      if (c.size == n) {
        expect([...c.keys()]).toStrictEqual(
          Array.from({ length: n }, (_, j) => i + j + 1 - n)
        );
      }
    }
  });

  test('truncate', async () => {
    const c = new LRU<number, number>();
    for (let i = 0; i < 5; i++) c.setValue(i, i);
    c.max = 1;
    expect(c.size).toStrictEqual(c.max);
  });

  test('excess', async () => {
    const c = new LRU<number, number>(2);
    const { promise, resolve } = Promise.withResolvers();
    const ps = Array.from({ length: 5 }, (_, i) =>
      c.setPending(
        i,
        promise.then(() => i)
      )
    );
    resolve();
    const vs = await Promise.all(ps);
    expect([...c.keys()]).toStrictEqual(vs.slice(-c.size));
  });

  test('pending elements touch() on resolution', async () => {
    const c = new LRU<number, number>(2);
    const { promise, resolve } = Promise.withResolvers<number>();
    c.setPending(1, promise);
    c.setValue(2, 2);
    expect([...c.keys()]).toStrictEqual([1, 2]);
    resolve(1);
    await promise;
    expect([...c.keys()]).toStrictEqual([2, 1]);
  });

  test('replaced elements do not touch() on resolution', async () => {
    const c = new LRU<number, number>(2);
    const { promise, resolve } = Promise.withResolvers<number>();
    c.setPending(1, promise);
    c.setValue(1, 2);
    resolve(1);
    expect(promise).resolves.toStrictEqual(1);
    expect(c.peek(1)).resolves.toStrictEqual(2);
  });
});

describe('CachedMap', () => {
  test('0 cache time should be empty post-resolution', async () => {
    const c = new CachedMap(0);
    await c.get('A', async () => 1);
    expect(c.cachedSize).toEqual(0);
    expect(
      c.get('A', async () => {
        throw 2;
      })
    ).rejects.toBe(2);
    expect(c.peek('A')).rejects.toBe(2);
  });

  test('infinite cache time should resolve and never schedule', async () => {
    const c = new CachedMap(Infinity);
    await c.get('A', async () => 1);
    expect(c.cachedRemainingMs('A') === Infinity);
    expect(c.nextExpirationMs).toEqual(Infinity);
    expect(
      c.get('A', async () => {
        throw 'wtf';
      })
    ).resolves.toBe(1);
  });

  test('general behavior', async () => {
    const c = new CachedMap(100);
    c.slopMs = 1;
    c.get('A', () => wait(100).then(() => 1));
    c.get('B', () => wait(150).then(() => 2), 200);
    expect(
      c.get('A', async () => {
        throw 'wtf';
      })
    ).resolves.toBe(1);
    expect(c.pendingSize).toBe(1);
    expect(c.cachedSize).toBe(1);
    expect(c.cachedRemainingMs('A')).toBeGreaterThan(90);
    expect(c.peek('B')).resolves.toBe(2);
    expect(c.cachedSize).toBe(2);
    expect(c.cachedValue('A')).resolves.toBe(1);
    expect(c.cachedRemainingMs('B')).toBeGreaterThan(190);
    await wait(110);
    expect(c.cachedSize).toBe(1);
    expect(c.cachedValue('B')).resolves.toBe(2);
    await wait(110);
    expect(c.cachedSize).toBe(0);
  });
});

describe('CachedValue', () => {
  test('states', async () => {
    const c = new CachedValue(() => wait(50));
    expect(c.isPending).toBeFalse();
    expect(c.isCached).toBeFalse();
    const p = c.get();
    expect(c.isPending).toBeTrue();
    expect(c.isCached).toBeFalse();
    await p;
    expect(c.isPending).toBeFalse();
    expect(c.isCached).toBeTrue();
    c.clear();
    expect(c.isPending).toBeFalse();
    expect(c.isCached).toBeFalse();
  });

  test('cachedRemainingMs', async () => {
    const c = new CachedValue<number>(async () => 1, 10);
    expect(c.cachedRemainingMs).toStrictEqual(0);
    c.get();
    expect(c.cachedRemainingMs).toStrictEqual(Infinity);
    await c.get();
    expect(c.cachedRemainingMs).toBeFinite();
    await wait(20);
    expect(c.cachedRemainingMs).toStrictEqual(0);
  });

  test('generator runs once', async () => {
    let n = 0;
    const c = new CachedValue(async () => ++n);
    await Promise.all([c.get(), c.get()]);
    expect(n).toStrictEqual(1);
  });

  test('generator reruns', async () => {
    let n = 0;
    const c = new CachedValue(async () => ++n, 10);
    await Promise.all([c.get(), c.get()]);
    expect(n).toStrictEqual(1);
    await wait(20);
    await Promise.all([c.get(), c.get()]);
    expect(n).toStrictEqual(2);
  });

  test('reject is replayed', async () => {
    let n = 0;
    const c = new CachedValue<number>(
      async () => {
        ++n;
        throw 123;
      },
      0,
      10
    );
    expect(c.get()).rejects.toStrictEqual(123);
    expect(c.get()).rejects.toStrictEqual(123);
    expect(c.errorMs - c.cachedRemainingMs).toBeLessThan(5);
    expect(n).toStrictEqual(1);
    await wait(20);
    expect(c.get()).rejects.toStrictEqual(123);
    expect(n).toStrictEqual(2);
  });

  test('clear() violates run-once invariant', async () => {
    let n = 0;
    const c = new CachedValue(async () => {
      await wait(10);
      ++n;
    });
    const p = c.get();
    expect(n).toStrictEqual(0);
    c.clear();
    await Promise.all([p, c.get()]);
    expect(n).toStrictEqual(2);
  });

  test('force() violates run-once invariant', async () => {
    let n = 0;
    const c = new CachedValue(async () => ++n);
    await Promise.all([c.force(), c.force()]);
    expect(n).toStrictEqual(2);
  });

  test('clear() w/observer can maintain run-once invariant', async () => {
    let n = 0;
    const c = new CachedValue(async (obs) => {
      await wait(10);
      if (obs.replaced) return;
      ++n;
    });
    const p = c.get();
    c.clear();
    await Promise.all([p, c.get()]);
    expect(n).toStrictEqual(1);
  });

  test('set()', async () => {
    const c = new CachedValue<number>(async () => {
      throw 123;
    });
    c.set(2);
    expect(await c.get()).toStrictEqual(2);
    c.set(3, Infinity); // custom duration
    expect(await c.get()).toStrictEqual(3);
    expect(c.cachedRemainingMs).toStrictEqual(Infinity);
  });

  test('value', async () => {
    const c = new CachedValue(async () => 1);
    expect(await c.value).toBeUndefined();
    const p = c.get();
    expect(c.value).toBeDefined();
    await p;
    expect(await c.value).toStrictEqual(1);
  });

  test('cacheMs = 0', async () => {
    let n = 0;
    const c = new CachedValue(async () => ++n, 0);
    await Promise.all([c.get(), c.get()]);
    expect(c.isCached).toBeFalse();
  });
});
