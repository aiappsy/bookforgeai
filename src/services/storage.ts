import { db, auth } from './firebase';
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, where } from 'firebase/firestore';

export interface ProjectSave {
  id: string; // Document ID
  title: string;
  updatedAt: number;
  item_idea: string;
  idea: string;
  category: string;
  research: any;
  outline: string;
  chapters: any[];
  bookDetails: any;
  assets: any;
  chats: any;
  continuityMemory?: any;
  characterBible?: any;
  chapterIllustrations?: any;
}

export interface TrashItem {
  id: string;
  title: string;
  deletedAt: number;
  updatedAt: number;
  category: string;
  chapterCount: number;
  wordCount: number;
  idea?: string;
  data: ProjectSave;
}

let isFirestoreQuotaExceeded = false;

// Helper to test if a project contains meaningful user content (avoids creating ghost blank drafts)
export const hasProjectContent = (proj: any): boolean => {
  if (!proj) return false;
  const title = (proj.title || proj.bookDetails?.title || '').trim();
  const idea = (proj.idea || proj.item_idea || '').trim();
  const outline = (proj.outline || '').trim();
  const chapters = Array.isArray(proj.chapters) ? proj.chapters : [];
  const hasChaptersWithContent = chapters.some((c: any) => c && c.content && c.content.trim().length > 0);
  const isCustomTitle = Boolean(title && title !== 'Untitled Project' && title !== 'Untitled Book' && title !== 'Untitled Manuscript');
  
  return Boolean(isCustomTitle || idea.length > 0 || outline.length > 0 || chapters.length > 0 || proj.research || proj.assets?.coverUrl || (proj.characterBible && proj.characterBible.length > 0));
};

// Helper to update local storage index of projects
const updateLocalStorageIndex = (proj: { id: string; title: string; updatedAt: number; category?: string; idea?: string }) => {
  try {
    const raw = localStorage.getItem('kdp_projects_index');
    let list: any[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex(p => p.id === proj.id);
    const summary = {
      id: proj.id,
      title: proj.title || 'Untitled Book',
      updatedAt: proj.updatedAt || Date.now(),
      category: proj.category || 'non_fiction',
      idea: proj.idea || ''
    };
    if (idx >= 0) {
      list[idx] = summary;
    } else {
      list.push(summary);
    }
    localStorage.setItem('kdp_projects_index', JSON.stringify(list));
  } catch (e) {
    console.warn("LocalStorage index write failed:", e);
  }
};

// Helper to get trash set IDs
const getTrashSet = (): Set<string> => {
  const set = new Set<string>();
  try {
    const raw = localStorage.getItem('kdp_trash_bin');
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach(item => { if (item && item.id) set.add(item.id); });
      }
    }
  } catch (e) {}
  return set;
};

export const getTrashList = async (): Promise<TrashItem[]> => {
  let list: TrashItem[] = [];
  try {
    const raw = localStorage.getItem('kdp_trash_bin');
    if (raw) list = JSON.parse(raw);
  } catch (e) {
    console.warn("Error reading trash list:", e);
  }
  return Array.isArray(list) ? list.sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0)) : [];
};

export const moveToTrash = async (id: string): Promise<TrashItem | null> => {
  try {
    let projData: ProjectSave | null = null;
    const raw = localStorage.getItem(`kdp_project_${id}`);
    if (raw) {
      try { projData = JSON.parse(raw); } catch (e) {}
    }
    
    if (!projData) {
      projData = await loadProject(id);
    }

    if (!projData) return null;

    const chaps = Array.isArray(projData.chapters) ? projData.chapters : [];
    let wordCount = 0;
    chaps.forEach((c: any) => {
      if (c?.content) wordCount += c.content.trim().split(/\s+/).filter(Boolean).length;
    });

    const trashItem: TrashItem = {
      id: projData.id,
      title: projData.title || projData.bookDetails?.title || 'Untitled Manuscript',
      deletedAt: Date.now(),
      updatedAt: projData.updatedAt || Date.now(),
      category: projData.category || 'non_fiction',
      chapterCount: chaps.length,
      wordCount,
      idea: projData.idea || '',
      data: projData
    };

    // 1. Add to Trash Bin
    const trashList = await getTrashList();
    const filteredTrash = trashList.filter(t => t.id !== id);
    filteredTrash.unshift(trashItem);
    localStorage.setItem('kdp_trash_bin', JSON.stringify(filteredTrash.slice(0, 100)));

    // 2. Remove from active projects index & local storage
    localStorage.removeItem(`kdp_project_${id}`);
    const indexRaw = localStorage.getItem('kdp_projects_index');
    if (indexRaw) {
      const idxList = JSON.parse(indexRaw);
      const updatedIdx = idxList.filter((p: any) => p.id !== id);
      localStorage.setItem('kdp_projects_index', JSON.stringify(updatedIdx));
    }

    // 3. Mark in Firestore or delete doc if applicable
    if (!isFirestoreQuotaExceeded && auth.currentUser) {
      try {
        await deleteDoc(doc(db, 'projects', id));
      } catch (e: any) {
        if (e?.code === 'resource-exhausted' || e?.message?.includes('Quota limit exceeded')) {
          isFirestoreQuotaExceeded = true;
        }
      }
    }

    return trashItem;
  } catch (e) {
    console.error("Error moving project to trash:", e);
    return null;
  }
};

export const restoreFromTrash = async (id: string): Promise<ProjectSave | null> => {
  try {
    const trashList = await getTrashList();
    const item = trashList.find(t => t.id === id);
    if (!item || !item.data) return null;

    const restoredProject = item.data;
    restoredProject.updatedAt = Date.now();

    // 1. Remove from Trash Bin
    const remainingTrash = trashList.filter(t => t.id !== id);
    localStorage.setItem('kdp_trash_bin', JSON.stringify(remainingTrash));

    // 2. Save back to active LocalStorage & Firestore
    await saveProject(restoredProject);

    return restoredProject;
  } catch (e) {
    console.error("Error restoring project from trash:", e);
    return null;
  }
};

export const permanentlyDeleteFromTrash = async (id: string) => {
  try {
    const trashList = await getTrashList();
    const remaining = trashList.filter(t => t.id !== id);
    localStorage.setItem('kdp_trash_bin', JSON.stringify(remaining));

    localStorage.removeItem(`kdp_project_${id}`);
    localStorage.removeItem(`kdp_emergency_${id}`);

    if (!isFirestoreQuotaExceeded && auth.currentUser) {
      try {
        await deleteDoc(doc(db, 'projects', id));
      } catch (e) {}
    }
  } catch (e) {
    console.error("Error permanently deleting project:", e);
  }
};

export const emptyTrash = async () => {
  try {
    const trashList = await getTrashList();
    trashList.forEach(t => {
      localStorage.removeItem(`kdp_project_${t.id}`);
      localStorage.removeItem(`kdp_emergency_${t.id}`);
    });
    localStorage.removeItem('kdp_trash_bin');
  } catch (e) {
    console.error("Error emptying trash:", e);
  }
};

export const getProjectsList = async (): Promise<any[]> => {
  let localList: any[] = [];
  const trashIds = getTrashSet();

  try {
    const raw = localStorage.getItem('kdp_projects_index');
    if (raw) localList = JSON.parse(raw);

    // Auto-discover any orphaned project keys in LocalStorage and add them to the index ONLY IF THEY HAVE REAL CONTENT
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('kdp_project_') && key !== 'kdp_projects_index') {
        try {
          const itemRaw = localStorage.getItem(key);
          if (itemRaw) {
            const p = JSON.parse(itemRaw);
            if (p && p.id && !trashIds.has(p.id)) {
              if (hasProjectContent(p)) {
                const exists = localList.some((x: any) => x.id === p.id);
                if (!exists) {
                  localList.push({
                    id: p.id,
                    title: p.title || p.bookDetails?.title || 'Untitled Book',
                    updatedAt: p.updatedAt || Date.now(),
                    category: p.category || 'non_fiction',
                    idea: p.idea || ''
                  });
                }
              } else {
                // Prune 0-content empty ghost file from storage so it doesn't clutter
                localStorage.removeItem(key);
              }
            }
          }
        } catch (e) {}
      }
    }

    // Filter out trashed items and ghost items
    localList = localList.filter((p: any) => {
      if (!p || !p.id || trashIds.has(p.id)) return false;
      const rawItem = localStorage.getItem(`kdp_project_${p.id}`);
      if (rawItem) {
        try {
          const parsed = JSON.parse(rawItem);
          return hasProjectContent(parsed);
        } catch (e) {
          return true;
        }
      }
      return true;
    });

    localStorage.setItem('kdp_projects_index', JSON.stringify(localList));
  } catch (e) {
    console.warn("LocalStorage read error:", e);
  }

  if (isFirestoreQuotaExceeded || !auth.currentUser) {
    return [...localList].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  try {
    const q = query(collection(db, 'projects'), where('ownerId', '==', auth.currentUser.uid));
    const qs = await getDocs(q);
    const remoteList = qs.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Merge remote with local, excluding trashed
    const map = new Map<string, any>();
    localList.forEach(p => {
      if (!trashIds.has(p.id)) map.set(p.id, p);
    });
    
    remoteList.forEach((p: any) => {
      if (trashIds.has(p.id)) return;
      const existing = map.get(p.id);
      if (!existing || (p.updatedAt && p.updatedAt > existing.updatedAt)) {
        map.set(p.id, p);
      }
    });

    return Array.from(map.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch (e: any) {
    if (e?.code === 'resource-exhausted' || e?.message?.includes('Quota limit exceeded')) {
      isFirestoreQuotaExceeded = true;
      console.warn("Firestore quota limit exceeded. Switching to LocalStorage mode.");
    } else {
      console.warn("Failed to fetch remote projects list:", e);
    }
    return [...localList].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }
};

export const saveProject = async (project: ProjectSave) => {
  // Always save to LocalStorage immediately
  try {
    localStorage.setItem(`kdp_project_${project.id}`, JSON.stringify(project));
    updateLocalStorageIndex({
      id: project.id,
      title: project.title,
      updatedAt: project.updatedAt || Date.now(),
      category: project.category,
      idea: project.idea
    });
  } catch (e) {
    console.warn("LocalStorage save failed:", e);
  }

  if (isFirestoreQuotaExceeded || !auth.currentUser) return;

  try {
    const docRef = doc(db, 'projects', project.id);
    
    const projData = {
      ownerId: auth.currentUser.uid,
      title: project.title || 'Untitled Book',
      updatedAt: project.updatedAt || Date.now(),
      idea: project.idea || '',
      category: project.category || 'non_fiction',
      research: project.research ? JSON.stringify(project.research) : "null",
      outline: project.outline || '',
      bookDetails: project.bookDetails ? JSON.stringify(project.bookDetails) : "null",
      assets: project.assets ? JSON.stringify(project.assets) : "null",
      continuityMemory: project.continuityMemory ? JSON.stringify(project.continuityMemory) : "null",
      characterBible: project.characterBible ? JSON.stringify(project.characterBible) : "null",
      chapterIllustrations: project.chapterIllustrations ? JSON.stringify(project.chapterIllustrations) : "null"
    };

    await setDoc(docRef, projData, { merge: true });

    // Handle chapters independently in subcollections
    if (Array.isArray(project.chapters)) {
      for (const chap of project.chapters) {
         const chapRef = doc(db, 'projects', project.id, 'chapters', chap.id);
         await setDoc(chapRef, {
             projectId: project.id,
             ownerId: auth.currentUser.uid,
             title: chap.title || '',
             content: chap.content || '',
             status: chap.status || 'pending',
             order: project.chapters.indexOf(chap)
         }, { merge: true });
      }
    }

    // Handle chats independently
    if (project.chats) {
        for (const [targetId, messages] of Object.entries(project.chats)) {
            const chatRef = doc(db, 'projects', project.id, 'chats', targetId);
            await setDoc(chatRef, {
                projectId: project.id,
                ownerId: auth.currentUser.uid,
                targetId: targetId,
                messages: JSON.stringify(messages)
            }, { merge: true });
        }
    }
  } catch(e: any) {
    if (e?.code === 'resource-exhausted' || e?.message?.includes('Quota limit exceeded')) {
      isFirestoreQuotaExceeded = true;
      console.warn("Firestore save failed due to quota limit. Falling back to LocalStorage.");
    } else {
      console.warn("Firestore save failed:", e);
    }
  }
};

export const loadProject = async (id: string): Promise<ProjectSave | null> => {
  let localData: ProjectSave | null = null;
  try {
    const raw = localStorage.getItem(`kdp_project_${id}`);
    if (raw) localData = JSON.parse(raw);
  } catch (e) {
    console.warn("LocalStorage load error:", e);
  }

  if (isFirestoreQuotaExceeded || !auth.currentUser) {
    return localData;
  }

  try {
    const pjRef = doc(db, 'projects', id);
    const pjSnap = await getDoc(pjRef);
    if (!pjSnap.exists()) return localData;

    const proj = pjSnap.data() as any;

    // Load chapters
    const chQ = query(collection(db, 'projects', id, 'chapters'), where('ownerId', '==', auth.currentUser.uid));
    const chSnap = await getDocs(chQ);
    const chapters = chSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => a.order - b.order);

    // Load chats
    const ctQ = query(collection(db, 'projects', id, 'chats'), where('ownerId', '==', auth.currentUser.uid));
    const ctSnap = await getDocs(ctQ);
    const chats: any = {};
    ctSnap.forEach(d => {
        try {
          chats[d.data().targetId] = JSON.parse(d.data().messages);
        } catch (err) {}
    });

    const remoteProj: ProjectSave = {
        id,
        title: proj.title,
        updatedAt: proj.updatedAt,
        item_idea: proj.idea,
        idea: proj.idea,
        category: proj.category,
        research: proj.research && proj.research !== "null" ? JSON.parse(proj.research) : null,
        outline: proj.outline,
        bookDetails: proj.bookDetails && proj.bookDetails !== "null" ? JSON.parse(proj.bookDetails) : null,
        assets: proj.assets && proj.assets !== "null" ? JSON.parse(proj.assets) : {},
        continuityMemory: proj.continuityMemory && proj.continuityMemory !== "null" ? JSON.parse(proj.continuityMemory) : undefined,
        characterBible: proj.characterBible && proj.characterBible !== "null" ? JSON.parse(proj.characterBible) : undefined,
        chapterIllustrations: proj.chapterIllustrations && proj.chapterIllustrations !== "null" ? JSON.parse(proj.chapterIllustrations) : undefined,
        chapters: chapters.map((c: any) => ({
            id: c.id,
            title: c.title,
            content: c.content,
            status: c.status
        })),
        chats
    };

    if (localData && localData.updatedAt && localData.updatedAt > (remoteProj.updatedAt || 0)) {
      return localData;
    }

    return remoteProj;
  } catch(e: any) {
    if (e?.code === 'resource-exhausted' || e?.message?.includes('Quota limit exceeded')) {
      isFirestoreQuotaExceeded = true;
      console.warn("Firestore load failed due to quota limit. Using LocalStorage project copy.");
    } else {
      console.warn("Load failed:", e);
    }
    return localData;
  }
};

export const deleteProject = async (id: string, permanent: boolean = false) => {
  if (!permanent) {
    return await moveToTrash(id);
  }
  return await permanentlyDeleteFromTrash(id);
};

export const getUserSettings = async () => {
    let localConf = null;
    try {
      const raw = localStorage.getItem('kdp_user_settings');
      if (raw) localConf = JSON.parse(raw);
    } catch (e) {}

    if (isFirestoreQuotaExceeded || !auth.currentUser) return localConf;

    try {
        const sRef = doc(db, 'users', auth.currentUser.uid, 'settings', 'config');
        const snap = await getDoc(sRef);
        return snap.exists() ? snap.data() : localConf;
    } catch (e: any) {
        if (e?.code === 'resource-exhausted' || e?.message?.includes('Quota limit exceeded')) {
          isFirestoreQuotaExceeded = true;
        }
        return localConf;
    }
};

export const saveUserSettings = async (data: any) => {
    try {
      localStorage.setItem('kdp_user_settings', JSON.stringify(data));
    } catch (e) {}

    if (isFirestoreQuotaExceeded || !auth.currentUser) return;

    try {
      const sRef = doc(db, 'users', auth.currentUser.uid, 'settings', 'config');
      await setDoc(sRef, data, { merge: true });
    } catch (e: any) {
      if (e?.code === 'resource-exhausted' || e?.message?.includes('Quota limit exceeded')) {
        isFirestoreQuotaExceeded = true;
      }
    }
};

export const saveEmergencySnapshot = (projectData: any) => {
  try {
    if (!projectData) return;
    const key = `kdp_emergency_${projectData.id || 'current'}`;
    const snap = {
      ...projectData,
      emergencyTimestamp: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(snap));
  } catch (e) {
    console.warn("Emergency snapshot save failed:", e);
  }
};

export const scanAllLocalBackups = (): Array<{ id: string; key: string; title: string; updatedAt: number; chapterCount: number; wordCount: number; data: any }> => {
  const results: Array<{ id: string; key: string; title: string; updatedAt: number; chapterCount: number; wordCount: number; data: any }> = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      if (key.startsWith('kdp_project_') || key.startsWith('kdp_emergency_') || key.startsWith('kdp_backup_')) {
        if (key === 'kdp_projects_index') continue;

        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          if (!parsed) continue;

          const chaps = Array.isArray(parsed.chapters) ? parsed.chapters : [];
          let wordCount = 0;
          chaps.forEach((c: any) => {
            if (c?.content) wordCount += c.content.trim().split(/\s+/).filter(Boolean).length;
          });

          const title = parsed.title || parsed.bookDetails?.title || 'Untitled Manuscript';
          const updatedAt = parsed.updatedAt || parsed.emergencyTimestamp || Date.now();
          const id = parsed.id || key;

          results.push({
            id,
            key,
            title,
            updatedAt,
            chapterCount: chaps.length,
            wordCount,
            data: parsed
          });
        } catch (err) {}
      }
    }
  } catch (e) {
    console.warn("Error scanning LocalStorage backups:", e);
  }

  return results.sort((a, b) => b.updatedAt - a.updatedAt);
};

export interface PublishedLandingData {
  id: string;
  projectId?: string;
  updatedAt: number;
  bookDetails: any;
  landingCopyData: any;
  coverUrl?: string;
  sampleChapterText?: string;
}

export const savePublishedLandingPage = async (data: PublishedLandingData) => {
  try {
    localStorage.setItem(`kdp_published_landing_${data.id}`, JSON.stringify(data));
  } catch (e) {
    console.warn("LocalStorage published landing save failed:", e);
  }

  if (isFirestoreQuotaExceeded) return;

  try {
    const docRef = doc(db, 'published_landings', data.id);
    await setDoc(docRef, {
      ...data,
      bookDetails: data.bookDetails ? JSON.stringify(data.bookDetails) : "null",
      landingCopyData: data.landingCopyData ? JSON.stringify(data.landingCopyData) : "null"
    }, { merge: true });
  } catch (e: any) {
    if (e?.code === 'resource-exhausted' || e?.message?.includes('Quota limit exceeded')) {
      isFirestoreQuotaExceeded = true;
    }
    console.warn("Firestore published landing save error:", e);
  }
};

export const getPublishedLandingPage = async (id: string): Promise<PublishedLandingData | null> => {
  let localData: PublishedLandingData | null = null;
  try {
    const raw = localStorage.getItem(`kdp_published_landing_${id}`);
    if (raw) localData = JSON.parse(raw);
  } catch (e) {}

  if (isFirestoreQuotaExceeded) return localData;

  try {
    const docRef = doc(db, 'published_landings', id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return localData;

    const rawData = snap.data() as any;
    return {
      id: rawData.id || id,
      projectId: rawData.projectId,
      updatedAt: rawData.updatedAt || Date.now(),
      coverUrl: rawData.coverUrl,
      sampleChapterText: rawData.sampleChapterText,
      bookDetails: rawData.bookDetails && rawData.bookDetails !== "null" ? JSON.parse(rawData.bookDetails) : rawData.bookDetails,
      landingCopyData: rawData.landingCopyData && rawData.landingCopyData !== "null" ? JSON.parse(rawData.landingCopyData) : rawData.landingCopyData
    };
  } catch (e) {
    return localData;
  }
};

export const deletePublishedLandingPage = async (id: string) => {
  try {
    localStorage.removeItem(`kdp_published_landing_${id}`);
  } catch (e) {}

  if (isFirestoreQuotaExceeded) return;

  try {
    await deleteDoc(doc(db, 'published_landings', id));
  } catch (e) {}
};

