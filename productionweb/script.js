'use strict';

/**
 * Elements
 */
const form            = document.getElementById('dataInput');
const input            = document.getElementById('inputURL');
const submitBtn         = document.getElementById('submitBtn');
const statusRow         = document.getElementById('statusRow');
const statusText        = document.getElementById('status');
const result            = document.getElementById('result');
const resultThumb       = document.getElementById('resultThumb');
const resultTitle       = document.getElementById('resultTitle');
const resultSource      = document.getElementById('resultSource');
const formatSelect      = document.getElementById('formatSelect');
const formatTag         = document.getElementById('formatTag');
const qualityControl    = document.getElementById('qualityControl');
const qualitySelect     = document.getElementById('qualitySelect');
const downloadBtn       = document.getElementById('downloadBtn');
const resetBtn          = document.getElementById('resetBtn');
const tosNotice          = document.getElementById('tosNotice');
const tosCheckbox        = document.getElementById('tosCheckbox');

/** Formats that are audio-only — everything else is treated as video. */
const AUDIO_FORMATS = ['mp3'];

/**
 * currentVideo holds what we know so far:
 *   sourceUrl  — the link the user pasted (needed again for download calls)
 *   title      — from /getsimplemetadata
 *   thumbnail  — from /getsimplemetadata
 * The actual file URL isn't fetched until the user hits
 * "Download" — that's a separate call to /download or /downloadaudio.
 */
let currentVideo = null;

/** The Terms notice is shown once per visit, the first result only. */
let tosNoticeShown = false;

/** Download stays locked until the Terms checkbox has been ticked once. */
let tosAgreed = false;

/**
 * Small state machine: idle -> processing -> success | error
 * Drives the status dot color/animation and the status text.
 */
function setState(state, message) {
  statusRow.dataset.state = state;
  statusText.textContent = message;
}

function extractHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Reflects the selected format in the UI: swaps the V/A badge and
 * shows/hides the quality control, since quality only applies to
 * video formats — audio has no "max quality" concept here.
 */
function updateFormatUI() {
  const isAudio = AUDIO_FORMATS.includes(formatSelect.value);
  formatTag.textContent = isAudio ? 'A' : 'V';
  formatTag.dataset.type = isAudio ? 'audio' : 'video';
  qualityControl.hidden = isAudio;
}

/**
 * The download button is only enabled once metadata has loaded
 * AND the Terms checkbox has been agreed to.
 */
function updateDownloadLock() {
  downloadBtn.disabled = !tosAgreed;
}

/**
 * Reset the interface back to idle, ready for a new link.
 */
function resetToIdle() {
  currentVideo = null;
  form.hidden = false;
  result.hidden = true;
  result.dataset.state = '';
  resultThumb.src = '';
  resultThumb.alt = '';
  resultTitle.textContent = '';
  resultSource.textContent = '';
  input.value = '';
  input.disabled = false;
  submitBtn.disabled = false;
  submitBtn.textContent = 'Get video';
  formatSelect.value = 'mp4';
  qualitySelect.value = 'best';
  updateFormatUI();
  setState('idle', 'Ready when you are.');
  input.focus();
}

/**
 * Render metadata (title + thumbnail only) into the result panel.
 */
function showResult(meta, sourceUrl) {
  currentVideo = {
    sourceUrl,
    title: meta.title,
    thumbnail: meta.thumbnail
  };

  resultThumb.src = meta.thumbnail || '';
  resultThumb.alt = meta.title ? `Thumbnail for ${meta.title}` : '';
  resultTitle.textContent = meta.title || 'Untitled video';
  resultSource.textContent = extractHostname(sourceUrl) || 'Source';

  result.dataset.state = 'ready';
  updateFormatUI();

  if (!tosNoticeShown) {
    tosNotice.hidden = false;
    tosNoticeShown = true;
  } else {
    tosNotice.hidden = true;
  }

  updateDownloadLock();
  setState('success', 'Ready to download.');
}

/**
 * Submit handler — step 1 of 2: resolve just the lightweight
 * metadata (title + thumbnail) so the result can render fast.
 * The actual file link is only resolved later, on download.
 */
form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const url = input.value.trim();

  if (!url) {
    setState('error', "Paste a video link first.");
    input.focus();
    return;
  }

  input.disabled = true;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Working…';
  setState('processing', 'Reading the link…');

  // Show the result panel immediately as a loading skeleton so the
  // interface feels responsive while metadata is being fetched.
  form.hidden = true;
  result.hidden = false;
  result.dataset.state = 'loading';

  let response;
  try {
    response = await fetch('/getsimplemetadata', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url })
    });
  } catch (err) {
    form.hidden = false;
    result.hidden = true;
    input.disabled = false;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Get video';
    setState('error', "Couldn't reach the server. Check your connection and try again.");
    return;
  }

  let meta;
  try {
    meta = await response.json();
  } catch (err) {
    form.hidden = false;
    result.hidden = true;
    input.disabled = false;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Get video';
    setState('error', 'Got an unreadable response. Try again in a moment.');
    return;
  }

  input.disabled = false;
  submitBtn.disabled = false;
  submitBtn.textContent = 'Get video';

  if (!response.ok || !meta.title) {
    form.hidden = false;
    result.hidden = true;
    setState('error', meta.message || "Couldn't read that link. Check the URL and try again.");
    return;
  }

  showResult(meta, url);
});

formatSelect.addEventListener('change', updateFormatUI);

tosCheckbox.addEventListener('change', () => {
  if (tosCheckbox.checked) {
    tosAgreed = true;
    tosNotice.hidden = true;
    updateDownloadLock();
  }
});

/**
 * Download handler — step 2 of 2: resolve the real file link via
 * /download (video) or /downloadaudio (audio), then pull it as a
 * blob so the browser saves the file instead of opening it.
 */
downloadBtn.addEventListener('click', async () => {
  if (!currentVideo || !currentVideo.sourceUrl || !tosAgreed) return;

  const fileFormat = formatSelect.value;
  const isAudio = AUDIO_FORMATS.includes(fileFormat);

  const originalLabel = downloadBtn.textContent;
  downloadBtn.disabled = true;
  downloadBtn.textContent = 'Preparing…';

  try {
    let endpoint;
    let payload;

    if (isAudio) {
      endpoint = '/downloadaudio';
      payload = {
        url: currentVideo.sourceUrl,
        fileFormat
      };
    } else {
      endpoint = '/download';
      payload = {
        url: currentVideo.sourceUrl,
        fileFormat
      };
      // "Best" means no ceiling — the server defaults to bestvideo
      // on its own, so we simply don't send a quality field at all.
      if (qualitySelect.value !== 'best') {
        payload.quality = qualitySelect.value;
      }
    }

    const prepResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const prepData = await prepResponse.json();

    if (!prepData.success || !prepData.url) {
      setState('error', prepData.message || "Couldn't prepare the download. Try again.");
      return;
    }

    downloadBtn.textContent = 'Downloading…';

    const fileResponse = await fetch(prepData.url);
    const blob = await fileResponse.blob();
    const blobUrl = URL.createObjectURL(blob);

    const safeTitle = (currentVideo.title || 'video').replace(/[\\/:*?"<>|]+/g, '').trim() || 'video';
    const filename = `${safeTitle}.${fileFormat}`;

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    setState('error', "Download failed partway through. Try again.");
  } finally {
    updateDownloadLock();
    downloadBtn.textContent = originalLabel;
  }
});

resetBtn.addEventListener('click', resetToIdle);
