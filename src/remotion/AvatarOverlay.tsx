import { useCurrentFrame, useVideoConfig } from 'remotion';

export const AvatarOverlay: React.FC<{
  videoUrl: string;
  avatarWidth: number;
  avatarHeight: number;
}> = ({ videoUrl, avatarWidth, avatarHeight }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: avatarWidth,
        height: avatarHeight,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <video
        src={videoUrl}
        autoPlay
        muted
        loop
        playsInline
        style={{
          width: '100%',
          height: 'auto',
          maxHeight: '100%',
          objectFit: 'contain',
        }}
      />
    </div>
  );
};
