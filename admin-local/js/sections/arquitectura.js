// Sección "Arquitectura y tecnología": stack real confirmado + inventario editable de rutas del
// backend. No se autogenera consultando el servidor — evita acoplar el panel al código real.
(function(){
  "use strict";
  var U = window.Haiku.utils;
  var C = window.Haiku.components;
  var store = window.Haiku.store;

  function render(state){
    var a = state.architecture;
    var html = C.sectionHead("Arquitectura y tecnología", "Stack real de Haiku e inventario de endpoints del backend.");

    html += C.card(
      '<h3>Stack</h3>'+
      '<textarea id="ar-stacknotes" rows="4" style="width:100%;border:1px solid var(--border);border-radius:8px;padding:8px;background:var(--surface);color:var(--text)">'+U.escapeHtml(a.stackNotes)+'</textarea>',
      "configcard"
    );

    html += C.card(
      '<h3>Rutas del backend (server/routes/)</h3>'+
      '<div class="minitable">'+a.routeFiles.map(function(r){
        return '<div class="minirow" data-id="'+r.id+'">'+
          '<input data-action="ar-rf" data-field="file" data-id="'+r.id+'" value="'+U.escapeHtml(r.file)+'" style="flex:1;font-family:ui-monospace,Consolas,monospace">'+
          '<input data-action="ar-rf" data-field="notes" data-id="'+r.id+'" value="'+U.escapeHtml(r.notes)+'" placeholder="Notas" style="flex:2">'+
          '<button type="button" class="btn btn-ghost-danger btn-sm" data-action="ar-rf-del" data-id="'+r.id+'">Borrar</button>'+
          '</div>';
      }).join('')+'</div>'+
      '<button type="button" class="btn btn-ghost btn-sm" data-action="ar-rf-add" style="margin-top:8px">Agregar ruta</button>',
      "configcard"
    );

    html += C.card(
      '<h3>Entidades de datos</h3>'+
      '<textarea id="ar-entities" rows="3" style="width:100%;border:1px solid var(--border);border-radius:8px;padding:8px;background:var(--surface);color:var(--text)">'+U.escapeHtml(a.dataEntities)+'</textarea>',
      "configcard"
    );

    html += C.card(
      '<h3>Notas adicionales</h3>'+
      '<textarea id="ar-notes" rows="3" style="width:100%;border:1px solid var(--border);border-radius:8px;padding:8px;background:var(--surface);color:var(--text)" placeholder="Rendimiento, infraestructura, despliegues…">'+U.escapeHtml(a.notes)+'</textarea>',
      "configcard"
    );

    document.getElementById("view-arquitectura").innerHTML = html;
  }

  function onClick(action, el){
    var a = store.state.architecture;
    if(action==="ar-rf-add"){ a.routeFiles.push({id:U.uid("rf"), file:"", notes:""}); render(store.state); return true; }
    if(action==="ar-rf-del"){ a.routeFiles = a.routeFiles.filter(function(r){return r.id!==el.getAttribute("data-id");}); render(store.state); return true; }
    return false;
  }
  function onInput(el){
    var a = store.state.architecture;
    if(el.id==="ar-stacknotes"){ a.stackNotes = el.value; store.scheduleSave(); return; }
    if(el.id==="ar-entities"){ a.dataEntities = el.value; store.scheduleSave(); return; }
    if(el.id==="ar-notes"){ a.notes = el.value; store.scheduleSave(); return; }
    if(el.matches('[data-action="ar-rf"]')){
      var r = a.routeFiles.filter(function(x){return x.id===el.getAttribute("data-id");})[0];
      if(r){ r[el.getAttribute("data-field")] = el.value; store.scheduleSave(); }
    }
  }

  function searchIndex(state){
    return state.architecture.routeFiles.map(function(r){ return {id:r.id, label:r.file, snippet:r.notes}; });
  }

  window.Haiku.router.register("arquitectura", {
    label:"Arquitectura y tecnología", render:render, onClick:onClick, onInput:onInput, searchIndex:searchIndex
  });
})();
