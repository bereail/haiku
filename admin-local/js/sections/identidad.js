// Sección "Identidad visual y estética": mini design system del panel — colores, tipografía,
// escala de espaciado, sombras, referencias visuales y una vista previa de componentes en vivo.
// Los tokens de color/radio/tipografía se aplican como variables CSS a todo el panel (igual que
// la sección "Estética" de hoy); todavía no toca el código de la app real — es el espacio para
// definir la identidad antes de llevarla ahí.
(function(){
  "use strict";
  var U = window.Haiku.utils;
  var C = window.Haiku.components;
  var store = window.Haiku.store;

  function render(state){
    var id = state.identity;
    var html = C.sectionHead("Identidad visual", "Mini design system de Haiku: colores, tipografía, espaciado, sombras y referencias. Se ve en vivo en todo este panel.");

    html += C.card(
      '<h3>Colores de marca</h3>'+
      '<p class="hint">Fondo negro, rojo como color característico, dorado como secundario — sin saturar la vista; el blanco queda reservado para resaltar. El primario se usa en botones, enlaces y acentos de todo el panel.</p>'+
      C.formGrid([
        '<div class="colorfield"><label for="id-primary">Primario (rojo)</label><div class="colorrow"><input type="color" id="id-primary" value="'+id.tokens.primary+'"><span class="hexval">'+id.tokens.primary+'</span></div></div>',
        '<div class="colorfield"><label for="id-secondary">Secundario (dorado)</label><div class="colorrow"><input type="color" id="id-secondary" value="'+id.tokens.secondary+'"><span class="hexval">'+id.tokens.secondary+'</span></div></div>',
        '<div class="colorfield"><label for="id-bg">Fondo (negro)</label><div class="colorrow"><input type="color" id="id-bg" value="'+id.tokens.bg+'"><span class="hexval">'+id.tokens.bg+'</span></div></div>'
      ]),
      "configcard"
    );

    html += C.card(
      '<h3>Logo</h3>'+
      '<p class="hint">Logo definitivo (admin-local/assets/logo.png): un libro abierto, blanco sobre negro, con una cinta dorada sutil donde se unen las páginas — insinúa la "H" sin tapar el dibujo.</p>'+
      '<div class="logopreview">'+
      '  <div class="logoswatch">'+
      '    <div class="logo-hwrap">'+
      '      <img src="assets/logo.png" alt="Logo de Haiku" style="width:100%;height:100%;object-fit:contain;display:block">'+
      '      <span class="logo-hbar"></span>'+
      '    </div>'+
      '  </div>'+
      '</div>',
      "configcard"
    );

    html += C.card(
      '<h3>Forma</h3>'+
      '<div class="rangefield"><label for="id-radius">Radio de bordes</label><div class="rangerow"><input type="range" id="id-radius" min="0" max="24" step="1" value="'+id.tokens.radius+'"><span class="rangeval">'+id.tokens.radius+'px</span></div></div>',
      "configcard"
    );

    html += C.card(
      '<h3>Tipografía</h3>'+
      C.formGrid([
        '<div class="field"><label for="id-font">Familia tipográfica</label><select id="id-font">'+C.selectOptions(U.FONT_OPTIONS, id.tokens.fontFamily)+'</select></div>',
        '<div class="rangefield"><label for="id-fontsize">Tamaño base</label><div class="rangerow"><input type="range" id="id-fontsize" min="13" max="18" step="1" value="'+id.tokens.fontSizeBase+'"><span class="rangeval">'+id.tokens.fontSizeBase+'px</span></div></div>'
      ])+
      '<h3 style="margin-top:16px">Escala tipográfica</h3>'+
      typeScaleTable(id.typeScale),
      "configcard"
    );

    html += C.card('<h3>Espaciado</h3>'+spacingTable(id.spacingScale), "configcard");
    html += C.card('<h3>Sombras</h3>'+shadowTable(id.shadowLevels), "configcard");

    html += C.card(
      '<h3>Notas de estilo</h3>'+
      '<textarea id="id-stylenotes" rows="3" style="width:100%;border:1px solid var(--border);border-radius:8px;padding:8px;background:var(--surface);color:var(--text)">'+U.escapeHtml(id.styleNotes)+'</textarea>',
      "configcard"
    );

    html += C.card('<h3>Referencias visuales</h3>'+referencesList(id.references), "configcard");

    html += '<div class="sectionhead" style="margin-top:4px"><div><h2 style="font-size:16px">Vista previa de componentes</h2><div class="sub">Usá el botón de tema (abajo a la izquierda) para ver esta previsualización en claro y oscuro.</div></div></div>';
    html += '<div class="previewbox">';
    html += '  <div class="ptitle">Haiku — biblioteca personal</div>';
    html += '  <div class="ptext">Botones, estados y tipografía con los tokens actuales.</div>';
    html += '  <div class="prow">';
    html += '    <button class="btn btn-primary" type="button">Acción primaria</button>';
    html += '    <button class="btn btn-secondary" type="button">Acción secundaria</button>';
    html += '    <button class="btn btn-ghost" type="button">Acción ghost</button>';
    html += '  </div>';
    html += '  <div class="prow">';
    html += '    <span class="badge st-completada"><span class="dot"></span>Completada</span>';
    html += '    <span class="badge st-en-curso"><span class="dot"></span>En curso</span>';
    html += '    <span class="badge prio-alta">Prioridad alta</span>';
    html += '  </div>';
    html += '  <div class="progressbar" style="max-width:320px"><span style="width:62%"></span></div>';
    html += '</div>';

    html += C.card(
      '<h3>Exportar tokens</h3>'+
      '<p class="hint">Copiá estos valores como variables CSS para pegarlos después en el proyecto real.</p>'+
      '<button class="btn btn-ghost btn-sm" data-action="id-copy-css">Copiar como CSS</button>'+
      '<button class="btn btn-ghost btn-sm" data-action="id-reset" style="margin-left:8px">Restablecer paleta de Haiku</button>',
      "configcard"
    );

    document.getElementById("view-identidad").innerHTML = html;
  }

  function typeScaleTable(rows){
    var html = '<div class="minitable">';
    rows.forEach(function(r){
      html += '<div class="minirow" data-id="'+r.id+'">';
      html += '  <input data-action="ts-field" data-field="name" data-id="'+r.id+'" value="'+U.escapeHtml(r.name)+'" placeholder="Nombre" style="flex:1">';
      html += '  <input type="number" data-action="ts-field" data-field="size" data-id="'+r.id+'" value="'+r.size+'" style="width:64px"> px';
      html += '  <input type="number" data-action="ts-field" data-field="weight" data-id="'+r.id+'" value="'+r.weight+'" style="width:60px">';
      html += '  <input data-action="ts-field" data-field="usage" data-id="'+r.id+'" value="'+U.escapeHtml(r.usage)+'" placeholder="Uso" style="flex:2">';
      html += '  <button type="button" class="btn btn-ghost-danger btn-sm" data-action="ts-del" data-id="'+r.id+'">Borrar</button>';
      html += '</div>';
    });
    html += '</div><button type="button" class="btn btn-ghost btn-sm" data-action="ts-add" style="margin-top:8px">Agregar nivel</button>';
    return html;
  }
  function spacingTable(rows){
    var html = '<div class="minitable">';
    rows.forEach(function(r){
      html += '<div class="minirow" data-id="'+r.id+'">';
      html += '  <input data-action="sp-field" data-field="name" data-id="'+r.id+'" value="'+U.escapeHtml(r.name)+'" placeholder="Nombre" style="flex:1">';
      html += '  <input type="number" data-action="sp-field" data-field="value" data-id="'+r.id+'" value="'+r.value+'" style="width:64px"> px';
      html += '  <button type="button" class="btn btn-ghost-danger btn-sm" data-action="sp-del" data-id="'+r.id+'">Borrar</button>';
      html += '</div>';
    });
    html += '</div><button type="button" class="btn btn-ghost btn-sm" data-action="sp-add" style="margin-top:8px">Agregar nivel</button>';
    return html;
  }
  function shadowTable(rows){
    var html = '<div class="minitable">';
    rows.forEach(function(r){
      html += '<div class="minirow" data-id="'+r.id+'">';
      html += '  <input data-action="sh-field" data-field="name" data-id="'+r.id+'" value="'+U.escapeHtml(r.name)+'" placeholder="Nombre" style="flex:1">';
      html += '  <input data-action="sh-field" data-field="value" data-id="'+r.id+'" value="'+U.escapeHtml(r.value)+'" placeholder="box-shadow CSS" style="flex:2">';
      html += '  <button type="button" class="btn btn-ghost-danger btn-sm" data-action="sh-del" data-id="'+r.id+'">Borrar</button>';
      html += '</div>';
    });
    html += '</div><button type="button" class="btn btn-ghost btn-sm" data-action="sh-add" style="margin-top:8px">Agregar nivel</button>';
    return html;
  }
  function referencesList(refs){
    var html = '<div class="minitable">';
    refs.forEach(function(r){
      html += '<div class="minirow" data-id="'+r.id+'">';
      html += '  <input data-action="ref-field" data-field="url" data-id="'+r.id+'" value="'+U.escapeHtml(r.url)+'" placeholder="URL" style="flex:2">';
      html += '  <input data-action="ref-field" data-field="note" data-id="'+r.id+'" value="'+U.escapeHtml(r.note)+'" placeholder="Nota" style="flex:1">';
      html += '  <button type="button" class="btn btn-ghost-danger btn-sm" data-action="ref-del" data-id="'+r.id+'">Borrar</button>';
      html += '</div>';
    });
    html += '</div><button type="button" class="btn btn-ghost btn-sm" data-action="ref-add" style="margin-top:8px">Agregar referencia</button>';
    return html;
  }

  function aestheticsCss(tokens){
    return ":root {\n"+
      "  --accent: "+tokens.primary+";\n"+
      "  --brand-secondary: "+tokens.secondary+";\n"+
      "  --bg: "+tokens.bg+";\n"+
      "  --radius: "+tokens.radius+"px;\n"+
      "  --font: "+U.fontStack(tokens.fontFamily)+";\n"+
      "  --font-size-base: "+tokens.fontSizeBase+"px;\n"+
      "}";
  }

  function findRow(arr, id){ return arr.filter(function(r){ return r.id===id; })[0]; }

  function onClick(action, el){
    var state = store.state;
    var id = state.identity;

    if(action==="id-copy-css"){
      var css = aestheticsCss(id.tokens);
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(css).then(function(){ U.showToast("CSS copiado"); }).catch(function(){ U.showToast("No se pudo copiar"); });
      }else{ U.showToast("No se pudo copiar"); }
      return false;
    }
    if(action==="id-reset"){
      id.tokens = window.Haiku.store.seedDataV2().identity.tokens;
      U.applyIdentityTokens(id.tokens);
      render(state);
      U.showToast("Paleta restablecida");
      return true;
    }
    if(action==="ts-add"){ id.typeScale.push({id:U.uid("ts"), name:"Nuevo nivel", size:15, weight:400, usage:""}); render(state); return true; }
    if(action==="ts-del"){ id.typeScale = id.typeScale.filter(function(r){return r.id!==el.getAttribute("data-id");}); render(state); return true; }
    if(action==="sp-add"){ id.spacingScale.push({id:U.uid("sp"), name:"nuevo", value:8}); render(state); return true; }
    if(action==="sp-del"){ id.spacingScale = id.spacingScale.filter(function(r){return r.id!==el.getAttribute("data-id");}); render(state); return true; }
    if(action==="sh-add"){ id.shadowLevels.push({id:U.uid("sh"), name:"Nueva sombra", value:"0 2px 6px rgba(0,0,0,.1)"}); render(state); return true; }
    if(action==="sh-del"){ id.shadowLevels = id.shadowLevels.filter(function(r){return r.id!==el.getAttribute("data-id");}); render(state); return true; }
    if(action==="ref-add"){ id.references.push({id:U.uid("ref"), url:"", note:""}); render(state); return true; }
    if(action==="ref-del"){ id.references = id.references.filter(function(r){return r.id!==el.getAttribute("data-id");}); render(state); return true; }
    return false;
  }

  function onChange(el){
    if(el.id==="id-font"){
      store.state.identity.tokens.fontFamily = el.value;
      U.applyIdentityTokens(store.state.identity.tokens);
      store.scheduleSave();
    }
  }

  function onInput(el){
    var tokens = store.state.identity.tokens;
    var id = store.state.identity;

    if(el.id==="id-primary"){ tokens.primary=el.value; el.nextElementSibling.textContent=el.value; U.applyIdentityTokens(tokens); store.scheduleSave(); return; }
    if(el.id==="id-secondary"){ tokens.secondary=el.value; el.nextElementSibling.textContent=el.value; U.applyIdentityTokens(tokens); store.scheduleSave(); return; }
    if(el.id==="id-bg"){ tokens.bg=el.value; el.nextElementSibling.textContent=el.value; U.applyIdentityTokens(tokens); store.scheduleSave(); return; }
    if(el.id==="id-radius"){ tokens.radius=parseInt(el.value,10); el.nextElementSibling.textContent=el.value+"px"; U.applyIdentityTokens(tokens); store.scheduleSave(); return; }
    if(el.id==="id-fontsize"){ tokens.fontSizeBase=parseInt(el.value,10); el.nextElementSibling.textContent=el.value+"px"; U.applyIdentityTokens(tokens); store.scheduleSave(); return; }
    if(el.id==="id-stylenotes"){ id.styleNotes = el.value; store.scheduleSave(); return; }

    if(el.matches('[data-action="ts-field"]')){
      var tr = findRow(id.typeScale, el.getAttribute("data-id"));
      if(tr){ var f=el.getAttribute("data-field"); tr[f] = (f==="size"||f==="weight") ? parseFloat(el.value)||0 : el.value; store.scheduleSave(); }
      return;
    }
    if(el.matches('[data-action="sp-field"]')){
      var sr = findRow(id.spacingScale, el.getAttribute("data-id"));
      if(sr){ var f2=el.getAttribute("data-field"); sr[f2] = f2==="value" ? (parseFloat(el.value)||0) : el.value; store.scheduleSave(); }
      return;
    }
    if(el.matches('[data-action="sh-field"]')){
      var shr = findRow(id.shadowLevels, el.getAttribute("data-id"));
      if(shr){ shr[el.getAttribute("data-field")] = el.value; store.scheduleSave(); }
      return;
    }
    if(el.matches('[data-action="ref-field"]')){
      var rr = findRow(id.references, el.getAttribute("data-id"));
      if(rr){ rr[el.getAttribute("data-field")] = el.value; store.scheduleSave(); }
      return;
    }
  }

  function searchIndex(state){
    return state.identity.references.map(function(r){ return {id:r.id, label:r.note||r.url, snippet:r.url}; });
  }

  window.Haiku.router.register("identidad", {
    label: "Identidad visual",
    render: render,
    onClick: onClick,
    onChange: onChange,
    onInput: onInput,
    searchIndex: searchIndex
  });
})();
