import mongoose from 'mongoose'
import '../models/index.js'

function getMongoUri() {
  return (
    process.env.MONGODB_URI ||
    process.env.STORAGE_URL ||
    process.env.MONGODB_URL
  )
}

let cached = global.mongoose

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null }
}

export async function connectDB() {
  const mongoUri = getMongoUri()
  if (!mongoUri) {
    throw new Error('Missing MONGODB_URI environment variable')
  }
  if (cached.conn) return cached.conn

  if (!cached.promise) {
    cached.promise = mongoose.connect(mongoUri, {
      bufferCommands: false,
    })
  }

  cached.conn = await cached.promise
  return cached.conn
}
