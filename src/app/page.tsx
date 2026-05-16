'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { RemotionVideo } from '@/remotion/VideoComposition';

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
          };
          video.onerror = () => {
            setVideoDurationInFrames(900);
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
        }),
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

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
              if (data.progress !== undefined) {
                setRenderProgress(data.progress);
              }
              if (data.videoUrl) {
                setRenderedVideoUrl(data.videoUrl);
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      }
    } catch (err) {
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
    const reader = new FileReader();
    reader.onload = (event) => {
      setBackgroundImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
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
            Transform your documents into engaging AI avatar videos with custom backgrounds
          </p>
        </div>

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
                    <video
                      src={renderedVideoUrl}
                      controls
                      className="w-full"
                    />
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={renderedVideoUrl}
                      download
                      className="flex items-center justify-center gap-2 flex-1 bg-green-600 hover:bg-green-500 text-white py-3 px-6 rounded-xl font-medium transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download Final Video
                    </a>
                  </div>
                  <button
                    onClick={handleRenderVideo}
                    disabled={rendering}
                    className="w-full bg-white/10 hover:bg-white/20 text-white py-3 px-6 rounded-xl font-medium transition-all border border-white/10"
                  >
                    Re-render Video
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
                      style={{
                        width: '100%',
                        height: 'auto',
                      }}
                      inputProps={{
                        avatarVideoUrl: videoUrl,
                        backgroundImageUrl: backgroundImage,
                        script: script,
                      }}
                      controls
                    />
                  </div>
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
      </div>
    </div>
  );
}
