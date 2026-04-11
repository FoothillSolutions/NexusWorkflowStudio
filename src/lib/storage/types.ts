export interface StorageMetadata {
  size: number;
  lastModified: string;
}

export interface StorageProvider {
  /** Read a file as a UTF-8 string. Returns null if not found. */
  read(key: string): Promise<string | null>;

  /** Read a file as raw bytes. Returns null if not found. */
  readBytes(key: string): Promise<Uint8Array | null>;

  /** Write a UTF-8 string to a key. Creates parent directories/prefixes as needed. */
  write(key: string, content: string): Promise<void>;

  /** Write raw bytes to a key. Creates parent directories/prefixes as needed. */
  writeBytes(key: string, content: Uint8Array): Promise<void>;

  /** Atomically write content (write to temp, then rename). Providers that don't support atomic ops fall back to regular write. */
  writeAtomic(key: string, content: string | Uint8Array): Promise<void>;

  /** Delete a single key. Returns true if deleted, false if not found. */
  delete(key: string): Promise<boolean>;

  /** Recursively delete a key prefix/directory. Returns true if anything was deleted. */
  deleteTree(key: string): Promise<boolean>;

  /** Check if a key exists. */
  exists(key: string): Promise<boolean>;

  /** Get metadata for a key. Returns null if not found. */
  stat(key: string): Promise<StorageMetadata | null>;

  /** List immediate children under a prefix. Returns relative names. */
  list(prefix: string): Promise<string[]>;

  /** List immediate child directories under a prefix. Returns relative names. */
  listDirectories(prefix: string): Promise<string[]>;
}

export type StorageProviderType = "local" | string;
