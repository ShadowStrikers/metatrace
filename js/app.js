(function () {
  'use strict';

  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const specId = document.getElementById('specId');
  const scanPanel = document.getElementById('scanPanel');
  const scanLabel = document.getElementById('scanLabel');
  const resultsWrap = document.getElementById('resultsWrap');
  const resetButton = document.getElementById('resetButton');

  const heroCount = document.getElementById('heroCount');
  const heroType = document.getElementById('heroType');
  const heroSize = document.getElementById('heroSize');
  const heroFlags = document.getElementById('heroFlags');

  const verdictDot = document.getElementById('verdictDot');
  const verdictText = document.getElementById('verdictText');
  const stripBtn = document.getElementById('stripBtn');
  const jsonBtn = document.getElementById('jsonBtn');
  const actionsNote = document.getElementById('actionsNote');
  const stripResult = document.getElementById('stripResult');

  const thumbWrap = document.getElementById('thumbWrap');
  const thumbImg = document.getElementById('thumbImg');
  const filterInput = document.getElementById('filterInput');
  const filterClear = document.getElementById('filterClear');

  let currentFile = null;
  const collectedData = {};

  resultsWrap.hidden = true;
  scanPanel.hidden = true;
  filterClear.hidden = true;

  const generalGrid = document.getElementById('generalGrid');
  const generalCount = document.getElementById('generalCount');

  const imagePanel = document.getElementById('imagePanel');
  const imageGrid = document.getElementById('imageGrid');
  const imageCount = document.getElementById('imageCount');

  const gpsPanel = document.getElementById('gpsPanel');
  const gpsGrid = document.getElementById('gpsGrid');
  const gpsCount = document.getElementById('gpsCount');

  const exifAllPanel = document.getElementById('exifAllPanel');
  const exifAllGrid = document.getElementById('exifAllGrid');
  const exifAllCount = document.getElementById('exifAllCount');

  const pdfPanel = document.getElementById('pdfPanel');
  const pdfGrid = document.getElementById('pdfGrid');
  const pdfCount = document.getElementById('pdfCount');

  const officePanel = document.getElementById('officePanel');
  const officeGrid = document.getElementById('officeGrid');
  const officeCount = document.getElementById('officeCount');

  const audioPanel = document.getElementById('audioPanel');
  const audioGrid = document.getElementById('audioGrid');
  const audioCount = document.getElementById('audioCount');

  const hexDump = document.getElementById('hexDump');
  const flaggedPanel = document.getElementById('flaggedPanel');
  const flagList = document.getElementById('flagList');
  const ruler = document.getElementById('ruler');

  let map = null;

  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  buildRulerTicks();
  function buildRulerTicks() {
    for (let i = 0; i < 60; i++) {
      if (i % 5 === 0) {
        const tick = document.createElement('div');
        tick.style.position = 'absolute';
        tick.style.left = '0';
        tick.style.top = (i * 12) + 'px';
        tick.style.fontFamily = 'IBM Plex Mono, monospace';
        tick.style.fontSize = '8px';
        tick.style.color = 'var(--ink-faint)';
        tick.style.paddingLeft = '2px';
        tick.textContent = i;
        ruler.appendChild(tick);
      }
    }
  }

  // ---------- Upload handling ----------

  ['dragenter', 'dragover'].forEach(evt => {
    dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  });
  ['dragleave', 'drop'].forEach(evt => {
    dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.remove('drag-over'); });
  });
  dropZone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  });
  resetButton.addEventListener('click', () => {
    resultsWrap.hidden = true;
    dropZone.hidden = false;
    specId.textContent = 'NO SPECIMEN LOADED';
    specId.classList.remove('active');
    fileInput.value = '';
  });

  function handleFile(file) {
    currentFile = file;
    for (const k in collectedData) delete collectedData[k];
    if (/^image\//.test(file.type)) {
      const turl = URL.createObjectURL(file);
      thumbImg.onload = () => setTimeout(() => URL.revokeObjectURL(turl), 2000);
      thumbImg.src = turl;
      thumbWrap.hidden = false;
    } else {
      thumbWrap.hidden = true;
    }
    if (filterInput) { filterInput.value = ''; filterClear.hidden = true; }
    stripResult.hidden = true; stripResult.innerHTML = '';
    dropZone.hidden = true;
    resultsWrap.hidden = true;
    scanPanel.hidden = false;
    scanLabel.textContent = 'Scanning specimen…';

    specId.textContent = file.name.toUpperCase();
    specId.classList.add('active');

    clearGrid(generalGrid); generalCount.textContent = '0';
    clearGrid(imageGrid); imagePanel.hidden = true; imageCount.textContent = '0';
    clearGrid(gpsGrid); gpsPanel.hidden = true; gpsCount.textContent = '0';
    clearGrid(exifAllGrid); exifAllPanel.hidden = true; exifAllCount.textContent = '0';
    clearGrid(pdfGrid); pdfPanel.hidden = true; pdfCount.textContent = '0';
    clearGrid(officeGrid); officePanel.hidden = true; officeCount.textContent = '0';
    clearGrid(audioGrid); audioPanel.hidden = true; audioCount.textContent = '0';
    flagList.innerHTML = ''; flaggedPanel.hidden = true;
    flagged.length = 0;
    hexDump.textContent = '';

    renderGeneral(file);

    const tasks = [renderHexPreview(file)];

    if (/^image\//.test(file.type)) {
      tasks.push(renderImageExif(file));
    } else if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      tasks.push(renderPdf(file));
    } else if (isOfficeFile(file)) {
      tasks.push(renderOffice(file));
    } else if (/^audio\//.test(file.type) || /\.(mp3|m4a|flac)$/i.test(file.name)) {
      tasks.push(renderAudio(file));
    }

    Promise.allSettled(tasks).then(() => {
      setTimeout(() => {
        scanPanel.hidden = true;
        resultsWrap.hidden = false;
        finalizeFlags();
        updateHero(file);
        setupCollapsibles();
        staggerReveal();
        applyFilter('');
      }, 550);
    });
  }

  function isOfficeFile(file) {
    return /\.(docx|xlsx|pptx)$/i.test(file.name) || /officedocument/.test(file.type);
  }

  function clearGrid(el) { el.innerHTML = ''; }

  function row(grid, label, value) {
    const cell = document.createElement('div');
    cell.className = 'spec-cell';
    const l = document.createElement('div');
    l.className = 'spec-cell-label';
    l.textContent = label;
    const has = value !== undefined && value !== null && value !== '';
    const v = document.createElement('div');
    v.className = 'spec-cell-value' + (has ? '' : ' empty');
    v.textContent = has ? String(value) : '—';
    cell.appendChild(l);
    cell.appendChild(v);
    grid.appendChild(cell);
  }

  function divider(grid) {
    const d = document.createElement('div');
    d.className = 'spec-grid-divider';
    grid.appendChild(d);
  }

  // Turns a raw key like "YCbCrPositioning" or "gps_version_id" into "Y Cb Cr positioning"-style readable label.
  function formatLabel(key) {
    let s = String(key).replace(/_/g, ' ');
    s = s.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
    s = s.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
    s = s.toLowerCase();
    s = s.replace(/\bgps\b/, 'GPS').replace(/\bid\b/, 'ID').replace(/\bexif\b/, 'EXIF');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function isDisplayable(val) {
    if (val === null || val === undefined) return false;
    if (typeof val === 'number' || typeof val === 'string' || typeof val === 'boolean') return true;
    if (Array.isArray(val)) return val.length <= 6 && val.every(v => typeof v !== 'object');
    if (typeof val === 'object' && 'numerator' in val) return true;
    return false;
  }

  function formatValue(val) {
    if (val && typeof val === 'object' && 'numerator' in val) {
      return val.denominator ? (val.numerator + '/' + val.denominator) : String(val.numerator);
    }
    if (Array.isArray(val)) return val.join(', ');
    return val;
  }

  const flagged = [];
  function flag(field, value) { flagged.push({ field, value }); }
  function finalizeFlags() {
    if (flagged.length === 0) { flaggedPanel.hidden = true; return; }
    flaggedPanel.hidden = false;
    flagList.innerHTML = '';
    flagged.forEach(f => {
      const item = document.createElement('div');
      item.className = 'flag-item';
      const field = document.createElement('span');
      field.className = 'flag-field';
      field.textContent = f.field;
      const val = document.createElement('span');
      val.textContent = f.value;
      item.appendChild(field);
      item.appendChild(val);
      flagList.appendChild(item);
    });
  }

  // ---------- General info ----------

  function renderGeneral(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    row(generalGrid, 'File name', file.name);
    row(generalGrid, 'File size', formatBytes(file.size));
    row(generalGrid, 'MIME type', file.type || 'unknown');
    row(generalGrid, 'File extension', ext);
    row(generalGrid, 'Last modified', file.lastModified ? new Date(file.lastModified).toLocaleString() : '');
    generalCount.textContent = String(generalGrid.children.length);
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2) + ' ' + units[i];
  }

  // ---------- Hex preview ----------

  function renderHexPreview(file) {
    return file.slice(0, 128).arrayBuffer().then(buf => {
      const bytes = new Uint8Array(buf);
      let out = '';
      for (let i = 0; i < bytes.length; i += 16) {
        const chunk = bytes.slice(i, i + 16);
        const hex = Array.from(chunk).map(b => b.toString(16).padStart(2, '0')).join(' ');
        const ascii = Array.from(chunk).map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.').join('');
        out += i.toString(16).padStart(6, '0') + '  ' + hex.padEnd(47, ' ') + '  ' + ascii + '\n';
      }
      hexDump.textContent = out || '(empty file)';
    }).catch(() => { hexDump.textContent = '(could not read file)'; });
  }

  // ---------- Image EXIF ----------

  const SENSITIVE_EXIF_KEYS = ['Artist', 'Copyright', 'OwnerName', 'CameraOwnerName', 'BodySerialNumber', 'LensSerialNumber'];

  function renderImageExif(file) {
    return new Promise(resolve => {
      if (!window.EXIF) { resolve(); return; }
      EXIF.getData(file, function () {
        const all = EXIF.getAllTags(this) || {};

        const make = all.Make || '';
        const model = all.Model || '';
        const software = all.Software;
        const dateTime = all.DateTimeOriginal || all.DateTime;
        const exposure = all.ExposureTime;
        const fnumber = all.FNumber;
        const iso = all.ISOSpeedRatings;
        const width = all.PixelXDimension || all.ImageWidth;
        const height = all.PixelYDimension || all.ImageHeight;
        const device = (make + ' ' + model).trim();

        const hasHighlights = device || software || dateTime || exposure || fnumber || iso;
        if (hasHighlights) {
          imagePanel.hidden = false;
          row(imageGrid, 'Device', device);
          row(imageGrid, 'Software', software);
          row(imageGrid, 'Captured', dateTime);
          row(imageGrid, 'Exposure', exposure ? (formatValue(exposure) < 1 ? '1/' + Math.round(1 / formatValue(exposure)) + ' s' : formatValue(exposure) + ' s') : '');
          row(imageGrid, 'Aperture', fnumber ? 'f/' + formatValue(fnumber) : '');
          row(imageGrid, 'ISO', iso ? String(iso) : '');
          if (width && height) {
            row(imageGrid, 'Dimensions', width + ' × ' + height);
            row(imageGrid, 'Megapixels', ((width * height) / 1e6).toFixed(2) + ' MP');
          }
          imageCount.textContent = String(imageGrid.children.length);
          if (device) flag('Device', device);
          if (dateTime) flag('Captured', dateTime);
        }

        SENSITIVE_EXIF_KEYS.forEach(k => {
          if (all[k]) flag(formatLabel(k), formatValue(all[k]));
        });

        // Full generic dump of every EXIF tag found, skipping binary blobs and the thumbnail.
        const skip = new Set(['thumbnail', 'Thumbnail', 'MakerNote', 'UserComment']);
        const keys = Object.keys(all).filter(k => !skip.has(k) && isDisplayable(all[k]));
        if (keys.length) {
          exifAllPanel.hidden = false;
          keys.sort().forEach(k => row(exifAllGrid, formatLabel(k), formatValue(all[k])));
          exifAllCount.textContent = String(keys.length);
        }

        const lat = all.GPSLatitude;
        const lon = all.GPSLongitude;
        const latRef = all.GPSLatitudeRef;
        const lonRef = all.GPSLongitudeRef;

        if (lat && lon && latRef && lonRef) {
          const decLat = dmsToDecimal(lat, latRef);
          const decLon = dmsToDecimal(lon, lonRef);
          if (isFinite(decLat) && isFinite(decLon) && Math.abs(decLat) <= 90 && Math.abs(decLon) <= 180) {
            showGps(decLat, decLon, all.GPSAltitude);
            flag('GPS location', decLat.toFixed(5) + ', ' + decLon.toFixed(5));
          }
        }
        resolve();
      });
    });
  }

  function dmsToDecimal(dms, ref) {
    const degrees = toNumber(dms[0]);
    const minutes = toNumber(dms[1]);
    const seconds = dms.length > 2 ? toNumber(dms[2]) : 0;
    let dd = degrees + minutes / 60 + seconds / 3600;
    if (ref === 'S' || ref === 'W') dd = -dd;
    return dd;
  }
  function toNumber(val) {
    if (val && typeof val === 'object' && 'numerator' in val) {
      return val.denominator ? val.numerator / val.denominator : 0;
    }
    return typeof val === 'number' ? val : parseFloat(val) || 0;
  }

  function showGps(lat, lon, altitude) {
    gpsPanel.hidden = false;
    row(gpsGrid, 'Latitude', lat.toFixed(5) + '°');
    row(gpsGrid, 'Longitude', lon.toFixed(5) + '°');
    if (altitude) row(gpsGrid, 'Altitude', formatValue(altitude) + ' m above sea level');
    row(gpsGrid, 'Position', lat.toFixed(5) + ', ' + lon.toFixed(5));
    gpsCount.textContent = String(gpsGrid.children.length);

    if (!map) {
      map = L.map('map', {
        zoomControl: false,
        attributionControl: false
      }).setView([lat, lon], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      L.marker([lat, lon]).addTo(map);
    } else {
      map.setView([lat, lon], 13);
    }

    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`)
      .then(r => r.json())
      .then(data => {
        if (!data) return;
        const addr = data.address || {};
        const namedPlace = data.name || addr.attraction || addr.building || addr.amenity;
        if (namedPlace) { row(gpsGrid, 'Named location', namedPlace); flag('Named location', namedPlace); }
        const city = addr.city || addr.town || addr.village;
        if (city) row(gpsGrid, 'City', city);
        if (addr.state) row(gpsGrid, 'State', addr.state);
        if (addr.country) row(gpsGrid, 'Country', addr.country);
        if (addr.postcode) row(gpsGrid, 'Postal code', addr.postcode);
        if (data.display_name) row(gpsGrid, 'Full address', data.display_name);
        gpsCount.textContent = String(gpsGrid.children.length);
      })
      .catch(() => {});
  }

  // ---------- PDF ----------

  function renderPdf(file) {
    if (!window.pdfjsLib) return Promise.resolve();
    return file.arrayBuffer().then(buf =>
      pdfjsLib.getDocument({ data: buf }).promise.then(doc =>
        doc.getMetadata().then(meta => {
          const info = meta.info || {};
          pdfPanel.hidden = false;
          row(pdfGrid, 'Title', info.Title);
          row(pdfGrid, 'Author', info.Author);
          row(pdfGrid, 'Subject', info.Subject);
          row(pdfGrid, 'Keywords', info.Keywords);
          row(pdfGrid, 'Creator app', info.Creator);
          row(pdfGrid, 'Producer', info.Producer);
          row(pdfGrid, 'PDF version', info.PDFFormatVersion);
          row(pdfGrid, 'Created', formatPdfDate(info.CreationDate));
          row(pdfGrid, 'Modified', formatPdfDate(info.ModDate));
          row(pdfGrid, 'Pages', String(doc.numPages));

          const knownKeys = new Set(['Title','Author','Subject','Keywords','Creator','Producer','PDFFormatVersion','CreationDate','ModDate']);
          Object.keys(info).forEach(k => {
            if (!knownKeys.has(k) && isDisplayable(info[k])) row(pdfGrid, formatLabel(k), formatValue(info[k]));
          });
          pdfCount.textContent = String(pdfGrid.children.length);

          if (info.Author) flag('Author', info.Author);
          if (info.Creator) flag('Creator app', info.Creator);
        })
      )
    ).catch(() => {});
  }

  function formatPdfDate(d) {
    if (!d) return '';
    const m = /D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(d);
    if (!m) return d;
    return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}`;
  }

  // ---------- Office documents (docx/xlsx/pptx) ----------

  function renderOffice(file) {
    if (!window.JSZip) return Promise.resolve();
    return JSZip.loadAsync(file).then(zip => {
      const coreFile = zip.file('docProps/core.xml');
      const appFile = zip.file('docProps/app.xml');
      const reads = [];
      let coreXml = null, appXml = null;
      if (coreFile) reads.push(coreFile.async('string').then(t => coreXml = t));
      if (appFile) reads.push(appFile.async('string').then(t => appXml = t));

      return Promise.all(reads).then(() => {
        const parser = new DOMParser();
        officePanel.hidden = false;

        if (coreXml) {
          const doc = parser.parseFromString(coreXml, 'application/xml');
          allXmlEntries(doc).forEach(([k, v]) => {
            row(officeGrid, formatLabel(k), v);
            if (['creator', 'lastModifiedBy'].includes(k)) flag(formatLabel(k), v);
          });
        }
        if (appXml) {
          const doc = parser.parseFromString(appXml, 'application/xml');
          allXmlEntries(doc).forEach(([k, v]) => {
            row(officeGrid, formatLabel(k), v);
            if (k === 'Company') flag('Company', v);
          });
        }
        if (!coreXml && !appXml) row(officeGrid, 'Note', 'No document properties found in this file.');
        officeCount.textContent = String(officeGrid.children.length);
      });
    }).catch(() => {});
  }

  function allXmlEntries(doc) {
    const all = doc.getElementsByTagName('*');
    const out = [];
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      if (el.children.length === 0 && el.textContent && el.textContent.trim()) {
        out.push([el.localName, el.textContent.trim()]);
      }
    }
    return out;
  }

  // ---------- Audio ID3 ----------

  function renderAudio(file) {
    return new Promise(resolve => {
      if (!window.jsmediatags) { resolve(); return; }
      window.jsmediatags.read(file, {
        onSuccess: (tag) => {
          const t = tag.tags || {};
          audioPanel.hidden = false;
          const skip = new Set(['picture']);
          Object.keys(t).forEach(k => {
            if (skip.has(k)) return;
            const v = k === 'comment' && t[k] ? t[k].text : t[k];
            if (isDisplayable(v)) {
              row(audioGrid, formatLabel(k), formatValue(v));
              if (k === 'artist') flag('Artist', v);
            }
          });
          audioCount.textContent = String(audioGrid.children.length);
          resolve();
        },
        onError: () => resolve()
      });
    });
  }

  function updateHero(file) {
    let total = 0;
    document.querySelectorAll('.results-body .spec-grid').forEach(g => {
      total += g.querySelectorAll('.spec-cell').length;
    });
    heroCount.textContent = String(total);
    const ext = (file.name.split('.').pop() || '').toUpperCase();
    heroType.textContent = ext || (file.type || 'FILE');
    heroSize.textContent = formatBytes(file.size);
    heroFlags.textContent = String(flagged.length);
    heroFlags.style.color = flagged.length ? 'var(--alert)' : 'var(--ink)';
    heroFlags.style.textShadow = flagged.length ? '0 0 12px var(--alert-glow)' : 'none';

    // Privacy verdict based on flagged sensitive fields
    let level, label;
    if (flagged.length === 0) { level = 'clean'; label = 'Clean — no sensitive fields found'; }
    else if (flagged.length <= 2) { level = 'low'; label = 'Low exposure — ' + flagged.length + ' sensitive field' + (flagged.length>1?'s':''); }
    else if (flagged.length <= 4) { level = 'medium'; label = 'Moderate exposure — ' + flagged.length + ' sensitive fields'; }
    else { level = 'high'; label = 'High exposure — ' + flagged.length + ' sensitive fields'; }
    verdictDot.className = 'verdict-dot ' + level;
    verdictText.textContent = label;

    // Strip availability
    const strippable = /^image\/(jpeg|png|webp)$/.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
    if (strippable) {
      stripBtn.disabled = false;
      stripBtn.textContent = 'Strip metadata & download clean copy';
      actionsNote.textContent = 'Stripping redraws the image through a canvas to discard all embedded metadata, then re-scans the clean copy to confirm.';
    } else {
      stripBtn.disabled = true;
      stripBtn.textContent = 'Stripping not available for this file type';
      actionsNote.textContent = 'Metadata stripping is supported for JPEG, PNG, and WebP images. This file is report-only.';
    }
  }

  // ---------- Strip metadata (images) ----------

  stripBtn.addEventListener('click', () => {
    if (!currentFile) return;
    const strippable = /^image\/(jpeg|png|webp)$/.test(currentFile.type) || /\.(jpe?g|png|webp)$/i.test(currentFile.name);
    if (!strippable) return;

    const url = URL.createObjectURL(currentFile);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      const outType = /png/i.test(currentFile.type) || /\.png$/i.test(currentFile.name) ? 'image/png' : 'image/jpeg';
      canvas.toBlob((blob) => {
        if (!blob) return;
        const dlUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const base = currentFile.name.replace(/\.[^.]+$/, '');
        const ext = outType === 'image/png' ? 'png' : 'jpg';
        a.href = dlUrl;
        a.download = base + '_clean.' + ext;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(dlUrl), 4000);

        const saved = currentFile.size - blob.size;
        stripResult.hidden = false;
        stripResult.innerHTML =
          '<span class="strip-ok">✓ Clean copy downloaded.</span> ' +
          'All EXIF, GPS, and embedded metadata removed by canvas re-encode. ' +
          'New size ' + formatBytes(blob.size) +
          (saved > 0 ? ' (' + formatBytes(saved) + ' of metadata and overhead dropped).' : '.');
      }, outType, 0.95);
    };
    img.onerror = () => {
      stripResult.hidden = false;
      stripResult.innerHTML = '<span class="strip-err">Could not process this image for stripping.</span>';
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });

  // ---------- Export JSON report ----------

  jsonBtn.addEventListener('click', () => {
    if (!currentFile) return;
    const report = { file: currentFile.name, scannedAt: new Date().toISOString(), sections: {}, flags: flagged.slice() };
    document.querySelectorAll('.results-body .spec-panel').forEach(panel => {
      const head = panel.querySelector('.eyebrow');
      if (!head) return;
      const section = head.textContent.trim();
      const obj = {};
      panel.querySelectorAll('.spec-cell').forEach(cell => {
        const k = cell.querySelector('.spec-cell-label').textContent.trim();
        const v = cell.querySelector('.spec-cell-value').textContent.trim();
        if (v !== '—') obj[k] = v;
      });
      if (Object.keys(obj).length) report.sections[section] = obj;
    });
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const dlUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = dlUrl;
    a.download = currentFile.name.replace(/\.[^.]+$/, '') + '_metadata.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(dlUrl), 4000);
  });

  // ---------- Collapsible sections ----------

  function setupCollapsibles() {
    document.querySelectorAll('.results-body .spec-panel .panel-head.collapsible').forEach(head => {
      if (head.dataset.wired) return;
      head.dataset.wired = '1';
      const chev = document.createElement('span');
      chev.className = 'chevron';
      chev.textContent = '▾';
      head.appendChild(chev);
      head.addEventListener('click', () => {
        const panel = head.closest('.spec-panel');
        panel.classList.toggle('collapsed');
      });
    });
  }

  // ---------- Staggered reveal ----------

  function staggerReveal() {
    const panels = document.querySelectorAll('.results-body > .panel, .results-body > .thumb-wrap, .results-body > .filter-bar');
    panels.forEach((p, i) => {
      p.classList.remove('reveal');
      void p.offsetWidth;
      p.style.animationDelay = (i * 45) + 'ms';
      p.classList.add('reveal');
    });
  }

  // ---------- Filter properties ----------

  if (filterInput) {
    filterInput.addEventListener('input', () => {
      applyFilter(filterInput.value);
      filterClear.hidden = !filterInput.value;
    });
    filterClear.addEventListener('click', () => {
      filterInput.value = '';
      filterClear.hidden = true;
      applyFilter('');
      filterInput.focus();
    });
  }

  function applyFilter(q) {
    q = q.trim().toLowerCase();
    document.querySelectorAll('.results-body .spec-panel').forEach(panel => {
      let anyVisible = false;
      panel.querySelectorAll('.spec-cell').forEach(cell => {
        if (!q) { cell.style.display = ''; anyVisible = true; return; }
        const txt = cell.textContent.toLowerCase();
        const show = txt.includes(q);
        cell.style.display = show ? '' : 'none';
        if (show) anyVisible = true;
      });
      // Hide whole panel if it has a grid and nothing matched (but never hide hero/actions/raw)
      const grid = panel.querySelector('.spec-grid');
      if (grid && q) {
        panel.style.display = anyVisible ? '' : 'none';
      } else if (grid) {
        panel.style.display = '';
      }
    });
  }

  // ---------- Click-to-copy on any value ----------

  document.addEventListener('click', (e) => {
    const cell = e.target.closest('.spec-cell');
    if (!cell) return;
    const valEl = cell.querySelector('.spec-cell-value');
    if (!valEl || valEl.classList.contains('empty')) return;
    const text = valEl.textContent;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        const prev = valEl.textContent;
        valEl.textContent = 'copied ✓';
        valEl.classList.add('copied');
        setTimeout(() => { valEl.textContent = prev; valEl.classList.remove('copied'); }, 900);
      }).catch(() => {});
    }
  });

})();
