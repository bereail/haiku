// Sección "Testing y calidad": inventario real de archivos de prueba (Vitest/Jest/Playwright),
// sembrado con "sin verificar hoy" — el estado pasa/falla lo carga Berenice después de correrlos,
// nunca se inventa acá.
(function(){
  "use strict";
  var U = window.Haiku.utils;
  var C = window.Haiku.components;
  var store = window.Haiku.store;

  var TYPE_LABELS = {"unit-fe":"Unitario frontend", "unit-be":"Unitario backend", "e2e":"E2E"};
  var STATUS_LABELS = {"sin-verificar":"Sin verificar hoy", "pasa":"Pasa", "falla":"Falla", "skip":"Skip"};
  var filterType = "all";

  function findSuite(state, id){ return state.testing.suites.filter(function(s){return s.id===id;})[0]; }
  function findBug(state, id){ return state.testing.knownBugs.filter(function(b){return b.id===id;})[0]; }

  function suiteRow(s){
    var html = '<div class="cruditem" data-id="'+s.id+'">';
    html += '  <div class="cruditem-top">';
    html += '    <div><div class="cruditem-title">'+U.escapeHtml(s.name)+'</div>';
    html += '    <div class="cruditem-meta"><span class="badge st-pendiente">'+TYPE_LABELS[s.type]+'</span><code style="font-size:11px;color:var(--text-muted)">'+U.escapeHtml(s.file)+'</code></div></div>';
    html += '    <div class="cruditem-actions">';
    html += '      <select data-action="tt-status" data-id="'+s.id+'">'+C.selectOptions([
      {id:"sin-verificar",label:"Sin verificar hoy"},{id:"pasa",label:"Pasa"},{id:"falla",label:"Falla"},{id:"skip",label:"Skip"}
    ], s.status)+'</select>';
    html += '    </div>';
    html += '  </div>';
    if(s.notes) html += '  <div class="cruditem-body">'+U.escapeHtml(s.notes)+'</div>';
    html += '</div>';
    return html;
  }

  function bugRow(b){
    return '<div class="cruditem" data-id="'+b.id+'">'+
      '  <div class="cruditem-top">'+
      '    <div><div class="cruditem-title">'+U.escapeHtml(b.title)+'</div>'+
      '    <div class="cruditem-meta">'+C.prioBadge(b.severity, {alta:"Severidad alta",media:"Severidad media",baja:"Severidad baja"})+'<span class="badge st-'+(b.status==="cerrado"?"completada":"bloqueada")+'">'+U.escapeHtml(b.status)+'</span></div></div>'+
      '    <div class="cruditem-actions"><button type="button" class="btn btn-ghost-danger btn-sm" data-action="bg-del" data-id="'+b.id+'">Borrar</button></div>'+
      '  </div>'+
      (b.notes? '  <div class="cruditem-body">'+U.escapeHtml(b.notes)+'</div>' : '')+
      '</div>';
  }

  function render(state){
    var t = state.testing;
    var total = t.suites.length;
    var byStatus = {"sin-verificar":0,pasa:0,falla:0,skip:0};
    t.suites.forEach(function(s){ byStatus[s.status] = (byStatus[s.status]||0)+1; });

    var html = C.sectionHead("Testing y calidad", total+" suites reales encontradas en el repo (Vitest, Jest, Playwright). El estado inicial es \"sin verificar hoy\" — no se inventa pasa/falla.");

    html += '<div class="cardrow" style="margin-bottom:16px">';
    html += '<div class="card"><div class="stat"><span class="label">Sin verificar</span><span class="value">'+byStatus["sin-verificar"]+'</span></div></div>';
    html += '<div class="card"><div class="stat"><span class="label">Pasa</span><span class="value">'+byStatus.pasa+'</span></div></div>';
    html += '<div class="card"><div class="stat"><span class="label">Falla</span><span class="value">'+byStatus.falla+'</span></div></div>';
    html += '<div class="card"><div class="stat"><span class="label">Skip</span><span class="value">'+byStatus.skip+'</span></div></div>';
    html += '</div>';

    html += '<div class="filters">';
    html += '  <select id="tt-filter-type" aria-label="Filtrar por tipo"><option value="all">Todos los tipos</option>'+
      C.selectOptions([{id:"unit-fe",label:"Unitario frontend"},{id:"unit-be",label:"Unitario backend"},{id:"e2e",label:"E2E"}], filterType)+'</select>';
    html += '</div>';

    var list = filterType==="all" ? t.suites : t.suites.filter(function(s){return s.type===filterType;});
    html += '<div class="crudlist">';
    list.forEach(function(s){ html += suiteRow(s); });
    html += '</div>';

    html += '<div class="sectionhead" style="margin-top:8px"><div><h2 style="font-size:16px">Bugs conocidos</h2></div></div>';
    html += '<div class="card" style="margin-bottom:12px">';
    html += '  <div class="form-grid">';
    html += '    <div class="field" style="grid-column:1/-1"><label for="bg-title">Título</label><input id="bg-title"></div>';
    html += '    <div class="field"><label for="bg-severity">Severidad</label><select id="bg-severity">'+C.selectOptions([{id:"alta",label:"Alta"},{id:"media",label:"Media"},{id:"baja",label:"Baja"}],"media")+'</select></div>';
    html += '    <div class="field" style="grid-column:1/-1"><label for="bg-notes">Notas</label><textarea id="bg-notes"></textarea></div>';
    html += '  </div>';
    html += '  <button type="button" class="btn btn-primary btn-sm" data-action="bg-add">Agregar bug</button>';
    html += '</div>';
    html += '<div class="crudlist">';
    if(!t.knownBugs.length) html += C.emptyState("Sin bugs conocidos cargados.");
    t.knownBugs.forEach(function(b){ html += bugRow(b); });
    html += '</div>';

    document.getElementById("view-testing").innerHTML = html;
  }

  function onClick(action, el){
    var state = store.state;
    if(action==="bg-add"){
      var title = document.getElementById("bg-title").value.trim();
      if(!title) return false;
      state.testing.knownBugs.push({id:U.uid("bg"), title:title, severity:document.getElementById("bg-severity").value, status:"abierto", notes:document.getElementById("bg-notes").value.trim()});
      render(state);
      return true;
    }
    if(action==="bg-del"){
      state.testing.knownBugs = state.testing.knownBugs.filter(function(b){return b.id!==el.getAttribute("data-id");});
      render(state);
      return true;
    }
    return false;
  }
  function onChange(el){
    var state = store.state;
    if(el.id==="tt-filter-type"){ filterType = el.value; render(state); return; }
    if(el.matches('[data-action="tt-status"]')){
      var s = findSuite(state, el.getAttribute("data-id"));
      if(s){ s.status = el.value; s.lastChecked = U.todayISO(); store.scheduleSave(); render(state); }
    }
  }

  function searchIndex(state){
    return state.testing.suites.map(function(s){ return {id:s.id, label:s.name, snippet:s.file}; })
      .concat(state.testing.knownBugs.map(function(b){ return {id:b.id, label:b.title, snippet:b.notes}; }));
  }

  window.Haiku.router.register("testing", {
    label:"Testing y calidad", render:render, onClick:onClick, onChange:onChange, searchIndex:searchIndex
  });
})();
