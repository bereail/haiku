require('dotenv').config()
const express = require('express')
const cors = require('cors')
const pool = require('./db')
const { checkUploadsConfig, resolveUploadsDir } = require('./images/storage')

const app = express()

app.use(cors({
  origin: ['https://ailonline.com.ar', 'http://localhost:5173'],
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))

app.set('trust proxy', 1)
app.use('/auth',      require('./routes/auth'))
app.use('/books',     require('./routes/books'))
app.use('/admin',     require('./routes/admin'))
app.use('/analytics', require('./routes/analytics'))
app.use('/settings',  require('./routes/settings'))
app.use('/community', require('./routes/community'))
app.use('/catalog',   require('./routes/catalog'))
app.use('/uploads',   require('./routes/uploads'))
app.use('/marketplace', require('./routes/marketplace'))

// Antes solo confirmaba que el proceso Node estaba vivo, no que la API sirviera algo real —
// un deploy con la base caída o mal configurada podía pasar este chequeo igual.
app.get('/health', async (_, res) => {
  try {
    await pool.query('SELECT 1')
    // uploads: si la carpeta de fotos del Mercado está bien configurada (sin exponer la ruta)
    res.json({ ok: true, db: true, uploads: !resolveUploadsDir().error })
  } catch (err) {
    console.error('health check: fallo de conexión a la base', err)
    res.status(503).json({ ok: false, db: false })
  }
})

// Carpeta de imágenes del Mercado: si falta o es inválida, se avisa y se deshabilitan solo
// las fotos (el resto de la API sigue andando). Ver images/storage.js.
checkUploadsConfig()

const PORT = process.env.PORT || 3001
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Librook API corriendo en puerto ${PORT}`)
})
