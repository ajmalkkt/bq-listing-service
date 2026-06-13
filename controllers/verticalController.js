import Vertical from "../models/Vertical.js";

// @desc    Get all verticals
// @route   GET /api/verticals
// @access  Public
export const getAllVerticals = async (req, res) => {
  try {
    const verticals = await Vertical.find({});
    res.json(verticals);
  } catch (error) {
    res.status(500).json({ message: "Error fetching verticals", error: error.message });
  }
};

// @desc    Create a new vertical
// @route   POST /api/verticals
// @access  Public (or should be protected depending on needs)
export const createVertical = async (req, res) => {
  try {
    const vertical = new Vertical(req.body);
    const createdVertical = await vertical.save();
    res.status(201).json(createdVertical);
  } catch (error) {
    res.status(400).json({ message: "Error creating vertical", error: error.message });
  }
};
