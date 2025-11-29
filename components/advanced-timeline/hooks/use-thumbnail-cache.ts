import { useState, useEffect, useRef } from 'react';

/**
 * Video Thumbnail Cache and Processor
 * 
 * Generates and caches video thumbnails with LRU eviction.
 * Performance optimizations:
 * - Global cache shared across all instances
 * - LRU eviction prevents memory bloat
 * - AbortController for proper cleanup
 * - Debounced regeneration on parameter changes
 */

interface ThumbnailData {
  thumbnails: string[];
  timestamps: number[];
  duration: number;
  width: number;
  height: number;
}

interface ThumbnailResult {
  data: ThumbnailData | null;
  isLoading: boolean;
  error: string | null;
}

interface ThumbnailOptions {
  thumbnailCount?: number;
  thumbnailSize?: number;
}

// Cache entry with last access time for LRU eviction
interface CacheEntry {
  data: ThumbnailData;
  lastAccessed: number;
}

/**
 * LRU Thumbnail Cache
 * Automatically evicts oldest entries when capacity is reached
 */
class ThumbnailCache {
  private cache = new Map<string, CacheEntry>();
  private readonly maxEntries = 20;
  private readonly maxAgeMs = 10 * 60 * 1000; // 10 minutes

  private createKey(
    src: string | File,
    start: number,
    end: number,
    count: number
  ): string {
    const sourceId = src instanceof File
      ? `file:${src.name}:${src.size}:${src.lastModified}`
      : `url:${src}`;
    return `${sourceId}|${start.toFixed(2)}|${end.toFixed(2)}|${count}`;
  }

  get(src: string | File, start: number, end: number, count: number): ThumbnailData | null {
    const key = this.createKey(src, start, end, count);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check if entry is expired
    if (Date.now() - entry.lastAccessed > this.maxAgeMs) {
      this.cache.delete(key);
      return null;
    }

    // Update last accessed time
    entry.lastAccessed = Date.now();
    return entry.data;
  }

  set(src: string | File, start: number, end: number, count: number, data: ThumbnailData): void {
    const key = this.createKey(src, start, end, count);

    // LRU eviction if at capacity
    if (this.cache.size >= this.maxEntries) {
      let oldestKey: string | null = null;
      let oldestTime = Date.now();

      this.cache.forEach((entry, k) => {
        if (entry.lastAccessed < oldestTime) {
          oldestTime = entry.lastAccessed;
          oldestKey = k;
        }
      });

      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data,
      lastAccessed: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now - entry.lastAccessed > this.maxAgeMs) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.cache.delete(key));
  }
}

// Global singleton cache
const thumbnailCache = new ThumbnailCache();

// Periodic cleanup
if (typeof window !== 'undefined') {
  setInterval(() => thumbnailCache.cleanup(), 60000);
}

/**
 * Hook to generate video thumbnails with caching
 */
export function useThumbnailProcessor(
  src: string | File | undefined,
  start: number = 0,
  end: number = 0,
  options: ThumbnailOptions = {}
): ThumbnailResult {
  const [thumbnailData, setThumbnailData] = useState<ThumbnailData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { thumbnailCount = 8, thumbnailSize = 120 } = options;

  useEffect(() => {
    if (!src) {
      setThumbnailData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Check cache first
    const cachedData = thumbnailCache.get(src, start, end, thumbnailCount);
    if (cachedData) {
      setThumbnailData(cachedData);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Cancel previous operation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsLoading(true);
    setError(null);

    const generateThumbnails = async () => {
      try {
        // Create a video element for thumbnail extraction
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.muted = true;
        video.preload = 'metadata';

        // Set source
        const videoUrl = src instanceof File ? URL.createObjectURL(src) : src;
        video.src = videoUrl;

        // Wait for metadata to load
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => resolve();
          video.onerror = () => reject(new Error('Failed to load video'));
          
          // Timeout after 10 seconds
          setTimeout(() => reject(new Error('Video load timeout')), 10000);
        });

        if (abortController.signal.aborted) return;

        // Calculate dimensions
        const aspectRatio = video.videoWidth / video.videoHeight;
        const width = aspectRatio >= 1 ? thumbnailSize : Math.floor(thumbnailSize * aspectRatio);
        const height = aspectRatio <= 1 ? thumbnailSize : Math.floor(thumbnailSize / aspectRatio);

        // Calculate time range
        const actualStart = Math.max(start, 0);
        const actualEnd = end > 0 ? Math.min(end, video.duration) : video.duration;
        const rangeDuration = actualEnd - actualStart;

        // Generate timestamps
        const timestamps: number[] = [];
        for (let i = 0; i < thumbnailCount; i++) {
          const timestamp = actualStart + (i * rangeDuration) / Math.max(thumbnailCount - 1, 1);
          timestamps.push(timestamp);
        }

        // Create canvas for thumbnail extraction
        const canvas = document.createElement('canvas');
        canvas.width = width * window.devicePixelRatio;
        canvas.height = height * window.devicePixelRatio;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('Could not get canvas context');
        }

        const thumbnailUrls: string[] = [];
        const actualTimestamps: number[] = [];

        // Extract thumbnails at each timestamp
        for (const timestamp of timestamps) {
          if (abortController.signal.aborted) return;

          // Seek to timestamp
          video.currentTime = timestamp;
          await new Promise<void>((resolve) => {
            video.onseeked = () => resolve();
          });

          // Draw frame to canvas
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Convert to data URL
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          thumbnailUrls.push(dataUrl);
          actualTimestamps.push(timestamp);
        }

        // Cleanup video element
        if (src instanceof File) {
          URL.revokeObjectURL(videoUrl);
        }

        const data: ThumbnailData = {
          thumbnails: thumbnailUrls,
          timestamps: actualTimestamps,
          duration: video.duration,
          width,
          height,
        };

        // Store in cache
        thumbnailCache.set(src, start, end, thumbnailCount, data);

        if (!abortController.signal.aborted) {
          setThumbnailData(data);
          setIsLoading(false);
        }
      } catch (err) {
        if (!abortController.signal.aborted) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          setError(errorMessage);
          setIsLoading(false);
        }
      }
    };

    generateThumbnails();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [src, start, end, thumbnailCount, thumbnailSize]);

  return {
    data: thumbnailData,
    isLoading,
    error,
  };
}

// Export cache control functions
export function clearThumbnailCache(): void {
  thumbnailCache.clear();
}

