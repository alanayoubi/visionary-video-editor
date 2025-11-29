/**
 * Bunny.net Stream Service for video uploads
 * Handles uploading large videos to Bunny Stream CDN
 */

const BUNNY_API_KEY = import.meta.env.VITE_BUNNY_API_KEY;
const BUNNY_LIBRARY_ID = import.meta.env.VITE_BUNNY_LIBRARY_ID;
const BUNNY_CDN_HOSTNAME = import.meta.env.VITE_BUNNY_CDN_HOSTNAME;

export interface BunnyVideoResult {
  videoId: string;
  playbackUrl: string;
  thumbnailUrl: string;
  directPlayUrl: string;
}

export interface BunnyUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

/**
 * Create a new video entry in Bunny Stream library
 */
const createVideoEntry = async (title: string): Promise<string> => {
  const response = await fetch(
    `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos`,
    {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'AccessKey': BUNNY_API_KEY,
      },
      body: JSON.stringify({ title }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create Bunny video entry: ${error}`);
  }

  const data = await response.json();
  return data.guid;
};

/**
 * Upload video file to Bunny Stream
 */
const uploadVideoFile = async (
  videoId: string,
  file: File,
  onProgress?: (progress: BunnyUploadProgress) => void
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress({
          loaded: event.loaded,
          total: event.total,
          percentage: Math.round((event.loaded / event.total) * 100),
        });
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload aborted'));
    });

    xhr.open('PUT', `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${videoId}`);
    xhr.setRequestHeader('AccessKey', BUNNY_API_KEY);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.send(file);
  });
};

/**
 * Get video playback URLs from Bunny CDN
 */
const getVideoUrls = (videoId: string): { playbackUrl: string; thumbnailUrl: string; directPlayUrl: string } => {
  return {
    playbackUrl: `https://${BUNNY_CDN_HOSTNAME}/${videoId}/playlist.m3u8`,
    thumbnailUrl: `https://${BUNNY_CDN_HOSTNAME}/${videoId}/thumbnail.jpg`,
    directPlayUrl: `https://${BUNNY_CDN_HOSTNAME}/${videoId}/play_720p.mp4`,
  };
};

/**
 * Upload a video to Bunny Stream
 * @param file - The video file to upload
 * @param title - Title for the video (defaults to filename)
 * @param onProgress - Optional callback for upload progress
 * @returns Video URLs and metadata
 */
export const uploadVideoToBunny = async (
  file: File,
  title?: string,
  onProgress?: (progress: BunnyUploadProgress) => void
): Promise<BunnyVideoResult> => {
  if (!BUNNY_API_KEY || !BUNNY_LIBRARY_ID || !BUNNY_CDN_HOSTNAME) {
    throw new Error('Bunny configuration missing. Please set VITE_BUNNY_API_KEY, VITE_BUNNY_LIBRARY_ID, and VITE_BUNNY_CDN_HOSTNAME in .env.local');
  }

  const videoTitle = title || file.name.replace(/\.[^/.]+$/, '');
  
  // Step 1: Create video entry
  const videoId = await createVideoEntry(videoTitle);
  
  // Step 2: Upload the file
  await uploadVideoFile(videoId, file, onProgress);
  
  // Step 3: Get playback URLs
  const urls = getVideoUrls(videoId);
  
  return {
    videoId,
    ...urls,
  };
};

/**
 * Delete a video from Bunny Stream
 */
export const deleteVideoFromBunny = async (videoId: string): Promise<void> => {
  if (!BUNNY_API_KEY || !BUNNY_LIBRARY_ID) {
    throw new Error('Bunny configuration missing');
  }

  const response = await fetch(
    `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${videoId}`,
    {
      method: 'DELETE',
      headers: {
        'AccessKey': BUNNY_API_KEY,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to delete Bunny video: ${error}`);
  }
};

/**
 * Get video encoding status from Bunny Stream
 */
export const getVideoStatus = async (videoId: string): Promise<{
  status: number;
  encodeProgress: number;
  isAvailable: boolean;
}> => {
  if (!BUNNY_API_KEY || !BUNNY_LIBRARY_ID) {
    throw new Error('Bunny configuration missing');
  }

  const response = await fetch(
    `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${videoId}`,
    {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'AccessKey': BUNNY_API_KEY,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get video status: ${error}`);
  }

  const data = await response.json();
  
  // Status: 0 = Created, 1 = Uploaded, 2 = Processing, 3 = Transcoding, 4 = Finished, 5 = Error
  return {
    status: data.status,
    encodeProgress: data.encodeProgress || 0,
    isAvailable: data.status === 4,
  };
};

/**
 * Check if Bunny is properly configured
 */
export const isBunnyConfigured = (): boolean => {
  return !!(BUNNY_API_KEY && BUNNY_LIBRARY_ID && BUNNY_CDN_HOSTNAME);
};

