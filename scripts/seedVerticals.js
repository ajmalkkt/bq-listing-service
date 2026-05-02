import dotenv from 'dotenv';
import Vertical from '../models/Vertical.js';
import { connectDB } from '../config/db.js';

dotenv.config();

const verticals = [
  {
    id: 'restaurants',
    name: 'Restaurant Offers',
    enabled: true,
    description: 'Discover amazing restaurant offers and deals',
    icon: 'UtensilsCrossed',
    color: '#8B1538',
    route: '/restaurants'
  },
  {
    id: 'vehicles',
    name: 'Vehicles',
    enabled: true,
    description: 'Buy and sell vehicles with verified dealers',
    icon: 'Car',
    color: '#1E3A8A',
    route: '/vehicles'
  },
  {
    id: 'accommodations',
    name: 'Accommodations',
    enabled: true,
    description: 'Find perfect accommodation for your stay',
    icon: 'Home',
    color: '#059669',
    route: '/accommodations'
  }
];

async function seed() {
  try {
    await connectDB();
    console.log('Connected to MongoDB');

    for (const v of verticals) {
      await Vertical.findOneAndUpdate({ id: v.id }, v, { upsert: true, new: true });
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
