import { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';

export interface LineTiming {
  startFrame: number;
  endFrame: number;
  text: string;
}

const CONTENT_FADE_IN_FRAMES = 12;
const LINE_FADE_OUT_FRAMES = 24;
const BOX_PADDING_TOP = 70;
const BOX_PADDING_RIGHT = 0;
const BOX_PADDING_BOTTOM = 70;
const BOX_PADDING_LEFT = 70;
const BOX_CONTENT_HEIGHT = 560;
const BOX_BORDER_RADIUS = 30;
const BOX_SHIFT_DOWN = 72;
const TEXT_COLOR = 'rgba(255, 255, 255, 0.55)';

export const ScriptDisplay: React.FC<{
  script: string;
  avatarWidth: number;
  scriptAreaWidth: number;
  height: number;
  fontSize?: number;
  autoScroll?: boolean;
  left?: number;
  scriptTop?: number;
}> = ({ script, scriptAreaWidth, height, fontSize = 28, left = 0, scriptTop = 0 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const fs = fontSize;
  const LINE_HEIGHT = fs + 22;

  const boxHeight = BOX_PADDING_TOP + BOX_CONTENT_HEIGHT + BOX_PADDING_BOTTOM;
  const boxTop = (height - boxHeight) / 2 + scriptTop + BOX_SHIFT_DOWN;
  const innerWidth = scriptAreaWidth - BOX_PADDING_LEFT - BOX_PADDING_RIGHT;
  const viewportHeight = BOX_CONTENT_HEIGHT;

  const allLines = useMemo(() => {
    const paragraphs = script.split(/\n\n+/).filter((p) => p.trim().length > 0);
    const charsPerLine = Math.max(12, Math.floor(innerWidth / (fs * 0.52)));
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
  }, [script, innerWidth, fs]);

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

  const visibleLineSlots = Math.max(4, Math.floor(viewportHeight / LINE_HEIGHT));
  const maxScrollIndex = Math.max(0, allLines.length - visibleLineSlots);

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

  const boxOpacity = interpolate(
    frame,
    [0, CONTENT_FADE_IN_FRAMES],
    [0, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    },
  );

  const getLineOpacity = (lineIndex: number, isEmpty: boolean) => {
    const timing = lineTimings[lineIndex];
    if (!timing || isEmpty) return 1;

    if (frame < timing.endFrame) return 1;

    const fadeOutEnd = timing.endFrame + LINE_FADE_OUT_FRAMES;
    return interpolate(frame, [timing.endFrame, fadeOutEnd], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.inOut(Easing.cubic),
    });
  };

  if (!script || allLines.length === 0) return null;

  const contentHeight = allLines.length * LINE_HEIGHT;

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top: boxTop,
        width: scriptAreaWidth,
        height: boxHeight,
        boxSizing: 'border-box',
        backgroundColor: 'rgba(0, 0, 0, 0.52)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: BOX_BORDER_RADIUS,
        overflow: 'hidden',
        opacity: boxOpacity,
        zIndex: 4,
        boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.06)',
        padding: `${BOX_PADDING_TOP}px ${BOX_PADDING_RIGHT}px ${BOX_PADDING_BOTTOM}px ${BOX_PADDING_LEFT}px`,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: viewportHeight,
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: contentHeight,
            transform: `translateY(${scrollOffsetY}px)`,
          }}
        >
          {allLines.map((lineWords, lineIndex) => {
            const isEmpty = lineWords.length === 0;
            const lineOpacity = getLineOpacity(lineIndex, isEmpty);

            return (
              <div
                key={lineIndex}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: lineIndex * LINE_HEIGHT,
                  width: '100%',
                  height: LINE_HEIGHT,
                  fontFamily: 'Inter, system-ui, Arial, sans-serif',
                  fontWeight: 400,
                  fontSize: fs,
                  lineHeight: `${LINE_HEIGHT}px`,
                  textAlign: 'left',
                  color: TEXT_COLOR,
                  opacity: lineOpacity,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'clip',
                  pointerEvents: 'none',
                }}
              >
                {!isEmpty ? lineWords.join(' ') : '\u00A0'}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
