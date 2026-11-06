// Sección "Funcionalidades y reglas de negocio": qué puede hacer Haiku hoy, y lo que se vaya
// sumando. Sembrada con las 6 áreas reales descritas en DOCUMENTACION.md (ver store.js).
(function(){
  "use strict";
  var U = window.Haiku.utils;
  var C = window.Haiku.components;
  var store = window.Haiku.store;

  var STATUS_LABELS = {idea:"Idea", "en-curso":"En curso", completada:"Completada", bloqueada:"Bloqueada"};
  var expanded = {};

  function findItem(state, id){ return state.features.filter(function(f){return f.id===id;})[0]; }

  function itemHtml(f){
    var open = !!expanded[f.id];
    var html = '<div class="cruditem" data-id="'+f.id+'">';
    html += '  <div class="cruditem-top">';
    html += '    <div><div class="cruditem-title">'+U.escapeHtml(f.name)+'</div>';
    html += '    <div class="cruditem-meta">'+C.statusBadge(f.status, STATUS_LABELS)+(f.priority? C.prioBadge(f.priority, {alta:"Prioridad alta",media:"Prioridad media",baja:"Prioridad baja"}) : '')+'</div></div>';
    html += '    <div class="cruditem-actions">';
    html += '      <button type="button" class="btn btn-ghost btn-sm" data-action="ft-toggle" data-id="'+f.id+'">'+(open?"Cerrar":"Editar")+'</button>';
    html += '      <button type="button" class="btn btn-ghost-danger btn-sm" data-action="ft-del" data-id="'+f.id+'">Borrar</button>';
    html += '    </div>';
    html += '  </div>';
    if(!open){
      html += '  <div class="cruditem-body"><div>'+U.escapeHtml(f.objective)+'</div></div>';
    }else{
      html += '  <div class="cruditem-body" style="gap:8px;margin-top:10px">';
      html += field("Nombre", input("ft-f", "name", f.id, f.name));
      html += field("Objetivo", textarea("ft-f", "objective", f.id, f.objective));
      html += field("Reglas de negocio", textarea("ft-f", "rules", f.id, f.rules));
      html += field("Dependencias", textarea("ft-f", "dependencies", f.id, f.dependencies));
      html += '    <div class="form-grid">';
      html += '      <div class="field"><label>Estado</label><select data-action="ft-f" data-field="status" data-id="'+f.id+'">'+C.selectOptions([{id:"idea",label:"Idea"},{id:"en-curso",label:"En curso"},{id:"completada",label:"Completada"},{id:"bloqueada",label:"Bloqueada"}], f.status)+'</select></div>';
      html += '      <div class="field"><label>Prioridad</label><select data-action="ft-f" data-field="priority" data-id="'+f.id+'">'+C.selectOptions([{id:"",label:"Sin definir"},{id:"alta",label:"Alta"},{id:"media",label:"Media"},{id:"baja",label:"Baja"}], f.priority)+'</select></div>';
      html += '    </div>';
      html += field("Pruebas relacionadas", textarea("ft-f", "testsRelated", f.id, f.testsRelated));
      html += field("Notas", textarea("ft-f", "notes", f.id, f.notes));
      html += '  </div>';
    }
    html += '</div>';
    return html;
  }
  function field(label, inputHtml){ return '<div class="field"><label>'+label+'</label>'+inputHtml+'</div>'; }
  function input(action, fld, id, val){ return '<input data-action="'+action+'" data-field="'+fld+'" data-id="'+id+'" value="'+U.escapeHtml(val)+'">'; }
  function textarea(action, fld, id, val){ return '<textarea data-action="'+action+'" data-field="'+fld+'" data-id="'+id+'">'+U.escapeHtml(val)+'</textarea>'; }

  function render(state){
    var html = C.sectionHead("Funcionalidades y reglas de negocio", "Qué puede hacer Haiku hoy, con su objetivo, reglas, dependencias y pruebas relacionadas. Sembrado con las 6 áreas reales de DOCUMENTACION.md.");
    html += '<button type="button" class="btn btn-primary btn-sm" data-action="ft-add" style="margin-bottom:14px">Agregar funcionalidad</button>';
    html += '<div class="crudlist">';
    if(!state.features.length) html += C.emptyState("Todavía no hay funcionalidades cargadas.");
    state.features.forEach(function(f){ html += itemHtml(f); });
    html += '</div>';
    document.getElementById("view-funcionalidades").innerHTML = html;
  }

  function onClick(action, el){
    var state = store.state;
    if(action==="ft-add"){
      var f = {id:U.uid("ft"), name:"Nueva funcionalidad", objective:"", rules:"", dependencies:"", status:"idea", priority:"", testsRelated:"", notes:"", relatedRefs:[]};
      state.features.push(f);
      expanded[f.id]=true;
      render(state);
      return true;
    }
    if(action==="ft-toggle"){ var id=el.getAttribute("data-id"); expanded[id]=!expanded[id]; render(state); return false; }
    if(action==="ft-del"){
      state.features = state.features.filter(function(f){return f.id!==el.getAttribute("data-id");});
      render(state);
      return true;
    }
    return false;
  }
  function onInput(el){
    if(!el.matches('[data-action="ft-f"]')) return;
    var f = findItem(store.state, el.getAttribute("data-id"));
    if(f){ f[el.getAttribute("data-field")] = el.value; store.scheduleSave(); }
  }
  function onChange(el){
    if(!el.matches('[data-action="ft-f"]')) return;
    var f = findItem(store.state, el.getAttribute("data-id"));
    if(f){ f[el.getAttribute("data-field")] = el.value; store.scheduleSave(); render(store.state); }
  }

  function searchIndex(state){
    return state.features.map(function(f){ return {id:f.id, label:f.name, snippet:f.objective}; });
  }
  function focusItem(id){ expanded[id]=true; render(store.state); }

  window.Haiku.router.register("funcionalidades", {
    label:"Funcionalidades", render:render, onClick:onClick, onInput:onInput, onChange:onChange,
    searchIndex:searchIndex, focusItem:focusItem
  });
})();
