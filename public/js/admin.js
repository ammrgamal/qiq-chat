// Admin dashboard functionality
(function() {
  'use strict';

  let isAdminAuthenticated = false;
  let adminToken = null;

  // DOM elements
  const loginModal = document.getElementById('admin-login-modal');
  const loginForm = document.getElementById('admin-login-form');
  const loginError = document.getElementById('admin-login-error');
  const logoutBtn = document.getElementById('btn-logout');

  // Initialize
  init();

  function init() {
    // Check if already authenticated
    const savedToken = sessionStorage.getItem('qiq_admin_token');
    if (savedToken) {
      adminToken = savedToken;
      isAdminAuthenticated = true;
      hideLoginModal();
      loadDashboard();
    }

    // Setup event listeners
    setupEventListeners();
  }

  function setupEventListeners() {
    // Login form
    loginForm.addEventListener('submit', handleAdminLogin);
    
    // Logout button
    logoutBtn.addEventListener('click', handleLogout);
    
    // Tab navigation
    document.querySelectorAll('.tab-link').forEach(link => {
      link.addEventListener('click', handleTabClick);
    });

    // Search and filter inputs
    setupFilters();
  }

  function setupFilters() {
    // Users filters
    const usersSearch = document.getElementById('users-search');
    const usersStatus = document.getElementById('users-status');
    if (usersSearch) usersSearch.addEventListener('input', () => filterTable('users'));
    if (usersStatus) usersStatus.addEventListener('change', () => filterTable('users'));

    // Quotations filters
    const quotationsSearch = document.getElementById('quotations-search');
    const quotationsStatus = document.getElementById('quotations-status');
    const quotationsDate = document.getElementById('quotations-date');
    if (quotationsSearch) quotationsSearch.addEventListener('input', () => filterTable('quotations'));
    if (quotationsStatus) quotationsStatus.addEventListener('change', () => filterTable('quotations'));
    if (quotationsDate) quotationsDate.addEventListener('change', () => filterTable('quotations'));

    // Activity filters
    const activitySearch = document.getElementById('activity-search');
    const activityAction = document.getElementById('activity-action');
    const activityDate = document.getElementById('activity-date');
    if (activitySearch) activitySearch.addEventListener('input', () => filterTable('activity'));
    if (activityAction) activityAction.addEventListener('change', () => filterTable('activity'));
    if (activityDate) activityDate.addEventListener('change', () => filterTable('activity'));
  }

  async function handleAdminLogin(e) {
    e.preventDefault();
    const password = document.getElementById('admin-password').value;
    
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        adminToken = data.token;
        isAdminAuthenticated = true;
        sessionStorage.setItem('qiq_admin_token', adminToken);
        hideLoginModal();
        loadDashboard();
        loginError.textContent = '';
      } else {
        loginError.textContent = data.error || 'خطأ في تسجيل الدخول';
      }
    } catch (error) {
      console.error('Login error:', error);
      loginError.textContent = 'خطأ في الاتصال بالخادم';
    }
  }

  function handleLogout() {
    isAdminAuthenticated = false;
    adminToken = null;
    sessionStorage.removeItem('qiq_admin_token');
    showLoginModal();
  }

  function handleTabClick(e) {
    e.preventDefault();
    const target = e.target.getAttribute('href').substring(1);
    
    // Update active tab
    document.querySelectorAll('.tab-link').forEach(link => link.classList.remove('active'));
    e.target.classList.add('active');
    
    // Show corresponding content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(target).classList.add('active');
    
    // Load data for the selected tab
    switch(target) {
      case 'dashboard':
        loadDashboard();
        break;
      case 'users':
        loadUsers();
        break;
      case 'quotations':
        loadQuotations();
        break;
      case 'activity':
        loadActivity();
        break;
    }
  }

  function showLoginModal() {
    loginModal.style.display = 'flex';
  }

  function hideLoginModal() {
    loginModal.style.display = 'none';
  }

  async function loadDashboard() {
    if (!isAdminAuthenticated) return;
    
    try {
      // Load stats from backend
      const stats = await fetchData('/api/admin/stats');
      
      // Update stats
      document.getElementById('stat-users').textContent = stats.totalUsers || 0;
      document.getElementById('stat-quotations').textContent = stats.totalQuotations || 0;
      document.getElementById('stat-today').textContent = stats.todayQuotations || 0;
      document.getElementById('stat-active').textContent = stats.activeUsers || 0;
      
      // Show recent activity
      displayRecentActivity(stats.recentActivity || []);
      
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  }

  async function loadUsers() {
    if (!isAdminAuthenticated) return;
    
    try {
      const users = await fetchData('/api/admin/users');
      displayUsers(users);
    } catch (error) {
      console.error('Error loading users:', error);
      document.getElementById('users-tbody').innerHTML = '<tr><td colspan="7">خطأ في تحميل البيانات</td></tr>';
    }
  }

  async function loadQuotations() {
    if (!isAdminAuthenticated) return;
    
    try {
      const quotations = await fetchData('/api/admin/quotations');
      displayQuotations(quotations);
    } catch (error) {
      console.error('Error loading quotations:', error);
      document.getElementById('quotations-tbody').innerHTML = '<tr><td colspan="7">خطأ في تحميل البيانات</td></tr>';
    }
  }

  async function loadActivity() {
    if (!isAdminAuthenticated) return;
    
    try {
      const activity = await fetchData('/api/admin/activity');
      displayActivity(activity);
    } catch (error) {
      console.error('Error loading activity:', error);
      document.getElementById('activity-tbody').innerHTML = '<tr><td colspan="4">خطأ في تحميل البيانات</td></tr>';
    }
  }

  async function fetchData(url) {
    if (!adminToken) {
      throw new Error('No admin token available');
    }
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        // Token expired or invalid, logout
        handleLogout();
        throw new Error('Authentication expired');
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  }

  function displayUsers(users) {
    const tbody = document.getElementById('users-tbody');
    window.allUsers = users; // Store for filtering
    
    tbody.innerHTML = users.map(user => `
      <tr>
        <td>${user.company || '-'}</td>
        <td>${user.email}</td>
        <td>${user.phone || '-'}</td>
        <td>${formatDate(user.createdAt)}</td>
        <td>${formatDate(user.lastActive)}</td>
        <td><span class="status-chip ${user.verified ? 'status-active' : 'status-inactive'}">${user.verified ? 'متحقق' : 'غير متحقق'}</span></td>
        <td>
          <button class="btn-admin" onclick="viewUserDetails('${user.email}')">تفاصيل</button>
          <button class="btn-admin btn-danger" onclick="deleteUser('${user.email}')">حذف</button>
        </td>
      </tr>
    `).join('');
  }

  function displayQuotations(quotations) {
    const tbody = document.getElementById('quotations-tbody');
    window.allQuotations = quotations; // Store for filtering
    
    tbody.innerHTML = quotations.map(quotation => `
      <tr>
        <td><strong>${quotation.id}</strong></td>
        <td>${quotation.clientName || '-'}</td>
        <td>${quotation.userEmail}</td>
        <td>${formatDate(quotation.date)}</td>
        <td>${quotation.total}</td>
        <td><span class="status-chip">${quotation.status}</span></td>
        <td>
          <button class="btn-admin" onclick="viewQuotationDetails('${quotation.id}')">تفاصيل</button>
          <button class="btn-admin btn-danger" onclick="deleteQuotation('${quotation.id}')">حذف</button>
        </td>
      </tr>
    `).join('');
  }

  function displayActivity(activities) {
    const tbody = document.getElementById('activity-tbody');
    window.allActivities = activities; // Store for filtering
    
    tbody.innerHTML = activities.map(activity => `
      <tr>
        <td>${formatDateTime(activity.timestamp)}</td>
        <td>${activity.userEmail}</td>
        <td>${getActionLabel(activity.action)}</td>
        <td>${formatActivityDetails(activity.details)}</td>
      </tr>
    `).join('');
  }

  function displayRecentActivity(activities) {
    const container = document.getElementById('recent-activity');
    
    if (!activities || activities.length === 0) {
      container.innerHTML = '<p style="color:#6b7280">لا توجد نشاطات حديثة</p>';
      return;
    }
    
    container.innerHTML = activities.map(activity => `
      <div style="padding:8px 0;border-bottom:1px solid #f3f4f6">
        <div style="font-weight:500">${getActionLabel(activity.action)} - ${activity.userEmail}</div>
        <div style="font-size:12px;color:#6b7280">${formatDateTime(activity.timestamp)}</div>
      </div>
    `).join('');
  }

  function filterTable(type) {
    // This would implement filtering logic for each table type
    console.log(`Filtering ${type} table`);
  }

  function formatDate(dateString) {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('ar-EG');
    } catch {
      return dateString;
    }
  }

  function formatDateTime(dateString) {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleString('ar-EG');
    } catch {
      return dateString;
    }
  }

  function getActionLabel(action) {
    const labels = {
      'quotation_save': 'حفظ عرض سعر',
      'quotations_view': 'عرض العروض',
      'user_login': 'تسجيل دخول',
      'user_register': 'تسجيل جديد'
    };
    return labels[action] || action;
  }

  function formatActivityDetails(details) {
    if (!details) return '-';
    if (typeof details === 'string') return details;
    return Object.entries(details).map(([key, value]) => `${key}: ${value}`).join(', ');
  }

  // Global functions for actions
  window.viewUserDetails = function(email) {
    alert(`عرض تفاصيل المستخدم: ${email}`);
  };

  window.deleteUser = async function(email) {
    if (confirm(`هل أنت متأكد من حذف المستخدم: ${email}؟`)) {
      try {
        const response = await fetch(`/api/admin/delete-user?email=${encodeURIComponent(email)}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          alert('تم حذف المستخدم بنجاح');
          loadUsers(); // Refresh the users list
        } else {
          const error = await response.json();
          alert('خطأ في حذف المستخدم: ' + error.error);
        }
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('خطأ في الاتصال بالخادم');
      }
    }
  };

  window.viewQuotationDetails = function(id) {
    alert(`عرض تفاصيل العرض: ${id}`);
  };

  window.deleteQuotation = async function(id) {
    if (confirm(`هل أنت متأكد من حذف العرض: ${id}؟`)) {
      try {
        const response = await fetch(`/api/admin/delete-quotation?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          alert('تم حذف العرض بنجاح');
          loadQuotations(); // Refresh the quotations list
        } else {
          const error = await response.json();
          alert('خطأ في حذف العرض: ' + error.error);
        }
      } catch (error) {
        console.error('Error deleting quotation:', error);
        alert('خطأ في الاتصال بالخادم');
      }
    }
  };

  window.exportUsers = function() {
    exportToCSV(window.allUsers || [], 'users');
  };

  window.exportQuotations = function() {
    exportToCSV(window.allQuotations || [], 'quotations');
  };

  window.exportActivity = function() {
    exportToCSV(window.allActivities || [], 'activity');
  };

  function exportToCSV(data, type) {
    if (!data || data.length === 0) {
      alert('لا توجد بيانات للتصدير');
      return;
    }
    
    const csvContent = convertToCSV(data, type);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${type}-${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function convertToCSV(data, type) {
    if (!data.length) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
      });
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  }

})();