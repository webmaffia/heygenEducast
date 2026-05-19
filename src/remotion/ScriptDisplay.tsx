import { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';

export interface LineTiming {
  startFrame: number;
  endFrame: number;
  text: string;
}

const CONTENT_FADE_IN_FRAMES = 12; // quick fade-in from first frame (no start delay)
const LINE_FADE_OUT_FRAMES = 24;

export const ScriptDisplay: React.FC<{
  script: string;
  avatarWidth: number;
  scriptAreaWidth: number;
  height: number;
  fontSize?: number;
  autoScroll?: boolean;
  left?: number;
}> = ({ script, scriptAreaWidth, height, fontSize = 28, left = 0 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const fs = fontSize;
  const LINE_HEIGHT = fs + 22;

  const allLines = useMemo(() => {
    const paragraphs = script.split(/\n\n+/).filter((p) => p.trim().length > 0);
    const charsPerLine = Math.floor((scriptAreaWidth - 80) / (fs * 0.55));
    const lines: string[][] = [];
    for (let p = 0; p < paragraphs.length; p++) {
      const para = paragraphs[p];
      const words = para.split(/\s+/).filter((w) => w.length > 0);
      let currentWords: string[] = [];
      for (const word of words) {
        const testLine = [...currentWords, word].join(' ');
        if (testLine.length > charsPerLine && currentWords.length > 0) {
          lines.push([...currentWords]);
          currentWords = [word];
        } else {
          currentWords.push(word);
        }
      }
      if (currentWords.length > 0) {
        lines.push([...currentWords]);
      }
      if (p < paragraphs.length - 1) {
        lines.push([]);
      }
    }
    return lines;
  }, [script, scriptAreaWidth, fs]);

  const lineTimings = useMemo(() => {
    const contentFrames = Math.max(1, durationInFrames);
    const totalChars = allLines.reduce((acc, line) => acc + line.join(' ').length, 0);
    if (totalChars === 0) return [];

    let currentFrame = 0;
    return allLines.map((line) => {
      const lineChars = line.join(' ').length;
      const ratio = lineChars / totalChars;
      const lineFrames = Math.max(30, Math.floor(contentFrames * ratio));
      const startFrame = currentFrame;
      const endFrame = currentFrame + lineFrames;
      currentFrame = endFrame;
      return { startFrame, endFrame, text: line.join(' ') };
    });
  }, [allLines, durationInFrames]);

  const visibleLineSlots = Math.max(4, Math.floor((height - 200) / LINE_HEIGHT));
  const maxScrollIndex = Math.max(0, allLines.length - visibleLineSlots);

  /** Scroll forward in sync with each line finishing — keeps upcoming lines in view. */
  const scrollIndex = useMemo(() => {
    if (!lineTimings.length) return 0;

    let index = 0;
    for (let i = 0; i < lineTimings.length; i++) {
      const { endFrame } = lineTimings[i];
      const fadeOutEnd = endFrame + LINE_FADE_OUT_FRAMES;

      if (frame < endFrame) {
        return Math.min(index, maxScrollIndex);
      }

      if (frame < fadeOutEnd) {
        const next = interpolate(frame, [endFrame, fadeOutEnd], [i, i + 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.inOut(Easing.cubic),
        });
        return Math.min(next, maxScrollIndex);
      }

      index = i + 1;
    }

    return Math.min(index, maxScrollIndex);
  }, [frame, lineTimings, maxScrollIndex]);

  const scrollOffsetY = -scrollIndex * LINE_HEIGHT;

  const blockOpacity = interpolate(
    frame,
    [0, CONTENT_FADE_IN_FRAMES],
    [0, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    },
  );

  const getLineStyle = (lineIndex: number, isEmpty: boolean) => {
    const timing = lineTimings[lineIndex];
    if (!timing || isEmpty) {
      return { opacity: 1, translateY: 0 };
    }

    if (frame < timing.endFrame) {
      return { opacity: 1, translateY: 0 };
    }

    const fadeOutEnd = timing.endFrame + LINE_FADE_OUT_FRAMES;
    const lineOpacity = interpolate(
      frame,
      [timing.endFrame, fadeOutEnd],
      [1, 0],
      {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.inOut(Easing.cubic),
      },
    );

    const translateY = interpolate(
      frame,
      [timing.endFrame, fadeOutEnd],
      [0, -10],
      {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.inOut(Easing.cubic),
      },
    );

    return { opacity: lineOpacity, translateY };
  };

  if (!script || allLines.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top: 0,
        width: scriptAreaWidth,
        height: height + 200,
        paddingTop: 300,
        paddingLeft: 40,
        paddingBottom: 100,
        boxSizing: 'border-box',
        overflow: 'hidden',
        zIndex: 4,
      }}
    >
      <div
        style={{
          opacity: blockOpacity,
          transform: `translateY(${scrollOffsetY}px)`,
        }}
      >
        {allLines.map((lineWords, lineIndex) => {
          const isEmpty = lineWords.length === 0;
          const { opacity, translateY } = getLineStyle(lineIndex, isEmpty);

          return (
            <div
              key={lineIndex}
              style={{
                fontFamily: 'Inter, Arial, sans-serif',
                lineHeight: `${LINE_HEIGHT}px`,
                minHeight: LINE_HEIGHT,
                textAlign: 'left',
                opacity,
                transform: `translateY(${translateY}px)`,
                marginBottom: isEmpty ? `${LINE_HEIGHT}px` : '0px',
              }}
            >
              {!isEmpty &&
                lineWords.map((word, wordIndex) => (
                  <span
                    key={wordIndex}
                    style={{
                      color: '#ffffff',
                      marginRight: '8px',
                      display: 'inline',
                      fontSize: fs,
                    }}
                  >
                    {word}
                  </span>
                ))}
              {isEmpty && <div style={{ height: LINE_HEIGHT }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
};
