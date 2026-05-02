import Counter from "../models/Counter.js";

//getNextSequence function increments by 1 and returns 
// the new value (new: true), logic dictates that the database should hold 
// the highest ID currently in use
export const getNextSequence = async (sequenceName) => {
  const counter = await Counter.findByIdAndUpdate(
    sequenceName,
    { $inc: { sequence_value: 1 } },
    { new: true, upsert: true }
  );
  return counter.sequence_value;
};

/**
 * Manually sets the sequence counter to a specific value.
 * Call this after a bulk import.
 * 
 * @param {string} sequenceName - e.g., "offers"
 * @param {number} value - The highest ID currently in your database (e.g., 500)
 */
export const setSequenceValue = async (sequenceName, value) => {
  const counter = await Counter.findByIdAndUpdate(
    sequenceName,
    { $set: { sequence_value: value } }, // $set overrides the current value
    { new: true, upsert: true }
  );
  
  console.log(`Sequence '${sequenceName}' reset to: ${counter.sequence_value}`);
  return counter.sequence_value;
};
