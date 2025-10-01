import { logger } from "@/lib/logger";
import { toast } from "sonner";

export class StorageService {
  private static instance: StorageService;
  private readonly storagePrefix = 'app_';
  private readonly storageVersion = '1';

  private constructor() {}

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  private getKey(key: string): string {
    return `${this.storagePrefix}v${this.storageVersion}_${key}`;
  }

  setItem<T>(key: string, value: T): boolean {
    const fullKey = this.getKey(key);
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(fullKey, serialized);
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        logger.error(`[Storage] Quota exceeded for key: ${key}`);
        this.handleQuotaExceeded(key);

        toast.error("Storage full", {
          description: "Your browser storage is full. Older data was removed to make space.",
          duration: 4000,
        });
      } else {
        logger.error(`[Storage] Failed to save ${key}:`, error);

        toast.error("Cannot save data", {
          description: "There was an error saving your data. Please try again.",
          duration: 3000,
        });
      }
      return false;
    }
  }

  getItem<T>(key: string, defaultValue?: T): T | null {
    const fullKey = this.getKey(key);
    try {
      const item = localStorage.getItem(fullKey);
      if (item === null) return defaultValue ?? null;
      return JSON.parse(item) as T;
    } catch (error) {
      logger.error(`[Storage] Failed to read ${key}:`, error);
      return defaultValue ?? null;
    }
  }

  removeItem(key: string): void {
    const fullKey = this.getKey(key);
    try {
      localStorage.removeItem(fullKey);
    } catch (error) {
      logger.error(`[Storage] Failed to remove ${key}:`, error);
    }
  }

  clear(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.storagePrefix)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      logger.error('[Storage] Failed to clear storage:', error);
    }
  }

  private handleQuotaExceeded(failedKey: string): void {
    logger.warn(`[Storage] Attempting to free up space for ${failedKey}`);
    const keys = Object.keys(localStorage);
    const appKeys = keys.filter(key => key.startsWith(this.storagePrefix));

    if (appKeys.length > 0) {
      const oldestKey = appKeys[0];
      localStorage.removeItem(oldestKey);
      logger.info(`[Storage] Removed oldest item: ${oldestKey}`);
    }
  }

  getStorageSize(): number {
    let total = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key) && key.startsWith(this.storagePrefix)) {
        total += localStorage[key].length + key.length;
      }
    }
    return total;
  }

  getStorageSizeFormatted(): string {
    const bytes = this.getStorageSize();
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}

export const storage = StorageService.getInstance();
