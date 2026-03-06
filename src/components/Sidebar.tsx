import React, { useState } from 'react';
import { Square, Type, Minus, MoveRight, Grid, Image, CornerDownRight, Spline, MousePointer2, Diamond } from 'lucide-react';
import { useCanvasStore } from '../stores/canvasStore';

export function Sidebar() {
    const { setActiveTool, activeTool, isDashed, setIsDashed } = useCanvasStore();
    const [tooltip, setTooltip] = useState<{ label: string, top: number, left: number } | null>(null);

    const handleDragStart = (e: React.DragEvent, type: string) => {
        e.dataTransfer.setData('text/plain', type);
        e.dataTransfer.effectAllowed = 'all';
    };

    const handleToolClick = (type: string) => {
        setActiveTool(activeTool === type ? null : type);
    };

    return (
        <div className="w-16 bg-white border-r border-zinc-200 flex flex-col items-center z-20 shadow-sm shrink-0 h-full">
            <div className="p-4 border-b border-zinc-100 w-full flex justify-center">
                <Grid className="w-6 h-6 text-blue-600" />
            </div>

            <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-4 w-full items-center" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>

                {/* --- Clickable Tools (Click to use) --- */}

                {/* Select Tool */}
                <div className="flex flex-col gap-2">
                    <SidebarItem
                        type="selection-box"
                        label="Select"
                        icon={<MousePointer2 className="w-5 h-5 text-zinc-600" />}
                        onClick={() => handleToolClick('selection-box')}
                        isActive={activeTool === 'selection-box'}
                        setTooltip={setTooltip}
                    />
                </div>

                <div className="w-8 h-px bg-zinc-200 shrink-0" />

                {/* Connectors */}
                <div className="flex flex-col gap-2">
                    <button
                        onClick={() => setIsDashed(!isDashed)}
                        className={`w-10 h-10 border rounded-lg flex flex-col items-center justify-center transition-colors shrink-0
                            ${isDashed ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200 text-blue-600' : 'border-zinc-200 hover:border-blue-500 hover:bg-blue-50 text-zinc-600'}
                        `}
                        onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTooltip({ label: isDashed ? 'Solid Lines' : 'Dashed Lines', top: rect.top + rect.height / 2, left: rect.right + 12 });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray={isDashed ? "0" : "6 6"}>
                            <line x1="3" y1="12" x2="21" y2="12" />
                        </svg>
                    </button>
                    <div className="w-6 h-px bg-zinc-200 shrink-0 self-center my-0.5" />
                    <SidebarItem
                        type="line"
                        label="Line"
                        icon={<Minus className="w-5 h-5 text-zinc-600" />}
                        onClick={() => handleToolClick('line')}
                        isActive={activeTool === 'line'}
                        setTooltip={setTooltip}
                    />
                    <SidebarItem
                        type="arrow"
                        label="Arrow"
                        icon={<MoveRight className="w-5 h-5 text-zinc-600" />}
                        onClick={() => handleToolClick('arrow')}
                        isActive={activeTool === 'arrow'}
                        setTooltip={setTooltip}
                    />
                    <SidebarItem
                        type="arrow-90"
                        label="90° Arrow"
                        icon={<CornerDownRight className="w-5 h-5 text-zinc-600" />}
                        onClick={() => handleToolClick('arrow-90')}
                        isActive={activeTool === 'arrow-90'}
                        setTooltip={setTooltip}
                    />
                    <SidebarItem
                        type="arrow-curve"
                        label="Curve"
                        icon={<Spline className="w-5 h-5 text-zinc-600" />}
                        onClick={() => handleToolClick('arrow-curve')}
                        isActive={activeTool === 'arrow-curve'}
                        setTooltip={setTooltip}
                    />
                </div>

                <div className="w-8 h-px bg-zinc-200 shrink-0" />

                {/* --- Draggable Items (Drag to canvas) --- */}

                {/* Shapes */}
                <div className="flex flex-col gap-2">
                    <SidebarItem
                        type="square"
                        label="Box"
                        icon={<Square className="w-5 h-5 text-zinc-600" />}
                        onDragStart={handleDragStart}
                        setTooltip={setTooltip}
                    />
                    <SidebarItem
                        type="diamond"
                        label="Diamond"
                        icon={<Diamond className="w-5 h-5 text-zinc-600" />}
                        onDragStart={handleDragStart}
                        setTooltip={setTooltip}
                    />
                    <SidebarItem
                        type="oval"
                        label="Oval"
                        icon={
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-zinc-600">
                                <ellipse cx="12" cy="12" rx="10" ry="6" />
                            </svg>
                        }
                        onDragStart={handleDragStart}
                        setTooltip={setTooltip}
                    />
                </div>

                <div className="w-8 h-px bg-zinc-200 shrink-0" />

                {/* Elements */}
                <div className="flex flex-col gap-2">
                    <SidebarItem
                        type="text"
                        label="Text Block"
                        icon={<Type className="w-5 h-5 text-zinc-600" />}
                        onDragStart={handleDragStart}
                        setTooltip={setTooltip}
                    />
                    <SidebarItem
                        type="image"
                        label="Image"
                        icon={<Image className="w-5 h-5 text-zinc-600" />}
                        onDragStart={handleDragStart}
                        setTooltip={setTooltip}
                    />
                    <SidebarItem
                        type="human"
                        label="Figure"
                        icon={
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-zinc-600">
                                <circle cx="12" cy="5" r="3" />
                                <path d="M12 8v7" />
                                <path d="M8 11h8" />
                                <path d="M9 21l3-6 3 6" />
                            </svg>
                        }
                        onDragStart={handleDragStart}
                        setTooltip={setTooltip}
                    />
                </div>

            </div>

            {/* Global style to hide webkit scrollbar for sidebar */}
            <style dangerouslySetInnerHTML={{
                __html: `
                .overflow-y-auto::-webkit-scrollbar {
                    display: none;
                }
            `}} />

            {/* Fixed Tooltip Overlay */}
            {tooltip && (
                <div
                    className="fixed z-[100] px-2 py-1.5 bg-zinc-800 text-white text-xs font-medium rounded shadow-sm pointer-events-none flex items-center animate-in fade-in duration-100"
                    style={{ top: tooltip.top, left: tooltip.left, transform: 'translateY(-50%)' }}
                >
                    {tooltip.label}
                    {/* Tooltip Arrow */}
                    <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-y-[5px] border-y-transparent border-r-[5px] border-r-zinc-800" />
                </div>
            )}
        </div>
    );
}

function SidebarItem({ type, label, icon, onDragStart, onClick, isActive, setTooltip }: { type: string, label: string, icon: React.ReactNode, onDragStart?: (e: React.DragEvent, type: string) => void, onClick?: () => void, isActive?: boolean, setTooltip?: (tooltip: { label: string, top: number, left: number } | null) => void }) {
    return (
        <div
            draggable={!!onDragStart}
            onDragStart={(e) => {
                setTooltip?.(null);
                onDragStart && onDragStart(e, type);
            }}
            onClick={onClick}
            onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setTooltip?.({ label, top: rect.top + rect.height / 2, left: rect.right + 12 });
            }}
            onMouseLeave={() => setTooltip?.(null)}
            className={`w-10 h-10 border rounded-lg flex flex-col items-center justify-center transition-colors shrink-0
                ${isActive ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-zinc-200 hover:border-blue-500 hover:bg-blue-50'}
                ${!!onDragStart ? 'bg-blue-50/50 cursor-grab active:cursor-grabbing' : 'bg-zinc-50 cursor-pointer'}
            `}
        >
            {icon}
        </div>
    )
}
