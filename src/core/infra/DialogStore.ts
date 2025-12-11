import { create } from "zustand";

interface DialogStore {
    activeDialogId: string | null;
    openDialog: (id: string) => void;
    closeDialog: (id?: string) => void;
}

const useDialogStore = create<DialogStore>((set, _get) => ({
    activeDialogId: null,
    openDialog: (id) => set({ activeDialogId: id }),
    closeDialog: (id) =>
        set((state) => {
            // Only close if no ID provided or if the ID matches
            if (!id || state.activeDialogId === id) {
                return { activeDialogId: null };
            }
            return state;
        }),
}));

// Export stable actions that won't cause re-renders
export const dialogActions = {
    openDialog: (id: string) => useDialogStore.getState().openDialog(id),
    closeDialog: (id?: string) => useDialogStore.getState().closeDialog(id),
};

export { useDialogStore };
