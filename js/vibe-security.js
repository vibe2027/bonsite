(function(){
  'use strict';

  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>\"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];
    });
  }

  // Prevent user/database-controlled HTML from becoming executable markup.
  (function patchInnerHTML(){
    try{
      var proto=Element.prototype;
      var desc=Object.getOwnPropertyDescriptor(proto,'innerHTML');
      if(!desc || !desc.set || window.__vibeSafeHTMLPatched) return;
      var originalSet=desc.set;
      var allowed={DIV:1,SPAN:1,BR:1,STRONG:1,EM:1,B:1,A:1};
      var allowedAttrs={style:1,class:1,id:1,href:1,target:1,rel:1,title:1};
      function sanitize(html){
        var t=document.createElement('template');
        t.innerHTML=String(html);
        var nodes=Array.prototype.slice.call(t.content.querySelectorAll('*'));
        nodes.forEach(function(n){
          if(!allowed[n.tagName]){ n.replaceWith(document.createTextNode(n.textContent||'')); return; }
          Array.prototype.slice.call(n.attributes).forEach(function(a){
            var name=a.name.toLowerCase(), val=a.value||'';
            if(name.indexOf('on')===0 || !allowedAttrs[name] || (name==='href' && /^javascript:/i.test(val))){
              n.removeAttribute(a.name);
            }
          });
        });
        return t.innerHTML;
      }
      Object.defineProperty(proto,'innerHTML',{
        configurable:desc.configurable,
        enumerable:desc.enumerable,
        get:desc.get,
        set:function(value){
          if(this.id==='signup-success' || this.id==='admin-data') value=sanitize(value);
          return originalSet.call(this,value);
        }
      });
      window.__vibeSafeHTMLPatched=true;
    }catch(e){}
  })();

  // Keep the 500 Pionnier capacity independent from free memberships.
  function founderUsed(sb){
    return Promise.all([
      sb.from('landing_inscriptions').select('id',{count:'exact',head:true})
        .in('statut',['inscrit','pionnier','paye','founder','fondateur']),
      sb.from('profiles').select('id',{count:'exact',head:true}).eq('is_founder',true)
    ]).then(function(rs){
      var a=rs[0]&&rs[0].count||0, b=rs[1]&&rs[1].count||0;
      return Math.max(a,b);
    }).catch(function(){return 0;});
  }

  function patchSignup(){
    if(typeof window.handleSignup!=='function' || window.handleSignup.__vibeCapacityFixed) return false;
    var original=window.handleSignup;
    window.handleSignup=async function(e){
      var plan=(document.getElementById('plan-choisi')||{}).value||'free';
      if(plan!=='founder') return original.apply(this,arguments);
      var sb=window._supa;
      if(!sb || typeof sb.rpc!=='function') return original.apply(this,arguments);
      var used=await founderUsed(sb);
      if(used>=500){
        if(typeof window.showError==='function') window.showError('⚠ Toutes les places Pionnier sont prises.');
        return;
      }
      // Preserve the original flow while replacing only the misleading stats RPC.
      var rpc=sb.rpc.bind(sb);
      sb.rpc=function(name,args){
        if(name==='stats_publiques') return Promise.resolve({data:{membres:used},error:null});
        return rpc(name,args);
      };
      try{return await original.apply(this,arguments);}finally{sb.rpc=rpc;}
    };
    window.handleSignup.__vibeCapacityFixed=true;
    return true;
  }

  function start(){
    if(patchSignup()) return;
    var tries=0, timer=setInterval(function(){
      if(patchSignup() || ++tries>120) clearInterval(timer);
    },100);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();

  window.VIBE_SECURITY=window.VIBE_SECURITY||{};
  window.VIBE_SECURITY.esc=esc;
})();
