// Nombre público de un usuario en Comunidad y en la página pública de cada obra.
// Antes, sin alias elegido, se mostraba la parte del email antes de la @ (muchas veces
// nombre y apellido o un identificador personal). Ahora es "Lector/a" + un código estable
// de 4 caracteres derivado del id interno: no revela nada del email.
// `t` es el alias de la tabla users en la consulta ('u.' o '').
function publicAliasSql(t = '') {
  return `COALESCE(${t}display_name, 'Lector/a ' || upper(substr(md5(${t}id::text), 1, 4)))`
}

module.exports = { publicAliasSql }
