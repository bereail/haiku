// Sección "Dashboard": no guarda datos propios — lee y resume las demás secciones. Así nunca
// puede mostrar un número que Berenice no haya cargado en algún lado del panel.
(function(){
  "use strict";
  var U = window.Haiku.utils;
  var C = window.Haiku.components;
  var store = window.Haiku.store;

  function statCard(label, value, view){
    return '<div class="card" style="cursor:pointer" data-action="goto" data-view="'+view+'">'+
      '<div class="stat"><span class="label">'+U.escapeHtml(label)+'</span><span class="value">'+U.escapeHtml(String(value))+'</span></div></div>';
  }

  function render(state){
    var rmSection = window.Haiku.router.getSection("roadmap");
    var st = rmSection.computeStats(state);
    var next = state.project.nextAction;
    var html = '';

    html += '<div class="hero">';
    html += '  <div class="hero-top">';
    html += '    <div><h2 style="font-size:22px">'+U.escapeHtml(state.project.name)+'</h2>';
    html += '    <p style="color:var(--text-muted);font-size:13px">Fase actual: <b>'+U.escapeHtml(st.currentPhase.name)+'</b></p></div>';
    html += '    <div style="text-align:right"><div class="pct">'+st.percent+'%</div><div style="font-size:11.5px;color:var(--text-muted)">'+st.done+' de '+st.total+' tareas completadas</div></div>';
    html += '  </div>';
    html += '  <div class="progressbar"><span style="width:'+st.percent+'%"></span></div>';
    html += '</div>';

    html += '<div class="nextaction" style="margin-bottom:14px">';
    html += '  <div class="tag">Próxima acción</div>';
    html += '  <p>'+U.escapeHtml(next ? next.text : "Sin definir.")+'</p>';
    html += '  <div style="margin-top:10px;display:flex;gap:8px">';
    html += '    <button type="button" class="btn btn-ghost btn-sm" data-action="dh-suggest-next">Sugerir automáticamente</button>';
    html += '    <button type="button" class="btn btn-ghost btn-sm" data-action="dh-edit-next">Editar</button>';
    html += '  </div>';
    html += '  <div id="nextedit" hidden style="margin-top:10px">';
    html += '    <textarea id="nextedit-text" rows="2" style="width:100%;border:1px solid var(--border);border-radius:8px;padding:8px;background:var(--surface);color:var(--text)">'+U.escapeHtml(next?next.text:"")+'</textarea>';
    html += '    <div style="margin-top:6px"><button type="button" class="btn btn-primary btn-sm" data-action="dh-save-next">Guardar</button> <button type="button" class="btn btn-ghost btn-sm" data-action="dh-cancel-next">Cancelar</button></div>';
    html += '  </div>';
    html += '</div>';

    if(st.blockers.length){
      html += '<div class="blockerbox" style="margin-bottom:14px">';
      html += '  <div class="tag">Bloqueos ('+st.blockers.length+')</div><ul>';
      st.blockers.forEach(function(t){ html += '<li>'+U.escapeHtml(t.name)+'</li>'; });
      html += '  </ul></div>';
    }

    var featByStatus = {};
    state.features.forEach(function(f){ featByStatus[f.status]=(featByStatus[f.status]||0)+1; });
    var pendingSeo = state.seo.checklist.filter(function(i){return i.status==="pendiente";}).length;
    var unverifiedTests = state.testing.suites.filter(function(s){return s.status==="sin-verificar";}).length;
    var openFrictions = state.ux.frictions.filter(function(f){return f.status==="abierta";}).length;
    var openDecisions = state.roadmap.decisions.filter(function(d){return d.status==="propuesta";}).length;

    html += '<div class="cardrow" style="margin-bottom:16px">';
    html += statCard("Roadmap", st.done+"/"+st.total+" tareas", "roadmap");
    html += statCard("Decisiones abiertas", openDecisions+" sin confirmar", "roadmap");
    html += statCard("Funcionalidades", state.features.length+" cargadas", "funcionalidades");
    html += statCard("Fricciones UX abiertas", openFrictions, "ux");
    html += statCard("Pantallas UI", state.ui.screens.length+" documentadas", "ui");
    html += statCard("Testing sin verificar", unverifiedTests+"/"+state.testing.suites.length, "testing");
    html += statCard("SEO pendiente", pendingSeo+"/"+state.seo.checklist.length, "seo");
    html += statCard("Estadísticas", state.stats.instrumented.snapshots.length+" capturas reales", "estadisticas");
    html += '</div>';

    var lastLog = state.roadmap.log.slice().sort(function(a,b){return a.date<b.date?1:-1;}).slice(0,3);
    if(lastLog.length){
      html += '<div class="sectionhead" style="margin-top:4px"><div><h2 style="font-size:16px">Últimos cambios</h2></div></div>';
      lastLog.forEach(function(e){
        html += '<div class="entry"><div class="entry-head"><span class="entry-date">'+U.fmtDate(e.date)+'</span></div><div class="entry-text">'+U.escapeHtml(e.text)+'</div></div>';
      });
    }

    document.getElementById("view-dashboard").innerHTML = html;
  }

  function onClick(action, el){
    var state = store.state;
    var rmSection = window.Haiku.router.getSection("roadmap");
    if(action==="dh-suggest-next"){
      var s = rmSection.suggestNextAction(state);
      if(s){ state.project.nextAction = {taskId:s.id, text:(s.status==="bloqueada"?"Desbloquear: ":"Avanzar: ")+s.name+(s.notes?" — "+s.notes:"")}; render(state); return true; }
      return false;
    }
    if(action==="dh-edit-next"){ document.getElementById("nextedit").hidden=false; return false; }
    if(action==="dh-cancel-next"){ document.getElementById("nextedit").hidden=true; return false; }
    if(action==="dh-save-next"){
      var txt = document.getElementById("nextedit-text").value.trim();
      state.project.nextAction = {taskId:null, text: txt || "Sin definir."};
      render(state);
      return true;
    }
    return false;
  }

  window.Haiku.router.register("dashboard", {
    label:"Dashboard", render:render, onClick:onClick
  });
})();
