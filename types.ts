

export enum Sender {
  User = 'user',
  Model = 'model'
}

export interface Message {
  id: string;
  role: Sender;
  text: string;
  timestamp: number;
}

export interface VideoFile {
  file: File;
  previewUrl: string;
  fileUri: string; // Google GenAI File URI
  mimeType: string;
  storagePath?: string | null;
  storageUrl?: string | null;
  fileName?: string;
}

export interface AnalysisState {
  isAnalyzing: boolean;
  progress: string;
}

export interface TimelineEvent {
  timestamp: string; // "MM:SS"
  seconds: number;
  duration?: number; // Duration in seconds (for ranges like silence)
  type: 'visual' | 'audio' | 'redundancy' | 'silence';
  description: string;
}

export interface VisualFragment {
  start: number;
  end: number;
}

export interface Clip {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
  description?: string;
  transcript?: string;
  improvedTranscript?: string; // AI-rewritten professional version
  generatedAudioUrl?: string; // Legacy: individual clip audio. Now largely superseded by Master Audio.
  audioStartTime?: number; // Start time in the Master Audio file
  audioEndTime?: number;   // End time in the Master Audio file
  redundancies?: TimelineEvent[]; // Specific issues found in this clip
  videoRate?: number; // Playback rate multiplier
  visualFragments?: VisualFragment[]; // Non-linear segments to play for this clip
}

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  preview_url: string;
}

export interface AppSettings {
  elevenLabsApiKey: string;
  elevenLabsVoiceId: string;
  elevenLabsModelId: string;
  elevenLabsStability: number;
  elevenLabsSimilarity: number;
  elevenLabsStyle: number;
  elevenLabsSpeakerBoost: boolean;
  elevenLabsVolume: number; // 0.0 to 1.0
  elevenLabsSpeed: number; // 0.5 to 2.5
}
