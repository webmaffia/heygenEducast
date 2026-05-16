'use client';

import { useState, useEffect, useCallback } from 'react';

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
  name: string;
}

interface Voice {
  voice_id: string;
  name: string;
}

export default function VideoGenerator() {
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

      if (data.data.status === 'completed') {
        setVideoUrl(data.data.video_url || null);
        setLoading(false);
      } else if (data.data.status === 'failed') {
        setError(data.data.error || 'Video generation failed');
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

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    console.log('File selected:', file?.name, file?.type, file?.size);
    setDocument(file);

    if (!file) return;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isTxt = file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt');

    if (isTxt) {
      const text = await file.text();
      setScript(text);
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
          setScript(text);
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

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-black dark:text-zinc-50 mb-2 text-center">
          Video Generator
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mb-8 text-center">
          Upload a document, add your script, and generate a HeyGen avatar video
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
            <h2 className="text-xl font-semibold text-black dark:text-zinc-50 mb-6">
              Input
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Upload Document (optional)
                </label>
                <input
                  type="file"
                  accept=".txt,.pdf,.doc,.docx"
                  onChange={handleFileChange}
                  disabled={extracting}
                  className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-zinc-100 dark:file:bg-zinc-800 file:text-zinc-700 dark:file:text-zinc-300 hover:file:bg-zinc-200 dark:hover:file:bg-zinc-700 disabled:opacity-50"
                />
                {extracting && (
                  <p className="text-sm text-zinc-500 mt-1">Extracting text from PDF...</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Script
                </label>
                <textarea
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  required
                  rows={10}
                  className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-black dark:text-zinc-50 focus:ring-2 focus:ring-zinc-500 focus:border-transparent resize-none"
                  placeholder="Enter your script here..."
                />
                <p className="text-xs text-zinc-500 mt-1">
                  {script.length}/5000 characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Avatar
                </label>
                <select
                  value={selectedAvatar}
                  onChange={(e) => setSelectedAvatar(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-black dark:text-zinc-50 focus:ring-2 focus:ring-zinc-500 focus:border-transparent"
                >
                  <option value="">Select an avatar</option>
                  {avatars.map((avatar) => (
                    <option key={avatar.avatar_id} value={avatar.avatar_id}>
                      {avatar.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Voice
                </label>
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-black dark:text-zinc-50 focus:ring-2 focus:ring-zinc-500 focus:border-transparent"
                >
                  <option value="">Select a voice</option>
                  {voices.map((voice) => (
                    <option key={voice.voice_id} value={voice.voice_id}>
                      {voice.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={loading || !script || !selectedAvatar || !selectedVoice}
                className="w-full bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 py-3 px-6 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Generating...' : 'Generate Video'}
              </button>
            </form>

            {error && (
              <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {status && status !== 'completed' && status !== 'failed' && (
              <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-blue-600 dark:text-blue-400">
                  Status: {status}
                </p>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
            <h2 className="text-xl font-semibold text-black dark:text-zinc-50 mb-6">
              Preview
            </h2>

            {videoUrl ? (
              <div className="space-y-4">
                <video
                  src={videoUrl}
                  controls
                  className="w-full rounded-lg bg-black"
                />
                <a
                  href={videoUrl}
                  download
                  className="block text-center bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 py-3 px-6 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
                >
                  Download Video
                </a>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg">
                <p className="text-zinc-500 dark:text-zinc-400">
                  {loading ? 'Generating your video...' : 'Your video will appear here'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
