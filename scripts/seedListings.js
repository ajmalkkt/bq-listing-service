import dotenv from 'dotenv';
import Listing from '../models/Listing.js';
import { connectDB } from '../config/db.js';

dotenv.config();

const mockListings = [
  {
    id: 1001,
    verticalId: 'vehicles',
    providerId: 1,
    title: '2023 Toyota Camry GLE',
    description: 'Mint condition, single owner, full service history.',
    category: 'Sedan',
    pricing: {
      originalPrice: 115000,
      discountedPrice: 108000,
      currency: 'QAR'
    },
    location: {
      city: 'Doha',
      country: 'Qatar'
    },
    imageUrl: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&q=80&w=800',
    status: 'active',
    active: true,
    validity: {
      from: new Date(),
      to: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
    }
  },
  {
    id: 1002,
    verticalId: 'vehicles',
    providerId: 1,
    title: '2022 Land Cruiser VXR',
    description: 'Top of the line VXR model. Sunroof, leather seats.',
    category: 'SUV',
    pricing: {
      originalPrice: 320000,
      discountedPrice: 295000,
      currency: 'QAR'
    },
    location: {
      city: 'Al Wakrah',
      country: 'Qatar'
    },
    imageUrl: 'https://images.unsplash.com/photo-1594502184342-2e12f877aa73?auto=format&fit=crop&q=80&w=800',
    status: 'active',
    active: true,
    validity: {
      from: new Date(),
      to: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
    }
  },
  {
    id: 2001,
    verticalId: 'accommodations',
    providerId: 2,
    title: 'Modern 2BHK Apartment',
    description: 'Beautiful city view, fully furnished, gym and pool access.',
    category: 'Apartment',
    pricing: {
      originalPrice: 8500,
      discountedPrice: 7800,
      currency: 'QAR'
    },
    location: {
      city: 'West Bay',
      country: 'Qatar'
    },
    imageUrl: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=800',
    status: 'active',
    active: true,
    validity: {
      from: new Date(),
      to: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
    },
    attributes: {
      bedrooms: 2,
      bathrooms: 2,
      area: 120,
      furnished: true
    }
  },
  {
    id: 3001,
    verticalId: 'jobs',
    providerId: 3,
    title: 'Senior React Developer',
    description: 'Looking for an experienced React developer to join our growing team.',
    category: 'IT & Software',
    pricing: {
      originalPrice: 0,
      discountedPrice: 25000,
      currency: 'QAR'
    },
    location: {
      city: 'Doha',
      country: 'Qatar'
    },
    imageUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&q=80&w=800',
    status: 'active',
    active: true,
    validity: {
      from: new Date(),
      to: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
    },
    attributes: {
      jobType: 'Full-time',
      experience: '5+ years',
      level: 'Senior'
    }
  },
  {
    id: 4001,
    verticalId: 'services',
    providerId: 4,
    title: 'Deep Home Cleaning',
    description: 'Professional cleaning service for your entire house. 5-star rated.',
    category: 'Cleaning',
    pricing: {
      originalPrice: 500,
      discountedPrice: 350,
      currency: 'QAR'
    },
    location: {
      city: 'Pearl Qatar',
      country: 'Qatar'
    },
    imageUrl: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&q=80&w=800',
    status: 'active',
    active: true,
    validity: {
      from: new Date(),
      to: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
    },
    attributes: {
      rating: 4.8,
      experience: '3 years'
    }
  }
];

async function seed() {
  try {
    await connectDB();
    console.log('Connected to MongoDB');

    for (const l of mockListings) {
      await Listing.findOneAndUpdate({ id: l.id }, l, { upsert: true, new: true });
      console.log(`Seeded/Updated listing: ${l.title}`);
    }

    console.log('Listing seeding complete');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

seed();
