import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface User {
    id: string
    email: string
    name: string
    role: 'TEACHER' | 'STUDENT' | 'BOTH'
    address?: string | null
  }

  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: 'TEACHER' | 'STUDENT' | 'BOTH'
      walletAddress?: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: 'TEACHER' | 'STUDENT' | 'BOTH'
    address?: string | null
  }
}
