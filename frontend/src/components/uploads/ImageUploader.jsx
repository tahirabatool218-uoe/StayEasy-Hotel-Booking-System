import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import Icon from '../ui/Icon';
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGES,
  MAX_IMAGE_BYTES,
  getUploadErrorMessage,
  uploadImage,
  validateImageFile,
} from '../../services/uploadService';

const CONCURRENCY = 3;
let nextId = 0;

// Thumbnail that degrades to a placeholder instead of a broken-image icon.
function Thumb({ src }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <span className="uploader-thumb-fallback" role="img" aria-label="Image could not be loaded">
        <Icon name="image" size={22} />
      </span>
    );
  }
  return <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} />;
}

// Multi-image field for hotel and room forms.
//   images        : current array of HTTPS URLs (the saved value)
//   onChange(fn)  : called with an updater `(prevUrls) => nextUrls`; pass a
//                   useState setter. Updaters keep concurrent uploads from
//                   overwriting each other.
//   onBusyChange  : receives true while any file is queued/uploading, so the
//                   form can block saving until uploads settle.
// Existing URLs are never touched unless the admin removes them. Files go
// straight to Cloudinary using a signature from POST /uploads/signature; the
// API secret never reaches the browser. Pasting an HTTPS URL stays available as
// a fallback when uploads are not configured.
export default function ImageUploader({ images, onChange, onBusyChange, disabled = false, label = 'Images' }) {
  const [items, setItems] = useState([]); // { id, name, preview, status, progress, error, file }
  const [message, setMessage] = useState(null); // { type, text }
  const [configError, setConfigError] = useState('');
  const [urlDraft, setUrlDraft] = useState('');
  const [dragging, setDragging] = useState(false);

  const inputRef = useRef(null);
  const controllers = useRef(new Map());
  const queue = useRef([]);
  const active = useRef(0);
  const previews = useRef(new Map());
  const onChangeRef = useRef(onChange);
  const unmounted = useRef(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const busy = items.some((i) => i.status === 'queued' || i.status === 'uploading');
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  // Abort in-flight uploads and free preview blobs when the form closes.
  useEffect(() => {
    unmounted.current = false;
    const live = controllers.current;
    const blobs = previews.current;
    return () => {
      unmounted.current = true;
      live.forEach((c) => c.abort());
      blobs.forEach((url) => URL.revokeObjectURL(url));
      blobs.clear();
      queue.current = [];
    };
  }, []);

  const patch = (id, changes) => {
    if (unmounted.current) return;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...changes } : i)));
  };

  const drop = (id) => {
    const url = previews.current.get(id);
    if (url) URL.revokeObjectURL(url);
    previews.current.delete(id);
    if (!unmounted.current) setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const run = async (item) => {
    const controller = new AbortController();
    controllers.current.set(item.id, controller);
    patch(item.id, { status: 'uploading', progress: 0, error: '' });
    try {
      const url = await uploadImage(item.file, {
        signal: controller.signal,
        onProgress: (progress) => patch(item.id, { progress }),
      });
      if (unmounted.current) return;
      onChangeRef.current((prev) => (prev.includes(url) ? prev : [...prev, url]));
      drop(item.id);
    } catch (err) {
      if (axios.isCancel(err) || unmounted.current) {
        drop(item.id);
        return;
      }
      if (err?.response?.status === 503) setConfigError(getUploadErrorMessage(err));
      patch(item.id, { status: 'error', error: getUploadErrorMessage(err) });
    } finally {
      controllers.current.delete(item.id);
    }
  };

  const pump = () => {
    while (active.current < CONCURRENCY && queue.current.length > 0) {
      const item = queue.current.shift();
      active.current += 1;
      run(item).finally(() => {
        active.current -= 1;
        pump();
      });
    }
  };

  const addFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    setMessage(null);

    const pending = items.filter((i) => i.status === 'queued' || i.status === 'uploading').length;
    let room = MAX_IMAGES - images.length - pending;
    const accepted = [];
    const problems = [];

    files.forEach((file) => {
      const problem = validateImageFile(file);
      if (problem) problems.push(`${file.name}: ${problem}`);
      else if (room <= 0) problems.push(`${file.name}: skipped — a maximum of ${MAX_IMAGES} images is allowed.`);
      else {
        room -= 1;
        accepted.push(file);
      }
    });

    if (problems.length) setMessage({ type: 'error', text: problems });

    if (accepted.length) {
      const fresh = accepted.map((file) => {
        const id = ++nextId;
        const preview = URL.createObjectURL(file);
        previews.current.set(id, preview);
        return { id, name: file.name, preview, status: 'queued', progress: 0, error: '', file };
      });
      setItems((prev) => [...prev, ...fresh]);
      queue.current.push(...fresh);
      pump();
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const cancel = (item) => {
    queue.current = queue.current.filter((q) => q.id !== item.id);
    controllers.current.get(item.id)?.abort();
    drop(item.id);
  };

  const retry = (item) => {
    patch(item.id, { status: 'queued', progress: 0, error: '' });
    queue.current.push(item);
    pump();
  };

  const removeImage = (url) => onChange((prev) => prev.filter((u) => u !== url));
  const makeCover = (url) => onChange((prev) => [url, ...prev.filter((u) => u !== url)]);

  const addUrl = () => {
    const value = urlDraft.trim();
    if (!value) return;
    let ok = false;
    try {
      const parsed = new URL(value);
      ok = parsed.protocol === 'https:' && Boolean(parsed.hostname);
    } catch {
      ok = false;
    }
    if (!ok) return setMessage({ type: 'error', text: ['Enter a full image address starting with https://'] });
    if (images.includes(value)) return setMessage({ type: 'error', text: ['That image is already in the list.'] });
    if (images.length >= MAX_IMAGES) return setMessage({ type: 'error', text: [`A maximum of ${MAX_IMAGES} images is allowed.`] });
    setMessage(null);
    onChange((prev) => [...prev, value]);
    setUrlDraft('');
  };

  const remaining = MAX_IMAGES - images.length;
  const full = remaining <= 0;
  const labelId = 'uploader-label';

  return (
    <div className="uploader" role="group" aria-labelledby={labelId}>
      <div className="uploader-head">
        <span id={labelId} className="uploader-title">{label}</span>
        <span className="uploader-count" aria-live="polite">{images.length} of {MAX_IMAGES}</span>
      </div>

      {configError && (
        <p className="admin-form-error" role="alert">{configError}</p>
      )}

      <div
        className={`uploader-drop ${dragging ? 'is-dragging' : ''} ${disabled || full ? 'is-disabled' : ''}`}
        onDragOver={(e) => { e.preventDefault(); if (!disabled && !full) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled && !full) addFiles(e.dataTransfer.files);
        }}
      >
        <Icon name="image" size={26} />
        <p>Drag images here, or</p>
        <button type="button" className="ui-btn ui-btn-outline ui-btn-sm" onClick={() => inputRef.current?.click()} disabled={disabled || full}>
          <span className="ui-btn-label">Choose images</span>
        </button>
        <p className="uploader-hint">
          JPG, PNG, WebP, GIF or AVIF · up to {MAX_IMAGE_BYTES / 1024 / 1024} MB each · {full ? 'limit reached' : `${remaining} more allowed`}
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          className="uploader-input"
          tabIndex={-1}
          aria-label="Choose image files to upload"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {message && (
        <ul className="uploader-errors" role="alert">
          {message.text.map((line) => <li key={line}>{line}</li>)}
        </ul>
      )}

      {(images.length > 0 || items.length > 0) && (
        <ul className="uploader-grid">
          {images.map((url, index) => (
            <li key={url} className="uploader-tile">
              <Thumb src={url} />
              {index === 0 && <span className="uploader-cover">Cover</span>}
              <div className="uploader-tile-actions">
                {index !== 0 && (
                  <button type="button" onClick={() => makeCover(url)} disabled={disabled} aria-label={`Make image ${index + 1} the cover`}>
                    Cover
                  </button>
                )}
                <button type="button" onClick={() => removeImage(url)} disabled={disabled} aria-label={`Remove image ${index + 1}`}>
                  <Icon name="close" size={14} />
                </button>
              </div>
            </li>
          ))}

          {items.map((item) => (
            <li key={item.id} className={`uploader-tile is-pending ${item.status === 'error' ? 'is-error' : ''}`}>
              <img src={item.preview} alt="" />
              <div className="uploader-overlay">
                {item.status === 'error' ? (
                  <>
                    <p role="alert">{item.error}</p>
                    <div className="uploader-overlay-actions">
                      <button type="button" onClick={() => retry(item)}>Retry</button>
                      <button type="button" onClick={() => cancel(item)}>Remove</button>
                    </div>
                  </>
                ) : (
                  <>
                    <progress max="100" value={item.status === 'uploading' ? item.progress : 0} aria-label={`Uploading ${item.name}`} />
                    <span>{item.status === 'queued' ? 'Waiting…' : `${item.progress}%`}</span>
                    <button type="button" onClick={() => cancel(item)} aria-label={`Cancel upload of ${item.name}`}>Cancel</button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="uploader-url">
        <label htmlFor="uploader-url-input">Or add an image by URL</label>
        <div className="uploader-url-row">
          <input
            id="uploader-url-input"
            type="url"
            value={urlDraft}
            placeholder="https://…"
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } }}
            disabled={disabled || full}
          />
          <button type="button" className="ui-btn ui-btn-outline ui-btn-sm" onClick={addUrl} disabled={disabled || full || !urlDraft.trim()}>
            <span className="ui-btn-label">Add</span>
          </button>
        </div>
      </div>

      {busy && <p className="uploader-hint" role="status">Uploading… you can save once every image has finished.</p>}
    </div>
  );
}
