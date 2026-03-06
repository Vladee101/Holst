import { useRef, useState, useEffect } from 'react';
import { useCanvasStore, CanvasElement } from '../stores/canvasStore';
import { Move, MousePointer2, ZoomIn, ZoomOut, Maximize, Trash2, Download, Upload, Image as ImageIcon } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile, readFile } from '@tauri-apps/plugin-fs';
import { convertFileSrc } from '@tauri-apps/api/core';

// COLORS constant from guide
const COLORS = [
    { name: 'Blue', bg: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-500', hex: '#3b82f6' },
    { name: 'Red', bg: 'bg-red-500', border: 'border-red-500', text: 'text-red-500', hex: '#ef4444' },
    { name: 'Green', bg: 'bg-green-500', border: 'border-green-500', text: 'text-green-500', hex: '#22c55e' },
    { name: 'Yellow', bg: 'bg-yellow-400', border: 'border-yellow-400', text: 'text-yellow-400', hex: '#facc15' },
    { name: 'Purple', bg: 'bg-purple-500', border: 'border-purple-500', text: 'text-purple-500', hex: '#a855f7' },
    { name: 'Gray', bg: 'bg-gray-500', border: 'border-gray-500', text: 'text-gray-500', hex: '#6b7280' },
    { name: 'Black', bg: 'bg-black', border: 'border-black', text: 'text-black', hex: '#000000' },
];

// Universal Resize Handle
const ResizeHandle = ({ onMouseDown, className, style }: { onMouseDown: React.MouseEventHandler, className?: string, style?: React.CSSProperties }) => (
    <div
        onMouseDown={onMouseDown}
        className={`absolute w-3 h-3 bg-white border-2 border-blue-500 rounded-full z-20 hover:scale-125 transition-transform ${className}`}
        style={style}
    />
);

// --- Image Component ---
const ImageNode = ({
    el,
    isSelected,
    view,
    updateElement,
    startMoving,
    startResizing
}: {
    el: CanvasElement,
    isSelected: boolean,
    view: { scale: number },
    updateElement: (id: string, updates: Partial<CanvasElement>) => void,
    startMoving: (e: React.MouseEvent, id: string) => void,
    startResizing: (e: React.MouseEvent, id: string, handleType: 'resizing-shape' | 'resizing-start' | 'resizing-end') => void
}) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        const loadImage = async () => {
            if (!el.src) {
                setImageUrl(null);
                return;
            }

            try {
                // Try to read file
                const contents = await readFile(el.src);
                const blob = new Blob([contents]);
                const url = URL.createObjectURL(blob);
                if (active) setImageUrl(url);
                return () => URL.revokeObjectURL(url);
            } catch (err) {
                console.error('Failed to load image:', err);
                // Fallback to convertFileSrc if readFile fails (e.g. if it's already an asset URL or permissions behave oddly)
                if (active) setImageUrl(convertFileSrc(el.src));
            }
        };

        loadImage();

        return () => {
            active = false;
        };
    }, [el.src]);

    const handleImageDoubleClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const selected = await open({
                multiple: false,
                filters: [{
                    name: 'Images',
                    extensions: ['png', 'jpeg', 'jpg']
                }]
            });

            if (selected) {
                updateElement(el.id, { src: selected as string });
            }
        } catch (err) {
            console.error('Failed to open image:', err);
        }
    };

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

    return (
        <div
            key={el.id}
            style={style}
            className={`${commonClasses} cursor-move bg-white border border-zinc-200 ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : 'hover:ring-2 hover:ring-blue-200'}`}
            onMouseDown={(e) => startMoving(e, el.id)}
            onDoubleClick={handleImageDoubleClick}
        >
            {imageUrl ? (
                <img
                    src={imageUrl}
                    alt="User Image"
                    className="w-full h-full object-contain pointer-events-none select-none"
                    draggable={false}
                />
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-100 text-zinc-400">
                    <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
                    <span className="text-xs">Double click to add image</span>
                </div>
            )}

            {isSelected && (
                <>
                    <div className="absolute -top-6 left-0 text-xs bg-black text-white px-1 rounded" style={{
                        transform: `scale(${1 / view.scale})`
                    }}>Image</div >
                    <ResizeHandle
                        className="cursor-nwse-resize"
                        style={{ right: '-6px', bottom: '-6px' }}
                        onMouseDown={(e) => startResizing(e, el.id, 'resizing-shape')}
                    />
                </>
            )}
        </div >
    );
};

// --- Main Canvas Component ---
export function Canvas() {
    const {
        project, view, selectedElementIds, editingElementId,
        addElement, updateElement, removeElements, updateElements,
        setSelectedElements, setEditingElement, setView, loadProject,
        activeTool, isDashed // Consuming activeTool and isDashed
    } = useCanvasStore();

    const canvasRef = useRef<HTMLDivElement>(null);

    const [dragState, setDragState] = useState<{
        mode: 'moving' | 'panning' | 'resizing-shape' | 'resizing-start' | 'resizing-end' | 'creating' | 'selection-box';
        id?: string;
        startX: number;
        startY: number;
        initialElemX?: number;
        initialElemY?: number;
        initialView?: { x: number; y: number; scale: number };
        initial?: CanvasElement; // snapshot of element state at start of drag
        initialElementsPositions?: { id: string, x: number, y: number }[];
    } | null>(null);

    const [selectionBox, setSelectionBox] = useState<{
        startX: number;
        startY: number;
        currentX: number;
        currentY: number;
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

        if (type === 'line' || type === 'arrow' || type === 'arrow-curve') {
            width = 200;
            height = 20;
        }
        if (type === 'text') {
            width = 200;
            height = 50;
        }
        if (type === 'oval') {
            width = 120;
            height = 80;
        }
        if (type === 'diamond') {
            width = 100;
            height = 100;
        }
        if (type === 'image') {
            width = 300;
            height = 200;
        }
        if (type === 'human') {
            width = 60;
            height = 100; // Includes space for text
        }
        if (type === 'arrow-90' || type === 'arrow-curve') {
            width = 100;
            height = 100;
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
            src: type === 'image' ? '' : undefined,
            dashed: (type === 'line' || type === 'arrow' || type === 'arrow-90' || type === 'arrow-curve') ? isDashed : undefined
        };

        addElement(newElement, type === 'text'); // Only auto-edit for text, images need double click to select file

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
        setSelectedElements([]);
        setEditingElement(null);
        setDragState({
            mode: 'panning',
            startX: e.clientX,
            startY: e.clientY,
            initialView: { ...view }
        });
    };

    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        // If active tool is set, start creating
        const { activeTool } = useCanvasStore.getState();

        if (activeTool === 'selection-box') {
            if (!canvasRef.current) return;
            const canvasRect = canvasRef.current.getBoundingClientRect();
            const rawX = e.clientX - canvasRect.left;
            const rawY = e.clientY - canvasRect.top;

            setDragState({
                mode: 'selection-box',
                startX: rawX,
                startY: rawY,
            });
            setSelectionBox({
                startX: rawX,
                startY: rawY,
                currentX: rawX,
                currentY: rawY
            });

            if (!e.shiftKey) {
                setSelectedElements([]);
            }
            return;
        }

        if (activeTool) {
            if (!canvasRef.current) return;
            const canvasRect = canvasRef.current.getBoundingClientRect();
            const rawX = e.clientX - canvasRect.left;
            const rawY = e.clientY - canvasRect.top;
            const x = (rawX - view.x) / view.scale;
            const y = (rawY - view.y) / view.scale;

            const id = uuidv4();
            let width = 0;
            let height = 0;
            let type = activeTool as CanvasElement['type'];

            // For lines/arrows, we might want height to represent thickness or bounding box? 
            // In current renderElement, height is used for bounding box.
            // Let's behave similarly to dragging state 'resizing-end' but starting from 0 width.

            // However, existing renderer for line uses height=3px fixed mostly, but container has height. 
            // Actually looking at renderElement for 'line':
            // style has height: el.height. 
            // internal div has h-[3px].
            // So el.height is the container height. 
            // When we drag-drop in handleDrop: width=200, height=20.

            if (type === 'line' || type === 'arrow' || type === 'arrow-curve' || type === 'arrow-90') {
                height = 20;
            }

            const newElement: CanvasElement = {
                id,
                type,
                x,
                y: y - (height / 2),
                width,
                height,
                rotate: 0,
                color: 'bg-black',
                text: '',
                dashed: (type === 'line' || type === 'arrow' || type === 'arrow-90' || type === 'arrow-curve') ? isDashed : undefined
            };

            // If it's 90-deg or curve, we might need strictly positive width/height for SVG viewBox?
            // Let's initialize small to avoid flicker if needed, or handle in render.
            // Update: 'resizing-end' logic handles width/rotate. 

            addElement(newElement);

            setDragState({
                mode: 'creating',
                id,
                startX: e.clientX,
                startY: e.clientY,
                initialElemX: x,
                initialElemY: y - (height / 2),
                initial: newElement
            });
            return;
        }

        // Otherwise panning
        startPanning(e);
    }

    const startMoving = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        e.preventDefault();

        // If we are in "creation mode" (active tool), don't select existing elements, 
        // effectively ignoring them so we can click "through" them if needed? 
        // Or should we allow selecting if we click ON an element?
        // Standard UX: active tool overrides selection.
        const { activeTool } = useCanvasStore.getState();
        if (activeTool) {
            handleCanvasMouseDown(e);
            return;
        }

        const element = project.elements.find(el => el.id === id);
        if (!element) return;

        let newSelection = selectedElementIds;

        if (!selectedElementIds.includes(id)) {
            newSelection = e.shiftKey ? [...selectedElementIds, id] : [id];
            setSelectedElements(newSelection);
        } else if (e.shiftKey) {
            newSelection = selectedElementIds.filter(x => x !== id);
            setSelectedElements(newSelection);
            return; // Deselecting, so don't start moving
        }

        if (editingElementId !== id) setEditingElement(null);

        const initialElementsPositions = newSelection.map(selId => {
            const el = project.elements.find(e => e.id === selId);
            return el ? { id: selId, x: el.x, y: el.y } : null;
        }).filter(Boolean) as { id: string, x: number, y: number }[];

        setDragState({
            mode: 'moving',
            id,
            startX: e.clientX,
            startY: e.clientY,
            initialElementsPositions
        });
    };

    const startResizing = (e: React.MouseEvent, id: string, handleType: 'resizing-shape' | 'resizing-start' | 'resizing-end') => {
        e.stopPropagation();
        e.preventDefault();
        const element = project.elements.find(el => el.id === id);
        if (!element) return;

        setSelectedElements([id]);

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

            if (dragState.mode === 'selection-box') {
                setSelectionBox(prev => prev ? { ...prev, currentX: rawMouseX, currentY: rawMouseY } : null);
                return;
            }

            const mouseX = (rawMouseX - view.x) / view.scale;
            const mouseY = (rawMouseY - view.y) / view.scale;

            if (!dragState.id) return;

            if (dragState.mode === 'moving' && dragState.initialElementsPositions) {
                const dx = (e.clientX - dragState.startX) / view.scale;
                const dy = (e.clientY - dragState.startY) / view.scale;

                const updates = dragState.initialElementsPositions.map(pos => ({
                    id: pos.id,
                    updates: {
                        x: pos.x + dx,
                        y: pos.y + dy
                    }
                }));
                updateElements(updates);
            }
            else if (dragState.mode === 'resizing-shape' && dragState.initial) {
                const el = dragState.initial;
                let newWidth = Math.max(30, mouseX - el.x);
                let newHeight = Math.max(30, mouseY - el.y);

                if (el.type === 'oval' && (e.ctrlKey || e.metaKey)) {
                    const maxDim = Math.max(newWidth, newHeight);
                    newWidth = maxDim;
                    newHeight = maxDim;
                }

                updateElement(dragState.id!, { width: newWidth, height: newHeight });
            }
            else if ((dragState.mode === 'resizing-end' || dragState.mode === 'creating') && dragState.initial) {
                const el = dragState.initial;

                const startX = el.x;
                const startY = el.y + (el.height / 2);

                const deltaX = mouseX - startX;
                const deltaY = mouseY - startY;
                const newWidth = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                const newRotate = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

                updateElement(dragState.id!, { width: newWidth, rotate: newRotate });
            }
            else if (dragState.mode === 'resizing-start' && dragState.initial) {
                const el = dragState.initial;

                const rads = el.rotate * (Math.PI / 180);

                const currentEndX = el.x + el.width * Math.cos(rads);
                const currentEndY = (el.y + el.height / 2) + el.width * Math.sin(rads);

                // Calculate distance from new mouse pos to the fixed End point
                const newWidth = Math.sqrt(Math.pow(currentEndX - mouseX, 2) + Math.pow(currentEndY - mouseY, 2));
                const newRotate = Math.atan2(currentEndY - mouseY, currentEndX - mouseX) * (180 / Math.PI);

                updateElement(dragState.id!, { x: mouseX, y: mouseY - (el.height / 2), width: newWidth, rotate: newRotate });
            }
        };

        const handleWindowMouseUp = (e: MouseEvent) => {
            if (dragState.mode === 'creating') {
                useCanvasStore.getState().setActiveTool(null);
            }

            if (dragState.mode === 'selection-box' && canvasRef.current) {
                const canvasRect = canvasRef.current.getBoundingClientRect();
                const currentX = e.clientX - canvasRect.left;
                const currentY = e.clientY - canvasRect.top;

                const boxMinX = Math.min(dragState.startX, currentX);
                const boxMaxX = Math.max(dragState.startX, currentX);
                const boxMinY = Math.min(dragState.startY, currentY);
                const boxMaxY = Math.max(dragState.startY, currentY);

                const worldMinX = (boxMinX - view.x) / view.scale;
                const worldMaxX = (boxMaxX - view.x) / view.scale;
                const worldMinY = (boxMinY - view.y) / view.scale;
                const worldMaxY = (boxMaxY - view.y) / view.scale;

                const storeState = useCanvasStore.getState();
                const newlySelected = storeState.project.elements.filter(el => {
                    const isConnector = el.type === 'line' || el.type === 'arrow' || el.type === 'arrow-90' || el.type === 'arrow-curve';
                    const elMinX = Math.min(el.x, el.x + (isConnector ? el.width * Math.cos(el.rotate * Math.PI / 180) : el.width));
                    const elMaxX = Math.max(el.x, el.x + (isConnector ? el.width * Math.cos(el.rotate * Math.PI / 180) : el.width));
                    const elMinY = Math.min(el.y, el.y + (isConnector ? el.width * Math.sin(el.rotate * Math.PI / 180) : el.height));
                    const elMaxY = Math.max(el.y, el.y + (isConnector ? el.width * Math.sin(el.rotate * Math.PI / 180) : el.height));

                    return (
                        elMinX < worldMaxX &&
                        elMaxX > worldMinX &&
                        elMinY < worldMaxY &&
                        elMaxY > worldMinY
                    );
                }).map(el => el.id);

                if (e.shiftKey) {
                    const combined = new Set([...storeState.selectedElementIds, ...newlySelected]);
                    storeState.setSelectedElements(Array.from(combined));
                } else {
                    storeState.setSelectedElements(newlySelected);
                }

                setSelectionBox(null);
                storeState.setActiveTool(null);
            }

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
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElementIds.length > 0) {
                const tagName = document.activeElement?.tagName;
                if (tagName !== 'INPUT' && tagName !== 'TEXTAREA') {
                    removeElements(selectedElementIds);
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

            // Bidirectional Toggle
            if (e.key === 'b' && selectedElementIds.length > 0) {
                const tagName = document.activeElement?.tagName;
                if (tagName !== 'INPUT' && tagName !== 'TEXTAREA') {
                    const storeState = useCanvasStore.getState();
                    const updates = selectedElementIds.map(id => {
                        const el = storeState.project.elements.find(e => e.id === id);
                        return { id, updates: { bidirectional: !(el as any)?.bidirectional } as Partial<CanvasElement> };
                    });
                    updateElements(updates);
                }
            }

            // Dashed Toggle
            if (e.key === 'd' && selectedElementIds.length > 0) {
                const tagName = document.activeElement?.tagName;
                if (tagName !== 'INPUT' && tagName !== 'TEXTAREA') {
                    const storeState = useCanvasStore.getState();
                    const updates = selectedElementIds.map(id => {
                        const el = storeState.project.elements.find(e => e.id === id);
                        if (el && ['line', 'arrow', 'arrow-90', 'arrow-curve'].includes(el.type)) {
                            return { id, updates: { dashed: !el.dashed } as Partial<CanvasElement> };
                        }
                        return null;
                    }).filter(Boolean) as { id: string, updates: Partial<CanvasElement> }[];
                    if (updates.length > 0) updateElements(updates);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedElementIds, removeElements]);


    // --- Render Helpers ---

    const getColorParams = (bgClass: string) => {
        const color = COLORS.find(c => c.bg === bgClass);
        return color || COLORS[0]; // Fallback to first color (Blue)
    };

    // Cursor style based on active tool
    const canvasCursor = activeTool ? 'cursor-crosshair' : (dragState?.mode === 'panning' ? 'cursor-grabbing' : 'cursor-default');

    const renderElement = (el: CanvasElement) => {
        const isSelected = selectedElementIds.includes(el.id);
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

        if (el.type === 'oval') {
            return (
                <div
                    key={el.id}
                    style={style}
                    className={`${commonClasses} cursor-move bg-white border-[3px] ${getColorParams(el.color).border} rounded-[50%] ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : 'hover:ring-2 hover:ring-blue-200'}`}
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
                            <div className="absolute -top-6 left-0 text-xs bg-black text-white px-1 rounded" style={{ transform: `scale(${1 / view.scale})` }}>Oval</div>
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

        if (el.type === 'diamond') {
            return (
                <div
                    key={el.id}
                    style={style}
                    className={`${commonClasses} cursor-move ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : 'hover:ring-2 hover:ring-blue-200'} rounded-none`}
                    onMouseDown={(e) => startMoving(e, el.id)}
                    onDoubleClick={(e) => { e.stopPropagation(); setEditingElement(el.id); }}
                >
                    {/* SVG Background */}
                    <svg
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        className="absolute inset-0 w-full h-full pointer-events-none"
                    >
                        <polygon
                            points="50,1.5 98.5,50 50,98.5 1.5,50"
                            fill="white"
                            stroke={getColorParams(el.color).hex}
                            strokeWidth="2"
                            vectorEffect="non-scaling-stroke"
                        />
                    </svg>

                    {/* Content */}
                    <div className="absolute inset-0 z-10 flex items-center justify-center">
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
                    </div>

                    {isSelected && (
                        <>
                            <div className="absolute -top-6 left-0 text-xs bg-black text-white px-1 rounded z-20" style={{ transform: `scale(${1 / view.scale})` }}>Diamond</div>
                            <ResizeHandle
                                className="cursor-nwse-resize z-20"
                                style={{ right: '-6px', bottom: '-6px' }}
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
                    className={`${commonClasses} cursor-move flex items-center justify-center`}
                    onMouseDown={(e) => startMoving(e, el.id)}
                    onDoubleClick={(e) => { e.stopPropagation(); setEditingElement(el.id); }}
                >
                    <div className={`absolute left-0 right-0 ${el.dashed ? `border-t-2 border-dashed ${getColorParams(el.color).border}` : `h-[2px] rounded-full ${getColorParams(el.color).bg}`} ${isSelected ? 'ring-1 ring-blue-400 ring-offset-2' : ''}`} />

                    {/* Text Overlay for Connector */}
                    <div
                        className="absolute z-10 flex items-center justify-center pointer-events-none"
                        style={{
                            left: '50%',
                            top: '50%',
                            transform: `translate(-50%, -50%) translateY(-24px) rotate(${(() => {
                                let globalAngle = (el.rotate || 0) % 360;
                                if (globalAngle > 180) globalAngle -= 360;
                                if (globalAngle <= -180) globalAngle += 360;
                                return Math.abs(globalAngle) > 90 ? 180 : 0;
                            })()
                                }deg)`
                        }}
                    >
                        {isEditing ? (
                            <div className="w-full h-full flex items-center justify-center pointer-events-auto">
                                <textarea
                                    className="w-full bg-transparent text-center resize-none outline-none font-medium text-zinc-800 flex flex-col justify-center"
                                    style={{ minHeight: '1.5em' }}
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
                        ) : el.text ? (
                            <div className="bg-transparent px-2 py-1 flex items-center justify-center pointer-events-none overflow-hidden max-w-full">
                                <span className="text-center font-medium text-zinc-800 break-words leading-tight w-full">{el.text}</span>
                            </div>
                        ) : null}
                    </div>

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
                    className={`${commonClasses} cursor-move flex items-center justify-start`}
                    onMouseDown={(e) => startMoving(e, el.id)}
                    onDoubleClick={(e) => { e.stopPropagation(); setEditingElement(el.id); }}
                >
                    <svg width="100%" height="100%" overflow="visible" className="absolute top-0 left-0">
                        <defs>
                            <marker id={`arrowhead-${el.id}`} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                <polygon points="0 0, 10 3.5, 0 7" fill={getColorParams(el.color).hex} />
                            </marker>
                            <marker id={`arrowhead-reverse-${el.id}`} markerWidth="10" markerHeight="7" refX="1" refY="3.5" orient="auto-start-reverse">
                                <polygon points="0 0, 10 3.5, 0 7" fill={getColorParams(el.color).hex} />
                            </marker>
                        </defs>
                        <path
                            d={`M 0 ${el.height / 2} L ${el.width} ${el.height / 2}`}
                            stroke={getColorParams(el.color).hex}
                            strokeWidth="2"
                            fill="none"
                            strokeLinecap="round"
                            strokeDasharray={el.dashed ? '8,8' : 'none'}
                            markerEnd={`url(#arrowhead-${el.id})`}
                            markerStart={el.bidirectional ? `url(#arrowhead-reverse-${el.id})` : undefined}
                        />
                    </svg>

                    {/* Text Overlay for Connector */}
                    <div
                        className="absolute z-10 flex items-center justify-center pointer-events-none"
                        style={{
                            left: '50%',
                            top: '50%',
                            transform: `translate(-50%, -50%) translateY(-24px) rotate(${(() => {
                                    let globalAngle = (el.rotate || 0) % 360;
                                    if (globalAngle > 180) globalAngle -= 360;
                                    if (globalAngle <= -180) globalAngle += 360;
                                    return Math.abs(globalAngle) > 90 ? 180 : 0;
                                })()
                                }deg)`
                        }}
                    >
                        {isEditing ? (
                            <div className="w-full h-full flex items-center justify-center pointer-events-auto">
                                <textarea
                                    className="w-full bg-transparent text-center resize-none outline-none font-medium text-zinc-800 flex flex-col justify-center"
                                    style={{ minHeight: '1.5em' }}
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
                        ) : el.text ? (
                            <div className="bg-transparent px-2 py-1 flex items-center justify-center pointer-events-none overflow-hidden max-w-full">
                                <span className="text-center font-medium text-zinc-800 break-words leading-tight w-full">{el.text}</span>
                            </div>
                        ) : null}
                    </div>

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

        if (el.type === 'image') {
            return (
                <ImageNode
                    key={el.id}
                    el={el}
                    isSelected={selectedElementIds.includes(el.id)}
                    view={view}
                    updateElement={updateElement}
                    startMoving={startMoving}
                    startResizing={startResizing}
                />
            );
        }
        if (el.type === 'human') {
            return (
                <div
                    key={el.id}
                    style={style}
                    className={`${commonClasses} cursor-move flex flex-col items-center justify-start`}
                    onMouseDown={(e) => startMoving(e, el.id)}
                    onDoubleClick={(e) => { e.stopPropagation(); setEditingElement(el.id); }}
                >
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`w-full h-full ${getColorParams(el.color).text}`}
                    >
                        <circle cx="12" cy="7" r="3" />
                        <path d="M12 10v7" />
                        <path d="M12 11l-3 4" /> {/* Left Arm - Raised */}
                        <path d="M12 11l3 4" />  {/* Right Arm - Raised */}
                        <path d="M12 17l-3 5" /> {/* Left Leg */}
                        <path d="M12 17l3 5" />  {/* Right Leg */}
                    </svg>

                    {/* Text underneath */}
                    <div className="absolute top-[100%] w-[200px] flex justify-center pt-1 pointer-events-none">
                        {isEditing ? (
                            <textarea
                                className="w-full bg-transparent text-center resize-none outline-none font-medium text-zinc-800 pointer-events-auto"
                                style={{ minHeight: '1.5em' }}
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
                            <span className="text-center font-medium text-zinc-800 break-words leading-tight w-full rounded px-1">
                                {el.text}
                            </span>
                        )}
                    </div>

                    {isSelected && (
                        <div className="absolute inset-0 border-2 border-blue-500 rounded-lg pointer-events-none">
                            <ResizeHandle
                                className="cursor-nwse-resize pointer-events-auto"
                                style={{ right: '-6px', bottom: '-6px' }}
                                onMouseDown={(e) => startResizing(e, el.id, 'resizing-shape')}
                            />
                        </div>
                    )}
                </div>
            );
        }

        if (el.type === 'arrow-90') {
            const rads = (el.rotate || 0) * (Math.PI / 180);
            const isMostlyHorizontal = Math.abs(Math.cos(rads)) >= Math.abs(Math.sin(rads));

            let ex, ey;
            if (isMostlyHorizontal) {
                // First leg is horizontal in global space
                ex = el.width * Math.pow(Math.cos(rads), 2);
                ey = -el.width * Math.sin(rads) * Math.cos(rads);
            } else {
                // First leg is vertical in global space
                ex = el.width * Math.pow(Math.sin(rads), 2);
                ey = el.width * Math.sin(rads) * Math.cos(rads);
            }

            const localAngleDeg = Math.atan2(ey, ex) * (180 / Math.PI);
            const globalAngle = (el.rotate || 0) + localAngleDeg;
            let normalizedGlobal = globalAngle % 360;
            if (normalizedGlobal > 180) normalizedGlobal -= 360;
            if (normalizedGlobal <= -180) normalizedGlobal += 360;
            const isUpsideDown = Math.abs(normalizedGlobal) > 90;
            const textRotation = isUpsideDown ? localAngleDeg + 180 : localAngleDeg;

            return (
                <div key={el.id} style={style} className={`${commonClasses} cursor-move flex items-center`} onMouseDown={(e) => startMoving(e, el.id)} onDoubleClick={(e) => { e.stopPropagation(); setEditingElement(el.id); }}>
                    <svg width="100%" height="100%" overflow="visible">
                        <defs>
                            <marker id={`arrowhead-90-${el.id}`} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                <polygon points="0 0, 10 3.5, 0 7" fill={getColorParams(el.color).hex} />
                            </marker>
                            <marker id={`arrowhead-reverse-90-${el.id}`} markerWidth="10" markerHeight="7" refX="1" refY="3.5" orient="auto-start-reverse">
                                <polygon points="0 0, 10 3.5, 0 7" fill={getColorParams(el.color).hex} />
                            </marker>
                        </defs>
                        <path
                            d={`M 0 10 L ${ex} ${10 + ey} L ${el.width} 10`}
                            stroke={getColorParams(el.color).hex}
                            strokeWidth="2"
                            fill="none"
                            strokeLinejoin="round"
                            strokeDasharray={el.dashed ? '8,8' : 'none'}
                            markerEnd={`url(#arrowhead-90-${el.id})`}
                            markerStart={el.bidirectional ? `url(#arrowhead-reverse-90-${el.id})` : undefined}
                        />
                    </svg>

                    <div
                        className="absolute z-10 flex items-center justify-center pointer-events-none"
                        style={{
                            left: ex / 2,
                            top: 10 + ey / 2,
                            transform: `translate(-50%, -50%) rotate(${textRotation}deg) translateY(-24px)`,
                            width: `${Math.max(100, Math.sqrt(ex * ex + ey * ey))}px`
                        }}
                    >
                        {isEditing ? (
                            <div className="w-full h-full flex items-center justify-center pointer-events-auto">
                                <textarea
                                    className="w-full bg-transparent text-center resize-none outline-none font-medium text-zinc-800 flex flex-col justify-center"
                                    style={{ minHeight: '1.5em' }}
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
                        ) : el.text ? (
                            <div className="bg-transparent px-2 py-1 flex items-center justify-center pointer-events-none overflow-hidden max-w-full">
                                <span className="text-center font-medium text-zinc-800 break-words leading-tight w-full">{el.text}</span>
                            </div>
                        ) : null}
                    </div>

                    {isSelected && (
                        <>
                            <ResizeHandle className="-left-1.5 cursor-crosshair" style={{ top: '50%', transform: 'translateY(-50%)' }} onMouseDown={(e) => startResizing(e, el.id, 'resizing-start')} />
                            <ResizeHandle className="-right-1.5 cursor-crosshair" style={{ top: '50%', transform: 'translateY(-50%)' }} onMouseDown={(e) => startResizing(e, el.id, 'resizing-end')} />
                        </>
                    )}
                </div>
            )
        }

        if (el.type === 'arrow-curve') {
            const rads = (el.rotate || 0) * (Math.PI / 180);

            // Determine whether the arc should bow upwards or downwards based on rotation.
            // When drawing rightwards (cos > 0) we bow up.
            // When drawing leftwards (cos < 0) we bow down.
            // This perfectly mimics natural left/right curving without needing an extra 'flip' property.
            const directionMultiplier = Math.cos(rads) >= 0 ? 1 : -1;
            const bowDepth = Math.min(el.width * 0.2, 50) * directionMultiplier;
            const controlY = 10 - bowDepth;

            return (
                <div key={el.id} style={style} className={`${commonClasses} cursor-move flex items-center`} onMouseDown={(e) => startMoving(e, el.id)}>
                    <svg width="100%" height="100%" overflow="visible">
                        <defs>
                            <marker id={`arrowhead-curve-${el.id}`} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                <polygon points="0 0, 10 3.5, 0 7" fill={getColorParams(el.color).hex} />
                            </marker>
                            <marker id={`arrowhead-reverse-curve-${el.id}`} markerWidth="10" markerHeight="7" refX="1" refY="3.5" orient="auto-start-reverse">
                                <polygon points="0 0, 10 3.5, 0 7" fill={getColorParams(el.color).hex} />
                            </marker>
                        </defs>
                        <path
                            d={`M 0 10 Q ${el.width / 2} ${controlY}, ${el.width} 10`}
                            stroke={getColorParams(el.color).hex}
                            strokeWidth="2"
                            fill="none"
                            strokeDasharray={el.dashed ? '8,8' : 'none'}
                            markerEnd={`url(#arrowhead-curve-${el.id})`}
                            markerStart={el.bidirectional ? `url(#arrowhead-reverse-curve-${el.id})` : undefined}
                        />
                    </svg>

                    {isSelected && (
                        <>
                            <ResizeHandle className="-left-1.5 cursor-crosshair" style={{ top: '50%', transform: 'translateY(-50%)' }} onMouseDown={(e) => startResizing(e, el.id, 'resizing-start')} />
                            <ResizeHandle className="-right-1.5 cursor-crosshair" style={{ top: '50%', transform: 'translateY(-50%)' }} onMouseDown={(e) => startResizing(e, el.id, 'resizing-end')} />
                        </>
                    )}
                </div>
            )
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
                        <span>{selectedElementIds.length > 0 ? `${selectedElementIds.length} Selected` : 'Drag BG to Pan'}</span>
                        {selectedElementIds.length === 1 && project.elements.find(el => el.id === selectedElementIds[0])?.type === 'oval' && (
                            <span className="text-zinc-400 italic text-xs ml-2">Hold "Ctrl" to draw a perfect circle</span>
                        )}
                        {selectedElementIds.length === 1 && ['arrow', 'arrow-90', 'arrow-curve'].includes(project.elements.find(el => el.id === selectedElementIds[0])?.type || '') && (
                            <span className="text-zinc-400 italic text-xs ml-2">Press "B" to toggle dual-ended arrow</span>
                        )}
                    </div>
                </div>

                {/* Right Side: Tools */}
                <div className="flex items-center gap-4">

                    {/* Dynamic Tools (Color/Delete) */}
                    {selectedElementIds.length > 0 && (
                        <div className="flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-200">

                            {/* Color Picker */}
                            <div className="flex items-center gap-2">
                                {COLORS.map((c) => {
                                    const firstSelectedColor = project.elements.find(e => selectedElementIds.includes(e.id))?.color;
                                    return (
                                        <button
                                            key={c.name}
                                            onClick={() => updateElements(selectedElementIds.map(id => ({ id, updates: { color: c.bg } })))}
                                            className={`w-6 h-6 rounded-full ${c.bg} hover:scale-110 transition-transform ring-1 ring-zinc-200 ${firstSelectedColor === c.bg ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : ''}`}
                                            title={c.name}
                                            type="button"
                                        />
                                    );
                                })}
                            </div>

                            <div className="h-6 w-px bg-zinc-300 mx-2"></div>

                            <button
                                onClick={() => removeElements(selectedElementIds)}
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
                className={`flex-1 bg-zinc-100 relative overflow-hidden ${canvasCursor}`}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onWheel={handleWheel}
                onMouseDown={handleCanvasMouseDown}
                style={{
                    // Pan grid background
                    backgroundPosition: `${view.x}px ${view.y}px`,
                    // Scale grid background
                    backgroundSize: `${20 * view.scale}px ${20 * view.scale}px`,
                    backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
                    cursor: dragState?.mode === 'panning' ? 'grabbing' : 'grab'
                }}
            >
                {/* Canvas Content - Applies Zoom & Pan to all elements */}
                <div
                    className="absolute inset-0 w-full h-full origin-top-left"
                    style={{
                        transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
                        transformOrigin: '0 0',
                        pointerEvents: dragState?.mode === 'panning' ? 'none' : 'auto'
                    }}
                >
                    {project.elements.length === 0 && (
                        // Need to reverse scale for this static UI so it doesn't shrink/grow weirdly
                        <div
                            className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40 select-none"
                            style={{ transform: `scale(${1 / view.scale}) translate(${-view.x}px, ${-view.y}px)` }}
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

                {/* Controls */}
                <div className="absolute top-4 right-4 flex flex-col gap-2">
                    <button
                        onClick={() => setView({ scale: Math.min(view.scale * 1.2, 5) })}
                        className="p-2 bg-white rounded-lg shadow-sm border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                    >
                        <ZoomIn className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setView({ x: 0, y: 0, scale: 1 })}
                        className="p-2 bg-white rounded-lg shadow-sm border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                    >
                        <Maximize className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setView({ scale: Math.max(view.scale / 1.2, 0.1) })}
                        className="p-2 bg-white rounded-lg shadow-sm border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                    >
                        <ZoomOut className="w-5 h-5" />
                    </button>
                </div>
                <div className="absolute bottom-6 left-6 bg-white/80 backdrop-blur px-2 py-1 rounded text-xs text-zinc-500 pointer-events-none select-none">
                    {Math.round(view.scale * 100)}%
                </div>

                {/* Selection Box Overlay */}
                {selectionBox && (
                    <div
                        className="absolute border border-blue-500 bg-blue-500/10 pointer-events-none z-50"
                        style={{
                            left: Math.min(selectionBox.startX, selectionBox.currentX),
                            top: Math.min(selectionBox.startY, selectionBox.currentY),
                            width: Math.abs(selectionBox.currentX - selectionBox.startX),
                            height: Math.abs(selectionBox.currentY - selectionBox.startY)
                        }}
                    />
                )}
            </div>
        </div>
    );
}
