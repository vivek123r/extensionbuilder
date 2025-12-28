import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { getUserExtensions, deleteExtension } from './services/extensionService';
import JSZip from 'jszip';
import HyperspeedBackground from './components/HyperspeedBackground';
import './MyExtensions.css';

const MyExtensions = () => {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const [extensions, setExtensions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedExtension, setSelectedExtension] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  useEffect(() => {
    loadExtensions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const loadExtensions = async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const userExtensions = await getUserExtensions(currentUser.uid);
      setExtensions(userExtensions);
      setError(null);
    } catch (err) {
      console.error('Error loading extensions:', err);
      setError('Failed to load extensions');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (extensionId) => {
    try {
      await deleteExtension(extensionId);
      setExtensions(prev => prev.filter(ext => ext.id !== extensionId));
      setShowDeleteConfirm(null);
      setSelectedExtension(null);
    } catch (err) {
      console.error('Error deleting extension:', err);
      setError('Failed to delete extension');
    }
  };

  const downloadExtension = async (extension) => {
    try {
      const zip = new JSZip();
      const code = extension.generatedCode;

      // Add manifest
      if (code.manifest) {
        zip.file('manifest.json', code.manifest);
      }

      // Add popup files
      if (code.popup) {
        if (code.popup.html) zip.file('popup.html', code.popup.html);
        if (code.popup.css) zip.file('popup.css', code.popup.css);
        if (code.popup.js) zip.file('popup.js', code.popup.js);
      }

      // Add content scripts
      if (code.content) {
        if (code.content.js) zip.file('content.js', code.content.js);
        if (code.content.css) zip.file('content.css', code.content.css);
      }

      // Add background script
      if (code.background?.js) {
        zip.file('background.js', code.background.js);
      }

      // Add options page
      if (code.options) {
        if (code.options.html) zip.file('options.html', code.options.html);
        if (code.options.js) zip.file('options.js', code.options.js);
        if (code.options.css) zip.file('options.css', code.options.css);
      }

      // Generate ZIP and download
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${extension.name.replace(/\s+/g, '-').toLowerCase()}-extension.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading extension:', err);
      setError('Failed to download extension');
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDescription = (text) => {
    if (!text) return '';
    
    // Split by common delimiters and format
    return text
      .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>') // ***text***
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') // **text**
      .replace(/\*([^*]+)\*/g, '<em>$1</em>') // *text*
      .replace(/###\s+([^\n]+)/g, '<h5>$1</h5>') // ### heading
      .replace(/##\s+([^\n]+)/g, '<h4>$1</h4>') // ## heading
      .replace(/#\s+([^\n]+)/g, '<h3>$1</h3>') // # heading
      .replace(/---/g, '<br/>') // --- as separator
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('<br/><br/>');
  };

  const getSimpleDescription = (text) => {
    if (!text) return '';
    
    // Remove all markdown formatting and get first line or sentence
    const cleaned = text
      .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/###?\s+/g, '')
      .replace(/---/g, ' ')
      .split('\n')[0]
      .trim();
    
    // Truncate to 120 characters
    return cleaned.length > 120 ? cleaned.substring(0, 120) + '...' : cleaned;
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (loading) {
    return (
      <div className="my-extensions-container">
        <HyperspeedBackground />
        <div className="loading-state">
          <div className="spinner-large"></div>
          <p>Loading your extensions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="my-extensions-container">
      <HyperspeedBackground />
      
      <div className="extensions-header">
        <div className="header-content">
          <h1>My Extensions</h1>
          <div className="user-info">
            <span className="user-email">{currentUser?.email}</span>
            <button onClick={handleLogout} className="btn btn-secondary">
              Logout
            </button>
          </div>
        </div>
        <button 
          onClick={() => navigate('/create-extension')} 
          className="btn btn-primary"
        >
          + Create New Extension
        </button>
      </div>

      {error && (
        <div className="error-banner">
          <span>⚠️</span>
          <p>{error}</p>
        </div>
      )}

      {extensions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <h2>No Extensions Yet</h2>
          <p>Start building your first browser extension!</p>
          <button 
            onClick={() => navigate('/create-extension')} 
            className="btn btn-primary btn-large"
          >
            Create Your First Extension
          </button>
        </div>
      ) : (
        <div className="extensions-grid">
          {extensions.map((extension) => (
            <div key={extension.id} className="extension-card">
              <div className="card-header">
                <h3>{extension.name}</h3>
                <span className="version-badge">v{extension.version}</span>
              </div>
              
              <p className="description">{getSimpleDescription(extension.description)}</p>
              
              <div className="extension-meta">
                <div className="meta-item">
                  <span className="label">Type:</span>
                  <span className="value">{extension.type}</span>
                </div>
                <div className="meta-item">
                  <span className="label">Browser:</span>
                  <span className="value">{extension.targetBrowser}</span>
                </div>
                <div className="meta-item">
                  <span className="label">Created:</span>
                  <span className="value">{formatDate(extension.createdAt)}</span>
                </div>
              </div>

              {extension.permissions && extension.permissions.length > 0 && (
                <div className="permissions-tags">
                  {extension.permissions.map((perm, idx) => (
                    <span key={idx} className="permission-tag">{perm}</span>
                  ))}
                </div>
              )}

              <div className="card-actions">
                <button 
                  onClick={() => setSelectedExtension(extension)}
                  className="btn btn-outline"
                >
                  View Details
                </button>
                <button 
                  onClick={() => downloadExtension(extension)}
                  className="btn btn-primary"
                >
                  📥 Download
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(extension.id)}
                  className="btn btn-danger"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Extension?</h3>
            <p>Are you sure you want to delete this extension? This action cannot be undone.</p>
            <div className="modal-actions">
              <button 
                onClick={() => setShowDeleteConfirm(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleDelete(showDeleteConfirm)}
                className="btn btn-danger"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extension Details Modal */}
      {selectedExtension && (
        <div className="modal-overlay" onClick={() => setSelectedExtension(null)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedExtension.name}</h2>
              <button 
                onClick={() => setSelectedExtension(null)}
                className="close-btn"
              >
                ✕
              </button>
            </div>
            
            <div className="modal-body">
              <div className="detail-section">
                <h4>Description</h4>
                <div 
                  className="description-content"
                  dangerouslySetInnerHTML={{ __html: formatDescription(selectedExtension.description) }}
                />
              </div>

              <div className="detail-section">
                <h4>Details</h4>
                <div className="details-grid">
                  <div><strong>Version:</strong> {selectedExtension.version}</div>
                  <div><strong>Type:</strong> {selectedExtension.type}</div>
                  <div><strong>Browser:</strong> {selectedExtension.targetBrowser}</div>
                  <div><strong>Author:</strong> {selectedExtension.author || 'N/A'}</div>
                  <div><strong>Created:</strong> {formatDate(selectedExtension.createdAt)}</div>
                  <div><strong>Updated:</strong> {formatDate(selectedExtension.updatedAt)}</div>
                </div>
              </div>

              {selectedExtension.permissions && selectedExtension.permissions.length > 0 && (
                <div className="detail-section">
                  <h4>Permissions</h4>
                  <div className="permissions-list">
                    {selectedExtension.permissions.map((perm, idx) => (
                      <span key={idx} className="permission-tag">{perm}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="detail-section">
                <h4>Generated Files</h4>
                <ul className="files-list">
                  {selectedExtension.generatedCode.manifest && <li>📄 manifest.json</li>}
                  {selectedExtension.generatedCode.popup?.html && <li>🌐 popup.html</li>}
                  {selectedExtension.generatedCode.popup?.css && <li>🎨 popup.css</li>}
                  {selectedExtension.generatedCode.popup?.js && <li>⚡ popup.js</li>}
                  {selectedExtension.generatedCode.content?.js && <li>📜 content.js</li>}
                  {selectedExtension.generatedCode.content?.css && <li>🎨 content.css</li>}
                  {selectedExtension.generatedCode.background?.js && <li>⚙️ background.js</li>}
                  {selectedExtension.generatedCode.options?.html && <li>🌐 options.html</li>}
                  {selectedExtension.generatedCode.options?.js && <li>⚡ options.js</li>}
                  {selectedExtension.generatedCode.options?.css && <li>🎨 options.css</li>}
                </ul>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                onClick={() => downloadExtension(selectedExtension)}
                className="btn btn-primary"
              >
                📥 Download Extension
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyExtensions;
