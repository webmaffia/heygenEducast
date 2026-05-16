import { AbsoluteFill, Sequence, useVideoConfig, Video, Img, useCurrentFrame, delayRender, continueRender } from 'remotion';
import { ScriptDisplay } from './ScriptDisplay';
import { useEffect, useState, useRef } from 'react';

export const RemotionVideo: React.FC<{
  avatarVideoUrl: string;
  backgroundImageUrl: string;
  script: string;
}> = ({ avatarVideoUrl, backgroundImageUrl, script }) => {
  const { width, height, fps } = useVideoConfig();
  const frame = useCurrentFrame();
  
  const avatarWidth = width * 0.3;
  const scriptAreaWidth = width * 0.7;

  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const handle = delayRender();
    const video = document.createElement('video');
    videoRef.current = video;
    video.src = avatarVideoUrl;
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      setVideoDuration(video.duration);
      continueRender(handle);
    };
    video.onerror = () => {
      setVideoDuration(30);
      continueRender(handle);
    };
    return () => {
      continueRender(handle);
    };
  }, [avatarVideoUrl]);

  const totalDurationInSeconds = videoDuration || 30;
  const totalDurationInFrames = Math.ceil(totalDurationInSeconds * fps);
  const progress = Math.min(frame / totalDurationInFrames, 1);

  const words = script.split(/\s+/).filter((w) => w.length > 0);
  const totalWords = words.length;
  const currentWordIndex = Math.floor(progress * totalWords);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Img
        src={backgroundImageUrl}
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      
      <div
        style={{
          position: 'absolute',
          left: avatarWidth,
          top: 0,
          width: scriptAreaWidth,
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
        }}
      />

      <Sequence from={0} durationInFrames={totalDurationInFrames}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: avatarWidth,
            height: height,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Video
            src={avatarVideoUrl}
            crossOrigin="anonymous"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        </div>
      </Sequence>

      <Sequence from={0} durationInFrames={totalDurationInFrames}>
        <ScriptDisplay
          script={script}
          avatarWidth={avatarWidth}
          scriptAreaWidth={scriptAreaWidth}
          currentWordIndex={currentWordIndex}
          totalWords={totalWords}
          height={height}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
