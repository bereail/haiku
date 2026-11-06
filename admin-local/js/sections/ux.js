// Sección "UX y experiencia de usuario": personas, recorridos (journeys) y fricciones. Arranca
// vacía — no hay investigación de UX documentada todavía en el repo, así que no hay nada real
// que sembrar acá.
(function(){
  "use strict";
  var U = window.Haiku.utils;
  var C = window.Haiku.components;
  var store = window.Haiku.store;
  var subTab = "personas";

  function subtabBar(){
    var tabs = [["personas","Personas"],["journeys","Recorridos"],["frictions","Fricciones"]];
    var html = '<div class="subtabbar" role="tablist" aria-label="UX">';
    tabs.forEach(function(t){
      html += '<button type="button" class="subtab'+(subTab===t[0]?' subtabOn':'')+'" role="tab" aria-selected="'+(subTab===t[0])+'" data-action="ux-subtab" data-tab="'+t[0]+'">'+t[1]+'</button>';
    });
    return html+'</div>';
  }

  function renderPersonas(state){
    var html = C.card(
      '<h3>Nueva persona</h3>'+
      C.formGrid([
        '<div class="field"><label for="ux-p-name">Nombre</label><input id="ux-p-name" placeholder="Ej: lectora frecuente"></div>',
        '<div class="field" style="grid-column:1/-1"><label for="ux-p-desc">Descripción</label><textarea id="ux-p-desc"></textarea></div>',
        '<div class="field" style="grid-column:1/-1"><label for="ux-p-needs">Necesidades / problemas que resuelve Haiku</label><textarea id="ux-p-needs"></textarea></div>'
      ])+'<button type="button" class="btn btn-primary btn-sm" data-action="ux-p-add">Agregar persona</button>',
      "configcard"
    );
    html += '<div class="crudlist">';
    if(!state.ux.personas.length) html += C.emptyState("Sin personas documentadas todavía.");
    state.ux.personas.forEach(function(p){
      html += '<div class="cruditem" data-id="'+p.id+'"><div class="cruditem-top"><div class="cruditem-title">'+U.escapeHtml(p.name)+'</div>'+
        '<div class="cruditem-actions"><button type="button" class="btn btn-ghost-danger btn-sm" data-action="ux-p-del" data-id="'+p.id+'">Borrar</button></div></div>'+
        '<div class="cruditem-body"><div>'+U.escapeHtml(p.description)+'</div><div><b>Necesidades:</b> '+U.escapeHtml(p.needs)+'</div></div></div>';
    });
    html += '</div>';
    return html;
  }

  function renderJourneys(state){
    var html = C.card(
      '<h3>Nuevo recorrido</h3>'+
      C.formGrid([
        '<div class="field"><label for="ux-j-title">Título</label><input id="ux-j-title" placeholder="Ej: cargar un libro por voz"></div>',
        '<div class="field"><label for="ux-j-status">Estado</label><select id="ux-j-status">'+C.selectOptions([{id:"documentado",label:"Documentado"},{id:"en-revision",label:"En revisión"},{id:"validado",label:"Validado"}],"documentado")+'</select></div>',
        '<div class="field" style="grid-column:1/-1"><label for="ux-j-steps">Pasos</label><textarea id="ux-j-steps" placeholder="Un paso por línea"></textarea></div>',
        '<div class="field" style="grid-column:1/-1"><label for="ux-j-pain">Fricciones</label><textarea id="ux-j-pain"></textarea></div>',
        '<div class="field" style="grid-column:1/-1"><label for="ux-j-opp">Oportunidades de mejora</label><textarea id="ux-j-opp"></textarea></div>'
      ])+'<button type="button" class="btn btn-primary btn-sm" data-action="ux-j-add">Agregar recorrido</button>',
      "configcard"
    );
    html += '<div class="crudlist">';
    if(!state.ux.journeys.length) html += C.emptyState("Sin recorridos documentados todavía.");
    state.ux.journeys.forEach(function(j){
      html += '<div class="cruditem" data-id="'+j.id+'"><div class="cruditem-top"><div><div class="cruditem-title">'+U.escapeHtml(j.title)+'</div>'+
        '<div class="cruditem-meta">'+C.badge(j.status,"neutral")+'</div></div>'+
        '<div class="cruditem-actions"><button type="button" class="btn btn-ghost-danger btn-sm" data-action="ux-j-del" data-id="'+j.id+'">Borrar</button></div></div>'+
        '<div class="cruditem-body">'+(j.steps? '<div><b>Pasos:</b> '+U.escapeHtml(j.steps)+'</div>':'')+(j.painPoints? '<div><b>Fricciones:</b> '+U.escapeHtml(j.painPoints)+'</div>':'')+(j.opportunities? '<div><b>Oportunidades:</b> '+U.escapeHtml(j.opportunities)+'</div>':'')+'</div></div>';
    });
    html += '</div>';
    return html;
  }

  function renderFrictions(state){
    var html = C.card(
      '<h3>Nueva fricción</h3>'+
      C.formGrid([
        '<div class="field" style="grid-column:1/-1"><label for="ux-f-text">Descripción</label><textarea id="ux-f-text"></textarea></div>',
        '<div class="field"><label for="ux-f-sev">Severidad</label><select id="ux-f-sev">'+C.selectOptions([{id:"alta",label:"Alta"},{id:"media",label:"Media"},{id:"baja",label:"Baja"}],"media")+'</select></div>'
      ])+'<button type="button" class="btn btn-primary btn-sm" data-action="ux-f-add">Agregar fricción</button>',
      "configcard"
    );
    html += '<div class="crudlist">';
    if(!state.ux.frictions.length) html += C.emptyState("Sin fricciones registradas todavía.");
    state.ux.frictions.forEach(function(f){
      html += '<div class="cruditem" data-id="'+f.id+'"><div class="cruditem-top"><div><div class="cruditem-title">'+U.escapeHtml(f.text)+'</div>'+
        '<div class="cruditem-meta">'+C.prioBadge(f.severity,{alta:"Severidad alta",media:"Severidad media",baja:"Severidad baja"})+C.badge(f.status,"neutral")+'</div></div>'+
        '<div class="cruditem-actions"><button type="button" class="btn btn-ghost-danger btn-sm" data-action="ux-f-del" data-id="'+f.id+'">Borrar</button></div></div></div>';
    });
    html += '</div>';
    return html;
  }

  function render(state){
    var html = subtabBar();
    if(subTab==="personas") html += renderPersonas(state);
    else if(subTab==="journeys") html += renderJourneys(state);
    else html += renderFrictions(state);
    document.getElementById("view-ux").innerHTML = C.sectionHead("UX y experiencia de usuario","Usuarias, recorridos y fricciones de Haiku.")+html;
  }

  function onClick(action, el){
    var ux = store.state.ux;
    if(action==="ux-subtab"){ subTab = el.getAttribute("data-tab"); render(store.state); return false; }
    if(action==="ux-p-add"){
      var name = document.getElementById("ux-p-name").value.trim();
      if(!name) return false;
      ux.personas.push({id:U.uid("ps"), name:name, description:document.getElementById("ux-p-desc").value.trim(), needs:document.getElementById("ux-p-needs").value.trim()});
      render(store.state); return true;
    }
    if(action==="ux-p-del"){ ux.personas = ux.personas.filter(function(p){return p.id!==el.getAttribute("data-id");}); render(store.state); return true; }
    if(action==="ux-j-add"){
      var title = document.getElementById("ux-j-title").value.trim();
      if(!title) return false;
      ux.journeys.push({id:U.uid("jr"), title:title, status:document.getElementById("ux-j-status").value, steps:document.getElementById("ux-j-steps").value.trim(), painPoints:document.getElementById("ux-j-pain").value.trim(), opportunities:document.getElementById("ux-j-opp").value.trim()});
      render(store.state); return true;
    }
    if(action==="ux-j-del"){ ux.journeys = ux.journeys.filter(function(j){return j.id!==el.getAttribute("data-id");}); render(store.state); return true; }
    if(action==="ux-f-add"){
      var text = document.getElementById("ux-f-text").value.trim();
      if(!text) return false;
      ux.frictions.push({id:U.uid("fr"), text:text, severity:document.getElementById("ux-f-sev").value, status:"abierta"});
      render(store.state); return true;
    }
    if(action==="ux-f-del"){ ux.frictions = ux.frictions.filter(function(f){return f.id!==el.getAttribute("data-id");}); render(store.state); return true; }
    return false;
  }

  function searchIndex(state){
    return state.ux.personas.map(function(p){return {id:p.id,label:p.name,snippet:p.description};})
      .concat(state.ux.journeys.map(function(j){return {id:j.id,label:j.title,snippet:j.steps};}))
      .concat(state.ux.frictions.map(function(f){return {id:f.id,label:f.text,snippet:""};}));
  }

  window.Haiku.router.register("ux", {
    label:"UX y experiencia", render:render, onClick:onClick, searchIndex:searchIndex
  });
})();
