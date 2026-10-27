import { Link } from 'react-router-dom'
import styles from './WorkCard.module.css'
import type { LocalWork } from '../hooks/useCatalogSearch'

interface WorkCardProps {
  work: LocalWork
  /** Texto chico debajo del autor — p. ej. "12 personas la tienen" o un año. Opcional. */
  badge?: string
}

// Tarjeta de obra con la tapa como protagonista (proporción 2:3), reutilizada en el
// Catálogo público y en Descubrir — antes esta misma estructura vivía solo en CatalogPage.
export default function WorkCard({ work, badge }: WorkCardProps) {
  return (
    <Link to={`/catalog/obra/${work.id}`} className={styles.card}>
      <div className={styles.cover} style={work.coverUrl ? { backgroundImage: `url(${work.coverUrl})` } : undefined}>
        {!work.coverUrl && <span className={styles.coverFallback}>{work.title.slice(0, 2).toUpperCase()}</span>}
      </div>
      <div className={styles.body}>
        <strong className={styles.title}>{work.title}</strong>
        <span className={styles.meta}>{work.authors.join(', ') || 'Autor desconocido'}</span>
        {badge && <span className={styles.badge}>{badge}</span>}
      </div>
    </Link>
  )
}
