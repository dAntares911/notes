
import React, { useState, useCallback, useRef } from 'react';
import './App.css';
import { Note } from './Note';
import type { Note as NoteType, NoteSize } from './types';

const NOTE_SIZES: Record<NoteSize, { width: number; height: number }> = {
  small: { width: 200, height: 200 },
  medium: { width: 300, height: 250 },
  large: { width: 400, height: 300 }
};

function App() {
  const [notes, setNotes] = useState<NoteType[]>([]);
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<NoteSize>('medium');
  const [isTrashHovered, setIsTrashHovered] = useState(false);
  const [maxZIndex, setMaxZIndex] = useState(1);
  const [screenSize, setScreenSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  const trashRef = useRef<HTMLDivElement>(null);

  const generateId = () => {
    return Math.random().toString(36).substr(2, 9);
  };

  const createNote = useCallback((x?: number, y?: number) => {
    const size = NOTE_SIZES[selectedSize];
    const noteX = x ?? Math.random() * (window.innerWidth - size.width);
    const noteY = y ?? Math.random() * (window.innerHeight - size.height);

    const newNote: NoteType = {
      id: generateId(),
      x: Math.max(0, Math.min(noteX, window.innerWidth - size.width)),
      y: Math.max(0, Math.min(noteY, window.innerHeight - size.height)),
      width: size.width,
      height: size.height,
      content: '',
      color: 'yellow',
      zIndex: maxZIndex + 1
    };

    setNotes(prev => [...prev, newNote]);
    setMaxZIndex(prev => prev + 1);
  }, [selectedSize, maxZIndex]);

  const updateNote = useCallback((id: string, updates: Partial<NoteType>) => {
    setNotes(prev => prev.map(note => {
      if (note.id === id) {
        const updatedNote = { ...note, ...updates };

        // If position or size changed, bring to front
        if (updates.x !== undefined || updates.y !== undefined ||
          updates.width !== undefined || updates.height !== undefined) {
          updatedNote.zIndex = maxZIndex + 1;
          setMaxZIndex(prev => prev + 1);
        }

        return updatedNote;
      }
      return note;
    }));
  }, [maxZIndex]);

  const deleteNote = useCallback((id: string) => {
    setNotes(prev => prev.filter(note => note.id !== id));
  }, []);

  const handleDragStart = useCallback((id: string) => {
    setDraggedNoteId(id);

    // Bring dragged note to front
    setNotes(prev => prev.map(note => {
      if (note.id === id) {
        const newZIndex = maxZIndex + 1;
        setMaxZIndex(newZIndex);
        return { ...note, zIndex: newZIndex };
      }
      return note;
    }));
  }, [maxZIndex]);

  const handleDragEnd = useCallback(() => {
    console.log(`handleDragEnd called for note: ${draggedNoteId}`);

    // If a note was being dragged and wasn't deleted, ensure it's in visible area
    if (draggedNoteId) {
      const note = notes.find(n => n.id === draggedNoteId);
      console.log(`Note found in handleDragEnd:`, note);

      if (note) {
        const minX = 0;
        const maxX = window.innerWidth - note.width;
        const minY = 0;
        const maxY = window.innerHeight - note.height;

        // If note is outside normal bounds, bring it back
        if (note.x < minX || note.x > maxX || note.y < minY || note.y > maxY) {
          console.log(`Bringing note back to visible area`);
          updateNote(draggedNoteId, {
            x: Math.max(minX, Math.min(note.x, maxX)),
            y: Math.max(minY, Math.min(note.y, maxY))
          });
        }
      } else {
        console.log(`Note ${draggedNoteId} was already deleted`);
      }
    }

    // Don't reset if drag state was already reset by deletion
    if (draggedNoteId) {
      setDraggedNoteId(null);
      setIsTrashHovered(false);
    }
  }, [draggedNoteId, notes, updateNote]);





  // Check if dragged note is over trash zone
  React.useEffect(() => {
    if (!draggedNoteId) return;

    const handleMouseMove = (e: MouseEvent) => {
      const trash = trashRef.current;
      if (!trash) return;

      const rect = trash.getBoundingClientRect();
      // Much larger detection area to make it easier to hit
      const padding = 50;
      const isOverTrash = e.clientX >= (rect.left - padding) &&
        e.clientX <= (rect.right + padding) &&
        e.clientY >= (rect.top - padding) &&
        e.clientY <= (rect.bottom + padding);

      setIsTrashHovered(isOverTrash);
    };

    const handleMouseUp = (e: MouseEvent) => {
      const trash = trashRef.current;
      if (!trash) return;

      const rect = trash.getBoundingClientRect();
      // Large detection area for dropping
      const padding = 50;
      const isOverTrash = e.clientX >= (rect.left - padding) &&
        e.clientX <= (rect.right + padding) &&
        e.clientY >= (rect.top - padding) &&
        e.clientY <= (rect.bottom + padding);

      console.log(`Mouse up at: ${e.clientX}, ${e.clientY}`);
      console.log(`Trash zone: ${rect.left - padding} to ${rect.right + padding}, ${rect.top - padding} to ${rect.bottom + padding}`);
      console.log(`Is over trash: ${isOverTrash}, Dragged note: ${draggedNoteId}`);

      if (isOverTrash && draggedNoteId) {
        // Prevent the note's drag end from interfering
        e.stopImmediatePropagation();
        deleteNote(draggedNoteId);
        console.log(`Note ${draggedNoteId} deleted!`);
        setDraggedNoteId(null);
        setIsTrashHovered(false);
        return; // Early return to prevent further processing
      }

      // Always reset drag state
      setDraggedNoteId(null);
      setIsTrashHovered(false);
    };

    // Use capture phase to ensure this runs before the note's event handlers
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp, true); // Capture phase

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp, true);
    };
  }, [draggedNoteId, deleteNote]);

  // Handle window resize to update screen size display
  React.useEffect(() => {
    const handleResize = () => {
      setScreenSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="notes-container">
      {/* Screen Size Warning */}
      <div className="screen-size-warning">
        <div>
          <h2>⚠️ Screen Size Too Small</h2>
          <p>This application requires a minimum screen resolution of <strong>1024×768</strong>.</p>
          <p>Current screen: <span id="current-resolution">{screenSize.width}×{screenSize.height}</span></p>
          <p>Please use a larger screen or increase your browser window size.</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <button className="create-note-btn" onClick={() => createNote()}>
          + New Note
        </button>
        <select
          className="size-selector"
          value={selectedSize}
          onChange={(e) => setSelectedSize(e.target.value as NoteSize)}
        >
          <option value="small">Small (200×200)</option>
          <option value="medium">Medium (300×250)</option>
          <option value="large">Large (400×300)</option>
        </select>
      </div>

      {/* Instructions */}
      {notes.length === 0 && (
        <div className="instructions">
          <h2>🔥 Sticky Notes</h2>
          <p>Click "New Note" to create your first sticky note!</p>
          <p style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
            Optimized for desktop screens (1024×768 minimum)
          </p>
          <div className="features">
            <div>📝 <strong>Create:</strong> Use the "New Note" button</div>
            <div>🖱️ <strong>Move:</strong> Drag notes by their header</div>
            <div>📏 <strong>Resize:</strong> Drag the orange corner handles</div>
            <div style={{ background: 'rgba(255, 71, 87, 0.1)', border: '2px dashed #ff4757' }}>
              🗑️ <strong>Delete:</strong> Drag notes to the red circle in bottom-right corner
            </div>
            <div>🎨 <strong>Color:</strong> Click the colored circles in note headers</div>
          </div>
        </div>
      )}

      {/* Notes */}
      {notes.map(note => (
        <Note
          key={note.id}
          note={note}
          onUpdate={updateNote}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          isDragging={draggedNoteId === note.id}
        />
      ))}

      {/* Trash Zone - Always visible */}
      <div
        ref={trashRef}
        className={`trash-zone ${isTrashHovered ? 'drag-over' : ''}`}
        title="Drag notes here to delete them"
        style={{
          position: 'fixed',
          bottom: '40px',
          right: '40px',
          width: '80px',
          height: '80px',
          background: '#ff4757',
          border: '3px solid #fff',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '24px',
          fontWeight: 'bold',
          zIndex: 1000,
          transition: 'all 0.3s ease',
          boxShadow: '0 6px 20px rgba(255, 71, 87, 0.4)',
          cursor: 'pointer'
        }}
      >
        🗑️

        {/* Show extended drop zone when dragging */}
        {draggedNoteId && (
          <div style={{
            position: 'absolute',
            top: '-50px',
            left: '-50px',
            right: '-50px',
            bottom: '-50px',
            border: '2px dashed rgba(255, 71, 87, 0.5)',
            borderRadius: '50%',
            pointerEvents: 'none',
            zIndex: 999
          }} />
        )}

        {isTrashHovered && (
          <div style={{
            position: 'absolute',
            top: '-50px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#333',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '14px',
            whiteSpace: 'nowrap',
            zIndex: 1001
          }}>
            Drop to delete
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
