require('dotenv').config()
const express = require('express')
const cors = require('cors')

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

app.get('/health', (_, res) => res.json({ ok: true }))

const PORT = process.env.PORT || 3001
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Librook API corriendo en puerto ${PORT}`)
})
