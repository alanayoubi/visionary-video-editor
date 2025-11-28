
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { APP_NAME, MAX_VIDEO_SIZE_MB, LOOM_APP_ID } from './constants';
import { generateId, getYouTubeId, getLoomId, parseTime, formatTime, base64ToArrayBuffer, audioBufferToWav } from './utils';
import { sendMessageToGemini, uploadMedia, generateVideoTimeline, detectSilenceAndInactivity } from './services/geminiService';
import { polishClipTranscriptsWithClaude } from './services/claudeService';
import { fetchVoices, generateSpeech, generateSpeechWithTimestamps, AlignmentData } from './services/elevenLabsService';
import { renderVideo } from './services/ffmpegService'; // Now exports renderVideo (Canvas Recorder)
import { fetchLoomVideo } from './services/scraperService';
import { Message, Sender, VideoFile, Clip, TimelineEvent, ElevenLabsVoice, AppSettings, VisualFragment } from './types';
import {
  ProjectRecord,
  createProject,
  listProjects,
  loadProjectWithState,
  saveProjectState,
  updateProjectMetadata,
  uploadProjectAsset,
  downloadProjectAsset,
  clearProjectMasterAudio,
  getAssetPublicUrl,
  touchProject,
  bumpProjectUpdatedAt
} from './services/projectService';
import { marked } from 'marked';

// --- Icons ---
const UploadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 mb-3 text-indigo-500">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
  </svg>
);

const RecordIcon = ({ isRecording }: { isRecording: boolean }) => (
  isRecording ? (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 animate-pulse text-red-500">
      <path fillRule="evenodd" d="M4.5 7.5a3 3 0 013-3h9a3 3 0 013 3v9a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9z" clipRule="evenodd" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm14.024-.983a1.125 1.125 0 010 1.966l-5.603 3.113A1.125 1.125 0 019 15.113V8.887c0-.857.921-1.4 1.671-.983l5.603 3.113z" clipRule="evenodd" />
    </svg>
  )
);

const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
  </svg>
);

const ScissorsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M5.625 4.5a2.625 2.625 0 102.625 2.625h2.55a4.49 4.49 0 01-.137.915 2.622 2.622 0 00-2.31 1.71h-2.728a2.625 2.625 0 100 1.5h2.728a2.623 2.623 0 002.31 1.71h.137a4.488 4.488 0 01.137.915h-2.55A2.625 2.625 0 105.625 19.5a2.625 2.625 0 002.625-2.625V16.5a.75.75 0 011.5 0v.375a4.125 4.125 0 11-8.25 0V16.5a.75.75 0 011.5 0v.375a2.625 2.625 0 002.625 2.625zm12.75 0a2.625 2.625 0 10-2.625 2.625h-2.55a4.488 4.488 0 01.137.915h.138a2.622 2.622 0 002.31 1.71h2.728a2.625 2.625 0 100 1.5h-2.728a2.623 2.623 0 00-2.31 1.71h-.137a4.49 4.49 0 01-.137.915h2.55A2.625 2.625 0 1018.375 19.5a2.625 2.625 0 00-2.625-2.625V16.5a.75.75 0 01-1.5 0v.375a4.125 4.125 0 118.25 0V16.5a.75.75 0 01-1.5 0v.375a2.625 2.625 0 00-2.625 2.625z" />
  </svg>
);

const PlayIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
  </svg>
);

const PauseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
  </svg>
);

const SkipBackIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M9.195 18.44c1.25.713 2.805-.19 2.805-1.629v-2.34l6.945 3.968c1.25.714 2.805-.188 2.805-1.628V8.688c0-1.44-1.555-2.342-2.805-1.628L12 11.03v-2.34c0-1.44-1.555-2.343-2.805-1.629l-7.108 4.062c-1.26.72-1.26 2.536 0 3.256l7.108 4.061z" />
    </svg>
);

const SkipForwardIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M14.805 5.56c-1.25-.714-2.805.189-2.805 1.628v2.34l-6.945-3.968C3.805 4.846 2.25 5.748 2.25 7.188v10.324c0 1.44 1.555 2.342 2.805 1.628L12 15.195v2.34c0 1.44 1.555 2.343 2.805 1.629l7.108-4.061c1.26-.72 1.26-2.536 0-3.256l-7.108-4.062z" />
    </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
     <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.636-1.452zM12.75 16.5a.75.75 0 00-1.5 0v-6a.75.75 0 001.5 0v6zM9.75 16.5a.75.75 0 00-1.5 0v-6a.75.75 0 001.5 0v6z" clipRule="evenodd" />
  </svg>
);

const ArrowLeftIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
        <path fillRule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z" clipRule="evenodd" />
    </svg>
);

const ArrowRightIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
        <path fillRule="evenodd" d="M16.28 11.47a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 01-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 011.06-1.06l7.5 7.5z" clipRule="evenodd" />
    </svg>
);

const LoadingSpinner = () => (
  <svg className="animate-spin h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const WarningIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-rose-500">
    <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
  </svg>
);

const MoonIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-amber-500">
        <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
    </svg>
);

const SparkleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white">
    <path fillRule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813a3.75 3.75 0 002.576-2.576l.813-2.846A.75.75 0 019 4.5zM9 15a.75.75 0 01.75.75v1.5h1.5a.75.75 0 010 1.5h-1.5v1.5a.75.75 0 01-1.5 0v-1.5h-1.5a.75.75 0 010-1.5h1.5v-1.5A.75.75 0 019 15z" clipRule="evenodd" />
  </svg>
);

const WandIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-emerald-300">
        <path fillRule="evenodd" d="M9.315 7.584C12.195 3.883 16.695 1.5 21.75 1.5a.75.75 0 01.75.75c0 5.056-2.383 9.555-6.084 12.436h.001c-3.3 2.567-7.228 4.192-11.47 4.717a.75.75 0 01-.26-1.488c3.962-.49 7.64-2.008 10.73-4.406A17.927 17.927 0 0020.213 2.787a17.927 17.927 0 00-10.814 10.73 24.22 24.22 0 01-4.406 10.73.75.75 0 11-1.488-.26c.525-4.242 2.15-8.17 4.717-11.47Z" clipRule="evenodd" />
        <path d="M2.25 10.5a.75.75 0 01.75-.75h.75a.75.75 0 010 1.5h-.75a.75.75 0 01-.75-.75zm0 3a.75.75 0 01.75-.75h.75a.75.75 0 010 1.5h-.75a.75.75 0 01-.75-.75zm4.5 4.5a.75.75 0 01.75-.75h.75a.75.75 0 010 1.5h-.75a.75.75 0 01-.75-.75z" />
    </svg>
);

const SettingsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.922-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clipRule="evenodd" />
  </svg>
);

const SpeakerWaveIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white">
        <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
        <path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.06z" />
    </svg>
);

const ArrowDownTrayIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M12 2.25a.75.75 0 01.75.75v11.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06l3.22 3.22V3a.75.75 0 01.75-.75zm-9 13.5a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
    </svg>
);

const PencilIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
        <path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32L19.513 8.2z" />
    </svg>
);

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-emerald-400">
        <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 011.04-.207z" clipRule="evenodd" />
    </svg>
);

const XMarkIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-rose-400">
        <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd" />
    </svg>
);


type ImportMode = 'upload' | 'weblink';
type Tab = 'chat' | 'clips';

// --- Global Helpers ---

// Calculate duration of a clip
const getClipDuration = (clip: Clip) => {
    // If master audio exists for this clip, use that duration
    if (clip.audioStartTime !== undefined && clip.audioEndTime !== undefined) {
        return clip.audioEndTime - clip.audioStartTime;
    }
    // Fallback to visual duration
    return clip.endTime - clip.startTime;
};

// Map "Time relative to clip start (0s)" -> "Time in Video File"
const getVideoTimeFromClipTime = (clipTime: number, clip: Clip) => {
    return clip.startTime + clipTime;
};

const MAX_VIDEO_RATE = 1.5; // Cap playback speed at 1.5x for readability

const DEFAULT_ELEVEN_LABS_SETTINGS: AppSettings = {
  elevenLabsApiKey: '',
  elevenLabsVoiceId: '',
  elevenLabsModelId: 'eleven_multilingual_v2',
  elevenLabsStability: 0.5,
  elevenLabsSimilarity: 0.75,
  elevenLabsStyle: 0.0,
  elevenLabsSpeakerBoost: true,
  elevenLabsVolume: 1.0,
  elevenLabsSpeed: 1.0
};

export default function App() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeProject, setActiveProject] = useState<ProjectRecord | null>(null);
  const [isLoadingProjectState, setIsLoadingProjectState] = useState(false);
  const [projectInitialized, setProjectInitialized] = useState(false);
  const [snapshotVersion, setSnapshotVersion] = useState(0);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [video, setVideo] = useState<VideoFile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeepScanning, setIsDeepScanning] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [isDetectingSilence, setIsDetectingSilence] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>('upload');
  
  // ElevenLabs State
  const [showSettings, setShowSettings] = useState(false);
  const [elevenLabsSettings, setElevenLabsSettings] = useState<AppSettings>({ ...DEFAULT_ELEVEN_LABS_SETTINGS });
  const [availableVoices, setAvailableVoices] = useState<ElevenLabsVoice[]>([]);
  const [generatingAudioForClipId, setGeneratingAudioForClipId] = useState<string | null>(null);
  const [isGeneratingAllAudio, setIsGeneratingAllAudio] = useState(false);
  const [masterAudioUrl, setMasterAudioUrl] = useState<string | null>(null);

  // Web Link & Recording State
  const [externalUrl, setExternalUrl] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  
  // Timeline / Clips State
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [clips, setClips] = useState<Clip[]>([]);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  
  // Edit Clip State
  const [editingClipId, setEditingClipId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  // Custom Sequencer Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSequenceTime, setCurrentSequenceTime] = useState(0);

  // Structured Timeline Data (from AI)
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);

  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportMessage, setExportMessage] = useState("Initializing...");



  const refreshProjectList = useCallback(async () => {
      try {
          setIsLoadingProjects(true);
          const items = await listProjects();
          setProjects(items);
      } catch (error: any) {
          console.error('Failed to load projects', error);
          setProjectError(error.message || 'Failed to load projects');
      } finally {
          setIsLoadingProjects(false);
      }
  }, []);

  useEffect(() => {
      refreshProjectList();
  }, [refreshProjectList]);

  const loadProjectContext = useCallback(async (projectId: string) => {
      setIsLoadingProjectState(true);
      setProjectError(null);
      setProjectInitialized(false);
      try {
          const result = await loadProjectWithState(projectId);
          const project = result.project;
          const state = result.state;
          setActiveProject(project);
          setActiveProjectId(projectId);

          if (project.videoStoragePath) {
              const blob = await downloadProjectAsset(project.videoStoragePath);
              const fileName = project.videoFileName || `project-${projectId}.mp4`;
              const mimeType = project.videoMimeType || blob.type || 'video/mp4';
              const reconstructedFile = new File([blob], fileName, { type: mimeType });
              const previewUrl = URL.createObjectURL(blob);
              setVideo({
                  file: reconstructedFile,
                  previewUrl,
                  fileUri: project.videoFileUri || '',
                  mimeType,
                  storagePath: project.videoStoragePath,
                  storageUrl: previewUrl,
                  fileName
              });
          } else {
              setVideo(null);
          }

          setMessages(state?.messages ?? []);
          setClips(state?.clips ?? []);
          setTimelineEvents(state?.timelineEvents ?? []);
          setHasAnalyzed(state?.hasAnalyzed ?? false);
          setActiveClipId(state?.activeClipId ?? null);
          setCurrentSequenceTime(0);
          const savedTab = state?.editorMeta?.activeTab;
          setActiveTab(savedTab === 'clips' ? 'clips' : 'chat');
          const savedImportMode = state?.editorMeta?.importMode === 'weblink' ? 'weblink' : 'upload';
          setImportMode(savedImportMode);
          setElevenLabsSettings({ ...DEFAULT_ELEVEN_LABS_SETTINGS, ...(state?.settings || {}) });
          if (project.masterAudioStoragePath) {
              setMasterAudioUrl(getAssetPublicUrl(project.masterAudioStoragePath));
          } else {
              setMasterAudioUrl(null);
          }

          await touchProject(projectId);
          setProjectInitialized(true);
          setSnapshotVersion(0);
          setAutoSaveStatus('idle');
          setLastSavedAt(Date.now());
      } catch (error: any) {
          console.error('Failed to load project', error);
          setProjectError(error.message || 'Failed to load project');
      } finally {
          setIsLoadingProjectState(false);
      }
  }, []);

  const handleCreateProject = useCallback(async () => {
      const name = prompt('Project name');
      if (!name || !name.trim()) return;
      try {
          const project = await createProject(name.trim());
          setProjects(prev => [project, ...prev]);
          await loadProjectContext(project.id);
      } catch (error: any) {
          console.error('Failed to create project', error);
          setProjectError(error.message || 'Failed to create project');
      }
  }, [loadProjectContext]);

  const handleOpenProject = useCallback(async (projectId: string) => {
      await loadProjectContext(projectId);
  }, [loadProjectContext]);

  const handleBackToProjects = useCallback(() => {
      setActiveProjectId(null);
      setActiveProject(null);
      setProjectInitialized(false);
      setVideo(null);
      setMessages([]);
      setClips([]);
      setTimelineEvents([]);
      setHasAnalyzed(false);
      setActiveClipId(null);
      setMasterAudioUrl(null);
      setElevenLabsSettings({ ...DEFAULT_ELEVEN_LABS_SETTINGS });
      refreshProjectList();
  }, [refreshProjectList]);

  const projectReady = !!activeProjectId && projectInitialized;

  const invalidateMasterAudio = useCallback(() => {
      setMasterAudioUrl(null);
      if (activeProjectId) {
          clearProjectMasterAudio(activeProjectId).catch((err) => console.error('Failed to clear master audio', err));
          setActiveProject(prev => prev ? {
              ...prev,
              masterAudioStoragePath: null,
              masterAudioMimeType: null,
              hasMasterAudio: false
          } : prev);
      }
  }, [activeProjectId]);

  useEffect(() => {
      if (!projectReady) return;
      setSnapshotVersion(prev => prev + 1);
  }, [projectReady, messages, clips, timelineEvents, hasAnalyzed, activeClipId, elevenLabsSettings, masterAudioUrl]);

  useEffect(() => {
      if (!projectReady || snapshotVersion === 0 || !activeProjectId) return;
      const timeout = setTimeout(async () => {
          try {
              setAutoSaveStatus('saving');
              await saveProjectState(activeProjectId, {
                  messages,
                  clips,
                  timelineEvents,
                  settings: elevenLabsSettings,
                  hasAnalyzed,
                  activeClipId,
                  masterAudioMeta: masterAudioUrl && activeProject?.masterAudioStoragePath ? {
                      storagePath: activeProject.masterAudioStoragePath,
                      mimeType: activeProject.masterAudioMimeType,
                      url: masterAudioUrl
                  } : null,
                  editorMeta: {
                      activeTab,
                      importMode
                  }
              });
              await bumpProjectUpdatedAt(activeProjectId);
              setAutoSaveStatus('saved');
              setLastSavedAt(Date.now());
          } catch (error) {
              console.error('Auto-save failed', error);
              setAutoSaveStatus('error');
          }
      }, 1500);
      return () => clearTimeout(timeout);
  }, [snapshotVersion, projectReady, activeProjectId, messages, clips, timelineEvents, elevenLabsSettings, hasAnalyzed, activeClipId, masterAudioUrl, activeTab, importMode, activeProject]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioPlayerRef = useRef<HTMLAudioElement>(null); 
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Lock to prevent multi-firing transitions
  const isTransitioningRef = useRef(false);

  // Derived state for total edited video duration
  const totalSequenceDuration = clips.reduce((acc, c) => acc + getClipDuration(c), 0);

  // Check if we have polished scripts that need audio
  const hasPolishedScripts = clips.some(c => c.improvedTranscript);
  const audioGenerated = !!masterAudioUrl;
  
  // Show banner if we have polished scripts AND audio is NOT generated yet
  const showGenerateAllBanner = hasPolishedScripts && !audioGenerated;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isDeepScanning]);

  // Load available voices if API Key is present
  useEffect(() => {
      if (elevenLabsSettings.elevenLabsApiKey) {
          fetchVoices(elevenLabsSettings.elevenLabsApiKey)
            .then(voices => {
                setAvailableVoices(voices);
                if (voices.length > 0 && !elevenLabsSettings.elevenLabsVoiceId) {
                    setElevenLabsSettings(prev => ({ ...prev, elevenLabsVoiceId: voices[0].voice_id }));
                }
            })
            .catch(err => console.error("Could not fetch voices", err));
      }
  }, [elevenLabsSettings.elevenLabsApiKey]);

  // --- PROFESSIONAL SEQUENCER ENGINE (MASTER AUDIO MODE) ---
  useEffect(() => {
    const vid = videoRef.current;
    const aud = audioPlayerRef.current;
    if (!vid || !aud || !video || clips.length === 0) return;

    // 1. SETUP MEDIA SOURCES
    if (masterAudioUrl) {
        if (aud.src !== masterAudioUrl) {
            aud.src = masterAudioUrl;
            aud.load();
        }
        vid.muted = true;
        vid.volume = 0;
        aud.volume = elevenLabsSettings.elevenLabsVolume;
        // Global speed control on the audio master
        aud.playbackRate = elevenLabsSettings.elevenLabsSpeed;
    } else {
        // Fallback to video audio if no AI audio
        aud.pause();
        vid.muted = false;
        vid.volume = 1.0;
        vid.playbackRate = 1.0;
    }

    if (!activeClipId && clips.length > 0) setActiveClipId(clips[0].id);

    // 2. MASTER AUDIO TIME UPDATE LOOP
    const onAudioTimeUpdate = () => {
        if (!masterAudioUrl || isTransitioningRef.current) return;
        
        const audioTime = aud.currentTime;
        
        // Find which clip we are in
        const currentClipIndex = clips.findIndex(c => 
            c.audioStartTime !== undefined && 
            c.audioEndTime !== undefined && 
            audioTime >= c.audioStartTime && 
            audioTime < c.audioEndTime
        );

        if (currentClipIndex !== -1) {
            const currentClip = clips[currentClipIndex];
            
            // A. Update Active Clip State
            if (currentClip.id !== activeClipId) {
                setActiveClipId(currentClip.id);
            }

            // B. Elastic Video Sync
            const audioDuration = (currentClip.audioEndTime! - currentClip.audioStartTime!);
            const videoDuration = (currentClip.endTime - currentClip.startTime);
            const relativeAudioTime = audioTime - currentClip.audioStartTime!;
            const progress = relativeAudioTime / audioDuration; // 0.0 to 1.0
            
            // Calculate Target Video Time
            const targetVideoTime = currentClip.startTime + (progress * videoDuration);
            
            // Calculate Required Video Rate to match Audio
            // (VideoSegLength / AudioSegLength) * GlobalSpeed
            let requiredRate = (videoDuration / audioDuration) * elevenLabsSettings.elevenLabsSpeed;
            
            // --- RATE CAPPING LOGIC ---
            if (requiredRate > MAX_VIDEO_RATE) {
                 requiredRate = MAX_VIDEO_RATE;
            }
            // Clamp minimum rate
            requiredRate = Math.max(0.1, requiredRate);

            // Apply Sync
            vid.playbackRate = requiredRate;
            
            // Drift Correction (Only seek if drift > 0.2s to avoid jitter)
            if (requiredRate < MAX_VIDEO_RATE) {
                if (Math.abs(vid.currentTime - targetVideoTime) > 0.2) {
                    vid.currentTime = targetVideoTime;
                }
            } else {
                if (vid.currentTime < currentClip.startTime) {
                     vid.currentTime = currentClip.startTime;
                }
            }

            // Ensure video plays
            if (vid.paused && !aud.paused) vid.play().catch(() => {});

            // Update UI Progress Bar
            let accumulatedDuration = 0;
            for(let i=0; i<currentClipIndex; i++) accumulatedDuration += getClipDuration(clips[i]);
            setCurrentSequenceTime(accumulatedDuration + relativeAudioTime);

        } else if (audioTime >= aud.duration - 0.1) {
            // End of Timeline
            setIsPlaying(false);
            aud.pause();
            vid.pause();
            setCurrentSequenceTime(0);
            if (clips.length > 0) {
                setActiveClipId(clips[0].id);
                vid.currentTime = clips[0].startTime;
            }
        }
    };

    // 3. LEGACY VIDEO-MASTER TIME UPDATE LOOP (No AI Audio)
    const onVideoTimeUpdate = () => {
        if (masterAudioUrl) return; 
        
        const currentClipIndex = clips.findIndex(c => c.id === activeClipId);
        if (currentClipIndex === -1) return;
        const currentClip = clips[currentClipIndex];

        const vidTime = vid.currentTime;
        const clipProgress = Math.max(0, vidTime - currentClip.startTime);
        
        // Update UI
        let accumulated = 0;
        for(let i=0; i<currentClipIndex; i++) accumulated += getClipDuration(clips[i]);
        setCurrentSequenceTime(accumulated + clipProgress);

        // Check End
        if (vidTime >= currentClip.endTime) {
            const nextIndex = currentClipIndex + 1;
            if (nextIndex < clips.length) {
                const nextClip = clips[nextIndex];
                setActiveClipId(nextClip.id);
                vid.currentTime = nextClip.startTime;
            } else {
                setIsPlaying(false);
                vid.pause();
                setActiveClipId(clips[0].id);
                vid.currentTime = clips[0].startTime;
                setCurrentSequenceTime(0);
            }
        }
    };

    // 4. BIND LISTENERS
    if (masterAudioUrl) {
        aud.addEventListener('timeupdate', onAudioTimeUpdate);
        
        // Sync Play/Pause/Waiting
        const onPlay = () => vid.play().catch(() => {});
        const onPause = () => vid.pause();
        aud.addEventListener('play', onPlay);
        aud.addEventListener('pause', onPause);
        aud.addEventListener('waiting', onPause);
        aud.addEventListener('playing', onPlay);
        
        return () => {
             aud.removeEventListener('timeupdate', onAudioTimeUpdate);
             aud.removeEventListener('play', onPlay);
             aud.removeEventListener('pause', onPause);
             aud.removeEventListener('waiting', onPause);
             aud.removeEventListener('playing', onPlay);
        };
    } else {
        vid.addEventListener('timeupdate', onVideoTimeUpdate);
        return () => {
            vid.removeEventListener('timeupdate', onVideoTimeUpdate);
        };
    }

  }, [activeClipId, clips, video, masterAudioUrl, elevenLabsSettings.elevenLabsSpeed]);

  // Play Control Effect
  useEffect(() => {
      const vid = videoRef.current;
      const aud = audioPlayerRef.current;
      if (!vid || !aud) return;
      
      const master = masterAudioUrl ? aud : vid;

      if (isPlaying) {
          master.play().catch(e => console.warn("Auto-play blocked", e));
      } else {
          master.pause();
          if (masterAudioUrl) vid.pause();
      }
  }, [isPlaying, masterAudioUrl]); 

  // --- Canvas Recorder Export Handler ---
  const handleExport = async () => {
      if (!video || clips.length === 0 || isExporting) return;
      
      setIsExporting(true);
      setExportProgress(0);
      setExportMessage("Loading render engine...");
      setIsPlaying(false); // Stop playback during export

      try {
          const blob = await renderVideo(
              video.file,
              masterAudioUrl,
              clips,
              (prog, msg) => {
                  setExportProgress(prog);
                  setExportMessage(msg);
              }
          );

          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${video.file.name.split('.')[0]}_Visionary_Render.webm`; // Default to WebM
          a.click();

      } catch (err: any) {
          console.error("Export Error", err);
          alert(`Export failed: ${err.message}`);
      } finally {
          setIsExporting(false);
      }
  };


  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await processVideoFile(file);
  };

  const processVideoFile = async (file: File) => {
    if (!activeProjectId) {
        alert("Please select or create a project before uploading a video.");
        return;
    }

    if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
      alert(`Video too large. Please upload a video smaller than ${MAX_VIDEO_SIZE_MB}MB.`);
      return;
    }

    try {
      setIsUploading(true);
      const url = URL.createObjectURL(file);
      
      const fileUri = await uploadMedia(file);
      
      setVideo({
        file,
        previewUrl: url,
        fileUri,
        mimeType: file.type || 'video/mp4',
        storageUrl: url,
        fileName: file.name
      });
      setTimelineEvents([]);
      setClips([]);
      setHasAnalyzed(false);
      setMessages([]);
      setCurrentSequenceTime(0);
      invalidateMasterAudio(); // Reset audio

      try {
          const uploadResult = await uploadProjectAsset(activeProjectId, file, {
              type: 'video',
              fileName: file.name,
              contentType: file.type || 'video/mp4'
          });
          await updateProjectMetadata(activeProjectId, {
              videoStoragePath: uploadResult.path,
              videoFileName: file.name,
              videoMimeType: file.type || 'video/mp4',
              videoFileUri: fileUri
          });
          setActiveProject(prev => prev ? {
              ...prev,
              videoStoragePath: uploadResult.path,
              videoFileName: file.name,
              videoMimeType: file.type || 'video/mp4',
              videoFileUri: fileUri
          } : prev);
      } catch (storageError) {
          console.error('Failed to persist video to Supabase', storageError);
          alert('Video analyzed but failed to save to database. Please try again.');
      }

    } catch (err: any) {
      console.error(err);
      alert(`Failed to upload video: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const startDeepAnalysis = async () => {
    if (!video) return;

    try {
      setIsDeepScanning(true);
      setActiveTab('clips'); 
      invalidateMasterAudio(); // Reset audio on new analysis

      const systemId = generateId();
      setMessages(prev => [
        ...prev,
        {
            id: systemId,
            role: Sender.Model,
            text: `**Analysis Started.** \nUsing Transcription-First method to segment video into complete thoughts...`,
            timestamp: Date.now()
        }
      ]);

      const analyzedEvents = await generateVideoTimeline(video.fileUri, video.mimeType);
      setTimelineEvents(analyzedEvents);
      setHasAnalyzed(true);

      const audioEvents = analyzedEvents.filter(e => e.type === 'audio');
      const redundancyEvents = analyzedEvents.filter(e => e.type === 'redundancy');

      const generatedClips: Clip[] = audioEvents.map(e => {
        const clipStart = e.seconds;
        const duration = e.duration || 10; 
        const clipEnd = e.seconds + duration;

        const clipRedundancies = redundancyEvents.filter(r => r.seconds >= clipStart && r.seconds < clipEnd);

        return {
            id: generateId(),
            title: `Chapter ${formatTime(e.seconds)}`,
            startTime: clipStart,
            endTime: clipEnd,
            description: "Visual analysis available.",
            transcript: e.description,
            redundancies: clipRedundancies
        };
      });

      setClips(generatedClips);
      if (generatedClips.length > 0) {
        setActiveClipId(generatedClips[0].id);
      }

      setMessages(prev => [
        ...prev,
        {
          id: generateId(),
          role: Sender.Model,
          text: `**Timeline Ready.** \nI have split the video into **${generatedClips.length} logical segments** based on your narration.\n\nEach clip now represents a complete sentence or thought, ensuring smoother editing.`,
          timestamp: Date.now()
        }
      ]);

    } catch (err: any) {
      console.error(err);
      alert(`Analysis failed: ${err.message}`);
      setMessages(prev => [
        ...prev,
        {
          id: generateId(),
          role: Sender.Model,
          text: `**System Error:** Deep scan failed. Please try again.`,
          timestamp: Date.now()
        }
      ]);
    } finally {
      setIsDeepScanning(false);
    }
  };

  const handleDetectSilence = async () => {
      if (!video || clips.length === 0) return;
      setIsDetectingSilence(true);
      try {
          const silences = await detectSilenceAndInactivity(video.fileUri, video.mimeType);
          if (silences.length === 0) {
              alert("No significant dead air detected.");
              setIsDetectingSilence(false);
              return;
          }
          // Note: Removing clips invalidates Master Audio
          invalidateMasterAudio(); 
          
          setClips(prevClips => {
              const newClips = prevClips.map(clip => {
                  const overlappingSilences = silences.filter(s => {
                      const silenceStart = s.seconds;
                      const silenceEnd = s.seconds + (s.duration || 0);
                      return (silenceStart < clip.endTime && silenceEnd > clip.startTime);
                  });

                  if (overlappingSilences.length > 0) {
                      const existingRedundancies = clip.redundancies ? [...clip.redundancies] : [];
                      overlappingSilences.forEach(s => {
                          if (!existingRedundancies.some(r => r.type === 'silence' && r.seconds === s.seconds)) {
                              existingRedundancies.push(s);
                          }
                      });
                      return { ...clip, redundancies: existingRedundancies };
                  }
                  return clip;
              });
              return newClips;
          });
          setTimelineEvents(prev => [...prev, ...silences]); 
      } catch (err) {
          console.error(err);
          alert("Failed to detect silence.");
      } finally {
          setIsDetectingSilence(false);
      }
  };

  const handlePolishScripts = async () => {
      if (clips.length === 0) return;
      setIsPolishing(true);
      try {
          const improvements = await polishClipTranscriptsWithClaude(clips);
          setClips(prevClips => prevClips.map(clip => {
              const improved = improvements.find(i => i.id === clip.id);
              if (improved) {
                  return { ...clip, improvedTranscript: improved.improvedText };
              }
              return clip;
          }));
          // Polishing invalidates old audio
          invalidateMasterAudio();
      } catch (e) {
          console.error(e);
          alert("Failed to polish scripts.");
      } finally {
          setIsPolishing(false);
      }
  };

  // --- NEW: GENERATE MASTER AUDIO (Anchor-Based Sync) ---
  const handleGenerateAllAudio = async () => {
      if (!elevenLabsSettings.elevenLabsApiKey || !elevenLabsSettings.elevenLabsVoiceId) {
          setShowSettings(true);
          return;
      }

      const tasks = clips.filter(c => c.improvedTranscript);
      if (tasks.length === 0) {
        alert("No polished scripts found. Please use 'Polish Scripts' first.");
        return;
      }

      setIsGeneratingAllAudio(true);
      try {
        // 1. Prepare Text with DELIMITERS
        const DELIMITER = " ... "; // 3 dots sequence, space padded
        
        // Sanitize input to remove any accidental delimiters in the text itself
        const clipsTexts = tasks.map(c => {
             const text = c.improvedTranscript || "";
             return text.replace(/\.\.\./g, ","); // Replace existing elipses
        });
        
        // Join with delimiter
        const fullText = clipsTexts.join(DELIMITER);

        // 2. Generate
        const { audioBase64, alignment } = await generateSpeechWithTimestamps(
            elevenLabsSettings.elevenLabsApiKey,
            fullText,
            elevenLabsSettings
        );

        // 3. Create Blob URL for Master Audio
        const arrayBuffer = base64ToArrayBuffer(audioBase64);
        const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
        let masterUrl = URL.createObjectURL(blob);
        
        // 4. Anchor-Based Slicing
        // We look for the pattern ['.', '.', '.'] in alignment.characters
        // This is 100% robust against text mismatches.
        
        const alignChars = alignment.characters; 
        const alignStartTimes = alignment.character_start_times_seconds;
        const alignEndTimes = alignment.character_end_times_seconds;
        
        const clipBoundaries: { start: number, end: number }[] = [];
        
        let cursor = 0;
        let currentClipStart = 0;

        // Iterate to find all delimiters
        // The delimiter " ... " usually comes back as characters ['.', '.', '.'] (spaces stripped/ignored)
        
        for (let i = 0; i < alignChars.length - 2; i++) {
            if (alignChars[i] === '.' && alignChars[i+1] === '.' && alignChars[i+2] === '.') {
                // Found a delimiter!
                const delimiterStartIndex = i;
                const delimiterEndIndex = i + 2;
                
                // End of Current Clip = Start of the Delimiter
                const clipEnd = alignStartTimes[delimiterStartIndex];
                
                clipBoundaries.push({ start: currentClipStart, end: clipEnd });
                
                // Start of Next Clip = End of the Delimiter
                // ElevenLabs usually has a small gap after punctuation.
                // We actually want the NEXT clip to start at the character AFTER the delimiter.
                if (delimiterEndIndex + 1 < alignStartTimes.length) {
                    currentClipStart = alignStartTimes[delimiterEndIndex + 1];
                } else {
                    currentClipStart = alignEndTimes[delimiterEndIndex];
                }
                
                // Advance loop past this delimiter to avoid re-detecting overlapping dots
                i += 2;
            }
        }
        
        // Add the final clip (from last delimiter to end of file)
        clipBoundaries.push({ 
            start: currentClipStart, 
            end: alignEndTimes[alignEndTimes.length - 1] 
        });

        // 5. Assign to Clips
        // If mismatched counts (rare but possible if AI skipped a delimiter), we map what we have.
        const clipUpdates: { id: string, start: number, end: number, rate: number }[] = [];
        
        tasks.forEach((clip, idx) => {
            if (idx < clipBoundaries.length) {
                const boundary = clipBoundaries[idx];
                
                // SMART PAUSE INCLUSION:
                // The audioEndTime of this clip should extend to the audioStartTime of the NEXT clip.
                // This captures the silence/pause in between, slowing down the video.
                let extendedEnd = boundary.end;
                if (idx < clipBoundaries.length - 1) {
                    extendedEnd = clipBoundaries[idx + 1].start;
                } else {
                    // Last clip: add 0.5s padding
                    extendedEnd += 0.5;
                }
                
                // Calculate Rate
                const audioDur = extendedEnd - boundary.start;
                const videoDur = clip.endTime - clip.startTime;
                
                let rate = 1.0;
                if (audioDur > 0.1) rate = videoDur / audioDur;

                clipUpdates.push({
                    id: clip.id,
                    start: boundary.start,
                    end: extendedEnd,
                    rate: rate
                });
            }
        });

        setClips(prev => prev.map(c => {
            const update = clipUpdates.find(u => u.id === c.id);
            if (update) {
                return { 
                    ...c, 
                    audioStartTime: update.start, 
                    audioEndTime: update.end,
                    videoRate: update.rate 
                };
            }
            return c;
        }));

        setMasterAudioUrl(masterUrl);

        if (activeProjectId) {
            try {
                const audioFileName = `${video?.file?.name?.split('.').shift() || 'master'}_${Date.now()}.mp3`;
                const audioFile = new File([blob], audioFileName, { type: 'audio/mpeg' });
                const uploadResult = await uploadProjectAsset(activeProjectId, audioFile, {
                    type: 'audio',
                    fileName: audioFileName,
                    contentType: 'audio/mpeg'
                });
                await updateProjectMetadata(activeProjectId, {
                    masterAudioStoragePath: uploadResult.path,
                    masterAudioMimeType: 'audio/mpeg',
                    hasMasterAudio: true
                });
                setActiveProject(prev => prev ? {
                    ...prev,
                    masterAudioStoragePath: uploadResult.path,
                    masterAudioMimeType: 'audio/mpeg',
                    hasMasterAudio: true
                } : prev);
                URL.revokeObjectURL(masterUrl);
                masterUrl = uploadResult.publicUrl;
                setMasterAudioUrl(masterUrl);
            } catch (persistError) {
                console.error('Failed to store master audio', persistError);
            }
        }

      } catch (error: any) {
        console.error("Batch Generation Error", error);
        alert("Batch Audio Generation Failed: " + error.message);
      } finally {
        setIsGeneratingAllAudio(false);
      }
  };

  const handleLoomDirectImport = async () => {
    if (!externalUrl) return;
    setIsDownloading(true);
    setDownloadError(null);
    try {
      const data = await fetchLoomVideo(externalUrl);
      const byteCharacters = atob(data.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: data.mimeType });
      const file = new File([blob], data.filename, { type: data.mimeType });

      await processVideoFile(file);

    } catch (error: any) {
      setDownloadError("Direct download blocked by Loom. Please use Screen Capture instead.");
    } finally {
      setIsDownloading(false);
    }
  };

  const startScreenCapture = async () => {
    try {
      setDownloadError(null);
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const file = new File([blob], "smart_capture_analysis.webm", { type: 'video/webm' });
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        await processVideoFile(file);
      };

      stream.getVideoTracks()[0].onended = () => {
        if (recorder.state !== 'inactive') recorder.stop();
      };

      recorder.start();
      setIsRecording(true);
      mediaRecorderRef.current = recorder;

    } catch (err: any) {
      console.error("Capture failed:", err);
      alert("Failed to start screen capture.");
    }
  };

  const stopScreenCapture = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !video || isAnalyzing || isDeepScanning) return;
    const userMsg: Message = {
      id: generateId(),
      role: Sender.User,
      text: input,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsAnalyzing(true);

    try {
      const responseText = await sendMessageToGemini(
        userMsg.text, 
        video.fileUri, 
        video.mimeType, 
        messages,
        timelineEvents 
      );
      const aiMsg: Message = {
        id: generateId(),
        role: Sender.Model,
        text: responseText,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error: any) {
      setMessages(prev => [...prev, {
        id: generateId(),
        role: Sender.Model,
        text: `Error: ${error.message || "Something went wrong."}`,
        timestamp: Date.now()
      }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const togglePlayback = () => {
    if (clips.length === 0) return;
    setIsPlaying(!isPlaying);
  };

  const skipClip = (direction: 'next' | 'prev') => {
      const idx = clips.findIndex(c => c.id === activeClipId);
      if (idx === -1) return;
      
      const newIdx = direction === 'next' ? idx + 1 : idx - 1;
      if (newIdx >= 0 && newIdx < clips.length) {
          const nextClip = clips[newIdx];
          setActiveClipId(nextClip.id);
          // If Master Audio, seek that. If video, seek video.
          if (masterAudioUrl && nextClip.audioStartTime !== undefined && audioPlayerRef.current) {
               audioPlayerRef.current.currentTime = nextClip.audioStartTime;
          } else if (videoRef.current) {
               videoRef.current.currentTime = nextClip.startTime;
          }
      }
  };

  const moveClip = (index: number, direction: 'left' | 'right') => {
      const newClips = [...clips];
      const targetIndex = direction === 'left' ? index - 1 : index + 1;
      if (targetIndex >= 0 && targetIndex < newClips.length) {
          [newClips[index], newClips[targetIndex]] = [newClips[targetIndex], newClips[index]];
          setClips(newClips);
          invalidateMasterAudio(); // Invalidate audio order
      }
  };

  const deleteClip = (id: string) => {
    const currentIndex = clips.findIndex(c => c.id === id);
    const newClips = clips.filter(c => c.id !== id);
    
    if (activeClipId === id) {
        if (newClips.length > 0) {
            const nextClip = newClips[currentIndex] || newClips[currentIndex - 1] || newClips[0];
            setActiveClipId(nextClip.id);
            if (videoRef.current) videoRef.current.currentTime = nextClip.startTime;
        } else {
            setActiveClipId(null);
            setIsPlaying(false);
        }
    }
    setClips(newClips);
    invalidateMasterAudio(); // Invalidate audio
  };

  const fixRedundancy = (clipId: string, event: TimelineEvent) => {
      const clip = clips.find(c => c.id === clipId);
      if (!clip) return;

      let cutStart, cutEnd;

      if (event.duration && event.duration > 0) {
          cutStart = Math.max(clip.startTime, event.seconds);
          cutEnd = Math.min(clip.endTime, event.seconds + event.duration);
      } else {
          cutStart = Math.max(clip.startTime, event.seconds - 1);
          cutEnd = Math.min(clip.endTime, event.seconds + 2);
      }

      if (cutStart >= cutEnd) return;

      const clipBefore: Clip = {
          ...clip,
          id: generateId(),
          title: clip.title + " (Part A)",
          endTime: cutStart,
          redundancies: [] 
      };
      
      const clipAfter: Clip = {
          ...clip,
          id: generateId(),
          title: clip.title + " (Part B)",
          startTime: cutEnd,
          redundancies: [] 
      };

      const newSegments = [];
      if (clipBefore.endTime - clipBefore.startTime > 0.5) newSegments.push(clipBefore);
      if (clipAfter.endTime - clipAfter.startTime > 0.5) newSegments.push(clipAfter);

      const clipIndex = clips.findIndex(c => c.id === clipId);
      const newClips = [...clips];
      
      if (newSegments.length === 0) {
          newClips.splice(clipIndex, 1);
          if (activeClipId === clipId) setActiveClipId(null);
      } else {
          newClips.splice(clipIndex, 1, ...newSegments);
          if (activeClipId === clipId) setActiveClipId(newSegments[0]?.id || null);
      }
      
      setClips(newClips);
      invalidateMasterAudio(); // Invalidate audio
  };

  const splitClipAtPlayhead = () => {
    if (!videoRef.current || !activeClipId) return;
    const currentTime = videoRef.current.currentTime;
    const clipIndex = clips.findIndex(c => c.id === activeClipId);
    if (clipIndex === -1) return;
    
    const clip = clips[clipIndex];

    if (currentTime > clip.startTime + 0.5 && currentTime < clip.endTime - 0.5) {
       const clipA: Clip = { ...clip, id: generateId(), endTime: currentTime, title: clip.title + " (Cut 1)" };
       const clipB: Clip = { ...clip, id: generateId(), startTime: currentTime, title: clip.title + " (Cut 2)", redundancies: [] }; 
       
       const newClips = [...clips];
       newClips.splice(clipIndex, 1, clipA, clipB);
       setClips(newClips);
       setActiveClipId(clipB.id); 
       invalidateMasterAudio(); // Invalidate audio
    } else {
        alert("Playhead must be inside the active clip to split.");
    }
  };

  // --- TRANSCRIPT EDITING HANDLERS ---
  const handleStartEdit = (clip: Clip) => {
    setEditingClipId(clip.id);
    setEditingText(clip.improvedTranscript || clip.transcript || "");
  };

  const handleSaveEdit = () => {
    if (!editingClipId) return;

    setClips(prevClips => prevClips.map(c => 
        c.id === editingClipId ? { ...c, improvedTranscript: editingText } : c
    ));

    // Invalidate audio because text changed
    invalidateMasterAudio();
    setEditingClipId(null);
  };

  const handleCancelEdit = () => {
    setEditingClipId(null);
    setEditingText("");
  };

  const handleGlobalSeek = (e: React.MouseEvent<HTMLDivElement>) => {
      if (clips.length === 0 || !videoRef.current) return;

      isTransitioningRef.current = true; // Lock during manual seek
      if (audioPlayerRef.current) audioPlayerRef.current.pause();

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      
      const targetSeqTime = totalSequenceDuration * percentage;
      setCurrentSequenceTime(targetSeqTime);

      let scannedTime = 0;
      for (const clip of clips) {
          const clipDuration = getClipDuration(clip);
          
          if (targetSeqTime <= scannedTime + clipDuration) {
              const offsetInClip = targetSeqTime - scannedTime;
              
              setActiveClipId(clip.id);
              
              // SEEK LOGIC
              if (masterAudioUrl && clip.audioStartTime !== undefined && audioPlayerRef.current) {
                  audioPlayerRef.current.currentTime = clip.audioStartTime + offsetInClip;
              } else {
                  videoRef.current.currentTime = getVideoTimeFromClipTime(offsetInClip, clip);
              }
              
              setTimeout(() => { isTransitioningRef.current = false; }, 100);
              return;
          }
          scannedTime += clipDuration;
      }
      
      // Fallback
      setTimeout(() => { isTransitioningRef.current = false; }, 100);
  };

  const renderMessageText = (text: string) => {
    const html = marked(text, { breaks: true });
    const timestampRegex = /\*\*(\d{1,2}:\d{2})\*\*/g;
    const processedHtml = (html as string).replace(timestampRegex, (match, time) => {
      return `<button class="text-indigo-400 font-bold hover:underline cursor-pointer bg-indigo-500/10 px-1.5 py-0.5 rounded text-xs" onclick="window.dispatchEvent(new CustomEvent('jumpTime', { detail: '${time}' }))">${time}</button>`;
    });
    return { __html: processedHtml };
  };

  useEffect(() => {
    const handleJump = (e: any) => {
        const time = parseTime(e.detail);
        if (videoRef.current && !isNaN(time)) {
            const targetClip = clips.find(c => time >= c.startTime && time <= c.endTime);
            if (targetClip) {
                setActiveClipId(targetClip.id);
                // Simple seek for analysis jumps
                videoRef.current.currentTime = time;
                videoRef.current.play();
                setIsPlaying(true);
            } else {
                alert("This timestamp is in a deleted section.");
            }
        }
    };
    window.addEventListener('jumpTime', handleJump);
    return () => window.removeEventListener('jumpTime', handleJump);
  }, [clips]);

  const activeClipIndex = clips.findIndex(c => c.id === activeClipId);

  if (!projectReady) {
      return (
          <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans p-8">
              <div className="max-w-5xl mx-auto">
                  <div className="flex items-start justify-between mb-8">
                      <div>
                          <p className="text-xs uppercase tracking-[0.3em] text-indigo-400">{APP_NAME}</p>
                          <h1 className="text-3xl font-bold text-white mt-2">Project Workspace</h1>
                          <p className="text-sm text-zinc-400 mt-1">Select an existing project or create a new one to start editing.</p>
                      </div>
                      <button
                          onClick={handleCreateProject}
                          className="bg-indigo-500 hover:bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg font-semibold"
                      >
                          New Project
                      </button>
                  </div>

                  {projectError && (
                      <div className="mb-4 border border-rose-500/40 bg-rose-500/10 text-rose-200 px-4 py-3 rounded-lg text-sm">
                          {projectError}
                      </div>
                  )}

                  <div className="flex items-center gap-3 mb-6">
                      <button
                          onClick={refreshProjectList}
                          className="text-xs uppercase tracking-[0.2em] text-zinc-300 border border-zinc-700 px-3 py-1 rounded-full hover:border-indigo-500 hover:text-white"
                      >
                          Refresh
                      </button>
                      {isLoadingProjects && <span className="text-xs text-zinc-500">Syncing projects...</span>}
                      {isLoadingProjectState && activeProjectId && <span className="text-xs text-indigo-400">Loading project...</span>}
                  </div>

                  {projects.length === 0 && !isLoadingProjects ? (
                      <div className="border border-dashed border-zinc-700 rounded-xl p-10 text-center text-zinc-400">
                          <p className="mb-2 font-semibold text-white">No projects yet</p>
                          <p className="text-sm">Create your first project to begin.</p>
                      </div>
                  ) : (
                      <div className="grid gap-4 md:grid-cols-2">
                          {projects.map(project => (
                              <button
                                  key={project.id}
                                  onClick={() => handleOpenProject(project.id)}
                                  className="border border-zinc-800 rounded-2xl p-4 bg-zinc-900/70 text-left hover:border-indigo-500 transition"
                              >
                                  <div className="flex items-center justify-between mb-2">
                                      <h3 className="text-lg font-semibold text-white">{project.name}</h3>
                                      <span className={`text-xs px-2 py-0.5 rounded-full ${project.videoFileName ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}>
                                          {project.videoFileName ? 'Video attached' : 'Awaiting upload'}
                                      </span>
                                  </div>
                                  <p className="text-xs text-zinc-500 mb-3">Updated {new Date(project.updatedAt).toLocaleString()}</p>
                                  <div className="flex items-center justify-between text-xs text-zinc-400">
                                      <span className="truncate mr-3">{project.videoFileName || 'No video uploaded'}</span>
                                      <div className="flex items-center gap-2">
                                          <span className={`inline-flex items-center gap-1 ${project.hasMasterAudio ? 'text-emerald-300' : 'text-zinc-500'}`}>
                                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: project.hasMasterAudio ? '#34d399' : '#52525b' }}></span>
                                              {project.hasMasterAudio ? 'Audio Ready' : 'Audio Pending'}
                                          </span>
                                      </div>
                                  </div>
                              </button>
                          ))}
                      </div>
                  )}
              </div>
          </div>
      );
  }

  return (
    <div className="flex h-screen w-full bg-zinc-950 text-zinc-200 font-sans overflow-hidden">
      <div className="fixed top-4 left-4 z-50 flex items-center gap-3">
          <button
              onClick={handleBackToProjects}
              className="text-xs uppercase tracking-[0.2em] text-zinc-300 border border-zinc-800/80 bg-zinc-900/60 px-3 py-1.5 rounded-full hover:border-indigo-500"
          >
              Projects
          </button>
          <div className="text-[10px] font-mono text-zinc-500">
              {autoSaveStatus === 'saving' && 'Saving...'}
              {autoSaveStatus === 'saved' && lastSavedAt && `Saved ${new Date(lastSavedAt).toLocaleTimeString()}`}
              {autoSaveStatus === 'error' && <span className="text-rose-400">Save failed</span>}
          </div>
      </div>

      {activeProject && (
          <div className="fixed top-4 right-4 z-50 text-right">
              <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Project</p>
              <p className="text-sm font-semibold text-white">{activeProject.name}</p>
          </div>
      )}

      <audio ref={audioPlayerRef} className="hidden" />

      {/* Export Progress Overlay */}
      {isExporting && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md">
              <div className="text-center p-8 max-w-sm w-full">
                  <div className="mb-4 text-indigo-500 animate-spin mx-auto w-8 h-8">
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">Exporting Video</h2>
                  <p className="text-zinc-400 text-sm mb-6">{exportMessage}</p>
                  
                  <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${exportProgress}%` }}></div>
                  </div>
                  <p className="text-xs text-zinc-500 mt-2 font-mono">{exportProgress}%</p>
              </div>
          </div>
      )}

      {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
                  <h2 className="text-lg font-bold text-white mb-6">ElevenLabs Configuration</h2>
                  <div className="space-y-6">
                      
                      <div>
                          <label className="block text-xs font-bold text-zinc-400 mb-2">API Key</label>
                          <input 
                              type="password" 
                              value={elevenLabsSettings.elevenLabsApiKey}
                              onChange={(e) => setElevenLabsSettings({...elevenLabsSettings, elevenLabsApiKey: e.target.value})}
                              placeholder="sk_..."
                              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                          />
                      </div>

                      {availableVoices.length > 0 && (
                          <>
                            <div>
                                <label className="block text-xs font-bold text-zinc-400 mb-2">Voice</label>
                                <div className="bg-zinc-950 border border-zinc-800 rounded flex items-center px-3 py-2">
                                  <img 
                                    src={availableVoices.find(v => v.voice_id === elevenLabsSettings.elevenLabsVoiceId)?.preview_url || 'https://via.placeholder.com/20'} 
                                    alt="voice" 
                                    className="w-6 h-6 rounded-full mr-2 bg-zinc-800"
                                  />
                                  <select 
                                      value={elevenLabsSettings.elevenLabsVoiceId}
                                      onChange={(e) => setElevenLabsSettings({...elevenLabsSettings, elevenLabsVoiceId: e.target.value})}
                                      className="w-full bg-transparent text-sm text-white outline-none"
                                  >
                                      {availableVoices.map(v => (
                                          <option key={v.voice_id} value={v.voice_id}>{v.name}</option>
                                      ))}
                                  </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-zinc-400 mb-2">Model</label>
                                <select 
                                      value={elevenLabsSettings.elevenLabsModelId}
                                      onChange={(e) => setElevenLabsSettings({...elevenLabsSettings, elevenLabsModelId: e.target.value})}
                                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                                  >
                                      <option value="eleven_multilingual_v2">Eleven Multilingual v2 (Recommended)</option>
                                      <option value="eleven_turbo_v2">Eleven Turbo v2 (Fast)</option>
                                      <option value="eleven_monolingual_v1">Eleven Monolingual v1</option>
                                </select>
                            </div>

                            <hr className="border-zinc-800" />

                            <div>
                                <div className="flex justify-between mb-2">
                                  <label className="text-xs font-bold text-zinc-400">Voice Volume</label>
                                  <span className="text-xs text-zinc-500">{Math.round(elevenLabsSettings.elevenLabsVolume * 100)}%</span>
                                </div>
                                <input 
                                  type="range" min="0" max="1" step="0.1"
                                  value={elevenLabsSettings.elevenLabsVolume}
                                  onChange={(e) => setElevenLabsSettings({...elevenLabsSettings, elevenLabsVolume: parseFloat(e.target.value)})}
                                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between mb-2">
                                  <label className="text-xs font-bold text-zinc-400">Speed (Playback Rate)</label>
                                  <span className="text-xs text-zinc-500">{elevenLabsSettings.elevenLabsSpeed}x</span>
                                </div>
                                <div className="flex justify-between text-[10px] text-zinc-600 mb-1">
                                  <span>0.5x</span>
                                  <span>2.0x</span>
                                </div>
                                <input 
                                  type="range" min="0.5" max="2.0" step="0.1"
                                  value={elevenLabsSettings.elevenLabsSpeed}
                                  onChange={(e) => setElevenLabsSettings({...elevenLabsSettings, elevenLabsSpeed: parseFloat(e.target.value)})}
                                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between mb-2">
                                  <label className="text-xs font-bold text-zinc-400">Stability</label>
                                  <span className="text-xs text-zinc-500">{Math.round(elevenLabsSettings.elevenLabsStability * 100)}%</span>
                                </div>
                                <input 
                                  type="range" min="0" max="1" step="0.05"
                                  value={elevenLabsSettings.elevenLabsStability}
                                  onChange={(e) => setElevenLabsSettings({...elevenLabsSettings, elevenLabsStability: parseFloat(e.target.value)})}
                                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between mb-2">
                                  <label className="text-xs font-bold text-zinc-400">Similarity</label>
                                  <span className="text-xs text-zinc-500">{Math.round(elevenLabsSettings.elevenLabsSimilarity * 100)}%</span>
                                </div>
                                <input 
                                  type="range" min="0" max="1" step="0.05"
                                  value={elevenLabsSettings.elevenLabsSimilarity}
                                  onChange={(e) => setElevenLabsSettings({...elevenLabsSettings, elevenLabsSimilarity: parseFloat(e.target.value)})}
                                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between mb-2">
                                  <label className="text-xs font-bold text-zinc-400">Style Exaggeration</label>
                                  <span className="text-xs text-zinc-500">{Math.round(elevenLabsSettings.elevenLabsStyle * 100)}%</span>
                                </div>
                                <input 
                                  type="range" min="0" max="1" step="0.05"
                                  value={elevenLabsSettings.elevenLabsStyle}
                                  onChange={(e) => setElevenLabsSettings({...elevenLabsSettings, elevenLabsStyle: parseFloat(e.target.value)})}
                                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-zinc-400">Speaker Boost</label>
                                <button 
                                  onClick={() => setElevenLabsSettings({...elevenLabsSettings, elevenLabsSpeakerBoost: !elevenLabsSettings.elevenLabsSpeakerBoost})}
                                  className={`w-10 h-5 rounded-full relative transition-colors ${elevenLabsSettings.elevenLabsSpeakerBoost ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                                >
                                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${elevenLabsSettings.elevenLabsSpeakerBoost ? 'left-6' : 'left-1'}`}></div>
                                </button>
                            </div>

                          </>
                      )}
                  </div>
                  <div className="flex justify-end gap-2 mt-8 pt-4 border-t border-zinc-800">
                      <button onClick={() => setShowSettings(false)} className="px-4 py-2 rounded text-sm text-zinc-400 hover:text-white transition-colors">Close</button>
                      <button onClick={() => setShowSettings(false)} className="px-4 py-2 rounded text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-900/20 transition-all">Save Configuration</button>
                  </div>
              </div>
          </div>
      )}

      <div className="w-16 border-r border-zinc-800 flex flex-col items-center py-6 gap-6 bg-zinc-950/50 z-20">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-900/20">V</div>
        <button onClick={() => setShowSettings(true)} className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-900 hover:text-white transition-colors">
            <SettingsIcon />
        </button>
      </div>

      <div className="flex-1 flex flex-col h-full relative min-w-0">
        <header className="h-14 shrink-0 border-b border-zinc-800 flex items-center px-6 justify-between bg-zinc-900/50 backdrop-blur-sm z-10">
           <h1 className="font-semibold text-zinc-100 tracking-tight">{APP_NAME} <span className="text-zinc-500 font-normal text-sm ml-2">Video Intelligence</span></h1>
           <div className="flex gap-2 text-xs items-center">
             {video && !hasAnalyzed && !isDeepScanning && (
                <button onClick={startDeepAnalysis} className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors">
                   <SparkleIcon /> Analyze & Transcribe
                </button>
             )}
             {hasAnalyzed && clips.length > 0 && !isDeepScanning && (
                 <button 
                    onClick={handleExport} 
                    disabled={isExporting}
                    className="bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors"
                 >
                     <ArrowDownTrayIcon /> Export Video (4K Ready)
                 </button>
             )}
             {isDeepScanning && <span className="px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 animate-pulse flex items-center gap-2"><LoadingSpinner /> Analyzing...</span>}
             {hasAnalyzed && <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Analysis Ready</span>}
           </div>
        </header>

        <div className="flex-1 overflow-hidden flex">
          <div className="flex-1 bg-zinc-900/30 flex flex-col border-r border-zinc-800 min-w-0">
            
            <div className="flex-1 relative flex flex-col bg-black overflow-hidden min-h-0 group/player">
              {!video ? (
                <div className="m-auto w-full max-w-md p-8 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-xl text-center">
                   <div className="flex justify-center gap-4 mb-6">
                      <button onClick={() => setImportMode('upload')} className={`px-4 py-2 rounded-lg text-sm ${importMode === 'upload' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>Upload</button>
                      <button onClick={() => setImportMode('weblink')} className={`px-4 py-2 rounded-lg text-sm ${importMode === 'weblink' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>Link</button>
                   </div>
                   {importMode === 'upload' ? (
                     <label className="flex flex-col items-center cursor-pointer p-8 border-2 border-dashed border-zinc-700 rounded-xl hover:bg-zinc-800/50">
                       {isUploading ? <LoadingSpinner /> : <UploadIcon />}
                       <span className="text-zinc-400 font-medium">{isUploading ? 'Uploading...' : 'Drop video here'}</span>
                       <input type="file" accept="video/*" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                     </label>
                   ) : (
                      <div className="flex flex-col gap-4">
                          <input type="text" placeholder="Paste URL" className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-3 text-sm" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} />
                          {downloadError && <p className="text-red-400 text-xs text-left">{downloadError}</p>}
                          <div className="flex gap-2">
                               <button onClick={handleLoomDirectImport} disabled={!externalUrl || isDownloading} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg text-sm">Import</button>
                               <button onClick={isRecording ? stopScreenCapture : startScreenCapture} className={`px-4 py-2 rounded-lg text-sm border flex items-center gap-2 ${isRecording ? 'bg-red-500/10 border-red-500 text-red-400' : 'border-zinc-700'}`}><RecordIcon isRecording={isRecording} /> {isRecording ? 'Stop' : 'Capture'}</button>
                          </div>
                      </div>
                   )}
                </div>
              ) : (
                <>
                  <video 
                    ref={videoRef} 
                    src={video.previewUrl} 
                    className="w-full h-full object-contain" 
                    controls={clips.length === 0} 
                  />
                  
                  {clips.length > 0 && (
                      <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-12 pb-4 px-6 opacity-0 group-hover/player:opacity-100 transition-opacity duration-200 flex flex-col gap-3 z-30">
                          
                          <div 
                             className="relative w-full h-1.5 bg-zinc-700/50 rounded-full cursor-pointer group/bar"
                             onClick={handleGlobalSeek}
                          >
                             <div 
                                className="absolute top-0 left-0 h-full bg-indigo-500 rounded-full" 
                                style={{ width: `${(currentSequenceTime / totalSequenceDuration) * 100}%` }}
                             ></div>
                             <div 
                                className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md scale-0 group-hover/bar:scale-100 transition-transform" 
                                style={{ left: `${(currentSequenceTime / totalSequenceDuration) * 100}%` }}
                             ></div>
                          </div>

                          <div className="flex justify-between items-center">
                              <div className="flex items-center gap-4">
                                  <button 
                                      onClick={togglePlayback} 
                                      className="text-white hover:text-indigo-400 transition-colors"
                                  >
                                    {isPlaying ? <PauseIcon /> : <PlayIcon />}
                                  </button>
                                  
                                  <div className="flex items-center gap-2">
                                      <button onClick={() => skipClip('prev')} className="text-zinc-400 hover:text-white transition-colors"><SkipBackIcon /></button>
                                      <button onClick={() => skipClip('next')} className="text-zinc-400 hover:text-white transition-colors"><SkipForwardIcon /></button>
                                  </div>

                                  <span className="text-xs font-mono text-zinc-300 ml-2">
                                      {formatTime(currentSequenceTime)} / <span className="text-zinc-500">{formatTime(totalSequenceDuration)}</span>
                                  </span>
                              </div>
                              
                              <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                                  Clip {activeClipIndex + 1} of {clips.length}
                              </div>
                          </div>
                      </div>
                  )}

                  {activeClipId && (
                      <div className="absolute top-4 right-4 flex gap-2">
                         <div className="bg-indigo-600/90 text-white px-3 py-1.5 rounded-md text-xs font-medium backdrop-blur-md shadow-lg border border-indigo-500/50 flex items-center gap-2 z-10 pointer-events-none">
                            <ScissorsIcon /> Edit Mode Active
                         </div>
                         {masterAudioUrl && (
                             <div className="bg-emerald-600/90 text-white px-3 py-1.5 rounded-md text-xs font-medium backdrop-blur-md shadow-lg border border-emerald-500/50 flex items-center gap-2 z-10 pointer-events-none animate-pulse">
                                <SpeakerWaveIcon /> Master Audio
                             </div>
                         )}
                      </div>
                  )}
                </>
              )}
            </div>

            {hasAnalyzed && clips.length > 0 && (
                <div className="shrink-0 bg-[#1a1a1f] border-t border-zinc-800/50 flex flex-col relative z-20">
                    {/* Generate All Audio Banner */}
                    {showGenerateAllBanner && (
                        <div className="w-full bg-gradient-to-r from-emerald-900/40 to-teal-900/40 border-b border-emerald-500/20 px-6 py-2.5 flex justify-between items-center backdrop-blur-sm">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-emerald-500/20 rounded-lg text-emerald-400"><SpeakerWaveIcon /></div>
                                <div>
                                    <h3 className="text-xs font-semibold text-emerald-100">Scripts Polished & Ready</h3>
                                    <p className="text-[10px] text-emerald-400/70">Generate voiceover for entire video</p>
                                </div>
                            </div>
                            <button 
                                onClick={handleGenerateAllAudio}
                                disabled={isGeneratingAllAudio}
                                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-md transition-all flex items-center gap-1.5"
                            >
                                {isGeneratingAllAudio ? <LoadingSpinner /> : <WandIcon />}
                                {isGeneratingAllAudio ? 'Synthesizing...' : 'Generate Audio'}
                            </button>
                        </div>
                    )}
                    
                    {/* Timeline Toolbar */}
                    <div className="h-9 px-4 border-b border-zinc-800/50 flex items-center justify-between bg-[#1e1e24]">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Speed</span>
                                <span className="text-[10px] font-mono text-cyan-400 bg-zinc-800 px-1.5 py-0.5 rounded">1.0X</span>
                            </div>
                            <div className="h-4 w-px bg-zinc-700"></div>
                            <button 
                                onClick={splitClipAtPlayhead}
                                disabled={!activeClipId}
                                className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Split at Playhead"
                            >
                                <ScissorsIcon />
                            </button>
                        </div>
                        <div className="flex items-center gap-1.5">
                             <button 
                                onClick={handlePolishScripts}
                                disabled={isPolishing}
                                className="text-[10px] px-2.5 py-1 rounded bg-zinc-800/80 border border-zinc-700/50 text-emerald-400 hover:bg-zinc-700 hover:text-emerald-300 flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Polish transcriptions"
                            >
                                {isPolishing ? <LoadingSpinner /> : <WandIcon />}
                                {isPolishing ? 'Polishing...' : 'Polish'}
                            </button>
                             <button 
                                onClick={handleDetectSilence}
                                disabled={isDetectingSilence}
                                className="text-[10px] px-2.5 py-1 rounded bg-zinc-800/80 border border-zinc-700/50 text-amber-400 hover:bg-zinc-700 hover:text-amber-300 flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Find silence"
                            >
                                {isDetectingSilence ? <LoadingSpinner /> : <MoonIcon />}
                                Silence
                            </button>
                        </div>
                    </div>

                    {/* Time Ruler - Clickable for seeking */}
                    <div className="h-6 bg-[#16161a] border-b border-zinc-800/30 flex">
                        <div className="w-28 shrink-0"></div>
                        <div 
                            className="flex-1 overflow-hidden relative cursor-pointer"
                            onClick={(e) => {
                                if (!video || !videoRef.current) return;
                                const rect = e.currentTarget.getBoundingClientRect();
                                const clickX = e.clientX - rect.left;
                                const percentage = clickX / rect.width;
                                const totalDuration = Math.max(...clips.map(c => c.endTime), 60);
                                const newTime = percentage * totalDuration;
                                
                                // Find clip at this time
                                const clipAtTime = clips.find(c => newTime >= c.startTime && newTime < c.endTime);
                                if (clipAtTime) {
                                    setActiveClipId(clipAtTime.id);
                                    const offsetInClip = newTime - clipAtTime.startTime;
                                    
                                    // Sync audio if master audio exists
                                    if (masterAudioUrl && clipAtTime.audioStartTime !== undefined && audioPlayerRef.current) {
                                        const audioDuration = (clipAtTime.audioEndTime! - clipAtTime.audioStartTime!);
                                        const videoDuration = (clipAtTime.endTime - clipAtTime.startTime);
                                        const audioOffset = (offsetInClip / videoDuration) * audioDuration;
                                        audioPlayerRef.current.currentTime = clipAtTime.audioStartTime + audioOffset;
                                    }
                                }
                                
                                videoRef.current.currentTime = Math.max(0, Math.min(newTime, totalDuration));
                                setIsPlaying(false);
                            }}
                        >
                            <div className="absolute inset-0 flex items-center pointer-events-none">
                                {(() => {
                                    const totalDuration = clips.length > 0 ? Math.max(...clips.map(c => c.endTime)) : 60;
                                    const intervals = Math.ceil(totalDuration / 10);
                                    return Array.from({ length: intervals + 1 }, (_, i) => (
                                        <div key={i} className="flex items-center" style={{ minWidth: '80px' }}>
                                            <div className="flex flex-col items-start">
                                                <span className="text-[9px] font-mono text-zinc-500">{formatTime(i * 10)}</span>
                                            </div>
                                            <div className="flex-1 flex items-center gap-[7px] ml-1">
                                                {Array.from({ length: 9 }, (_, j) => (
                                                    <div key={j} className="w-px h-1.5 bg-zinc-700/50"></div>
                                                ))}
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>
                            {/* Playhead on ruler - Draggable */}
                            {video && videoRef.current && (
                                <div 
                                    className="absolute top-0 bottom-0 w-3 z-20 cursor-grab active:cursor-grabbing group"
                                    style={{ 
                                        left: `calc(${(videoRef.current.currentTime / Math.max(...clips.map(c => c.endTime), 60)) * 100}% - 6px)`,
                                        transition: isPlaying ? 'none' : 'left 0.05s ease-out'
                                    }}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const container = e.currentTarget.parentElement;
                                        if (!container || !videoRef.current) return;
                                        
                                        const totalDuration = Math.max(...clips.map(c => c.endTime), 60);
                                        const wasPlaying = isPlaying;
                                        setIsPlaying(false);
                                        
                                        const handleMouseMove = (moveEvent: MouseEvent) => {
                                            const rect = container.getBoundingClientRect();
                                            const mouseX = moveEvent.clientX - rect.left;
                                            const percentage = Math.max(0, Math.min(1, mouseX / rect.width));
                                            const newTime = percentage * totalDuration;
                                            
                                            if (videoRef.current) {
                                                videoRef.current.currentTime = newTime;
                                            }
                                            
                                            // Update active clip and sync audio while dragging
                                            const clipAtTime = clips.find(c => newTime >= c.startTime && newTime < c.endTime);
                                            if (clipAtTime) {
                                                setActiveClipId(clipAtTime.id);
                                                const offsetInClip = newTime - clipAtTime.startTime;
                                                
                                                // Sync audio if master audio exists
                                                if (masterAudioUrl && clipAtTime.audioStartTime !== undefined && audioPlayerRef.current) {
                                                    const audioDuration = (clipAtTime.audioEndTime! - clipAtTime.audioStartTime!);
                                                    const videoDuration = (clipAtTime.endTime - clipAtTime.startTime);
                                                    const audioOffset = (offsetInClip / videoDuration) * audioDuration;
                                                    audioPlayerRef.current.currentTime = clipAtTime.audioStartTime + audioOffset;
                                                }
                                            }
                                        };
                                        
                                        const handleMouseUp = () => {
                                            document.removeEventListener('mousemove', handleMouseMove);
                                            document.removeEventListener('mouseup', handleMouseUp);
                                            document.body.style.cursor = '';
                                            document.body.style.userSelect = '';
                                        };
                                        
                                        document.body.style.cursor = 'grabbing';
                                        document.body.style.userSelect = 'none';
                                        document.addEventListener('mousemove', handleMouseMove);
                                        document.addEventListener('mouseup', handleMouseUp);
                                    }}
                                >
                                    {/* Playhead line */}
                                    <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-0.5 bg-orange-500"></div>
                                    {/* Playhead handle */}
                                    <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-3 h-4 bg-orange-500 rounded-b-sm flex items-start justify-center shadow-lg group-hover:bg-orange-400 transition-colors">
                                        <div className="w-1.5 h-1.5 mt-0.5 rounded-full bg-orange-200/50"></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Timeline Tracks Container */}
                    <div className="flex-1 flex overflow-hidden" style={{ height: '180px' }}>
                        {/* Track Labels */}
                        <div className="w-28 shrink-0 bg-[#16161a] border-r border-zinc-800/30 flex flex-col">
                            {/* Transcript Track Label */}
                            <div className="h-14 flex items-center px-3 border-b border-zinc-800/30">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider">CLIPS</span>
                                    <div className="flex gap-1">
                                        <button className="w-4 h-4 rounded bg-zinc-800 flex items-center justify-center hover:bg-zinc-700">
                                            <svg className="w-2 h-2 text-zinc-400" fill="currentColor" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3"/></svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            {/* Polished Track Label */}
                            <div className="h-14 flex items-center px-3 border-b border-zinc-800/30">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">POLISHED</span>
                                </div>
                            </div>
                            {/* Issues Track Label */}
                            <div className="flex-1 flex items-center px-3">
                                <span className="text-[10px] font-bold text-amber-400/70 uppercase tracking-wider">ISSUES</span>
                            </div>
                        </div>

                        {/* Tracks Content */}
                        <div 
                            className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent relative"
                            onClick={(e) => {
                                // Only seek if clicking on the background, not on clips
                                if ((e.target as HTMLElement).closest('[data-clip]')) return;
                                if (!video || !videoRef.current) return;
                                const rect = e.currentTarget.getBoundingClientRect();
                                const clickX = e.clientX - rect.left + e.currentTarget.scrollLeft;
                                const totalWidth = e.currentTarget.scrollWidth;
                                const percentage = clickX / totalWidth;
                                const totalDuration = Math.max(...clips.map(c => c.endTime), 60);
                                const newTime = percentage * totalDuration;
                                
                                // Find clip at this time and sync audio
                                const clipAtTime = clips.find(c => newTime >= c.startTime && newTime < c.endTime);
                                if (clipAtTime) {
                                    setActiveClipId(clipAtTime.id);
                                    const offsetInClip = newTime - clipAtTime.startTime;
                                    
                                    // Sync audio if master audio exists
                                    if (masterAudioUrl && clipAtTime.audioStartTime !== undefined && audioPlayerRef.current) {
                                        const audioDuration = (clipAtTime.audioEndTime! - clipAtTime.audioStartTime!);
                                        const videoDuration = (clipAtTime.endTime - clipAtTime.startTime);
                                        const audioOffset = (offsetInClip / videoDuration) * audioDuration;
                                        audioPlayerRef.current.currentTime = clipAtTime.audioStartTime + audioOffset;
                                    }
                                }
                                
                                videoRef.current.currentTime = Math.max(0, Math.min(newTime, totalDuration));
                                setIsPlaying(false);
                            }}
                        >
                            {/* Playhead Line - Full height */}
                            {video && videoRef.current && (
                                <div 
                                    className="absolute top-0 bottom-0 w-0.5 bg-orange-500 z-30 pointer-events-none shadow-[0_0_8px_rgba(249,115,22,0.5)]"
                                    style={{ 
                                        left: `${(videoRef.current.currentTime / Math.max(...clips.map(c => c.endTime), 60)) * 100}%`,
                                        transition: isPlaying ? 'none' : 'left 0.05s ease-out'
                                    }}
                                ></div>
                            )}
                            
                            <div className="min-w-max h-full flex flex-col">
                                {/* Transcript Clips Track */}
                                <div className="h-14 border-b border-zinc-800/30 flex items-center px-2 gap-1 relative bg-[#1a1a1f]">
                                    {clips.map((clip, index) => {
                                        const isActive = activeClipId === clip.id;
                                        const duration = clip.endTime - clip.startTime;
                                        const clipWidth = Math.max(duration * 8, 60); // 8px per second, min 60px
                                        
                                        return (
                                            <div 
                                                key={clip.id}
                                                data-clip="true"
                                                className={`group relative h-10 rounded-md cursor-pointer overflow-hidden transition-all ${
                                                    isActive 
                                                        ? 'ring-2 ring-orange-500 ring-offset-1 ring-offset-[#1a1a1f] z-10' 
                                                        : 'hover:brightness-110'
                                                }`}
                                                style={{ 
                                                    width: `${clipWidth}px`,
                                                    background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)'
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveClipId(clip.id);
                                                    setIsPlaying(false);
                                                    if (videoRef.current) videoRef.current.currentTime = clip.startTime;
                                                }}
                                            >
                                                {/* Clip Content */}
                                                <div className="absolute inset-0 p-1.5 flex flex-col justify-between overflow-hidden">
                                                    <div className="flex items-start justify-between gap-1">
                                                        <span className="text-[9px] font-medium text-white/90 line-clamp-2 leading-tight flex-1">
                                                            {clip.transcript || clip.title}
                                                        </span>
                                                        {/* Clip Actions */}
                                                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); moveClip(index, 'left'); }} 
                                                                className="w-4 h-4 rounded bg-black/30 flex items-center justify-center hover:bg-black/50 text-white/70"
                                                            >
                                                                <ArrowLeftIcon/>
                                                            </button>
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); moveClip(index, 'right'); }} 
                                                                className="w-4 h-4 rounded bg-black/30 flex items-center justify-center hover:bg-black/50 text-white/70"
                                                            >
                                                                <ArrowRightIcon/>
                                                            </button>
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); deleteClip(clip.id); }} 
                                                                className="w-4 h-4 rounded bg-red-500/30 flex items-center justify-center hover:bg-red-500/50 text-white/70"
                                                            >
                                                                <TrashIcon/>
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[8px] font-mono text-white/60">{formatTime(clip.startTime)}</span>
                                                        <span className="text-[8px] font-mono text-white/60">{formatTime(clip.endTime)}</span>
                                                    </div>
                                                </div>
                                                {/* Clip edge handles */}
                                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-300/30 rounded-l-md"></div>
                                                <div className="absolute right-0 top-0 bottom-0 w-1 bg-violet-300/30 rounded-r-md"></div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Polished Transcript Track */}
                                <div className="h-14 border-b border-zinc-800/30 flex items-center px-2 gap-1 relative bg-[#18181c]">
                                    {clips.map((clip, index) => {
                                        const isActive = activeClipId === clip.id;
                                        const isEditing = editingClipId === clip.id;
                                        const duration = clip.endTime - clip.startTime;
                                        const clipWidth = Math.max(duration * 8, 60);
                                        const hasPolished = !!clip.improvedTranscript;
                                        
                                        return (
                                            <div 
                                                key={clip.id}
                                                data-clip="true"
                                                className={`group relative h-10 rounded-md cursor-pointer overflow-hidden transition-all ${
                                                    isActive 
                                                        ? 'ring-2 ring-orange-500 ring-offset-1 ring-offset-[#18181c] z-10' 
                                                        : 'hover:brightness-110'
                                                } ${!hasPolished ? 'opacity-40' : ''}`}
                                                style={{ 
                                                    width: `${clipWidth}px`,
                                                    background: hasPolished 
                                                        ? 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)' 
                                                        : 'linear-gradient(135deg, #3f3f46 0%, #27272a 100%)'
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveClipId(clip.id);
                                                    setIsPlaying(false);
                                                    if (videoRef.current) videoRef.current.currentTime = clip.startTime;
                                                }}
                                            >
                                                <div className="absolute inset-0 p-1.5 flex flex-col justify-between overflow-hidden">
                                                    <div className="flex items-start justify-between gap-1">
                                                        {isEditing ? (
                                                            <div className="w-full" onClick={(e) => e.stopPropagation()}>
                                                                <textarea
                                                                    className="w-full h-6 bg-black/30 text-white text-[9px] p-1 rounded border border-teal-400/50 outline-none resize-none"
                                                                    value={editingText}
                                                                    onChange={(e) => setEditingText(e.target.value)}
                                                                    autoFocus
                                                                />
                                                                <div className="flex justify-end gap-0.5 mt-0.5">
                                                                    <button onClick={handleCancelEdit} className="p-0.5 bg-zinc-700 hover:bg-zinc-600 rounded"><XMarkIcon /></button>
                                                                    <button onClick={handleSaveEdit} className="p-0.5 bg-teal-600 hover:bg-teal-500 rounded text-white"><CheckIcon /></button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <span className="text-[9px] font-medium text-white/90 line-clamp-2 leading-tight flex-1">
                                                                    {hasPolished ? (
                                                                        <><span className="mr-0.5">✨</span>{clip.improvedTranscript}</>
                                                                    ) : (
                                                                        <span className="text-zinc-400 italic">Not polished</span>
                                                                    )}
                                                                </span>
                                                                {hasPolished && (
                                                                    <button 
                                                                        onClick={(e) => { e.stopPropagation(); handleStartEdit(clip); }}
                                                                        className="w-4 h-4 rounded bg-black/30 flex items-center justify-center hover:bg-black/50 text-white/70 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                                                    >
                                                                        <PencilIcon />
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                    {!isEditing && (
                                                        <div className="flex items-center justify-between">
                                                            {masterAudioUrl && hasPolished && (
                                                                <div className="flex items-center gap-0.5 text-[8px] text-white/80 bg-black/20 px-1 rounded">
                                                                    <SpeakerWaveIcon /> <span>Sync</span>
                                                                </div>
                                                            )}
                                                            <span className="text-[8px] font-mono text-white/60 ml-auto">{formatTime(duration)}s</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-teal-300/30 rounded-l-md"></div>
                                                <div className="absolute right-0 top-0 bottom-0 w-1 bg-teal-300/30 rounded-r-md"></div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Issues/Redundancy Track */}
                                <div className="flex-1 flex items-center px-2 gap-1 relative bg-[#1a1a1f]">
                                    {clips.map((clip) => {
                                        const hasRedundancy = clip.redundancies && clip.redundancies.length > 0;
                                        const duration = clip.endTime - clip.startTime;
                                        const clipWidth = Math.max(duration * 8, 60);
                                        
                                        if (!hasRedundancy) {
                                            return <div key={clip.id} style={{ width: `${clipWidth}px` }} className="h-8 shrink-0"></div>;
                                        }
                                        
                                        return (
                                            <div 
                                                key={clip.id}
                                                className="h-8 rounded-md overflow-hidden flex gap-0.5"
                                                style={{ width: `${clipWidth}px` }}
                                            >
                                                {clip.redundancies!.map((issue, i) => (
                                                    <div 
                                                        key={i} 
                                                        className={`flex-1 rounded-md flex items-center justify-center gap-1 cursor-pointer transition-all hover:brightness-110 ${
                                                            issue.type === 'silence' 
                                                                ? 'bg-gradient-to-r from-amber-600/80 to-amber-700/80' 
                                                                : 'bg-gradient-to-r from-rose-600/80 to-rose-700/80'
                                                        }`}
                                                        onClick={(e) => { e.stopPropagation(); fixRedundancy(clip.id, issue); }}
                                                        title={issue.type === 'silence' ? `Remove ${issue.duration}s silence` : 'Auto-fix issue'}
                                                    >
                                                        {issue.type === 'silence' ? <MoonIcon /> : <WarningIcon />}
                                                        <span className="text-[8px] text-white font-medium">
                                                            {issue.type === 'silence' ? `${issue.duration}s` : 'Fix'}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
          </div>

          <div className="w-[420px] bg-zinc-950 border-l border-zinc-800 flex flex-col shrink-0">
            <div className="flex border-b border-zinc-800">
              <button onClick={() => setActiveTab('chat')} className={`flex-1 py-3 text-sm font-medium ${activeTab === 'chat' ? 'text-indigo-400 border-b-2 border-indigo-500 bg-zinc-900/50' : 'text-zinc-500 hover:text-zinc-300'}`}>AI Chat</button>
              <button onClick={() => setActiveTab('clips')} className={`flex-1 py-3 text-sm font-medium ${activeTab === 'clips' ? 'text-indigo-400 border-b-2 border-indigo-500 bg-zinc-900/50' : 'text-zinc-500 hover:text-zinc-300'}`}>Clip Studio</button>
            </div>

            {activeTab === 'chat' ? (
                <>
                    <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
                        {messages.length === 0 && !video && <div className="text-center mt-20 opacity-40 text-zinc-500 text-sm">Upload a video to start analysis</div>}
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.role === Sender.User ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === Sender.User ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-bl-none'}`}>
                                    <div className="prose prose-invert prose-sm" dangerouslySetInnerHTML={renderMessageText(msg.text)} />
                                </div>
                            </div>
                        ))}
                        {isAnalyzing && <div className="flex justify-start"><div className="bg-zinc-900 border border-zinc-800 px-4 py-3 rounded-2xl flex items-center gap-2"><LoadingSpinner /><span className="text-xs text-zinc-500 animate-pulse">Visionary is thinking...</span></div></div>}
                        <div ref={chatEndRef} />
                    </div>
                    <div className="p-4 border-t border-zinc-800 bg-zinc-900/30">
                        <div className="flex gap-2 relative">
                            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} placeholder={video ? "Ask about the video..." : "Upload video first"} disabled={!video || isAnalyzing} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 pr-12 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none" />
                            <button onClick={handleSendMessage} disabled={!input.trim() || !video || isAnalyzing} className="absolute right-2 top-2 p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-0 transition-all"><SendIcon /></button>
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex-1 overflow-y-auto bg-zinc-950 p-4 space-y-4">
                     <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Raw Analysis Events</h3>
                     <div className="space-y-3">
                        {timelineEvents.map((evt, idx) => (
                            <div key={idx} className="flex gap-3 pl-4 border-l-2 border-zinc-800 hover:border-indigo-500/50">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-mono text-xs text-indigo-400 bg-zinc-900 px-1.5 py-0.5 rounded">{evt.timestamp}</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${evt.type === 'redundancy' ? 'border-rose-500 text-rose-400' : evt.type === 'silence' ? 'border-amber-500 text-amber-400' : 'border-zinc-700 text-zinc-500'}`}>{evt.type.toUpperCase()}</span>
                                    </div>
                                    <p className="text-xs text-zinc-400">{evt.description}</p>
                                </div>
                            </div>
                        ))}
                        {timelineEvents.length === 0 && <p className="text-zinc-600 text-xs text-center italic mt-10">Run Deep Analysis to populate data.</p>}
                     </div>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
