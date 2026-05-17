'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { RemotionVideo } from '@/remotion/VideoComposition';
import { Infographic } from '@/remotion/InfographicsOverlay';

async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    text += pageText + '\n\n';
  }

  return text.trim();
}

interface Avatar {
  avatar_id: string;
  avatar_name: string;
  preview_image_url: string;
  premium: boolean;
}

interface Voice {
  voice_id: string;
  name: string;
  language: string;
  gender: string;
}

interface SavedVideo {
  id: string;
  title: string;
  createdAt: string;
  script: string;
  backgroundImage: string;
  selectedAvatar: string;
  selectedVoice: string;
  avatarVideoUrl: string;
  renderedVideoUrl: string;
  videoDurationInFrames: number;
  infographics: Infographic[];
  status?: 'published' | 'draft';
  subject?: string;
  chapter?: string;
}

interface DragInfo {
  id: string;
  offsetX: number;
  offsetY: number;
  isResizing: boolean;
  resizeEdge: string;
}

type SidebarItem =
  | 'my-videos'
  | 'create-new'
  | 'drafts'
  | 'browse-subjects'
  | 'browse-chapters'
  | 'manage-avatars'
  | 'manage-users'
  | 'billing'
  | 'my-profile';

export default function Home() {
  const [document, setDocument] = useState<File | null>(null);
  const [script, setScript] = useState('');
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('');
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [videoDurationInFrames, setVideoDurationInFrames] = useState(900);
  const playerRef = useRef<PlayerRef>(null);
  const videoDurationRef = useRef<HTMLVideoElement | null>(null);
  const [generateProgress, setGenerateProgress] = useState(0);
  const [infographics, setInfographics] = useState<Infographic[]>([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [showInfographicPanel, setShowInfographicPanel] = useState(false);
  const [newInfographicImage, setNewInfographicImage] = useState<string | null>(null);
  const [newInfographicFile, setNewInfographicFile] = useState<File | null>(null);
  const [newInfographicStartFrame, setNewInfographicStartFrame] = useState(0);
  const [newInfographicEndFrame, setNewInfographicEndFrame] = useState(90);
  const [isPlaying, setIsPlaying] = useState(false);
  const playbackVideoRef = useRef<HTMLVideoElement | null>(null);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const frameContainerRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState<DragInfo | null>(null);
  const [previewInfographic, setPreviewInfographic] = useState<{
    imageUrl: string;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [editingInfographicId, setEditingInfographicId] = useState<string | null>(null);
  const [editStartFrame, setEditStartFrame] = useState(0);
  const [editEndFrame, setEditEndFrame] = useState(0);
  const [savedVideos, setSavedVideos] = useState<SavedVideo[]>([]);
  const [activeSidebar, setActiveSidebar] = useState<SidebarItem>('my-videos');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('ai-video-generator-saved');
      if (stored) {
        setSavedVideos(JSON.parse(stored));
      }
    } catch {
      console.error('Failed to load saved videos');
    }
  }, []);

  function saveCurrentVideo() {
    if (!videoUrl || !backgroundImage || !script) return;

    const savedVideo: SavedVideo = {
      id: `saved_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: document?.name || `Video ${savedVideos.length + 1}`,
      createdAt: new Date().toISOString(),
      script,
      backgroundImage,
      selectedAvatar,
      selectedVoice,
      avatarVideoUrl: videoUrl,
      renderedVideoUrl: renderedVideoUrl || '',
      videoDurationInFrames,
      infographics,
      status: renderedVideoUrl ? 'published' : 'draft',
      subject: 'Organic Chemistry',
      chapter: 'Ch 2',
    };

    const updated = [savedVideo, ...savedVideos];
    setSavedVideos(updated);
    try {
      localStorage.setItem('ai-video-generator-saved', JSON.stringify(updated));
    } catch {
      console.error('Failed to save video');
    }
  }

  async function loadSavedVideo(video: SavedVideo) {
    setScript(video.script);
    setBackgroundImage(video.backgroundImage);
    setSelectedAvatar(video.selectedAvatar);
    setSelectedVoice(video.selectedVoice);
    setVideoUrl(video.avatarVideoUrl);
    setRenderedVideoUrl(video.renderedVideoUrl || null);
    setVideoDurationInFrames(video.videoDurationInFrames);
    setInfographics(video.infographics);
    setActiveSidebar('create-new');
    setShowInfographicPanel(false);
    setNewInfographicImage(null);
    setPreviewInfographic(null);
  }

  function deleteSavedVideo(id: string) {
    const updated = savedVideos.filter((v) => v.id !== id);
    setSavedVideos(updated);
    try {
      localStorage.setItem('ai-video-generator-saved', JSON.stringify(updated));
    } catch {
      console.error('Failed to delete video');
    }
  }

  function formatDate(isoString: string) {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function formatDuration(frames: number) {
    const seconds = Math.floor(frames / 30);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins} min ${secs} sec`;
  }

  function formatTime(frames: number) {
    const seconds = Math.floor(frames / 30);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function getTotalDuration() {
    const totalSeconds = savedVideos.reduce((acc, v) => acc + v.videoDurationInFrames / 30, 0);
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) return `${hours}.${Math.round((mins / 60) * 10)}h`;
    return `${mins}m`;
  }

  function getLastCreated() {
    if (savedVideos.length === 0) return '—';
    const sorted = [...savedVideos].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return formatDate(sorted[0].createdAt);
  }

  useEffect(() => {
    async function fetchData() {
      try {
        const [avatarsRes, voicesRes] = await Promise.all([
          fetch('/api/video?action=avatars'),
          fetch('/api/video?action=voices'),
        ]);

        if (avatarsRes.ok) {
          const data = await avatarsRes.json();
          setAvatars(data.data?.avatars || []);
        }

        if (voicesRes.ok) {
          const data = await voicesRes.json();
          setVoices(data.data?.voices || []);
        }
      } catch {
        setError('Failed to load avatars and voices');
      }
    }

    fetchData();
  }, []);

  useEffect(() => {
    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!dragging || !frameContainerRef.current || !previewInfographic) return;

    const container = frameContainerRef.current;
    const rect = container.getBoundingClientRect();

    const handleMouseMove = (e: MouseEvent) => {
      const x = ((e.clientX - rect.left - dragging.offsetX) / rect.width) * 100;
      const y = ((e.clientY - rect.top - dragging.offsetY) / rect.height) * 100;

      setPreviewInfographic((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          x: Math.max(0, Math.min(x, 100 - prev.width)),
          y: Math.max(0, Math.min(y, 100 - prev.height)),
        };
      });
    };

    const handleMouseUp = () => {
      setDragging(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, previewInfographic]);

  const checkStatus = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/video?action=status&videoId=${id}`);
      const data = await res.json();

      setStatus(data.data.status);

      const statusProgress: Record<string, number> = {
        pending: 10,
        waiting: 25,
        processing: 60,
      };
      setGenerateProgress(statusProgress[data.data.status] || 50);

      if (data.data.status === 'completed') {
        setGenerateProgress(100);
        const url = data.data.video_url_webm || data.data.video_url || null;
        setVideoUrl(url);

        if (url) {
          const video = globalThis.document.createElement('video');
          video.preload = 'metadata';
          video.src = url;
          video.onloadedmetadata = () => {
            const duration = Math.ceil(video.duration * 30);
            setVideoDurationInFrames(duration);
            setNewInfographicEndFrame(duration);
          };
          video.onerror = () => {
            setVideoDurationInFrames(900);
            setNewInfographicEndFrame(900);
          };
        }

        setLoading(false);
      } else if (data.data.status === 'failed') {
        setError(data.data.error?.message || data.data.error?.detail || 'Video generation failed');
        setLoading(false);
      } else {
        setTimeout(() => checkStatus(id), 5000);
      }
    } catch {
      setError('Failed to check video status');
      setLoading(false);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setVideoUrl(null);
    setVideoId(null);
    setRenderedVideoUrl(null);
    setInfographics([]);
    setLoading(true);

    try {
      const res = await fetch('/api/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avatar_id: selectedAvatar,
          voice_id: selectedVoice,
          input_text: script,
          title: document?.name || 'Generated Video',
          type: 'webm',
          avatar_style: 'normal',
          dimension: { width: 1080, height: 1920 },
        }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setVideoId(data.data.video_id);
      checkStatus(data.data.video_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate video');
      setLoading(false);
    }
  }

  async function handleRenderVideo() {
    if (!videoUrl || !backgroundImage || !script) return;

    setRendering(true);
    setRenderProgress(0);
    setError(null);

    try {
      const response = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avatarVideoUrl: videoUrl,
          backgroundImageUrl: backgroundImage,
          script: script,
          durationInFrames: videoDurationInFrames,
          infographics: infographics,
        }),
      });

      if (!response.ok) {
        throw new Error(`Render failed: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let isDone = false;
      let receivedVideoUrl = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              console.log('SSE data:', data);
              if (data.progress !== undefined) {
                setRenderProgress(data.progress);
              }
              if (data.videoUrl) {
                receivedVideoUrl = data.videoUrl;
                setRenderedVideoUrl(data.videoUrl);
              }
              if (data.done) {
                isDone = true;
              }
            } catch (e) {
              console.error('SSE parse error:', e);
            }
          }
        }

        if (isDone) break;
      }

      if (!receivedVideoUrl) {
        throw new Error('Rendering completed but no video URL received');
      }

      saveCurrentVideo();
    } catch (err) {
      console.error('Render error:', err);
      setError(err instanceof Error ? err.message : 'Failed to render video');
    } finally {
      setRendering(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    console.log('File selected:', file?.name, file?.type, file?.size);
    setDocument(file);

    if (!file) return;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isTxt = file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt');

    if (isTxt) {
      const text = await file.text();
      setScript(text.slice(0, 5000));
    } else if (isPdf) {
      setExtracting(true);
      setError(null);
      try {
        console.log('Starting PDF extraction...');
        const text = await extractPdfText(file);
        console.log('Extracted text length:', text.length);
        if (!text) {
          setError('No text found in PDF. The PDF may contain only images.');
        } else {
          setScript(text.slice(0, 5000));
        }
      } catch (err) {
        console.error('PDF extraction error:', err);
        setError(`Failed to extract text from PDF: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setExtracting(false);
      }
    } else {
      console.log('Unsupported file type:', file.type);
      setError(`Unsupported file type: ${file.type}. Please use PDF or TXT files.`);
    }
  }

  function handleBackgroundImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      setError('Please upload a valid image file.');
      return;
    }

    setBackgroundFile(file);
    setRenderedVideoUrl(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      setBackgroundImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  function handleInfographicImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      setError('Please upload a valid image file.');
      return;
    }

    setNewInfographicFile(file);
    setRenderedVideoUrl(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      setNewInfographicImage(event.target?.result as string);
      setPreviewInfographic({
        imageUrl: event.target?.result as string,
        x: 35,
        y: 20,
        width: 30,
        height: 25,
      });
    };
    reader.readAsDataURL(file);
  }

  function handlePlayAvatarVideo() {
    if (!videoUrl) return;

    if (playbackVideoRef.current) {
      const video = playbackVideoRef.current;
      if (isPlaying) {
        video.pause();
        setIsPlaying(false);
        if (playbackIntervalRef.current) {
          clearInterval(playbackIntervalRef.current);
        }
      } else {
        video.play();
        setIsPlaying(true);
        playbackIntervalRef.current = setInterval(() => {
          if (!video.paused) {
            const frame = Math.floor(video.currentTime * 30);
            setCurrentFrame(frame);
          }
        }, 100);
      }
    }
  }

  function handleSeekVideo(frame: number) {
    if (playbackVideoRef.current) {
      const video = playbackVideoRef.current;
      video.currentTime = frame / 30;
      setCurrentFrame(frame);
    }
  }

  function handleStartDrag(e: React.MouseEvent, info: { x: number; y: number; width: number; height: number }) {
    e.preventDefault();
    e.stopPropagation();
    if (!frameContainerRef.current) return;

    const container = frameContainerRef.current;
    const rect = container.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const elementX = (info.x / 100) * rect.width;
    const elementY = (info.y / 100) * rect.height;

    setDragging({
      id: 'preview',
      offsetX: clickX - elementX,
      offsetY: clickY - elementY,
      isResizing: false,
      resizeEdge: '',
    });
  }

  async function handleAddInfographic() {
    if (!newInfographicImage || !previewInfographic) return;

    const x1920 = (previewInfographic.x / 100) * 1920;
    const y1080 = (previewInfographic.y / 100) * 1080;
    const widthPx = (previewInfographic.width / 100) * 1920;
    const heightPx = (previewInfographic.height / 100) * 1080;

    const newInfographic: Infographic = {
      id: `info_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      imageUrl: newInfographicImage,
      startFrame: Math.min(newInfographicStartFrame, newInfographicEndFrame),
      endFrame: Math.max(newInfographicStartFrame, newInfographicEndFrame),
      x: x1920,
      y: y1080,
      width: widthPx,
      height: heightPx,
    };

    setInfographics([...infographics, newInfographic]);
    setNewInfographicImage(null);
    setNewInfographicFile(null);
    setPreviewInfographic(null);
  }

  function handleRemoveInfographic(id: string) {
    setInfographics(infographics.filter((info) => info.id !== id));
    setRenderedVideoUrl(null);
    if (editingInfographicId === id) {
      setEditingInfographicId(null);
    }
  }

  function handleStartEditInfographic(id: string) {
    const info = infographics.find((i) => i.id === id);
    if (!info) return;
    setEditingInfographicId(id);
    setEditStartFrame(info.startFrame);
    setEditEndFrame(info.endFrame);
  }

  function handleSaveEditInfographic() {
    if (!editingInfographicId) return;
    setInfographics(
      infographics.map((info) =>
        info.id === editingInfographicId
          ? {
              ...info,
              startFrame: Math.min(editStartFrame, editEndFrame),
              endFrame: Math.max(editStartFrame, editEndFrame),
            }
          : info
      )
    );
    setEditingInfographicId(null);
    setRenderedVideoUrl(null);
  }

  function handleReRender() {
    setRenderedVideoUrl(null);
    setRendering(false);
    setRenderProgress(0);
  }

  const publishedVideos = savedVideos.filter((v) => v.status === 'published');
  const draftVideos = savedVideos.filter((v) => v.status !== 'published');
  const uniqueSubjects = new Set(savedVideos.map((v) => v.subject).filter(Boolean)).size;

  const sidebarItems: { key: SidebarItem; label: string; section: string; badge?: number; locked?: boolean }[] = [
    { key: 'my-videos', label: 'My videos', section: 'MY WORK' },
    { key: 'create-new', label: 'Create new video', section: 'MY WORK' },
    { key: 'drafts', label: 'Drafts', section: 'MY WORK', badge: draftVideos.length },
    { key: 'browse-subjects', label: 'Browse subjects', section: 'LIBRARY' },
    { key: 'browse-chapters', label: 'Browse chapters', section: 'LIBRARY' },
    { key: 'manage-avatars', label: 'Manage avatars', section: 'AVATARS' },
    { key: 'manage-users', label: 'Manage users', section: 'SETTINGS', locked: true },
    { key: 'billing', label: 'Billing', section: 'SETTINGS', locked: true },
    { key: 'my-profile', label: 'My profile', section: 'SETTINGS' },
  ];

  const groupedSidebar = sidebarItems.reduce<Record<string, typeof sidebarItems>>((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {});

  function renderMainContent() {
    switch (activeSidebar) {
      case 'my-videos':
        return renderMyVideos();
      case 'create-new':
        return renderCreateNew();
      case 'drafts':
        return renderDrafts();
      case 'manage-avatars':
        return renderManageAvatars();
      default:
        return renderMyVideos();
    }
  }

  function renderMyVideos() {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#1a1a24] rounded-xl p-4">
            <p className="text-zinc-400 text-sm">My videos</p>
            <p className="text-white text-2xl font-bold mt-1">{savedVideos.length}</p>
            <p className="text-zinc-500 text-xs mt-1">Across {uniqueSubjects || 1} subjects</p>
          </div>
          <div className="bg-[#1a1a24] rounded-xl p-4">
            <p className="text-zinc-400 text-sm">Published</p>
            <p className="text-white text-2xl font-bold mt-1">{publishedVideos.length}</p>
            <p className="text-zinc-500 text-xs mt-1">{draftVideos.length} drafts</p>
          </div>
          <div className="bg-[#1a1a24] rounded-xl p-4">
            <p className="text-zinc-400 text-sm">Total duration</p>
            <p className="text-white text-2xl font-bold mt-1">{getTotalDuration()}</p>
            <p className="text-zinc-500 text-xs mt-1">Content created</p>
          </div>
          <div className="bg-[#1a1a24] rounded-xl p-4">
            <p className="text-zinc-400 text-sm">Last created</p>
            <p className="text-white text-2xl font-bold mt-1">{getLastCreated()}</p>
            <p className="text-zinc-500 text-xs mt-1">Functional Group</p>
          </div>
        </div>

        <div className="bg-[#1a1a24] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white text-lg font-semibold">My videos</h2>
            <button
              onClick={() => setActiveSidebar('create-new')}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New video
            </button>
          </div>

          {savedVideos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <svg className="w-12 h-12 text-zinc-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p className="text-zinc-500 text-sm">No videos yet</p>
              <button
                onClick={() => setActiveSidebar('create-new')}
                className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Create your first video
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {savedVideos.map((video) => (
                <div key={video.id} className="flex items-center gap-4 bg-[#12121a] rounded-lg p-3 hover:bg-[#1e1e2a] transition-colors group">
                  <div className="w-16 h-10 bg-[#1a1a24] rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {video.backgroundImage ? (
                      <img src={video.backgroundImage} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-3 h-3 rounded-full bg-indigo-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{video.title}</p>
                    <p className="text-zinc-500 text-xs mt-0.5">
                      {video.subject || 'Unknown'} · {video.chapter || 'Ch 1'} ·{' '}
                      {video.renderedVideoUrl ? formatDuration(video.videoDurationInFrames) : `${Math.round(video.videoDurationInFrames / 30)}s`}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      video.status === 'published'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {video.status === 'published' ? 'Published' : 'Draft'}
                  </span>
                  <div className="flex items-center gap-2">
                    {video.renderedVideoUrl && (
                      <a
                        href={video.renderedVideoUrl}
                        download
                        className="text-zinc-400 hover:text-white text-xs px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
                      >
                        Download
                      </a>
                    )}
                    <button
                      onClick={() => loadSavedVideo(video)}
                      className="text-zinc-400 hover:text-white p-1 transition-colors"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteSavedVideo(video.id)}
                      className="text-zinc-600 hover:text-red-400 p-1 transition-colors"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#1a1a24] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white text-lg font-semibold">Available avatars</h2>
            <p className="text-zinc-500 text-sm">Managed by your admin</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {avatars.slice(0, 4).map((avatar) => (
              <div
                key={avatar.avatar_id}
                className="flex items-center gap-3 bg-[#12121a] rounded-lg px-4 py-3 border border-white/5 hover:border-white/10 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                  {avatar.avatar_name.charAt(0)}
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{avatar.avatar_name}</p>
                  <p className="text-zinc-500 text-xs">Chemistry</p>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-3 bg-[#12121a] rounded-lg px-4 py-3 border border-white/5 border-dashed">
              <div className="w-8 h-8 rounded-full bg-[#1a1a24] flex items-center justify-center text-zinc-500 text-xs">
                +
              </div>
              <p className="text-zinc-500 text-sm">More coming soon</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderDrafts() {
    return (
      <div className="space-y-6">
        <div className="bg-[#1a1a24] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white text-lg font-semibold">Drafts</h2>
            <button
              onClick={() => setActiveSidebar('create-new')}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New video
            </button>
          </div>

          {draftVideos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <svg className="w-12 h-12 text-zinc-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-zinc-500 text-sm">No drafts</p>
            </div>
          ) : (
            <div className="space-y-3">
              {draftVideos.map((video) => (
                <div key={video.id} className="flex items-center gap-4 bg-[#12121a] rounded-lg p-3 hover:bg-[#1e1e2a] transition-colors">
                  <div className="w-16 h-10 bg-[#1a1a24] rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {video.backgroundImage ? (
                      <img src={video.backgroundImage} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{video.title}</p>
                    <p className="text-zinc-500 text-xs mt-0.5">
                      {video.subject || 'Unknown'} · {video.chapter || 'Ch 1'} · {Math.round(video.videoDurationInFrames / 30)}s
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400">Draft</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => loadSavedVideo(video)}
                      className="text-zinc-400 hover:text-white p-1 transition-colors"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteSavedVideo(video.id)}
                      className="text-zinc-600 hover:text-red-400 p-1 transition-colors"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderManageAvatars() {
    return (
      <div className="space-y-6">
        <div className="bg-[#1a1a24] rounded-xl p-6">
          <h2 className="text-white text-lg font-semibold mb-4">Manage avatars</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {avatars.map((avatar) => (
              <div key={avatar.avatar_id} className="bg-[#12121a] rounded-lg p-4 border border-white/5 hover:border-white/10 transition-colors">
                <div className="w-full aspect-square bg-[#1a1a24] rounded-lg mb-3 overflow-hidden flex items-center justify-center">
                  {avatar.preview_image_url ? (
                    <img src={avatar.preview_image_url} alt={avatar.avatar_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-white text-2xl font-bold">
                      {avatar.avatar_name.charAt(0)}
                    </div>
                  )}
                </div>
                <p className="text-white text-sm font-medium">{avatar.avatar_name}</p>
                <p className="text-zinc-500 text-xs mt-1">{avatar.premium ? 'Premium' : 'Free'}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderCreateNew() {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#1a1a24] rounded-xl p-6">
          <h2 className="text-white text-lg font-semibold mb-6">Create new video</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Upload Document</label>
              <div className="relative">
                <input
                  type="file"
                  accept=".txt,.pdf,.doc,.docx"
                  onChange={handleFileChange}
                  disabled={extracting}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <div className="flex items-center justify-center w-full h-20 border-2 border-dashed border-white/10 rounded-lg hover:border-indigo-500/50 transition-colors bg-[#12121a]">
                  <p className="text-zinc-400 text-sm">{document ? document.name : 'Drop PDF or TXT file here'}</p>
                </div>
              </div>
              {extracting && <p className="text-sm text-indigo-400 mt-2 animate-pulse">Extracting text from PDF...</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Background Image</label>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleBackgroundImageChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex items-center justify-center w-full h-20 border-2 border-dashed border-white/10 rounded-lg hover:border-indigo-500/50 transition-colors bg-[#12121a]">
                  <p className="text-zinc-400 text-sm">{backgroundFile ? backgroundFile.name : 'Upload background image'}</p>
                </div>
              </div>
              {backgroundImage && (
                <div className="mt-2 rounded-lg overflow-hidden border border-white/10">
                  <img src={backgroundImage} alt="Background" className="w-full h-24 object-cover" />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Script</label>
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value.slice(0, 5000))}
                required
                rows={6}
                className="w-full px-4 py-3 rounded-lg border border-white/10 bg-[#12121a] text-white placeholder-zinc-500 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 resize-none transition-all text-sm"
                placeholder="Enter your script or upload a document..."
              />
              <div className="flex justify-between mt-1">
                <p className="text-xs text-zinc-500">{script.length}/5000 characters</p>
                <div className="w-20 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all"
                    style={{ width: `${Math.min((script.length / 5000) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Avatar</label>
                <select
                  value={selectedAvatar}
                  onChange={(e) => setSelectedAvatar(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-white/10 bg-[#12121a] text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all appearance-none cursor-pointer text-sm"
                >
                  <option value="" className="bg-[#1a1a24]">Select an avatar</option>
                  {avatars.map((avatar, index) => (
                    <option key={`${avatar.avatar_id}-${index}`} value={avatar.avatar_id} className="bg-[#1a1a24]">
                      {avatar.avatar_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Voice</label>
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-white/10 bg-[#12121a] text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all appearance-none cursor-pointer text-sm"
                >
                  <option value="" className="bg-[#1a1a24]">Select a voice</option>
                  {voices.map((voice, index) => (
                    <option key={`${voice.voice_id}-${index}`} value={voice.voice_id} className="bg-[#1a1a24]">
                      {voice.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !script || !selectedAvatar || !selectedVoice}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 px-6 rounded-lg font-semibold text-sm shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Generating... {generateProgress}%
                </span>
              ) : 'Generate Avatar Video'}
            </button>
          </form>

          {error && (
            <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {status && status !== 'completed' && status !== 'failed' && (
            <div className="mt-4 bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                  <p className="text-indigo-400 text-sm capitalize">{status}</p>
                </div>
                <p className="text-indigo-400 text-sm font-medium">{generateProgress}%</p>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${generateProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="bg-[#1a1a24] rounded-xl p-6">
          <h3 className="text-white text-lg font-semibold mb-4">Preview</h3>

          {renderedVideoUrl ? (
            <div className="space-y-4">
              <div className="rounded-lg overflow-hidden border border-green-500/30">
                <video src={renderedVideoUrl} controls className="w-full" />
              </div>
              <div className="flex gap-3">
                <a
                  href={renderedVideoUrl}
                  download
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white py-2.5 px-4 rounded-lg font-medium text-sm transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Final Video
                </a>
                <button
                  onClick={handleReRender}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2.5 px-4 rounded-lg font-medium text-sm transition-all border border-white/10"
                >
                  Edit & Re-render
                </button>
              </div>
            </div>
          ) : videoUrl && backgroundImage ? (
            <div className="space-y-4">
              <div className="text-xs text-indigo-400 mb-1">Preview - Avatar + Background + Script</div>
              <div className="rounded-lg overflow-hidden border border-white/10">
                <Player
                  key={videoUrl}
                  ref={playerRef}
                  component={RemotionVideo}
                  durationInFrames={videoDurationInFrames}
                  fps={30}
                  compositionWidth={1920}
                  compositionHeight={1080}
                  style={{ width: '100%', height: 'auto' }}
                  inputProps={{
                    avatarVideoUrl: videoUrl,
                    backgroundImageUrl: backgroundImage,
                    script: script,
                    durationInFrames: videoDurationInFrames,
                    infographics: infographics,
                  }}
                  controls
                />
              </div>

              <div className="border-t border-white/10 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-zinc-300">Place Infographics</h4>
                  <button
                    type="button"
                    onClick={() => setShowInfographicPanel(!showInfographicPanel)}
                    className="text-xs bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {showInfographicPanel ? 'Hide Panel' : 'Show Panel'}
                  </button>
                </div>

                {showInfographicPanel && (
                  <div className="space-y-4 bg-[#12121a] rounded-lg p-4 border border-white/10">
                    <div className="relative rounded-lg overflow-hidden border border-white/10">
                      <video
                        ref={playbackVideoRef}
                        src={videoUrl}
                        className="w-full"
                        onEnded={() => setIsPlaying(false)}
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-3 py-2 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={handlePlayAvatarVideo}
                          className="text-white hover:text-indigo-400 transition-colors"
                        >
                          {isPlaying ? (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          )}
                        </button>
                        <span className="text-xs text-zinc-300 font-mono">
                          {formatTime(currentFrame)} / {formatTime(videoDurationInFrames)}
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={videoDurationInFrames}
                          value={currentFrame}
                          onChange={(e) => handleSeekVideo(Number(e.target.value))}
                          className="flex-1 h-1 bg-white/20 rounded-full appearance-none cursor-pointer"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-2">Upload Infographic Image</label>
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleInfographicImageChange}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="flex items-center justify-center w-full h-14 border-2 border-dashed border-white/10 rounded-lg hover:border-indigo-500/50 transition-colors bg-[#1a1a24]">
                          <p className="text-zinc-500 text-xs">{newInfographicFile ? newInfographicFile.name : 'Upload infographic image'}</p>
                        </div>
                      </div>
                    </div>

                    {previewInfographic && (
                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-zinc-400">Drag to place on frame</label>
                        <div
                          ref={frameContainerRef}
                          className="relative w-full rounded-lg overflow-hidden border border-indigo-500/30 bg-black/50 cursor-crosshair"
                          style={{ aspectRatio: '16/9' }}
                        >
                          <video src={videoUrl} className="w-full h-full object-cover" muted />
                          <div
                            className="absolute top-0 bottom-0 border-l-2 border-dashed border-yellow-400/60 pointer-events-none"
                            style={{ left: '30%' }}
                          >
                            <span className="absolute -top-4 left-1 text-[10px] text-yellow-400 font-mono whitespace-nowrap">
                              Script area →
                            </span>
                          </div>
                          <div
                            className="absolute border-2 border-indigo-400 bg-indigo-400/10 cursor-move hover:border-indigo-300 transition-colors"
                            style={{
                              left: `${previewInfographic.x}%`,
                              top: `${previewInfographic.y}%`,
                              width: `${previewInfographic.width}%`,
                              height: `${previewInfographic.height}%`,
                            }}
                            onMouseDown={(e) => handleStartDrag(e, previewInfographic)}
                          >
                            <img
                              src={previewInfographic.imageUrl}
                              alt="Preview"
                              className="w-full h-full object-contain pointer-events-none"
                            />
                            <div className="absolute -top-4 left-0 text-xs text-indigo-400 font-mono whitespace-nowrap">
                              {formatTime(newInfographicStartFrame)} - {formatTime(newInfographicEndFrame)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {previewInfographic && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-1">Start Time</label>
                            <input
                              type="number"
                              min={0}
                              max={videoDurationInFrames}
                              value={newInfographicStartFrame}
                              onChange={(e) => setNewInfographicStartFrame(Number(e.target.value))}
                              className="w-full px-3 py-2 rounded-lg border border-white/10 bg-[#1a1a24] text-white text-sm focus:ring-2 focus:ring-indigo-500/50"
                            />
                            <span className="text-xs text-zinc-500">{formatTime(newInfographicStartFrame)}</span>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-1">End Time</label>
                            <input
                              type="number"
                              min={0}
                              max={videoDurationInFrames}
                              value={newInfographicEndFrame}
                              onChange={(e) => setNewInfographicEndFrame(Number(e.target.value))}
                              className="w-full px-3 py-2 rounded-lg border border-white/10 bg-[#1a1a24] text-white text-sm focus:ring-2 focus:ring-indigo-500/50"
                            />
                            <span className="text-xs text-zinc-500">{formatTime(newInfographicEndFrame)}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-1">Width (%)</label>
                            <input
                              type="range"
                              min={5}
                              max={80}
                              value={previewInfographic.width}
                              onChange={(e) =>
                                setPreviewInfographic({ ...previewInfographic, width: Number(e.target.value) })
                              }
                              className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer"
                            />
                            <span className="text-xs text-zinc-500">{previewInfographic.width}%</span>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-1">Height (%)</label>
                            <input
                              type="range"
                              min={5}
                              max={80}
                              value={previewInfographic.height}
                              onChange={(e) =>
                                setPreviewInfographic({ ...previewInfographic, height: Number(e.target.value) })
                              }
                              className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer"
                            />
                            <span className="text-xs text-zinc-500">{previewInfographic.height}%</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleAddInfographic}
                          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 px-4 rounded-lg font-medium text-sm shadow-lg shadow-indigo-500/25 transition-all"
                        >
                          Add Infographic
                        </button>
                      </div>
                    )}

                    {infographics.length > 0 && (
                      <div className="space-y-2 border-t border-white/10 pt-3">
                        <h4 className="text-xs font-medium text-zinc-400">Added Infographics ({infographics.length})</h4>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {infographics.map((info, index) => (
                            <div key={info.id} className="bg-[#1a1a24] rounded-lg p-2 border border-white/10 space-y-2">
                              <div className="flex items-center gap-2">
                                <img src={info.imageUrl} alt={`Infographic ${index + 1}`} className="w-12 h-8 object-contain bg-black/50 rounded" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-zinc-300 font-medium">#{index + 1}</p>
                                  <p className="text-xs text-zinc-500">{formatTime(info.startFrame)} - {formatTime(info.endFrame)}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveInfographic(info.id)}
                                  className="text-red-400 hover:text-red-300 transition-colors p-1"
                                  title="Delete"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>

                              {editingInfographicId === info.id ? (
                                <div className="space-y-2 pt-2 border-t border-white/10">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-xs text-zinc-500 mb-1">Start</label>
                                      <input
                                        type="number"
                                        min={0}
                                        max={videoDurationInFrames}
                                        value={editStartFrame}
                                        onChange={(e) => setEditStartFrame(Number(e.target.value))}
                                        className="w-full px-2 py-1 rounded border border-white/10 bg-[#1a1a24] text-white text-xs"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-zinc-500 mb-1">End</label>
                                      <input
                                        type="number"
                                        min={0}
                                        max={videoDurationInFrames}
                                        value={editEndFrame}
                                        onChange={(e) => setEditEndFrame(Number(e.target.value))}
                                        className="w-full px-2 py-1 rounded border border-white/10 bg-[#1a1a24] text-white text-xs"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={handleSaveEditInfographic}
                                      className="flex-1 bg-green-600 hover:bg-green-500 text-white py-1 rounded text-xs transition-colors"
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingInfographicId(null)}
                                      className="flex-1 bg-white/10 hover:bg-white/20 text-white py-1 rounded text-xs transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleStartEditInfographic(info.id)}
                                  className="w-full text-xs text-indigo-400 hover:text-indigo-300 transition-colors py-1"
                                >
                                  Edit timing
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={handleRenderVideo}
                disabled={rendering}
                className="w-full bg-green-600 hover:bg-green-500 text-white py-3 px-6 rounded-lg font-semibold shadow-lg shadow-green-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
              >
                {rendering ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Rendering... {renderProgress}%
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Render Final Video (MP4)
                  </span>
                )}
              </button>
              {rendering && (
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all duration-300"
                    style={{ width: `${renderProgress}%` }}
                  />
                </div>
              )}
            </div>
          ) : backgroundImage && script ? (
            <div className="space-y-4">
              <div className="text-xs text-zinc-500 mb-2">Live Preview (generate avatar first)</div>
              <div className="relative rounded-lg overflow-hidden border border-white/10" style={{ aspectRatio: '16/9' }}>
                <img src={backgroundImage} alt="Background" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute left-[30%] top-0 w-[70%] h-full bg-black/60" />
                <div className="absolute left-0 top-0 w-[30%] h-full flex items-center justify-center">
                  <div className="text-zinc-500 text-xs text-center px-2">Avatar will appear here</div>
                </div>
                <div className="absolute left-[30%] top-0 w-[70%] h-full p-4 overflow-hidden">
                  <div className="text-white text-xs leading-relaxed line-clamp-4">
                    {script}
                  </div>
                </div>
              </div>
              <button
                onClick={handleSubmit}
                disabled={loading || !script || !selectedAvatar || !selectedVoice}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 px-6 rounded-lg font-medium shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
              >
                {loading ? 'Generating Avatar...' : 'Generate Avatar Video'}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-white/10 rounded-lg bg-[#12121a]">
              <svg className="w-12 h-12 text-zinc-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p className="text-zinc-500 text-sm text-center px-4">
                {loading ? 'Generating avatar video...' : !backgroundImage ? 'Upload a background image to preview' : 'Your video will appear here'}
              </p>
              {loading && (
                <div className="mt-3 w-24 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full animate-pulse" style={{ width: '60%' }} />
                </div>
              )}
            </div>
          )}
        </div>

        {videoUrl && backgroundImage && (
          <div className="lg:col-span-2">
            <button
              onClick={saveCurrentVideo}
              disabled={!renderedVideoUrl && !videoUrl}
              className="w-full bg-amber-600 hover:bg-amber-500 text-white py-3 px-6 rounded-lg font-semibold shadow-lg shadow-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              Save Video to My Videos
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f14] text-white flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#14141c] border-r border-white/5 flex flex-col transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-0 lg:overflow-hidden'
        }`}
      >
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-white text-sm font-semibold">EduCast</h1>
              <p className="text-zinc-500 text-xs">AI Video Platform</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-6">
          {Object.entries(groupedSidebar).map(([section, items]) => (
            <div key={section}>
              <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider px-3 mb-2">{section}</p>
              <div className="space-y-0.5">
                {items.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => {
                      if (!item.locked) {
                        setActiveSidebar(item.key);
                        if (window.innerWidth < 1024) setSidebarOpen(false);
                      }
                    }}
                    disabled={item.locked}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                      activeSidebar === item.key
                        ? 'bg-white/10 text-white'
                        : item.locked
                        ? 'text-zinc-600 cursor-not-allowed'
                        : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {item.label}
                    </span>
                    <div className="flex items-center gap-2">
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="bg-amber-500/20 text-amber-400 text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                          {item.badge}
                        </span>
                      )}
                      {item.locked && (
                        <svg className="w-3.5 h-3.5 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-white/5">
          <button
            onClick={() => setSidebarOpen(false)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors text-sm lg:hidden"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
            Close
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 bg-[#0f0f14]/80 backdrop-blur-xl border-b border-white/5">
          <div className="flex items-center justify-between px-4 lg:px-6 py-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h2 className="text-white font-semibold capitalize">
                {activeSidebar === 'my-videos' ? 'My videos' : activeSidebar === 'create-new' ? 'Create new video' : activeSidebar === 'drafts' ? 'Drafts' : activeSidebar === 'manage-avatars' ? 'Manage avatars' : activeSidebar.replace(/-/g, ' ')}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                U
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {renderMainContent()}
        </div>
      </main>
    </div>
  );
}
