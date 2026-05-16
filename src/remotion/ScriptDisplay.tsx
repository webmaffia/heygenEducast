import { useCurrentFrame, useVideoConfig } from 'remotion';

export const ScriptDisplay: React.FC<{
  script: string;
  avatarWidth: number;
  scriptAreaWidth: number;
}> = ({ script, avatarWidth, scriptAreaWidth }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, height } = useVideoConfig();

  const words = script.split(/\s+/).filter(w => w.length > 0);
  const totalWords = words.length;
  
  const wordsPerFrame = totalWords / durationInFrames;
  const currentWordIndex = Math.floor(frame * wordsPerFrame);
  
  const lines: string[] = [];
  let currentLine = '';
  const charsPerLine = Math.floor(scriptAreaWidth / 22);
  
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

  const totalLines = lines.length;
  const lineHeight = 52;
  const visibleLines = Math.floor(height / lineHeight);
  
  const currentLineIndex = Math.floor(currentWordIndex / (totalWords / totalLines));
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
          transition: 'transform 0.3s ease-out',
        }}
      >
        {lines.map((line, lineIndex) => {
          const lineStartWord = lines.slice(0, lineIndex).reduce((sum, l) => sum + l.split(/\s+/).length, 0);
          const lineWordCount = line.split(/\s+/).length;
          const lineEndWord = lineStartWord + lineWordCount;
          
          const isCurrentLine = lineIndex >= scrollStartLine && lineIndex < scrollStartLine + visibleLines;
          const isHighlighted = currentWordIndex >= lineStartWord && currentWordIndex < lineEndWord;
          
          const highlightedWords = line.split(/\s+/).map((word, wordIndex) => {
            const globalWordIndex = lineStartWord + wordIndex;
            const isCurrentWord = globalWordIndex === currentWordIndex;
            
            return (
              <span
                key={wordIndex}
                style={{
                  color: isCurrentWord ? '#818cf8' : '#ffffff',
                  fontWeight: isCurrentWord ? 'bold' : 'normal',
                  marginRight: '8px',
                  display: 'inline',
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
                fontSize: '28px',
                fontFamily: 'Inter, Arial, sans-serif',
                lineHeight: '1.8',
                marginBottom: '8px',
                opacity: isCurrentLine ? 1 : 0.3,
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
