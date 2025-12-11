import { create } from "zustand";

interface InputStore {
    focusedInputId: string | null;
    setFocusedInputId: (id: string | null) => void;
}

const useInputStore = create<InputStore>((set, _get) => ({
    focusedInputId: null,
    setFocusedInputId: (id) => set({ focusedInputId: id }),
}));

// Export stable actions that won't cause re-renders
export const inputActions = {
    setFocusedInputId: (id: string | null) =>
        useInputStore.getState().setFocusedInputId(id),
};

export { useInputStore };
