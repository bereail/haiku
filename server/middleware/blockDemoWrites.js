// Usar después de authMiddleware en cualquier ruta que modifique datos.
// La cuenta invitado (demo-login) es compartida entre todos los visitantes:
// permitir escritura ahí mezclaría y rompería los datos de ejemplo entre sesiones distintas.
module.exports = function blockDemoWrites(req, res, next) {
  if (req.isDemo) {
    return res.status(403).json({ error: 'Esto es una demo de solo lectura. Registrate para guardar tus propios libros.' })
  }
  next()
}
