// Sección "Estadísticas, analítica y sesiones": separa explícitamente lo instrumentado (real,
// capturado a mano desde el panel de admin de la app) de lo manual/estimado. Nunca se inventa
// un número ni se dibuja un gráfico que no venga de un dato cargado por Berenice.
(function(){
  "use strict";
  var U = window.Haiku.utils;
  var C = window.Haiku.components;
  var store = window.Haiku.store;

  function snapshotRow(s){
    return '<div class="entry" data-id="'+s.id+'">'+
      '  <div class="entry-head"><span class="entry-date">'+U.fmtDate(s.date)+'</span></div>'+
      '  <div class="entry-text">Total: <b>'+(s.totalViews??'—')+'</b> · Hoy: <b>'+(s.todayViews??'—')+'</b> · Sesiones únicas: <b>'+(s.uniqueSessions??'—')+'</b>'+(s.topPage? ' · Página top: '+U.escapeHtml(s.topPage) : '')+'</div>'+
      (s.notes? '  <div class="entry-text" style="color:var(--text-muted)">'+U.escapeHtml(s.notes)+'</div>' : '')+
      '  <div class="entry-foot"><span class="entry-link">Fuente: panel de administración real de Haiku (AdminPage → Analíticas)</span>'+
      '  <button type="button" class="btn btn-ghost-danger btn-sm" data-action="st-snap-del" data-id="'+s.id+'">Borrar</button></div>'+
      '</div>';
  }

  function render(state){
    var stats = state.stats;
    var html = C.sectionHead("Estadísticas, analítica y sesiones", "Separado a propósito: lo instrumentado de verdad hoy, y lo estimado a mano.");

    html += '<div class="banner warn" style="align-items:flex-start">'+
      '<span><b>Qué se instrumenta hoy (real):</b> '+U.escapeHtml(stats.instrumented.description)+'</span></div>';

    html += C.card(
      '<h3>Capturas reales</h3>'+
      '<p class="hint">Números reales que viste en el panel de administración de la app (AdminPage → Analíticas), pegados a mano con fecha — nunca generados acá.</p>'+
      '<div class="form-grid">'+
      '  <div class="field"><label for="st-date">Fecha</label><input type="date" id="st-date" value="'+U.todayISO()+'"></div>'+
      '  <div class="field"><label for="st-total">Total de vistas</label><input type="number" id="st-total" min="0"></div>'+
      '  <div class="field"><label for="st-today">Vistas hoy</label><input type="number" id="st-today" min="0"></div>'+
      '  <div class="field"><label for="st-sessions">Sesiones únicas</label><input type="number" id="st-sessions" min="0"></div>'+
      '  <div class="field"><label for="st-toppage">Página top</label><input id="st-toppage" placeholder="biblioteca / login / admin"></div>'+
      '  <div class="field" style="grid-column:1/-1"><label for="st-notes">Notas</label><textarea id="st-notes"></textarea></div>'+
      '</div>'+
      '<button type="button" class="btn btn-primary btn-sm" data-action="st-snap-add">Registrar captura</button>',
      "configcard"
    );

    html += '<div class="crudlist">';
    if(!stats.instrumented.snapshots.length) html += C.emptyState("Todavía no se cargó ninguna captura real.");
    stats.instrumented.snapshots.slice().sort(function(a,b){return a.date<b.date?1:-1;}).forEach(function(s){ html += snapshotRow(s); });
    html += '</div>';

    html += '<div class="sectionhead" style="margin-top:14px"><div><h2 style="font-size:16px">Métricas manuales / estimadas</h2><div class="sub">Contadores que cargás vos a mano — no vienen de instrumentación.</div></div></div>';
    html += '<div class="metricgrid">';
    Object.keys(store.METRIC_LABELS).forEach(function(k){
      var v = stats.manualMetrics.counters[k];
      html += '<div class="metriccard">';
      html += '  <span class="label">'+store.METRIC_LABELS[k]+'</span>';
      html += '  <div class="valrow"><span class="big'+(v==null?" empty":"")+'">'+(v==null? "Sin datos todavía" : v)+'</span></div>';
      html += '  <div class="valrow"><label class="sr-only" for="mm-'+k+'">Actualizar '+store.METRIC_LABELS[k]+'</label><input type="number" min="0" id="mm-'+k+'" placeholder="0"> <button type="button" class="btn btn-ghost btn-sm" data-action="mm-set" data-key="'+k+'">Registrar</button></div>';
      html += '</div>';
    });
    html += '</div>';

    document.getElementById("view-estadisticas").innerHTML = html;
  }

  function onClick(action, el){
    var stats = store.state.stats;
    if(action==="st-snap-add"){
      stats.instrumented.snapshots.push({
        id:U.uid("sn"), date:document.getElementById("st-date").value || U.todayISO(),
        totalViews: numOrNull("st-total"), todayViews: numOrNull("st-today"), uniqueSessions: numOrNull("st-sessions"),
        topPage: document.getElementById("st-toppage").value.trim(), notes: document.getElementById("st-notes").value.trim()
      });
      render(store.state);
      return true;
    }
    if(action==="st-snap-del"){
      stats.instrumented.snapshots = stats.instrumented.snapshots.filter(function(s){return s.id!==el.getAttribute("data-id");});
      render(store.state);
      return true;
    }
    if(action==="mm-set"){
      var key = el.getAttribute("data-key");
      var input = document.getElementById("mm-"+key);
      var val = parseInt(input.value,10);
      if(isNaN(val) || val<0) return false;
      stats.manualMetrics.counters[key]=val;
      render(store.state);
      return true;
    }
    return false;
  }
  function numOrNull(id){
    var v = document.getElementById(id).value;
    return v===""? null : parseInt(v,10);
  }

  function searchIndex(state){
    return state.stats.instrumented.snapshots.map(function(s){ return {id:s.id, label:"Captura "+s.date, snippet:s.notes}; });
  }

  window.Haiku.router.register("estadisticas", {
    label:"Estadísticas", render:render, onClick:onClick, searchIndex:searchIndex
  });
})();
