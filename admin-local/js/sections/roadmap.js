// Sección "Roadmap y gestión": todo lo que antes eran 4 ítems de nav separados (Hoja de ruta,
// Tareas, Bitácora, Decisiones) ahora vive acá con sub-tabs internos — mismo comportamiento de
// siempre, solo reorganizado.
(function(){
  "use strict";
  var U = window.Haiku.utils;
  var C = window.Haiku.components;
  var store = window.Haiku.store;

  var subTab = "hoja"; // hoja | tareas | bitacora | decisiones
  var taskFilters = {q:"", phase:"all", status:"all", priority:"all"};

  function statusLabel(s){ return {pendiente:"Pendiente","en-curso":"En curso",bloqueada:"Bloqueada",completada:"Completada"}[s]||s; }
  function prioLabel(p){ return {alta:"Prioridad alta",media:"Prioridad media",baja:"Prioridad baja"}[p]||p; }

  function taskById(state, id){ return state.roadmap.tasks.filter(function(t){return t.id===id;})[0]; }

  function computeStats(state){
    var rm = state.roadmap;
    var total=rm.tasks.length, done=0;
    var byPhase={};
    rm.phases.forEach(function(p){ byPhase[p.id]={total:0,done:0}; });
    rm.tasks.forEach(function(t){
      byPhase[t.phaseId].total++;
      if(t.status==="completada"){ done++; byPhase[t.phaseId].done++; }
    });
    var percent = total? Math.round(done/total*100):0;
    var currentPhase = null;
    for(var i=0;i<rm.phases.length;i++){
      var ph=byPhase[rm.phases[i].id];
      if(ph.total>0 && ph.done<ph.total){ currentPhase=rm.phases[i]; break; }
    }
    if(!currentPhase) currentPhase = rm.phases[rm.phases.length-1];
    var blockers = rm.tasks.filter(function(t){ return t.status==="bloqueada"; });
    return {total:total, done:done, percent:percent, byPhase:byPhase, currentPhase:currentPhase, blockers:blockers};
  }

  function suggestNextAction(state){
    var prio={alta:0,media:1,baja:2};
    var candidates = state.roadmap.tasks.filter(function(t){ return t.status==="bloqueada"; })
      .sort(function(a,b){ return prio[a.priority]-prio[b.priority]; });
    if(!candidates.length) candidates = state.roadmap.tasks.filter(function(t){ return t.status==="en-curso"; })
      .sort(function(a,b){ return prio[a.priority]-prio[b.priority]; });
    if(!candidates.length) candidates = state.roadmap.tasks.filter(function(t){ return t.status==="pendiente"; })
      .sort(function(a,b){ return prio[a.priority]-prio[b.priority]; });
    return candidates[0] || null;
  }

  function subtabBar(){
    var tabs = [["hoja","Hoja de ruta"],["tareas","Tareas"],["bitacora","Bitácora"],["decisiones","Decisiones"]];
    var html = '<div class="subtabbar" role="tablist" aria-label="Roadmap y gestión">';
    tabs.forEach(function(t){
      html += '<button type="button" class="subtab'+(subTab===t[0]?' subtabOn':'')+'" role="tab" aria-selected="'+(subTab===t[0])+'" data-action="rm-subtab" data-tab="'+t[0]+'">'+t[1]+'</button>';
    });
    html += '</div>';
    return html;
  }

  function taskRow(t){
    var html = '<div class="task" data-taskid="'+t.id+'">';
    html += '<div class="task-top">';
    html += '  <div class="task-main">';
    html += '    <div class="task-name">'+U.escapeHtml(t.name)+'</div>';
    html += '    <div class="task-meta">';
    html += '      <span class="badge prio-'+t.priority+'">'+prioLabel(t.priority)+'</span>';
    html += '      <span>Actualizada: '+U.fmtDate(t.updatedAt)+'</span>';
    if(t.dependsOn) html += '      <span>Depende de: '+U.escapeHtml(t.dependsOn)+'</span>';
    html += '    </div>';
    html += '  </div>';
    html += '  <div class="task-controls">';
    html += '    <span class="badge st-'+t.status+'"><span class="dot"></span>'+statusLabel(t.status)+'</span>';
    html += '    <label class="sr-only" for="sel-'+t.id+'">Estado de "'+U.escapeHtml(t.name)+'"</label>';
    html += '    <select class="statusselect" id="sel-'+t.id+'" data-action="rm-set-status" data-taskid="'+t.id+'">';
    ["pendiente","en-curso","bloqueada","completada"].forEach(function(s){
      html += '<option value="'+s+'"'+(t.status===s?" selected":"")+'>'+statusLabel(s)+'</option>';
    });
    html += '    </select>';
    html += '  </div>';
    html += '</div>';
    html += '<details class="taskdetail"><summary>Notas y evidencia</summary><div class="tbody">';
    if(t.desc) html += '<div>'+U.escapeHtml(t.desc)+'</div>';
    if(t.evidence) html += '<div><b>Evidencia:</b> '+U.escapeHtml(t.evidence)+'</div>';
    if(t.notes) html += '<div><b>Notas:</b> '+U.escapeHtml(t.notes)+'</div>';
    html += '<label for="notes-'+t.id+'">Agregar o editar nota</label>';
    html += '<textarea id="notes-'+t.id+'" data-action="rm-edit-notes" data-taskid="'+t.id+'">'+U.escapeHtml(t.notes)+'</textarea>';
    html += '</div></details>';
    html += '</div>';
    return html;
  }

  function renderHoja(state){
    var st=computeStats(state);
    var html = C.sectionHead("Hoja de ruta", "Lanzamiento organizado en 7 fases. Abrí una fase para ver y editar sus tareas.");
    state.roadmap.phases.forEach(function(p){
      var ph=st.byPhase[p.id];
      var openAttr = (p.id===st.currentPhase.id) ? " open" : "";
      html += '<details class="phase"'+openAttr+'>';
      html += '  <summary><span class="ph-left">'+U.escapeHtml(p.name)+'</span><span class="phase-progress">'+ph.done+'/'+ph.total+' completadas</span></summary>';
      html += '  <div class="phasebody">';
      state.roadmap.tasks.filter(function(t){return t.phaseId===p.id;}).forEach(function(t){ html+=taskRow(t); });
      html += '  </div>';
      html += '</details>';
    });
    return html;
  }

  function renderTareasFilters(state){
    var html = C.sectionHead("Tareas", "Todas las tareas del lanzamiento, filtrables.");
    html += '<div class="filters">';
    html += '  <input type="search" id="task-q" placeholder="Buscar por nombre…" value="'+U.escapeHtml(taskFilters.q)+'" aria-label="Buscar tareas">';
    html += '  <select id="task-f-phase" aria-label="Filtrar por fase"><option value="all">Todas las fases</option>';
    state.roadmap.phases.forEach(function(p){ html+='<option value="'+p.id+'"'+(taskFilters.phase===p.id?" selected":"")+'>'+U.escapeHtml(p.name)+'</option>'; });
    html += '  </select>';
    html += '  <select id="task-f-status" aria-label="Filtrar por estado"><option value="all">Todos los estados</option>';
    ["pendiente","en-curso","bloqueada","completada"].forEach(function(s){ html+='<option value="'+s+'"'+(taskFilters.status===s?" selected":"")+'>'+statusLabel(s)+'</option>'; });
    html += '  </select>';
    html += '  <select id="task-f-prio" aria-label="Filtrar por prioridad"><option value="all">Toda prioridad</option>';
    ["alta","media","baja"].forEach(function(s){ html+='<option value="'+s+'"'+(taskFilters.priority===s?" selected":"")+'>'+prioLabel(s)+'</option>'; });
    html += '  </select>';
    html += '</div>';
    html += '<div id="tareas-results"></div>';
    return html;
  }
  function renderTareaResults(state){
    var container = document.getElementById("tareas-results");
    if(!container) return;
    var list = state.roadmap.tasks.filter(function(t){
      if(taskFilters.phase!=="all" && t.phaseId!==taskFilters.phase) return false;
      if(taskFilters.status!=="all" && t.status!==taskFilters.status) return false;
      if(taskFilters.priority!=="all" && t.priority!==taskFilters.priority) return false;
      if(taskFilters.q && t.name.toLowerCase().indexOf(taskFilters.q.toLowerCase())===-1) return false;
      return true;
    });
    var html = '<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">'+list.length+' tarea'+(list.length===1?"":"s")+'</div>';
    html += '<div style="display:flex;flex-direction:column;gap:8px">';
    if(!list.length) html += C.emptyState("Ninguna tarea coincide con el filtro.");
    list.forEach(function(t){ html+=taskRow(t); });
    html += '</div>';
    container.innerHTML = html;
  }

  function renderBitacora(state){
    var html = C.sectionHead("Bitácora", "Qué hiciste, qué cambió, qué quedó pendiente.");
    html += '<div class="card" style="margin-bottom:16px">';
    html += '  <div class="form-grid">';
    html += '    <div class="field"><label for="log-date">Fecha</label><input type="date" id="log-date" value="'+U.todayISO()+'"></div>';
    html += '    <div class="field" style="grid-column:1/-1"><label for="log-task">Vincular a una tarea (opcional)</label><select id="log-task"><option value="">— ninguna —</option>';
    state.roadmap.tasks.forEach(function(t){ html+='<option value="'+t.id+'">'+U.escapeHtml(t.name)+'</option>'; });
    html += '    </select></div>';
    html += '    <div class="field" style="grid-column:1/-1"><label for="log-text">Entrada</label><textarea id="log-text" placeholder="Qué hiciste, qué comprobaste, qué quedó pendiente…"></textarea></div>';
    html += '  </div>';
    html += '  <button class="btn btn-primary" data-action="rm-add-log">Agregar entrada</button>';
    html += '</div>';

    var sorted = state.roadmap.log.slice().sort(function(a,b){ return a.date<b.date?1:a.date>b.date?-1:0; });
    sorted.forEach(function(e){
      var t = e.taskId ? taskById(state, e.taskId) : null;
      html += '<div class="entry">';
      html += '  <div class="entry-head"><span class="entry-date">'+U.fmtDate(e.date)+'</span></div>';
      html += '  <div class="entry-text">'+U.escapeHtml(e.text)+'</div>';
      html += '  <div class="entry-foot">';
      html += '    <span class="entry-link">'+(t?('Vinculada a: '+U.escapeHtml(t.name)):'')+'</span>';
      html += '    <button class="btn btn-ghost-danger btn-sm" data-action="rm-del-log" data-id="'+e.id+'">Borrar</button>';
      html += '  </div>';
      html += '</div>';
    });
    return html;
  }

  function renderDecisiones(state){
    var html = C.sectionHead("Decisiones y documentación", "Qué se decidió, por qué, y qué sigue abierto.");
    html += '<div class="card" style="margin-bottom:16px">';
    html += '  <div class="form-grid">';
    html += '    <div class="field"><label for="dec-topic">Tema</label><input id="dec-topic" placeholder="Ej: dominio del proyecto"></div>';
    html += '    <div class="field"><label for="dec-date">Fecha</label><input type="date" id="dec-date" value="'+U.todayISO()+'"></div>';
    html += '    <div class="field" style="grid-column:1/-1"><label for="dec-decision">Decisión tomada</label><textarea id="dec-decision"></textarea></div>';
    html += '    <div class="field" style="grid-column:1/-1"><label for="dec-reason">Motivo</label><textarea id="dec-reason"></textarea></div>';
    html += '    <div class="field"><label for="dec-status">Estado</label><select id="dec-status"><option value="propuesta">Propuesta</option><option value="confirmada">Confirmada</option><option value="reemplazada">Reemplazada</option></select></div>';
    html += '    <div class="field" style="grid-column:1/-1"><label for="dec-consequences">Consecuencias o tareas relacionadas</label><textarea id="dec-consequences"></textarea></div>';
    html += '  </div>';
    html += '  <button class="btn btn-primary" data-action="rm-add-decision">Agregar decisión</button>';
    html += '</div>';

    var sorted = state.roadmap.decisions.slice().sort(function(a,b){ return a.date<b.date?1:a.date>b.date?-1:0; });
    sorted.forEach(function(d){
      html += '<div class="decision">';
      html += '  <h3>'+U.escapeHtml(d.topic)+'</h3>';
      html += '  <div class="meta">'+U.fmtDate(d.date)+' · <span class="badge st-'+(d.status==="confirmada"?"completada":d.status==="propuesta"?"en-curso":"bloqueada")+'">'+U.escapeHtml(d.status)+'</span></div>';
      html += '  <div class="row"><b>Decisión:</b> '+U.escapeHtml(d.decision)+'</div>';
      html += '  <div class="row"><b>Motivo:</b> '+U.escapeHtml(d.reason)+'</div>';
      if(d.consequences) html += '  <div class="row"><b>Consecuencias:</b> '+U.escapeHtml(d.consequences)+'</div>';
      html += '  <div style="margin-top:8px"><button class="btn btn-ghost-danger btn-sm" data-action="rm-del-decision" data-id="'+d.id+'">Borrar</button></div>';
      html += '</div>';
    });
    return html;
  }

  function render(state){
    var html = subtabBar();
    if(subTab==="hoja") html += renderHoja(state);
    else if(subTab==="tareas") html += renderTareasFilters(state);
    else if(subTab==="bitacora") html += renderBitacora(state);
    else if(subTab==="decisiones") html += renderDecisiones(state);
    document.getElementById("view-roadmap").innerHTML = html;
    if(subTab==="tareas") renderTareaResults(state);
  }

  function onClick(action, el){
    var state = store.state;
    if(action==="rm-subtab"){ subTab = el.getAttribute("data-tab"); render(state); return false; }

    if(action==="rm-add-log"){
      var date = document.getElementById("log-date").value || U.todayISO();
      var text = document.getElementById("log-text").value.trim();
      var taskId = document.getElementById("log-task").value || null;
      if(!text) return false;
      state.roadmap.log.push({id:U.uid("l"), date:date, text:text, taskId:taskId});
      render(state);
      return true;
    }
    if(action==="rm-del-log"){
      state.roadmap.log = state.roadmap.log.filter(function(e){ return e.id!==el.getAttribute("data-id"); });
      render(state);
      return true;
    }
    if(action==="rm-add-decision"){
      var topic=document.getElementById("dec-topic").value.trim();
      var decision=document.getElementById("dec-decision").value.trim();
      if(!topic || !decision) return false;
      state.roadmap.decisions.push({
        id:U.uid("d"), topic:topic, decision:decision,
        reason:document.getElementById("dec-reason").value.trim(),
        date:document.getElementById("dec-date").value || U.todayISO(),
        status:document.getElementById("dec-status").value,
        consequences:document.getElementById("dec-consequences").value.trim()
      });
      render(state);
      return true;
    }
    if(action==="rm-del-decision"){
      state.roadmap.decisions = state.roadmap.decisions.filter(function(d){ return d.id!==el.getAttribute("data-id"); });
      render(state);
      return true;
    }
    return false;
  }

  function onChange(el){
    var state = store.state;
    if(el.matches('[data-action="rm-set-status"]')){
      var t = taskById(state, el.getAttribute("data-taskid"));
      if(t){ t.status = el.value; t.updatedAt = U.todayISO(); store.scheduleSave();
        if(subTab==="tareas") renderTareaResults(state); else render(state);
      }
      return;
    }
    if(el.id==="task-f-phase"){ taskFilters.phase = el.value; renderTareaResults(state); return; }
    if(el.id==="task-f-status"){ taskFilters.status = el.value; renderTareaResults(state); return; }
    if(el.id==="task-f-prio"){ taskFilters.priority = el.value; renderTareaResults(state); return; }
  }

  function onInput(el){
    var state = store.state;
    if(el.id==="task-q"){ taskFilters.q = el.value; renderTareaResults(state); return; }
    if(el.matches('[data-action="rm-edit-notes"]')){
      var t = taskById(state, el.getAttribute("data-taskid"));
      if(t){ t.notes = el.value; store.scheduleSave(); }
      return;
    }
  }

  function searchIndex(state){
    var out = [];
    state.roadmap.tasks.forEach(function(t){ out.push({id:t.id, label:t.name, snippet:(t.notes||t.evidence||"").slice(0,80)}); });
    state.roadmap.decisions.forEach(function(d){ out.push({id:d.id, label:d.topic, snippet:d.decision}); });
    return out;
  }

  function focusItem(id){
    var task = store.state.roadmap.tasks.filter(function(t){return t.id===id;})[0];
    if(task){ subTab="tareas"; taskFilters={q:task.name, phase:"all", status:"all", priority:"all"}; render(store.state); return; }
    var dec = store.state.roadmap.decisions.filter(function(d){return d.id===id;})[0];
    if(dec){ subTab="decisiones"; render(store.state); }
  }

  window.Haiku.router.register("roadmap", {
    label: "Roadmap y gestión",
    render: render,
    onClick: onClick,
    onChange: onChange,
    onInput: onInput,
    searchIndex: searchIndex,
    focusItem: focusItem,
    computeStats: computeStats,
    suggestNextAction: suggestNextAction,
    statusLabel: statusLabel,
    prioLabel: prioLabel
  });
})();
