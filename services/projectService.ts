import { supabase } from './supabaseClient';
import { AppSettings, Clip, Message, TimelineEvent } from '../types';

export const PROJECT_BUCKET = 'project-uploads';

const sanitizeFileName = (name: string) => {
  if (!name) return 'file';
  const normalized = name
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-');
  const trimmed = normalized.replace(/-+/g, '-').replace(/^-|-$/g, '');
  return trimmed || 'file';
};

const mapProjectRow = (row: any): ProjectRecord => ({
  id: row.id,
  name: row.name,
  description: row.description ?? null,
  videoStoragePath: row.video_storage_path ?? null,
  videoFileName: row.video_file_name ?? null,
  videoMimeType: row.video_mime_type ?? null,
  videoFileUri: row.video_file_uri ?? null,
  masterAudioStoragePath: row.master_audio_storage_path ?? null,
  masterAudioMimeType: row.master_audio_mime_type ?? null,
  hasMasterAudio: row.has_master_audio ?? false,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  lastOpenedAt: row.last_opened_at
});

const mapStateRow = (row: any): ProjectStateSnapshot => ({
  projectId: row.project_id,
  messages: row.messages ?? [],
  clips: row.clips ?? [],
  timelineEvents: row.timeline_events ?? [],
  settings: row.settings ?? {},
  masterAudioMeta: row.master_audio_meta ?? null,
  editorMeta: row.editor_meta ?? null,
  hasAnalyzed: row.has_analyzed ?? false,
  activeClipId: row.active_clip_id ?? null
});

export interface ProjectRecord {
  id: string;
  name: string;
  description: string | null;
  videoStoragePath: string | null;
  videoFileName: string | null;
  videoMimeType: string | null;
  videoFileUri: string | null;
  masterAudioStoragePath: string | null;
  masterAudioMimeType: string | null;
  hasMasterAudio: boolean;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
}

export interface ProjectStateSnapshot {
  projectId: string;
  messages: Message[];
  clips: Clip[];
  timelineEvents: TimelineEvent[];
  settings: Partial<AppSettings>;
  masterAudioMeta?: Record<string, any> | null;
  editorMeta?: Record<string, any> | null;
  hasAnalyzed: boolean;
  activeClipId: string | null;
}

export interface ProjectSnapshotPayload {
  messages: Message[];
  clips: Clip[];
  timelineEvents: TimelineEvent[];
  settings: AppSettings;
  hasAnalyzed: boolean;
  activeClipId: string | null;
  masterAudioMeta?: Record<string, any> | null;
  editorMeta?: Record<string, any> | null;
}

export const listProjects = async (): Promise<ProjectRecord[]> => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapProjectRow);
};

export const createProject = async (name: string, description?: string): Promise<ProjectRecord> => {
  const { data, error } = await supabase
    .from('projects')
    .insert({ name, description })
    .select()
    .single();

  if (error) throw error;
  const { error: stateError } = await supabase
    .from('project_states')
    .insert({ project_id: data.id })
    .single();

  if (stateError) {
    console.warn('Failed to seed project state', stateError);
  }
  return mapProjectRow(data);
};

export const loadProjectWithState = async (projectId: string): Promise<{ project: ProjectRecord; state: ProjectStateSnapshot | null; }> => {
  const { data: projectRow, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (projectError) throw projectError;

  const { data: stateRow, error: stateError } = await supabase
    .from('project_states')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();

  if (stateError) throw stateError;

  return {
    project: mapProjectRow(projectRow),
    state: stateRow ? mapStateRow(stateRow) : null
  };
};

export const saveProjectState = async (projectId: string, payload: ProjectSnapshotPayload) => {
  const { error } = await supabase
    .from('project_states')
    .upsert({
      project_id: projectId,
      messages: payload.messages,
      clips: payload.clips,
      timeline_events: payload.timelineEvents,
      settings: payload.settings,
      has_analyzed: payload.hasAnalyzed,
      active_clip_id: payload.activeClipId,
      master_audio_meta: payload.masterAudioMeta ?? null,
      editor_meta: payload.editorMeta ?? null
    });

  if (error) throw error;
};

export const updateProjectMetadata = async (projectId: string, updates: Partial<{ name: string; description: string | null; videoStoragePath: string | null; videoFileName: string | null; videoMimeType: string | null; videoFileUri: string | null; masterAudioStoragePath: string | null; masterAudioMimeType: string | null; hasMasterAudio: boolean; }>) => {
  const payload: Record<string, any> = {};
  if ('name' in updates) payload.name = updates.name;
  if ('description' in updates) payload.description = updates.description;
  if ('videoStoragePath' in updates) payload.video_storage_path = updates.videoStoragePath;
  if ('videoFileName' in updates) payload.video_file_name = updates.videoFileName;
  if ('videoMimeType' in updates) payload.video_mime_type = updates.videoMimeType;
  if ('videoFileUri' in updates) payload.video_file_uri = updates.videoFileUri;
  if ('masterAudioStoragePath' in updates) payload.master_audio_storage_path = updates.masterAudioStoragePath;
  if ('masterAudioMimeType' in updates) payload.master_audio_mime_type = updates.masterAudioMimeType;
  if ('hasMasterAudio' in updates) payload.has_master_audio = updates.hasMasterAudio;

  const { error } = await supabase
    .from('projects')
    .update(payload)
    .eq('id', projectId);

  if (error) throw error;
};

export const touchProject = async (projectId: string) => {
  const { error } = await supabase
    .from('projects')
    .update({ last_opened_at: new Date().toISOString() })
    .eq('id', projectId);

  if (error) throw error;
};

export const bumpProjectUpdatedAt = async (projectId: string) => {
  const { error } = await supabase
    .from('projects')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', projectId);

  if (error) throw error;
};

export const uploadProjectAsset = async (
  projectId: string,
  file: Blob | File,
  options: { type: 'video' | 'audio' | 'analysis' | 'other'; fileName?: string; contentType: string }
): Promise<{ path: string; publicUrl: string; }> => {
  const baseName = options.fileName || `${options.type}-${Date.now()}`;
  const lastDot = baseName.lastIndexOf('.');
  const extension = lastDot !== -1 ? baseName.slice(lastDot + 1) : undefined;
  const nameWithoutExt = lastDot !== -1 ? baseName.slice(0, lastDot) : baseName;
  const safeBase = sanitizeFileName(nameWithoutExt);
  const safeName = extension ? `${safeBase}.${extension}` : safeBase;
  const path = `${projectId}/${options.type}/${Date.now()}-${safeName}`;

  const { error } = await supabase
    .storage
    .from(PROJECT_BUCKET)
    .upload(path, file, { upsert: true, contentType: options.contentType });

  if (error) throw error;

  const { data } = supabase.storage.from(PROJECT_BUCKET).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
};

export const downloadProjectAsset = async (path: string): Promise<Blob> => {
  const { data, error } = await supabase.storage.from(PROJECT_BUCKET).download(path);
  if (error) throw error;
  return data;
};

export const getAssetPublicUrl = (path: string): string => {
  const { data } = supabase.storage.from(PROJECT_BUCKET).getPublicUrl(path);
  return data.publicUrl;
};

export const clearProjectMasterAudio = async (projectId: string) => {
  const { error } = await supabase
    .from('projects')
    .update({
      master_audio_storage_path: null,
      master_audio_mime_type: null,
      has_master_audio: false
    })
    .eq('id', projectId);

  if (error) throw error;
};
