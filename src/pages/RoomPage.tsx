import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileUpload } from '../components/FileUpload';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { Input } from '../components/ui/Input';
import { getRoomByKey, verifyRoomPin, uploadFilesToRoom, deleteFileFromRoom } from '../services/roomService';
import { Room, FileItem } from '../types';
import { FileIcon, FolderIcon, Link as LinkIcon, Lock, Upload, LogOut, AlertTriangle, User, Download, ExternalLink, Trash2 } from 'lucide-react';
import { FileViewer } from '../components/FileViewer';

export function RoomPage() {
  const { roomKey } = useParams<{ roomKey: string }>();
  const [room, setRoom] = useState<Room | null>(null);
  const [pinVerified, setPinVerified] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [shareUrl, setShareUrl] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    type: 'file';
    id: string;
    name: string;
  } | null>(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const isOwner = room && user && room.createdBy === user.id;
  
  useEffect(() => {
    if (!roomKey) {
      navigate('/');
      return;
    }
    
    const loadRoom = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Check if room exists
        const roomData = await getRoomByKey(roomKey);
        
        if (!roomData) {
          setError('Room not found');
          setLoading(false);
          return;
        }
        
        setRoom(roomData);
        
        // Check if PIN is already verified in this session
        const savedPin = sessionStorage.getItem(`room_pin_${roomKey}`);
        if (savedPin) {
          const isPinValid = await verifyRoomPin(roomKey, savedPin);
          if (isPinValid) {
            setPinVerified(true);
          } else {
            // Clear invalid saved PIN
            sessionStorage.removeItem(`room_pin_${roomKey}`);
          }
        }
        
        setLoading(false);
      } catch (err) {
        setError((err as Error).message || 'Failed to load room');
        setLoading(false);
      }
    };
    
    loadRoom();
  }, [roomKey, navigate]);
  
  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!roomKey) return;
    
    try {
      setVerifyingPin(true);
      setError(null);
      
      // Validate PIN format (4 digits)
      if (!/^\d{4}$/.test(pin)) {
        setError('PIN must be exactly 4 digits');
        return;
      }
      
      // Verify PIN
      const isPinValid = await verifyRoomPin(roomKey, pin);
      
      if (!isPinValid) {
        setError('Invalid PIN');
        return;
      }
      
      // Store PIN in session storage
      sessionStorage.setItem(`room_pin_${roomKey}`, pin);
      
      setPinVerified(true);
    } catch (err) {
      setError((err as Error).message || 'Failed to verify PIN');
    } finally {
      setVerifyingPin(false);
    }
  };
  
  const handleFileUpload = async (files: File[]) => {
    if (!roomKey) return;
    
    try {
      setError(null);
      
      const newFiles = await uploadFilesToRoom(roomKey, files);
      
      if (room) {
        // Refresh room data to get updated files
        const updatedRoom = await getRoomByKey(roomKey);
        if (updatedRoom) {
          setRoom(updatedRoom);
        }
      }
      
      setUploadSuccess(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setUploadSuccess(false);
      }, 3000);
    } catch (err) {
      setError((err as Error).message || 'Failed to upload files');
    }
  };
  
  const handleDeleteFile = async (fileId: string) => {
    if (!roomKey || !room) return;
    
    try {
      setError(null);
      
      await deleteFileFromRoom(roomKey, fileId);
      
      // Refresh room data
      const updatedRoom = await getRoomByKey(roomKey);
      if (updatedRoom) {
        setRoom(updatedRoom);
      }
      
      if (selectedFile?.id === fileId) {
        setSelectedFile(null);
      }
      
      setDeleteConfirmation(null);
    } catch (err) {
      setError((err as Error).message || 'Failed to delete file');
    }
  };
  
  const handleShareRoom = () => {
    const url = `${window.location.origin}/enter-room`;
    setShareUrl(url);
    setShowShareModal(true);
  };
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const downloadFile = async (url: string, filename: string) => {
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
    } catch (error) {
      console.error('Download failed:', error);
      window.open(url, '_blank');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const getFileTypeIcon = (file: FileItem) => {
    const type = file.type.toLowerCase();
    
    if (type.includes('image')) {
      return <FileIcon className="w-5 h-5 text-blue-500" />;
    } else if (type.includes('pdf')) {
      return <FileIcon className="w-5 h-5 text-red-500" />;
    } else if (type.includes('spreadsheet') || type.includes('excel') || type.includes('xlsx')) {
      return <FileIcon className="w-5 h-5 text-green-500" />;
    } else if (type.includes('presentation') || type.includes('powerpoint') || type.includes('pptx')) {
      return <FileIcon className="w-5 h-5 text-orange-500" />;
    } else {
      return <FileIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  // Dynamic room name sizing
  const getRoomNameStyle = (name: string) => {
    if (name.length > 30) {
      return { fontSize: '1rem' };
    } else if (name.length > 20) {
      return { fontSize: '1.25rem' };
    }
    return { fontSize: '1.5rem' };
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }
  
  if (error && error === 'Room not found') {
    return (
      <div className="container max-w-md mx-auto py-12 px-4 text-center animate-fade-in">
        <h1 className="text-2xl font-bold mb-4">Room Not Found</h1>
        <p className="text-gray-600 mb-8">
          The room you are looking for does not exist or has been removed.
        </p>
        <Button onClick={() => navigate('/')}>Go to Home Page</Button>
      </div>
    );
  }
  
  if (!pinVerified) {
    return (
      <div className="container max-w-md mx-auto py-12 px-4 animate-fade-in">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="flex justify-center mb-6">
            <div className="bg-primary-100 text-primary-600 rounded-full p-3">
              <Lock className="w-6 h-6" />
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-center mb-2">Enter Room PIN</h1>
          
          {room && (
            <p className="text-gray-600 text-center mb-6">
              Enter the 4-digit PIN for <strong>{room.name}</strong>
            </p>
          )}
          
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md mb-6">
              {error}
            </div>
          )}
          
          <form onSubmit={handleVerifyPin} className="space-y-6">
            <Input
              label="Room PIN (4 digits)"
              type="text"
              value={pin}
              onChange={(e) => setPin(e.target.value.slice(0, 4))}
              required
              pattern="\d{4}"
              placeholder="1234"
              maxLength={4}
              autoFocus
            />
            
            <div>
              <Button
                type="submit"
                isLoading={verifyingPin}
                className="w-full"
              >
                Enter Room
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Custom Header for Room Page */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2 text-blue-600 font-semibold text-xl">
              <FolderIcon className="w-6 h-6" />
              <span>ArcRoom</span>
            </div>
            
            {/* Room Name - Center */}
            <div className="flex-1 flex justify-center">
              <h1 
                className="font-semibold text-gray-900 text-center max-w-md truncate"
                style={room ? getRoomNameStyle(room.name) : {}}
              >
                {room?.name || 'Loading...'}
              </h1>
            </div>
            
            {/* Right Side Actions */}
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                onClick={handleShareRoom}
                className="flex items-center gap-2"
              >
                <LinkIcon className="w-4 h-4" />
                Share Room
              </Button>
              
              {user ? (
                <div className="flex items-center gap-3">
                  {/* Profile Icon with Dropdown */}
                  <div className="relative">
                    <button
                      onMouseEnter={() => setShowProfileDropdown(true)}
                      onMouseLeave={() => setShowProfileDropdown(false)}
                      onClick={() => navigate('/profile')}
                      className="flex items-center justify-center w-10 h-10 bg-primary-100 text-primary-600 rounded-full hover:bg-primary-200 transition-colors"
                      title="Profile"
                    >
                      <User className="w-5 h-5" />
                    </button>
                    
                    {/* Dropdown on Hover */}
                    {showProfileDropdown && (
                      <div 
                        className="absolute right-0 top-12 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-48 z-20"
                        onMouseEnter={() => setShowProfileDropdown(true)}
                        onMouseLeave={() => setShowProfileDropdown(false)}
                      >
                        <div className="text-sm text-gray-600 mb-2">Signed in as:</div>
                        <div className="text-sm font-medium text-gray-900 truncate">{user.email}</div>
                        <div className="border-t border-gray-100 mt-2 pt-2">
                          <button
                            onClick={() => navigate('/profile')}
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                          >
                            View Profile →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <Button 
                    variant="ghost" 
                    onClick={handleLogout}
                    className="flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div className="container py-8 px-4 animate-fade-in">
        {room && (
          <div>
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
              <div>
                <p className="text-gray-600">
                  {room.files.length} {room.files.length === 1 ? 'file' : 'files'} • Created {new Date(room.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            
            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded-md mb-6">
                {error}
              </div>
            )}
            
            {uploadSuccess && (
              <div className="bg-green-50 text-green-700 p-3 rounded-md mb-6">
                Files uploaded successfully!
              </div>
            )}
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 order-2 lg:order-1">
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                  <h2 className="text-lg font-semibold mb-4">Files</h2>
                  
                  {room.files.length === 0 ? (
                    <div className="text-center py-8">
                      <FileIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No files yet</p>
                      {isOwner && (
                        <p className="text-gray-500 text-sm mt-1">
                          Upload files to get started
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {room.files.map(file => (
                        <div
                          key={file.id}
                          className={`flex items-center gap-2 p-2 hover:bg-gray-50 rounded-md cursor-pointer ${
                            selectedFile?.id === file.id ? 'bg-primary-50 border-l-4 border-primary-500' : ''
                          }`}
                          onClick={() => setSelectedFile(file)}
                        >
                          <div className="flex items-center gap-2 flex-1">
                            {getFileTypeIcon(file)}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-700 truncate">{file.name}</p>
                              <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(file.url, '_blank');
                              }}
                              className="p-1 text-gray-500 hover:text-primary-600 rounded"
                              title="Open in new tab"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadFile(file.url, file.name);
                              }}
                              className="p-1 text-gray-500 hover:text-primary-600 rounded"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            {isOwner && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmation({ type: 'file', id: file.id, name: file.name });
                                }}
                                className="p-1 text-gray-500 hover:text-red-600 rounded"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {isOwner && (
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <h2 className="text-lg font-semibold mb-4">Upload Files</h2>
                    <FileUpload 
                      onUpload={handleFileUpload} 
                      accept={{
                        'image/*': [],
                        'application/pdf': [],
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [],
                        'application/vnd.openxmlformats-officedocument.presentationml.presentation': [],
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [],
                      }}
                    />
                  </div>
                )}
              </div>
              
              <div className="lg:col-span-2 order-1 lg:order-2">
                {selectedFile ? (
                  <FileViewer file={selectedFile} />
                ) : (
                  <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                    <div className="max-w-md mx-auto">
                      <FileIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <h2 className="text-lg font-semibold mb-2">No file selected</h2>
                      <p className="text-gray-500 mb-4">
                        Select a file from the list to preview it here
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Share Modal */}
            {showShareModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full animate-slide-up">
                  <h3 className="text-lg font-semibold mb-4">Share Room</h3>
                  
                  <div className="mb-6">
                    <p className="text-gray-600 mb-2">
                      Share this URL along with the room key and PIN:
                    </p>
                    <div className="flex">
                      <input
                        type="text"
                        value={shareUrl}
                        readOnly
                        className="flex-grow border rounded-l-md p-2 bg-gray-50"
                      />
                      <button
                        onClick={copyToClipboard}
                        className="bg-primary-600 text-white px-4 py-2 rounded-r-md"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-md mb-6">
                    <h4 className="text-sm font-semibold text-blue-800 mb-2">Room Information</h4>
                    <p className="text-sm text-blue-700 mb-1">
                      <span className="font-medium">Room Key:</span> {roomKey}
                    </p>
                    <p className="text-sm text-blue-700">
                      <span className="font-medium">PIN:</span> ••••
                    </p>
                  </div>
                  
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      onClick={() => setShowShareModal(false)}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmation && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                      <AlertTriangle className="w-8 h-8 text-red-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Delete File
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Are you sure you want to delete "{deleteConfirmation.name}"?
                    </p>
                    <p className="text-sm text-gray-500">This action cannot be undone.</p>
                  </div>
                  
                  <div className="flex gap-3 justify-center">
                    <Button
                      variant="ghost"
                      onClick={() => setDeleteConfirmation(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => handleDeleteFile(deleteConfirmation.id)}
                    >
                      Delete File
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}