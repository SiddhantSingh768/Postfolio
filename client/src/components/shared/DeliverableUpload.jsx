import { useState, useRef } from 'react';
import {
  Upload, X, FileText, Image,
  Film, Archive, CheckCircle2
} from 'lucide-react';
import { Button } from '../ui/Button';
import { useUploadDeliverable } from '../../hooks/useDeliverables';
import { formatFileSize }       from '../../utils/formatters';
import { cn }                   from '../../utils/cn';
import { useToast }             from '../ui/Toast';

const FILE_ICONS = {
  'image':       <Image   className="w-4 h-4 text-blue-500" />,
  'video':       <Film    className="w-4 h-4 text-purple-500" />,
  'application': <FileText className="w-4 h-4 text-red-500" />,
  'default':     <Archive  className="w-4 h-4 text-[var(--text-muted)]" />,
};

const getFileIcon = (mimeType) => {
  if (!mimeType) return FILE_ICONS.default;
  const type = mimeType.split('/')[0];
  return FILE_ICONS[type] || FILE_ICONS.default;
};

export const DeliverableUpload = ({ milestoneId, projectId, onClose }) => {
  const toast = useToast();
  const fileRef = useRef();

  const [file, setFile]         = useState(null);
  const [changeNotes, setNotes] = useState('');
  const [done, setDone]         = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const { upload, uploading, progress, error } = useUploadDeliverable(milestoneId, projectId);

  const handleFile = (f) => {
    if (!f) return;
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (f.size > maxSize) {
      toast.error('File exceeds 100MB limit');
      return;
    }
    setFile(f);
    setDone(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleSubmit = async () => {
    if (!file) return;
    const success = await upload(file, changeNotes || null);
    if (success) {
      setDone(true);
      toast.success('Deliverable uploaded');
      setTimeout(onClose, 800);
    }
  };

  return (
    <div className="p-5 space-y-4">

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => !file && fileRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-lg p-6 text-center transition-colors duration-150 cursor-pointer',
          dragOver
            ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-900/10'
            : file
            ? 'border-[var(--border)] bg-[var(--bg-tertiary)] cursor-default'
            : 'border-[var(--border)] hover:border-brand-400 hover:bg-[var(--bg-tertiary)]'
        )}
      >
        {file ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-center flex-shrink-0">
              {getFileIcon(file.type)}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate">{file.name}</p>
              <p className="text-xs text-[var(--text-muted)]">{formatFileSize(file.size)}</p>
            </div>
            {!uploading && !done && (
              <button
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                className="text-[var(--text-muted)] hover:text-danger transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <div>
            <Upload className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
            <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
              Drop file here or click to browse
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              PDF, PNG, JPG, ZIP, DOCX, MP4 — max 100MB
            </p>
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept=".pdf,.png,.jpg,.jpeg,.zip,.docx,.mp4"
        onChange={(e) => handleFile(e.target.files[0])}
      />

      {/* Progress bar */}
      {uploading && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-[var(--text-muted)]">
            <span>Uploading...</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-600 rounded-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Done indicator */}
      {done && (
        <div className="flex items-center gap-2 text-success text-sm">
          <CheckCircle2 className="w-4 h-4" />
          Upload complete
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-danger">{error}</p>
      )}

      {/* Change notes */}
      {file && !done && (
        <div className="space-y-1.5">
          <label className="label">Version notes (optional)</label>
          <input
            type="text"
            className="input"
            placeholder="What changed in this version..."
            value={changeNotes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
          />
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t border-[var(--border)]">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={onClose}
          disabled={uploading}
        >
          Cancel
        </Button>
        <Button
          className="flex-1"
          onClick={handleSubmit}
          loading={uploading}
          disabled={!file || done}
        >
          Upload
        </Button>
      </div>
    </div>
  );
};