import { requireAdminAuth, getActivity } from './admin.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Check admin authentication
  requireAdminAuth(req, res, () => {
    return getActivity(req, res);
  });
}