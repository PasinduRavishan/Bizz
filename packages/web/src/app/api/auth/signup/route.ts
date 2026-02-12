import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { createBitcoinComputer } from '@bizz/api/utils/bitcoin-computer-server'
import { getUserWalletPath } from '@bizz/api/utils/wallet-path'

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

    // Development: Initialize and fund wallet
    try {
      const walletPath = getUserWalletPath(user.id, role)
      const userComputer = createBitcoinComputer({ path: walletPath })
      const address = userComputer.getAddress()

      console.log(`💰 Funding ${role} wallet: ${address} (path: ${walletPath})`)
      await userComputer.faucet(1000000) // Fund with 1,000,000 sats (1M for development)

      // Mine a block to confirm the faucet transaction
      const { mineBlocks } = await import('@bizz/api/utils/bitcoin-computer-server')
      await mineBlocks(userComputer, 1)

      const balanceResult = await userComputer.getBalance()
      const balanceNum = Number(balanceResult.balance)
      console.log(`✅ Wallet funded and confirmed - Balance: ${balanceNum} sats (confirmed: ${Number(balanceResult.confirmed)}, unconfirmed: ${Number(balanceResult.unconfirmed)})`)
    } catch (walletError) {
      console.warn(`⚠️ Failed to fund wallet:`, walletError)
      // Continue even if funding fails - user can be funded manually later
    }

    return NextResponse.json(
      {
        message: 'User created successfully',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Sign up error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
