import 'dotenv/config'
import bcrypt from 'bcryptjs'
import connectDB from '../config/db.js'
import { User } from '../models/index.js'

const demoUsers = [
  { un: 'admin', pw: 'admin123', name: 'Admin', role: 'ADMIN' },
  { un: 'engineer', pw: 'eng123', name: 'Engineer', role: 'ENGINEER' },
  { un: 'operator', pw: 'op123', name: 'Operator', role: 'OPERATOR' },
  { un: 'viewer', pw: 'view123', name: 'Viewer', role: 'VIEWER' },
]

async function seed() {
  try {
    await connectDB()

    for (const { un, pw, name, role } of demoUsers) {
      const exists = await User.findOne({ un })
      if (!exists) {
        const pwHash = await bcrypt.hash(pw, 10)
        await User.create({ un, pwHash, name, role, on: true })
        console.log(`Created user: ${un} (${role})`)
      } else {
        console.log(`User exists: ${un}`)
      }
    }

    console.log('User seed completed')
    process.exit(0)
  } catch (err) {
    console.error('Seed failed:', err)
    process.exit(1)
  }
}

seed()
