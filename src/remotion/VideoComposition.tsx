import { AbsoluteFill, Sequence, useVideoConfig, Video, Img, useCurrentFrame, interpolate } from 'remotion';
import { ScriptDisplay } from './ScriptDisplay';

export const RemotionVideo: React.FC<{
  avatarVideoUrl: string;
  backgroundImageUrl: string;
  script: string;
  durationInFrames: number;
}> = ({ avatarVideoUrl, backgroundImageUrl, script, durationInFrames }) => {
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  
  const avatarWidth = width * 0.3;
  const scriptAreaWidth = width * 0.7;

  const words = script.split(/\s+/).filter((w) => w.length > 0);
  const totalWords = words.length;
  
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateRight: 'clamp',
  });
  
  const currentWordIndexFloat = progress * totalWords;
  const currentWordIndex = Math.floor(currentWordIndexFloat);
  const wordProgress = currentWordIndexFloat - currentWordIndex;

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

      <Sequence from={0} durationInFrames={durationInFrames}>
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

      <Sequence from={0} durationInFrames={durationInFrames}>
        <ScriptDisplay
          script={script}
          avatarWidth={avatarWidth}
          scriptAreaWidth={scriptAreaWidth}
          currentWordIndex={currentWordIndex}
          wordProgress={wordProgress}
          totalWords={totalWords}
          height={height}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
