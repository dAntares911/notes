import React, { useRef, useEffect } from 'react';
import type { Note as NoteType, NoteColor, NotePriority } from './types';

interface NoteProps {
    note: NoteType;
    onUpdate: (id: string, updates: Partial<NoteType>) => void;

    onDragStart: (id: string) => void;
    onDragEnd: () => void;
    isDragging: boolean;
}

const NOTE_COLORS: { [key in NoteColor]: string } = {
    yellow: '#ffd93d',
    pink: '#ff6b9d',
    blue: '#74b9ff',
    green: '#55d992',
    orange: '#ffa726'
};

export const Note: React.FC<NoteProps> = ({
    note,
    onUpdate,
    onDragStart,
    onDragEnd,
    isDragging
}) => {
    const noteRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLTextAreaElement>(null);

    // Handle note dragging
    const handleMouseDown = (e: React.MouseEvent) => {
        // Don't start drag if clicking on textarea, resize handles, color pickers, or priority selector
        if (e.target === contentRef.current ||
            (e.target as HTMLElement).classList.contains('resize-handle') ||
            (e.target as HTMLElement).classList.contains('color-picker') ||
            (e.target as HTMLElement).classList.contains('priority-selector')) {
            return;
        }

        e.preventDefault();
        console.log(`Starting drag for note ${note.id}`); // Debug log
        onDragStart(note.id);

        const startX = e.clientX - note.x;
        const startY = e.clientY - note.y;

        const handleMouseMove = (e: MouseEvent) => {
            const newX = e.clientX - startX;
            const newY = e.clientY - startY;

            // Smart boundary constraints: allow some overflow for trash zone but keep notes accessible
            const notePartialWidth = note.width * 0.3; // Keep 30% of note visible
            const notePartialHeight = note.height * 0.3; // Keep 30% of note visible

            const minX = -(note.width - notePartialWidth); // Allow most of note to go left, but keep part visible
            const maxX = window.innerWidth - notePartialWidth; // Allow most of note to go right, but keep part visible
            const minY = -(note.height - notePartialHeight); // Allow most of note to go up, but keep part visible
            const maxY = window.innerHeight - notePartialHeight; // Allow most of note to go down, but keep part visible

            onUpdate(note.id, {
                x: Math.max(minX, Math.min(newX, maxX)),
                y: Math.max(minY, Math.min(newY, maxY))
            });
        };

        const handleMouseUp = () => {
            console.log(`Ending drag for note ${note.id}`); // Debug log
            // Small delay to let the trash zone handler run first
            setTimeout(() => {
                onDragEnd();
            }, 10);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // Handle resizing
    const handleResizeStart = (e: React.MouseEvent, handle: string) => {
        e.preventDefault();
        e.stopPropagation();

        // Capture the initial state at the moment resize starts
        const initialMouseX = e.clientX;
        const initialMouseY = e.clientY;
        const initialWidth = note.width;
        const initialHeight = note.height;
        const initialX = note.x;
        const initialY = note.y;

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - initialMouseX;
            const deltaY = e.clientY - initialMouseY;

            let newWidth = initialWidth;
            let newHeight = initialHeight;
            let newX = initialX;
            let newY = initialY;

            switch (handle) {
                case 'se': {
                    // Bottom-right: only grow/shrink from top-left anchor
                    newWidth = Math.max(200, initialWidth + deltaX);
                    newHeight = Math.max(200, initialHeight + deltaY);
                    // Position stays the same
                    break;
                }

                case 'sw': {
                    // Bottom-left: grow/shrink from top-right anchor
                    newWidth = Math.max(200, initialWidth - deltaX);
                    newHeight = Math.max(200, initialHeight + deltaY);
                    // Move left edge only if width actually changed
                    const actualWidthSW = Math.max(200, initialWidth - deltaX);
                    newX = initialX + (initialWidth - actualWidthSW);
                    break;
                }

                case 'ne': {
                    // Top-right: grow/shrink from bottom-left anchor
                    newWidth = Math.max(200, initialWidth + deltaX);
                    newHeight = Math.max(200, initialHeight - deltaY);
                    // Move top edge only if height actually changed
                    const actualHeightNE = Math.max(200, initialHeight - deltaY);
                    newY = initialY + (initialHeight - actualHeightNE);
                    break;
                }

                case 'nw': {
                    // Top-left: grow/shrink from bottom-right anchor
                    newWidth = Math.max(200, initialWidth - deltaX);
                    newHeight = Math.max(200, initialHeight - deltaY);
                    // Move both edges if dimensions actually changed
                    const actualWidthNW = Math.max(200, initialWidth - deltaX);
                    const actualHeightNW = Math.max(200, initialHeight - deltaY);
                    newX = initialX + (initialWidth - actualWidthNW);
                    newY = initialY + (initialHeight - actualHeightNW);
                    break;
                }
            }

            // Apply smart bounds checking while preserving the resize behavior
            const notePartialWidth = Math.max(100, newWidth * 0.3); // At least 100px or 30% visible
            const notePartialHeight = Math.max(100, newHeight * 0.3); // At least 100px or 30% visible

            const minX = -(newWidth - notePartialWidth);
            const maxX = window.innerWidth - notePartialWidth;
            const minY = -(newHeight - notePartialHeight);
            const maxY = window.innerHeight - notePartialHeight;

            // Only constrain position if it would go outside accessible bounds
            if (newX < minX) {
                const overflow = minX - newX;
                newX = minX;
                // For left-side handles, adjust width to compensate
                if (handle === 'sw' || handle === 'nw') {
                    newWidth -= overflow;
                }
            }
            if (newX > maxX) {
                newX = maxX;
            }
            if (newY < minY) {
                const overflow = minY - newY;
                newY = minY;
                // For top-side handles, adjust height to compensate
                if (handle === 'ne' || handle === 'nw') {
                    newHeight -= overflow;
                }
            }
            if (newY > maxY) {
                newY = maxY;
            }

            onUpdate(note.id, {
                x: newX,
                y: newY,
                width: Math.max(200, newWidth),
                height: Math.max(200, newHeight)
            });
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onUpdate(note.id, { content: e.target.value });
    };

    const handleColorChange = (e: React.MouseEvent, color: NoteColor) => {
        e.preventDefault();
        e.stopPropagation();
        onUpdate(note.id, { color });
    };

    const handlePriorityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        e.preventDefault();
        e.stopPropagation();
        const priority = parseInt(e.target.value) as NotePriority;
        onUpdate(note.id, { priority });
    };

    useEffect(() => {
        if (contentRef.current && note.content === '') {
            contentRef.current.focus();
        }
    }, [note.content]);

    return (
        <div
            ref={noteRef}
            className={`note ${isDragging ? 'dragging' : ''}`}
            style={{
                left: note.x,
                top: note.y,
                width: note.width,
                height: note.height,
                backgroundColor: NOTE_COLORS[note.color as NoteColor],
                zIndex: note.zIndex,
                borderColor: note.color === 'yellow' ? '#f1c40f' :
                    note.color === 'pink' ? '#e84393' :
                        note.color === 'blue' ? '#0984e3' :
                            note.color === 'green' ? '#00b894' : '#e17055',
                borderWidth: note.priority === 1 ? '3px' :
                    note.priority === 2 ? '2px' : '1px'
            }}
            onMouseDown={handleMouseDown}
        >
            <div className="note-header">
                <div className="note-info">
                    <span className="note-id note-drag-handle">#{note.id.slice(-4)}</span>
                    <span className="priority-badge" title={`Priority ${note.priority}`}>
                        {note.priority === 1 ? '🔥' :
                            note.priority === 2 ? '⚡' :
                                note.priority === 3 ? '📌' :
                                    note.priority === 4 ? '📄' : '📋'}
                    </span>
                    <select
                        className="priority-selector"
                        value={note.priority}
                        onChange={handlePriorityChange}
                        onMouseDown={(e) => e.stopPropagation()}
                        title="Priority (1=top, 5=bottom)"
                    >
                        <option value={1}>🔥 Top</option>
                        <option value={2}>⚡ High</option>
                        <option value={3}>📌 Normal</option>
                        <option value={4}>📄 Low</option>
                        <option value={5}>📋 Bottom</option>
                    </select>
                </div>
                <div className="note-colors">
                    {(Object.keys(NOTE_COLORS) as NoteColor[]).map(color => (
                        <div
                            key={color}
                            className={`color-picker color-${color}`}
                            onClick={(e) => handleColorChange(e, color)}
                            onMouseDown={(e) => e.stopPropagation()}
                            style={{ borderColor: note.color === color ? '#333' : 'transparent' }}
                        />
                    ))}
                </div>
            </div>

            <textarea
                ref={contentRef}
                className="note-content"
                value={note.content}
                onChange={handleContentChange}
                placeholder="Type your note here..."
                onMouseDown={(e) => e.stopPropagation()}
            />

            {/* Resize handles */}
            <div
                className="resize-handle resize-handle-se"
                onMouseDown={(e) => handleResizeStart(e, 'se')}
            />
            <div
                className="resize-handle resize-handle-sw"
                onMouseDown={(e) => handleResizeStart(e, 'sw')}
            />
            <div
                className="resize-handle resize-handle-ne"
                onMouseDown={(e) => handleResizeStart(e, 'ne')}
            />
            <div
                className="resize-handle resize-handle-nw"
                onMouseDown={(e) => handleResizeStart(e, 'nw')}
            />
        </div>
    );
};
