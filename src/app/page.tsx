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
    const pageText = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
    text += pageText + '\n\n';
  }
  return text.trim();
}

interface Avatar { avatar_id: string; avatar_name: string; preview_image_url: string; premium: boolean; }
interface Voice { voice_id: string; name: string; language: string; gender: string; }
interface Subject { id: string; name: string; }
interface Chapter { id: string; subject_id: string; name: string; }
interface User { id: string; name: string; email: string; role: string; status: string; avatar: string | null; created_at: string; updated_at: string; }

interface DbVideo {
  id: string; title: string; script: string; background_image: string | null;
  selected_avatar: string | null; selected_voice: string | null; avatar_video_url: string | null;
  rendered_video_url: string | null; video_duration_in_frames: number; infographics: string;
  status: string; subject_id: string | null; chapter_id: string | null; created_at: string; updated_at: string;
}

interface DragInfo { id: string; offsetX: number; offsetY: number; isResizing: boolean; resizeEdge: string; }

type SidebarItem = 'my-videos' | 'create-new' | 'drafts' | 'browse-subjects' | 'browse-chapters' | 'manage-avatars' | 'manage-users' | 'billing' | 'my-profile' | 'user-management';

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
  const [generateProgress, setGenerateProgress] = useState(0);
  const [infographics, setInfographics] = useState<Infographic[]>([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [showInfographicPanel, setShowInfographicPanel] = useState(false);
  const [newInfographicImage, setNewInfographicImage] = useState<string | null>(null);
  const [newInfographicFile, setNewInfographicFile] = useState<File | null>(null);
  const [newInfographicStartFrame, setNewInfographicStartFrame] = useState(0);
  const [newInfographicEndFrame, setNewInfographicEndFrame] = useState(90);
  const [scriptFontSize, setScriptFontSize] = useState(28);
  const [scriptTop, setScriptTop] = useState(0);
  const [scriptLeft, setScriptLeft] = useState(40);
  const [scriptKey, setScriptKey] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playbackVideoRef = useRef<HTMLVideoElement | null>(null);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const frameContainerRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState<DragInfo | null>(null);
  const [previewInfographic, setPreviewInfographic] = useState<{ imageUrl: string; x: number; y: number; width: number; height: number; } | null>(null);
  const [editingInfographicId, setEditingInfographicId] = useState<string | null>(null);
  const [editStartFrame, setEditStartFrame] = useState(0);
  const [editEndFrame, setEditEndFrame] = useState(0);
  const [savedVideos, setSavedVideos] = useState<DbVideo[]>([]);
  const [activeSidebar, setActiveSidebar] = useState<SidebarItem>('my-videos');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [stats, setStats] = useState({ total: 0, published: 0, drafts: 0, totalDurationFrames: 0, lastCreated: null as string | null, uniqueSubjects: 0 });
  const [loadingData, setLoadingData] = useState(true);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [newChapterName, setNewChapterName] = useState('');
  const [newChapterSubjectId, setNewChapterSubjectId] = useState('');
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'user' | 'superadmin'>('user');
  const [users, setUsers] = useState<User[]>([]);
  const [userStats, setUserStats] = useState({ total: 0, active: 0, admins: 0, users: 0 });
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');
  const [newUserStatus, setNewUserStatus] = useState('active');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserRole, setEditUserRole] = useState('user');
  const [editUserStatus, setEditUserStatus] = useState('active');

  useEffect(() => {
    async function loadData() {
      setLoadingData(true);
      try {
        const [videosRes, subjectsRes, chaptersRes, statsRes, usersRes, userStatsRes] = await Promise.all([
          fetch('/api/videos'), fetch('/api/subjects'), fetch('/api/chapters'),
          fetch('/api/videos?action=stats'), fetch('/api/users'), fetch('/api/users?action=stats'),
        ]);
        if (videosRes.ok) setSavedVideos((await videosRes.json()).data || []);
        if (subjectsRes.ok) setSubjects((await subjectsRes.json()).data || []);
        if (chaptersRes.ok) setChapters((await chaptersRes.json()).data || []);
        if (statsRes.ok) setStats((await statsRes.json()).data || {});
        if (usersRes.ok) setUsers((await usersRes.json()).data || []);
        if (userStatsRes.ok) setUserStats((await userStatsRes.json()).data || {});
      } catch (e) { console.error('Failed to load data:', e); }
      finally { setLoadingData(false); }
    }
    loadData();
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        const [avatarsRes, voicesRes] = await Promise.all([fetch('/api/video?action=avatars'), fetch('/api/video?action=voices')]);
        if (avatarsRes.ok) setAvatars((await avatarsRes.json()).data?.avatars || []);
        if (voicesRes.ok) setVoices((await voicesRes.json()).data?.voices || []);
      } catch { setError('Failed to load avatars and voices'); }
    }
    fetchData();
  }, []);

  useEffect(() => { return () => { if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current); }; }, []);

  useEffect(() => {
    if (!dragging || !frameContainerRef.current || !previewInfographic) return;
    const container = frameContainerRef.current;
    const rect = container.getBoundingClientRect();
    const handleMouseMove = (e: MouseEvent) => {
      const x = ((e.clientX - rect.left - dragging.offsetX) / rect.width) * 100;
      const y = ((e.clientY - rect.top - dragging.offsetY) / rect.height) * 100;
      setPreviewInfographic((prev) => {
        if (!prev) return null;
        return { ...prev, x: Math.max(0, Math.min(x, 100 - prev.width)), y: Math.max(0, Math.min(y, 100 - prev.height)) };
      });
    };
    const handleMouseUp = () => setDragging(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [dragging, previewInfographic]);

  function getSubjectName(subjectId: string | null) { if (!subjectId) return 'Unknown'; return subjects.find(s => s.id === subjectId)?.name || 'Unknown'; }
  function getChapterName(chapterId: string | null) { if (!chapterId) return ''; return chapters.find(c => c.id === chapterId)?.name || ''; }
  function formatDate(isoString: string) { const date = new Date(isoString); return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  function formatDuration(frames: number) { const seconds = Math.floor(frames / 30); const mins = Math.floor(seconds / 60); const secs = seconds % 60; return `${mins} min ${secs} sec`; }
  function formatTime(frames: number) { const seconds = Math.floor(frames / 30); const mins = Math.floor(seconds / 60); const secs = seconds % 60; return `${mins}:${secs.toString().padStart(2, '0')}`; }
  function formatTotalDuration(frames: number) { const totalSeconds = Math.floor(frames / 30); const hours = Math.floor(totalSeconds / 3600); const mins = Math.floor((totalSeconds % 3600) / 60); if (hours > 0) return `${hours}.${Math.round((mins / 60) * 10)}h`; return `${mins}m`; }

  const checkStatus = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/video?action=status&videoId=${id}`);
      const data = await res.json();
      setStatus(data.data.status);
      const statusProgress: Record<string, number> = { pending: 10, waiting: 25, processing: 60 };
      setGenerateProgress(statusProgress[data.data.status] || 50);
      if (data.data.status === 'completed') {
        setGenerateProgress(100);
        const url = data.data.video_url_webm || data.data.video_url || null;
        setVideoUrl(url);
        if (url) {
          const video = globalThis.document.createElement('video');
          video.preload = 'metadata'; video.src = url;
          video.onloadedmetadata = () => { const duration = Math.ceil(video.duration * 30); setVideoDurationInFrames(duration); setNewInfographicEndFrame(duration); };
          video.onerror = () => { setVideoDurationInFrames(900); setNewInfographicEndFrame(900); };
        }
        setLoading(false);
      } else if (data.data.status === 'failed') {
        setError(data.data.error?.message || data.data.error?.detail || 'Video generation failed');
        setLoading(false);
      } else { setTimeout(() => checkStatus(id), 5000); }
    } catch { setError('Failed to check video status'); setLoading(false); }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(null); setVideoUrl(null); setVideoId(null); setRenderedVideoUrl(null); setInfographics([]); setLoading(true);
    try {
      const res = await fetch('/api/video', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_id: selectedAvatar, voice_id: selectedVoice, input_text: script, title: document?.name || 'Generated Video', type: 'webm', avatar_style: 'normal', dimension: { width: 1080, height: 1920 } }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setVideoId(data.data.video_id); checkStatus(data.data.video_id);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to generate video'); setLoading(false); }
  }

  async function handleRenderVideo() {
    if (!videoUrl || !backgroundImage || !script) return;
    setRendering(true); setRenderProgress(0); setError(null);
    try {
      const response = await fetch('/api/render', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarVideoUrl: videoUrl, backgroundImageUrl: backgroundImage, script, durationInFrames: videoDurationInFrames, infographics, scriptFontSize }),
      });
      if (!response.ok) throw new Error(`Render failed: ${response.status}`);
      const reader = response.body?.getReader(); if (!reader) throw new Error('No response body');
      const decoder = new TextDecoder(); let buffer = ''; let isDone = false; let receivedVideoUrl = '';
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n'); buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try { const data = JSON.parse(line.slice(6)); if (data.progress !== undefined) setRenderProgress(data.progress); if (data.videoUrl) { receivedVideoUrl = data.videoUrl; setRenderedVideoUrl(data.videoUrl); } if (data.done) isDone = true; } catch { }
          }
        }
        if (isDone) break;
      }
      if (!receivedVideoUrl) throw new Error('Rendering completed but no video URL received');
      saveCurrentVideo();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to render video'); }
    finally { setRendering(false); }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null; setDocument(file); if (!file) return;
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isTxt = file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt');
    if (isTxt) { const text = await file.text(); setScript(text.slice(0, 5000)); }
    else if (isPdf) {
      setExtracting(true); setError(null);
      try { const text = await extractPdfText(file); if (!text) setError('No text found in PDF.'); else setScript(text.slice(0, 5000)); }
      catch (err) { setError(`Failed to extract text: ${err instanceof Error ? err.message : 'Unknown'}`); }
      finally { setExtracting(false); }
    } else { setError(`Unsupported file type: ${file.type}`); }
  }

  function handleBackgroundImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null; if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please upload a valid image file.'); return; }
    setBackgroundFile(file); setRenderedVideoUrl(null);
    const reader = new FileReader(); reader.onload = (event) => setBackgroundImage(event.target?.result as string); reader.readAsDataURL(file);
  }

  function handleInfographicImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null; if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please upload a valid image file.'); return; }
    setNewInfographicFile(file); setRenderedVideoUrl(null);
    const reader = new FileReader(); reader.onload = (event) => {
      setNewInfographicImage(event.target?.result as string);
      setPreviewInfographic({ imageUrl: event.target?.result as string, x: 35, y: 20, width: 30, height: 25 });
    }; reader.readAsDataURL(file);
  }

  function handlePlayAvatarVideo() {
    if (!videoUrl) return;
    if (playbackVideoRef.current) {
      const video = playbackVideoRef.current;
      if (isPlaying) { video.pause(); setIsPlaying(false); if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current); }
      else { video.play(); setIsPlaying(true); playbackIntervalRef.current = setInterval(() => { if (!video.paused) setCurrentFrame(Math.floor(video.currentTime * 30)); }, 100); }
    }
  }

  function handleSeekVideo(frame: number) { if (playbackVideoRef.current) { playbackVideoRef.current.currentTime = frame / 30; setCurrentFrame(frame); } }

  function handleStartDrag(e: React.MouseEvent, info: { x: number; y: number; width: number; height: number }) {
    e.preventDefault(); e.stopPropagation(); if (!frameContainerRef.current) return;
    const container = frameContainerRef.current; const rect = container.getBoundingClientRect();
    const clickX = e.clientX - rect.left; const clickY = e.clientY - rect.top;
    const elementX = (info.x / 100) * rect.width; const elementY = (info.y / 100) * rect.height;
    setDragging({ id: 'preview', offsetX: clickX - elementX, offsetY: clickY - elementY, isResizing: false, resizeEdge: '' });
  }

  async function handleAddInfographic() {
    if (!newInfographicImage || !previewInfographic) return;
    const x1920 = (previewInfographic.x / 100) * 1920; const y1080 = (previewInfographic.y / 100) * 1080;
    const widthPx = (previewInfographic.width / 100) * 1920; const heightPx = (previewInfographic.height / 100) * 1080;
    setInfographics([...infographics, { id: `info_${Date.now()}`, imageUrl: newInfographicImage, startFrame: Math.min(newInfographicStartFrame, newInfographicEndFrame), endFrame: Math.max(newInfographicStartFrame, newInfographicEndFrame), x: x1920, y: y1080, width: widthPx, height: heightPx }]);
    setNewInfographicImage(null); setNewInfographicFile(null); setPreviewInfographic(null);
  }

  function handleRemoveInfographic(id: string) { setInfographics(infographics.filter((info) => info.id !== id)); setRenderedVideoUrl(null); if (editingInfographicId === id) setEditingInfographicId(null); }
  function handleStartEditInfographic(id: string) { const info = infographics.find((i) => i.id === id); if (!info) return; setEditingInfographicId(id); setEditStartFrame(info.startFrame); setEditEndFrame(info.endFrame); }
  function handleSaveEditInfographic() { if (!editingInfographicId) return; setInfographics(infographics.map((info) => info.id === editingInfographicId ? { ...info, startFrame: Math.min(editStartFrame, editEndFrame), endFrame: Math.max(editStartFrame, editEndFrame) } : info)); setEditingInfographicId(null); setRenderedVideoUrl(null); }
  function handleReRender() { setRenderedVideoUrl(null); setRendering(false); setRenderProgress(0); }

  async function saveCurrentVideo() {
    if (!videoUrl || !backgroundImage || !script) return;
    try {
      const res = await fetch('/api/videos', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: document?.name || 'Untitled Video', script, backgroundImage, selectedAvatar, selectedVoice, avatarVideoUrl: videoUrl, renderedVideoUrl: renderedVideoUrl || '', videoDurationInFrames, infographics, status: renderedVideoUrl ? 'published' : 'draft', subjectId: selectedSubjectId || null, chapterId: selectedChapterId || null }),
      });
      if (res.ok) { const data = await res.json(); setSavedVideos(prev => [data.data, ...prev]); const statsRes = await fetch('/api/videos?action=stats'); if (statsRes.ok) setStats((await statsRes.json()).data || {}); }
    } catch (e) { console.error('Failed to save video:', e); }
  }

  async function loadSavedVideo(video: DbVideo) {
    setScript(video.script); setBackgroundImage(video.background_image); setSelectedAvatar(video.selected_avatar || ''); setSelectedVoice(video.selected_voice || '');
    setVideoUrl(video.avatar_video_url); setRenderedVideoUrl(video.rendered_video_url || null); setVideoDurationInFrames(video.video_duration_in_frames);
    setSelectedSubjectId(video.subject_id || ''); setSelectedChapterId(video.chapter_id || '');
    try { setInfographics(JSON.parse(video.infographics || '[]')); } catch { setInfographics([]); }
    setActiveSidebar('create-new'); setShowInfographicPanel(false); setNewInfographicImage(null); setPreviewInfographic(null);
  }

  async function deleteSavedVideo(id: string) {
    try { await fetch(`/api/videos?id=${id}`, { method: 'DELETE' }); setSavedVideos(prev => prev.filter(v => v.id !== id)); const statsRes = await fetch('/api/videos?action=stats'); if (statsRes.ok) setStats((await statsRes.json()).data || {}); }
    catch (e) { console.error('Failed to delete video:', e); }
  }

  async function addSubject() {
    if (!newSubjectName.trim()) return;
    try { const res = await fetch('/api/subjects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newSubjectName.trim() }) });
      if (res.ok) { const data = await res.json(); setSubjects(prev => [...prev, data.data]); setNewSubjectName(''); setShowAddSubject(false); }
    } catch (e) { console.error('Failed to add subject:', e); }
  }

  async function addChapter() {
    if (!newChapterName.trim() || !newChapterSubjectId) return;
    try { const res = await fetch('/api/chapters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newChapterName.trim(), subjectId: newChapterSubjectId }) });
      if (res.ok) { const data = await res.json(); setChapters(prev => [...prev, data.data]); setNewChapterName(''); setNewChapterSubjectId(''); setShowAddChapter(false); }
    } catch (e) { console.error('Failed to add chapter:', e); }
  }

  async function deleteSubject(id: string) { try { await fetch(`/api/subjects?id=${id}`, { method: 'DELETE' }); setSubjects(prev => prev.filter(s => s.id !== id)); setChapters(prev => prev.filter(c => c.subject_id !== id)); } catch (e) { console.error('Failed to delete subject:', e); } }
  async function deleteChapter(id: string) { try { await fetch(`/api/chapters?id=${id}`, { method: 'DELETE' }); setChapters(prev => prev.filter(c => c.id !== id)); } catch (e) { console.error('Failed to delete chapter:', e); } }

  async function addUser() {
    if (!newUserName.trim() || !newUserEmail.trim()) return;
    try {
      const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newUserName.trim(), email: newUserEmail.trim(), role: newUserRole, status: newUserStatus }) });
      if (res.ok) { const data = await res.json(); setUsers(prev => [...prev, data.data]); setNewUserName(''); setNewUserEmail(''); setShowAddUser(false); const statsRes = await fetch('/api/users?action=stats'); if (statsRes.ok) setUserStats((await statsRes.json()).data || {}); }
      else { const err = await res.json(); setError(err.error || 'Failed to add user'); }
    } catch (e) { console.error('Failed to add user:', e); }
  }

  async function updateUser() {
    if (!editingUser) return;
    try {
      const res = await fetch('/api/users', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingUser.id, name: editUserName, email: editUserEmail, role: editUserRole, status: editUserStatus }) });
      if (res.ok) { const data = await res.json(); setUsers(prev => prev.map(u => u.id === editingUser.id ? data.data : u)); setEditingUser(null); }
    } catch (e) { console.error('Failed to update user:', e); }
  }

  async function deleteUser(id: string) {
    try { await fetch(`/api/users?id=${id}`, { method: 'DELETE' }); setUsers(prev => prev.filter(u => u.id !== id)); const statsRes = await fetch('/api/users?action=stats'); if (statsRes.ok) setUserStats((await statsRes.json()).data || {}); }
    catch (e) { console.error('Failed to delete user:', e); }
  }

  const publishedVideos = savedVideos.filter((v) => v.status === 'published');
  const draftVideos = savedVideos.filter((v) => v.status !== 'published');

  const sidebarItems: { key: SidebarItem; label: string; section: string; badge?: number; locked?: boolean }[] = viewMode === 'superadmin'
    ? [{ key: 'user-management', label: 'User management', section: 'ADMIN' }, { key: 'my-videos', label: 'All videos', section: 'CONTENT' }, { key: 'browse-subjects', label: 'Browse subjects', section: 'CONTENT' }, { key: 'browse-chapters', label: 'Browse chapters', section: 'CONTENT' }, { key: 'manage-avatars', label: 'Manage avatars', section: 'SETTINGS' }]
    : [{ key: 'my-videos', label: 'My videos', section: 'MY WORK' }, { key: 'create-new', label: 'Create new video', section: 'MY WORK' }, { key: 'drafts', label: 'Drafts', section: 'MY WORK', badge: draftVideos.length }, { key: 'browse-subjects', label: 'Browse subjects', section: 'LIBRARY' }, { key: 'browse-chapters', label: 'Browse chapters', section: 'LIBRARY' }, { key: 'manage-avatars', label: 'Manage avatars', section: 'AVATARS' }, { key: 'manage-users', label: 'Manage users', section: 'SETTINGS', locked: true }, { key: 'billing', label: 'Billing', section: 'SETTINGS', locked: true }, { key: 'my-profile', label: 'My profile', section: 'SETTINGS' }];

  const groupedSidebar = sidebarItems.reduce<Record<string, typeof sidebarItems>>((acc, item) => { if (!acc[item.section]) acc[item.section] = []; acc[item.section].push(item); return acc; }, {});

  function renderMainContent() {
    switch (activeSidebar) {
      case 'my-videos': return renderMyVideos();
      case 'create-new': return renderCreateNew();
      case 'drafts': return renderDrafts();
      case 'browse-subjects': return renderBrowseSubjects();
      case 'browse-chapters': return renderBrowseChapters();
      case 'manage-avatars': return renderManageAvatars();
      case 'user-management': return renderUserManagement();
      default: return viewMode === 'superadmin' ? renderUserManagement() : renderMyVideos();
    }
  }

  function renderMyVideos() {
    return (
      <div className="space-y-6">
        {loadingData ? (<div className="flex items-center justify-center py-20"><svg className="animate-spin h-8 w-8 text-indigo-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg></div>) : (<>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#1a1a24] rounded-xl p-4"><p className="text-zinc-400 text-sm">My videos</p><p className="text-white text-2xl font-bold mt-1">{stats.total}</p><p className="text-zinc-500 text-xs mt-1">Across {stats.uniqueSubjects || subjects.length} subjects</p></div>
            <div className="bg-[#1a1a24] rounded-xl p-4"><p className="text-zinc-400 text-sm">Published</p><p className="text-white text-2xl font-bold mt-1">{stats.published}</p><p className="text-zinc-500 text-xs mt-1">{stats.drafts} drafts</p></div>
            <div className="bg-[#1a1a24] rounded-xl p-4"><p className="text-zinc-400 text-sm">Total duration</p><p className="text-white text-2xl font-bold mt-1">{formatTotalDuration(stats.totalDurationFrames)}</p><p className="text-zinc-500 text-xs mt-1">Content created</p></div>
            <div className="bg-[#1a1a24] rounded-xl p-4"><p className="text-zinc-400 text-sm">Last created</p><p className="text-white text-2xl font-bold mt-1">{stats.lastCreated ? formatDate(stats.lastCreated) : '—'}</p><p className="text-zinc-500 text-xs mt-1">Recent activity</p></div>
          </div>
          <div className="bg-[#1a1a24] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white text-lg font-semibold">My videos</h2>
              <button onClick={() => setActiveSidebar('create-new')} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>New video</button>
            </div>
            {savedVideos.length === 0 ? (<div className="flex flex-col items-center justify-center py-16"><svg className="w-12 h-12 text-zinc-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg><p className="text-zinc-500 text-sm">No videos yet</p><button onClick={() => setActiveSidebar('create-new')} className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm transition-colors">Create your first video</button></div>) : (
              <div className="space-y-3">
                {savedVideos.map((video) => (
                  <div key={video.id} className="flex items-center gap-4 bg-[#12121a] rounded-lg p-3 hover:bg-[#1e1e2a] transition-colors group">
                    <div className="w-16 h-10 bg-[#1a1a24] rounded flex items-center justify-center flex-shrink-0 overflow-hidden">{video.background_image ? <img src={video.background_image} alt="" className="w-full h-full object-cover" /> : <div className="w-3 h-3 rounded-full bg-indigo-500" />}</div>
                    <div className="flex-1 min-w-0"><p className="text-white text-sm font-medium truncate">{video.title}</p><p className="text-zinc-500 text-xs mt-0.5">{getSubjectName(video.subject_id)}{video.chapter_id ? ` · ${getChapterName(video.chapter_id)}` : ''} · {video.rendered_video_url ? formatDuration(video.video_duration_in_frames) : `${Math.round(video.video_duration_in_frames / 30)}s`}</p></div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${video.status === 'published' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>{video.status === 'published' ? 'Published' : 'Draft'}</span>
                    <div className="flex items-center gap-2">
                      {video.rendered_video_url && <a href={video.rendered_video_url} download className="text-zinc-400 hover:text-white text-xs px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition-colors">Download</a>}
                      <button onClick={() => loadSavedVideo(video)} className="text-zinc-400 hover:text-white p-1 transition-colors" title="Edit"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                      <button onClick={() => deleteSavedVideo(video.id)} className="text-zinc-600 hover:text-red-400 p-1 transition-colors" title="Delete"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-[#1a1a24] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4"><h2 className="text-white text-lg font-semibold">Available avatars</h2><p className="text-zinc-500 text-sm">Managed by your admin</p></div>
            <div className="flex flex-wrap gap-3">
              {avatars.slice(0, 4).map((avatar, idx) => (<div key={`${avatar.avatar_id}-${idx}`} className="flex items-center gap-3 bg-[#12121a] rounded-lg px-4 py-3 border border-white/5 hover:border-white/10 transition-colors"><div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">{avatar.avatar_name.charAt(0)}</div><div><p className="text-white text-sm font-medium">{avatar.avatar_name}</p><p className="text-zinc-500 text-xs">Chemistry</p></div></div>))}
              <div className="flex items-center gap-3 bg-[#12121a] rounded-lg px-4 py-3 border border-white/5 border-dashed"><div className="w-8 h-8 rounded-full bg-[#1a1a24] flex items-center justify-center text-zinc-500 text-xs">+</div><p className="text-zinc-500 text-sm">More coming soon</p></div>
            </div>
          </div>
        </>)}
      </div>
    );
  }

  function renderDrafts() {
    return (<div className="space-y-6"><div className="bg-[#1a1a24] rounded-xl p-6"><div className="flex items-center justify-between mb-4"><h2 className="text-white text-lg font-semibold">Drafts</h2><button onClick={() => setActiveSidebar('create-new')} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>New video</button></div>
      {draftVideos.length === 0 ? (<div className="flex flex-col items-center justify-center py-16"><svg className="w-12 h-12 text-zinc-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg><p className="text-zinc-500 text-sm">No drafts</p></div>) : (
        <div className="space-y-3">{draftVideos.map((video) => (<div key={video.id} className="flex items-center gap-4 bg-[#12121a] rounded-lg p-3 hover:bg-[#1e1e2a] transition-colors"><div className="w-16 h-10 bg-[#1a1a24] rounded flex items-center justify-center flex-shrink-0 overflow-hidden">{video.background_image ? <img src={video.background_image} alt="" className="w-full h-full object-cover" /> : <div className="w-3 h-3 rounded-full bg-amber-500" />}</div><div className="flex-1 min-w-0"><p className="text-white text-sm font-medium truncate">{video.title}</p><p className="text-zinc-500 text-xs mt-0.5">{getSubjectName(video.subject_id)}{video.chapter_id ? ` · ${getChapterName(video.chapter_id)}` : ''} · {Math.round(video.video_duration_in_frames / 30)}s</p></div><span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400">Draft</span><div className="flex items-center gap-2"><button onClick={() => loadSavedVideo(video)} className="text-zinc-400 hover:text-white p-1 transition-colors" title="Edit"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button><button onClick={() => deleteSavedVideo(video.id)} className="text-zinc-600 hover:text-red-400 p-1 transition-colors" title="Delete"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button></div></div>))}</div>
      )}</div></div>);
  }

  function renderBrowseSubjects() {
    return (<div className="space-y-6"><div className="bg-[#1a1a24] rounded-xl p-6"><div className="flex items-center justify-between mb-4"><h2 className="text-white text-lg font-semibold">Browse Subjects</h2><button onClick={() => setShowAddSubject(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Add Subject</button></div>
      {showAddSubject && (<div className="mb-4 bg-[#12121a] rounded-lg p-4 border border-indigo-500/30"><div className="flex gap-3"><input type="text" value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)} placeholder="Enter subject name" className="flex-1 px-3 py-2 rounded-lg border border-white/10 bg-[#1a1a24] text-white text-sm" onKeyDown={(e) => e.key === 'Enter' && addSubject()} /><button onClick={addSubject} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm">Add</button><button onClick={() => { setShowAddSubject(false); setNewSubjectName(''); }} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm">Cancel</button></div></div>)}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{subjects.map((subject) => { const chapterCount = chapters.filter(c => c.subject_id === subject.id).length; const videoCount = savedVideos.filter(v => v.subject_id === subject.id).length; return (<div key={subject.id} className="bg-[#12121a] rounded-lg p-5 border border-white/5 hover:border-indigo-500/30 transition-colors group"><div className="flex items-start justify-between mb-3"><div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => setActiveSidebar('browse-chapters')}><div className="w-10 h-10 rounded-lg bg-indigo-600/20 flex items-center justify-center flex-shrink-0"><svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg></div><div><p className="text-white font-medium">{subject.name}</p><p className="text-zinc-500 text-xs">{chapterCount} chapters · {videoCount} videos</p></div></div><button onClick={() => deleteSubject(subject.id)} className="text-zinc-600 hover:text-red-400 p-1 transition-colors opacity-0 group-hover:opacity-100" title="Delete"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button></div></div>); })}</div></div></div>);
  }

  function renderBrowseChapters() {
    const chaptersBySubject = subjects.map(subject => ({ subject, chapters: chapters.filter(c => c.subject_id === subject.id) }));
    return (<div className="space-y-6"><div className="bg-[#1a1a24] rounded-xl p-6"><div className="flex items-center justify-between mb-4"><h2 className="text-white text-lg font-semibold">Browse Chapters</h2><button onClick={() => setShowAddChapter(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Add Chapter</button></div>
      {showAddChapter && (<div className="mb-4 bg-[#12121a] rounded-lg p-4 border border-indigo-500/30"><div className="flex gap-3 mb-3"><select value={newChapterSubjectId} onChange={(e) => setNewChapterSubjectId(e.target.value)} className="flex-1 px-3 py-2 rounded-lg border border-white/10 bg-[#1a1a24] text-white text-sm"><option value="" className="bg-[#1a1a24]">Select subject</option>{subjects.map(s => <option key={s.id} value={s.id} className="bg-[#1a1a24]">{s.name}</option>)}</select></div><div className="flex gap-3"><input type="text" value={newChapterName} onChange={(e) => setNewChapterName(e.target.value)} placeholder="Enter chapter name" className="flex-1 px-3 py-2 rounded-lg border border-white/10 bg-[#1a1a24] text-white text-sm" onKeyDown={(e) => e.key === 'Enter' && addChapter()} /><button onClick={addChapter} disabled={!newChapterSubjectId} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">Add</button><button onClick={() => { setShowAddChapter(false); setNewChapterName(''); setNewChapterSubjectId(''); }} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm">Cancel</button></div></div>)}
      {chaptersBySubject.map(({ subject, chapters: subjChapters }) => (<div key={subject.id} className="mb-6 last:mb-0"><h3 className="text-white font-medium mb-3 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-indigo-500" />{subject.name}</h3><div className="space-y-2 ml-4">{subjChapters.map((chapter) => { const chapterVideos = savedVideos.filter(v => v.chapter_id === chapter.id); const isExpanded = expandedChapterId === chapter.id; return (<div key={chapter.id} className="bg-[#12121a] rounded-lg border border-white/5 hover:border-white/10 transition-colors"><div className="flex items-center justify-between p-3"><div className="flex items-center gap-3 flex-1 min-w-0"><button onClick={() => setExpandedChapterId(isExpanded ? null : chapter.id)} className="text-zinc-500 hover:text-white transition-colors flex-shrink-0"><svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button><svg className="w-4 h-4 text-zinc-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg><span className="text-zinc-300 text-sm truncate">{chapter.name}</span></div><div className="flex items-center gap-2 flex-shrink-0"><span className="text-zinc-500 text-xs">{chapterVideos.length} videos</span><button onClick={() => { setSelectedSubjectId(chapter.subject_id); setSelectedChapterId(chapter.id); setActiveSidebar('create-new'); }} className="text-indigo-400 hover:text-indigo-300 text-xs px-2 py-1 rounded transition-colors">+ Video</button><button onClick={() => deleteChapter(chapter.id)} className="text-zinc-600 hover:text-red-400 p-1 transition-colors" title="Delete"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button></div></div>{isExpanded && (<div className="border-t border-white/5 p-3 space-y-2">{chapterVideos.length === 0 ? (<div className="flex flex-col items-center justify-center py-6"><p className="text-zinc-500 text-sm">No videos yet</p><button onClick={() => { setSelectedSubjectId(chapter.subject_id); setSelectedChapterId(chapter.id); setActiveSidebar('create-new'); }} className="mt-2 text-indigo-400 hover:text-indigo-300 text-sm">Create first video</button></div>) : chapterVideos.map((video) => (<div key={video.id} className="flex items-center gap-3 bg-[#1a1a24] rounded-lg p-2.5 hover:bg-[#1e1e2a] transition-colors"><div className="w-12 h-8 bg-[#12121a] rounded flex items-center justify-center flex-shrink-0 overflow-hidden">{video.background_image ? <img src={video.background_image} alt="" className="w-full h-full object-cover" /> : <div className="w-2 h-2 rounded-full bg-indigo-500" />}</div><div className="flex-1 min-w-0"><p className="text-white text-xs font-medium truncate">{video.title}</p><p className="text-zinc-500 text-[10px] mt-0.5">{video.status === 'published' ? 'Published' : 'Draft'} · {Math.round(video.video_duration_in_frames / 30)}s</p></div><div className="flex items-center gap-1">{video.rendered_video_url && <a href={video.rendered_video_url} download className="text-zinc-500 hover:text-white p-1"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></a>}<button onClick={() => loadSavedVideo(video)} className="text-zinc-500 hover:text-white p-1"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button><button onClick={() => deleteSavedVideo(video.id)} className="text-zinc-600 hover:text-red-400 p-1"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button></div></div>))}</div>)}</div>); })}{subjChapters.length === 0 && <p className="text-zinc-600 text-sm ml-4">No chapters yet</p>}</div></div>))}</div></div>);
  }

  function renderManageAvatars() {
    return (<div className="space-y-6"><div className="bg-[#1a1a24] rounded-xl p-6"><h2 className="text-white text-lg font-semibold mb-4">Manage avatars</h2><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{avatars.map((avatar, idx) => (<div key={`${avatar.avatar_id}-${idx}`} className="bg-[#12121a] rounded-lg p-4 border border-white/5 hover:border-white/10 transition-colors"><div className="w-full aspect-square bg-[#1a1a24] rounded-lg mb-3 overflow-hidden flex items-center justify-center">{avatar.preview_image_url ? <img src={avatar.preview_image_url} alt={avatar.avatar_name} className="w-full h-full object-cover" /> : <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-white text-2xl font-bold">{avatar.avatar_name.charAt(0)}</div>}</div><p className="text-white text-sm font-medium">{avatar.avatar_name}</p><p className="text-zinc-500 text-xs mt-1">{avatar.premium ? 'Premium' : 'Free'}</p></div>))}</div></div></div>);
  }

  function renderUserManagement() {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#1a1a24] rounded-xl p-4"><p className="text-zinc-400 text-sm">Total users</p><p className="text-white text-2xl font-bold mt-1">{userStats.total}</p></div>
          <div className="bg-[#1a1a24] rounded-xl p-4"><p className="text-zinc-400 text-sm">Active</p><p className="text-white text-2xl font-bold mt-1">{userStats.active}</p></div>
          <div className="bg-[#1a1a24] rounded-xl p-4"><p className="text-zinc-400 text-sm">Admins</p><p className="text-white text-2xl font-bold mt-1">{userStats.admins}</p></div>
          <div className="bg-[#1a1a24] rounded-xl p-4"><p className="text-zinc-400 text-sm">Users</p><p className="text-white text-2xl font-bold mt-1">{userStats.users}</p></div>
        </div>
        <div className="bg-[#1a1a24] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4"><h2 className="text-white text-lg font-semibold">User Management</h2><button onClick={() => setShowAddUser(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Add User</button></div>
          {showAddUser && (<div className="mb-4 bg-[#12121a] rounded-lg p-4 border border-indigo-500/30 space-y-3"><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><input type="text" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="Full name" className="px-3 py-2 rounded-lg border border-white/10 bg-[#1a1a24] text-white text-sm" /><input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="Email address" className="px-3 py-2 rounded-lg border border-white/10 bg-[#1a1a24] text-white text-sm" /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)} className="px-3 py-2 rounded-lg border border-white/10 bg-[#1a1a24] text-white text-sm"><option value="user">User</option><option value="admin">Admin</option></select><select value={newUserStatus} onChange={(e) => setNewUserStatus(e.target.value)} className="px-3 py-2 rounded-lg border border-white/10 bg-[#1a1a24] text-white text-sm"><option value="active">Active</option><option value="inactive">Inactive</option></select></div><div className="flex gap-3"><button onClick={addUser} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm">Add User</button><button onClick={() => { setShowAddUser(false); setNewUserName(''); setNewUserEmail(''); }} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm">Cancel</button></div></div>)}
          {editingUser && (<div className="mb-4 bg-[#12121a] rounded-lg p-4 border border-amber-500/30 space-y-3"><p className="text-amber-400 text-sm font-medium">Editing: {editingUser.name}</p><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><input type="text" value={editUserName} onChange={(e) => setEditUserName(e.target.value)} placeholder="Full name" className="px-3 py-2 rounded-lg border border-white/10 bg-[#1a1a24] text-white text-sm" /><input type="email" value={editUserEmail} onChange={(e) => setEditUserEmail(e.target.value)} placeholder="Email address" className="px-3 py-2 rounded-lg border border-white/10 bg-[#1a1a24] text-white text-sm" /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><select value={editUserRole} onChange={(e) => setEditUserRole(e.target.value)} className="px-3 py-2 rounded-lg border border-white/10 bg-[#1a1a24] text-white text-sm"><option value="user">User</option><option value="admin">Admin</option></select><select value={editUserStatus} onChange={(e) => setEditUserStatus(e.target.value)} className="px-3 py-2 rounded-lg border border-white/10 bg-[#1a1a24] text-white text-sm"><option value="active">Active</option><option value="inactive">Inactive</option></select></div><div className="flex gap-3"><button onClick={updateUser} className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-sm">Save Changes</button><button onClick={() => setEditingUser(null)} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm">Cancel</button></div></div>)}
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-white/10"><th className="text-left py-3 px-4 text-zinc-400 font-medium">User</th><th className="text-left py-3 px-4 text-zinc-400 font-medium">Role</th><th className="text-left py-3 px-4 text-zinc-400 font-medium">Status</th><th className="text-left py-3 px-4 text-zinc-400 font-medium">Joined</th><th className="text-right py-3 px-4 text-zinc-400 font-medium">Actions</th></tr></thead><tbody>{users.map((user) => (<tr key={user.id} className="border-b border-white/5 hover:bg-white/5 transition-colors"><td className="py-3 px-4"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{user.name.charAt(0)}</div><div><p className="text-white font-medium">{user.name}</p><p className="text-zinc-500 text-xs">{user.email}</p></div></div></td><td className="py-3 px-4"><span className={`px-2 py-1 rounded-full text-xs font-medium ${user.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>{user.role}</span></td><td className="py-3 px-4"><span className={`px-2 py-1 rounded-full text-xs font-medium ${user.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{user.status}</span></td><td className="py-3 px-4 text-zinc-500">{formatDate(user.created_at)}</td><td className="py-3 px-4 text-right"><div className="flex items-center justify-end gap-1"><button onClick={() => { setEditingUser(user); setEditUserName(user.name); setEditUserEmail(user.email); setEditUserRole(user.role); setEditUserStatus(user.status); }} className="text-zinc-400 hover:text-white p-1.5 rounded transition-colors" title="Edit"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button><button onClick={() => deleteUser(user.id)} className="text-zinc-600 hover:text-red-400 p-1.5 rounded transition-colors" title="Delete"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button></div></td></tr>))}</tbody></table></div>
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
                <input type="file" accept=".txt,.pdf,.doc,.docx" onChange={handleFileChange} disabled={extracting} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" />
                <div className="flex items-center justify-center w-full h-20 border-2 border-dashed border-white/10 rounded-lg hover:border-indigo-500/50 transition-colors bg-[#12121a]">
                  <p className="text-zinc-400 text-sm">{document ? document.name : 'Drop PDF or TXT file here'}</p>
                </div>
              </div>
              {extracting && <p className="text-sm text-indigo-400 mt-2 animate-pulse">Extracting text from PDF...</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Background Image</label>
              <div className="relative">
                <input type="file" accept="image/*" onChange={handleBackgroundImageChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <div className="flex items-center justify-center w-full h-20 border-2 border-dashed border-white/10 rounded-lg hover:border-indigo-500/50 transition-colors bg-[#12121a]">
                  <p className="text-zinc-400 text-sm">{backgroundFile ? backgroundFile.name : 'Upload background image'}</p>
                </div>
              </div>
              {backgroundImage && <div className="mt-2 rounded-lg overflow-hidden border border-white/10"><img src={backgroundImage} alt="Background" className="w-full h-24 object-cover" /></div>}
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Script</label>
              <textarea value={script} onChange={(e) => setScript(e.target.value.slice(0, 5000))} required rows={6} className="w-full px-4 py-3 rounded-lg border border-white/10 bg-[#12121a] text-white placeholder-zinc-500 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 resize-none transition-all text-sm" placeholder="Enter your script or upload a document..." />
              <div className="flex justify-between mt-1">
                <p className="text-xs text-zinc-500">{script.length}/5000 characters</p>
                <div className="w-20 h-1 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${Math.min((script.length / 5000) * 100, 100)}%` }} /></div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Subject</label>
                <select value={selectedSubjectId} onChange={(e) => { setSelectedSubjectId(e.target.value); setSelectedChapterId(''); }} className="w-full px-4 py-3 rounded-lg border border-white/10 bg-[#12121a] text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all appearance-none cursor-pointer text-sm">
                  <option value="" className="bg-[#1a1a24]">Select subject (optional)</option>
                  {subjects.map((s) => (<option key={s.id} value={s.id} className="bg-[#1a1a24]">{s.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Chapter</label>
                <select value={selectedChapterId} onChange={(e) => setSelectedChapterId(e.target.value)} disabled={!selectedSubjectId} className="w-full px-4 py-3 rounded-lg border border-white/10 bg-[#12121a] text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all appearance-none cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  <option value="" className="bg-[#1a1a24]">Select chapter (optional)</option>
                  {chapters.filter(c => c.subject_id === selectedSubjectId).map((c) => (<option key={c.id} value={c.id} className="bg-[#1a1a24]">{c.name}</option>))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Avatar</label>
                <select value={selectedAvatar} onChange={(e) => setSelectedAvatar(e.target.value)} required className="w-full px-4 py-3 rounded-lg border border-white/10 bg-[#12121a] text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all appearance-none cursor-pointer text-sm">
                  <option value="" className="bg-[#1a1a24]">Select an avatar</option>
                  {avatars.map((avatar, index) => (<option key={`${avatar.avatar_id}-${index}`} value={avatar.avatar_id} className="bg-[#1a1a24]">{avatar.avatar_name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Voice</label>
                <select value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)} required className="w-full px-4 py-3 rounded-lg border border-white/10 bg-[#12121a] text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all appearance-none cursor-pointer text-sm">
                  <option value="" className="bg-[#1a1a24]">Select a voice</option>
                  {voices.map((voice, index) => (<option key={`${voice.voice_id}-${index}`} value={voice.voice_id} className="bg-[#1a1a24]">{voice.name}</option>))}
                </select>
              </div>
            </div>
            <button type="submit" disabled={loading || !script || !selectedAvatar || !selectedVoice} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 px-6 rounded-lg font-semibold text-sm shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all">
              {loading ? (<span className="flex items-center justify-center gap-2"><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>Generating... {generateProgress}%</span>) : 'Generate Avatar Video'}
            </button>
          </form>
          {error && <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3"><p className="text-red-400 text-sm">{error}</p></div>}
          {status && status !== 'completed' && status !== 'failed' && (
            <div className="mt-4 bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" /><p className="text-indigo-400 text-sm capitalize">{status}</p></div>
                <p className="text-indigo-400 text-sm font-medium">{generateProgress}%</p>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${generateProgress}%` }} /></div>
            </div>
          )}
        </div>
        <div className="bg-[#1a1a24] rounded-xl p-6">
          <h3 className="text-white text-lg font-semibold mb-4">Preview</h3>
          {renderedVideoUrl && (
            <div className="space-y-4">
              <div className="rounded-lg overflow-hidden border border-green-500/30"><video src={renderedVideoUrl} controls className="w-full" /></div>
              <div className="flex gap-3">
                <a href={renderedVideoUrl} download className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white py-2.5 px-4 rounded-lg font-medium text-sm transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>Download Final Video</a>
                <button onClick={handleReRender} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2.5 px-4 rounded-lg font-medium text-sm transition-all border border-white/10">Edit & Re-render</button>
              </div>
            </div>
          )}
          {!renderedVideoUrl && videoUrl && backgroundImage && (
            <div className="space-y-4">
              <div className="text-xs text-indigo-400 mb-1">Preview - Avatar + Background + Script</div>
              <div className="rounded-lg overflow-hidden border border-white/10">
                <Player key={`${Date.now()}-${scriptKey}`} ref={playerRef} component={RemotionVideo} durationInFrames={videoDurationInFrames} fps={30} compositionWidth={1920} compositionHeight={1080} style={{ width: '100%', height: 'auto' }} inputProps={{ avatarVideoUrl: videoUrl, backgroundImageUrl: backgroundImage, script, durationInFrames: videoDurationInFrames, infographics, scriptFontSize }} controls />
              </div>
              <div className="bg-[#12121a] rounded-lg p-4 border border-white/10 space-y-3">
                <h4 className="text-sm font-medium text-zinc-300">Script Settings</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Font Size</label>
                    <input type="range" min={12} max={500} value={scriptFontSize} onChange={(e) => { setScriptFontSize(Number(e.target.value)); setScriptKey(prev => prev + 1); }} className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer" />
                    <div className="flex justify-between text-xs text-zinc-400 mt-1">
                      <span>{scriptFontSize}px</span>
                      <span>Font Size</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Top (px)</label>
                    <input type="number" min={0} max={500} value={scriptTop} onChange={(e) => setScriptTop(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-white/10 bg-[#1a1a24] text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Left (px)</label>
                    <input type="number" min={0} max={500} value={scriptLeft} onChange={(e) => setScriptLeft(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-white/10 bg-[#1a1a24] text-white text-sm" />
                  </div>
                </div>
              </div>
              <div className="border-t border-white/10 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-zinc-300">Place Infographics</h4>
                  <button type="button" onClick={() => setShowInfographicPanel(!showInfographicPanel)} className="text-xs bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg transition-colors">{showInfographicPanel ? 'Hide Panel' : 'Show Panel'}</button>
                </div>
                {showInfographicPanel && (
                  <div className="space-y-4 bg-[#12121a] rounded-lg p-4 border border-white/10">
                    <div className="relative rounded-lg overflow-hidden border border-white/10">
                      <video ref={playbackVideoRef} src={videoUrl} className="w-full" onEnded={() => setIsPlaying(false)} />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-3 py-2 flex items-center gap-3">
                        <button type="button" onClick={handlePlayAvatarVideo} className="text-white hover:text-indigo-400 transition-colors">
                          {isPlaying ? <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg> : <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>}
                        </button>
                        <span className="text-xs text-zinc-300 font-mono">{formatTime(currentFrame)} / {formatTime(videoDurationInFrames)}</span>
                        <input type="range" min={0} max={videoDurationInFrames} value={currentFrame} onChange={(e) => handleSeekVideo(Number(e.target.value))} className="flex-1 h-1 bg-white/20 rounded-full appearance-none cursor-pointer" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-2">Upload Infographic Image</label>
                      <div className="relative">
                        <input type="file" accept="image/*" onChange={handleInfographicImageChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        <div className="flex items-center justify-center w-full h-14 border-2 border-dashed border-white/10 rounded-lg hover:border-indigo-500/50 transition-colors bg-[#1a1a24]">
                          <p className="text-zinc-500 text-xs">{newInfographicFile ? newInfographicFile.name : 'Upload infographic image'}</p>
                        </div>
                      </div>
                    </div>
                    {previewInfographic && (
                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-zinc-400">Drag to place on frame</label>
                        <div ref={frameContainerRef} className="relative w-full rounded-lg overflow-hidden border border-indigo-500/30 bg-black/50 cursor-crosshair" style={{ aspectRatio: '16/9' }}>
                          <video src={videoUrl} className="w-full h-full object-cover" muted />
                          <div className="absolute border-2 border-indigo-400 bg-indigo-400/10 cursor-move hover:border-indigo-300 transition-colors" style={{ left: `${previewInfographic.x}%`, top: `${previewInfographic.y}%`, width: `${previewInfographic.width}%`, height: `${previewInfographic.height}%` }} onMouseDown={(e) => handleStartDrag(e, previewInfographic)}>
                            <img src={previewInfographic.imageUrl} alt="Preview" className="w-full h-full object-contain pointer-events-none" />
                            <div className="absolute -top-4 left-0 text-xs text-indigo-400 font-mono whitespace-nowrap">{formatTime(newInfographicStartFrame)} - {formatTime(newInfographicEndFrame)}</div>
                          </div>
                        </div>
                      </div>
                    )}
                    {previewInfographic && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className="block text-xs font-medium text-zinc-400 mb-1">Start Time</label><input type="number" min={0} max={videoDurationInFrames} value={newInfographicStartFrame} onChange={(e) => setNewInfographicStartFrame(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-white/10 bg-[#1a1a24] text-white text-sm" /><span className="text-xs text-zinc-500">{formatTime(newInfographicStartFrame)}</span></div>
                          <div><label className="block text-xs font-medium text-zinc-400 mb-1">End Time</label><input type="number" min={0} max={videoDurationInFrames} value={newInfographicEndFrame} onChange={(e) => setNewInfographicEndFrame(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-white/10 bg-[#1a1a24] text-white text-sm" /><span className="text-xs text-zinc-500">{formatTime(newInfographicEndFrame)}</span></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className="block text-xs font-medium text-zinc-400 mb-1">Width (%)</label><input type="range" min={5} max={80} value={previewInfographic.width} onChange={(e) => setPreviewInfographic({ ...previewInfographic, width: Number(e.target.value) })} className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer" /><span className="text-xs text-zinc-500">{previewInfographic.width}%</span></div>
                          <div><label className="block text-xs font-medium text-zinc-400 mb-1">Height (%)</label><input type="range" min={5} max={80} value={previewInfographic.height} onChange={(e) => setPreviewInfographic({ ...previewInfographic, height: Number(e.target.value) })} className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer" /><span className="text-xs text-zinc-500">{previewInfographic.height}%</span></div>
                        </div>
                        <button type="button" onClick={handleAddInfographic} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 px-4 rounded-lg font-medium text-sm">Add Infographic</button>
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
                                <div className="flex-1 min-w-0"><p className="text-xs text-zinc-300 font-medium">#{index + 1}</p><p className="text-xs text-zinc-500">{formatTime(info.startFrame)} - {formatTime(info.endFrame)}</p></div>
                                <button type="button" onClick={() => handleRemoveInfographic(info.id)} className="text-red-400 hover:text-red-300 transition-colors p-1"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                              </div>
                              {editingInfographicId === info.id ? (
                                <div className="space-y-2 pt-2 border-t border-white/10">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div><label className="block text-xs text-zinc-500 mb-1">Start</label><input type="number" min={0} max={videoDurationInFrames} value={editStartFrame} onChange={(e) => setEditStartFrame(Number(e.target.value))} className="w-full px-2 py-1 rounded border border-white/10 bg-[#1a1a24] text-white text-xs" /></div>
                                    <div><label className="block text-xs text-zinc-500 mb-1">End</label><input type="number" min={0} max={videoDurationInFrames} value={editEndFrame} onChange={(e) => setEditEndFrame(Number(e.target.value))} className="w-full px-2 py-1 rounded border border-white/10 bg-[#1a1a24] text-white text-xs" /></div>
                                  </div>
                                  <div className="flex gap-2"><button type="button" onClick={handleSaveEditInfographic} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-1 rounded text-xs">Save</button><button type="button" onClick={() => setEditingInfographicId(null)} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-1 rounded text-xs">Cancel</button></div>
                                </div>
                              ) : (<button type="button" onClick={() => handleStartEditInfographic(info.id)} className="w-full text-xs text-indigo-400 hover:text-indigo-300 transition-colors py-1">Edit timing</button>)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button onClick={handleRenderVideo} disabled={rendering} className="w-full bg-green-600 hover:bg-green-500 text-white py-3 px-6 rounded-lg font-semibold shadow-lg shadow-green-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm">
                {rendering ? (<span className="flex items-center justify-center gap-2"><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>Rendering... {renderProgress}%</span>) : (<span className="flex items-center justify-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Render Final Video (MP4)</span>)}
              </button>
              {rendering && <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full transition-all duration-300" style={{ width: `${renderProgress}%` }} /></div>}
            </div>
          )}
          {!renderedVideoUrl && !videoUrl && backgroundImage && script && (
            <div className="space-y-4">
              <div className="text-xs text-zinc-500 mb-2">Live Preview (generate avatar first)</div>
              <div className="relative rounded-lg overflow-hidden border border-white/10" style={{ aspectRatio: '16/9' }}>
                <img src={backgroundImage} alt="Background" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute left-[30%] top-0 w-[70%] h-full bg-black/60" />
                <div className="absolute left-0 top-0 w-[30%] h-full flex items-center justify-center"><div className="text-zinc-500 text-xs text-center px-2">Avatar will appear here</div></div>
                <div className="absolute left-[30%] top-0 w-[70%] h-full p-4 overflow-hidden"><div className="text-white text-xs leading-relaxed line-clamp-4">{script}</div></div>
              </div>
              <button onClick={handleSubmit} disabled={loading || !script || !selectedAvatar || !selectedVoice} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 px-6 rounded-lg font-medium shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm">{loading ? 'Generating Avatar...' : 'Generate Avatar Video'}</button>
            </div>
          )}
          {!renderedVideoUrl && !videoUrl && (!backgroundImage || !script) && (
            <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-white/10 rounded-lg bg-[#12121a]">
              <svg className="w-12 h-12 text-zinc-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              <p className="text-zinc-500 text-sm text-center px-4">{loading ? 'Generating avatar video...' : !backgroundImage ? 'Upload a background image to preview' : 'Your video will appear here'}</p>
              {loading && <div className="mt-3 w-24 h-1 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 rounded-full animate-pulse" style={{ width: '60%' }} /></div>}
            </div>
          )}
        </div>
        {videoUrl && backgroundImage && (
          <div className="lg:col-span-2">
            <button onClick={saveCurrentVideo} disabled={!renderedVideoUrl && !videoUrl} className="w-full bg-amber-600 hover:bg-amber-500 text-white py-3 px-6 rounded-lg font-semibold shadow-lg shadow-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
              Save Video to My Videos
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f14] text-white flex">
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#14141c] border-r border-white/5 flex flex-col transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-0 lg:overflow-hidden'}`}>
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center"><svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg></div>
            <div><h1 className="text-white text-sm font-semibold">EduCast</h1><p className="text-zinc-500 text-xs">AI Video Platform</p></div>
          </div>
        </div>
        <div className="px-3 py-2 border-b border-white/5">
          <div className="inline-flex bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg p-0.5 w-full">
            <button onClick={() => { setViewMode('user'); setActiveSidebar('my-videos'); }} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'user' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'}`}>User view</button>
            <button onClick={() => { setViewMode('superadmin'); setActiveSidebar('user-management'); }} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'superadmin' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'}`}>Super admin</button>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-6">
          {Object.entries(groupedSidebar).map(([section, items]) => (<div key={section}><p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider px-3 mb-2">{section}</p><div className="space-y-0.5">{items.map((item) => (<button key={item.key} onClick={() => { if (!item.locked) { setActiveSidebar(item.key); if (window.innerWidth < 1024) setSidebarOpen(false); } }} disabled={item.locked} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${activeSidebar === item.key ? 'bg-white/10 text-white' : item.locked ? 'text-zinc-600 cursor-not-allowed' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}><span className="flex items-center gap-2">{item.label}</span><div className="flex items-center gap-2">{item.badge !== undefined && item.badge > 0 && <span className="bg-amber-500/20 text-amber-400 text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">{item.badge}</span>}{item.locked && <svg className="w-3.5 h-3.5 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>}</div></button>))}</div></div>))}
        </nav>
        <div className="p-3 border-t border-white/5"><button onClick={() => setSidebarOpen(false)} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors text-sm lg:hidden"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>Close</button></div>
      </aside>
      <main className="flex-1 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 bg-[#0f0f14]/80 backdrop-blur-xl border-b border-white/5">
          <div className="flex items-center justify-between px-4 lg:px-6 py-3">
            <div className="flex items-center gap-3"><button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg></button><h2 className="text-white font-semibold capitalize">{activeSidebar === 'my-videos' ? (viewMode === 'superadmin' ? 'All videos' : 'My videos') : activeSidebar === 'create-new' ? 'Create new video' : activeSidebar === 'drafts' ? 'Drafts' : activeSidebar === 'browse-subjects' ? 'Browse subjects' : activeSidebar === 'browse-chapters' ? 'Browse chapters' : activeSidebar === 'manage-avatars' ? 'Manage avatars' : activeSidebar === 'user-management' ? 'User management' : activeSidebar.replace(/-/g, ' ')}</h2></div>
            <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">U</div></div>
          </div>
        </header>
        <div className="flex-1 p-4 lg:p-6 overflow-y-auto">{renderMainContent()}</div>
      </main>
l    </div>
  );
}
