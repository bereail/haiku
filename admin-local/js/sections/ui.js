// Sección "UI e interfaz": inventario de pantallas y componentes. Arranca vacía (no hay un
// inventario documentado todavía) — se carga a mano a medida que se define.
(function(){
  "use strict";
  var U = window.Haiku.utils;
  var C = window.Haiku.components;
  var store = window.Haiku.store;
  var subTab = "screens";

  function subtabBar(){
    var tabs = [["screens","Pantallas"],["components","Componentes"]];
    var html = '<div class="subtabbar" role="tablist" aria-label="UI">';
    tabs.forEach(function(t){
      html += '<button type="button" class="subtab'+(subTab===t[0]?' subtabOn':'')+'" role="tab" aria-selected="'+(subTab===t[0])+'" data-action="ui-subtab" data-tab="'+t[0]+'">'+t[1]+'</button>';
    });
    return html+'</div>';
  }

  function renderScreens(state){
    var html = C.card(
      '<h3>Nueva pantalla</h3>'+
      C.formGrid([
        '<div class="field"><label for="ui-s-name">Nombre</label><input id="ui-s-name" placeholder="Ej: LibraryPage"></div>',
        '<div class="field"><label for="ui-s-route">Ruta</label><input id="ui-s-route" placeholder="/biblioteca"></div>',
        '<div class="field"><label for="ui-s-status">Estado</label><select id="ui-s-status">'+C.selectOptions([{id:"wireframe",label:"Wireframe"},{id:"layout",label:"Layout"},{id:"construida",label:"Construida"}],"construida")+'</select></div>',
        '<div class="field" style="grid-column:1/-1"><label for="ui-s-notes">Notas (responsive, estados vacío/error/carga/confirmación)</label><textarea id="ui-s-notes"></textarea></div>'
      ])+'<button type="button" class="btn btn-primary btn-sm" data-action="ui-s-add">Agregar pantalla</button>',
      "configcard"
    );
    html += '<div class="crudlist">';
    if(!state.ui.screens.length) html += C.emptyState("Sin pantallas documentadas todavía.");
    state.ui.screens.forEach(function(s){
      html += '<div class="cruditem" data-id="'+s.id+'"><div class="cruditem-top"><div><div class="cruditem-title">'+U.escapeHtml(s.name)+'</div>'+
        '<div class="cruditem-meta">'+C.badge(s.status,"neutral")+(s.route? '<code style="font-size:11px">'+U.escapeHtml(s.route)+'</code>':'')+'</div></div>'+
        '<div class="cruditem-actions"><button type="button" class="btn btn-ghost-danger btn-sm" data-action="ui-s-del" data-id="'+s.id+'">Borrar</button></div></div>'+
        (s.notes? '<div class="cruditem-body">'+U.escapeHtml(s.notes)+'</div>':'')+'</div>';
    });
    html += '</div>';
    return html;
  }

  function renderComponents(state){
    var html = C.card(
      '<h3>Nuevo componente</h3>'+
      C.formGrid([
        '<div class="field"><label for="ui-c-name">Nombre</label><input id="ui-c-name" placeholder="Ej: BookCard"></div>',
        '<div class="field" style="grid-column:1/-1"><label for="ui-c-desc">Descripción / dónde se usa</label><textarea id="ui-c-desc"></textarea></div>'
      ])+'<button type="button" class="btn btn-primary btn-sm" data-action="ui-c-add">Agregar componente</button>',
      "configcard"
    );
    html += '<div class="crudlist">';
    if(!state.ui.components.length) html += C.emptyState("Sin componentes documentados todavía.");
    state.ui.components.forEach(function(c){
      html += '<div class="cruditem" data-id="'+c.id+'"><div class="cruditem-top"><div class="cruditem-title">'+U.escapeHtml(c.name)+'</div>'+
        '<div class="cruditem-actions"><button type="button" class="btn btn-ghost-danger btn-sm" data-action="ui-c-del" data-id="'+c.id+'">Borrar</button></div></div>'+
        (c.description? '<div class="cruditem-body">'+U.escapeHtml(c.description)+'</div>':'')+'</div>';
    });
    html += '</div>';
    return html;
  }

  function render(state){
    var html = subtabBar();
    html += subTab==="screens" ? renderScreens(state) : renderComponents(state);
    document.getElementById("view-ui").innerHTML = C.sectionHead("UI e interfaz","Pantallas y componentes de Haiku.")+html;
  }

  function onClick(action, el){
    var ui = store.state.ui;
    if(action==="ui-subtab"){ subTab = el.getAttribute("data-tab"); render(store.state); return false; }
    if(action==="ui-s-add"){
      var name = document.getElementById("ui-s-name").value.trim();
      if(!name) return false;
      ui.screens.push({id:U.uid("sc"), name:name, route:document.getElementById("ui-s-route").value.trim(), status:document.getElementById("ui-s-status").value, notes:document.getElementById("ui-s-notes").value.trim()});
      render(store.state); return true;
    }
    if(action==="ui-s-del"){ ui.screens = ui.screens.filter(function(s){return s.id!==el.getAttribute("data-id");}); render(store.state); return true; }
    if(action==="ui-c-add"){
      var cname = document.getElementById("ui-c-name").value.trim();
      if(!cname) return false;
      ui.components.push({id:U.uid("cp"), name:cname, description:document.getElementById("ui-c-desc").value.trim()});
      render(store.state); return true;
    }
    if(action==="ui-c-del"){ ui.components = ui.components.filter(function(c){return c.id!==el.getAttribute("data-id");}); render(store.state); return true; }
    return false;
  }

  function searchIndex(state){
    return state.ui.screens.map(function(s){return {id:s.id,label:s.name,snippet:s.route};})
      .concat(state.ui.components.map(function(c){return {id:c.id,label:c.name,snippet:c.description};}));
  }

  window.Haiku.router.register("ui", {
    label:"UI e interfaz", render:render, onClick:onClick, searchIndex:searchIndex
  });
})();
