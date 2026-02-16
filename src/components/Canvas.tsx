import { useRef, useState, useEffect } from 'react';
import { useCanvasStore, CanvasElement } from '../stores/canvasStore';
import { Move, MousePointer2, ZoomIn, ZoomOut, Maximize, Trash2, Download, Upload } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';

// COLORS constant from guide
const COLORS = [
    { name: 'Blue', bg: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-500' },
    { name: 'Red', bg: 'bg-red-500', border: 'border-red-500', text: 'text-red-500' },
    { name: 'Green', bg: 'bg-green-500', border: 'border-green-500', text: 'text-green-500' },
    { name: 'Yellow', bg: 'bg-yellow-400', border: 'border-yellow-400', text: 'text-yellow-400' },
    { name: 'Purple', bg: 'bg-purple-500', border: 'border-purple-500', text: 'text-purple-500' },
    { name: 'Gray', bg: 'bg-gray-500', border: 'border-gray-500', text: 'text-gray-500' },
    { name: 'Black', bg: 'bg-black', border: 'border-black', text: 'text-black' },
];

export function Canvas() {
    const {
        project, view, selectedElementId, editingElementId,
        addElement, updateElement, removeElement,
        selectElement, setEditingElement, setView, loadProject
    } = useCanvasStore();

    const canvasRef = useRef<HTMLDivElement>(null);

    // Local drag state for interactions
    const [dragState, setDragState] = useState<{
        mode: 'moving' | 'panning' | 'resizing-shape' | 'resizing-start' | 'resizing-end';
        id?: string;
        startX: number;
        startY: number;
        initialElemX?: number;
        initialElemY?: number;
        initialView?: { x: number; y: number; scale: number };
        initial?: CanvasElement; // snapshot of element state at start of drag
    } | null>(null);

    // --- HTML5 Drag & Drop (Sidebar to Canvas) ---
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        // Use 'text/plain' as it is most reliable
        const type = e.dataTransfer.getData('text/plain') as CanvasElement['type'];

        if (!type || !canvasRef.current) return;

        const canvasRect = canvasRef.current.getBoundingClientRect();

        // Calculate raw mouse position relative to canvas container
        const rawX = e.clientX - canvasRect.left;
        const rawY = e.clientY - canvasRect.top;

        // Convert raw mouse position to World Coordinates (accounting for Pan & Zoom)
        const x = (rawX - view.x) / view.scale;
        const y = (rawY - view.y) / view.scale;

        let width = 100;
        let height = 100;
        let rotate = 0;

        if (type === 'line' || type === 'arrow') {
            width = 200;
            height = 20;
        }
        if (type === 'text') {
            width = 200;
            height = 50;
        }

        const newElement: CanvasElement = {
            id: uuidv4(),
            type,
            x: x - (width / 2),
            y: y - (height / 2),
            rotate,
            color: 'bg-black', // Default color class
            text: type === 'text' ? '' : '',
            width,
            height,
        };

        addElement(newElement, type === 'text');
    };

    // --- Canvas Navigation (Zoom/Pan) ---
    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey) e.preventDefault(); // Prevent browser zoom

        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Determine scale amount
        const delta = -e.deltaY * 0.001;
        const newScale = Math.min(Math.max(0.1, view.scale + delta), 5); // Clamped between 0.1x and 5x

        // Zoom towards the mouse pointer
        const scaleRatio = newScale / view.scale;
        const newX = mouseX - (mouseX - view.x) * scaleRatio;
        const newY = mouseY - (mouseY - view.y) * scaleRatio;

        setView({ scale: newScale, x: newX, y: newY });
    };

    // --- Interaction Handlers ---
    const startPanning = (e: React.MouseEvent) => {
        if (dragState) return;
        selectElement(null);
        setEditingElement(null);
        setDragState({
            mode: 'panning',
            startX: e.clientX,
            startY: e.clientY,
            initialView: { ...view }
        });
    };

    const startMoving = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        e.preventDefault();
        const element = project.elements.find(el => el.id === id);
        if (!element) return;

        selectElement(id);
        if (editingElementId !== id) setEditingElement(null);

        setDragState({
            mode: 'moving',
            id,
            startX: e.clientX,
            startY: e.clientY,
            initialElemX: element.x,
            initialElemY: element.y
        });
    };

    const startResizing = (e: React.MouseEvent, id: string, handleType: 'resizing-shape' | 'resizing-start' | 'resizing-end') => {
        e.stopPropagation();
        e.preventDefault();
        const element = project.elements.find(el => el.id === id);
        if (!element) return;

        selectElement(id);

        setDragState({
            mode: handleType,
            id,
            startX: e.clientX,
            startY: e.clientY,
            initial: { ...element }
        });
    };

    // --- Window Event Listeners for Dragging ---
    useEffect(() => {
        if (!dragState) return;

        const handleWindowMouseMove = (e: MouseEvent) => {
            if (!canvasRef.current) return;

            // If panning, we don't need element ID
            if (dragState.mode === 'panning' && dragState.initialView) {
                const dx = e.clientX - dragState.startX;
                const dy = e.clientY - dragState.startY;
                setView({
                    x: dragState.initialView.x + dx,
                    y: dragState.initialView.y + dy,
                    scale: dragState.initialView.scale
                });
                return;
            }

            // For scaling, we need to convert mouse to world space
            const canvasRect = canvasRef.current.getBoundingClientRect();
            const rawMouseX = e.clientX - canvasRect.left;
            const rawMouseY = e.clientY - canvasRect.top;
            const mouseX = (rawMouseX - view.x) / view.scale;
            const mouseY = (rawMouseY - view.y) / view.scale;

            if (!dragState.id) return;

            if (dragState.mode === 'moving' && dragState.initialElemX !== undefined && dragState.initialElemY !== undefined) {
                const dx = (e.clientX - dragState.startX) / view.scale;
                const dy = (e.clientY - dragState.startY) / view.scale;
                updateElement(dragState.id, {
                    x: dragState.initialElemX + dx,
                    y: dragState.initialElemY + dy
                });
            }
            else if (dragState.mode === 'resizing-shape' && dragState.initial) {
                const el = dragState.initial;
                const newWidth = Math.max(30, mouseX - el.x);
                const newHeight = Math.max(30, mouseY - el.y);
                updateElement(dragState.id, { width: newWidth, height: newHeight });
            }
            else if (dragState.mode === 'resizing-end' && dragState.initial) {
                const el = dragState.initial;
                const startX = el.x;
                const startY = el.y + (el.height / 2);
                const deltaX = mouseX - startX;
                const deltaY = mouseY - startY;
                const newWidth = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                const newRotate = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
                updateElement(dragState.id, { width: newWidth, rotate: newRotate });
            }
            else if (dragState.mode === 'resizing-start' && dragState.initial) {
                const el = dragState.initial;
                const rads = el.rotate * (Math.PI / 180);

                const currentEndX = el.x + el.width * Math.cos(rads);
                const currentEndY = (el.y + el.height / 2) + el.width * Math.sin(rads);

                // Calculate distance from new mouse pos to the fixed End point
                const newWidth = Math.sqrt(Math.pow(currentEndX - mouseX, 2) + Math.pow(currentEndY - mouseY, 2));
                const newRotate = Math.atan2(currentEndY - mouseY, currentEndX - mouseX) * (180 / Math.PI);

                updateElement(dragState.id, { x: mouseX, y: mouseY - (el.height / 2), width: newWidth, rotate: newRotate });
            }
        };

        const handleWindowMouseUp = () => {
            setDragState(null);
        };

        window.addEventListener('mousemove', handleWindowMouseMove);
        window.addEventListener('mouseup', handleWindowMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleWindowMouseMove);
            window.removeEventListener('mouseup', handleWindowMouseUp);
        };
    }, [dragState, view, updateElement]); // Dependencies for the effect

    // --- Key Events ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Delete / Backspace
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElementId) {
                const tagName = document.activeElement?.tagName;
                if (tagName !== 'INPUT' && tagName !== 'TEXTAREA') {
                    removeElement(selectedElementId);
                }
            }

            // Undo / Redo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                if (e.shiftKey) {
                    useCanvasStore.getState().redo();
                } else {
                    useCanvasStore.getState().undo();
                }
            }
            else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                useCanvasStore.getState().redo();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedElementId, removeElement]);


    // --- Render Helpers ---

    // --- Render Helpers ---

    const getColorParams = (bgClass: string) => {
        const color = COLORS.find(c => c.bg === bgClass);
        return color || COLORS[0]; // Fallback to first color (Blue)
    };

    // Universal Resize Handle
    const ResizeHandle = ({ onMouseDown, className, style }: { onMouseDown: React.MouseEventHandler, className?: string, style?: React.CSSProperties }) => (
        <div
            onMouseDown={onMouseDown}
            className={`absolute w-3 h-3 bg-white border-2 border-blue-500 rounded-full z-20 hover:scale-125 transition-transform ${className}`}
            style={style}
        />
    );

    const renderElement = (el: CanvasElement) => {
        const isSelected = selectedElementId === el.id;
        const isEditing = editingElementId === el.id;

        const style: React.CSSProperties = {
            transform: `translate(${el.x}px, ${el.y}px) rotate(${el.rotate || 0}deg)`,
            width: el.width,
            height: el.height,
            transformOrigin: '0px 50%',
            position: 'absolute'
        };

        const commonClasses = `flex items-center justify-center group select-none
          ${isSelected ? 'z-10' : 'z-0'}
        `;

        if (el.type === 'square') {
            return (
                <div
                    key={el.id}
                    style={style}
                    className={`${commonClasses} cursor-move bg-white border-[3px] ${getColorParams(el.color).border} rounded-lg ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : 'hover:ring-2 hover:ring-blue-200'}`}
                    onMouseDown={(e) => startMoving(e, el.id)}
                    onDoubleClick={(e) => { e.stopPropagation(); setEditingElement(el.id); }}
                >
                    {isEditing ? (
                        <textarea
                            className="w-full h-full bg-transparent text-center resize-none outline-none p-2 font-medium text-zinc-800"
                            value={el.text || ''}
                            onChange={(e) => updateElement(el.id, { text: e.target.value })}
                            onFocus={(e) => {
                                const val = e.target.value;
                                e.target.setSelectionRange(val.length, val.length);
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onBlur={() => setEditingElement(null)}
                            onKeyDown={(e) => {
                                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                    e.preventDefault();
                                    setEditingElement(null);
                                }
                                if (e.key === 'Escape') {
                                    e.preventDefault();
                                    setEditingElement(null);
                                }
                            }}
                            autoFocus
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center pointer-events-none p-2 overflow-hidden">
                            <span className="text-center font-medium text-zinc-700 break-words leading-tight w-full">{el.text}</span>
                        </div>
                    )}

                    {isSelected && (
                        <>
                            <div className="absolute -top-6 left-0 text-xs bg-black text-white px-1 rounded transform -rotate-0" style={{ transform: `scale(${1 / view.scale})` }}>Box</div>
                            <ResizeHandle
                                className="cursor-nwse-resize"
                                style={{ right: '-6px', bottom: '-6px' }}
                                onMouseDown={(e) => startResizing(e, el.id, 'resizing-shape')}
                            />
                        </>
                    )}
                </div>
            );
        }

        if (el.type === 'circle') {
            return (
                <div
                    key={el.id}
                    style={style}
                    className={`${commonClasses} cursor-move bg-white border-[3px] ${getColorParams(el.color).border} rounded-full ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : 'hover:ring-2 hover:ring-blue-200'}`}
                    onMouseDown={(e) => startMoving(e, el.id)}
                    onDoubleClick={(e) => { e.stopPropagation(); setEditingElement(el.id); }}
                >
                    {isEditing ? (
                        <div className="w-[70%] h-[70%] flex items-center justify-center">
                            <textarea
                                className="w-full h-full bg-transparent text-center resize-none outline-none font-medium text-zinc-800 flex flex-col justify-center"
                                value={el.text || ''}
                                onChange={(e) => updateElement(el.id, { text: e.target.value })}
                                onFocus={(e) => {
                                    const val = e.target.value;
                                    e.target.setSelectionRange(val.length, val.length);
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                onBlur={() => setEditingElement(null)}
                                onKeyDown={(e) => {
                                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                        e.preventDefault();
                                        setEditingElement(null);
                                    }
                                    if (e.key === 'Escape') {
                                        e.preventDefault();
                                        setEditingElement(null);
                                    }
                                }}
                                autoFocus
                            />
                        </div>
                    ) : (
                        <div className="w-[70%] h-[70%] flex items-center justify-center pointer-events-none overflow-hidden">
                            <span className="text-center font-medium text-zinc-700 break-words leading-tight w-full">{el.text}</span>
                        </div>
                    )}

                    {isSelected && (
                        <>
                            <div className="absolute -top-6 left-0 text-xs bg-black text-white px-1 rounded" style={{ transform: `scale(${1 / view.scale})` }}>Circle</div>
                            <ResizeHandle
                                className="cursor-nwse-resize"
                                style={{ right: '14.6%', bottom: '14.6%' }}
                                onMouseDown={(e) => startResizing(e, el.id, 'resizing-shape')}
                            />
                        </>
                    )}
                </div>
            );
        }

        if (el.type === 'text') {
            return (
                <div
                    key={el.id}
                    style={style}
                    className={`absolute flex items-start justify-start group select-none cursor-move bg-white border border-zinc-200 px-2 py-2 rounded-md shadow-md ${isSelected ? 'z-10 ring-2 ring-blue-500 ring-offset-2' : 'z-0 hover:ring-2 hover:ring-blue-200'}`}
                    onMouseDown={(e) => startMoving(e, el.id)}
                    onDoubleClick={(e) => { e.stopPropagation(); setEditingElement(el.id); }}
                >
                    {isEditing ? (
                        <textarea
                            value={el.text || ''}
                            onChange={(e) => updateElement(el.id, { text: e.target.value })}
                            onFocus={(e) => {
                                const val = e.target.value;
                                e.target.setSelectionRange(val.length, val.length);
                            }}
                            className="w-full h-full bg-transparent outline-none resize-none font-medium text-zinc-800 leading-tight"
                            style={{ textAlign: 'left' }}
                            autoFocus
                            onKeyDown={(e) => {
                                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                    e.preventDefault();
                                    setEditingElement(null);
                                }
                                if (e.key === 'Escape') {
                                    e.preventDefault();
                                    setEditingElement(null);
                                }
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onBlur={() => setEditingElement(null)}
                        />
                    ) : (
                        <div className="w-full h-full pointer-events-none text-left font-medium text-zinc-800 leading-tight whitespace-pre-wrap break-words overflow-hidden">
                            {el.text || "Text"}
                        </div>
                    )}

                    {isSelected && (
                        <>
                            <div className="absolute -top-6 left-0 text-xs bg-black text-white px-1 rounded" style={{ transform: `scale(${1 / view.scale})` }}>Text</div>
                            <ResizeHandle
                                className="cursor-nwse-resize"
                                style={{ right: '-6px', bottom: '-6px' }}
                                onMouseDown={(e) => startResizing(e, el.id, 'resizing-shape')}
                            />
                        </>
                    )}
                </div>
            );
        }

        if (el.type === 'line') {
            return (
                <div
                    key={el.id}
                    style={style}
                    className={`${commonClasses} cursor-move`}
                    onMouseDown={(e) => startMoving(e, el.id)}
                >
                    <div className={`w-full h-[3px] rounded-full ${el.color} ${isSelected ? 'ring-1 ring-blue-400 ring-offset-2' : ''}`} />

                    {isSelected && (
                        <>
                            <ResizeHandle
                                className="-left-1.5 cursor-crosshair"
                                style={{ top: '50%', transform: 'translateY(-50%)' }}
                                onMouseDown={(e) => startResizing(e, el.id, 'resizing-start')}
                            />
                            <ResizeHandle
                                className="-right-1.5 cursor-crosshair"
                                style={{ top: '50%', transform: 'translateY(-50%)' }}
                                onMouseDown={(e) => startResizing(e, el.id, 'resizing-end')}
                            />
                        </>
                    )}
                </div>
            );
        }

        if (el.type === 'arrow') {
            return (
                <div
                    key={el.id}
                    style={style}
                    className={`${commonClasses} cursor-move flex items-center`}
                    onMouseDown={(e) => startMoving(e, el.id)}
                >
                    <div className={`flex-1 h-[3px] rounded-l-full ${el.color} ${isSelected ? 'ring-1 ring-blue-400 ring-offset-2' : ''}`} />

                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`-ml-1 w-6 h-6 ${getColorParams(el.color).text}`}
                    >
                        <path d="M5 12h14" stroke="transparent" />
                        <path d="m12 5 7 7-7 7" fill="none" />
                    </svg>

                    {isSelected && (
                        <>
                            <ResizeHandle
                                className="-left-1.5 cursor-crosshair"
                                style={{ top: '50%', transform: 'translateY(-50%)' }}
                                onMouseDown={(e) => startResizing(e, el.id, 'resizing-start')}
                            />
                            <ResizeHandle
                                className="-right-1.5 cursor-crosshair"
                                style={{ top: '50%', transform: 'translateY(-50%)' }}
                                onMouseDown={(e) => startResizing(e, el.id, 'resizing-end')}
                            />
                        </>
                    )}
                </div>
            );
        }
    };

    // --- File IO ---
    const handleExport = async () => {
        try {
            const path = await save({
                filters: [{
                    name: 'Holst Project',
                    extensions: ['json']
                }],
                defaultPath: 'project.json'
            });

            if (path) {
                console.log('Attempting to save to:', path);
                await writeTextFile(path, JSON.stringify(project.elements, null, 2));
                console.log('Save successful');
            } else {
                console.log('Export cancelled');
            }
        } catch (error) {
            console.error('Failed to export:', error);
            alert(`Export failed: ${JSON.stringify(error)}`); // temporary alert to see error
        }
    };

    const handleImportClick = async () => {
        try {
            const path = await open({
                multiple: false,
                filters: [{
                    name: 'Holst Project',
                    extensions: ['json']
                }]
            });

            if (path) {
                const content = await readTextFile(path);
                const elements = JSON.parse(content);
                if (Array.isArray(elements)) {
                    loadProject(elements);
                }
            }
        } catch (error) {
            console.error('Failed to import:', error);
        }
    };

    return (
        <div className="flex-1 flex flex-col relative bg-zinc-100 overflow-hidden w-full h-full">
            {/* Toolbar Header (Integrated with Canvas area) */}
            <div className="h-14 bg-white border-b border-zinc-200 flex items-center px-6 justify-between z-10 shrink-0 select-none">
                {/* Left Side: Status */}
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 rounded-md text-zinc-600 text-sm">
                        {dragState?.mode === 'panning' ? <Move className="w-4 h-4" /> : <MousePointer2 className="w-4 h-4" />}
                        <span>{selectedElementId ? 'Element Selected' : 'Drag BG to Pan'}</span>
                    </div>
                </div>

                {/* Right Side: Tools */}
                <div className="flex items-center gap-4">

                    {/* Dynamic Tools (Color/Delete) */}
                    {selectedElementId && (
                        <div className="flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-200">

                            {/* Color Picker */}
                            <div className="flex items-center gap-2">
                                {COLORS.map((c) => (
                                    <button
                                        key={c.name}
                                        onClick={() => updateElement(selectedElementId, { color: c.bg })}
                                        className={`w-6 h-6 rounded-full ${c.bg} hover:scale-110 transition-transform ring-1 ring-zinc-200 ${project.elements.find(e => e.id === selectedElementId)?.color === c.bg ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : ''}`}
                                        title={c.name}
                                        type="button"
                                    />
                                ))}
                            </div>

                            <div className="h-6 w-px bg-zinc-300 mx-2"></div>

                            <button
                                onClick={() => removeElement(selectedElementId)}
                                className="flex items-center gap-2 text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-md transition-colors text-sm font-medium"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete
                            </button>

                            {/* Divider between selection tools and file tools */}
                            <div className="h-6 w-px bg-zinc-300 mx-2"></div>
                        </div>
                    )}

                    {/* Static File Tools (Export/Import) */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 text-zinc-600 hover:bg-zinc-100 px-3 py-1.5 rounded-md transition-colors text-sm font-medium"
                            title="Save as JSON"
                        >
                            <Upload className="w-4 h-4" />
                            Export
                        </button>
                        <button
                            onClick={handleImportClick}
                            className="flex items-center gap-2 text-zinc-600 hover:bg-zinc-100 px-3 py-1.5 rounded-md transition-colors text-sm font-medium"
                            title="Load JSON"
                        >
                            <Download className="w-4 h-4" />
                            Import
                        </button>
                    </div>
                </div>
            </div>

            {/* The Grid Canvas Container */}
            <div
                ref={canvasRef}
                className="flex-1 relative overflow-hidden cursor-crosshair w-full h-full"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onWheel={handleWheel}
                onMouseDown={startPanning}
                style={{
                    // Pan grid background
                    backgroundPosition: `${view.x}px ${view.y}px`,
                    // Scale grid background
                    backgroundSize: `${20 * view.scale}px ${20 * view.scale}px`,
                    backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
                    cursor: dragState?.mode === 'panning' ? 'grabbing' : 'grab'
                }}
            >
                {/* World Container - Applies Zoom & Pan to all elements */}
                <div
                    style={{
                        transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
                        transformOrigin: '0 0',
                        width: '100%',
                        height: '100%',
                        pointerEvents: dragState?.mode === 'panning' ? 'none' : 'auto'
                    }}
                >
                    {project.elements.length === 0 && (
                        // Need to reverse scale for this static UI so it doesn't shrink/grow weirdly
                        <div
                            className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40 select-none"
                            style={{ transform: `translate(${-view.x / view.scale}px, ${-view.y / view.scale}px) scale(${1 / view.scale})` }}
                        >
                            <div className="text-center">
                                <Move className="w-12 h-12 text-zinc-400 mx-auto mb-2" />
                                <h3 className="text-xl font-medium text-zinc-500">Canvas Empty</h3>
                                <p className="text-zinc-400">Drag shapes from the sidebar</p>
                                <p className="text-zinc-400 text-xs mt-2">Scroll to Zoom • Drag BG to Pan</p>
                            </div>
                        </div>
                    )}

                    {project.elements.map(renderElement)}
                </div>

                {/* Zoom Controls (Floating UI - unaffected by zoom/pan) */}
                <div className="absolute bottom-6 right-6 flex flex-col bg-white shadow-lg border border-zinc-200 rounded-lg overflow-hidden select-none">
                    <button onClick={() => setView({ scale: Math.min(view.scale * 1.2, 5) })} className="p-2 hover:bg-zinc-50 border-b border-zinc-100" title="Zoom In">
                        <ZoomIn className="w-5 h-5 text-zinc-600" />
                    </button>
                    <button onClick={() => setView({ x: 0, y: 0, scale: 1 })} className="p-2 hover:bg-zinc-50 border-b border-zinc-100" title="Reset View">
                        <Maximize className="w-5 h-5 text-zinc-600" />
                    </button>
                    <button onClick={() => setView({ scale: Math.max(view.scale / 1.2, 0.1) })} className="p-2 hover:bg-zinc-50" title="Zoom Out">
                        <ZoomOut className="w-5 h-5 text-zinc-600" />
                    </button>
                </div>
                <div className="absolute bottom-6 left-6 bg-white/80 backdrop-blur px-2 py-1 rounded text-xs text-zinc-500 pointer-events-none select-none">
                    {Math.round(view.scale * 100)}%
                </div>
            </div>
        </div>
    );
}
