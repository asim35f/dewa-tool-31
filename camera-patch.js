/* camera-patch.js — Mandatory Photo Proof of Completion
   SAFE VERSION: only intercepts saveM(), zero side effects on other features */

(function(){
  'use strict';

  var _photoB64  = null;
  var _photoMime = 'image/jpeg';

  // ── Compress photo ───────────────────────────────────────────────────────
  function compressImage(file, cb){
    try{
      var reader = new FileReader();
      reader.onload = function(ev){
        var img = new Image();
        img.onload = function(){
          var MAX=1024, w=img.width, h=img.height;
          if(w>MAX){h=Math.round(h*MAX/w);w=MAX;}
          if(h>MAX){w=Math.round(w*MAX/h);h=MAX;}
          var c=document.createElement('canvas');
          c.width=w; c.height=h;
          c.getContext('2d').drawImage(img,0,0,w,h);
          var dataUrl=c.toDataURL('image/jpeg',0.75);
          cb(dataUrl.split(',')[1],'image/jpeg');
        };
        img.onerror=function(){ cb(null,'Image load error'); };
        img.src=ev.target.result;
      };
      reader.onerror=function(){ cb(null,'File read error'); };
      reader.readAsDataURL(file);
    }catch(e){ cb(null, e.message); }
  }

  // ── Upload to Apps Script ────────────────────────────────────────────────
  function uploadPhoto(notifNo, b64, mime, cb){
    try{
      if(typeof _wbUrl==='undefined'||!_wbUrl){ cb(null,'No URL configured'); return; }
      fetch(_wbUrl,{
        method:'POST',
        headers:{'Content-Type':'text/plain'},
        body:JSON.stringify({action:'savePhoto',notifNo:notifNo,photoData:b64,mimeType:mime})
      })
      .then(function(r){return r.json();})
      .then(function(d){ d.ok ? cb(d.url,null) : cb(null,d.msg||'Upload failed'); })
      .catch(function(e){ cb(null,e.message); });
    }catch(e){ cb(null,e.message); }
  }

  // ── Build camera section DOM ─────────────────────────────────────────────
  function buildCamSection(){
    var wrap=document.createElement('div');
    wrap.id='camSection';
    wrap.style.cssText='padding:12px;background:rgba(99,102,241,.06);border:1px solid rgba(99,102,241,.3);border-radius:10px;margin:8px 0 4px';

    var lbl=document.createElement('div');
    lbl.style.cssText='font-size:12px;font-weight:700;color:#818cf8;margin-bottom:8px';
    lbl.innerHTML='📷 Photo Proof <span style="color:#ef4444">*</span> <span style="font-weight:400;color:#94a3b8;font-size:10px">(mandatory for Completed)</span>';

    var btn=document.createElement('button');
    btn.id='camBtn'; btn.type='button';
    btn.innerHTML='📷 Take Photo / Choose from Gallery';
    btn.style.cssText='width:100%;padding:10px;background:rgba(99,102,241,.12);border:1px solid rgba(99,102,241,.4);color:#818cf8;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600';

    var inp=document.createElement('input');
    inp.type='file'; inp.id='camInput';
    inp.accept='image/*';
    inp.style.display='none';

    var prev=document.createElement('div');
    prev.id='camPreview';
    prev.style.cssText='display:none;text-align:center;margin-top:8px';

    var err=document.createElement('div');
    err.id='camErr';
    err.style.cssText='display:none;color:#ef4444;font-size:11px;margin-top:6px;padding:7px;background:rgba(239,68,68,.08);border-radius:6px;text-align:center';

    inp.onchange=function(){
      var file=inp.files[0]; if(!file)return;
      _photoB64=null;
      btn.disabled=true; btn.innerHTML='⏳ Compressing...';
      compressImage(file,function(b64,mime){
        if(!b64){
          btn.disabled=false; btn.innerHTML='📷 Try Again';
          err.textContent='Could not process image. Try another photo.';
          err.style.display='block'; return;
        }
        _photoB64=b64; _photoMime=mime;
        var kb=Math.round(b64.length*0.75/1024);
        prev.innerHTML='<img src="data:image/jpeg;base64,'+b64+'" style="max-width:100%;max-height:160px;border-radius:8px;border:2px solid #22c55e;display:block;margin:0 auto">'
          +'<div style="font-size:10px;color:#22c55e;margin-top:4px">✔ Photo ready — '+kb+' KB</div>';
        prev.style.display='block';
        btn.disabled=false;
        btn.innerHTML='📷 Change Photo';
        btn.style.cssText='width:100%;padding:10px;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.4);color:#22c55e;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600';
        err.style.display='none';
      });
    };

    btn.onclick=function(e){ e.preventDefault(); inp.click(); };

    wrap.appendChild(lbl); wrap.appendChild(btn);
    wrap.appendChild(inp); wrap.appendChild(prev); wrap.appendChild(err);
    return wrap;
  }

  // ── Inject camera section above Save button ──────────────────────────────
  function injectCamUI(){
    if(document.getElementById('camSection')) return;
    var saveBtn=document.querySelector('button[onclick="saveM()"]')
             ||document.querySelector('button[onclick*="saveM"]');
    if(!saveBtn) return;
    saveBtn.parentNode.insertBefore(buildCamSection(), saveBtn);
  }

  // ── Remove camera section and reset ─────────────────────────────────────
  function removeCamUI(){
    var s=document.getElementById('camSection');
    if(s&&s.parentNode) s.parentNode.removeChild(s);
    _photoB64=null;
  }

  // ── Override saveM — ONLY modification to existing code ─────────────────
  function patchSaveM(){
    if(typeof saveM==='undefined') return;   // not in a team file, do nothing
    var _orig=saveM;

    window.saveM=function(){
      try{
        var statEl=document.getElementById('mStat');

        // Not completing → original behaviour, no interference
        if(!statEl || statEl.value.toLowerCase()!=='completed'){
          removeCamUI();   // clean up if it was showing
          _orig(); return;
        }

        // Status = Completed → ensure camera UI is visible
        injectCamUI();

        var errEl=document.getElementById('camErr');

        // No photo → block save, show message
        if(!_photoB64){
          if(errEl){errEl.textContent='📷 A photo is required to mark as Completed.';errEl.style.color='#ef4444';errEl.style.display='block';}
          var sec=document.getElementById('camSection');
          if(sec) sec.scrollIntoView({behavior:'smooth',block:'center'});
          return;
        }

        // Photo ready → upload then save
        var saveBtn=document.querySelector('button[onclick="saveM()"]')
                 ||document.querySelector('button[onclick*="saveM"]');
        if(saveBtn){saveBtn.disabled=true;saveBtn.textContent='⏳ Uploading photo...';}
        if(errEl){errEl.textContent='⏳ Uploading to Google Drive...';errEl.style.color='#f59e0b';errEl.style.display='block';}

        var notif=(typeof curN!=='undefined')?curN:'';
        var b64=_photoB64, mime=_photoMime;

        uploadPhoto(notif,b64,mime,function(url,uploadErr){
          if(saveBtn){saveBtn.disabled=false;saveBtn.textContent='Save & Mark Complete';}

          if(uploadErr){
            if(errEl){errEl.textContent='❌ Upload failed: '+uploadErr+'. Try again.';errEl.style.color='#ef4444';errEl.style.display='block';}
            return;
          }

          // Store Drive link in jobData
          if(notif&&typeof jobData!=='undefined'){
            if(!jobData[notif])jobData[notif]={};
            jobData[notif].photoUrl=url;
          }

          if(errEl){errEl.textContent='✔ Photo uploaded!';errEl.style.color='#22c55e';errEl.style.display='block';}
          removeCamUI();
          setTimeout(_orig,300);
        });

      }catch(e){
        // Safety net: if anything goes wrong, let original saveM run
        console.warn('camera-patch error:',e.message);
        if(typeof _orig==='function') _orig();
      }
    };
  }

  // ── Reset photo state when a different job is opened ────────────────────
  // Watch for curN changes by polling (safe, no interference with other code)
  var _lastN = null;
  setInterval(function(){
    if(typeof curN!=='undefined' && curN!==_lastN){
      _lastN=curN;
      removeCamUI();
    }
  }, 300);

  // ── Single init — run once, safely ──────────────────────────────────────
  var _initDone=false;
  function init(){
    if(_initDone) return;
    _initDone=true;
    patchSaveM();
  }

  // Handle both: script loads before DOMContentLoaded OR after
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',function(){ setTimeout(init,400); });
  } else {
    setTimeout(init,400);
  }

})();
