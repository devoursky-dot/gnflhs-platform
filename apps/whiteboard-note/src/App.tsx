import React, { useState } from 'react';
import { WhiteboardCanvas } from './components/WhiteboardCanvas';
import { Toolbar } from './components/Toolbar';

export default function App() {
  const [tool, setTool] = useState<'pen' | 'highlighter' | 'eraser'>('pen');
  const [color, setColor] = useState<string>('#FFFFFF'); // 칠판 기본 흰색
  const [width, setWidth] = useState<number>(6);

  const [undoTrigger, setUndoTrigger] = useState(0);
  const [redoTrigger, setRedoTrigger] = useState(0);
  const [clearTrigger, setClearTrigger] = useState(0);
  const [saveTrigger, setSaveTrigger] = useState(0);

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden' }}>
      <WhiteboardCanvas
        tool={tool}
        color={color}
        width={width}
        undoTrigger={undoTrigger}
        redoTrigger={redoTrigger}
        clearTrigger={clearTrigger}
        saveTrigger={saveTrigger}
      />
      <Toolbar
        currentTool={tool}
        setCurrentTool={setTool}
        color={color}
        setColor={setColor}
        width={width}
        setWidth={setWidth}
        onUndo={() => setUndoTrigger((c) => c + 1)}
        onRedo={() => setRedoTrigger((c) => c + 1)}
        onClear={() => setClearTrigger((c) => c + 1)}
        onSave={() => setSaveTrigger((c) => c + 1)}
        canUndo={true}
        canRedo={true}
      />
    </div>
  );
}
