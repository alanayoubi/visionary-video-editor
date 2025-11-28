
import { Clip } from '../types';

/**
 * Renders the final video using a High-Res Canvas Recorder.
 * This method works by:
 * 1. Creating an offscreen canvas matching the SOURCE video dimensions (e.g. 4K).
 * 2. Creating a hidden video element and audio element.
 * 3. Playing the sequence programmatically in real-time.
 * 4. Capturing the stream into a MediaRecorder.
 */
export const renderVideo = async (
    videoFile: File,
    masterAudioBlobUrl: string | null,
    clips: Clip[],
    onProgress: (progress: number, message: string) => void
): Promise<Blob> => {
    
    return new Promise(async (resolve, reject) => {
        let animationFrameId: number;
        let isFinished = false;

        // Create references to elements we need to clean up
        let video: HTMLVideoElement | null = null;
        let canvas: HTMLCanvasElement | null = null;
        let audioElement: HTMLAudioElement | null = null;
        let audioCtx: AudioContext | null = null;

        const cleanup = () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            if (video) {
                video.pause();
                video.src = "";
                video.load();
                video.remove(); // Remove from DOM
            }
            if (audioElement) {
                audioElement.pause();
                audioElement.src = "";
                audioElement.load();
                audioElement.remove();
            }
            if (canvas) canvas.remove();
            if (audioCtx && audioCtx.state !== 'closed') audioCtx.close();
        };

        try {
            // 1. Setup Resources
            const videoUrl = URL.createObjectURL(videoFile);
            
            // DOM ATTACHMENT FIX:
            // Browsers stop decoding frames for offscreen videos after ~60 seconds to save power.
            // We must append the video to the body to force the browser to keep it "active".
            video = document.createElement('video');
            video.src = videoUrl;
            video.muted = true; // We handle audio separately via Web Audio API
            video.playsInline = true;
            video.crossOrigin = "anonymous";
            
            // Make it technically "visible" but hidden from user view
            video.style.position = 'fixed';
            video.style.top = '0';
            video.style.left = '0';
            video.style.width = '1px';
            video.style.height = '1px';
            video.style.opacity = '0.001';
            video.style.pointerEvents = 'none';
            video.style.zIndex = '-9999';
            document.body.appendChild(video);
            
            // Preload video
            await video.play().then(() => video.pause()); 

            // Wait for metadata to get true resolution
            if (video.videoWidth === 0) {
                await new Promise(r => video!.onloadedmetadata = r);
            }
            
            const width = video.videoWidth;
            const height = video.videoHeight;
            
            // Calculate precise duration
            const totalDuration = clips.reduce((acc, c) => {
                if(c.audioStartTime !== undefined && c.audioEndTime !== undefined) {
                    return acc + (c.audioEndTime - c.audioStartTime);
                }
                return acc + (c.endTime - c.startTime);
            }, 0);

            console.log(`Render Setup: ${width}x${height}, Duration: ${totalDuration}s`);
            onProgress(1, `Initializing ${width}x${height} render engine...`);

            // 2. Setup Canvas & Context
            canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d', { alpha: false });
            if (!ctx) throw new Error("Could not create canvas context");

            // Fill black initially
            ctx.fillStyle = "#000000";
            ctx.fillRect(0, 0, width, height);

            // 3. Setup Audio Context (The Mixer)
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            audioCtx = new AudioContextClass();
            const dest = audioCtx.createMediaStreamDestination();
            
            let audioSourceNode: MediaElementAudioSourceNode | null = null;
            
            if (masterAudioBlobUrl) {
                audioElement = new Audio(masterAudioBlobUrl);
                audioElement.crossOrigin = "anonymous";
                audioSourceNode = audioCtx.createMediaElementSource(audioElement);
                audioSourceNode.connect(dest);
                // audioSourceNode.connect(audioCtx.destination); // Optional: Mute during export to avoid noise
            } else {
                // If no master audio, try to capture video audio
                try {
                   video.muted = false;
                   video.volume = 1.0;
                   const vSource = audioCtx.createMediaElementSource(video);
                   vSource.connect(dest);
                } catch(e) {
                    console.warn("Could not attach video audio source", e);
                }
            }

            // 4. Setup Recorder
            // OPTIMIZATION: Use 30 FPS instead of 60 FPS for 4K exports.
            // 60FPS at 4K can choke the main thread during composition, causing sync drifts.
            const canvasStream = canvas.captureStream(30); 
            const combinedTracks = [
                ...canvasStream.getVideoTracks(),
                ...dest.stream.getAudioTracks()
            ];
            const combinedStream = new MediaStream(combinedTracks);

            // Try to use high-quality codecs
            let mimeType = 'video/webm;codecs=vp9';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'video/webm;codecs=vp8'; // Fallback
            }
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'video/webm'; // Generic fallback
            }

            const recorder = new MediaRecorder(combinedStream, {
                mimeType,
                // OPTIMIZATION: 15 Mbps is sufficient for 4K delivery (YouTube recommends 12-15).
                // Lowering from 25 Mbps reduces encoder pressure on long files.
                videoBitsPerSecond: 15000000 
            });

            const chunks: BlobPart[] = [];
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            recorder.onstop = () => {
                console.log("Recorder Stopped. Finalizing Blob...");
                const blob = new Blob(chunks, { type: 'video/webm' });
                cleanup();
                resolve(blob);
            };

            // 5. Shared Finish Logic
            const finishRender = () => {
                if (isFinished) return;
                isFinished = true;
                
                console.log("Finishing Render...");
                if (animationFrameId) cancelAnimationFrame(animationFrameId);

                if (audioElement) audioElement.pause();
                video!.pause();

                if (recorder.state === 'recording') {
                    recorder.stop();
                }
            };

            // Hook up Audio End Event (Critical for preventing "Stuck at 99%")
            if (audioElement) {
                audioElement.onended = () => {
                    console.log("Audio ended event received.");
                    finishRender();
                };
            }

            recorder.start();

            // 6. The Render Loop
            let startTime = Date.now();
            
            if (audioElement) {
                await audioElement.play();
            } else {
                video.play(); 
            }

            const renderLoop = async () => {
                if (isFinished || !video || !canvas || !ctx) return;

                // Determine Current Time in Sequence
                let currentTime = 0;
                if (audioElement) {
                    currentTime = audioElement.currentTime;
                } else {
                    currentTime = (Date.now() - startTime) / 1000;
                }

                // Progress Update
                const pct = Math.min(100, Math.round((currentTime / totalDuration) * 100));
                onProgress(pct, `Rendering... ${pct}%`);

                // Check End Conditions
                // 1. Audio Explicitly Done
                const isAudioFinished = audioElement && audioElement.ended;
                
                // 2. Time Threshold (Use a small tolerance of 100ms)
                const isTimeFinished = currentTime >= (totalDuration - 0.1);
                
                if (isAudioFinished || isTimeFinished) {
                    finishRender();
                    return;
                }

                // FIND ACTIVE CLIP
                let foundClip = false;
                let accumulatedTime = 0;

                for (const clip of clips) {
                    const clipDur = (clip.audioEndTime !== undefined && clip.audioStartTime !== undefined)
                        ? (clip.audioEndTime - clip.audioStartTime)
                        : (clip.endTime - clip.startTime);
                    
                    if (currentTime >= accumulatedTime && currentTime < accumulatedTime + clipDur) {
                        foundClip = true;
                        
                        // Calculate Time INSIDE Clip
                        const timeInClip = currentTime - accumulatedTime;
                        
                        // Sync Video
                        let targetVideoTime = 0;
                        let requiredRate = 1.0;

                        if (masterAudioBlobUrl && clip.audioStartTime !== undefined) {
                            // Audio-Driven Sync
                            const relativeAudioTime = (clip.audioStartTime + timeInClip) - clip.audioStartTime;
                            const audioTotalDur = clip.audioEndTime! - clip.audioStartTime!;
                            const videoTotalDur = clip.endTime - clip.startTime;
                            const progress = relativeAudioTime / audioTotalDur;
                            
                            targetVideoTime = clip.startTime + (progress * videoTotalDur);
                            requiredRate = (videoTotalDur / audioTotalDur) * (audioElement?.playbackRate || 1);
                        } else {
                            // Video-Driven Sync
                            targetVideoTime = clip.startTime + timeInClip;
                            requiredRate = 1.0;
                        }

                        // Apply to Video Element
                        video.playbackRate = Math.max(0.1, Math.min(4.0, requiredRate)); 
                        
                        // Drift Correction
                        // We use a looser threshold (0.2s) during export to prevent constant seeking stutter
                        const drift = Math.abs(video.currentTime - targetVideoTime);
                        if (drift > 0.2) { 
                            video.currentTime = targetVideoTime;
                        }

                        if (video.paused) await video.play();

                        break;
                    }
                    accumulatedTime += clipDur;
                }

                if (!foundClip) {
                     // We are in a gap or done.
                }

                // Draw Frame
                ctx.drawImage(video, 0, 0, width, height);

                animationFrameId = requestAnimationFrame(renderLoop);
            };

            // Start Loop
            startTime = Date.now(); 
            renderLoop();

        } catch (e) {
            cleanup();
            reject(e);
        }
    });
};
