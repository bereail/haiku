// Navegación, registro de secciones y buscador global. Cada archivo de js/sections/*.js se
// registra acá con Haiku.router.register(...) — este archivo no conoce el contenido de ninguna
// sección en particular, solo sabe cómo mostrarlas y delegarles los eventos.
(function(){
  "use strict";
  var U = window.Haiku.utils;
  var store;

  var sections = {}; // id -> {label, icon, render, onClick, onInput, onChange, searchIndex}
  var order = [];
  var activeId = null;

  function register(id, def){
    sections[id] = def;
    order.push(id);
  }

  function goto(id, itemId){
    if(!sections[id]) return;
    activeId = id;
    order.forEach(function(v){
      var el = document.getElementById("view-"+v);
      if(el) el.hidden = (v!==id);
    });
    document.querySelectorAll(".navbtn").forEach(function(b){
      if(b.getAttribute("data-view")===id) b.setAttribute("aria-current","page");
      else b.removeAttribute("aria-current");
    });
    renderActive();
    if(itemId && sections[id].focusItem) sections[id].focusItem(itemId);
    closeSearch();
  }

  function renderActive(){
    var s = sections[activeId];
    if(s && s.render) s.render(store.state);
  }

  function refreshIfActive(id){
    if(id===activeId) renderActive();
  }

  // ---------- Buscador global ----------
  function buildIndex(q){
    var results = [];
    order.forEach(function(id){
      var s = sections[id];
      if(!s.searchIndex) return;
      var items = s.searchIndex(store.state) || [];
      items.forEach(function(it){
        var hay = (it.label+" "+(it.snippet||"")).toLowerCase();
        if(hay.indexOf(q)!==-1){
          results.push({section:id, sectionLabel:s.label, id:it.id, label:it.label, snippet:it.snippet||""});
        }
      });
    });
    return results.slice(0,30);
  }

  function renderSearchResults(q){
    var box = document.getElementById("search-results");
    if(!box) return;
    if(!q){ box.hidden = true; box.innerHTML=""; return; }
    var results = buildIndex(q.toLowerCase());
    if(!results.length){
      box.innerHTML = '<div class="searchempty">Sin resultados para "'+U.escapeHtml(q)+'"</div>';
    }else{
      box.innerHTML = results.map(function(r){
        return '<button type="button" class="searchresult" data-action="goto-ref" data-section="'+r.section+'" data-id="'+U.escapeHtml(r.id)+'">'+
          '<span class="sr-section">'+U.escapeHtml(r.sectionLabel)+'</span>'+
          '<span class="sr-label">'+U.escapeHtml(r.label)+'</span>'+
          (r.snippet? '<span class="sr-snippet">'+U.escapeHtml(r.snippet)+'</span>' : '')+
          '</button>';
      }).join('');
    }
    box.hidden = false;
  }
  function closeSearch(){
    var input = document.getElementById("global-search");
    var box = document.getElementById("search-results");
    if(input) input.value = "";
    if(box){ box.hidden = true; box.innerHTML=""; }
  }

  // ---------- Delegación de eventos ----------
  function wireEvents(){
    document.querySelectorAll(".navbtn").forEach(function(b){
      b.addEventListener("click", function(){ goto(b.getAttribute("data-view")); });
    });

    var searchInput = document.getElementById("global-search");
    if(searchInput){
      searchInput.addEventListener("input", function(){ renderSearchResults(searchInput.value.trim()); });
      searchInput.addEventListener("keydown", function(ev){ if(ev.key==="Escape") closeSearch(); });
    }
    document.addEventListener("click", function(ev){
      if(searchInput && !ev.target.closest(".searchwrap")) closeSearch();
    });

    document.body.addEventListener("click", function(ev){
      var el = ev.target.closest("[data-action]");
      if(!el) return;
      var action = el.getAttribute("data-action");

      if(action==="goto"){ goto(el.getAttribute("data-view")); return; }
      if(action==="goto-ref"){
        goto(el.getAttribute("data-section"), el.getAttribute("data-id"));
        return;
      }
      var s = sections[activeId];
      if(s && s.onClick && s.onClick(action, el, ev)!==false){
        store.scheduleSave();
      }
    });

    document.body.addEventListener("change", function(ev){
      var s = sections[activeId];
      if(s && s.onChange) s.onChange(ev.target, ev);
    });
    document.body.addEventListener("input", function(ev){
      var s = sections[activeId];
      if(s && s.onInput) s.onInput(ev.target, ev);
    });
  }

  window.Haiku.router = {
    register: register,
    goto: goto,
    refreshIfActive: refreshIfActive,
    getActiveId: function(){ return activeId; },
    getSection: function(id){ return sections[id]; },
    init: function(storeRef, startView){
      store = storeRef;
      wireEvents();
      goto(startView || order[0]);
    }
  };
})();
