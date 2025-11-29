import { useState, useEffect, useRef } from 'react';

/**
 * Audio Waveform Cache and Processor
 * 
 * Generates and caches audio waveforms for timeline visualization.
 * Performance optimizations:
 * - Global cache shared across all instances
 * - RMS-based peak calculation for smooth visualization
 * - AbortController for proper cleanup
 */

interface WaveformData {
  peaks: number[];
  length: number;
}

interface WaveformResult {
  data: WaveformData | null;
  isLoading: boolean;
  error: string | null;
}

// Global waveform cache
const waveformCache = new Map<string, WaveformData>();

/**
 * Hook to process audio waveforms with caching
 */
export function useWaveformProcessor(
  src: string | undefined,
  startTime: number = 0,
  duration: number
): WaveformResult {
  const [waveformData, setWaveformData] = useState<WaveformData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Clear previous data
    setWaveformData(null);

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (!src || duration <= 0) {
      setIsLoading(false);
      setError(null);
      return;
    }

    // Check cache first
    const cacheKey = `${src}:${startTime.toFixed(3)}:${duration.toFixed(3)}`;
    const cachedData = waveformCache.get(cacheKey);
    if (cachedData) {
      setWaveformData(cachedData);
      setIsLoading(false);
      setError(null);
      return;
    }

    const generateWaveform = async () => {
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(src, { signal: abortController.signal });
        const arrayBuffer = await response.arrayBuffer();

        if (abortController.signal.aborted) return;

        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        if (abortController.signal.aborted) {
          await audioContext.close();
          return;
        }

        const sampleRate = audioBuffer.sampleRate;
        const channelData = audioBuffer.getChannelData(0);

        // Calculate sample range for requested time slice
        const startSample = Math.floor(startTime * sampleRate);
        const endSample = Math.floor((startTime + duration) * sampleRate);
        const clampedStartSample = Math.max(0, Math.min(startSample, channelData.length));
        const clampedEndSample = Math.max(clampedStartSample, Math.min(endSample, channelData.length));

        // Generate peaks (~100 peaks per second of audio)
        const targetPeaks = Math.max(10, Math.floor(duration * 100));
        const samplesPerPeak = Math.max(1, Math.floor((clampedEndSample - clampedStartSample) / targetPeaks));

        const peaks: number[] = [];

        for (let i = clampedStartSample; i < clampedEndSample; i += samplesPerPeak) {
          const end = Math.min(i + samplesPerPeak, clampedEndSample);

          // Calculate RMS for this segment
          let sum = 0;
          let count = 0;

          for (let j = i; j < end; j++) {
            if (j < channelData.length) {
              const sample = Math.abs(channelData[j]);
              sum += sample * sample;
              count++;
            }
          }

          const rms = count > 0 ? Math.sqrt(sum / count) : 0;
          peaks.push(rms);
        }

        // Normalize peaks
        const maxPeak = Math.max(...peaks, 0.001);
        const normalizedPeaks = peaks.map((peak) => peak / maxPeak);

        const result: WaveformData = {
          peaks: normalizedPeaks,
          length: clampedEndSample - clampedStartSample,
        };

        // Store in cache
        waveformCache.set(cacheKey, result);

        await audioContext.close();

        if (!abortController.signal.aborted) {
          setWaveformData(result);
          setIsLoading(false);
        }
      } catch (err) {
        // Don't log AbortError as it's expected
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        console.error('Error processing waveform:', err);

        if (!abortControllerRef.current?.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setIsLoading(false);
        }
      }
    };

    generateWaveform();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [src, startTime, duration]);

  return {
    data: waveformData,
    isLoading,
    error,
  };
}

// Export cache control function
export function clearWaveformCache(): void {
  waveformCache.clear();
}

