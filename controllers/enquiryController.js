import { sendEmail, sendEmailUsingNodemailer, sendReplyEmailUsingNodemailer, sendAccountCreatedEmail, sendTokenEmail } from "../utils/emailService.js";
import Enquiry from "../models/Enquiry.js";

export const sendEnquiryEmail = async (req, res) => {
  try {
    const { details, userName, email, phone } = req.body;
    // Here you would integrate with an email service like SendGrid, Mailgun, etc.
    console.log(`enquiryController:Enquiry received from name: ${userName}, email: ${email}, phone: ${phone}`);
    //resolve name as userName if provided else use user name from token or else use email  username (first part)
    const name = userName ? userName : (req.user && req.user.name ? req.user.name : email.split("@")[0]);
    //console.log(`enquiryController:Enquiry name resolved as: ${name}`);
    //const emailId = email; //"no-reply@browseqtr.com";
    const message = details;
    const ownerLogin = req.user && req.user.email ? req.user.email : null;
    // 1-Save enquiry to MongoDB. need to use same field names as in Enquiry model
    const newEnquiry = new Enquiry({ name, email, phone, message, ownerLogin });
    const savedEnq = await newEnquiry.save();
    console.log(`Enquiry saved with ID: ${savedEnq._id}`);
    //2- Simulate email sending
    //res.json({ success: true, message: "Enquiry sent successfully" });
    //const result = await sendEmail(name, email, phone, message);
    //using nodemailer
    const result = await sendEmailUsingNodemailer(name, email, phone, message);

    if (result.success) {
      console.log("Enquiry email sent successfully");
      await sendReplyEmailUsingNodemailer(name, email, message);
      console.log("Reply email sent successfully to user " + name);
      res.status(200).json({ message: "Enquiry sent successfully" });
    } else {
      const updateEnq = await Enquiry.findByIdAndUpdate(
        savedEnq._id,
        { status: 'SEND_FAILED' },
        { new: true }
      );
      console.error("Failed to send enquiry email:", result.error);
      res.status(500).json({ error: "Failed to send enquiry" });
    }
  } catch (err) {
    console.error("Error sending enquiry email:", err);
    res.status(500).json({ error: err.message });
  }
};

export const getEnquiries = async (req, res) => {
  try {
    const enquiries = await Enquiry.find().sort({ createdAt: -1 }); // Latest first
    res.status(200).json(enquiries);
  } catch (err) {
    console.error("Error fetching enquiries:", err);
    res.status(500).json({ error: err.message });
  }
};

export const getEnquiriesByPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Fetch paginated enquiries for email from req.user.email
    //add filter if role is not admin (only their enquiries) or
    // ownerLogin field to filter restaurant owner's enquiries
    const filter = {};
    if (req.user && req.user.role !== 'admin') {
      filter.$or = [
        { email: req.user.email },
        { ownerLogin: req.user.email }
      ];
    }

    const totalEnquiries = await Enquiry.countDocuments(filter);

    const enquiries = await Enquiry.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      page,
      totalPages: Math.ceil(totalEnquiries / limit),
      totalEnquiries,
      enquiries,
    });
  } catch (err) {
    console.error("Error fetching paginated enquiries:", err);
    res.status(500).json({ error: err.message });
  }
};

//Update enquiry status to IN_PROGRESS or RESOLVED
export const updateEnquiryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["NEW", "IN_PROGRESS", "RESOLVED", "SEND_FAILED"].includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    const updatedEnquiry = await Enquiry.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!updatedEnquiry) {
      return res.status(404).json({ error: "Enquiry not found" });
    }

    res.status(200).json(updatedEnquiry);
  } catch (err) {
    console.error("Error updating enquiry status:", err);
    res.status(500).json({ error: err.message });
  }
};

//sendAccountCreatedEmail. Body will contain a temporary password,
//to be used for login and that has to be added to the reply email.
export const sendAccountCreationEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { tempPassword } = req.body;
    const enquiry = await Enquiry.findById(id);
    if (!enquiry) {
      return res.status(404).json({ error: "Enquiry not found" });
    }
    const { name, email } = enquiry;
    const result = await sendAccountCreatedEmail(name, email, tempPassword);
    if (result.success) {
      console.log("Account created email sent successfully to user " + name);
      res.status(200).json({ message: "Account created email sent successfully" });
    } else {
      console.error("Failed to send account created email:", result.error);
      res.status(500).json({ error: "Failed to send account created email" });
    }
  } catch (err) {
    console.error("Error sending reply email:", err);
    res.status(500).json({ error: err.message });
  }
};

//delete enquiry by id (admin only) - optional
export const deleteEnquiry = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedEnquiry = await Enquiry.findByIdAndDelete(id);

    if (!deletedEnquiry) {
      return res.status(404).json({ error: "Enquiry not found" });
    }

    res.status(200).json({ message: "Enquiry deleted successfully" });
  } catch (err) {
    console.error("Error deleting enquiry:", err);
    res.status(500).json({ error: err.message });
  }
};
// delete all enquiries - optional
export const deleteAllEnquiries = async (req, res) => {
  try {
    const result = await Enquiry.deleteMany({});
    res.status(200).json({ message: `Deleted ${result.deletedCount} enquiries.` });
  } catch (err) {
    console.error("Error deleting all enquiries:", err);
    res.status(500).json({ error: err.message });
  }
};

// Send Token Email Controller
export const triggerTokenEmail = async (req, res) => {
  try {
    const { name, email, token } = req.body;

    if (!name || !email || !token) {
      return res.status(400).json({ message: "name, email, and token are required" });
    }

    const result = await sendTokenEmail(name, email, token);

    if (result.success) {
      res.status(200).json({ success: true, message: "Token email sent successfully" });
    } else {
      res.status(500).json({ success: false, message: "Failed to send token email" });
    }
  } catch (error) {
    console.error("Error in triggerTokenEmail:", error);
    res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
};
