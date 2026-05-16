import { interpolate } from 'remotion';

export const ScriptDisplay: React.FC<{
  script: string;
  avatarWidth: number;
  scriptAreaWidth: number;
  currentWordIndex: number;
  wordProgress: number;
  totalWords: number;
  height: number;
}> = ({ script, avatarWidth, scriptAreaWidth, currentWordIndex, wordProgress, totalWords, height }) => {
  const words = script.split(/\s+/).filter((w) => w.length > 0);
  
  const lines: string[] = [];
  let currentLine = '';
  const charsPerLine = Math.floor(scriptAreaWidth / 20);
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    
    if (testLine.length > charsPerLine && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  const lineHeight = 52;
  const paddingTop = 40;
  
  let wordCount = 0;
  const lineWordMap: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const lineWords = lines[i].split(/\s+/).length;
    for (let j = 0; j < lineWords; j++) {
      lineWordMap.push(i);
    }
    wordCount += lineWords;
  }
  
  const currentLineIndex = lineWordMap[Math.min(currentWordIndex, lineWordMap.length - 1)] || 0;
  const nextLineIndex = lineWordMap[Math.min(currentWordIndex + 1, lineWordMap.length - 1)] || currentLineIndex;
  
  const totalContentHeight = lines.length * lineHeight;
  const visibleHeight = height - paddingTop * 2;
  const maxScroll = Math.max(0, totalContentHeight - visibleHeight);
  
  const wordPosition = currentWordIndex / Math.max(totalWords - 1, 1);
  const scrollOffset = -interpolate(wordPosition, [0, 1], [0, maxScroll], {
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
        padding: `${paddingTop}px 40px`,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          transform: `translateY(${scrollOffset}px)`,
        }}
      >
        {lines.map((line, lineIndex) => {
          const lineWords = line.split(/\s+/);
          let globalWordStart = 0;
          for (let i = 0; i < lineIndex; i++) {
            globalWordStart += lines[i].split(/\s+/).length;
          }
          
          const highlightedWords = lineWords.map((word, wordIndex) => {
            const globalWordIndex = globalWordStart + wordIndex;
            const isCurrentWord = globalWordIndex === currentWordIndex;
            const isPastWord = globalWordIndex < currentWordIndex;
            
            return (
              <span
                key={wordIndex}
                style={{
                  color: isCurrentWord ? '#818cf8' : isPastWord ? '#c0c0c0' : '#ffffff',
                  fontWeight: isCurrentWord ? 'bold' : 'normal',
                  marginRight: '8px',
                  display: 'inline',
                  fontSize: isCurrentWord ? '30px' : '28px',
                }}
              >
                {word}
              </span>
            );
          });
          
          return (
            <div
              key={lineIndex}
              style={{
                fontFamily: 'Inter, Arial, sans-serif',
                lineHeight: '1.8',
                marginBottom: '8px',
                minHeight: lineHeight,
              }}
            >
              {highlightedWords}
            </div>
          );
        })}
      </div>
    </div>
  );
};
