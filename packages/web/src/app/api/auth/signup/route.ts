import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { initializeUserWallet } from '@/lib/wallet-service'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, role } = await request.json()

    // Validation
    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    if (!['TEACHER', 'STUDENT'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Create user in database
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash,
        role
      }
    })

    console.log(`👤 Created user ${user.id} (${user.role})`)

    // Initialize custodial wallet for the user
    try {
      const walletInfo = await initializeUserWallet(user.id)
      console.log(`✅ Wallet created for ${user.email}: ${walletInfo.address}`)
      
      return NextResponse.json(
        { 
          message: 'User created successfully with custodial wallet',
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            address: walletInfo.address,
            walletType: 'CUSTODIAL'
          }
        },
        { status: 201 }
      )
    } catch (walletError) {
      console.error('⚠️ Wallet initialization failed:', walletError)
      
      // User is created but wallet failed - still return success
      // They can retry wallet creation later
      return NextResponse.json(
        { 
          message: 'User created successfully (wallet initialization pending)',
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
          },
          warning: 'Wallet will be created on first use'
        },
        { status: 201 }
      )
    }
  } catch (error) {
    console.error('Sign up error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
