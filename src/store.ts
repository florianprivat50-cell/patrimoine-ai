import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  Asset,
  ChatMessage,
  Goal,
  Liability,
  Profile,
  RealEstateProject,
  Snapshot,
} from "./types";
import {
  demoAssets,
  demoGoals,
  demoLiabilities,
  demoProfile,
  demoProjects,
  demoSnapshots,
} from "./lib/demo";

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

interface PiaState {
  onboarded: boolean;
  demoMode: boolean;
  profile: Profile | null;
  assets: Asset[];
  liabilities: Liability[];
  goals: Goal[];
  projects: RealEstateProject[];
  snapshots: Snapshot[];
  chat: ChatMessage[];
  // sauvegarde des données réelles pendant la démo
  realBackup: string | null;

  completeOnboarding: (p: Profile) => void;
  updateProfile: (p: Partial<Profile>) => void;
  addAsset: (a: Asset) => void;
  updateAsset: (a: Asset) => void;
  removeAsset: (id: string) => void;
  addLiability: (l: Liability) => void;
  updateLiability: (l: Liability) => void;
  removeLiability: (id: string) => void;
  addGoal: (g: Goal) => void;
  updateGoal: (g: Goal) => void;
  removeGoal: (id: string) => void;
  addProject: (p: RealEstateProject) => void;
  updateProject: (p: RealEstateProject) => void;
  removeProject: (id: string) => void;
  pushChat: (m: ChatMessage) => void;
  clearChat: () => void;
  recordSnapshot: (netWorth: number, gross: number, debts: number) => void;
  enterDemo: () => void;
  exitDemo: () => void;
  resetAll: () => void;
}

const emptyData = {
  profile: null as Profile | null,
  assets: [] as Asset[],
  liabilities: [] as Liability[],
  goals: [] as Goal[],
  projects: [] as RealEstateProject[],
  snapshots: [] as Snapshot[],
  chat: [] as ChatMessage[],
};

export const useStore = create<PiaState>()(
  persist(
    (set, get) => ({
      onboarded: false,
      demoMode: false,
      realBackup: null,
      ...emptyData,

      completeOnboarding: (p) => set({ profile: p, onboarded: true }),
      updateProfile: (p) =>
        set((s) => ({ profile: s.profile ? { ...s.profile, ...p } : (p as Profile) })),

      addAsset: (a) => set((s) => ({ assets: [...s.assets, a] })),
      updateAsset: (a) =>
        set((s) => ({ assets: s.assets.map((x) => (x.id === a.id ? a : x)) })),
      removeAsset: (id) => set((s) => ({ assets: s.assets.filter((x) => x.id !== id) })),

      addLiability: (l) => set((s) => ({ liabilities: [...s.liabilities, l] })),
      updateLiability: (l) =>
        set((s) => ({ liabilities: s.liabilities.map((x) => (x.id === l.id ? l : x)) })),
      removeLiability: (id) =>
        set((s) => ({ liabilities: s.liabilities.filter((x) => x.id !== id) })),

      addGoal: (g) => set((s) => ({ goals: [...s.goals, g] })),
      updateGoal: (g) => set((s) => ({ goals: s.goals.map((x) => (x.id === g.id ? g : x)) })),
      removeGoal: (id) => set((s) => ({ goals: s.goals.filter((x) => x.id !== id) })),

      addProject: (p) => set((s) => ({ projects: [...s.projects, p] })),
      updateProject: (p) =>
        set((s) => ({ projects: s.projects.map((x) => (x.id === p.id ? p : x)) })),
      removeProject: (id) =>
        set((s) => ({ projects: s.projects.filter((x) => x.id !== id) })),

      pushChat: (m) => set((s) => ({ chat: [...s.chat, m].slice(-60) })),
      clearChat: () => set({ chat: [] }),

      recordSnapshot: (netWorth, gross, debts) => {
        const s = get();
        if (s.demoMode) return; // jamais de snapshots réels en démo
        const today = new Date().toISOString().slice(0, 10);
        const last = s.snapshots[s.snapshots.length - 1];
        if (last?.date === today) {
          if (last.netWorth !== Math.round(netWorth)) {
            set({
              snapshots: [
                ...s.snapshots.slice(0, -1),
                { date: today, netWorth: Math.round(netWorth), gross: Math.round(gross), debts: Math.round(debts) },
              ],
            });
          }
          return;
        }
        set({
          snapshots: [
            ...s.snapshots,
            { date: today, netWorth: Math.round(netWorth), gross: Math.round(gross), debts: Math.round(debts) },
          ].slice(-400),
        });
      },

      enterDemo: () => {
        const s = get();
        if (s.demoMode) return;
        const backup = JSON.stringify({
          profile: s.profile,
          assets: s.assets,
          liabilities: s.liabilities,
          goals: s.goals,
          projects: s.projects,
          snapshots: s.snapshots,
          chat: s.chat,
          onboarded: s.onboarded,
        });
        set({
          demoMode: true,
          realBackup: backup,
          onboarded: true,
          profile: demoProfile,
          assets: demoAssets,
          liabilities: demoLiabilities,
          goals: demoGoals,
          projects: demoProjects,
          snapshots: demoSnapshots(),
          chat: [],
        });
      },

      exitDemo: () => {
        const s = get();
        if (!s.demoMode) return;
        const restored = s.realBackup ? JSON.parse(s.realBackup) : { ...emptyData, onboarded: false };
        set({ demoMode: false, realBackup: null, ...restored });
      },

      resetAll: () => set({ demoMode: false, realBackup: null, onboarded: false, ...emptyData }),
    }),
    { name: "patrimoine-ia" }
  )
);
