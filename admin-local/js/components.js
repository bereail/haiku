// Piezas de render reutilizables entre secciones, para no repetir el mismo HTML armado a mano
// en cada archivo de js/sections/. Todas devuelven strings de HTML (mismo patrón que el resto
// del panel) — nada de frameworks, nada de build step.
(function(){
  "use strict";
  var U = window.Haiku.utils;

  function card(innerHtml, extraClass){
    return '<div class="card'+(extraClass? ' '+extraClass : '')+'">'+innerHtml+'</div>';
  }

  function sectionHead(title, sub){
    return '<div class="sectionhead"><div><h2>'+U.escapeHtml(title)+'</h2>'+
      (sub? '<div class="sub">'+U.escapeHtml(sub)+'</div>' : '')+'</div></div>';
  }

  function badge(text, kind){
    // kind: "neutral" | "accent" | "warn" | "danger"
    var cls = {neutral:"st-pendiente", accent:"st-completada", warn:"st-en-curso", danger:"st-bloqueada"}[kind] || "st-pendiente";
    return '<span class="badge '+cls+'"><span class="dot"></span>'+U.escapeHtml(text)+'</span>';
  }

  function statusBadge(status, labelMap){
    return '<span class="badge st-'+status+'"><span class="dot"></span>'+U.escapeHtml(labelMap[status]||status)+'</span>';
  }

  function prioBadge(prio, labelMap){
    return '<span class="badge prio-'+prio+'">'+U.escapeHtml(labelMap[prio]||prio)+'</span>';
  }

  function field(labelHtml, inputHtml, wide){
    return '<div class="field'+(wide? '" style="grid-column:1/-1':'')+'">'+labelHtml+inputHtml+'</div>';
  }

  function formGrid(fieldsHtml){
    return '<div class="form-grid">'+fieldsHtml.join('')+'</div>';
  }

  function emptyState(text){
    return '<p class="emptystate">'+U.escapeHtml(text)+'</p>';
  }

  // refs: [{section, id, label}] — chips clicables que cambian de vista vía router.goto
  function relatedChips(refs){
    if(!refs || !refs.length) return '';
    var html = '<div class="chiprow">';
    refs.forEach(function(r){
      html += '<button type="button" class="chip" data-action="goto-ref" data-section="'+U.escapeHtml(r.section)+'" data-id="'+U.escapeHtml(r.id)+'">'+U.escapeHtml(r.label)+'</button>';
    });
    html += '</div>';
    return html;
  }

  // Lista de opciones de <select> a partir de [{id,label}], marcando selected
  function selectOptions(options, current){
    return options.map(function(o){
      return '<option value="'+U.escapeHtml(o.id)+'"'+(o.id===current?" selected":"")+'>'+U.escapeHtml(o.label)+'</option>';
    }).join('');
  }

  window.Haiku.components = {
    card: card,
    sectionHead: sectionHead,
    badge: badge,
    statusBadge: statusBadge,
    prioBadge: prioBadge,
    field: field,
    formGrid: formGrid,
    emptyState: emptyState,
    relatedChips: relatedChips,
    selectOptions: selectOptions
  };
})();
