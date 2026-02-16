import { create } from 'zustand';

export interface CanvasElement {
    id: string;
    type: 'square' | 'circle' | 'text' | 'line' | 'arrow';
    x: number;
    y: number;
    width: number;
    height: number;
    rotate: number;
    color: string;
    text?: string;
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
    selectedElementId: string | null;
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

    selectElement: (id: string | null) => void;
    setEditingElement: (id: string | null) => void;

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
    selectedElementId: null,
    editingElementId: null,

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
                selectedElementId: null,
                editingElementId: null
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
                selectedElementId: null,
                editingElementId: null
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
            selectedElementId: element.id,
            editingElementId: startEditing ? element.id : null,
        }));
    },

    updateElement: (id, updates) => {
        set((state) => ({
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
            selectedElementId: state.selectedElementId === id ? null : state.selectedElementId,
        }));
    },

    selectElement: (id) => {
        set({ selectedElementId: id });
    },

    setEditingElement: (id) => {
        set({ editingElementId: id });
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
            selectedElementId: null,
            view: { x: 0, y: 0, scale: 1 }
        }));
    },
}));
