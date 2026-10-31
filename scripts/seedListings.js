import dotenv from 'dotenv';
import Listing from '../models/Listing.js';
import { connectDB } from '../config/db.js';

dotenv.config();

const mockListings = [
  {
    id: 1001,
    verticalId: 'vehicles',
    providerId: 1,
    providerType: 'Dealer',
    title: '2023 Toyota Camry GLE',
    description: 'Mint condition, single owner, full service history.',
    category: 'Vehicles',
    subcategory: 'Cars',
    attributes: {
      bodyType: 'Sedan',
      make: 'Toyota',
      model: 'Camry GLE',
      year: 2023,
      mileage: 18000,
      transmission: 'Automatic',
      fuel: 'Petrol'
    },
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
    providerType: 'Dealer',
    title: '2022 Land Cruiser VXR',
    description: 'Top of the line VXR model. Sunroof, leather seats.',
    category: 'Vehicles',
    subcategory: 'Cars',
    attributes: {
      bodyType: 'SUV',
      make: 'Toyota',
      model: 'Land Cruiser VXR',
      year: 2022,
      mileage: 32000,
      transmission: 'Automatic',
      fuel: 'Petrol'
    },
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
    providerType: 'Landlord',
    title: 'Modern 2BHK Apartment',
    description: 'Beautiful city view, fully furnished, gym and pool access.',
    category: 'Accommodation',
    subcategory: 'Rent (Apartment/Villa)',
    attributes: {
      bedrooms: 2,
      bathrooms: 2,
      sizeSqFt: 1292,
      furnishing: 'Furnished',
      propertyType: 'Apartment'
    },
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
  },
  {
    id: 3001,
    verticalId: 'jobs',
    providerId: 3,
    providerType: 'Direct Employer',
    title: 'Senior React Developer',
    description: 'Looking for an experienced React developer to join our growing team.',
    category: 'Jobs',
    subcategory: 'Jobs Offered',
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
      industry: 'IT/Telecom'
    }
  },
  {
    id: 4001,
    verticalId: 'services',
    providerId: 4,
    providerType: 'Agency',
    title: 'Deep Home Cleaning',
    description: 'Professional cleaning service for your entire house. 5-star rated.',
    category: 'Services',
    subcategory: 'Cleaning & Laundry',
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
      experience: '3 years',
      serviceType: 'Deep cleaning'
    }
  },
  {
    id: 5001,
    verticalId: 'classifieds',
    providerId: 5,
    providerType: 'Private Seller',
    title: 'iPhone 15 Pro, 256 GB',
    description: 'Excellent condition, original box and accessories included.',
    category: 'Classifieds',
    subcategory: 'Mobile Phones',
    pricing: { originalPrice: 3200, discountedPrice: 2750, currency: 'QAR' },
    location: { city: 'Doha', country: 'Qatar' },
    imageUrl: 'https://images.unsplash.com/photo-1696446701796-da61225697cc?auto=format&fit=crop&w=1000&q=85',
    attributes: { condition: 'Good', brand: 'Apple' },
    status: 'active',
    active: true,
    validity: { from: new Date(), to: new Date(new Date().setFullYear(new Date().getFullYear() + 1)) }
  },
  {
    id: 5002,
    verticalId: 'classifieds',
    providerId: 5,
    providerType: 'Private Seller',
    title: 'Solid wood dining table with 6 chairs',
    description: 'Beautifully maintained set, ready for collection.',
    category: 'Classifieds',
    subcategory: 'Furniture',
    pricing: { originalPrice: 1400, discountedPrice: 950, currency: 'QAR' },
    location: { city: 'Al Rayyan', country: 'Qatar' },
    imageUrl: 'https://images.unsplash.com/photo-1617802690992-15d93263d3a9?auto=format&fit=crop&w=1000&q=85',
    attributes: { condition: 'Good', brand: 'Solid wood' },
    status: 'active',
    active: true,
    validity: { from: new Date(), to: new Date(new Date().setFullYear(new Date().getFullYear() + 1)) }
  },
  {
    id: 5003,
    verticalId: 'classifieds',
    providerId: 5,
    providerType: 'Private Seller',
    title: 'Samsung 55-inch 4K Smart TV',
    description: 'Clear picture, streaming apps and remote included.',
    category: 'Classifieds',
    subcategory: 'TVs',
    pricing: { originalPrice: 1800, discountedPrice: 1250, currency: 'QAR' },
    location: { city: 'Doha', country: 'Qatar' },
    imageUrl: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=1000&q=85',
    attributes: { condition: 'Good', brand: 'Samsung' },
    status: 'active',
    active: true,
    validity: { from: new Date(), to: new Date(new Date().setFullYear(new Date().getFullYear() + 1)) }
  },
  {
    id: 5004,
    verticalId: 'classifieds',
    providerId: 5,
    providerType: 'Private Seller',
    title: 'Large-capacity front-load washing machine',
    description: 'Clean, fully working home appliance. Collection from Lusail.',
    category: 'Classifieds',
    subcategory: 'Home Appliances',
    pricing: { originalPrice: 1100, discountedPrice: 800, currency: 'QAR' },
    location: { city: 'Lusail', country: 'Qatar' },
    imageUrl: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=1000&q=85',
    attributes: { condition: 'Good', brand: 'Front-load' },
    status: 'active',
    active: true,
    validity: { from: new Date(), to: new Date(new Date().setFullYear(new Date().getFullYear() + 1)) }
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
