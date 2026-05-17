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
}

interface DragInfo {
  id: string;
  offsetX: number;
  offsetY: number;
  isResizing: boolean;
  resizeEdge: string;
}

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
  const [showSavedVideos, setShowSavedVideos] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'saved'>('create');

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
    setActiveTab('create');
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
      hour: '2-digit',
      minute: '2-digit',
    });
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

  function formatTime(frames: number) {
    const seconds = Math.floor(frames / 30);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#0A0A0F] to-[#0A0A0F]" />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        <div className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl text-sm font-medium text-indigo-300 mb-4">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            Powered by HeyGen AI + Remotion
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
            AI Video Generator
          </h1>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
            Transform your documents into engaging AI avatar videos with custom backgrounds and infographics
          </p>
        </div>

        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('create')}
              className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'create'
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create New
              </span>
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'saved'
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                My Videos ({savedVideos.length})
              </span>
            </button>
          </div>
        </div>

        {activeTab === 'saved' && (
          <div className="max-w-4xl mx-auto">
            {savedVideos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-white/10 rounded-2xl bg-white/5">
                <svg className="w-16 h-16 text-zinc-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p className="text-zinc-500 text-lg">No saved videos yet</p>
                <p className="text-zinc-600 text-sm mt-1">Create your first video and it will appear here</p>
                <button
                  onClick={() => setActiveTab('create')}
                  className="mt-6 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-medium transition-all"
                >
                  Create Video
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {savedVideos.map((video) => (
                  <div key={video.id} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden hover:border-indigo-500/30 transition-all group">
                    {video.renderedVideoUrl ? (
                      <div className="relative aspect-video bg-black">
                        <video src={video.renderedVideoUrl} className="w-full h-full object-cover" muted />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <a
                            href={video.renderedVideoUrl}
                            download
                            className="bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-lg font-medium hover:bg-white/30 transition-colors"
                          >
                            Download
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="relative aspect-video bg-black/50 flex items-center justify-center">
                        <img src={video.backgroundImage} alt="" className="w-full h-full object-cover opacity-50" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-zinc-500 text-sm">No rendered video</span>
                        </div>
                      </div>
                    )}
                    <div className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-white font-medium truncate">{video.title}</h3>
                          <p className="text-zinc-500 text-xs mt-0.5">{formatDate(video.createdAt)}</p>
                        </div>
                        <button
                          onClick={() => deleteSavedVideo(video.id)}
                          className="text-zinc-600 hover:text-red-400 transition-colors p-1"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <span className="bg-white/5 px-2 py-1 rounded">{video.infographics.length} infographics</span>
                        <span className="bg-white/5 px-2 py-1 rounded">{Math.round(video.videoDurationInFrames / 30)}s duration</span>
                      </div>
                      <button
                        onClick={() => loadSavedVideo(video)}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit & Re-render
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl shadow-indigo-500/10">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Upload Document
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".txt,.pdf,.doc,.docx"
                      onChange={handleFileChange}
                      disabled={extracting}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <div className="flex items-center justify-center w-full h-24 border-2 border-dashed border-white/10 rounded-xl hover:border-indigo-500/50 transition-colors bg-white/5">
                      <p className="text-zinc-400 text-sm">
                        {document ? document.name : 'Drop PDF or TXT file here'}
                      </p>
                    </div>
                  </div>
                  {extracting && (
                    <p className="text-sm text-indigo-400 mt-2 animate-pulse">Extracting text from PDF...</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Background Image
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleBackgroundImageChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="flex items-center justify-center w-full h-24 border-2 border-dashed border-white/10 rounded-xl hover:border-indigo-500/50 transition-colors bg-white/5">
                      <p className="text-zinc-400 text-sm">
                        {backgroundFile ? backgroundFile.name : 'Upload background image'}
                      </p>
                    </div>
                  </div>
                  {backgroundImage && (
                    <div className="mt-2 rounded-xl overflow-hidden border border-white/10">
                      <img src={backgroundImage} alt="Background" className="w-full h-32 object-cover" />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Script
                  </label>
                  <textarea
                    value={script}
                    onChange={(e) => setScript(e.target.value.slice(0, 5000))}
                    required
                    rows={8}
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder-zinc-500 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 resize-none transition-all"
                    placeholder="Enter your script or upload a document..."
                  />
                  <div className="flex justify-between mt-2">
                    <p className="text-xs text-zinc-500">
                      {script.length}/5000 characters
                    </p>
                    <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all"
                        style={{ width: `${Math.min((script.length / 5000) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Avatar
                    </label>
                    <select
                      value={selectedAvatar}
                      onChange={(e) => setSelectedAvatar(e.target.value)}
                      required
                      className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all appearance-none cursor-pointer"
                    >
                      <option value="" className="bg-[#0A0A0F]">Select an avatar</option>
                      {avatars.map((avatar, index) => (
                        <option key={`${avatar.avatar_id}-${index}`} value={avatar.avatar_id} className="bg-[#0A0A0F]">
                          {avatar.avatar_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Voice
                    </label>
                    <select
                      value={selectedVoice}
                      onChange={(e) => setSelectedVoice(e.target.value)}
                      required
                      className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all appearance-none cursor-pointer"
                    >
                      <option value="" className="bg-[#0A0A0F]">Select a voice</option>
                      {voices.map((voice, index) => (
                        <option key={`${voice.voice_id}-${index}`} value={voice.voice_id} className="bg-[#0A0A0F]">
                          {voice.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !script || !selectedAvatar || !selectedVoice}
                  className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white py-4 px-6 rounded-xl font-semibold text-lg shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Generating... {generateProgress}%
                    </span>
                  ) : 'Generate Avatar Video'}
                </button>
              </form>

              {error && (
                <div className="mt-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4 backdrop-blur-sm">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {status && status !== 'completed' && status !== 'failed' && (
                <div className="mt-6 bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                      <p className="text-indigo-400 text-sm capitalize">{status}</p>
                    </div>
                    <p className="text-indigo-400 text-sm font-medium">{generateProgress}%</p>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
                      style={{ width: `${generateProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl shadow-indigo-500/10 sticky top-8">
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Preview
              </h2>

              {renderedVideoUrl ? (
                <div className="space-y-4">
                  <div className="rounded-xl overflow-hidden border border-green-500/30 shadow-lg">
                    <video src={renderedVideoUrl} controls className="w-full" />
                  </div>
                  <a
                    href={renderedVideoUrl}
                    download
                    className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white py-3 px-6 rounded-xl font-medium transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Final Video
                  </a>
                  <button
                    onClick={handleReRender}
                    className="w-full bg-white/10 hover:bg-white/20 text-white py-3 px-6 rounded-xl font-medium transition-all border border-white/10"
                  >
                    Edit & Re-render
                  </button>
                </div>
              ) : videoUrl && backgroundImage ? (
                <div className="space-y-4">
                  <div className="text-xs text-indigo-400 mb-1">Preview - Avatar + Background + Script</div>
                  <div className="rounded-xl overflow-hidden border border-white/10 shadow-lg">
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

                  {videoUrl && (
                    <div className="space-y-3 border-t border-white/10 pt-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-zinc-300">Place Infographics</h3>
                        <button
                          type="button"
                          onClick={() => setShowInfographicPanel(!showInfographicPanel)}
                          className="text-xs bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          {showInfographicPanel ? 'Hide Panel' : 'Show Panel'}
                        </button>
                      </div>

                      {showInfographicPanel && (
                        <div className="space-y-4 bg-white/5 rounded-xl p-4 border border-white/10">
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
                                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                                  </svg>
                                ) : (
                                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
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
                            <label className="block text-xs font-medium text-zinc-400 mb-2">
                              Upload Infographic Image
                            </label>
                            <div className="relative">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleInfographicImageChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              />
                              <div className="flex items-center justify-center w-full h-16 border-2 border-dashed border-white/10 rounded-lg hover:border-indigo-500/50 transition-colors bg-white/5">
                                <p className="text-zinc-500 text-xs">
                                  {newInfographicFile ? newInfographicFile.name : 'Upload infographic image'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {previewInfographic && (
                            <div className="space-y-2">
                              <label className="block text-xs font-medium text-zinc-400">
                                Drag to place on frame
                              </label>
                              <div
                                ref={frameContainerRef}
                                className="relative w-full rounded-lg overflow-hidden border border-indigo-500/30 bg-black/50 cursor-crosshair"
                                style={{ aspectRatio: '16/9' }}
                              >
                                <video
                                  src={videoUrl}
                                  className="w-full h-full object-cover"
                                  muted
                                />
                                <div
                                  className="absolute top-0 bottom-0 border-l-2 border-dashed border-yellow-400/60 pointer-events-none"
                                  style={{ left: '30%' }}
                                >
                                  <span className="absolute -top-5 left-1 text-[10px] text-yellow-400 font-mono whitespace-nowrap">
                                    Script area starts here →
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
                                  <div className="absolute -top-5 left-0 text-xs text-indigo-400 font-mono whitespace-nowrap">
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
                                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                                    Start Time
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    max={videoDurationInFrames}
                                    value={newInfographicStartFrame}
                                    onChange={(e) => setNewInfographicStartFrame(Number(e.target.value))}
                                    className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white text-sm focus:ring-2 focus:ring-indigo-500/50"
                                  />
                                  <span className="text-xs text-zinc-500">{formatTime(newInfographicStartFrame)}</span>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                                    End Time
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    max={videoDurationInFrames}
                                    value={newInfographicEndFrame}
                                    onChange={(e) => setNewInfographicEndFrame(Number(e.target.value))}
                                    className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white text-sm focus:ring-2 focus:ring-indigo-500/50"
                                  />
                                  <span className="text-xs text-zinc-500">{formatTime(newInfographicEndFrame)}</span>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                                    Width (%)
                                  </label>
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
                                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                                    Height (%)
                                  </label>
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
                                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white py-2.5 px-4 rounded-lg font-medium text-sm shadow-lg shadow-indigo-500/25 transition-all"
                              >
                                Add Infographic
                              </button>
                            </div>
                          )}

                          {infographics.length > 0 && (
                            <div className="space-y-2 border-t border-white/10 pt-3">
                              <h4 className="text-xs font-medium text-zinc-400">Added Infographics ({infographics.length})</h4>
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {infographics.map((info, index) => (
                                  <div key={info.id} className="bg-white/5 rounded-lg p-3 border border-white/10 space-y-2">
                                    <div className="flex items-center gap-2">
                                      <img src={info.imageUrl} alt={`Infographic ${index + 1}`} className="w-14 h-10 object-contain bg-black/50 rounded" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs text-zinc-300 font-medium">#{index + 1}</p>
                                        <p className="text-xs text-zinc-500">
                                          {formatTime(info.startFrame)} - {formatTime(info.endFrame)}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveInfographic(info.id)}
                                        className="text-red-400 hover:text-red-300 transition-colors p-1"
                                        title="Delete"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                              className="w-full px-2 py-1 rounded border border-white/10 bg-white/5 text-white text-xs"
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
                                              className="w-full px-2 py-1 rounded border border-white/10 bg-white/5 text-white text-xs"
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
                  )}

                  <button
                    onClick={handleRenderVideo}
                    disabled={rendering}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white py-4 px-6 rounded-xl font-semibold shadow-lg shadow-green-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {rendering ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Rendering... {renderProgress}%
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Render Final Video (MP4)
                      </span>
                    )}
                  </button>
                  {rendering && (
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${renderProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              ) : backgroundImage && script ? (
                <div className="space-y-4">
                  <div className="text-xs text-zinc-500 mb-2">Live Preview (generate avatar first)</div>
                  <div className="relative rounded-xl overflow-hidden border border-white/10 shadow-lg" style={{ aspectRatio: '16/9' }}>
                    <img src={backgroundImage} alt="Background" className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute left-[30%] top-0 w-[70%] h-full bg-black/60" />
                    <div className="absolute left-0 top-0 w-[30%] h-full flex items-center justify-center">
                      <div className="text-zinc-500 text-xs text-center px-2">Avatar will appear here</div>
                    </div>
                    <div className="absolute left-[30%] top-0 w-[70%] h-full p-6 overflow-hidden">
                      <div className="text-white text-sm leading-relaxed line-clamp-6">
                        {script}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={loading || !script || !selectedAvatar || !selectedVoice}
                    className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white py-3 px-6 rounded-xl font-medium shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {loading ? 'Generating Avatar...' : 'Generate Avatar Video'}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-80 border-2 border-dashed border-white/10 rounded-xl bg-white/5">
                  <svg className="w-16 h-16 text-zinc-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <p className="text-zinc-500 text-sm text-center px-4">
                    {loading ? 'Generating avatar video...' : !backgroundImage ? 'Upload a background image to preview' : 'Your video will appear here'}
                  </p>
                  {loading && (
                    <div className="mt-4 w-32 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full animate-pulse" style={{ width: '60%' }} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        )}

        {videoUrl && backgroundImage && activeTab === 'create' && (
          <div className="max-w-4xl mx-auto mt-8">
            <button
              onClick={saveCurrentVideo}
              disabled={!renderedVideoUrl && !videoUrl}
              className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white py-3 px-6 rounded-xl font-semibold shadow-lg shadow-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              Save Video to My Videos
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
