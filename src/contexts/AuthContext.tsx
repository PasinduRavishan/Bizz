'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useWallet } from './WalletContext'

export type UserRole = 'TEACHER' | 'STUDENT' | 'BOTH' | null

interface AuthContextType {
  role: UserRole
  isAuthenticated: boolean
  setRole: (role: UserRole) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({
  role: null,
  isAuthenticated: false,
  setRole: () => {},
  logout: () => {}
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const { connected, address, disconnect } = useWallet()
  const [role, setRoleState] = useState<UserRole>(null)

  // Load role from localStorage on mount
  useEffect(() => {
    if (connected && address) {
      const savedRole = localStorage.getItem(`user_role_${address}`)
      if (savedRole && (savedRole === 'TEACHER' || savedRole === 'STUDENT' || savedRole === 'BOTH')) {
        setRoleState(savedRole as UserRole)
      }
    } else {
      setRoleState(null)
    }
  }, [connected, address])

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole)
    if (address && newRole) {
      localStorage.setItem(`user_role_${address}`, newRole)
    }
  }

  const logout = () => {
    if (address) {
      localStorage.removeItem(`user_role_${address}`)
    }
    setRoleState(null)
    disconnect()
  }

  const isAuthenticated = connected && role !== null

  return (
    <AuthContext.Provider
      value={{
        role,
        isAuthenticated,
        setRole,
        logout
      }}
    >
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
