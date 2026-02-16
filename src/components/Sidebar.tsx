import { Square, Circle, Type, Minus, ArrowRight, Grid } from 'lucide-react';

export function Sidebar() {
    const handleDragStart = (e: React.DragEvent, type: string) => {
        e.dataTransfer.setData('text/plain', type);
        e.dataTransfer.effectAllowed = 'all';
    };

    return (
        <div className="w-64 bg-white border-r border-zinc-200 flex flex-col z-20 shadow-sm shrink-0 h-full">
            <div className="p-4 border-b border-zinc-100">
                <h1 className="font-bold text-lg flex items-center gap-2 text-zinc-800">
                    <Grid className="w-5 h-5 text-blue-600" />
                    Holst
                </h1>
                <p className="text-xs text-zinc-400 mt-1">Drag items to the grid</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* Shapes Section */}
                <div>
                    <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Shapes</h2>
                    <div className="grid grid-cols-2 gap-3">
                        <SidebarItem
                            type="square"
                            label="Box"
                            icon={<Square className="w-8 h-8 text-zinc-600 mb-2" />}
                            onDragStart={handleDragStart}
                        />
                        <SidebarItem
                            type="circle"
                            label="Circle"
                            icon={<Circle className="w-8 h-8 text-zinc-600 mb-2" />}
                            onDragStart={handleDragStart}
                        />
                    </div>
                </div>

                {/* Connectors Section */}
                <div>
                    <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Connectors</h2>
                    <div className="grid grid-cols-2 gap-3">
                        <SidebarItem
                            type="line"
                            label="Line"
                            icon={<Minus className="w-8 h-8 text-zinc-600 mb-2" />}
                            onDragStart={handleDragStart}
                        />
                        <SidebarItem
                            type="arrow"
                            label="Arrow"
                            icon={<ArrowRight className="w-8 h-8 text-zinc-600 mb-2" />}
                            onDragStart={handleDragStart}
                        />
                    </div>
                </div>

                {/* Elements Section */}
                <div>
                    <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Elements</h2>
                    <div className="space-y-3">
                        <div
                            draggable
                            onDragStart={(e) => handleDragStart(e, 'text')}
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-3 flex items-center gap-3 cursor-grab active:cursor-grabbing hover:border-blue-500 hover:bg-blue-50 transition-colors"
                        >
                            <Type className="w-5 h-5 text-zinc-600" />
                            <span className="text-sm text-zinc-600">Text Block</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}

function SidebarItem({ type, label, icon, onDragStart }: { type: string, label: string, icon: React.ReactNode, onDragStart: (e: React.DragEvent, type: string) => void }) {
    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, type)}
            className="aspect-square bg-zinc-50 border border-zinc-200 rounded-lg flex flex-col items-center justify-center cursor-grab active:cursor-grabbing hover:border-blue-500 hover:bg-blue-50 transition-colors"
        >
            {icon}
            <span className="text-xs text-zinc-600">{label}</span>
        </div>
    )
}
