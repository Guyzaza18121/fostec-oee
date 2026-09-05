import mongoose from 'mongoose'

mongoose.set('bufferCommands', false)

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    })
    console.log(`MongoDB Connected: ${conn.connection.host}`)
    return conn
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`)
    console.warn('⚠️  Server will start WITHOUT MongoDB — using mock data fallback.')
    return null
  }
}

export default connectDB
