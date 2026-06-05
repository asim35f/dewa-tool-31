/* camera-patch.js — Mandatory Photo Proof of Completion
   Loaded automatically via patch.js.
   Intercepts saveM() to require a photo when marking any job as Completed.
   Photo is compressed in-browser, uploaded to Google Drive via Apps Script,
   and the Drive link is saved to Column N of the Google Sheet. */

(function(){
  'use strict';

  var _photoB64  = null;   // compressed base64 of selected photo
  var _photoMime = 'image/jpeg';

  // ── Compress photo using Canvas (target: < 500KB) ────────────────────────
  function compressImage(file, cb){
    var reader = new FileReader();
    reader.onload = function(ev){
      var img = new Image();
      img.onload = function(){
        var MAX = 1024;
        var w = img.width, h = img.height;
        if(w > MAX){ h = Math.round(h * MAX / w); w = MAX; }
        if(h > MAX){ w = Math.round(w * MAX / h); h = MAX; }
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        var dataUrl = canvas.toDataURL('image/jpeg', 0.75);
        cb(dataUrl.split(',')[1], 'image/jpeg');
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  // ── Upload base64 photo to Drive via Apps Script POST ────────────────────
  function uploadPhoto(notifNo, b64, mime, cb){
    if(typeof _wbUrl === 'undefined' || !_wbUrl){ cb(null, 'Apps Script URL not set'); return; }
    fetch(_wbUrl, {
      method : 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body   : JSON.stringify({ action:'savePhoto', notifNo:notifNo, photoData:b64, mimeType:mime })
    })
    .then(function(r){ return r.json(); })
    .then(function(d){ d.ok ? cb(d.url, null) : cb(null, d.msg || 'Upload failed'); })
    .catch(function(e){ cb(null, e.message); });
  }

  // ── Reset photo state and UI ─────────────────────────────────────────────
  function resetPhoto(){
    _photoB64 = null;
    var prev = document.getElementById('camPreview');
    var btn  = document.getElementById('camBtn');
    var err  = document.getElementById('camErr');
    var inp  = document.getElementById('camInput');
    if(inp)  inp.value = '';
    if(prev){ prev.innerHTML = ''; prev.style.display = 'none'; }
    if(err)  err.style.display = 'none';
    if(btn){
      btn.disabled = false;
      btn.innerHTML = '📷 Take Photo / Choose from Gallery';
      btn.style.cssText = CAM_BTN_IDLE;
    }
  }

  // ── Button style constants ────────────────────────────────────────────────
  var CAM_BTN_IDLE = 'width:100%;padding:11px;background:rgba(99,102,241,.12);border:1px solid rgba(99,102,241,.4);color:#818cf8;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;';
  var CAM_BTN_DONE = 'width:100%;padding:11px;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.4);color:#22c55e;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;';

  // ── Build the camera section DOM ─────────────────────────────────────────
  function buildCamSection(){
    var wrap = document.createElement('div');
    wrap.id = 'camSection';
    wrap.style.cssText = 'padding:12px;background:rgba(99,102,241,.06);border:1px solid rgba(99,102,241,.3);border-radius:10px;margin:8px 0 4px';

    var lbl = document.createElement('div');
    lbl.style.cssText = 'font-size:12px;font-weight:700;color:#818cf8;margin-bottom:8px';
    lbl.innerHTML = '📷 Photo Proof &nbsp;<span style="color:#ef4444;font-size:13px">*</span>&nbsp;<span style="font-weight:400;color:#94a3b8;font-size:10px">(mandatory)</span>';

    var btn = document.createElement('button');
    btn.id = 'camBtn';
    btn.type = 'button';
    btn.innerHTML = '📷 Take Photo / Choose from Gallery';
    btn.style.cssText = CAM_BTN_IDLE;

    var inp = document.createElement('input');
    inp.type = 'file';
    inp.id   = 'camInput';
    inp.accept = 'image/*';
    
    inp.style.display = 'none';

    var prev = document.createElement('div');
    prev.id = 'camPreview';
    prev.style.cssText = 'display:none;text-align:center;margin-top:8px';

    var err = document.createElement('div');
    err.id = 'camErr';
    err.style.cssText = 'display:none;color:#ef4444;font-size:11px;margin-top:6px;padding:7px 10px;background:rgba(239,68,68,.08);border-radius:6px;text-align:center';

    // File input change handler
    inp.onchange = function(){
      var file = inp.files[0];
      if(!file) return;
      _photoB64 = null;
      btn.disabled = true;
      btn.innerHTML = '⏳ Compressing...';
      compressImage(file, function(b64, mime){
        _photoB64 = b64;
        _photoMime = mime;
        var kb = Math.round(b64.length * 0.75 / 1024);
        prev.innerHTML =
          '<img src="data:image/jpeg;base64,' + b64 + '" '
          + 'style="max-width:100%;max-height:160px;border-radius:8px;border:2px solid #22c55e;display:block;margin:0 auto">'
          + '<div style="font-size:10px;color:#22c55e;margin-top:4px">✔ Photo ready — ' + kb + ' KB</div>';
        prev.style.display = 'block';
        btn.disabled = false;
        btn.innerHTML = '📷 Change Photo';
        btn.style.cssText = CAM_BTN_DONE;
        err.style.display = 'none';
      });
    };

    btn.onclick = function(){ inp.click(); };

    wrap.appendChild(lbl);
    wrap.appendChild(btn);
    wrap.appendChild(inp);
    wrap.appendChild(prev);
    wrap.appendChild(err);
    return wrap;
  }

  // ── Inject / refresh camera section before the Save button ──────────────
  function injectCamUI(){
    var existing = document.getElementById('camSection');
    if(existing){ return; }          // already there

    var saveBtn = document.querySelector('button[onclick="saveM()"]')
               || document.querySelector('button[onclick*="saveM"]');
    if(!saveBtn) return;

    var sec = buildCamSection();
    saveBtn.parentNode.insertBefore(sec, saveBtn);
  }

  function removeCamUI(){
    var sec = document.getElementById('camSection');
    if(sec && sec.parentNode) sec.parentNode.removeChild(sec);
    _photoB64 = null;
  }

  // ── Show camera section when status changes to Completed ─────────────────
  document.addEventListener('change', function(e){
    if(!e.target || e.target.id !== 'mStat') return;
    if(e.target.value.toLowerCase() === 'completed'){
      injectCamUI();
    } else {
      removeCamUI();
    }
  });

  // ── Override saveM ────────────────────────────────────────────────────────
  function patchSaveM(){
    if(typeof saveM === 'undefined'){ return; }
    var _orig = saveM;

    window.saveM = function(){
      var statEl = document.getElementById('mStat');

      // Not completing — let original handle it
      if(!statEl || statEl.value.toLowerCase() !== 'completed'){
        _orig(); return;
      }

      // Make sure camera section is visible
      injectCamUI();

      var errEl   = document.getElementById('camErr');
      var saveBtn = document.querySelector('button[onclick="saveM()"]')
                 || document.querySelector('button[onclick*="saveM"]');

      // No photo selected yet
      if(!_photoB64){
        if(errEl){
          errEl.textContent = '📷 A photo is required before marking as Completed.';
          errEl.style.display = 'block';
        }
        var sec = document.getElementById('camSection');
        if(sec) sec.scrollIntoView({ behavior:'smooth', block:'center' });
        return;
      }

      // Photo ready — upload first, then save
      if(saveBtn){ saveBtn.disabled = true; saveBtn.textContent = '⏳ Uploading photo...'; }
      if(errEl){
        errEl.textContent = '⏳ Uploading photo to Google Drive...';
        errEl.style.color  = '#f59e0b';
        errEl.style.display = 'block';
      }

      var notif = (typeof curN !== 'undefined') ? curN : '';
      var b64   = _photoB64;
      var mime  = _photoMime;

      uploadPhoto(notif, b64, mime, function(url, uploadErr){
        // Re-enable button regardless
        if(saveBtn){ saveBtn.disabled = false; saveBtn.textContent = 'Save & Mark Complete'; }

        if(uploadErr){
          if(errEl){
            errEl.textContent  = '❌ Upload failed: ' + uploadErr + '. Please try again.';
            errEl.style.color  = '#ef4444';
            errEl.style.display = 'block';
          }
          return;
        }

        // Store Drive link in jobData
        if(notif && typeof jobData !== 'undefined'){
          if(!jobData[notif]) jobData[notif] = {};
          jobData[notif].photoUrl = url;
        }

        if(errEl){
          errEl.textContent  = '✔ Photo uploaded to Drive!';
          errEl.style.color  = '#22c55e';
          errEl.style.display = 'block';
        }

        // Clean up and call original saveM
        removeCamUI();
        setTimeout(_orig, 300);
      });
    };
  }

  // ── Also reset photo when job panel opens for a new job ──────────────────
  // Detect job change by watching clicks on job cards
  document.addEventListener('click', function(e){
    var card = e.target.closest ? e.target.closest('[data-n]') : null;
    if(!card) return;
    removeCamUI();   // fresh start for every new job
  });

  // ── Init ─────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(patchSaveM, 400);   // wait for TEAM_JS + patch.js to finish
  });

})();
