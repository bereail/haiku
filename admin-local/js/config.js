// Modal de Configuración (exportar/importar/respaldo/reiniciar) — accesible desde el engranaje
// del pie del sidebar. No es una de las 10 secciones de navegación: es una utilidad transversal.
(function(){
  "use strict";
  var U = window.Haiku.utils;
  var store = window.Haiku.store;
  var pendingImport = null;

  function renderBody(){
    var html = "";
    if(store.isStorageBroken()){
      html += '<div class="banner danger">Este navegador no está guardando los cambios (almacenamiento local bloqueado o lleno). Exportá un respaldo manual antes de cerrar la pestaña.</div>';
    }
    html += '<div class="card configcard"><h3>Exportar respaldo</h3><p class="hint">Descarga todo el panel (las 10 secciones) en un archivo JSON.</p><button type="button" class="btn btn-primary" data-action="cfg-export">Exportar JSON</button></div>';
    html += '<div class="card configcard"><h3>Importar respaldo</h3><p class="hint">Reemplaza los datos actuales por los de un archivo exportado antes. Se guarda una copia de lo que había antes de importar.</p><input type="file" id="import-file" accept="application/json"><div id="import-preview"></div></div>';

    var backup = store.getBackup();
    if(backup){
      html += '<div class="card configcard"><h3>Respaldo automático anterior</h3><p class="hint">Se guarda solo, antes de cada importación o reinicio. Último: '+new Date(backup.savedAt).toLocaleString("es-AR")+'.</p><button type="button" class="btn btn-ghost" data-action="cfg-restore-backup">Restaurar este respaldo</button></div>';
    }

    html += '<div class="card configcard"><h3>Reiniciar todo</h3><p class="hint">Borra tus cambios y vuelve a los datos semilla reales del panel. Hacé un respaldo antes.</p><button type="button" class="btn btn-ghost-danger" data-action="cfg-reset-confirm">Reiniciar</button><div id="reset-confirm-box"></div></div>';
    html += '<div class="card configcard"><h3>Dónde viven estos datos</h3><p class="hint">Se guardan en el almacenamiento local de este navegador, en esta computadora. No se sincronizan solos con otro navegador ni con otra máquina — para eso, exportá e importá el JSON. No guardes contraseñas, tokens ni datos personales sensibles acá.</p></div>';
    return html;
  }

  function open(){
    var backdrop = document.getElementById("configmodal");
    document.getElementById("configmodal-body").innerHTML = renderBody();
    backdrop.hidden = false;
    var fileInput = document.getElementById("import-file");
    if(fileInput) fileInput.addEventListener("change", onImportFileChosen);
  }
  function close(){ document.getElementById("configmodal").hidden = true; }

  function onImportFileChosen(ev){
    var file = ev.target.files[0];
    pendingImport = null;
    var box = document.getElementById("import-preview");
    box.innerHTML = "";
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(){
      var parsed;
      try{ parsed = JSON.parse(reader.result); }
      catch(e){ box.innerHTML = '<div class="confirmbox">El archivo no es un JSON válido.</div>'; return; }
      if(!parsed || !parsed.roadmap || !Array.isArray(parsed.roadmap.tasks)){
        box.innerHTML = '<div class="confirmbox">El archivo no tiene el formato esperado de este panel.</div>'; return;
      }
      pendingImport = parsed;
      box.innerHTML = '<div class="confirmbox">Este archivo tiene '+parsed.roadmap.tasks.length+' tareas y '+(parsed.features||[]).length+' funcionalidades. Va a <b>reemplazar</b> lo que tenés ahora (se guarda un respaldo automático antes).'+
        '<div class="actions"><button type="button" class="btn btn-primary btn-sm" data-action="cfg-confirm-import">Importar y reemplazar</button> <button type="button" class="btn btn-ghost btn-sm" data-action="cfg-cancel-import">Cancelar</button></div></div>';
    };
    reader.readAsText(file);
  }

  function wire(){
    var gearBtn = document.getElementById("gearbtn");
    if(gearBtn) gearBtn.addEventListener("click", open);
    var backdrop = document.getElementById("configmodal");
    if(backdrop){
      backdrop.addEventListener("click", function(ev){ if(ev.target===backdrop) close(); });
    }
    document.body.addEventListener("click", function(ev){
      var el = ev.target.closest("[data-action]");
      if(!el) return;
      var action = el.getAttribute("data-action");
      if(action==="cfg-close"){ close(); return; }
      if(action==="cfg-export"){
        var blob = new Blob([JSON.stringify(store.state,null,2)], {type:"application/json"});
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        var stamp = new Date().toISOString().replace(/[:.]/g,"-").slice(0,16);
        a.href=url; a.download = "haiku-panel-"+stamp+".json";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
        U.showToast("Respaldo exportado");
        return;
      }
      if(action==="cfg-confirm-import"){
        if(!pendingImport) return;
        store.importData(pendingImport);
        pendingImport = null;
        window.Haiku.router.goto(window.Haiku.router.getActiveId());
        open();
        U.showToast("Importado");
        return;
      }
      if(action==="cfg-cancel-import"){
        pendingImport = null;
        var box = document.getElementById("import-preview");
        if(box) box.innerHTML="";
        var fi = document.getElementById("import-file");
        if(fi) fi.value="";
        return;
      }
      if(action==="cfg-restore-backup"){
        if(store.restoreBackup()){
          window.Haiku.router.goto(window.Haiku.router.getActiveId());
          open();
          U.showToast("Respaldo restaurado");
        }
        return;
      }
      if(action==="cfg-reset-confirm"){
        document.getElementById("reset-confirm-box").innerHTML =
          '<div class="confirmbox">¿Reiniciar de verdad? Se borran tus cambios (queda un respaldo automático).'+
          '<div class="actions"><button type="button" class="btn btn-ghost-danger btn-sm" data-action="cfg-reset-do">Sí, reiniciar</button> <button type="button" class="btn btn-ghost btn-sm" data-action="cfg-reset-cancel">Cancelar</button></div></div>';
        return;
      }
      if(action==="cfg-reset-cancel"){ document.getElementById("reset-confirm-box").innerHTML=""; return; }
      if(action==="cfg-reset-do"){
        store.resetToSeed();
        window.Haiku.utils.applyIdentityTokens(store.state.identity.tokens);
        window.Haiku.router.goto(window.Haiku.router.getActiveId());
        open();
        U.showToast("Reiniciado");
        return;
      }
    });
  }

  window.Haiku.config = { wire: wire };
})();
