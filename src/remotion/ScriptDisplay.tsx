import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { useMemo } from 'react';

const LINE_HEIGHT = 50;
const PADDING_TOP = 50;

export const ScriptDisplay: React.FC<{
  script: string;
  avatarWidth: number;
  scriptAreaWidth: number;
  height: number;
}> = ({ script, avatarWidth, scriptAreaWidth, height }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const lines = useMemo(() => {
    const words = script.split(/\s+/).filter((w) => w.length > 0);
    const result: string[] = [];
    let currentLine = '';
    const charsPerLine = Math.floor(scriptAreaWidth / 19);

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (testLine.length > charsPerLine && currentLine) {
        result.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      result.push(currentLine);
    }
    return result;
  }, [script, scriptAreaWidth]);

  const progress = interpolate(frame, [0, Math.max(durationInFrames - 1, 1)], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const totalContentHeight = lines.length * LINE_HEIGHT;
  const visibleHeight = height - PADDING_TOP * 2;
  const maxScroll = Math.max(0, totalContentHeight - visibleHeight);
  const scrollOffset = -interpolate(progress, [0, 1], [0, maxScroll], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: avatarWidth,
        top: 0,
        width: scriptAreaWidth,
        height: height,
        paddingTop: PADDING_TOP,
        paddingLeft: 40,
        paddingRight: 40,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          transform: `translateY(${scrollOffset}px)`,
          willChange: 'transform',
        }}
      >
        {lines.map((line, lineIndex) => (
          <div
            key={lineIndex}
            style={{
              fontFamily: 'Inter, Arial, sans-serif',
              lineHeight: `${LINE_HEIGHT}px`,
              minHeight: LINE_HEIGHT,
              color: '#ffffff',
              fontSize: '28px',
            }}
          >
            {line}
          </div>
        ))}
      </div>
    </div>
  );
};
