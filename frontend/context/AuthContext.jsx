import React, { createContext, useContext, useEffect, useState } from 'react'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initializeAuth = async () => {
      const savedToken = localStorage.getItem('token')
      const savedUser = localStorage.getItem('user')

      if (savedToken) {
        setToken(savedToken)
      }
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser))
        } catch (error) {
          console.error('Failed to parse saved user:', error)
        }
      }

      if (savedToken && !savedUser) {
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${savedToken}` }
          })
          if (response.ok) {
            const profile = await response.json()
            setUser(profile)
            localStorage.setItem('user', JSON.stringify(profile))
          } else {
            localStorage.removeItem('token')
          }
        } catch (error) {
          console.error('Auth profile fetch failed:', error)
        }
      }

      setLoading(false)
    }

    initializeAuth()
  }, [])

  const login = (newToken, profile) => {
    setToken(newToken)
    setUser(profile || null)
    localStorage.setItem('token', newToken)
    if (profile) {
      localStorage.setItem('user', JSON.stringify(profile))
    } else {
      localStorage.removeItem('user')
    }
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  const refreshUser = async () => {
    if (!token) return null
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!response.ok) return null
    const profile = await response.json()
    setUser(profile)
    localStorage.setItem('user', JSON.stringify(profile))
    return profile
  }

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
