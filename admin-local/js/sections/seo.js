// Sección "SEO y posicionamiento": checklist real (qué tiene index.html hoy y qué falta).
(function(){
  "use strict";
  var U = window.Haiku.utils;
  var C = window.Haiku.components;
  var store = window.Haiku.store;

  var STATUS_LABELS = {hecho:"Hecho", pendiente:"Pendiente", "no-aplica":"No aplica"};

  function itemRow(it){
    return '<div class="cruditem" data-id="'+it.id+'">'+
      '  <div class="cruditem-top">'+
      '    <div class="cruditem-title">'+U.escapeHtml(it.item)+'</div>'+
      '    <div class="cruditem-actions">'+
      '      <select data-action="seo-status" data-id="'+it.id+'">'+C.selectOptions([{id:"pendiente",label:"Pendiente"},{id:"hecho",label:"Hecho"},{id:"no-aplica",label:"No aplica"}], it.status)+'</select>'+
      '      <button type="button" class="btn btn-ghost-danger btn-sm" data-action="seo-del" data-id="'+it.id+'">Borrar</button>'+
      '    </div>'+
      '  </div>'+
      (it.notes? '  <div class="cruditem-body">'+U.escapeHtml(it.notes)+'</div>' : '')+
      '</div>';
  }

  function render(state){
    var seo = state.seo;
    var done = seo.checklist.filter(function(i){return i.status==="hecho";}).length;
    var html = C.sectionHead("SEO y posicionamiento", done+"/"+seo.checklist.length+" ítems hechos. Checklist sembrado a partir de lo que realmente tiene index.html hoy.");

    html += '<div class="crudlist">';
    seo.checklist.forEach(function(it){ html += itemRow(it); });
    html += '</div>';

    html += C.card(
      '<h3>Agregar ítem</h3>'+
      C.formGrid(['<div class="field" style="grid-column:1/-1"><label for="seo-new-item">Ítem</label><input id="seo-new-item" placeholder="Ej: metadescripción por página"></div>'])+
      '<button type="button" class="btn btn-primary btn-sm" data-action="seo-add">Agregar</button>',
      "configcard"
    );

    html += C.card(
      '<h3>Palabras clave</h3>'+
      '<div class="minitable">'+seo.keywords.map(function(k){
        return '<div class="minirow" data-id="'+k.id+'"><input data-action="seo-kw" data-field="term" data-id="'+k.id+'" value="'+U.escapeHtml(k.term)+'" style="flex:1"><input data-action="seo-kw" data-field="notes" data-id="'+k.id+'" value="'+U.escapeHtml(k.notes)+'" placeholder="Notas" style="flex:2"><button type="button" class="btn btn-ghost-danger btn-sm" data-action="seo-kw-del" data-id="'+k.id+'">Borrar</button></div>';
      }).join('')+'</div>'+
      '<button type="button" class="btn btn-ghost btn-sm" data-action="seo-kw-add" style="margin-top:8px">Agregar palabra clave</button>',
      "configcard"
    );

    document.getElementById("view-seo").innerHTML = html;
  }

  function onClick(action, el){
    var seo = store.state.seo;
    if(action==="seo-add"){
      var val = document.getElementById("seo-new-item").value.trim();
      if(!val) return false;
      seo.checklist.push({id:U.uid("seo"), item:val, status:"pendiente", notes:""});
      render(store.state);
      return true;
    }
    if(action==="seo-del"){ seo.checklist = seo.checklist.filter(function(i){return i.id!==el.getAttribute("data-id");}); render(store.state); return true; }
    if(action==="seo-kw-add"){ seo.keywords.push({id:U.uid("kw"), term:"", notes:""}); render(store.state); return true; }
    if(action==="seo-kw-del"){ seo.keywords = seo.keywords.filter(function(k){return k.id!==el.getAttribute("data-id");}); render(store.state); return true; }
    return false;
  }
  function onChange(el){
    var seo = store.state.seo;
    if(el.matches('[data-action="seo-status"]')){
      var it = seo.checklist.filter(function(i){return i.id===el.getAttribute("data-id");})[0];
      if(it){ it.status = el.value; store.scheduleSave(); render(store.state); }
    }
  }
  function onInput(el){
    var seo = store.state.seo;
    if(el.matches('[data-action="seo-kw"]')){
      var k = seo.keywords.filter(function(x){return x.id===el.getAttribute("data-id");})[0];
      if(k){ k[el.getAttribute("data-field")] = el.value; store.scheduleSave(); }
    }
  }

  function searchIndex(state){
    return state.seo.checklist.map(function(i){ return {id:i.id, label:i.item, snippet:i.notes}; });
  }

  window.Haiku.router.register("seo", {
    label:"SEO y posicionamiento", render:render, onClick:onClick, onChange:onChange, onInput:onInput, searchIndex:searchIndex
  });
})();
