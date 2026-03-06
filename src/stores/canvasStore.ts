import { create } from 'zustand';

export interface CanvasElement {
    id: string;
    type: 'square' | 'circle' | 'oval' | 'diamond' | 'text' | 'line' | 'arrow' | 'image' | 'human' | 'arrow-90' | 'arrow-curve';
    x: number;
    y: number;
    width: number;
    height: number;
    rotate: number;
    color: string;
    text?: string;
    src?: string; // For images
    bidirectional?: boolean; // For dual-ended arrows
    dashed?: boolean; // For dashed lines
}

interface ViewState {
    x: number;
    y: number;
    scale: number;
}

interface Project {
    name: string;
    elements: CanvasElement[];
    version: string;
}

interface CanvasState {
    project: Project;
    view: ViewState;
    selectedElementIds: string[];
    editingElementId: string | null; // For text editing

    // History
    past: Project[];
    future: Project[];
    undo: () => void;
    redo: () => void;

    addElement: (element: CanvasElement, startEditing?: boolean) => void;
    updateElement: (id: string, updates: Partial<CanvasElement>) => void;
    setElements: (elements: CanvasElement[]) => void;
    removeElement: (id: string) => void;

    removeElements: (ids: string[]) => void;

    setSelectedElements: (ids: string[]) => void;
    setEditingElement: (id: string | null) => void;

    updateElements: (updates: { id: string, updates: Partial<CanvasElement> }[]) => void;

    activeTool: string | null;
    setActiveTool: (tool: string | null) => void;

    isDashed: boolean;
    setIsDashed: (dashed: boolean) => void;

    setView: (view: Partial<ViewState>) => void;
    loadProject: (elements: CanvasElement[]) => void;
}

const initialProject: Project = {
    name: 'Untitled Project',
    elements: [],
    version: '1.0.0',
};

export const useCanvasStore = create<CanvasState>((set) => ({
    project: initialProject,
    view: { x: 0, y: 0, scale: 1 },
    selectedElementIds: [],
    editingElementId: null,
    activeTool: null,
    isDashed: false,

    // History Tracking
    past: [],
    future: [],

    undo: () => {
        set((state) => {
            if (state.past.length === 0) return {};

            const previous = state.past[state.past.length - 1];
            const newPast = state.past.slice(0, state.past.length - 1);

            return {
                past: newPast,
                future: [state.project, ...state.future],
                project: previous,
                selectedElementIds: [],
                editingElementId: null,
                activeTool: null // Reset tool on undo? Maybe prefer keeping it but usually standard to reset selection/tools on history jump
            };
        });
    },

    redo: () => {
        set((state) => {
            if (state.future.length === 0) return {};

            const next = state.future[0];
            const newFuture = state.future.slice(1);

            return {
                past: [...state.past, state.project],
                future: newFuture,
                project: next,
                selectedElementIds: [],
                editingElementId: null,
                activeTool: null
            };
        });
    },

    addElement: (element, startEditing = false) => {
        set((state) => ({
            past: [...state.past, state.project],
            future: [], // Clear future when new action occurs
            project: {
                ...state.project,
                elements: [...state.project.elements, element],
            },
            selectedElementIds: [element.id],
            editingElementId: startEditing ? element.id : null,
            // Don't reset activeTool here, handle in component or separate action if needed
            // Actually, usually tools persist until manually changed or ESC pressed, but for "one-shot" creation usually they reset. 
            // Let's handle reset in the component for now to be flexible.
        }));
    },

    updateElement: (id, updates) => {
        set((state) => ({
            // Only add to history if "significant" change? 
            // For dragging, we might flood history. Usually onDragEnd adds to history.
            // But here we just have simple updateElement. 
            // We'll leave history logic as is for now.
            past: [...state.past, state.project],
            future: [],
            project: {
                ...state.project,
                elements: state.project.elements.map((el) =>
                    el.id === id ? { ...el, ...updates } : el
                ),
            },
        }));
    },

    updateElements: (elementUpdates) => {
        set((state) => {
            const updatesMap = new Map(elementUpdates.map(u => [u.id, u.updates]));
            return {
                past: [...state.past, state.project],
                future: [],
                project: {
                    ...state.project,
                    elements: state.project.elements.map((el) => {
                        const updates = updatesMap.get(el.id);
                        return updates ? { ...el, ...updates } : el;
                    }),
                },
            };
        });
    },

    setElements: (elements) => {
        set((state) => ({
            past: [...state.past, state.project],
            future: [],
            project: { ...state.project, elements }
        }));
    },

    removeElement: (id) => {
        set((state) => ({
            past: [...state.past, state.project],
            future: [],
            project: {
                ...state.project,
                elements: state.project.elements.filter((el) => el.id !== id),
            },
            selectedElementIds: state.selectedElementIds.filter(selectedId => selectedId !== id),
        }));
    },

    removeElements: (ids) => {
        set((state) => {
            const idsSet = new Set(ids);
            return {
                past: [...state.past, state.project],
                future: [],
                project: {
                    ...state.project,
                    elements: state.project.elements.filter((el) => !idsSet.has(el.id)),
                },
                selectedElementIds: state.selectedElementIds.filter(id => !idsSet.has(id)),
            };
        });
    },

    setSelectedElements: (ids) => {
        set({ selectedElementIds: ids });
    },

    setEditingElement: (id) => {
        set({ editingElementId: id });
    },

    setActiveTool: (tool) => {
        set((state) => ({
            activeTool: tool,
            selectedElementIds: tool ? [] : state.selectedElementIds,
            editingElementId: null
        }));
    },

    setIsDashed: (dashed) => {
        set({ isDashed: dashed });
    },

    setView: (newView) => {
        set((state) => ({
            view: { ...state.view, ...newView }
        }));
    },

    loadProject: (elements) => {
        set((state) => ({
            past: [], // Reset history on new project load
            future: [],
            project: { ...state.project, elements },
            selectedElementIds: [],
            view: { x: 0, y: 0, scale: 1 },
            activeTool: null
        }));
    },
}));
