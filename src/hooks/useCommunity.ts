import { useState, useCallback } from 'react'
import { api } from '../api'
import type { CommunityPost, CommunityComment } from '../types'

export function useCommunity() {
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  const loadMore = useCallback(async () => {
    setLoading(true)
    try {
      const query = nextCursor ? `?limit=20&before=${encodeURIComponent(nextCursor)}` : '?limit=20'
      const data = await api.get(`/community/posts${query}`)
      setPosts(prev => [...prev, ...data.posts])
      setNextCursor(data.nextCursor)
    } finally {
      setLoading(false)
      setInitialized(true)
    }
  }, [nextCursor])

  const sharePost = async (bookId: string, reflection: string) => {
    const post: CommunityPost = await api.post('/community/posts', { bookId, reflection })
    setPosts(prev => {
      const exists = prev.some(p => p.id === post.id)
      return exists ? prev.map(p => (p.id === post.id ? post : p)) : [post, ...prev]
    })
    return post
  }

  const deletePost = async (id: string) => {
    await api.delete(`/community/posts/${id}`)
    setPosts(prev => prev.filter(p => p.id !== id))
  }

  const toggleLike = async (post: CommunityPost) => {
    const wasLiked = post.likedByMe
    const prevLikeCount = post.likeCount
    setPosts(prev => prev.map(p => (
      p.id === post.id ? { ...p, likedByMe: !wasLiked, likeCount: prevLikeCount + (wasLiked ? -1 : 1) } : p
    )))
    try {
      const result: { liked: boolean; likeCount: number } = wasLiked
        ? await api.delete(`/community/posts/${post.id}/likes`)
        : await api.post(`/community/posts/${post.id}/likes`, {})
      setPosts(prev => prev.map(p => (
        p.id === post.id ? { ...p, likedByMe: result.liked, likeCount: result.likeCount } : p
      )))
    } catch (err) {
      setPosts(prev => prev.map(p => (
        p.id === post.id ? { ...p, likedByMe: wasLiked, likeCount: prevLikeCount } : p
      )))
      throw err
    }
  }

  const loadComments = async (postId: string): Promise<CommunityComment[]> => {
    const data = await api.get(`/community/posts/${postId}/comments`)
    return data.comments
  }

  const addComment = async (postId: string, body: string): Promise<CommunityComment> => {
    const comment = await api.post(`/community/posts/${postId}/comments`, { body })
    setPosts(prev => prev.map(p => (p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p)))
    return comment
  }

  const deleteComment = async (postId: string, commentId: string) => {
    await api.delete(`/community/comments/${commentId}`)
    setPosts(prev => prev.map(p => (
      p.id === postId ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p
    )))
  }

  const getProfile = (): Promise<{ displayName: string | null; alias: string }> =>
    api.get('/settings/profile')

  const updateAlias = (displayName: string): Promise<{ displayName: string | null; alias: string }> =>
    api.put('/settings/profile', { displayName })

  return {
    posts,
    loading,
    hasMore: !initialized || nextCursor !== null,
    initialized,
    loadMore,
    sharePost,
    deletePost,
    toggleLike,
    loadComments,
    addComment,
    deleteComment,
    getProfile,
    updateAlias,
  }
}
