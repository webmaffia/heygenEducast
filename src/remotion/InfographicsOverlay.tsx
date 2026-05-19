import { useCurrentFrame } from 'remotion';

export interface Infographic {
  id: string;
  imageUrl: string;
  startFrame: number;
  endFrame: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const InfographicsOverlay: React.FC<{
  infographics: Infographic[];
}> = ({ infographics }) => {
  const frame = useCurrentFrame();

  const activeInfographics = infographics.filter(
    (info) => frame >= info.startFrame && frame <= info.endFrame,
  );

  return (
    <>
      {activeInfographics.map((info) => (
        <img
          key={info.id}
          src={info.imageUrl}
          alt=""
          style={{
            position: 'absolute',
            left: info.x,
            top: info.y,
            width: info.width,
            height: info.height,
            objectFit: 'contain',
            zIndex: 10,
          }}
        />
      ))}
    </>
  );
};
