import { AbsoluteFill, Sequence, useVideoConfig, Html5Video } from 'remotion';
import { ScriptDisplay } from './ScriptDisplay';
import { InfographicsOverlay, Infographic } from './InfographicsOverlay';

/** CSS background avoids Remotion <Img> decode failures for uploaded JPEG/PNG files. */
const BackgroundLayer: React.FC<{
  src: string;
  style?: React.CSSProperties;
}> = ({ src, style }) => (
  <div
    style={{
      ...style,
      backgroundImage: `url("${src}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    }}
  />
);

export const RemotionVideo: React.FC<{
  avatarVideoUrl: string;
  backgroundImageUrl: string;
  script: string;
  durationInFrames: number;
  infographics?: Infographic[];
  scriptFontSize?: number;
  scriptTop?: number;
  scriptLeft?: number;
  videoTransparency?: number;
  avatarPosition?: 'left' | 'right';
  avatarSize?: number;
  /** Skip loading avatar video in browser (heavy file) — still shows script, background, infographics. */
  omitAvatarVideo?: boolean;
}> = ({
  avatarVideoUrl,
  backgroundImageUrl,
  script,
  durationInFrames,
  infographics = [],
  scriptFontSize = 28,
  scriptTop = 0,
  scriptLeft = 40,
  videoTransparency = 65,
  avatarSize = 40,
  omitAvatarVideo = false,
}) => {
  const { width, height } = useVideoConfig();

  const avatarWidth = width * (avatarSize / 100);
  const scriptAreaWidth = width * 0.5;
  const scriptLeftPos = avatarWidth + 60;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <BackgroundLayer
        src={backgroundImageUrl}
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          zIndex: 1,
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          backgroundColor: `rgba(0, 0, 0, ${videoTransparency / 100})`,
          zIndex: 2,
        }}
      />

      <Sequence from={0} durationInFrames={durationInFrames}>
        <div
          style={{
            position: 'absolute',
            left: scriptLeft,
            bottom: 0,
            width: avatarWidth,
            height: height * 0.95,
            overflow: 'hidden',
            zIndex: 10,
            borderRadius: 16,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          {omitAvatarVideo ? (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.55)',
                border: '2px dashed rgba(129,140,248,0.5)',
                borderRadius: 16,
                gap: 8,
              }}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(165,180,252,0.8)" strokeWidth="1.5">
                <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span style={{ color: 'rgba(199,210,254,0.9)', fontSize: 14, textAlign: 'center', padding: '0 12px' }}>
                Avatar omitted in preview
              </span>
            </div>
          ) : (
            <Html5Video
              src={avatarVideoUrl}
              volume={1}
              preload="metadata"
              pauseWhenBuffering
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          )}
        </div>
      </Sequence>

      <Sequence from={0} durationInFrames={durationInFrames}>
        <ScriptDisplay
          script={script}
          avatarWidth={0}
          scriptAreaWidth={scriptAreaWidth}
          height={height}
          fontSize={scriptFontSize}
          left={scriptLeftPos}
        />
      </Sequence>

      <Sequence from={0} durationInFrames={durationInFrames}>
        <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
          <InfographicsOverlay infographics={infographics} />
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};
