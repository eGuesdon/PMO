

/**
 * Simple LRU (Least Recently Used) cache implementation.
 * Implémentation simple de cache LRU (Least Recently Used).
 *
 * @template K Type of cache keys.
 * @template V Type of cache values.
 */
export class SimpleLRUCache<K, V> {
  private cache = new Map<K, V>();

  /**
   * Create a new SimpleLRUCache.
   *
   * @param maxEntries Maximum number of entries to retain in cache.
   *                   Nombre maximal d'entrées à conserver dans le cache.
   * @param onEvict Optional callback invoked when an entry is evicted.
   *                Callback optionnel appelé lorsqu'une entrée est évincée.
   */
  constructor(
    private readonly maxEntries: number,
    private readonly onEvict?: (key: K, value: V) => void
  ) {}

  /**
   * Retrieve a value from the cache.
   * If the key exists, the entry is marked as recently used.
   *
   * @param key The key to retrieve.
   * @returns The cached value or undefined if not found.
   */
  public get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (entry === undefined) {
      return undefined;
    }
    // Refresh entry: remove and re-insert to update order.
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry;
  }

  /**
   * Add or update a cache entry.
   * If the key already exists, it is refreshed.
   * If adding the entry exceeds maxEntries, the least recently used entry is evicted.
   *
   * @param key The key to store.
   * @param value The value to store.
   */
  public set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    this.cache.set(key, value);

    if (this.cache.size > this.maxEntries) {
      // Evict the oldest entry (first map key)
      const oldestKey = this.cache.keys().next().value as K;
      const oldestValue = this.cache.get(oldestKey)!;
      this.cache.delete(oldestKey);
      if (this.onEvict) {
        this.onEvict(oldestKey, oldestValue);
      }
    }
  }

  /**
   * Remove a specific entry from the cache.
   *
   * @param key The key of the entry to remove.
   */
  public delete(key: K): void {
    this.cache.delete(key);
  }

  /**
   * Clear all entries from the cache.
   */
  public clear(): void {
    this.cache.clear();
  }

  /**
   * Get the current number of entries in the cache.
   *
   * @returns Number of entries currently stored.
   */
  public get size(): number {
    return this.cache.size;
  }
}