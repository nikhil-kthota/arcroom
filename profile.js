// Check authentication
let currentUser = null;
let userRooms = [];
let userFiles = [];
let roomToDelete = null;
let fileToDelete = null;

// Initialize Supabase
// Initialize Supabase
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Check authentication on load
document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = '/';
    return;
  }

  currentUser = {
    id: session.user.id,
    email: session.user.email
  };

  updateUserInfo();
  updateAuthUI();
  await loadUserData();
});

// Update auth UI based on user state
function updateAuthUI() {
  const authButtons = document.getElementById('authButtons');

  if (currentUser) {
    authButtons.innerHTML = `
      <div class="profile-icon-btn" onclick="toggleProfileDropdown()" onmouseenter="showProfileDropdownOnHover()" onmouseleave="hideProfileDropdownOnHover()">
        <span class="icon-user"></span>
        <div class="profile-dropdown" id="profileDropdown">
          <div class="profile-dropdown-header">
            <div class="profile-dropdown-email">${currentUser.email}</div>
            <div class="profile-dropdown-label">Signed in as</div>
          </div>
          <div class="profile-dropdown-actions">
            <button class="btn btn-ghost" onclick="window.location.href='profile.html'">
              <span class="icon-eye"></span>
              View Profile
            </button>
            <button class="btn btn-ghost" onclick="handleLogout()">
              <span class="icon-logout"></span>
              Logout
            </button>
          </div>
        </div>
      </div>
    `;
  } else {
    authButtons.innerHTML = `
      <button class="btn btn-ghost" onclick="showLoginModal()">Login</button>
    `;
  }
}

// Profile dropdown functions
function toggleProfileDropdown() {
  const dropdown = document.getElementById('profileDropdown');
  if (dropdown) {
    dropdown.classList.toggle('show');
  }
}

function showProfileDropdownOnHover() {
  const dropdown = document.getElementById('profileDropdown');
  if (dropdown) {
    dropdown.classList.add('show');
  }
}

function hideProfileDropdownOnHover() {
  setTimeout(() => {
    const dropdown = document.getElementById('profileDropdown');
    if (dropdown && !dropdown.matches(':hover')) {
      dropdown.classList.remove('show');
    }
  }, 100);
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  const profileBtn = e.target.closest('.profile-icon-btn');
  const dropdown = document.getElementById('profileDropdown');

  if (!profileBtn && dropdown) {
    dropdown.classList.remove('show');
  }
});

// Error display functions
function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.innerHTML = `
    <div class="error-content">
      <span class="error-icon">⚠️</span>
      <span class="error-text">${message}</span>
      <button class="error-close" onclick="this.parentElement.parentElement.remove()">×</button>
    </div>
  `;

  document.body.appendChild(errorDiv);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (errorDiv.parentElement) {
      errorDiv.remove();
    }
  }, 5000);
}

function showSuccess(message) {
  const successDiv = document.createElement('div');
  successDiv.className = 'success-message';
  successDiv.innerHTML = `
    <div class="success-content">
      <span class="success-icon">✅</span>
      <span class="success-text">${message}</span>
      <button class="success-close" onclick="this.parentElement.parentElement.remove()">×</button>
    </div>
  `;

  document.body.appendChild(successDiv);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    if (successDiv.parentElement) {
      successDiv.remove();
    }
  }, 3000);
}

// Update user info display
function updateUserInfo() {
  if (currentUser) {
    document.getElementById('userEmail').textContent = currentUser.email;
  }
}

// Load user data
async function loadUserData() {
  try {
    // Load user's rooms with files
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select(`
        *,
        files (*)
      `)
      .eq('created_by', currentUser.id)
      .order('created_at', { ascending: false });

    if (roomsError) {
      throw new Error(roomsError.message);
    }

    userRooms = rooms || [];

    // Flatten all files from all rooms
    userFiles = [];
    let totalStorage = 0;

    userRooms.forEach(room => {
      room.files.forEach(file => {
        userFiles.push({
          ...file,
          room_name: room.name,
          room_key: room.key,
          uploaded_at: new Date(file.uploaded_at)
        });
        totalStorage += file.size;
      });
    });

    // Update stats
    document.getElementById('totalRooms').textContent = userRooms.length;
    document.getElementById('totalFiles').textContent = userFiles.length;
    document.getElementById('totalStorage').textContent = formatFileSize(totalStorage);

    // Render rooms and files
    renderUserRooms();
    renderUserFiles();
    populateRoomFilter();

  } catch (err) {
    console.error('Load user data error:', err);
    showError('Failed to load user data: ' + err.message);
  }
}

// Render user's rooms
function renderUserRooms() {
  const roomsContainer = document.getElementById('userRooms');

  if (userRooms.length === 0) {
    roomsContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"></div>
        <h3>No rooms yet</h3>
        <p>Create your first room to start sharing files</p>
        <button class="btn btn-primary" onclick="window.location.href='create-room.html'">
          Create Room
        </button>
      </div>
    `;
    return;
  }

  roomsContainer.innerHTML = userRooms.map(room => `
    <div class="room-card">
      <div class="room-header">
        <div class="room-icon"></div>
        <div class="room-info">
          <h3>${room.name}</h3>
          <p class="room-key">Key: ${room.key}</p>
          <p class="room-meta">${room.files.length} files • Created ${new Date(room.created_at).toLocaleDateString()}</p>
        </div>
      </div>
      
      <div class="room-actions">
        <button class="btn btn-ghost btn-sm" onclick="handleViewRoom('${room.key}', '${room.pin}')">
          <span class="icon-eye"></span>
          View
        </button>
        <button class="btn btn-danger btn-sm" onclick="showDeleteRoomModal('${room.id}', '${room.name}')">
          <span class="icon-trash"></span>
          Delete
        </button>
      </div>
    </div>
  `).join('');
}

// Render user's files
function renderUserFiles() {
  const filesContainer = document.getElementById('userFiles');
  const roomFilter = document.getElementById('roomFilter').value;

  let filteredFiles = userFiles;
  if (roomFilter) {
    filteredFiles = userFiles.filter(file => file.room_key === roomFilter);
  }

  if (filteredFiles.length === 0) {
    filesContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"></div>
        <h3>No files yet</h3>
        <p>Upload files to your rooms to see them here</p>
      </div>
    `;
    return;
  }

  filesContainer.innerHTML = filteredFiles.map(file => `
    <div class="file-card">
      <div class="file-header">
        <div class="file-icon ${getFileIconClass(file.type)}"></div>
        <div class="file-info">
          <h4>${file.name}</h4>
          <p class="file-meta">${file.room_name} • ${formatFileSize(file.size)} • ${file.uploaded_at.toLocaleDateString()}</p>
        </div>
      </div>
      
      <div class="file-actions">
        <button class="btn btn-ghost btn-sm" onclick="openInNewTab('${file.url}')">
          <span class="icon-external"></span>
          Open
        </button>
        <button class="btn btn-ghost btn-sm" onclick="downloadFile('${file.url}', '${file.name}')">
          <span class="icon-download"></span>
          Download
        </button>
        <button class="btn btn-danger btn-sm" onclick="showDeleteFileModal('${file.id}', '${file.name}')">
          <span class="icon-trash"></span>
          Delete
        </button>
      </div>
    </div>
  `).join('');
}

// Populate room filter
function populateRoomFilter() {
  const roomFilter = document.getElementById('roomFilter');
  const currentValue = roomFilter.value;

  roomFilter.innerHTML = '<option value="">All Rooms</option>';

  userRooms.forEach(room => {
    const option = document.createElement('option');
    option.value = room.key;
    option.textContent = room.name;
    roomFilter.appendChild(option);
  });

  roomFilter.value = currentValue;
  roomFilter.addEventListener('change', renderUserFiles);
}

// Delete room modal functions
function showDeleteRoomModal(roomId, roomName) {
  roomToDelete = { id: roomId, name: roomName };
  document.getElementById('deleteRoomName').textContent = roomName;
  document.getElementById('deleteRoomModal').classList.add('active');
}

function hideDeleteRoomModal() {
  roomToDelete = null;
  document.getElementById('deleteRoomModal').classList.remove('active');
}

async function confirmDeleteRoom() {
  if (!roomToDelete) return;

  try {
    // Get room info first to delete storage files
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('key')
      .eq('id', roomToDelete.id)
      .single();

    if (roomError) {
      throw new Error(roomError.message);
    }

    // Delete all files in storage for this room
    const { data: files } = await supabase.storage
      .from('room-files')
      .list(room.key);

    if (files && files.length > 0) {
      const filePaths = files.map(file => `${room.key}/${file.name}`);
      await supabase.storage
        .from('room-files')
        .remove(filePaths);
    }

    // Delete room (this will cascade delete files due to foreign key constraints)
    const { error } = await supabase
      .from('rooms')
      .delete()
      .eq('id', roomToDelete.id);

    if (error) {
      throw new Error(error.message);
    }

    showSuccess(`Room "${roomToDelete.name}" deleted successfully`);
    hideDeleteRoomModal();
    await loadUserData(); // Refresh data

  } catch (err) {
    console.error('Delete room error:', err);
    showError('Failed to delete room: ' + err.message);
  }
}

// Delete file modal functions
function showDeleteFileModal(fileId, fileName) {
  fileToDelete = { id: fileId, name: fileName };
  document.getElementById('deleteFileName').textContent = fileName;
  document.getElementById('deleteFileModal').classList.add('active');
}

function hideDeleteFileModal() {
  fileToDelete = null;
  document.getElementById('deleteFileModal').classList.remove('active');
}

async function confirmDeleteFile() {
  if (!fileToDelete) return;

  try {
    // Get file info first
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('url, room_id')
      .eq('id', fileToDelete.id)
      .single();

    if (fileError) {
      throw new Error(fileError.message);
    }

    // Get room key for storage path
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('key')
      .eq('id', file.room_id)
      .single();

    if (roomError) {
      throw new Error(roomError.message);
    }

    // Extract file path from URL
    const url = new URL(file.url);
    const filePath = url.pathname.split('/').slice(-2).join('/'); // Get last two parts (roomKey/filename)

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('room-files')
      .remove([filePath]);

    if (storageError) {
      console.error('Storage deletion error:', storageError);
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('files')
      .delete()
      .eq('id', fileToDelete.id);

    if (dbError) {
      throw new Error(dbError.message);
    }

    showSuccess(`File "${fileToDelete.name}" deleted successfully`);
    hideDeleteFileModal();
    await loadUserData(); // Refresh data

  } catch (err) {
    console.error('Delete file error:', err);
    showError('Failed to delete file: ' + err.message);
  }
}

// Delete account modal functions
function showDeleteAccountModal() {
  document.getElementById('deleteAccountModal').classList.add('active');
}

function hideDeleteAccountModal() {
  document.getElementById('deleteAccountModal').classList.remove('active');
  document.getElementById('confirmDeleteText').value = '';
}

async function confirmDeleteAccount() {
  const confirmText = document.getElementById('confirmDeleteText').value;

  if (confirmText !== 'DELETE') {
    showError('Please type "DELETE" to confirm account deletion');
    return;
  }

  try {
    // First delete all user's files from storage
    for (const room of userRooms) {
      const { data: files } = await supabase.storage
        .from('room-files')
        .list(room.key);

      if (files && files.length > 0) {
        const filePaths = files.map(file => `${room.key}/${file.name}`);
        await supabase.storage
          .from('room-files')
          .remove(filePaths);
      }
    }

    // Call the database function to delete user data
    const { error: dataError } = await supabase.rpc('delete_user_data', {
      user_id: currentUser.id
    });

    if (dataError) {
      throw new Error(dataError.message);
    }

    // Delete the user account from auth
    const { error: authError } = await supabase.auth.signOut();

    if (authError) {
      console.error('Logout error:', authError);
    }

    showSuccess('Account deleted successfully');

    // Redirect to home page after a short delay
    setTimeout(() => {
      window.location.href = '/';
    }, 2000);

  } catch (err) {
    console.error('Delete account error:', err);
    showError('Failed to delete account: ' + err.message);
  }
}

// Utility functions
function getFileIconClass(type) {
  type = type.toLowerCase();
  if (type.includes('image')) return 'icon-image';
  if (type.includes('pdf')) return 'icon-pdf';
  if (type.includes('word') || type.includes('docx')) return 'icon-document';
  if (type.includes('spreadsheet') || type.includes('excel') || type.includes('xlsx')) return 'icon-spreadsheet';
  if (type.includes('presentation') || type.includes('powerpoint') || type.includes('pptx')) return 'icon-presentation';
  return 'icon-file';
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function openInNewTab(url) {
  window.open(url, '_blank');
}

async function downloadFile(url, filename) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch file');

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.style.display = 'none';

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    window.URL.revokeObjectURL(blobUrl);

    showSuccess(`Downloaded: ${filename}`);
  } catch (error) {
    console.error('Download failed:', error);
    showError('Download failed. Opening in new tab instead...');
    window.open(url, '_blank');
  }
}

async function handleLogout() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }

    showSuccess('Logged out successfully');

    // Redirect to home page after a short delay
    setTimeout(() => {
      window.location.href = '/';
    }, 1000);
  } catch (err) {
    console.error('Logout error:', err);
    showError('Failed to logout. Please try again.');
  }
}

// Close modals when clicking outside
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    hideDeleteRoomModal();
    hideDeleteFileModal();
    hideDeleteAccountModal();
  }
});

// Handle view room (sets PIN in session storage)
function handleViewRoom(roomKey, roomPin) {
  sessionStorage.setItem(`room_pin_${roomKey}`, roomPin);
  window.location.href = `room.html?id=${roomKey}`;
}

// Expose functions to window for HTML access
window.handleLogout = handleLogout;
window.toggleProfileDropdown = toggleProfileDropdown;
window.showProfileDropdownOnHover = showProfileDropdownOnHover;
window.hideProfileDropdownOnHover = hideProfileDropdownOnHover;
window.showDeleteRoomModal = showDeleteRoomModal;
window.hideDeleteRoomModal = hideDeleteRoomModal;
window.confirmDeleteRoom = confirmDeleteRoom;
window.showDeleteFileModal = showDeleteFileModal;
window.hideDeleteFileModal = hideDeleteFileModal;
window.confirmDeleteFile = confirmDeleteFile;
window.showDeleteAccountModal = showDeleteAccountModal;
window.hideDeleteAccountModal = hideDeleteAccountModal;
window.confirmDeleteAccount = confirmDeleteAccount;
window.openInNewTab = openInNewTab;
window.downloadFile = downloadFile;
window.handleViewRoom = handleViewRoom;