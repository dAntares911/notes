
import React, { useState, useCallback, useRef, useEffect } from 'react';
import './App.css';
import { Note } from './Note';
import type { Note as NoteType, NoteSize } from './types';
import { saveNotes, loadNotes, deleteNote as deleteNoteFromDB, isIndexedDBSupported } from './indexedDB';

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
  const [isLoading, setIsLoading] = useState(true);
  const [dbSupported, setDbSupported] = useState(true);

  const trashRef = useRef<HTMLDivElement>(null);

  const generateId = () => {
    return Math.random().toString(36).substr(2, 9);
  };

  // Calculate z-index based on priority (1 = highest, 5 = lowest)
  const calculateZIndex = (priority: number, notes: NoteType[]) => {
    // Priority 1 gets the highest z-index range, priority 5 gets the lowest
    const priorityBase = (6 - priority) * 1000; // 5000, 4000, 3000, 2000, 1000

    // Within the same priority, maintain creation/interaction order
    const samePriorityNotes = notes.filter(n => n.priority === priority);
    const maxInPriority = samePriorityNotes.length > 0
      ? Math.max(...samePriorityNotes.map(n => n.zIndex % 1000))
      : 0;

    return priorityBase + maxInPriority + 1;
  };



  const createNote = (x?: number, y?: number) => {
    const size = NOTE_SIZES[selectedSize];
    const noteX = x ?? Math.random() * (window.innerWidth - size.width);
    const noteY = y ?? Math.random() * (window.innerHeight - size.height);

    const defaultPriority = 3; // Default to middle priority
    const newZIndex = calculateZIndex(defaultPriority, notes);

    const newNote: NoteType = {
      id: generateId(),
      x: Math.max(0, Math.min(noteX, window.innerWidth - size.width)),
      y: Math.max(0, Math.min(noteY, window.innerHeight - size.height)),
      width: size.width,
      height: size.height,
      content: '',
      color: 'yellow',
      priority: defaultPriority,
      zIndex: newZIndex
    };

    setNotes(prev => [...prev, newNote]);
    setMaxZIndex(Math.max(maxZIndex, newZIndex));
  };

  const updateNote = useCallback((id: string, updates: Partial<NoteType>) => {
    setNotes(prev => {
      const newNotes = prev.map(note => {
        if (note.id === id) {
          const updatedNote = { ...note, ...updates };

          // If priority changed, recalculate z-index based on new priority
          if (updates.priority !== undefined && updates.priority !== note.priority) {
            updatedNote.zIndex = calculateZIndex(updates.priority, prev);
          }
          // If position or size changed, bring to front within the same priority
          else if (updates.x !== undefined || updates.y !== undefined ||
            updates.width !== undefined || updates.height !== undefined) {
            updatedNote.zIndex = calculateZIndex(note.priority, prev);
          }

          return updatedNote;
        }
        return note;
      });

      // If priority changed, recalculate all z-indexes to maintain proper order
      if (updates.priority !== undefined) {
        const sortedNotes = [...newNotes];
        sortedNotes.forEach((note) => {
          const priorityBase = (6 - note.priority) * 1000;
          const samePriorityNotes = sortedNotes.filter(n => n.priority === note.priority);
          const indexInPriority = samePriorityNotes.findIndex(n => n.id === note.id);
          note.zIndex = priorityBase + indexInPriority + 1;
        });
        return sortedNotes;
      }

      return newNotes;
    });
  }, []); // Empty dependency array - this function doesn't depend on external values

  const deleteNote = useCallback(async (id: string) => {
    setNotes(prev => prev.filter(note => note.id !== id));

    // Also delete from IndexedDB
    if (dbSupported) {
      try {
        await deleteNoteFromDB(id);
        console.log(`Note ${id} deleted from IndexedDB`);
      } catch (error) {
        console.error('Failed to delete note from IndexedDB:', error);
      }
    }
  }, [dbSupported]); // Needs useCallback because used in useEffect dependency

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
  }, [maxZIndex]); // Needs useCallback because passed as prop to Note component

  const handleDragEnd = useCallback(() => {
    console.log(`handleDragEnd called for note: ${draggedNoteId}`);

    // If a note was being dragged and wasn't deleted, ensure it's accessible
    if (draggedNoteId) {
      const note = notes.find(n => n.id === draggedNoteId);
      console.log(`Note found in handleDragEnd:`, note);

      if (note) {
        // Smart boundary constraints: ensure at least 30% of note is visible
        const notePartialWidth = note.width * 0.3;
        const notePartialHeight = note.height * 0.3;

        const minX = -(note.width - notePartialWidth);
        const maxX = window.innerWidth - notePartialWidth;
        const minY = -(note.height - notePartialHeight);
        const maxY = window.innerHeight - notePartialHeight;

        // If note is outside accessible bounds, bring it back to accessible area
        if (note.x < minX || note.x > maxX || note.y < minY || note.y > maxY) {
          console.log(`Bringing note back to accessible area`);
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
  }, [draggedNoteId, notes, updateNote]); // Needs useCallback because passed as prop to Note component AND used in useEffect dependency





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

  // Load notes from IndexedDB on app startup
  useEffect(() => {
    const initializeApp = async () => {
      setDbSupported(isIndexedDBSupported());

      if (isIndexedDBSupported()) {
        try {
          const savedNotes = await loadNotes();
          if (savedNotes.length > 0) {
            // Ensure all notes have a priority field (backward compatibility)
            const notesWithPriority = savedNotes.map(note => ({
              ...note,
              priority: note.priority || 3 // Default to middle priority if missing
            }));

            setNotes(notesWithPriority);
            // Update maxZIndex to be higher than any loaded note
            const maxZ = Math.max(...notesWithPriority.map(note => note.zIndex));
            setMaxZIndex(maxZ);
          }
        } catch (error) {
          console.error('Failed to load notes from IndexedDB:', error);
        }
      }

      setIsLoading(false);
    };

    initializeApp();
  }, []);

  // Auto-save notes to IndexedDB whenever notes change
  useEffect(() => {
    if (!isLoading && dbSupported && notes.length >= 0) {
      const saveData = async () => {
        try {
          await saveNotes(notes);
          console.log('Notes auto-saved to IndexedDB');
        } catch (error) {
          console.error('Failed to auto-save notes:', error);
        }
      };

      // Debounce the save operation
      const timeoutId = setTimeout(saveData, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [notes, isLoading, dbSupported]);

  // Handle window resize to update screen size display
  React.useEffect(() => {
    const handleResize = () => {
      setScreenSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Show loading indicator
  if (isLoading) {
    return (
      <div className="notes-container">
        <div className="loading-screen">
          <div className="loading-content">
            <h2>🔥 Sticky Notes</h2>
            <p>🔄 Loading your notes...</p>
          </div>
        </div>
      </div>
    );
  }

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
        <button
          className="create-note-btn"
          onClick={() => createNote()}
          disabled={isLoading}
        >
          {isLoading ? '⏳ Loading...' : '+ New Note'}
        </button>
        <select
          className="size-selector"
          value={selectedSize}
          onChange={(e) => setSelectedSize(e.target.value as NoteSize)}
          disabled={isLoading}
        >
          <option value="small">Small (200×200)</option>
          <option value="medium">Medium (300×250)</option>
          <option value="large">Large (400×300)</option>
        </select>

        {/* Database status indicator */}
        <div className="db-status">
          {isLoading ? (
            <span className="db-loading">🔄 Loading...</span>
          ) : dbSupported ? (
            <span className="db-supported">💾 Auto-save enabled</span>
          ) : (
            <span className="db-not-supported">⚠️ No auto-save</span>
          )}
        </div>
      </div>

      {/* Instructions */}
      {notes.length === 0 && !isLoading && (
        <div className="instructions">
          <h2>🔥 Sticky Notes</h2>
          <p>Click "New Note" to create your first sticky note!</p>
          <p style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
            Optimized for desktop screens (1024×768 minimum)
          </p>
          {dbSupported && (
            <p style={{ fontSize: '12px', color: '#00b894', fontWeight: '500' }}>
              💾 Your notes are automatically saved and will persist between sessions
            </p>
          )}
          <div className="features">
            <div>📝 <strong>Create:</strong> Use the "New Note" button</div>
            <div>🖱️ <strong>Move:</strong> Drag notes by their header</div>
            <div>📏 <strong>Resize:</strong> Drag the orange corner handles</div>
            <div style={{ background: 'rgba(255, 71, 87, 0.1)', border: '2px dashed #ff4757' }}>
              🗑️ <strong>Delete:</strong> Drag notes to the red circle in bottom-right corner
            </div>
            <div>🎨 <strong>Color:</strong> Click the colored circles in note headers</div>
            <div>🔥 <strong>Priority:</strong> Use dropdown (🔥 Top → 📋 Bottom) to control layering</div>
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
