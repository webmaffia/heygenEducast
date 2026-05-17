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

  const { lines, wordToGlobalIndex } = useMemo(() => {
    const words = script.split(/\s+/).filter((w) => w.length > 0);
    const result: { line: string; words: string[] }[] = [];
    let currentWords: string[] = [];
    const charsPerLine = Math.floor(scriptAreaWidth / 19);

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testLine = [...currentWords, word].join(' ');
      if (testLine.length > charsPerLine && currentWords.length > 0) {
        result.push({ line: currentWords.join(' '), words: [...currentWords] });
        currentWords = [word];
      } else {
        currentWords.push(word);
      }
    }
    if (currentWords.length > 0) {
      result.push({ line: currentWords.join(' '), words: [...currentWords] });
    }

    const map: number[] = [];
    let globalIdx = 0;
    for (const l of result) {
      for (let w = 0; w < l.words.length; w++) {
        map.push(globalIdx++);
      }
    }

    return { lines: result, wordToGlobalIndex: map };
  }, [script, scriptAreaWidth]);

  const progress = interpolate(frame, [0, Math.max(durationInFrames - 1, 1)], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const totalWords = wordToGlobalIndex.length;
  const currentWordFloat = progress * totalWords;
  const currentWordIndex = Math.floor(currentWordFloat);

  const totalContentHeight = lines.length * LINE_HEIGHT;
  const visibleHeight = height - PADDING_TOP * 2;
  const maxScroll = Math.max(0, totalContentHeight - visibleHeight);
  const scrollOffset = -interpolate(progress, [0, 1], [0, maxScroll], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  let globalWordCounter = 0;

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
        zIndex: 5,
      }}
    >
      <div
        style={{
          transform: `translateY(${scrollOffset}px)`,
          willChange: 'transform',
        }}
      >
        {lines.map((lineObj, lineIndex) => {
          const lineWords = lineObj.words;
          const lineGlobalStart = globalWordCounter;
          globalWordCounter += lineWords.length;

          return (
            <div
              key={lineIndex}
              style={{
                fontFamily: 'Inter, Arial, sans-serif',
                lineHeight: `${LINE_HEIGHT}px`,
                minHeight: LINE_HEIGHT,
              }}
            >
              {lineWords.map((word, wordIndex) => {
                const globalIdx = lineGlobalStart + wordIndex;
                const isCurrent = globalIdx === currentWordIndex;
                const isPast = globalIdx < currentWordIndex;

                return (
                  <span
                    key={wordIndex}
                    style={{
                      color: isCurrent ? '#818cf8' : isPast ? '#a1a1aa' : '#ffffff',
                      fontWeight: isCurrent ? 'bold' : 'normal',
                      marginRight: '8px',
                      display: 'inline',
                      fontSize: isCurrent ? '30px' : '28px',
                    }}
                  >
                    {word}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
