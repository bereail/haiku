export interface Book {
  id: string
  title: string
  author?: string
  cover?: string
  publisher?: string
  genre?: string
  isbn?: string
  pages?: number
  year?: number
  score?: number
  notes?: string
  startDate?: string
  endDate?: string
  color?: string
  totalPages?: number
  currentPage?: number
  createdAt?: string
  wouldReread?: boolean
  communityPostId?: string | null
  abandoned?: boolean
}

export type ReadingStatus = 'pending' | 'reading' | 'read' | 'abandoned'

export interface Goal {
  count: number
  year: number
}

export interface ToastItem {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

export interface CommunityPost {
  id: string
  bookId?: string
  bookTitle: string
  bookAuthor?: string
  bookCover?: string
  bookScore?: number
  reflection: string
  createdAt: string
  authorAlias: string
  canDelete: boolean
  likeCount: number
  likedByMe: boolean
  commentCount: number
}

export interface CommunityComment {
  id: string
  postId: string
  body: string
  createdAt: string
  authorAlias: string
  canDelete: boolean
}

export type ListingKind = 'venta' | 'intercambio'
export type ListingCondition = 'nuevo' | 'muy_bueno' | 'bueno' | 'aceptable'
export type ListingStatus = 'activa' | 'pausada' | 'cerrada'

export interface ListingPhoto {
  id: string
  url: string
  width: number
  height: number
}

export interface Listing {
  id: string
  kind: ListingKind
  bookTitle: string
  bookAuthor: string | null
  condition: ListingCondition
  price: number | null
  currency: string
  description: string | null
  city: string | null
  contact: string | null
  status: ListingStatus
  sellerAlias: string
  isMine: boolean
  canDelete: boolean
  createdAt: string
  updatedAt: string
  photos: ListingPhoto[]
}

export interface ListingInput {
  kind: ListingKind
  condition: ListingCondition
  bookTitle: string
  bookAuthor?: string
  price?: number | string | null
  description?: string
  city?: string
  contact?: string
  status?: ListingStatus
  photoIds: string[]
}
