import dotenv from 'dotenv';
import { readFile } from 'node:fs/promises';
import Vertical from '../models/Vertical.js';
import { connectDB } from '../config/db.js';

dotenv.config();

async function seed() {
  try {
    await connectDB();
    console.log('Connected to MongoDB');

    const verticals = JSON.parse(await readFile(new URL('./verticals.json', import.meta.url), 'utf8'));
    for (const v of verticals) {
      await Vertical.findOneAndUpdate({ id: v.id }, { $set: v }, { upsert: true, new: true, setDefaultsOnInsert: true });
      console.log(`Seeded/Updated vertical: ${v.name}`);
    }

    console.log('Seeding complete');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

seed();
