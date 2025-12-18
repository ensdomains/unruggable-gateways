import { CachedMap } from '../src/cached.js';

const c = new CachedMap(0);

for (let i = 0; i < 3; i++) {
  await c.get(
    'BLOCK',
    async () => {
      console.log('chonk');
    },
    Infinity
  );
}
