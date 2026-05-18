import { useMemo } from 'react';

export const ScriptDisplay: React.FC<{
  script: string;
  avatarWidth: number;
  scriptAreaWidth: number;
  height: number;
  fontSize?: number;
}> = ({ script, avatarWidth, scriptAreaWidth, height, fontSize = 28 }) => {
  const fs = fontSize;
  const LINE_HEIGHT = fs + 22;

  const paragraphs = script.split(/\n\n+/).filter(p => p.trim().length > 0);
  const charsPerLine = Math.floor((scriptAreaWidth - 80) / (fs * 0.55));

  const allLines: string[][] = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(w => w.length > 0);
    let currentWords: string[] = [];
    for (const word of words) {
      const testLine = [...currentWords, word].join(' ');
      if (testLine.length > charsPerLine && currentWords.length > 0) {
        allLines.push([...currentWords]);
        currentWords = [word];
      } else {
        currentWords.push(word);
      }
    }
    if (currentWords.length > 0) {
      allLines.push([...currentWords]);
    }
  }

  const totalContentHeight = allLines.length * LINE_HEIGHT;
  const startPadding = Math.max(50, (height - totalContentHeight) / 2);

  return (
    <div
      style={{
        position: 'absolute',
        left: avatarWidth,
        top: startPadding,
        width: scriptAreaWidth,
        height: totalContentHeight,
        paddingLeft: 40,
        paddingRight: 40,
        boxSizing: 'border-box',
        overflow: 'hidden',
        zIndex: 5,
        textAlign: 'center',
      }}
    >
      {allLines.map((lineWords, lineIndex) => (
        <div
          key={lineIndex}
          style={{
            fontFamily: 'Inter, Arial, sans-serif',
            lineHeight: `${LINE_HEIGHT}px`,
            minHeight: LINE_HEIGHT,
          }}
        >
          {lineWords.map((word, wordIndex) => (
            <span
              key={wordIndex}
              style={{
                color: '#ffffff',
                fontWeight: 'normal',
                marginRight: '8px',
                display: 'inline',
                fontSize: fs,
              }}
            >
              {word}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
};
