/* camera-patch.js — Mandatory Photo Proof of Completion
   Uses <label> trick for reliable camera/gallery on all phones */

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
    }catch(e){ cb(null,e.message); }
  }

  // ── Upload to Apps Script ────────────────────────────────────────────────
  function uploadPhoto(notifNo, b64, mime, cb){
    try{
      if(typeof _wbUrl==='undefined'||!_wbUrl){ cb(null,'No Apps Script URL'); return; }
      fetch(_wbUrl,{
        method:'POST',
        headers:{'Content-Type':'text/plain'},
        body:JSON.stringify({action:'savePhoto',notifNo:notifNo,photoData:b64,mimeType:mime})
      })
      .then(function(r){ return r.json(); })
      .then(function(d){ d.ok ? cb(d.url,null) : cb(null, d.msg||'Upload failed'); })
      .catch(function(e){ cb(null, e.message); });
    }catch(e){ cb(null, e.message); }
  }

  // ── Build camera section ─────────────────────────────────────────────────
  function buildCamSection(){
    var wrap=document.createElement('div');
    wrap.id='camSection';
    wrap.style.cssText='padding:12px;background:rgba(99,102,241,.06);border:1px solid rgba(99,102,241,.3);border-radius:10px;margin:8px 0 4px';

    // Heading
    var lbl=document.createElement('div');
    lbl.style.cssText='font-size:12px;font-weight:700;color:#818cf8;margin-bottom:8px';
    lbl.innerHTML='📷 Photo Proof <span style="color:#ef4444">*</span> <span style="font-weight:400;color:#94a3b8;font-size:10px">(required to complete)</span>';

    // Hidden file input — accept image/* gives both camera and gallery on mobile
    var inp=document.createElement('input');
    inp.type='file';
    inp.id='camInput';
    inp.accept='image/*';
    // Visually hidden but accessible — NOT display:none (that blocks on some phones)
    inp.style.cssText='position:absolute;width:0;height:0;opacity:0;overflow:hidden;pointer-events:none';

    // LABEL pointing to the input — this is the reliable cross-platform trigger
    // Tapping the label natively opens the file/camera picker without any JS click()
    var trigger=document.createElement('label');
    trigger.id='camBtn';
    trigger.setAttribute('for','camInput');
    trigger.style.cssText='display:block;width:100%;padding:11px;background:rgba(99,102,241,.12);border:1px solid rgba(99,102,241,.4);color:#818cf8;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;text-align:center;box-sizing:border-box;-webkit-tap-highlight-color:rgba(0,0,0,0)';
    trigger.innerHTML='📷 Take Photo / Choose from Gallery';

    // Preview area
    var prev=document.createElement('div');
    prev.id='camPreview';
    prev.style.cssText='display:none;text-align:center;margin-top:8px';

    // Error/status message
    var err=document.createElement('div');
    err.id='camErr';
    err.style.cssText='display:none;font-size:11px;margin-top:6px;padding:7px;border-radius:6px;text-align:center';

    // File selected handler
    inp.onchange=function(){
      var file=inp.files[0];
      if(!file) return;
      _photoB64=null;
      trigger.innerHTML='⏳ Processing photo...';
      trigger.style.pointerEvents='none';
      trigger.style.opacity='0.7';

      compressImage(file, function(b64, mime){
        trigger.style.pointerEvents='';
        trigger.style.opacity='';
        if(!b64){
          trigger.innerHTML='📷 Try Again';
          err.textContent='Could not process image. Try another photo.';
          err.style.color='#ef4444';
          err.style.background='rgba(239,68,68,.08)';
          err.style.display='block';
          return;
        }
        _photoB64=b64;
        _photoMime=mime;
        var kb=Math.round(b64.length*0.75/1024);

        prev.innerHTML=
          '<img src="data:image/jpeg;base64,'+b64+'" '
          +'style="max-width:100%;max-height:160px;border-radius:8px;'
          +'border:2px solid #22c55e;display:block;margin:0 auto">'
          +'<div style="font-size:10px;color:#22c55e;margin-top:4px">✔ Photo ready — '+kb+' KB</div>';
        prev.style.display='block';

        trigger.innerHTML='📷 Change Photo';
        trigger.style.cssText='display:block;width:100%;padding:11px;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.4);color:#22c55e;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;text-align:center;box-sizing:border-box';

        err.style.display='none';
      });
    };

    wrap.appendChild(lbl);
    wrap.appendChild(inp);    // input must be in DOM before label
    wrap.appendChild(trigger);
    wrap.appendChild(prev);
    wrap.appendChild(err);
    return wrap;
  }

  // ── Inject / remove camera section ──────────────────────────────────────
  function injectCamUI(){
    if(document.getElementById('camSection')) return;
    // Try multiple selectors to find the Save button
    var saveBtn=document.querySelector('button[onclick="saveM()"]')
             ||document.querySelector('button[onclick*="saveM"]')
             ||document.querySelector('.sbtn')
             ||document.querySelector('[onclick*="saveM"]');
    if(!saveBtn) return;
    saveBtn.parentNode.insertBefore(buildCamSection(), saveBtn);
  }

  function removeCamUI(){
    var s=document.getElementById('camSection');
    if(s&&s.parentNode) s.parentNode.removeChild(s);
    _photoB64=null;
  }

  // ── Override saveM ───────────────────────────────────────────────────────
  function patchSaveM(){
    if(typeof saveM==='undefined') return;
    var _orig=saveM;

    window.saveM=function(){
      try{
        var statEl=document.getElementById('mStat');

        // Not completing → pass through immediately, no interference
        if(!statEl||statEl.value.toLowerCase()!=='completed'){
          removeCamUI();
          _orig();
          return;
        }

        // Status = Completed → show camera section
        injectCamUI();
        var errEl=document.getElementById('camErr');

        // No photo yet → block and prompt
        if(!_photoB64){
          if(errEl){
            errEl.textContent='📷 Please take or select a photo to continue.';
            errEl.style.color='#ef4444';
            errEl.style.background='rgba(239,68,68,.08)';
            errEl.style.display='block';
          }
          var sec=document.getElementById('camSection');
          if(sec) sec.scrollIntoView({behavior:'smooth',block:'center'});
          return;
        }

        // Photo ready → upload then save
        var saveBtn=document.querySelector('button[onclick="saveM()"]')
                 ||document.querySelector('button[onclick*="saveM"]')
                 ||document.querySelector('.sbtn');
        if(saveBtn){saveBtn.disabled=true;saveBtn.textContent='⏳ Uploading photo...';}
        if(errEl){
          errEl.textContent='⏳ Uploading to Google Drive...';
          errEl.style.color='#f59e0b';
          errEl.style.background='rgba(245,158,11,.08)';
          errEl.style.display='block';
        }

        var notif=(typeof curN!=='undefined')?curN:'';
        var b64=_photoB64, mime=_photoMime;

        uploadPhoto(notif, b64, mime, function(url, uploadErr){
          if(saveBtn){saveBtn.disabled=false;saveBtn.textContent='Save & Mark Complete';}

          if(uploadErr){
            if(errEl){
              errEl.textContent='❌ Upload failed: '+uploadErr+'. Try again.';
              errEl.style.color='#ef4444';
              errEl.style.background='rgba(239,68,68,.08)';
              errEl.style.display='block';
            }
            return;
          }

          // Store Drive link
          if(notif&&typeof jobData!=='undefined'){
            if(!jobData[notif])jobData[notif]={};
            jobData[notif].photoUrl=url;
          }

          if(errEl){
            errEl.textContent='✔ Photo uploaded successfully!';
            errEl.style.color='#22c55e';
            errEl.style.background='rgba(34,197,94,.08)';
            errEl.style.display='block';
          }

          removeCamUI();
          setTimeout(_orig, 300);
        });

      }catch(e){
        // Safety net — never break job saving
        console.warn('camera-patch error:',e.message);
        try{ _orig(); }catch(e2){}
      }
    };
  }

  // ── Reset when job changes ────────────────────────────────────────────────
  var _lastN=null;
  setInterval(function(){
    try{
      if(typeof curN!=='undefined'&&curN!==_lastN){
        _lastN=curN; removeCamUI();
      }
    }catch(e){}
  },300);

  // ── Init (works whether DOMContentLoaded has fired or not) ───────────────
  function init(){
    setTimeout(patchSaveM, 500);
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
