// Simple file-based storage for quotations using Vercel's filesystem
// In production, you'd use a proper database like Vercel KV, Supabase, or similar

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use temp directory in production (Vercel's /tmp is writeable)
const STORAGE_DIR = process.env.NODE_ENV === 'production' 
  ? '/tmp/qiq-storage' 
  : path.join(__dirname, '../../.storage');

const QUOTATIONS_FILE = path.join(STORAGE_DIR, 'quotations.json');
const USERS_FILE = path.join(STORAGE_DIR, 'users.json');
const ACTIVITY_FILE = path.join(STORAGE_DIR, 'activity.json');

// Ensure storage directory exists
async function ensureStorageDir() {
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      console.warn('Failed to create storage directory:', error);
    }
  }
}

// Read JSON file with fallback to empty structure
async function readJSONFile(filePath, defaultValue = {}) {
  try {
    await ensureStorageDir();
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return default
      return defaultValue;
    }
    console.warn(`Error reading ${filePath}:`, error);
    return defaultValue;
  }
}

// Write JSON file
async function writeJSONFile(filePath, data) {
  try {
    await ensureStorageDir();
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error);
    return false;
  }
}

// Quotations storage
export const quotationStorage = {
  async getAll() {
    const data = await readJSONFile(QUOTATIONS_FILE, { quotations: [] });
    return data.quotations || [];
  },

  async getByUser(userToken) {
    const all = await this.getAll();
    return all.filter(q => q.userToken === userToken);
  },

  async save(quotation) {
    const all = await this.getAll();
    const id = quotation.id || `Q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    const newQuotation = {
      ...quotation,
      id,
      savedAt: new Date().toISOString(),
      lastModified: new Date().toISOString()
    };

    // Check if exists and update, otherwise add
    const existingIndex = all.findIndex(q => q.id === id);
    if (existingIndex >= 0) {
      const prev = all[existingIndex];
      // Preserve and append history if payload changed
      let history = Array.isArray(prev.history) ? prev.history : [];
      const payloadChanged = JSON.stringify(prev.payload||null) !== JSON.stringify(newQuotation.payload||null);
      if (payloadChanged) {
        history.unshift({
          ts: new Date().toISOString(),
            payload: prev.payload,
            status: prev.status,
            total: prev.total,
            revision: prev.revision || 1
        });
        // Trim history size (keep last 20 revisions)
        if (history.length > 20) history.length = 20;
      }
      all[existingIndex] = { ...prev, ...newQuotation, history, revision: (prev.revision||1) + (payloadChanged ? 1 : 0) };
    } else {
      all.unshift({ ...newQuotation, revision: 1, history: [] });
    }

    const success = await writeJSONFile(QUOTATIONS_FILE, { quotations: all });
    return success ? newQuotation : null;
  },

  async getById(id) {
    const all = await this.getAll();
    return all.find(q => q.id === id);
  },

  async replace(updated) {
    if (!updated || !updated.id) return null;
    const all = await this.getAll();
    const idx = all.findIndex(q => q.id === updated.id);
    if (idx === -1) return null;
    all[idx] = { ...updated, lastModified: new Date().toISOString() };
    const success = await writeJSONFile(QUOTATIONS_FILE, { quotations: all });
    return success ? all[idx] : null;
  },

  async deleteById(id) {
    const all = await this.getAll();
    const filtered = all.filter(q => q.id !== id);
    return await writeJSONFile(QUOTATIONS_FILE, { quotations: filtered });
  }
};

// Users storage (for admin dashboard)
export const userStorage = {
  async getAll() {
    const data = await readJSONFile(USERS_FILE, { users: [] });
    return data.users || [];
  },

  async save(user) {
    const all = await this.getAll();
    const existing = all.find(u => u.email === user.email);
    
    if (existing) {
      Object.assign(existing, user, { lastActive: new Date().toISOString() });
    } else {
      all.push({ ...user, createdAt: new Date().toISOString(), lastActive: new Date().toISOString() });
    }

    return await writeJSONFile(USERS_FILE, { users: all });
  },

  async getByEmail(email) {
    const all = await this.getAll();
    return all.find(u => u.email === email);
  }
};

// Activity logs storage
export const activityStorage = {
  async log(activity) {
    const data = await readJSONFile(ACTIVITY_FILE, { activities: [] });
    const activities = data.activities || [];
    
    activities.unshift({
      ...activity,
      timestamp: new Date().toISOString(),
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    });

    // Keep only last 1000 activities to prevent file from growing too large
    if (activities.length > 1000) {
      activities.length = 1000;
    }

    return await writeJSONFile(ACTIVITY_FILE, { activities });
  },

  async getRecent(limit = 100) {
    const data = await readJSONFile(ACTIVITY_FILE, { activities: [] });
    const activities = data.activities || [];
    return activities.slice(0, limit);
  },

  async getByUser(userEmail, limit = 50) {
    const activities = await this.getRecent(500); // Get more to filter
    return activities
      .filter(a => a.userEmail === userEmail)
      .slice(0, limit);
  }
};

// Initialize storage on import
ensureStorageDir().catch(console.warn);