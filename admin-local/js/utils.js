// Utilidades compartidas por todo el panel. Sin dependencias externas, sin build step:
// se carga como <script> plano (no módulo) para que el panel siga abriéndose con file://.
(function(){
  "use strict";
  window.Haiku = window.Haiku || {};

  var MESES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

  function fmtDate(iso){
    if(!iso) return "";
    var p = iso.split("-");
    if(p.length!==3) return iso;
    return parseInt(p[2],10)+" "+MESES[parseInt(p[1],10)-1]+" "+p[0];
  }
  function todayISO(){
    var d=new Date();
    return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  }
  function escapeHtml(s){
    if(s==null) return "";
    return String(s).replace(/[&<>"']/g,function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }
  function uid(prefix){
    return prefix+"-"+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  }

  // ---------- Color (usado por Identidad visual para aplicar tokens en vivo) ----------
  function hexToRgb(hex){
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex||"");
    if(!m) return {r:0,g:0,b:0};
    return {r:parseInt(m[1],16), g:parseInt(m[2],16), b:parseInt(m[3],16)};
  }
  function relLuminance(hex){
    var c = hexToRgb(hex);
    var vals = [c.r,c.g,c.b].map(function(v){
      v = v/255;
      return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4);
    });
    return 0.2126*vals[0] + 0.7152*vals[1] + 0.0722*vals[2];
  }
  function contrastColor(hex){
    return relLuminance(hex) > 0.5 ? "#13201b" : "#ffffff";
  }
  function softColor(hex, alpha){
    var c = hexToRgb(hex);
    return "rgba("+c.r+","+c.g+","+c.b+","+alpha+")";
  }

  var FONT_OPTIONS = [
    {id:"sans", label:"Sans del sistema", stack:'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif'},
    {id:"serif", label:"Serif clásica", stack:'Georgia,"Times New Roman",serif'},
    {id:"humanist", label:"Humanista redondeada", stack:'"Trebuchet MS","Segoe UI",Verdana,sans-serif'},
    {id:"mono", label:"Monoespaciada", stack:'"Consolas","Courier New",monospace'}
  ];
  function fontStack(id){
    var f = FONT_OPTIONS.filter(function(o){ return o.id===id; })[0];
    return f ? f.stack : FONT_OPTIONS[0].stack;
  }

  // Aplica los tokens de Identidad visual como variables CSS en vivo, a todo el panel.
  function applyIdentityTokens(tokens){
    var root = document.documentElement.style;
    root.setProperty("--accent", tokens.primary);
    root.setProperty("--accent-soft", softColor(tokens.primary, 0.14));
    root.setProperty("--accent-contrast", contrastColor(tokens.primary));
    root.setProperty("--brand-secondary", tokens.secondary);
    root.setProperty("--brand-secondary-soft", softColor(tokens.secondary, 0.14));
    root.setProperty("--bg", tokens.bg);
    root.setProperty("--radius", tokens.radius+"px");
    root.setProperty("--font", fontStack(tokens.fontFamily));
    root.setProperty("--font-size-base", tokens.fontSizeBase+"px");
  }

  // ---------- Toast + indicador de guardado (compartidos por todas las secciones) ----------
  var toastTimer=null;
  function showToast(msg){
    var t=document.getElementById("toast");
    if(!t) return;
    t.textContent=msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer=setTimeout(function(){ t.classList.remove("show"); },1800);
  }

  window.Haiku.utils = {
    fmtDate: fmtDate,
    todayISO: todayISO,
    escapeHtml: escapeHtml,
    uid: uid,
    hexToRgb: hexToRgb,
    relLuminance: relLuminance,
    contrastColor: contrastColor,
    softColor: softColor,
    FONT_OPTIONS: FONT_OPTIONS,
    fontStack: fontStack,
    applyIdentityTokens: applyIdentityTokens,
    showToast: showToast
  };
})();
