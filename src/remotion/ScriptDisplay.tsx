export const ScriptDisplay: React.FC<{
  script: string;
  avatarWidth: number;
  scriptAreaWidth: number;
  currentWordIndex: number;
  totalWords: number;
  height: number;
}> = ({ script, avatarWidth, scriptAreaWidth, currentWordIndex, totalWords, height }) => {
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
  const visibleLines = Math.floor(height / lineHeight);
  
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
  const scrollStartLine = Math.max(0, currentLineIndex - Math.floor(visibleLines / 3));
  const scrollOffset = -scrollStartLine * lineHeight;

  return (
    <div
      style={{
        position: 'absolute',
        left: avatarWidth,
        top: 0,
        width: scriptAreaWidth,
        height: height,
        padding: '40px',
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
          
          const isCurrentLine = Math.abs(lineIndex - currentLineIndex) <= visibleLines;
          
          const highlightedWords = lineWords.map((word, wordIndex) => {
            const globalWordIndex = globalWordStart + wordIndex;
            const isCurrentWord = globalWordIndex === currentWordIndex;
            const isPastWord = globalWordIndex < currentWordIndex;
            
            return (
              <span
                key={wordIndex}
                style={{
                  color: isCurrentWord ? '#818cf8' : isPastWord ? '#d1d5db' : '#ffffff',
                  fontWeight: isCurrentWord ? 'bold' : 'normal',
                  marginRight: '8px',
                  display: 'inline',
                  fontSize: isCurrentWord ? '32px' : '28px',
                  transition: 'all 0.15s ease-out',
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
                opacity: isCurrentLine ? 1 : 0.2,
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
