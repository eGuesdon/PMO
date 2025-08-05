import { SimpleLRUCache } from '../../core/utils/SimpleLRUCache';

describe('SimpleLRUCache', () => {
  it('doit stocker et récupérer une entrée', () => {
    const cache = new SimpleLRUCache<string, number>(2);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
    expect(cache.size).toBe(1);
  });

  it("rafraîchit l'ordre des entrées sur get()", () => {
    const cache = new SimpleLRUCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    // accès à 'a' => 'a' devient la plus récente
    expect(cache.get('a')).toBe(1);
    // on ajoute 'c' => doit expulser 'b'
    cache.set('c', 3);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(1);
    expect(cache.get('c')).toBe(3);
  });

  it('évince la plus vieille entrée au-delà de la capacité', () => {
    const evicted: Array<[string, number]> = [];
    const cache = new SimpleLRUCache<string, number>(2, (k, v) => evicted.push([k, v]));
    cache.set('x', 9);
    cache.set('y', 8);
    cache.set('z', 7); // ici on dépasse : 'x' doit être évincé
    expect(cache.get('x')).toBeUndefined();
    expect(evicted).toEqual([['x', 9]]);
  });

  it('clear() vide tout le cache', () => {
    const cache = new SimpleLRUCache<string, number>(2);
    cache.set('p', 42);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('p')).toBeUndefined();
  });
});
