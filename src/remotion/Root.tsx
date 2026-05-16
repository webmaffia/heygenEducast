import { Composition } from 'remotion';
import { RemotionVideo } from './VideoComposition';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="AvatarVideo"
        component={RemotionVideo}
        durationInFrames={3600}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          avatarVideoUrl: '',
          backgroundImageUrl: '',
          script: '',
          durationInFrames: 3600,
        }}
      />
    </>
  );
};
