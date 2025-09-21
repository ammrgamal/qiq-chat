import { userStorage, quotationStorage, activityStorage } from '../storage/quotations.js';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Admin authentication middleware
export function requireAdminAuth(req, res, next) {
  const adminToken = req.headers.authorization?.replace('Bearer ', '');
  
  if (!adminToken || adminToken !== 'admin-session') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
}

// Admin login
export async function adminLogin(req, res) {
  try {
    const { password } = req.body;
    
    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    
    // Log admin login activity
    await activityStorage.log({
      userEmail: 'admin',
      action: 'admin_login',
      details: { ip: req.ip, userAgent: req.get('User-Agent') }
    });
    
    res.json({ 
      success: true, 
      token: 'admin-session',
      message: 'Admin authenticated successfully' 
    });
    
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Get all users
export async function getUsers(req, res) {
  try {
    const allUsers = await userStorage.getAll();
    
    // Transform user data for admin view
    const usersData = Object.entries(allUsers).map(([email, user]) => ({
      id: email,
      email: email,
      company: user.company || '',
      phone: user.phone || '',
      createdAt: user.createdAt || new Date().toISOString(),
      lastActive: user.lastActive || '',
      verified: user.verified || false,
      quotationsCount: 0 // Will be calculated
    }));
    
    // Calculate quotations count for each user
    const allQuotations = await quotationStorage.getAll();
    Object.values(allQuotations).forEach(quotation => {
      const user = usersData.find(u => u.email === quotation.userEmail);
      if (user) {
        user.quotationsCount++;
      }
    });
    
    res.json(usersData);
    
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}

// Get all quotations
export async function getQuotations(req, res) {
  try {
    const allQuotations = await quotationStorage.getAll();
    
    // Transform quotations data for admin view
    const quotationsData = allQuotations.map(quotation => ({
      id: quotation.id,
      userEmail: quotation.userEmail || '',
      clientName: quotation.clientName || '',
      clientCompany: quotation.clientCompany || '',
      clientPhone: quotation.clientPhone || '',
      date: quotation.createdAt ? quotation.createdAt.split('T')[0] : '',
      total: quotation.grandTotal || '',
      status: quotation.status || 'مكتمل',
      itemsCount: quotation.items ? quotation.items.length : 0,
      hasInstallation: quotation.installationFee && quotation.installationFee > 0
    }));
    
    // Sort by date descending
    quotationsData.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    res.json(quotationsData);
    
  } catch (error) {
    console.error('Get quotations error:', error);
    res.status(500).json({ error: 'Failed to fetch quotations' });
  }
}

// Get activity logs
export async function getActivity(req, res) {
  try {
    const allActivity = await activityStorage.getAll();
    
    // Sort by timestamp descending (most recent first)
    const activityData = allActivity.sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );
    
    // Limit to last 1000 entries to prevent excessive data
    const limitedActivity = activityData.slice(0, 1000);
    
    res.json(limitedActivity);
    
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
}

// Get dashboard statistics
export async function getDashboardStats(req, res) {
  try {
    const [allUsers, allQuotations, allActivity] = await Promise.all([
      userStorage.getAll(),
      quotationStorage.getAll(),
      activityStorage.getAll()
    ]);
    
    const userEmails = Object.keys(allUsers);
    const quotations = Array.isArray(allQuotations) ? allQuotations : [];
    
    // Calculate today's quotations
    const today = new Date().toISOString().split('T')[0];
    const todayQuotations = quotations.filter(q => 
      q.createdAt && q.createdAt.startsWith(today)
    );
    
    // Calculate active users (last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeUsers = Object.values(allUsers).filter(u => 
      u.lastActive && new Date(u.lastActive) > weekAgo
    );
    
    // Calculate total revenue (approximate from quotations)
    const totalRevenue = quotations.reduce((sum, q) => {
      if (q.grandTotal && typeof q.grandTotal === 'string') {
        const amount = parseFloat(q.grandTotal.replace(/[^0-9.-]/g, ''));
        return sum + (isNaN(amount) ? 0 : amount);
      }
      return sum;
    }, 0);
    
    const stats = {
      totalUsers: userEmails.length,
      totalQuotations: quotations.length,
      todayQuotations: todayQuotations.length,
      activeUsers: activeUsers.length,
      totalRevenue: totalRevenue,
      verifiedUsers: Object.values(allUsers).filter(u => u.verified).length,
      recentActivity: allActivity.slice(0, 10)
    };
    
    res.json(stats);
    
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
}

// Delete user
export async function deleteUser(req, res) {
  try {
    const email = req.query.email || req.params.email;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Delete user from storage
    const users = await userStorage.getAll();
    if (!(email in users)) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    delete users[email];
    await userStorage.save(email, null); // This will delete the user
    
    // Log deletion activity
    await activityStorage.log({
      userEmail: 'admin',
      action: 'user_delete',
      details: { deletedUser: email }
    });
    
    res.json({ success: true, message: 'User deleted successfully' });
    
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
}

// Delete quotation
export async function deleteQuotation(req, res) {
  try {
    const id = req.query.id || req.params.id;
    
    if (!id) {
      return res.status(400).json({ error: 'Quotation ID is required' });
    }
    
    // Delete quotation using the storage method
    const success = await quotationStorage.deleteById(id);
    
    if (!success) {
      return res.status(404).json({ error: 'Quotation not found' });
    }
    
    // Log deletion activity
    await activityStorage.log({
      userEmail: 'admin',
      action: 'quotation_delete',
      details: { deletedQuotation: id }
    });
    
    res.json({ success: true, message: 'Quotation deleted successfully' });
    
  } catch (error) {
    console.error('Delete quotation error:', error);
    res.status(500).json({ error: 'Failed to delete quotation' });
  }
}

// Get specific quotation details
export async function getQuotationDetails(req, res) {
  try {
    const { id } = req.params;
    
    const quotation = await quotationStorage.get(id);
    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found' });
    }
    
    res.json(quotation);
    
  } catch (error) {
    console.error('Get quotation details error:', error);
    res.status(500).json({ error: 'Failed to fetch quotation details' });
  }
}