import React, { useRef, useEffect } from 'react';
import type { Note as NoteType, NoteColor } from './types';

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
        // Don't start drag if clicking on textarea, resize handles, or color pickers
        if (e.target === contentRef.current ||
            (e.target as HTMLElement).classList.contains('resize-handle') ||
            (e.target as HTMLElement).classList.contains('color-picker')) {
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

            // Allow notes to go beyond bounds when dragging (so they can reach trash zone)
            // Only constrain to a reasonable area to prevent notes from going too far off-screen
            const buffer = 200; // Allow notes to go 200px beyond normal bounds
            const minX = -buffer;
            const maxX = window.innerWidth + buffer;
            const minY = -buffer;
            const maxY = window.innerHeight + buffer;

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

            // Apply bounds checking while preserving the resize behavior
            const minX = 0;
            const maxX = window.innerWidth - newWidth;
            const minY = 0;
            const maxY = window.innerHeight - newHeight;

            // Only constrain position if it would go outside bounds
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
                            note.color === 'green' ? '#00b894' : '#e17055'
            }}
            onMouseDown={handleMouseDown}
        >
            <div className="note-header">
                <span className="note-id note-drag-handle">#{note.id.slice(-4)}</span>
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
